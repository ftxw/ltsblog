import type { NextConfig } from "next";

/**
 * 安全响应头：作用于**所有**路径（含静态资源）。
 *
 * 这些头原先由根目录的 `proxy.ts`（Next.js middleware）逐请求设置。
 * 用 next.config 的 `headers()` 静态声明后，响应头由路由层直接下发，
 * 不产生额外的 middleware 函数调用，行为与平台无关。
 */
const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // 现代浏览器已弃用 X-XSS-Protection，设为 0 关闭，避免误报
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// 生产环境强制 HTTPS。
// `next build` 时 NODE_ENV=production，`next dev` 时 development，
// 与原 proxy.ts 的运行时判断行为一致。
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  });
}

const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_IMAGE = "public, max-age=86400, stale-while-revalidate=3600";

const nextConfig: NextConfig = {
  compress: true,
  // React Compiler：编译期自动记忆化组件与 hook 依赖，消除无谓重渲染。
  // 对评论区、管理后台表单、播放器、灯箱等高频 setState 的客户端组件收益明显；
  // 与手写 useMemo/useCallback 并存，运行时语义不变。
  reactCompiler: true,
  devIndicators: false,
  // 开发环境通过 127.0.0.1 预览，Next.js 15+ 默认只信任 localhost，
  // 必须显式配置 host（纯 host，不带 http://），否则 HMR 会被拦截。
  allowedDevOrigins: ["127.0.0.1"],

  // 告诉 Next.js 把这些包当作外部包（不要让 turbopack 给它们加 hash 路径），
  // 运行时直接从 node_modules 解析。解决 "@prisma/client-<hash>" 找不到的问题。
  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },

  /**
   * 响应头规则（替代已删除的 proxy.ts）。
   *
   * 注意：多条规则命中同一请求时会**按顺序合并**，相同 key 由后面的规则覆盖
   * （next/dist/server/lib/router-utils/resolve-routes.js 里是
   * `resHeaders[key] = value`）。因此下面的顺序刻意与原 proxy.ts 保持一致：
   * 静态扩展名 → /images|/uploads → /api/img-proxy，后者覆盖前者。
   */
  async headers() {
    return [
      // 1+2. 安全响应头（生产环境额外追加 HSTS）—— /:path* 覆盖包括 / 在内的全部路径
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // 3. API 一律不缓存，保证后台写入后前台立即可见。
      //    （headers() 不支持按 method 过滤，故覆盖全部方法；POST/PUT 本身
      //     也不会被缓存，行为上无差异。）
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      // 4. HTML 页面（排除 /api 与 /admin）：允许 CDN 缓存 5 分钟 + 10 分钟 SWR。
      //    让 EdgeOne（blog.lts.cc）和 Vercel 边缘都能直接命中 HTML，
      //    国内访问不必每次跨境回源。注意本条必须排在静态资源规则**之前**，
      //    否则 s-maxage 会覆盖 js/css 的 immutable。
      //    内容变更由后台接口调用 EdgeOne 缓存刷新（edgeone-purge.ts）即时生效；
      //    未配置刷新密钥时，新内容最长 5 分钟自然过期生效。
      {
        source: "/((?!api($|/)|admin($|/)).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
      // 5. 带内容 hash 的静态资源：长缓存
      {
        source: "/:path(.*\\.(?:js|css|woff|woff2|ttf|svg|ico))",
        headers: [{ key: "Cache-Control", value: CACHE_IMMUTABLE }],
      },
      // 6. public 下的图片资源：1 天 + stale-while-revalidate。
      //    注意：原 proxy.ts 的 matcher 把 images/ 与 uploads/ 排除了，
      //    这两条规则实际从未生效（死代码）。改用 headers() 后真正生效，
      //    符合原作者写这段代码的意图。
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMAGE }],
      },
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMAGE }],
      },
      // 7. 图床代理图片：文件名唯一（uuid），可长缓存（覆盖第 3 条 /api 规则）
      {
        source: "/api/img-proxy/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_IMMUTABLE }],
      },
    ];
  },
  images: {
    // next/image 优化图（/_next/image）在 CDN 的最短缓存时间。
    // 默认仅 60s，导致文章配图/头像每次过期都回源重新处理；提到 1 天。
    minimumCacheTTL: 86400,
    remotePatterns: [
      // GitHub 头像
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      // dicebear 匿名头像
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
};

export default nextConfig;
