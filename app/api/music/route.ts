import { NextRequest, NextResponse } from "next/server";
import { createMeting, type NormalizedTrack } from "@/app/lib/meting";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { withTimeout } from "@/app/lib/timeout";

// 歌单是动态数据，不允许 Next.js / CDN 缓存
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * 本接口的**整体**硬超时。
 *
 * 该接口挂在根 layout 的 MusicProvider 上，每个访客、每个页面加载都会打一次。
 * 它依赖外部 Meting 服务（默认还是公益公共 API），一旦外网变慢，
 * 每个请求都会长时间独占一个函数实例；并发一上来新请求全部排队 ——
 * 表现就是「点击没反应、刷新也没反应，过一会又好了」。
 *
 * 因此这里再兜一层总闸：无论内部怎么重试/兜底，超过 MUSIC_DEADLINE 一律
 * 返回空列表，宁可这次没歌，也不能拖垮整站。
 */
const MUSIC_DEADLINE = 10_000;

interface SongData {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl: string;
  type: "netease";
  /** 网易云 url_id，用于流代理实时拉取 */
  url_id?: string;
  /** 网易云 lyric_id，用于歌词代理实时拉取 */
  lyric_id?: string;
}

async function getNeteaseSongs(playlistId: string | null, songIds: string | null): Promise<SongData[]> {
  const meting = await createMeting();

  let tracks: NormalizedTrack[] = [];

  if (playlistId) {
    const raw = await meting.playlist(playlistId);
    const parsed = JSON.parse(raw);
    tracks = Array.isArray(parsed) ? parsed : [];
  } else if (songIds) {
    const ids = songIds.split(",").map((s) => s.trim()).filter(Boolean);
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await meting.song(id);
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [];
        }
      })
    );
    tracks = results.flat();
  }

  // 封面由归一化阶段直接给出（避免为每首歌额外请求 pic 接口）；
  // 播放地址不在此预检，播放时由 /api/music/stream 实时解析，避免歌单加载时打爆公共 API。
  const songs: SongData[] = tracks.map((track) => {
    const urlId = String(track.url_id || track.id || "");
    return {
      id: urlId,
      title: track.name || "未知歌曲",
      artist: Array.isArray(track.artist) ? track.artist.join(", ") : String(track.artist || "未知歌手"),
      cover: (track.picUrl || "").replace(/^http:\/\//, "https://"),
      src: urlId ? `/api/music/stream?url_id=${encodeURIComponent(urlId)}` : "",
      lrcUrl: track.lyric_id ? `/api/music/lyrics?lyric_id=${encodeURIComponent(track.lyric_id)}` : "",
      type: "netease" as const,
      url_id: urlId,
      lyric_id: track.lyric_id ? String(track.lyric_id) : "",
    };
  });

  return songs.filter((s) => s.url_id);
}

/** 剔除客户端每次附带的时间戳参数，保证缓存键稳定（否则内存缓存永远 miss） */
function removeCacheBuster(u: string): string {
  try {
    const x = new URL(u);
    x.searchParams.delete("_t");
    return x.toString();
  } catch {
    return u;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const playlistId = searchParams.get("id");
    const songIds = searchParams.get("ids");

    if (!playlistId && !songIds) {
      // 未配置歌单：视为"暂无音乐"，返回空列表而不是 400
      // （避免前台未配置时 MusicProvider 每次挂载都报错刷屏）
      return NextResponse.json([]);
    }

    // 注意：上游失败必须抛出（而不是 return []），否则失败结果会被
    // cachedPublicGet 当成功缓存 60s —— 一次抖动会让所有访客 60s 内都拿不到歌单。
    try {
      return await cachedPublicGet(
        CACHE_NAMESPACE.music,
        new Request(removeCacheBuster(req.url)),
        () =>
          withTimeout(
            getNeteaseSongs(playlistId, songIds),
            MUSIC_DEADLINE,
            "music playlist"
          )
      );
    } catch (upstreamErr) {
      console.error("Music playlist upstream error:", upstreamErr);
      return NextResponse.json([], {
        headers: { "X-Cache": "BYPASS", "Cache-Control": "no-store" },
      });
    }
  } catch (err) {
    console.error("Music API error:", err);
    return NextResponse.json(
      { error: "获取音乐数据失败" },
      { status: 500 }
    );
  }
}
