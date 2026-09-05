import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getClientIp } from "@/app/lib/utils";
import { peekGeo, warmGeo, resolveGeo, formatAddress, isPrivateIp } from "@/app/lib/geo";
import { parseBrowser } from "@/app/lib/ua";

/**
 * 访客统计上报（轻量版，公开接口）
 * 只做按天聚合 PV/UV + 访客明细（归属地整串 + 浏览器）。
 * 统计尽力而为：各写操作独立容错，失败不影响主流程。
 *
 * 归属地策略（与后台「最近访客」显示直接相关）：
 * - 内网 / 环回 IP（本机开发、内网访问）不是远程访客：不写访客明细，
 *   避免「未知/本地地址」污染列表；PV/UV 仍正常累计。
 * - 公网 IP 缓存命中：直接用缓存地址。
 * - 公网 IP 未命中且本次要写入一条明细（同 IP 每 5 分钟至多一条）：
 *   同步等待一次在线解析再落库 —— geo 层自带并发上限 3 / 2.5s 超时 /
 *   in-flight 去重 / 失败负缓存，超限立即返回空，不会堆积。
 *   不采用「先记空 + warmGeo 后台预热」：多实例下每个实例的 geo 内存缓存
 *   相互独立，首访实例未必等得到同 IP 的二次访问，首条明细会一直是空。
 * - 公网 IP 未命中且不写明细：仅后台预热（warmGeo），绝不阻塞等待。
 *
 * 防拖垮设计（serverless 多实例 / Supabase 连接有限）：
 * - 清理（deleteMany）不在每个请求执行，改为进程内低频（默认 5 分钟一次），
 *   避免高频全表范围删除占满数据库连接。
 * - 访客明细写入按 IP 节流（同 IP 5 分钟内只落一条），爬虫/高频刷新不会写爆明细表。
 * - 归属地在线查询并发受限（MAX_CONCURRENT_LOOKUPS=3），外部源慢/不可达时
 *   超限请求直接返回空，绝不排队占满实例。
 */

/** 中国时区日期串 YYYY-MM-DD */
function todayStr(): string {
  const now = new Date();
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 保留近 7 天 UV 去重记录，更早的清理掉 */
function uvCutoffStr(): string {
  const d = new Date(Date.now() - 7 * 24 * 3600 * 1000 + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/** 访客明细仅保留近 30 天 */
function visitorCutoff(): Date {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

// ---------- 低频清理（进程内时间戳；serverless 冷启动后首次请求会清一次，可接受） ----------
const CLEAN_INTERVAL = 5 * 60 * 1000; // 5 分钟最多执行一次清理
let lastCleanAt = 0;

async function cleanIfDue(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanAt < CLEAN_INTERVAL) return;
  lastCleanAt = now;
  try {
    await Promise.allSettled([
      prisma.dailyUv.deleteMany({ where: { date: { lt: uvCutoffStr() } } }),
      prisma.visitorLog.deleteMany({ where: { created_at: { lt: visitorCutoff() } } }),
    ]);
  } catch (e) {
    // 清理失败忽略：下次到期重试，不影响本次统计
    console.warn("[stats/record] 低频清理失败:", e);
  }
}

// ---------- 访客明细写入节流（同 IP 5 分钟内只落一条） ----------
const VISITOR_THROTTLE = 5 * 60 * 1000;
const visitorLogTimes = new Map<string, number>();
const VISITOR_MAP_MAX = 2000;

/** 该 IP 是否在节流窗口内（是 → 跳过本次明细写入；否 → 记录并放行） */
function shouldWriteVisitor(ip: string): boolean {
  const now = Date.now();
  const last = visitorLogTimes.get(ip);
  if (last !== undefined && now - last < VISITOR_THROTTLE) return false;

  // 定期清理过期 key，防止 Map 无限增长（冷启动后 Map 为空，天然无泄漏）
  if (visitorLogTimes.size >= VISITOR_MAP_MAX) {
    for (const [k, t] of visitorLogTimes) {
      if (now - t >= VISITOR_THROTTLE) visitorLogTimes.delete(k);
    }
    // 仍超限则全清（极端场景兜底）
    if (visitorLogTimes.size >= VISITOR_MAP_MAX) visitorLogTimes.clear();
  }
  visitorLogTimes.set(ip, now);
  return true;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const date = todayStr();
  const ua = request.headers.get("user-agent") || "";
  const browser = parseBrowser(ua);

  // 归属地策略（重要，直接决定后台「最近访客」能否显示位置）：
  // - 内网 / 环回 IP（本机开发、内网访问）不是远程访客：不写访客明细，
  //   避免把一堆「未知/本地地址」塞进最近访客列表；PV 仍正常累计。
  // - 公网 IP 命中缓存：直接用缓存地址。
  // - 公网 IP 未命中且本次【会写入一条明细】（同 IP 每 5 分钟至多一条）：
  //   同步等待一次在线解析再落库。geo 层自带并发上限(3)/2.5s 超时/in-flight
  //   去重/失败负缓存，超限立即返回空，不会堆积。
  //   为什么不等「先记空 + warmGeo 后台预热」？serverless 多实例下每个实例
  //   的 geo 内存缓存相互独立，首访那个实例未必能等到同 IP 的二次访问，
  //   于是首条明细永远是空 —— 正是「最近访客显示未知」的根因之一。
  // - 未命中且本次不写明细：仅后台预热（warmGeo 内部自带并发限流），绝不阻塞。
  const isPrivate = isPrivateIp(ip);
  const persistVisitor = !isPrivate && shouldWriteVisitor(ip);
  const cached = peekGeo(ip);
  let address = cached ? formatAddress(cached) : "";
  if (cached === null) {
    if (persistVisitor) {
      address = formatAddress(await resolveGeo(ip));
    } else {
      warmGeo(ip);
    }
  }

  try {
    // 低频清理（进程内 5 分钟一次，命中才执行；await 保证 serverless 下不因实例冻结而跳过）
    await cleanIfDue();

    // PV：必做，单行 upsert
    const tasks: Promise<unknown>[] = [
      prisma.dailyStat.upsert({
        where: { date },
        update: { pv: { increment: 1 } },
        create: { date, pv: 1, uv: 0 },
      }),
    ];

    // 访客明细（后台「最近访客」用）：同 IP 5 分钟节流，防止高频请求写爆表。
    // 内网/环回 IP 不写（persistVisitor 已为 false）。
    if (persistVisitor) {
      tasks.push(
        prisma.visitorLog.create({
          data: { ip, address, browser },
        })
      );
    }

    await Promise.allSettled(tasks);

    // UV：当天该 IP 首次出现才 +1（skipDuplicates 并发安全，重复时静默跳过不抛错）
    const created = await prisma.dailyUv.createMany({
      data: [{ date, ip }],
      skipDuplicates: true,
    });
    if (created.count > 0) {
      await prisma.dailyStat.upsert({
        where: { date },
        update: { uv: { increment: 1 } },
        create: { date, pv: 0, uv: 1 },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[stats/record] 统计上报失败:", err);
    // 统计失败不影响主流程
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
