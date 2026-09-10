"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import { siteConfig } from "@/siteConfig";
import { formatDateCN } from "@/app/lib/format";
import { thumbUrlOf } from "@/app/lib/image-thumb";

export interface PostOut {
  id: string;
  title: string;
  description: string;
  cover: string;
  category: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PostCardProps {
  post: PostOut;
}

export default function PostCard({ post }: PostCardProps) {
  const defaultCover = useConfigValue("defaultPostCover", siteConfig.defaultPostCover);
  const imageSrc = post.cover || defaultCover || siteConfig.defaultPostCover;
  // 列表显示缩略图（更快更省流），点开文章详情看大图
  const [thumbBroken, setThumbBroken] = useState(false);
  // 切换文章（imageSrc 变化）时重置 broken 状态（渲染期 prev 比较，避免 effect 级联渲染）
  const [prevSrc, setPrevSrc] = useState(imageSrc);
  if (prevSrc !== imageSrc) {
    setPrevSrc(imageSrc);
    setThumbBroken(false);
  }
  const displaySrc = thumbBroken ? imageSrc : thumbUrlOf(imageSrc);

  const dateStr = post.published_at
    ? formatDateCN(new Date(post.published_at))
    : "";

  return (
    <div className="h-full">
      <Link href={`/posts/${post.id}`} className="block group h-full">
        {/* 卡片样式与项目（projects）页一致，排列保持矩阵网格 */}
        <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg rounded-3xl shadow-lg border border-white/60 dark:border-white/10 transition-all duration-500 hover:scale-[1.03] hover:bg-white/70 dark:hover:bg-slate-800/70 hover:shadow-2xl overflow-hidden flex flex-col h-full">
          {/* 封面图 */}
          <div className="w-full h-40 sm:h-48 overflow-hidden relative bg-slate-200 dark:bg-slate-700">
            <SafeImage
              src={displaySrc || siteConfig.defaultPostCover}
              fallbackSrc={imageSrc}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none transition-transform duration-700 group-hover:scale-110"></div>
            {post.is_pinned && (
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/90 text-slate-700 dark:bg-slate-900/80 dark:text-slate-200 backdrop-blur">
                置顶
              </span>
            )}
          </div>

          {/* 文本信息 */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-indigo-600 dark:text-indigo-400 font-bold text-[12px] flex items-center gap-1 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />
                {dateStr}
              </div>
            </div>

            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-tight">
              {post.title}
            </h3>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.slice(0, 6).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400 border border-indigo-500/10 dark:border-indigo-400/10"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

          </div>
        </div>
      </Link>
    </div>
  );
}
