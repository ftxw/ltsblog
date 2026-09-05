"use client";

import { useEffect } from "react";

/**
 * 轻量访客统计上报：每次页面加载上报一次（fire-and-forget）。
 * 服务端只做按天聚合（PV/UV + 地域/设备维度），不存明细。
 * UV 去重由服务端 daily_uv 表保证，前端无需节流。
 */
export default function StatsTracker() {
  useEffect(() => {
    fetch("/api/stats/record", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
