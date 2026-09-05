"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { apiFetch, uploadImage } from "@/components/admin/lib";
import { cn } from "@/components/admin/ui";

/**
 * 图片上传组件：
 * - mode="single"：单图，值变化时回调 onChange(url, orientation)
 * - mode="multi"：多图，onChange(string[])，顺序即数组顺序
 * 支持直接粘贴图片（单图模式）。
 */
export default function ImageUploader({
  mode = "single",
  value,
  onChange,
  onOrientation,
  className,
  height = "h-28",
  square = false,
  canDeleteImage,
  category,
  folder,
  folderResolver,
}: {
  mode?: "single" | "multi";
  value: string | string[];
  onChange: (value: string[]) => void;
  onOrientation?: (orientation: string) => void;
  className?: string;
  height?: string;
  /** 单图模式：预览框固定为正方形（与多图一致的 w-28） */
  square?: boolean;
  /** 删除前保护钩子：返回 false 时跳过图床删除（用于封面与照片共用 URL 等复用场景） */
  canDeleteImage?: (url: string) => boolean;
  /** 图床分类目录（articles/albums/projects/moments/system），决定对象 key 前缀 */
  category?: string;
  /** 分类下的子文件夹（编辑器内容图按实体 id 细分） */
  folder?: string;
  /** 上传前异步解析 folder（如新建实体尚未有 id 时先创建再返回 id）；返回 undefined 时回退到 folder */
  folderResolver?: () => Promise<string | undefined>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 尽力而为：把不再使用的图床文件删掉；失败静默，不影响界面 */
  const deleteHostedImage = async (url: string) => {
    // 复用保护：调用方声明该 URL 仍被其他地方引用时，跳过图床删除
    if (canDeleteImage && !canDeleteImage(url)) return;
    try {
      await apiFetch(`/api/upload/image?url=${encodeURIComponent(url)}`, {
        method: "DELETE",
      });
    } catch {
      // 删除失败静默忽略（图床删除本来就是尽力而为）
    }
  };

  const images = mode === "single" ? (value ? [value as string] : []) : (value as string[]);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      // 允许上传前先解析子目录（新建实体先自动创建拿 id 再落子目录）
      const resolvedFolder = folderResolver ? await folderResolver() : folder;
      // 多图并发上传（对象存储上传有固定网络开销，串行会逐张累加；并发只等最慢一张）
      const results = await Promise.all(
        list.map((file) => uploadImage(file, { category, folder: resolvedFolder }))
      );
      const urls: string[] = [];
      let lastOrientation = "landscape";
      for (const result of results) {
        urls.push(result.url);
        lastOrientation = result.orientation;
      }
      if (mode === "single") {
        // 替换旧图：新图上传成功后，把被替换的旧图从图床删掉（尽力而为）
        const prev = images[0];
        onChange(urls.slice(0, 1));
        onOrientation?.(lastOrientation);
        if (prev && prev !== urls[0]) deleteHostedImage(prev);
      } else {
        onChange([...images, ...urls]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => {
    onChange(images.filter((u) => u !== url));
    // 移除的图不再使用，顺手从图床删掉（尽力而为，失败不影响界面）
    deleteHostedImage(url);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (mode !== "single") return;
    const files = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) {
      e.preventDefault();
      await handleFiles(files);
    }
  };

  return (
    <div className={cn("space-y-2", className)} onPaste={handlePaste}>
      <div className={cn("flex flex-wrap gap-2", height)}>
        {images.map((url) => (
          <div
            key={url}
            className={cn(
              "group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50",
              height,
              mode === "single" ? (square ? "w-28" : "w-full") : "w-28"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="preview"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {(mode === "multi" || images.length === 0) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-indigo-400 hover:text-indigo-500 cursor-pointer",
              height,
              mode === "single" && (square ? "w-28" : "w-full")
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">上传中…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">
                  {mode === "single" ? "点击或粘贴上传" : "点击上传"}
                </span>
              </>
            )}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        multiple={mode === "multi"}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
