"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { thumbUrlOf } from "@/app/lib/image-thumb";
import SearchBar from "@/components/SearchBar";
import ProfileCard from "@/components/home/ProfileCard";
import SafeImage from "@/components/ui/SafeImage";
// 修复首屏抖动：这些组件 SSR 安全，改为服务端渲染，HTML 直接包含完整布局，
// 避免 hydration 后逐个挂载撑开容器造成布局跳变。
import CloudPlayer from "@/components/music/CloudPlayer";
import LyricBar from "@/components/music/LyricBar";
import LatestPostsCarousel from "@/components/home/LatestPostsCarousel";
import LatestChatterCarousel from "@/components/home/LatestChatterCarousel";
import SiteDashboard from "@/components/widgets/SiteDashboard";
import ThemeToggleBlock from "@/components/home/ThemeToggleBlock";
import { useTheme } from "@/components/providers/ThemeProvider";

// 模块级标记：客户端模块只在页面首次加载时执行一次。
// 用于区分"刷新 / 直接访问"（需强制回顶）与"SPA 客户端导航"（保留 Next.js 滚动恢复）。
let didInitialReset = false;

export interface SearchPost {
  id: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
}

export interface CarouselItem {
  id: string;
  title: string;
  description: string;
  cover: string;
  formattedDate: string;
}

export interface PhotoWallData {
  cover: string;
  title: string;
  description: string;
}

