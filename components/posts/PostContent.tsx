"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface PostContentProps {
  contentHtml: string;
  highlightKeyword?: string;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function PostContent({ contentHtml, highlightKeyword }: PostContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // 搜索关键词高亮 + 滚动到第一个匹配位置
  useEffect(() => {
    const keyword = (highlightKeyword || "").trim();
    const root = contentRef.current;
    if (!keyword || !root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.textContent || "";
        return text.toLowerCase().includes(keyword.toLowerCase())
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const textNodes: Text[] = [];
    let _tn: Node | null = walker.nextNode();
    while (_tn) {
      textNodes.push(_tn as Text);
      _tn = walker.nextNode();
    }

    textNodes.forEach((node) => {
      const text = node.textContent || "";
      const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, "gi"));
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (part.toLowerCase() === keyword.toLowerCase()) {
          const mark = document.createElement("mark");
          mark.className = "search-highlight";
          mark.textContent = part;
          frag.appendChild(mark);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode?.replaceChild(frag, node);
    });

    // 平滑滚动到第一个高亮位置
    const first = root.querySelector("mark.search-highlight");
    if (first) {
      const y = first.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [highlightKeyword]);

  // 正文图床图片：服务端已把 src 换成缩略图并写入 data-original（原图）。
  // 若缩略图对象不存在（存量图）加载 404，这里把 src 回退到原图。
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const imgs = Array.from(
      root.querySelectorAll<HTMLImageElement>("img[data-original]")
    );
    const onErr = (e: Event) => {
      const img = e.currentTarget as HTMLImageElement;
      const original = img.dataset.original;
      if (!original) return;
      if (img.getAttribute("src") === original) return;
      img.setAttribute("src", original);
    };
    imgs.forEach((img) => img.addEventListener("error", onErr));
    return () => imgs.forEach((img) => img.removeEventListener("error", onErr));
  }, [contentHtml]);

  // 事件委托：点击正文图片打开全屏原图灯箱（用 data-original 原图，而非缩略图）
  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      setLightboxSrc(img.dataset.original || img.currentSrc || img.src);
    }
  }

  return (
    <>
      <div className="relative">
        <style>{`
          .prose {
            max-width: none;
            color: #334155;
          }
          .dark .prose {
            color: #cbd5e1;
          }
          .prose h1 {
            font-size: 1.875rem !important;
            font-weight: 800 !important;
            margin-bottom: 1.5rem;
            color: #0f172a;
            letter-spacing: -0.025em;
          }
          .dark .prose h1 { color: #f8fafc; }
          .prose h2 {
            font-size: 1.5rem !important;
            font-weight: 700 !important;
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e2e8f0;
            color: #0f172a;
            letter-spacing: -0.02em;
          }
          .dark .prose h2 { color: #f8fafc; border-bottom-color: #334155; }
          .prose h3 {
            font-size: 1.25rem !important;
            font-weight: 600 !important;
            margin-top: 2rem;
            margin-bottom: 0.75rem;
            color: #0f172a;
          }
          .dark .prose h3 { color: #f8fafc; }
          .prose p {
            font-size: 1.0625rem;
            line-height: 1.85;
            color: #334155;
            margin-bottom: 1.5rem;
          }
          .dark .prose p { color: #cbd5e1; }
          .prose a {
            color: #4f46e5;
            text-decoration: none;
            font-weight: 500;
            border-bottom: 1px solid rgba(79, 70, 229, 0.3);
            transition: all 0.2s;
          }
          .prose a:hover { color: #6366f1; border-bottom-color: #6366f1; }
          .dark .prose a { color: #818cf8; border-bottom-color: rgba(129, 140, 248, 0.3); }
          .prose ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; }
          .prose ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.5rem; }
          .prose li { margin-bottom: 0.5rem; }
          .prose li::marker { color: #6366f1; }
          .prose del { color: #94a3b8; }
          .prose blockquote {
            border-left: 4px solid #6366f1;
            padding-left: 1.25rem;
            margin: 1.5rem 0;
            color: #64748b;
            font-style: italic;
            background: linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent);
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
            border-radius: 0 0.5rem 0.5rem 0;
          }
          .dark .prose blockquote { color: #94a3b8; }
          .prose pre {
            background-color: #282c34 !important;
            color: #abb2bf !important;
            padding: 1.25rem !important;
            border-radius: 0.75rem !important;
            overflow-x: auto !important;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.3) !important;
            margin-top: 1.5rem !important;
            margin-bottom: 1.5rem !important;
          }
          .prose pre code {
            background-color: transparent !important;
            padding: 0 !important;
            color: inherit !important;
            font-size: 0.9em !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          }
          .prose code::before, .prose code::after { content: none !important; }
          .prose p code, .prose li code {
            background-color: rgba(99, 102, 241, 0.1) !important;
            color: #4f46e5 !important;
            padding: 0.2rem 0.4rem !important;
            border-radius: 0.375rem !important;
            font-weight: 600 !important;
          }
          .dark .prose p code, .dark .prose li code {
            background-color: rgba(99, 102, 241, 0.2) !important;
            color: #818cf8 !important;
          }
          .prose img {
            display: block !important;
            margin: 2rem auto !important;
            border-radius: 1.5rem !important;
            box-shadow: 0 20px 50px rgba(0,0,0,0.15) !important;
            max-width: 100% !important;
            height: auto !important;
          }
          .prose table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 1.5rem 0 !important;
            font-size: 0.9em !important;
          }
          .prose th {
            background-color: rgba(99, 102, 241, 0.1) !important;
            font-weight: 700 !important;
            text-align: left !important;
          }
          .prose th, .prose td {
            border: 1px solid #e2e8f0 !important;
            padding: 0.6rem 1rem !important;
          }
          .dark .prose th, .dark .prose td { border-color: #334155 !important; }
          .prose hr { border-color: #e2e8f0 !important; margin: 2.5rem 0 !important; }
          .dark .prose hr { border-color: #334155 !important; }
          .prose pre code .hljs-comment, .prose pre code .hljs-quote { color: #5c6370 !important; font-style: italic !important; }
          .prose pre code .hljs-keyword, .prose pre code .hljs-selector-tag, .prose pre code .hljs-doctag, .prose pre code .hljs-name { color: #c678dd !important; }
          .prose pre code .hljs-string, .prose pre code .hljs-regexp, .prose pre code .hljs-addition, .prose pre code .hljs-meta .hljs-string { color: #98c379 !important; }
          .prose pre code .hljs-number, .prose pre code .hljs-literal, .prose pre code .hljs-symbol, .prose pre code .hljs-attr, .prose pre code .hljs-variable.constant_ { color: #d19a66 !important; }
          .prose pre code .hljs-title, .prose pre code .hljs-title.function_, .prose pre code .hljs-section { color: #61afef !important; }
          .prose pre code .hljs-built_in, .prose pre code .hljs-deletion, .prose pre code .hljs-variable, .prose pre code .hljs-template-variable { color: #e06c75 !important; }
          .prose pre code .hljs-type, .prose pre code .hljs-class .hljs-title, .prose pre code .hljs-selector-class, .prose pre code .hljs-attribute { color: #e5c07b !important; }
          .prose pre code .hljs-meta, .prose pre code .hljs-keyword.control-flow, .prose pre code .hljs-meta .hljs-keyword { color: #61afef !important; }
          .prose pre code .hljs-params, .prose pre code .hljs-operator, .prose pre code .hljs-punctuation { color: #abb2bf !important; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(99, 102, 241, 0.05); border-radius: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.35); border-radius: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.6); }
          @media (max-width: 768px) {
            .prose { font-size: 0.95rem; }
            .prose p { font-size: 1rem; }
            .prose h1 { font-size: 1.5rem !important; }
            .prose h2 { font-size: 1.35rem !important; }
          }
          .search-highlight {
            background-color: #fde047 !important;
            color: #1e293b !important;
            border-radius: 3px;
            padding: 0 2px;
          }
          .dark .search-highlight {
            background-color: #a16207 !important;
            color: #fef9c3 !important;
          }
        `}</style>

        <div
          id="article-content"
          ref={contentRef}
          className="prose prose-slate dark:prose-invert prose-base md:prose-lg max-w-none text-slate-800 dark:text-slate-200 transition-colors duration-700"
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </div>

      {/* 图片灯箱：portal 到 document.body，避免被正文卡片的 backdrop-blur 包含块限制（否则只在内容栏内“伪全屏”） */}
      {typeof document !== "undefined" &&
        lightboxSrc &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setLightboxSrc(null)}
          >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxSrc(null);
            }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="关闭预览"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- 正文图片可为图床/外链动态 URL，原生 img 直连 */}
          <img
            src={lightboxSrc}
            alt="预览大图"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
          </div>,
          document.body
        )}
    </>
  );
}
