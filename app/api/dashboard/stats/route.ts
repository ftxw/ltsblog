import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { memoryCacheGet, memoryCacheSet } from "@/app/lib/memory-cache";
import { singleFlight } from "@/app/lib/single-flight";

// 仪表盘统计缓存 30s：接口内查询较多，加内存缓存避免每次进入仪表盘都打一轮远程库
const STATS_CACHE_TTL = 30_000;
const STATS_CACHE_KEY = "dashboard-stats";

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export async function GET(request: Request) {
  try {
    const payload = await getCurrentUser(request);
    if (!String(payload.sub || "")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const cached = memoryCacheGet<Record<string, unknown>>(
      STATS_CACHE_KEY,
      STATS_CACHE_KEY
    );
    if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });

    // 并发去重：本接口一次要发 15+ 个查询，而 Prisma 连接池只有 5 个。
    // 没有去重时，TTL 到期的瞬间若有多个并发请求（仪表盘轮询 + 手动刷新），
    // 全部同时打库，多出来的查询只能在连接池排队 —— 后台也会「卡住」。
    const data = await singleFlight(STATS_CACHE_KEY, async () => {
      // 进入 singleFlight 后可能已有别的请求填好缓存（双重检查）
      const again = memoryCacheGet<Record<string, unknown>>(
        STATS_CACHE_KEY,
        STATS_CACHE_KEY
      );
      if (again) return again;
      return computeStats();
    });
    return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return NextResponse.json(
      { code: 1, message: "获取统计数据失败" },
      { status: 500 }
    );
  }
}

