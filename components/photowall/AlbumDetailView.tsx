"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { markImgBroken } from "@/app/lib/image-thumb";
import {
  PhotoCard,
  TimelineView,
  parsePhotoDate,
  type Photo,
} from "@/components/photowall/PhotoWallShared";

/** 相册详情一次性 SSR 全部照片 URL，若数百张全部挂载会并发触发大量图片请求。
 *  分批挂载：首屏只渲染 INITIAL_BATCH 张，滚动接近末尾时每批追加 LOAD_BATCH 张，
 *  配合 PhotoCard 内 loading="lazy"，任意时刻的图片并发都被限制在可视区域内。 */
const INITIAL_BATCH = 24;
const LOAD_BATCH = 24;

/** 服务端传给详情页的相册数据（JSON 可序列化） */
export interface AlbumDetailData {
  id: string;
  title: string;
  description: string;
  cover: string;
  /** YYYY-MM-DD */
  date: string;
  layout: "grid" | "timeline";
  photos: { url: string; caption?: string; takenAt?: string | null }[];
}

export default function AlbumDetailView({
  data,
  onBack,
}: {
  data: AlbumDetailData;
  /** 前端内联展开时传入：收起详情返回列表（不触发路由跳转）；缺省走路由返回 */
  onBack?: () => void;
}) {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    caption?: string;
  } | null>(null);

  const photos: Photo[] = useMemo(
    () =>
      data.photos.map((p) => ({
        url: p.url,
        caption: p.caption,
        takenAt: parsePhotoDate(p.takenAt ?? undefined),
      })),
    [data.photos]
  );

  // 分批挂载：当前已渲染的照片数（初始 1 批）
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_BATCH, data.photos.length)
  );
  // 末尾哨兵：接近视口时追加下一批
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= photos.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + LOAD_BATCH, photos.length));
        }
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, photos.length]);

  // 当前批次的照片；timeline 布局同样按此切片（分组随数量增长自动补全）
  const visiblePhotos = useMemo(
    () => photos.slice(0, visibleCount),
    [photos, visibleCount]
  );

  const hasMore = visibleCount < photos.length;

  return (
    <div className="min-h-screen relative pb-32">
      <div className="container-page relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4 border-b border-slate-300/50 dark:border-slate-700/50 pb-6"
        >
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => (onBack ? onBack() : router.push("/photowall"))}
                className="group flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <span className="bg-white/40 dark:bg-slate-800/50 backdrop-blur-md p-1.5 rounded-lg border border-white/50 dark:border-white/10 shadow-sm group-hover:shadow-md transition-all">
                  <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
                </span>
                返回画廊
              </button>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {data.date}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-wider mb-2">
              {data.title}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">
              {data.description}
            </p>
          </div>

          <div className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/50 dark:border-white/10 shadow-sm">
            共{" "}
            <span className="text-indigo-500 dark:text-indigo-400 text-lg">
              {data.photos.length}
            </span>{" "}
            瞬间
          </div>
        </motion.div>

        {data.layout === "timeline" ? (
          <TimelineView photos={visiblePhotos} onPick={setSelectedImage} />
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
            {visiblePhotos.map((photo, index) => (
              <PhotoCard
                key={`${photo.url}-${index}`}
                url={photo.url}
                alt={photo.caption || "照片"}
                index={index}
                onClick={() => setSelectedImage(photo)}
                className="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-zoom-in shadow-lg bg-white/20 dark:bg-slate-800/20 border border-white/30 dark:border-white/10 transition-shadow duration-500 hover:shadow-2xl hover:shadow-indigo-500/20"
                imgClassName="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-5">
                  {photo.caption && (
                    <p className="text-white font-medium text-sm drop-shadow-md translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      {photo.caption}
                    </p>
                  )}
                </div>
              </PhotoCard>
            ))}
          </div>
        )}

        {/* 分批加载哨兵：尚有未渲染照片时显示在底部，进入视口自动追加下一批 */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-slate-400 dark:text-slate-500"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            加载更多照片…
          </div>
        )}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-10 cursor-zoom-out animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-2">
            <X className="w-6 h-6" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element -- 全屏原图为图床大图，原生 img 直连（失败即占位） */}
          <img
            src={selectedImage.url}
            alt={selectedImage.caption || "全屏照片"}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => markImgBroken(e.currentTarget, selectedImage.url)}
          />

          {selectedImage.caption && (
            <div className="absolute bottom-10 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-white text-sm font-medium tracking-wide shadow-2xl">
              {selectedImage.caption}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}
