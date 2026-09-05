"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * 滚动入场容器：内容区块 / 卡片通用（y:40 上浮淡入）。
 * 错峰节奏由 delay 控制（卡片传 index * 0.08），与各页面既有动画完全一致。
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  onClick,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