export default function HomeClient({
  searchPosts,
  latestPosts,
  latestChatters,
  photoWall,
  postCount,
  chatterCount,
  photoCount,
}: {
  searchPosts: SearchPost[];
  latestPosts: CarouselItem[];
  latestChatters: CarouselItem[];
  photoWall: PhotoWallData;
  postCount: number;
  chatterCount: number;
  photoCount: number;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const photoWallHasCover = !!photoWall.cover;

  // 首页是 SSR 完整渲染，刷新时页面会被多种机制自动推离顶部：
  // ① 浏览器原生滚动恢复 ② Chrome 焦点恢复（搜索框是页面首个可聚焦控件，刷新后聚焦并滚动使其可见）
  // ③ Next.js hydration 后的滚动位置恢复。照片墙（初始 loading 内容矮被钳制）和音乐页（内部滚动容器）无此问题。
  // 对策：禁用原生滚动恢复 + 失焦 + 多时机回顶（立即 / 下一帧 / 资源加载完成），
  // 并在短暂窗口内拦截"非用户主动"的自动滚动（用户一旦操作立即解除，不影响浏览）。
  // 后续 SPA 导航进入首页不干预，保留 Next.js 的滚动位置恢复。
  useEffect(() => {
    if (didInitialReset) return;
    didInitialReset = true;

    // 禁用浏览器原生滚动恢复：刷新后不再恢复/记住上次滚动位置
    try {
      history.scrollRestoration = "manual";
    } catch {
      /* 不支持该 API 时忽略 */
    }

    const resetScroll = () => {
      // 失焦：避免 Chrome 焦点恢复把页面滚到搜索框等上次交互的控件
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
      ) {
        document.activeElement.blur();
      }
      window.scrollTo(0, 0);
    };
    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    window.addEventListener("load", resetScroll);

    // 首次加载后的短暂窗口内：若发生"非用户主动"的滚动（滚动恢复 / 焦点滚动），强制拉回顶部；
    // 用户一旦主动交互（滚轮 / 点击 / 键盘 / 触摸）立即解除，不影响正常浏览。
    let interacted = false;
    const guardScroll = () => {
      if (!interacted && window.scrollY > 0) window.scrollTo(0, 0);
    };
    const releaseGuard = () => {
      if (interacted) return;
      interacted = true;
      window.removeEventListener("scroll", guardScroll);
      window.removeEventListener("pointerdown", releaseGuard);
      window.removeEventListener("wheel", releaseGuard);
      window.removeEventListener("keydown", releaseGuard);
      window.removeEventListener("touchstart", releaseGuard);
    };
    window.addEventListener("scroll", guardScroll, { passive: true });
    window.addEventListener("pointerdown", releaseGuard, { once: true });
    window.addEventListener("wheel", releaseGuard, { once: true });
    window.addEventListener("keydown", releaseGuard, { once: true });
    window.addEventListener("touchstart", releaseGuard, { once: true });
    const guardTimer = window.setTimeout(releaseGuard, 3000);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("load", resetScroll);
      window.removeEventListener("scroll", guardScroll);
      releaseGuard();
      clearTimeout(guardTimer);
    };
  }, []);

  return (
    <div className="container-page pb-6">
      {/* 首页搜索框即页头：从上往下出现 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <SearchBar posts={searchPosts} />
      </motion.div>

      <main className="flex flex-col gap-6 w-full mt-6">
        {/* 第一行：个人信息 + 播放器 */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full"
        >
          {/* 手机上占满1列，电脑上占7列 */}
          <div className="col-span-1 lg:col-span-7 flex flex-col">
            <ProfileCard postCount={postCount} chatterCount={chatterCount} photoCount={photoCount} />
          </div>
          {/* 手机上占满1列，电脑上占5列 */}
          <div className="col-span-1 lg:col-span-5 flex flex-col">
            <CloudPlayer />
          </div>
        </motion.div>

        {/* 歌词栏 */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
          className="w-full"
        >
          <LyricBar />
        </motion.div>

        {/* 第二行：相册 + 文章轮播 + 说说 + 主题切换 */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, delay: 0.16, ease: "easeOut" }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full"
        >
            {/* 左侧：相册大海报 (电脑端占4列，采用原文章轮播的尺寸) */}
            <div className="col-span-1 lg:col-span-4 flex flex-col min-h-[300px]">
              <Link
                href="/photowall"
                className="w-full h-full rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl overflow-hidden transition-all duration-700 hover:scale-[1.02] relative group flex-shrink-0"
              >
                {photoWallHasCover ? (
                  <>
                    <SafeImage
                      src={thumbUrlOf(photoWall.cover)}
                      fallbackSrc={photoWall.cover}
                      fill
                      priority
                      alt={photoWall.title}
                      className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
                    />
                    {/* 参考项目文章卡片遮罩：渐变 + 随图片同步缩放，杜绝漏边抖动 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-transform duration-700 group-hover:scale-105"></div>
                  </>
                ) : (
                  <div className={`absolute inset-0 transition-colors duration-500 ${isDark ? "bg-slate-800/40" : "bg-white/40"}`} />
                )}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 right-6">
                  <h3 className={`text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 underline decoration-pink-400 ${
                    photoWallHasCover || isDark ? "text-white" : "text-slate-800"
                  }`}>{photoWall.title}</h3>
                  <p className={`text-sm sm:text-lg line-clamp-1 ${
                    photoWallHasCover || isDark ? "text-white/90" : "text-slate-600"
                  }`}>{photoWall.description}</p>
                </div>
              </Link>
            </div>

            {/* 右侧：组合面板 (电脑端占8列) */}
            <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
              {/* 文章轮播大海报（采用原相册大海报的尺寸） */}
              <div className="w-full rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl overflow-hidden transition-all duration-700 relative group min-h-[200px] sm:min-h-[220px] flex-shrink-0">
                <LatestPostsCarousel posts={latestPosts} />
              </div>

              {/* 底层网格：说说轮播 + 主题切换器 */}
              {/* 手机上单列，平板上分3列比例分布 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full flex-1">
                <div className="sm:col-span-2 flex flex-col min-h-[200px]">
                  <LatestChatterCarousel chatters={latestChatters} />
                </div>
                <div className="sm:col-span-1 flex flex-col min-h-[120px]">
                  <ThemeToggleBlock />
                </div>
              </div>
            </div>
          </motion.div>

          {/* 底部数据面板 */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5, delay: 0.24, ease: "easeOut" }}
            className="w-full"
          >
            <SiteDashboard />
          </motion.div>
        </main>
      </div>
  );
}
