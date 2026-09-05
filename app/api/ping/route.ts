import { NextResponse } from "next/server";

/**
 * 轻量保活/健康检查接口（无 DB、无外部请求）。
 *
 * 用途：供 UptimeRobot / 定时任务每 1~5 分钟 ping 一次，把函数实例维持在
 * 已预热状态，减少「空闲回收后冷启动排队 → 偶发 502 / 页面转圈」。
 * 相比直接 ping 首页（会写 PV 统计、查数据库），本接口开销为零。
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    time: Date.now(),
    pong: "pong",
  });
}
