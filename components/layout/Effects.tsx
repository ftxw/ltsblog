"use client";

import Sakura from "@/components/layout/Sakura";
import Fireflies from "@/components/layout/Fireflies";

/**
 * 前台背景特效：樱花飘落 + 萤火虫漫游。
 * 效果固定开启（不再有四季切换与后台配置项），已移除原 canvas 四季粒子特效。
 * 两个子组件内部均为 pointer-events: none，不遮挡任何交互。
 */
export default function Effects() {
  return (
    <>
      <Sakura />
      <Fireflies />
    </>
  );
}
