"use client";

import { usePathname } from "next/navigation";
import BackgroundRenderer from "@/components/layout/BackgroundRenderer";
import Navbar from "@/components/layout/Navbar";
import ClientWidgets from "@/components/layout/ClientWidgets";
import StatsTracker from "@/components/layout/StatsTracker";
import Effects from "@/components/layout/Effects";

/**
 * 前台外壳：在 /admin/* 路径下隐藏前台导航、背景、挂件、特效与访客统计，
 * 让后台拥有独立的布局（侧边栏 + 顶栏）。
 */
export default function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <div className="flex-1 flex flex-col">{children}</div>;
  }

  return (
    <>
      <BackgroundRenderer />
      <Effects />
      <Navbar />
      <main className="flex-1 pt-16">{children}</main>
      <ClientWidgets />
      <StatsTracker />
    </>
  );
}
