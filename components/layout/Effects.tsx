"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import Sakura from "@/components/layout/Sakura";
import Fireflies from "@/components/layout/Fireflies";

/**
 * 前台背景特效（与参考站一致）：
 *   白天（浅色主题）→ 樱花飘落
 *   夜晚（深色主题）→ 萤火虫漫游
 * 两者不同时出现，切换主题时用 1s 透明度淡入淡出过渡。
 * 特效层级 z-index: 0 —— 与内容卡片（relative z-10 / backdrop-blur）同层但按 DOM 顺序
 * 排在页面内容之前，因此呈现在卡片下方（不会盖住文字）。
 */
export default function Effects() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none transition-opacity duration-1000 ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
      >
        <Fireflies />
      </div>
      <div
        aria-hidden
        className={`pointer-events-none transition-opacity duration-1000 ${
          isDark ? "opacity-0" : "opacity-100"
        }`}
      >
        <Sakura />
      </div>
    </>
  );
}
