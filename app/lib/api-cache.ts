/**
 * 公开只读接口的进程内存缓存助手
 *
 * 用法：
 * 1. GET 接口：把查询逻辑包进 loader，命中缓存时不会执行 loader（不查库/不发外部请求）
 *      return cachedPublicGet(CACHE_NAMESPACE.posts, req, async () => { ...查询...; return data });
 * 2. 写接口：成功写库后调用对应的 invalidateXxxCaches() 主动清缓存
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  memoryCacheGet,
  memoryCacheSet,
  invalidateMemoryCache,
  invalidateMemoryCacheNamespaces,
  clearAllMemoryCache,
} from "./memory-cache";
import { singleFlight } from "./single-flight";
import { edgeonePurgeConfigured, purgeEdgeOneSite, purgeEdgeOneUrls } from "./edgeone-purge";

/**
 * 响应返回后刷新 EdgeOne 节点缓存（不阻塞响应，未配置密钥时为空操作）。
 * paths 为站内路径列表，如 ["/", "/posts"]。
 */
function purgeEdgeOneAfter(paths: string[]): void {
  if (!edgeonePurgeConfigured()) return;
  try {
    after(async () => {
      await purgeEdgeOneUrls(paths);
    });
  } catch {
    // after() 只能在请求上下文内调用；异常时静默跳过，缓存自然过期
  }
}

/** 公开只读接口的缓存时长（60s） */
export const PUBLIC_API_CACHE_TTL = 60_000;

export const CACHE_NAMESPACE = {
  posts: "posts", // /api/posts 列表（分页/筛选组合按 URL 区分）
  postsCount: "posts-count", // /api/posts/count
  chatters: "chatters", // /api/chatters 列表
  chattersCount: "chatters-count", // /api/chatters/count
  categories: "categories", // /api/categories
  tags: "tags", // /api/tags
  albums: "albums", // /api/albums
  albumPhotos: "album-photos", // /api/albums/[albumId]/photos（photowall 首屏并发拉取，必须缓存）
  projects: "projects", // /api/projects
  projectComments: "project-comments", // /api/projects/[id]/comments
  bookmarks: "bookmarks", // /api/bookmarks
  profileStats: "profile-stats", // /api/dashboard/profile-stats
  music: "music", // /api/music（网易云歌单，外部请求较慢）
  comments: "comments", // 文章/说说评论列表
  businessLinks: "business-links", // /api/business-links 业务链接
} as const;

/**
 * 包装公开只读 GET 接口
 * - 命中缓存：直接返回（带 X-Cache: HIT 响应头，便于调试）
 * - 未命中：执行 loader，成功结果缓存 60s（带 X-Cache: MISS）
 * - loader 抛错时不缓存，错误由调用方 catch 处理
 */
export async function cachedPublicGet<T>(
  namespace: string,
  req: Request | null,
  loader: () => Promise<T>,
): Promise<NextResponse> {
  const key = req ? req.url : namespace;
  const hit = memoryCacheGet<T>(namespace, key);
  if (hit !== undefined) {
    return NextResponse.json(hit, { headers: { "X-Cache": "HIT" } });
  }

  // 并发去重：TTL 到期 / 刚被 invalidate 的瞬间，所有并发请求都会 miss。
  // 不去重的话它们会各自执行一次 loader —— 对 /api/music 这种会打外网的接口，
  // 等于同时发起 N 个外网请求，外网一慢就长时间占满函数实例。
  let shared = true;
  try {
    const data = await singleFlight(`${namespace}::${key}`, async () => {
      shared = false;
      const loaded = await loader();
      memoryCacheSet(namespace, key, loaded, PUBLIC_API_CACHE_TTL);
      return loaded;
    });
    return NextResponse.json(data, {
      headers: { "X-Cache": shared ? "HIT-INFLIGHT" : "MISS" },
    });
  } catch (err) {
    // loader 抛错时不缓存，错误由调用方处理
    throw err;
  }
}

