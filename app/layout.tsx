import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
// 说明：highlight.js 与 KaTeX 的 CSS 已改为按需加载——
// 仅在真正渲染 Markdown 代码高亮/公式的路由里引入：
//   app/posts/[postId]/page.tsx（文章详情）
//   components/about/AboutMarkdown.tsx（关于页）
// 不再全站注入，避免普通页面/后台白下载这两套样式。
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { BackgroundProvider } from "@/components/providers/BackgroundProvider";
import { MusicProvider } from "@/components/providers/MusicProvider";
import { SiteConfigProvider } from "@/components/providers/SiteConfigProvider";
import SiteFrame from "@/components/layout/SiteFrame";
import { getDbSiteConfig } from "@/app/lib/site-config-db";
import { siteConfig } from "@/siteConfig";

const notoSerifSC = localFont({
  src: [
    { path: "./fonts/noto-serif-sc-400.woff2", weight: "400" },
    { path: "./fonts/noto-serif-sc-700.woff2", weight: "700" },
  ],
  variable: "--font-noto-serif-sc",
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const dbConfig = await getDbSiteConfig();
    return {
      title: dbConfig.title || siteConfig.title,
      description: dbConfig.bio || siteConfig.bio,
      alternates: {
        types: {
          "application/rss+xml": "/feed",
        },
      },
    };
  } catch {
    return {
      title: siteConfig.title,
      description: siteConfig.bio,
      alternates: {
        types: {
          "application/rss+xml": "/feed",
        },
      },
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let dbConfig: Record<string, string> = {};
  try {
    dbConfig = await getDbSiteConfig();
  } catch {
    // fallback to empty, Provider will use siteConfig fallback
  }

  // 站点配置「默认主题」：dark/system → 首帧直接挂 dark class，避免闪白；
  // light → 不加。ThemeProvider 挂载后会按 localStorage/配置最终校准。
  const defaultTheme = dbConfig.themeMode || "dark";
  const initialDark = defaultTheme !== "light";

  return (
    <html
      lang="zh-CN"
      className={`${notoSerifSC.variable} h-full antialiased ${
        initialDark ? "dark" : ""
      }`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <SiteConfigProvider initialConfig={dbConfig}>
          <ThemeProvider>
            <BackgroundProvider>
              <MusicProvider>
                <ToastProvider>
                  <SiteFrame>{children}</SiteFrame>
                </ToastProvider>
              </MusicProvider>
            </BackgroundProvider>
          </ThemeProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