/** 计算统计数据（只被 singleFlight 调用，保证同刻只有一个实例在跑） */
async function computeStats(): Promise<Record<string, unknown>> {
  const now = new Date();

  // 访客统计（轻量聚合表）查询范围：日期串（中国时区）
  const tzShift = 8 * 3600 * 1000;
  const statsStartStr = new Date(now.getTime() - 29 * 24 * 3600 * 1000 + tzShift)
    .toISOString()
    .slice(0, 10);
  const todayStr = new Date(now.getTime() + tzShift).toISOString().slice(0, 10);
  const weekStartStr = new Date(now.getTime() - 6 * 24 * 3600 * 1000 + tzShift)
    .toISOString()
    .slice(0, 10);

  const [
    publishedPosts,
    draftPosts,
    categoriesCount,
    tagsCount,
    commentsCount,
    chattersCount,
    photosCount,
    latestPosts,
    latestChatters,
    latestArticleComments,
    latestChatterComments,
    latestProjectComments,
    dailyStats,
    todayStat,
    weekAgg,
  ] = await Promise.all([
    prisma.post.count({ where: { status: "published" } }),
    prisma.post.count({ where: { status: "draft" } }),
    prisma.category.count(),
    prisma.tag.count(),
    prisma.comment.count(),
    prisma.chatter.count({ where: { status: "published" } }),
    prisma.photo.count(),
    // ===== 最新内容：最近发布的文章 / 说说 =====
    prisma.post.findMany({
      where: { status: "published" },
      orderBy: { published_at: "desc" },
      take: 20,
      select: { id: true, title: true, published_at: true, created_at: true },
    }),
    prisma.chatter.findMany({
      where: { status: "published" },
      orderBy: { created_at: "desc" },
      take: 20,
      select: { id: true, content: true, created_at: true },
    }),
    // ===== 最新留言：文章 / 说说 / 项目评论 =====
    prisma.comment.findMany({
      where: { status: "approved" },
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true,
        email_user_name: true,
        content: true,
        created_at: true,
        post: { select: { title: true } },
      },
    }),
    prisma.chatterComment.findMany({
      where: { status: "approved" },
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true,
        email_user_name: true,
        content: true,
        created_at: true,
        chatter: { select: { content: true } },
      },
    }),
    prisma.projectComment.findMany({
      where: { status: "approved" },
      orderBy: { created_at: "desc" },
      take: 10,
      select: {
        id: true,
        email_user_name: true,
        content: true,
        created_at: true,
        project: { select: { name: true } },
      },
    }),
    // ===== 访客统计（轻量聚合） =====
    prisma.dailyStat.findMany({
      where: { date: { gte: statsStartStr } },
      orderBy: { date: "asc" },
    }),
    prisma.dailyStat.findUnique({ where: { date: todayStr } }),
    prisma.dailyStat.aggregate({
      _sum: { pv: true, uv: true },
      where: { date: { gte: weekStartStr } },
    }),
  ]);

  // 最近访客：独立容错。visitor_log 为较新的轻量明细表，
  // 旧库 / 旧 Prisma Client 可能没有该模型，单独失败不影响其余统计。
  //
  // 展示策略：按 IP 去重，每个访客只显示「最近一次访问」。
  // 原因：同一访客持续浏览会周期性产生多条明细（5 分钟节流），
  // 若直接按时间倒序取 20 条，活跃访客会占满窗口、把其它人刷掉。
  // 用窗口函数取每个 IP 最新一条，再按时间倒序展示 20 个「不同访客」。
  let recentVisitors: Array<{
    id: string;
    ip: string;
    address: string;
    browser: string;
    created_at: Date;
  }> = [];
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        ip: string;
        address: string;
        browser: string;
        created_at: Date;
      }>
    >`
      SELECT id, ip, address, browser, created_at
      FROM (
        SELECT id, ip, address, browser, created_at,
               row_number() OVER (PARTITION BY ip ORDER BY created_at DESC) AS rn
        FROM visitor_log
      ) ranked
      WHERE rn = 1
      ORDER BY created_at DESC
      LIMIT 20
    `;
    recentVisitors = rows;
  } catch (e) {
    console.error("Dashboard recentVisitors query failed:", e);
  }

  // 合并最新内容：文章（published_at）与说说（created_at）按时间倒序取 10
  const latestContent = [
    ...latestPosts.map((p) => ({
      id: p.id,
      type: "post" as const,
      title: p.title,
      time: (p.published_at ?? p.created_at).toISOString(),
    })),
    ...latestChatters.map((c) => ({
      id: c.id,
      type: "chatter" as const,
      title: c.content.replace(/\s+/g, " ").trim().slice(0, 60),
      time: c.created_at.toISOString(),
    })),
  ]
    .sort((a, b) => (a.time < b.time ? 1 : -1))
    .slice(0, 20);

  // 合并最新留言：三种评论按时间倒序取 10
  const latestComments = [
    ...latestArticleComments.map((c) => ({
      id: c.id,
      type: "文章" as const,
      author: c.email_user_name || "匿名",
      content: c.content.replace(/\s+/g, " ").trim().slice(0, 60),
      target: c.post?.title ?? "",
      time: c.created_at.toISOString(),
    })),
    ...latestChatterComments.map((c) => ({
      id: c.id,
      type: "说说" as const,
      author: c.email_user_name || "匿名",
      content: c.content.replace(/\s+/g, " ").trim().slice(0, 60),
      target: c.chatter?.content.replace(/\s+/g, " ").trim().slice(0, 30) ?? "",
      time: c.created_at.toISOString(),
    })),
    ...latestProjectComments.map((c) => ({
      id: c.id,
      type: "项目" as const,
      author: c.email_user_name || "匿名",
      content: c.content.replace(/\s+/g, " ").trim().slice(0, 60),
      target: c.project?.name ?? "",
      time: c.created_at.toISOString(),
    })),
  ]
    .sort((a, b) => (a.time < b.time ? 1 : -1))
    .slice(0, 20);

  // 访客趋势：把 daily_stat 行合并进 30 天数组（缺的天补 0）
  const statMap = new Map(dailyStats.map((s) => [s.date, s]));
  const days = getLast30Days();
  const trafficTrend = days.map((d) => {
    const s = statMap.get(d);
    return { date: d, pv: s?.pv ?? 0, uv: s?.uv ?? 0 };
  });

  const data: Record<string, unknown> = {
    counts: {
      posts: publishedPosts,
      drafts: draftPosts,
      categories: categoriesCount,
      tags: tagsCount,
      comments: commentsCount,
      chatters: chattersCount,
      photos: photosCount,
    },
    latest_content: latestContent,
    latest_comments: latestComments,
    traffic: {
      today: { pv: todayStat?.pv ?? 0, uv: todayStat?.uv ?? 0 },
      week: {
        pv: Number(weekAgg._sum.pv ?? 0),
        uv: Number(weekAgg._sum.uv ?? 0),
      },
      trend: trafficTrend,
      recent_visitors: recentVisitors.map((v) => ({
        id: v.id,
        ip: v.ip,
        address: v.address,
        browser: v.browser,
        time: v.created_at.toISOString(),
      })),
    },
  };

  memoryCacheSet(STATS_CACHE_KEY, STATS_CACHE_KEY, data, STATS_CACHE_TTL);
  return data;
}
