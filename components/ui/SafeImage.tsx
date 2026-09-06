"use client";

import Image from "next/image";
import type { ImageProps } from "next/image";
import { useState } from "react";
import { PLACEHOLDER_IMG } from "@/app/lib/image-thumb";

/**
 * 与 next.config.ts 的 images.remotePatterns 保持一致的白名单。
 * 白名单内的远程域名 + 本地路径 → next/image（享受尺寸/格式优化）
 * 其余任意外链 → 降级为原生 <img>（浏览器直连，不受 remotePatterns 限制）
 *
 * 设计要点：组件内部 useState 跟踪图片加载失败；失败即停——不再请求原图，
 * 直接把 src 换成统一占位图 PLACEHOLDER_IMG（data URI，必加载成功）。
 * 调用方无需传 onError 事件处理器（避免 server→client 边界事件函数序列化问题）。
 */
const ALLOWED_REMOTE_HOSTS = new Set([
  "avatars.githubusercontent.com", // GitHub 头像
  "api.dicebear.com", // dicebear 匿名头像
]);

function isOptimizableUrl(src: string): boolean {
  if (src.startsWith("/")) return true; // 本地静态资源
  try {
    return ALLOWED_REMOTE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

type SafeImageProps = Omit<ImageProps, "src" | "onError" | "placeholder" | "onLoad"> & {
  src: string;
  /** @deprecated 加载失败已统一显示占位图，此字段不再生效，保留仅为兼容存量调用方 */
  fallbackSrc?: string;
  onLoad?: () => void;
};

export default function SafeImage({
  src,
  alt,
  fill,
  className,
  sizes,
  priority,
  quality,
  onLoad,
  ...rest
}: SafeImageProps) {
  const [errored, setErrored] = useState(false);
  // 加载失败即换统一占位图（data URI），不再切回原图、不发起第二次请求
  const effectiveSrc = errored ? PLACEHOLDER_IMG : src;

  if (isOptimizableUrl(effectiveSrc)) {
    return (
      <Image
        src={effectiveSrc}
        alt={alt}
        fill={fill}
        className={className}
        // fill 模式默认 100vw：避免缺少 sizes 的 dev 警告，也让 next/image 生成正确 srcset
        sizes={sizes ?? (fill ? "100vw" : undefined)}
        priority={priority}
        quality={quality}
        // 动态 URL 不使用 blur placeholder（需要 blurDataURL，否则优化器 400
        placeholder="empty"
        onError={() => setErrored(true)}
        onLoad={onLoad}
        {...rest}
      />
    );
  }

  // 降级为原生 <img>：模拟 next/image fill 模式的布局行为。
  // 不再默认加 object-cover，交由调用方 className 决定裁切方式（如 object-contain 完整显示）
  const resolvedClassName = [
    fill ? "absolute inset-0 h-full w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  // 白名单外 URL 只能走原生 <img>（next/image 无法代理任意外链），属预期降级
   
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 白名单外 URL 的预期降级分支（见组件顶部注释），原生 img 是唯一可行实现
    <img
      src={effectiveSrc}
      alt={alt}
      className={resolvedClassName || undefined}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      onLoad={onLoad as React.ReactEventHandler<HTMLImageElement>}
      onError={() => setErrored(true)}
      {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );
}