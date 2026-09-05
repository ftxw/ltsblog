import HomeClient from "./HomeClient";
import { prisma } from "@/app/lib/prisma";
import { formatDateCN } from "@/app/lib/format";

// 性能优化：首页改 ISR，每 300s 重新验证一次，避免每次访问都实时查库导致 TTFB 变慢
export const revalidate = 300;

// 与参考项目一致的日期格式化：HH:mm 为 00:00 时只显示日期
function formatUpdateTime(date: Date | string): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    if (hours === "00" && mins === "00") return formatDateCN(d);
    return `${formatDateCN(d)} ${hours}:${mins}`;
  } catch {
    return "";
  }
}

async function fetchHomeData() {
  try {
    const [posts, chatters, albums, counts] = await Promise.all([
      // 已发布文章（轻量字段，供全站搜索 + 最新文章轮播；取最近 200 篇足够搜索场景）
      prisma.post.findMany({
        where: { status: "published" },
        select: {
          id: true,
          title: true,
          description: true,
          cover: true,
          published_at: true,
          tags: { select: { tag: { select: { name: true } } } },
        },
        orderBy: { published_at: "desc" },
        take: 200,
      }),
      // 最新 5 条已发布说说
      prisma.chatter.findMany({
        where: { status: "published" },
        orderBy: { created_at: "desc" },
        take: 5,
      }),
      // 相册（用于照片墙大海报）：顺带取第一张照片，无封面时兜底显示
      prisma.album.findMany({
        orderBy: [{ sort: "asc" }, { created_at: "desc" }],
        include: {
          photos: { take: 1, orderBy: { sort: "asc" }, select: { url: true } },
        },
      }),
      // 三个统计计数合并到同一条事务连接执行：冷启动/ISR 重渲染时首页并发的
      // 独立连接请求越少，越不容易在实例刚就绪时互相抢占连接池
      prisma.$transaction([
        prisma.post.count({ where: { status: "published" } }),
        prisma.chatter.count({ where: { status: "published" } }),
        prisma.photo.count(),
      ]),
    ]);

    const [postCount, chatterCount, photoCount] = counts;

    // 全站搜索数据
    const searchPosts = posts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      tags: p.tags.map((t) => t.tag.name),
      date: p.published_at ? formatUpdateTime(p.published_at) : "",
    }));

    // 最新文章轮播（取 5 篇，无文章时给占位）
    const latestPosts =
      posts.length > 0
        ? posts.slice(0, 5).map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            cover: p.cover || "",
            formattedDate: p.published_at ? formatUpdateTime(p.published_at) : "",
          }))
        : [
            {
              id: "none",
              title: "暂无文章",
              description: "快去写第一篇吧！",
              cover: "",
              formattedDate: "",
            },
          ];

    // 最新说说轮播：当前无说说详情页，统一跳转杂谈列表
    const latestChatters =
      chatters.length > 0
        ? chatters.map((c) => {
            let images: string[] = [];
            try {
              const parsed = JSON.parse(c.images || "[]");
              if (Array.isArray(parsed)) images = parsed;
            } catch {
              /* 忽略解析失败 */
            }
            const firstLine =
              c.content
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)[0] || "碎片记录";
            return {
              id: c.id,
              title: firstLine.slice(0, 24),
              description: c.content.replace(/\s+/g, " ").slice(0, 100),
              cover: images[0] || "",
              formattedDate: formatUpdateTime(c.created_at),
            };
          })
        : [
            {
              id: "none",
              title: "暂无记录",
              description: "记录一段思绪...",
              cover: "",
              formattedDate: "",
            },
          ];

    // 最新相册 → 照片墙大海报
    // 与照片墙页机制一致：有封面显示封面，无封面用相册第一张照片，再兜底默认图
    const latestAlbum = albums[0];
    const firstPhotoUrl = latestAlbum?.photos?.[0]?.url || "";
    const photoWall = {
      cover: latestAlbum?.cover || firstPhotoUrl || "",
      title: latestAlbum?.title || "照片墙",
      description: latestAlbum?.description || "记录生活的每一个瞬间",
    };

    return { searchPosts, latestPosts, latestChatters, photoWall, postCount, chatterCount, photoCount };
  } catch {
    return {
      searchPosts: [],
      latestPosts: [
        {
          id: "none",
          title: "暂无文章",
          description: "快去写第一篇吧！",
          cover: "",
          formattedDate: "",
        },
      ],
      latestChatters: [
        {
          id: "none",
          title: "暂无记录",
          description: "记录一段思绪...",
          cover: "",
          formattedDate: "",
        },
      ],
      photoWall: {
        cover: "",
        title: "照片墙",
        description: "记录生活的每一个瞬间",
      },
      postCount: 0,
      chatterCount: 0,
      photoCount: 0,
    };
  }
}

export default async function Home() {
  const data = await fetchHomeData();
  return <HomeClient {...data} />;
}
