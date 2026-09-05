import { NextRequest } from "next/server";
import { createMeting } from "@/app/lib/meting";
import { withTimeout } from "@/app/lib/timeout";

/** 歌词解析整体硬超时（同样依赖外部 Meting 服务，必须快速失败） */
const LYRIC_DEADLINE = 12_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lyricId = searchParams.get("lyric_id");

  if (!lyricId) {
    return new Response("缺少 lyric_id 参数", { status: 400 });
  }

  try {
    const meting = await createMeting();
    const raw = await withTimeout(
      meting.lyric(lyricId),
      LYRIC_DEADLINE,
      "music lyric"
    );
    const data = JSON.parse(raw as string);
    const lrc = data.lyric || data.lrc || "";

    if (!lrc) {
      return new Response("暂无歌词", { status: 200 });
    }

    return new Response(lrc, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Lyric proxy error:", err);
    return new Response("歌词获取失败", { status: 500 });
  }
}
