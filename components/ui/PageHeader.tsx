"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * 页面页头：标题 + 简介 + 右侧可选内容（搜索框等）。
 * 统一所有前台页面的页头写法与入场动画（y:-20 / 0.5s 淡入）。
 */
export default function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6"
    >
      <div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-widest mb-2 transition-colors duration-700">
          {title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium tracking-wider transition-colors duration-700">
          {subtitle}
        </p>
      </div>
      {right}
    </motion.div>
  );
}
