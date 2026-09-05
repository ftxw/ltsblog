import { NextRequest, NextResponse } from "next/server";
import { createMeting } from "@/app/lib/meting";
import { withTimeout } from "@/app/lib/timeout";

// 音乐链接是动态数据，禁止任何层级的缓存
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 解析播放地址的整体硬超时。
 * 本接口由 <audio> 触发，且实现上会打到外部 Meting 服务，
 * 外网不可达时必须快速失败，绝不能长时间占住函数实例。
 */
const STREAM_DEADLINE = 12_000;

/**
 * 音乐播放地址解析接口。
 *
 * 策略：拿到真实播放地址后直接 **302 重定向**，让浏览器直连上游（网易云 CDN）。
 * 不在这里代理音频流 —— 若服务端中转音频，多 Range 并发 + Cloudflare 等反代
 * 会触发 413 Request Entity Too Large（此前歌单换歌后无法播放的根因）。
 * 302 后浏览器直连 CDN：CDN 原生支持 Range/并发，且流量不经过本站服务器。
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urlId = searchParams.get("url_id");

  if (!urlId) {
    return new Response("缺少 url_id 参数", { status: 400 });
  }

  try {
    const meting = await createMeting();
    const raw = await withTimeout(
      meting.url(urlId, 320),
      STREAM_DEADLINE,
      "music stream resolve"
    );
    const data = JSON.parse(raw as string);
    const src = (data.url || "").replace(/^http:\/\//, "https://");

    if (!src) {
      return new Response("获取音乐链接失败", { status: 404 });
    }

    // 浏览器跟随重定向直连上游，本站不中转任何音频数据
    return NextResponse.redirect(src, 302);
  } catch (err) {
    console.error("Music stream error:", err);
    return new Response("流媒体解析失败", { status: 500 });
  }
}
