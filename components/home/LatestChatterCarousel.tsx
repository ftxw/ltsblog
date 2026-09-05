// components/home/LatestChatterCarousel.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import SafeImage from '@/components/ui/SafeImage';
import { useTheme } from '@/components/providers/ThemeProvider';
import { thumbUrlOf } from '@/app/lib/image-thumb';

export interface CarouselChatter {
  id: string;
  title: string;
  description: string;
  cover: string;
  formattedDate: string;
}

export default function LatestChatterCarousel({ chatters }: { chatters: CarouselChatter[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (chatters.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % chatters.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [chatters.length]);

  if (!chatters || chatters.length === 0) return null;

  const currentChatter = chatters[currentIndex];
  const hasCover = !!currentChatter.cover;
  const coverSrc = thumbUrlOf(currentChatter.cover);

  const holoVariants = {
    // 简化动画：去掉 scale/blur，避免 SSR 初始态模糊缩放被感知为抖动
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    // 🌟 注意这里：去掉了 md:col-span-8，变成一个纯粹填满父容器的组件
    <div className="w-full h-full rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl overflow-hidden relative group min-h-[220px] flex flex-col">
      <Link href="/moments" className="absolute inset-0 z-20" aria-label={`查看杂谈: ${currentChatter.title}`} />

      {/* 有封面：渐变交叉淡入淡出的图片背景；无封面：与夜间/日间模式切换卡片一致的毛玻璃背景 */}
      {hasCover ? (
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentChatter.id}
            variants={holoVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-0"
          >
            <SafeImage
              src={coverSrc}
              fallbackSrc={currentChatter.cover}
              fill
              alt="Chatter Cover"
              className="object-cover opacity-80 dark:opacity-60 transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-transform duration-1000 group-hover:scale-105"></div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className={`absolute inset-0 z-0 transition-colors duration-500 ${isDark ? 'bg-slate-800/40' : 'bg-white/40'}`} />
      )}

      <div className="relative z-10 flex flex-col justify-end p-6 h-full pointer-events-none w-full md:w-[85%]">
        <div className="flex items-end gap-2 mb-2">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-black/30 backdrop-blur-sm px-2 py-1 rounded-md border border-white/10 shadow-sm">
            Records
          </span>
        </div>

        {/* 标题：无 margin-bottom，紧贴卡片底部留白（p-6） */}
        <h3 className={`text-2xl font-bold line-clamp-2 drop-shadow-md transition-colors ${
          hasCover || isDark ? 'text-white group-hover:text-indigo-300' : 'text-slate-800 group-hover:text-indigo-600'
        }`}>
          {currentChatter.title}
        </h3>
      </div>

      {chatters.length > 1 && (
        <div className="absolute bottom-4 right-6 z-30 flex gap-2">
          {chatters.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
              className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${i === currentIndex ? 'w-6 bg-indigo-400' : 'w-2 bg-white/40 hover:bg-white/80'}`}
              aria-label={`跳转`}
            />
          ))}
        </div>
      )}
    </div>
  );
}