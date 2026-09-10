"use client";

import type { ReactNode } from "react";

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

/**
 * 分段筛选器：统一各页面筛选/排序栏的写法、样式与动画。
 * 仅布局差异：
 * - variant="pill"（默认）：宽度自适应、整体居中（说说页排序栏）
 * - variant="bar"：全宽、桌面端左对齐（文章/项目页筛选栏）
 * 圆角、背景、按钮样式、边距完全一致，支持图标与计数。
 */
export default function SegmentedFilter({
  options,
  active,
  onChange,
  variant = "pill",
  className = "",
}: {
  options: SegmentedOption[];
  active: string;
  onChange: (value: string) => void;
  variant?: "pill" | "bar";
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap gap-2 bg-white/30 dark:bg-slate-800/30 backdrop-blur-md p-3 rounded-3xl border border-white/20 dark:border-white/5 ${
        variant === "bar" ? "w-full" : "w-fit mx-auto"
      } ${className}`}
    >
      <div
        className={`flex flex-wrap gap-2 w-full ${
          variant === "bar" ? "justify-center md:justify-start" : "justify-center"
        }`}
      >
        {options.map((opt) => {
          const isActive = active === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-1.5 md:gap-2 px-3 py-2 rounded-xl text-[14px] font-bold transition-all duration-300 ${
                isActive
                  ? "bg-indigo-500 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-400 hover:text-indigo-500"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
