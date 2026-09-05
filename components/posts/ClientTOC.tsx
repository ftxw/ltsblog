"use client";
import { useEffect, useState } from 'react';

type TocItem = {
  level: number;
  text: string;
  id: string;
};

// 🌟 核心增幅：终极 Markdown 净化器！
// 专门用来扒掉诸如 [链接名字](https://...) 的外壳，只留下 "链接名字"
const cleanMarkdownHeading = (rawText: string) => {
  if (!rawText) return '';
  return rawText
    // 1. 提取超链接中的文本内容：[我的标题](https://...) -> 我的标题
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 2. 去除 Markdown 图片：![图片](URL) -> 图片
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 3. 兜底防御：去除可能混入的 HTML 标签
    .replace(/<\/?[^>]+(>|$)/g, '')
    // 4. 去除加粗、斜体、删除线、行内代码符号等
    .replace(/[*_~`#]/g, '')
    .trim();
};

// 🌟 底层 ID 净化器
const getSafeId = (rawText: string) => {
  // 先把超链接外壳扒掉，得到纯文本
  const cleanText = cleanMarkdownHeading(rawText);
  // 再杀掉所有标点、空格，只保留汉字、字母和数字生成绝对安全的 ID
  return 'toc-' + cleanText
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .toLowerCase();
};

// 🌟 侧边栏视觉净化器
const getDisplayText = (rawText: string) => cleanMarkdownHeading(rawText);

export default function ClientTOC({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");

  // 滚动监听：同步当前激活的标题
  useEffect(() => {
    const contentDiv = document.getElementById('article-content');
    if (!contentDiv) return;

    const headings = Array.from(contentDiv.querySelectorAll('h1, h2, h3'));

    // 🌟 强制统一正文 ID
    headings.forEach((heading) => {
      heading.id = getSafeId(heading.textContent || '');
    });

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const offset = 150;

      let currentActiveId = "";

      for (const heading of headings) {
        const elementTop = heading.getBoundingClientRect().top + scrollY;
        if (scrollY >= elementTop - offset) {
          currentActiveId = heading.id;
        } else {
          break;
        }
      }

      if (currentActiveId) setActiveId(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener('scroll', handleScroll);
  }, [toc]);

  // 🌟 与最初版本（7febfc3）完全一致的 rAF 缓动滚动：600ms easeInOutCubic。
  // 唯一差异：去掉立即 setActiveId(id)，让 scroll 事件按真实滚动位置驱动
  // 光亮从当前项逐步过渡到目标项 —— 这就是"去掉先返回第一个目录"的效果。
  const scrollToHeading = (e: React.MouseEvent, id: string) => {
    // 🌟 防止任何超链接的意外默认行为
    e.preventDefault();

    const targetElement = document.getElementById(id);
    if (!targetElement) return;

    const offset = 100;
    const targetY = targetElement.getBoundingClientRect().top + window.scrollY - offset;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 600;
    let startTime: number | null = null;

    const easeInOutCubic = (t: number, b: number, c: number, d: number) => {
      t /= d / 2;
      if (t < 1) return c / 2 * t * t * t + b;
      t -= 2;
      return c / 2 * (t * t * t + 2) + b;
    };

    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;

      const nextY = easeInOutCubic(timeElapsed, startY, distance, duration);
      window.scrollTo(0, nextY);

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        window.scrollTo(0, targetY);
      }
    };

    requestAnimationFrame(animation);
  };

  if (!toc || toc.length === 0) return null;

  return (
    <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-white/40 dark:border-white/10 shadow-xl sticky top-28 transition-colors duration-700 max-h-[75vh] overflow-y-auto custom-scrollbar">
      <h3 className="font-black text-slate-900 dark:text-white mb-4 border-l-4 border-indigo-500 pl-2 text-sm tracking-widest">
        CONTENTS
      </h3>
      <nav className="flex flex-col gap-1.5 relative">
        {/* 灰色背景竖线 */}
        <div className="absolute left-[3px] top-0 bottom-0 w-[2px] bg-slate-200 dark:bg-slate-700/50 rounded-full"></div>

        {toc.map((item, index) => {
          const displayText = getDisplayText(item.text);
          const safeId = getSafeId(item.text);
          const isActive = activeId === safeId;

          return (
            <button
              key={safeId || index}
              onClick={(e) => scrollToHeading(e, safeId)}
              className={`group relative grid grid-cols-[8px_1fr] items-start gap-2 text-left text-sm transition-all duration-300 cursor-pointer py-0.5
                ${item.level === 1 ? 'font-bold' : ''}
                ${item.level === 3 ? 'text-xs' : ''}
                ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold drop-shadow-[0_0_6px_rgba(99,102,241,0.35)]'
                    : 'text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400'
                }
              `}
            >
              {/* 固定光点列：grid 强制横向与文字并排 */}
              <span
                className={`block w-[6px] h-[6px] mt-[6px] justify-self-center rounded-full transition-all duration-300
                  ${
                    isActive
                      ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] scale-125'
                      : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-indigo-400'
                  }
                `}
              ></span>
              {/* 文字部分按层级缩进 */}
              <span
                className={`min-w-0 break-words ${
                  item.level === 1 ? '' : item.level === 2 ? 'pl-3' : 'pl-6'
                }`}
              >
                {displayText}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}