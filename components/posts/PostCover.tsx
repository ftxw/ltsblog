"use client";

import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import { thumbUrlOf } from "@/app/lib/image-thumb";

/** 原样输出的图片：远程绝对 URL（未匹配 remotePatterns 时 next/image 优化器会报错）与 SVG */
function imageUnoptimized(url: string): boolean {
  return /^https?:\/\//i.test(url) || /\.svg(\?|#|$)/i.test(url);
}

/**
 * 文章封面：点击进入全屏灯箱（单图）。
 * 由于 /app/posts/[postId]/page.tsx 是 Server Component，把灯箱状态隔离到这个 client 子组件里。
 */
export default function PostCover({
  src,
  alt,
  className,
  fill = true,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
}) {
  const fallback = src;
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="查看大图"
        className="block w-full h-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        {fill ? (
          <SafeImage
            src={thumbUrlOf(src)}
            fallbackSrc={fallback}
            alt={alt}
            fill
            sizes={sizes}
            unoptimized={imageUnoptimized(src)}
            className={className}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrlOf(src)}
            alt={alt}
            className={className}
            loading="lazy"
            decoding="async"
          />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-8"
          onClick={close}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="关闭大图"
            className="absolute top-4 right-4 md:top-5 md:right-5 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >
            <X size={20} />
          </button>
          {/* 单图无需左右切换，这里保留箭头位占位以保持视觉对齐（隐藏） */}
          <div className="max-w-[95vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 灯箱原图，原生 img 直连避免 next/image 限制 */}
            <img
              src={fallback}
              alt={alt}
              className="max-w-[95vw] max-h-[90vh] w-auto h-auto object-contain"
              decoding="async"
            />
          </div>
        </div>
      )}
    </>
  );
}
