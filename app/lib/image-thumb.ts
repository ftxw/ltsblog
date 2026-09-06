/**
 * 约定式缩略图 URL 推导（纯函数，可被服务端/客户端任意引用）。
 *
 * 支持两种图床形态，规则一致：在原对象路径的文件名前插入 thumb/。
 * 1. 代理模式（默认）：/api/img-proxy/imgs/albums/3/a.jpeg
 *      → /api/img-proxy/imgs/albums/3/thumb/a.jpeg
 * 2. 直链模式：图床 CDN 域名（后台站点配置 imageCdnDomain）下的对象：
 *      https://img.example.com/albums/3/a.jpeg
 *      → https://img.example.com/albums/3/thumb/a.jpeg
 *    直链域名由 configureCdnDomain() 注入（SiteConfigProvider 在渲染时同步）。
 *
 * 非图床 URL（外部直链、本地静态资源）原样返回。
 * 存量图片可能没有 thumb/ 对象，此时加载会 404，由调用方 <img onError> 换成占位图。
 */

/** 统一失败占位图：浅灰底 + 相框 + 斜线（data URI，无需网络请求） */
export const PLACEHOLDER_IMG = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="#e8edf2"/><g fill="none" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"><rect x="56" y="34" width="88" height="82" rx="8"/><path d="M72 92 L92 72 L110 92"/><circle cx="130" cy="58" r="7"/></g><path d="M58 118 L142 32" stroke="#f87171" stroke-width="9" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
})();

/**
 * 图片加载失败处理器（失败即停）：记录 URL 并把该 <img> 换成占位图。
 * 用 dataset.broken 防重入（浏览器可能对同一 src 重复触发 onError）。
 */
export function markImgBroken(img: HTMLImageElement, original: string): void {
  if (img.dataset.broken) return;
  img.dataset.broken = "1";
  console.warn(`[img] 加载失败（已显示占位）: ${original}`);
  img.src = PLACEHOLDER_IMG;
}

/** 直链模式图床域名（如 https://img.example.com，无尾斜杠）；空 = 代理模式 */
let cdnDomain = "";

/** 由 SiteConfigProvider 在拿到站点配置后调用（站点配置全站一致，单站点安全） */
export function configureCdnDomain(domain?: string | null): void {
  cdnDomain = (domain || "").trim().replace(/\/+$/, "");
}

export function thumbUrlOf(url: string): string {
  if (!url) return url;
  // 代理模式：/api/img-proxy/imgs/{dir}/{file} → 在文件名前插 thumb/
  if (url.startsWith("/api/img-proxy/imgs/")) {
    const rest = url.slice("/api/img-proxy/imgs/".length);
    return `/api/img-proxy/imgs/${insertThumbDir(rest)}`;
  }
  // 图床直链：仅当命中已配置的 CDN 域名才按 key 插入 thumb/，不误伤外部图片
  if (cdnDomain && url.startsWith(cdnDomain + "/")) {
    const rest = url.slice(cdnDomain.length + 1);
    return `${cdnDomain}/${insertThumbDir(rest)}`;
  }
  return url;
}

/** 在对象相对路径的文件名前插入 thumb/：a/b/c.jpeg → a/b/thumb/c.jpeg；c.jpeg → thumb/c.jpeg */
function insertThumbDir(rest: string): string {
  const idx = rest.lastIndexOf("/");
  if (idx === -1) return `thumb/${rest}`;
  return `${rest.slice(0, idx)}/thumb/${rest.slice(idx + 1)}`;
}

/**
 * 缩略图加载失败（存量图片无 thumb/ 对象返回 404）时不再切回原图二次请求，
 * 直接失败即停、换统一占位图。函数名/签名保留以兼容既有调用点。
 * 用法：<img src={thumbUrlOf(url)} onError={(e) => fallbackThumbImage(e.currentTarget, url)} />
 */
export function fallbackThumbImage(img: HTMLImageElement, original: string): void {
  markImgBroken(img, original);
}
