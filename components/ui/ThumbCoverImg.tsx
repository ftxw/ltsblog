"use client";

import { useState } from "react";
import { thumbUrlOf, fallbackThumbImage } from "@/app/lib/image-thumb";

/**
 * 通用"封面/大图"缩略图包装：服务端组件可直接传入 src/url，
 * 内部用 useState 切换缩略图与原图，img 节点仍走浏览器原生 <img>（无 next/image 限制）。
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
  const [broken, setBroken] = useState(false);
  // src 变化时重置 broken（渲染期 prev 比较，避免 effect 内 setState 的级联渲染）
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setBroken(false);
  }
  const displaySrc = broken ? src : thumbUrlOf(src);
  return (
    // 通用缩略图包装：需 onError 回退原图，原生 <img> 才能满足，属预期降级
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={(e) => fallbackThumbImage(e.currentTarget, src)}
    />
  );
}
