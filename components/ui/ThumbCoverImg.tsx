"use client";

import { thumbUrlOf, markImgBroken } from "@/app/lib/image-thumb";

/**
 * 通用"封面/大图"缩略图包装：服务端组件可直接传入 src/url，
 * 内部直接用 thumbUrlOf 缩略图路径，img 节点仍走浏览器原生 <img>（无 next/image 限制）。
 * 加载失败即换统一占位图，不再二次请求原图。
 */
export default function ThumbCoverImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // 通用缩略图包装：需 onError 失败即占位，原生 <img> 才能满足，属预期降级
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbUrlOf(src)}
      alt={alt}
      className={className}
      onError={(e) => markImgBroken(e.currentTarget, src)}
    />
  );
}