/** 文章内容/点赞变化 → 文章列表、计数、分类/标签 post_count、文章评论、资料统计 */
export function invalidatePostCaches(detailPath?: string): void {
  invalidateMemoryCacheNamespaces([
    CACHE_NAMESPACE.posts,
    CACHE_NAMESPACE.postsCount,
    CACHE_NAMESPACE.tags,
    CACHE_NAMESPACE.categories,
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.profileStats,
  ]);
  // ISR 页面即时刷新：发布/修改文章后首页与文章列表立即生效，不等 60s revalidate
  revalidatePath("/");
  revalidatePath("/posts");
  // EdgeOne 节点缓存：首页 + 文章列表 +（可选）文章详情页
  purgeEdgeOneAfter(detailPath ? ["/", "/posts", detailPath] : ["/", "/posts"]);
}

/** 说说内容/点赞/评论变化 → 说说列表、计数、评论、资料统计 */
export function invalidateChatterCaches(): void {
  invalidateMemoryCacheNamespaces([
    CACHE_NAMESPACE.chatters,
    CACHE_NAMESPACE.chattersCount,
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.profileStats,
  ]);
  revalidatePath("/");
  revalidatePath("/moments");
  purgeEdgeOneAfter(["/", "/moments"]);
}

/** 分类/标签变化 → 分类、标签、文章列表（post_count 变化） */
export function invalidateCatalogCaches(): void {
  invalidateMemoryCacheNamespaces([
    CACHE_NAMESPACE.categories,
    CACHE_NAMESPACE.tags,
    CACHE_NAMESPACE.posts,
    CACHE_NAMESPACE.postsCount,
  ]);
  revalidatePath("/");
  revalidatePath("/posts");
  purgeEdgeOneAfter(["/", "/posts"]);
}

/** 相册/照片变化 → 相册列表、相册照片、资料统计。detailPath 传相册详情页路径 */
export function invalidateAlbumCaches(detailPath?: string): void {
  invalidateMemoryCacheNamespaces([
    CACHE_NAMESPACE.albums,
    CACHE_NAMESPACE.albumPhotos,
    CACHE_NAMESPACE.profileStats,
  ]);
  revalidatePath("/");
  revalidatePath("/photowall");
  purgeEdgeOneAfter(
    detailPath ? ["/", "/photowall", detailPath] : ["/", "/photowall"]
  );
}

export function invalidateProjectCaches(): void {
  invalidateMemoryCacheNamespaces([
    CACHE_NAMESPACE.projects,
    CACHE_NAMESPACE.projectComments,
    CACHE_NAMESPACE.profileStats,
  ]);
  revalidatePath("/");
  revalidatePath("/projects");
  purgeEdgeOneAfter(["/", "/projects"]);
}

export function invalidateBookmarkCaches(): void {
  invalidateMemoryCache(CACHE_NAMESPACE.bookmarks);
  revalidatePath("/bookmark");
  purgeEdgeOneAfter(["/bookmark"]);
}

/** 业务链接增删改 → 链接列表缓存 */
export function invalidateBusinessLinkCaches(): void {
  invalidateMemoryCache(CACHE_NAMESPACE.businessLinks);
}

/** 评论新增/删除/点赞 → 评论列表（详情页由写接口按 slug 刷新） */
export function invalidateCommentCaches(): void {
  invalidateMemoryCache(CACHE_NAMESPACE.comments);
}

/** 站点配置保存 → 全局缓存 + 全站 ISR 刷新（头像/背景/歌单等影响所有页面） */
export function invalidateAllPublicCaches(): void {
  clearAllMemoryCache();
  revalidatePath("/", "layout");
  // 站点配置影响所有页面外壳 → EdgeOne 整站前缀刷新
  if (edgeonePurgeConfigured()) {
    try {
      after(async () => {
        await purgeEdgeOneSite();
      });
    } catch {
      // 非请求上下文时静默跳过
    }
  }
}
