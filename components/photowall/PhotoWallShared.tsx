"use client";

import { useMemo, useState, type ReactNode, type SyntheticEvent } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { thumbUrlOf, markImgBroken } from "@/app/lib/image-thumb";

export interface Photo {
  url: string;
  caption?: string;
  /** 拍摄日期，用于时间轴视图分组 */
  takenAt?: Date;
}

/** 约定式缩略图 404（存量图片无 thumb/ 对象）时失败即停，换统一占位图（不再回退原图） */
export function imgFallback(e: SyntheticEvent<HTMLImageElement>, original: string) {
  markImgBroken(e.currentTarget, original);
}

/** 把任意可识别日期字符串安全解析为 Date 对象 */
export function parsePhotoDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** 相册时间徽章：年-月-日（YYYY-MM-DD） */
export function formatAlbumDateFull(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** 把时间戳格式化为「2026年8月」月份标题（时间轴按年月分组） */
function formatTimelineMonth(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/** 把时间戳格式化为「2026-08-20」右下角日期章（与归档矩阵网格卡片一致） */
function formatStampDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-M 用作月份分组键，保证按本地时间分组 */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

/**
 * 照片卡片：图片加载完成后才播放入场动画。
 * 解决 columns 瀑布流中 `loading="lazy"` 且 img 无固定高度时，卡片先动画、
 * 图片后加载出来的"滞后"观感；错峰节奏（index % 12）与文章列表卡片一致。
 */
export function PhotoCard({
  url,
  alt,
  index,
  onClick,
  className,
  imgClassName,
  stamp,
  children,
}: {
  url: string;
  alt: string;
  index: number;
  onClick?: () => void;
  className?: string;
  imgClassName?: string;
  stamp?: ReactNode;
  children?: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 40 }}
      animate={loaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{
        duration: 0.5,
        delay: loaded ? (index % 12) * 0.08 : 0,
        ease: "easeOut",
      }}
      className={className}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 图床缩略图动态 URL；加载失败即换占位图（next/image 无法表达此回退） */}
      <img
        src={thumbUrlOf(url)}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          markImgBroken(e.currentTarget, url); // 失败即停，不再二次请求原图
          setLoaded(true);
        }}
        className={imgClassName}
      />
      {stamp}
      {children}
    </motion.div>
  );
}

/**
 * 时间轴视图组件：把照片按拍摄日期分组，组内以 grid 排布，组头呈现日期。
 * 入参 photos 中应当含有 takenAt（无 takenAt 的会被排在最后一个伪组里）。
 */
export function TimelineView({
  photos,
  onPick,
}: {
  photos: Photo[];
  onPick: (photo: { url: string; caption?: string }) => void;
}) {
  // 按 takenAt 升序排序；无时间戳的扔到末尾占位组
  const ordered = useMemoOrdered(photos);
  // 按 monthKey（年月）分组，保持日期顺序
  const groups = (() => {
    const map = new Map<string, { date: Date; items: Photo[] }>();
    for (const p of ordered) {
      if (!p.takenAt) continue;
      const k = monthKey(p.takenAt);
      const bucket = map.get(k);
      if (bucket) bucket.items.push(p);
      else map.set(k, { date: p.takenAt!, items: [p] });
    }
    // 把没有 takenAt 的集中放在末尾
    const undated = ordered.filter((p) => !p.takenAt);
    if (undated.length) {
      const today = new Date();
      map.set(`未排期-${monthKey(today)}`, {
        date: today,
        items: undated,
      });
    }
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  })();

  if (!photos.length) {
    return (
      <div className="text-center text-slate-500 dark:text-slate-400 py-24">
        暂无照片
      </div>
    );
  }

  return (
    <div className="relative">
      {groups.map((group) => (
        <section key={group.key} className="relative pl-8 sm:pl-12 mb-12 last:mb-0">
          {/* 时间轴竖线 */}
          <span className="absolute left-3 sm:left-5 top-3 bottom-0 w-px bg-gradient-to-b from-indigo-400/60 via-slate-300/40 to-transparent dark:from-indigo-400/50 dark:via-slate-600/40" />
          {/* 时间轴节点 */}
          <span className="absolute left-3 sm:left-5 top-2 -translate-x-1/2 w-3 h-3 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-400 shadow-[0_0_0_4px_rgba(129,140,248,0.18)]" />
          {/* 月份标题 */}
          <header className="mb-5">
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 tracking-wide">
              {group.key.startsWith("未排期-") ? "未排期" : formatTimelineMonth(group.date)}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {group.items.length} 张照片
            </p>
          </header>
          {/* 组内照片网格：2/3/4 列随宽度变化 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {group.items.map((photo, idx) => {
              const caption = photo.caption;
              return (
                <PhotoCard
                  key={`${photo.url}-${idx}`}
                  url={photo.url}
                  alt={caption || "照片"}
                  index={idx}
                  onClick={() => onPick({ url: photo.url, caption: photo.caption })}
                  className="relative group rounded-xl overflow-hidden cursor-zoom-in shadow-md bg-white/30 dark:bg-slate-800/30 border border-white/40 dark:border-white/10 transition-shadow duration-500 hover:shadow-2xl hover:shadow-indigo-500/30"
                  imgClassName="w-full h-auto object-cover aspect-[4/3] transform transition-transform duration-700 group-hover:scale-105"
                  stamp={
                    photo.takenAt ? (
                      <span className="absolute bottom-2 right-2 z-10 text-white/90 text-[9px] md:text-xs font-mono font-bold bg-black/40 backdrop-blur-sm px-1.5 py-0.5 md:px-2 md:py-1 rounded flex items-center gap-1 select-none">
                        <Calendar size={10} className="md:w-3 md:h-3" />
                        {formatStampDate(photo.takenAt)}
                      </span>
                    ) : undefined
                  }
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-3">
                    {caption && (
                      <p className="text-white font-medium text-xs drop-shadow-md line-clamp-2 translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
                        {caption}
                      </p>
                    )}
                  </div>
                </PhotoCard>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** 排序逻辑单独抽一个小 hook 以保持 TimelineView 主体清晰 */
function useMemoOrdered(photos: Photo[]) {
  return useMemo(() => {
    return [...photos].sort((a, b) => {
      const ta = a.takenAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const tb = b.takenAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [photos]);
}
