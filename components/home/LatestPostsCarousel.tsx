// components/home/LatestPostsCarousel.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import SafeImage from '@/components/ui/SafeImage';
import { useTheme } from '@/components/providers/ThemeProvider';
import { thumbUrlOf } from '@/app/lib/image-thumb';

export interface CarouselPost {
  id: string;
  title: string;
  description: string;
  cover: string;
  formattedDate: string;
}

export default function LatestPostsCarousel({ posts }: { posts: CarouselPost[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [currentIndex, setCurrentIndex] = useState(0);

  // 设置自动播放定时器
  useEffect(() => {
    if (posts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % posts.length);
    }, 5000); // 5秒切换一次
    return () => clearInterval(timer);
  }, [posts.length]);

  if (!posts || posts.length === 0) return null;

  const currentPost = posts[currentIndex];
  const hasCover = !!currentPost.cover;
  const coverSrc = thumbUrlOf(currentPost.cover);

  const holoVariants = {
    // 与说说轮播保持一致：首屏直接显示当前帧，切换幻灯片时才交叉淡入淡出
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <div className="relative group w-full h-full flex flex-col overflow-hidden">

      {/* 整个卡片的点击跳转区域 */}
      <Link href={currentPost.id === 'none' ? '#' : `/posts/${currentPost.id}`} className="absolute inset-0 z-20" aria-label={`阅读 ${currentPost.title}`} />

      {/* 有封面：渐变交叉淡入淡出的图片背景；无封面：与夜间/日间模式切换卡片一致的毛玻璃背景 */}
      {hasCover ? (
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentPost.id}
            variants={holoVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-0"
          >
            <SafeImage
              src={coverSrc}
              fallbackSrc={currentPost.cover}
              fill
              priority={currentIndex === 0}
              alt={currentPost.title}
              className="object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-transform duration-1000 group-hover:scale-105"></div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className={`absolute inset-0 z-0 transition-colors duration-500 ${isDark ? 'bg-slate-800/40' : 'bg-white/40'}`} />
      )}

      {/* 文本内容区 */}
      <div className="relative z-10 flex flex-col justify-end p-6 w-full mt-auto h-full pointer-events-none">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 bg-indigo-500/80 backdrop-blur-lg rounded-full text-[10px] text-white font-black uppercase tracking-widest shadow-lg">Latest Insight</span>
        </div>
        {/* 标题距卡片底部与相册大海报保持一致：标题 + 单行描述，整体贴近底部留白 */}
        <h2 className={`text-2xl font-bold mb-1.5 group-hover:-translate-y-1 transition-transform drop-shadow-md ${
          hasCover || isDark ? 'text-white' : 'text-slate-800'
        }`}>{currentPost.title}</h2>
        <p className={`text-sm line-clamp-1 drop-shadow-sm ${
          hasCover || isDark ? 'text-gray-300' : 'text-slate-600'
        }`}>{currentPost.description}</p>
      </div>

      {/* 底部导航小圆点 (放在可点击的 Link 层之上) */}
      {posts.length > 1 && (
        <div className="absolute bottom-4 right-6 z-30 flex gap-2">
          {posts.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation(); // 阻止触发父级的外层跳转
                setCurrentIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-6 bg-indigo-400' : 'w-2 bg-white/40 hover:bg-white/80'}`}
              aria-label={`切换到第 ${i + 1} 篇文章`}
            />
          ))}
        </div>
      )}
    </div>
  );
}