import { createHash } from "crypto";
import Meting from "@meting/core";
import { getDbConfigValue } from "@/app/lib/site-config-db";
import { withTimeout } from "@/app/lib/timeout";

/**
 * 网易云音乐数据客户端（Meting-API 兼容协议）
 *
 * 数据来源（后台「站点配置」→ 网易云 API 地址 / cloudMusicApiUrl 可配置）：
 *   1. 自定义 Meting-API 兼容服务（推荐自建：injahow/Meting-API、GZH-czy/meting-api 等）
 *   2. 默认公共 Meting-API：https://api.injahow.cn/meting/（2026-09 实测可用）；
 *      多源自动回退见 FALLBACK_METING_APIS（music.3e0.cn 已挂：Cloudflare 525）
 *   3. 兜底：@meting/core 直连网易云（仅当公共/自定义 API 不可用时）
 *
 * 协议格式：GET {api}?server=netease&type=playlist|song|url|pic|lyric&id=xxx
 * 兼容多种返回形态：
 *   - 歌单：@meting/core 格式（pic_id/url_id/lyric_id）或「精简版」格式（url/pic/lrc 代理链接）
 *   - 播放/封面：JSON {url} 或 302 重定向或纯文本 URL
 *   - 歌词：JSON {lyric} 或纯文本 LRC
 */

export const DEFAULT_METING_API = "https://api.injahow.cn/meting/";

/**
 * 备用公共 Meting API：主源不可用时按顺序自动回退。
 * 2026-09 实测：api.injahow.cn 可用（url 返回 302、歌单正常）；
 * music.3e0.cn 已挂（Cloudflare 525 / 连接失败）。
 */
export const FALLBACK_METING_APIS = [
  "https://api.injahow.cn/meting/",
  "https://api.qijieya.cn/meting/",
  "https://music.3e0.cn/",
];

/** 网易云官方接口请求头（参考项目 XHBlogs 同款） */
const NET_EASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
};

/** 归一化后的歌曲信息（播放器数据源） */
export interface NormalizedTrack {
  id: string;
  name: string;
  artist: string[];
  album: string;
  pic_id: string;
  url_id: string;
  lyric_id: string;
  /** 直接可用的封面 URL（无需再请求接口） */
  picUrl: string;
}

/** 与 @meting/core 兼容的方法接口（方法返回 JSON 字符串） */
export interface MusicClient {
  playlist(id: string): Promise<string>;
  song(id: string): Promise<string>;
  url(id: string, br?: number): Promise<string>;
  pic(id: string, size?: number): Promise<string>;
  lyric(id: string): Promise<string>;
}

// ---------- 内存缓存（减少公共 API 请求量，提升国内访问速度） ----------
interface CacheItem {
  ts: number;
  ttl: number;
  value: string;
}
const cache = new Map<string, CacheItem>();
const CACHE_LIMIT = 200;

const TTL = {
  playlist: 10 * 60 * 1000, // 歌单 10 分钟
  song: 60 * 60 * 1000, // 单曲 1 小时
  lyric: 60 * 60 * 1000, // 歌词 1 小时
  pic: 24 * 60 * 60 * 1000, // 封面 24 小时
};

function getCache(key: string): string | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > item.ttl) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key: string, value: string, ttl: number) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { ts: Date.now(), ttl, value });
}

// ---------- 响应归一化 ----------

/** 从代理链接中提取 id 查询参数 */
function extractQueryId(url: string): string | null {
  try {
    return new URL(url).searchParams.get("id");
  } catch {
    return null;
  }
}

/** 从封面地址中提取网易云 pic_id */
function extractPicIdFromUrl(url: string): string | null {
  // 直接图片链接：路径中的数字文件名
  const m = url.match(/(\d+)\.(?:jpg|jpeg|png|webp|gif)(?:\?.*)?$/i);
  if (m) return m[1];
  // 代理链接：id 参数
  return extractQueryId(url);
}

/**
 * 判断地址是否可作为图片直接使用。
 * - 以常见图片后缀结尾的直链 → 直接使用
 * - meting 图片代理（type=pic）→ 直接使用：实测它返回 302 到真实封面，
 *   `<img>` 会跟随重定向拿到图片；而用 pic_id 自拼 p3.music.126.net 直链
 *   加密结果已失效（404），所以代理链接是最可靠的封面来源。
 */
function isDirectImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.searchParams.get("type") === "pic") return true;
    return /\.(?:jpg|jpeg|png|webp|gif)(?:\?.*)?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** 构造网易云封面直链（与 @meting/core 相同的加密算法） */
function buildNeteasePicUrl(picId: string, size = 300): string {
  const key = "3go8&$8*3*3h0k(2)2".split("");
  const chars = String(picId).split("");
  for (let i = 0; i < chars.length; i++) {
    chars[i] = String.fromCharCode(chars[i].charCodeAt(0) ^ key[i % key.length].charCodeAt(0));
  }
  const enc = createHash("md5")
    .update(chars.join(""), "binary")
    .digest("base64")
    .replace(/\//g, "_")
    .replace(/\+/g, "-");
  return `https://p3.music.126.net/${enc}/${picId}.jpg?param=${size}y${size}`;
}

/** 归一化一条歌曲记录，兼容 meting-core 与「精简版」两种返回格式 */
function normalizeTrack(raw: unknown): NormalizedTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const track = raw as Record<string, unknown>;

  const name = String(track.name ?? track.title ?? "");
  const artistRaw = track.artist ?? track.author;
  const artist = Array.isArray(artistRaw)
    ? artistRaw.map((a) => String(a ?? "")).filter(Boolean)
    : String(artistRaw ?? "")
        .split(/[、,，/]/)
        .map((s) => s.trim())
        .filter(Boolean);

  let urlId = String(track.url_id ?? track.id ?? track.song_id ?? "");
  let lyricId = String(track.lyric_id ?? track.id ?? "");
  let picId = String(track.pic_id ?? "");
  let picUrl = "";

  const rawPic = typeof track.pic === "string" ? track.pic : "";
  if (rawPic && /^https?:\/\//i.test(rawPic)) {
    picId = picId || extractPicIdFromUrl(rawPic) || "";
    if (isDirectImageUrl(rawPic)) picUrl = rawPic;
  }
  if (typeof track.url === "string") {
    urlId = urlId || extractQueryId(track.url) || "";
  }
  if (typeof track.lrc === "string") {
    lyricId = lyricId || extractQueryId(track.lrc) || "";
  }

  urlId = urlId.trim();
  if (!name || !urlId) return null;

  if (!picUrl && picId) picUrl = buildNeteasePicUrl(String(picId), 300);

  return {
    id: urlId,
    name,
    artist,
    album: String(track.album ?? track.album_name ?? ""),
    pic_id: String(picId || urlId),
    url_id: urlId,
    lyric_id: String(lyricId || urlId),
    picUrl,
  };
}

/** 将接口返回数据统一转换为歌曲数组（兼容数组 / {data}/{playlist}/{songs} / 单对象） */
function toTrackList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const inner = obj.data ?? obj.playlist ?? obj.songs;
    if (Array.isArray(inner)) return inner;
    if (inner && typeof inner === "object") return [inner];
  }
  return [];
}

// ---------- HTTP 请求 ----------
// 超时策略（serverless 关键）：任何对外请求都必须有硬上限。
// 一个请求挂 30s 就会长时间独占函数实例，并发一上来整站「点击/刷新无响应」。
const REQUEST_TIMEOUT = 5_000;
/**
 * @meting/core 兜底路径的硬超时。
 * 该库内部是「单次 20s 超时 × 最多 3 次重试 + 每次间隔 1s」，最坏可挂 60s+，
 * 且它不走 fetch，我们自己的 AbortSignal 管不到，只能在外部用 race 封顶。
 */
const FALLBACK_TIMEOUT = 4_000;
/** 单个 Meting 请求（含兜底）的整体上限 */
const METING_DEADLINE = 12_000;
/** 嗅探响应头部的字节数（不会整包下载音频流） */
const SNIFF_BYTES = 1024;
/** 允许整包读取文本的响应体积上限 */
const MAX_TEXT_BYTES = 64 * 1024;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** 只读取响应体开头若干字节后立即取消流（不下载完整音频） */
async function peekHead(res: Response, limit: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    // 关键：取消剩余流，避免把几 MB 的音频整包拉下来
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** MP3 魔数：ID3 头 或 MPEG 帧同步 */
function isMp3Magic(b: Uint8Array): boolean {
  return (
    (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
  );
}

/**
 * 解析「播放地址/封面地址」：兼容 302 重定向 / JSON / 纯文本 URL / 直接音频流。
 *
 * ⚠️ 关键坑（2026-09 定位到播放失败根因）：
 * Node/undici 的 fetch 在 `redirect: "manual"` 下返回的是 *opaque-redirect*
 * 响应（status=0、headers 为空、body=null），根本读不到 location，
 * 于是像 injahow 这类「type=url 直接 302 到音频」的源会被判成解析失败（404）。
 * 因此这里统一用 `redirect: "follow"`，然后：
 *   1) 最终落到音频（content-type audio/*）→ 返回**接口地址本身**，
 *      让浏览器自行跟随 302 拿最新签名地址（避免把带时效的直链写死）；
 *   2) 其余情况按 JSON / 文本 / MP3 魔数继续解析。
 */
async function resolveUrlLike(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

  // 直接返回音频流（或重定向后落到音频 CDN）：把接口地址交给浏览器跟随
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.startsWith("audio/") || ct.startsWith("video/")) {
    await res.body?.cancel().catch(() => {});
    return url;
  }

  // 只有在「明确是文本 且 体积已知且很小」时才整包读取；
  // 其余一律只嗅探开头若干字节。
  // 原因：早期实现直接 `await res.arrayBuffer()`，当 Meting 服务返回的是
  // 音频流（几 MB）而 Content-Type 又不是 audio/* 时，会把整个音频读进内存，
  // 再对二进制做一次 TextDecoder 解码 —— 高并发下足以打爆函数实例内存 /
  // 长时间阻塞事件循环，是全站「卡死」的元凶之一。
  const contentLength = Number(res.headers.get("content-length") || "0");
  const isText = /(json|text|xml|urlencoded)/.test(ct);
  if (isText && contentLength > 0 && contentLength <= MAX_TEXT_BYTES) {
    const t = (await res.text()).trim();
    const parsed = parseUrlLikeFromText(t, url, res.url);
    if (parsed) return parsed;
    // 文本里没解析出地址，但确实是「接口地址 → 最终地址」的跳转，用最终地址兜底
    if (res.url && res.url !== url) return res.url;
    return "";
  }

  const head = await peekHead(res, SNIFF_BYTES);
  if (isMp3Magic(head)) return url;
  const parsed = parseUrlLikeFromText(new TextDecoder().decode(head).trim(), url, res.url);
  if (parsed) return parsed;
  if (res.url && res.url !== url) return res.url;
  return "";
}

/** 从文本片段中解析出 URL：JSON {url} / 纯文本 URL / 最终重定向地址 */
function parseUrlLikeFromText(text: string, reqUrl: string, finalUrl: string): string {
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      const u = String(data.url ?? data.data?.url ?? "");
      if (u) return u;
    } catch {
      // JSON 被截断（只嗅探了头部）时按纯文本继续处理
    }
  }
  if (/^https?:\/\/[^\s"']+$/i.test(text)) return text;
  if (finalUrl && finalUrl !== reqUrl && /^https?:\/\//i.test(finalUrl)) return finalUrl;
  return "";
}

/** 解析歌词：兼容 JSON / 纯文本 LRC */
async function resolveLyricText(url: string): Promise<string> {
  const text = await fetchText(url);
  if (text.trim().startsWith("{")) {
    try {
      const data = JSON.parse(text);
      const lyric = String(data.lyric ?? data.lrc ?? "");
      // 部分 Meting 实现返回 {"error":"unknown type"}，视为无歌词
      if (lyric && !lyric.startsWith('{"error"')) return lyric;
    } catch {
      // 纯文本
    }
  }
  return text;
}

/**
 * 网易云官方歌词接口（参考项目 XHBlogs 同款）：
 * 当 Meting API 拿不到歌词时兜底使用。
 */
async function fetchOfficialLyric(songId: string): Promise<string> {
  const url = `https://music.163.com/api/song/lyric?id=${encodeURIComponent(songId)}&lv=-1&kv=-1&tv=-1`;
  const res = await fetch(url, {
    headers: NET_EASE_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return String(data.lrc?.lyric ?? "");
}

/**
 * 为网易云封面 URL 追加/替换 param 尺寸参数（如 1000y1000）。
 * 非网易云域名（自定义图床等）原样返回。
 */
function ensurePicSize(picUrl: string, size: number): string {
  try {
    const u = new URL(picUrl);
    if (/music\.126\.net$/i.test(u.hostname)) {
      u.searchParams.set("param", `${size}y${size}`);
      return u.toString();
    }
  } catch {
    // 非法 URL 原样返回
  }
  return picUrl;
}

/**
 * 批量将歌曲封面替换为网易云官方高清封面（song/detail 返回的 album.picUrl 原图）。
 * 失败时静默保留原封面（Meting 代理小图），不影响主流程。
 */
async function attachHighResCovers(tracks: NormalizedTrack[]): Promise<void> {
  try {
    const ids = tracks.map((t) => t.url_id).filter(Boolean);
    if (!ids.length) return;
    const BATCH = 100;
    const coverMap = new Map<string, string>();
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const url = `https://music.163.com/api/song/detail/?id=${encodeURIComponent(batch[0])}&ids=[${batch.join(",")}]`;
      const res = await fetch(url, {
        headers: NET_EASE_HEADERS,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { songs?: { id: string; album?: { picUrl?: string } }[] };
      for (const s of data.songs ?? []) {
        if (s.album?.picUrl) coverMap.set(String(s.id), s.album.picUrl);
      }
    }
    for (const t of tracks) {
      const pic = coverMap.get(t.url_id);
      if (pic) t.picUrl = ensurePicSize(pic, 1000);
    }
  } catch (e) {
    console.warn("[meting] 高清封面获取失败，使用默认封面:", e);
  }
}

// ---------- 客户端 ----------
class MetingApiClient implements MusicClient {
  private readonly apiUrl: string;
  /** 主源 + 备用源（去重），任一可用即成功 */
  private readonly bases: string[];
  private fallbackMeting: Meting | null = null;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
    const norm = (u: string) => u.replace(/\/+$/, "");
    this.bases = [
      apiUrl,
      ...FALLBACK_METING_APIS.filter((u) => norm(u) !== norm(apiUrl)),
    ];
  }

  private buildUrl(
    type: string,
    id: string,
    extra: Record<string, string> = {},
    base?: string
  ): string {
    const u = new URL(base ?? this.apiUrl);
    u.searchParams.set("server", "netease");
    u.searchParams.set("type", type);
    u.searchParams.set("id", String(id));
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    return u.toString();
  }

  /**
   * 依次尝试主源与备用源（首个成功即返回）。
   * 每个源重试 2 次：公共 Meting 服务是第三方免费源，偶发超时/5xx 很常见，
   * 单次失败就换源会误判「全部不可用」。
   */
  private async tryBases<T>(fn: (base: string) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const base of this.bases) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await fn(base);
        } catch (e) {
          lastErr = e;
          if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("all meting apis failed");
  }

  private cacheKey(type: string, id: string): string {
    let host = "default";
    try {
      host = new URL(this.apiUrl).host;
    } catch {
      // ignore
    }
    return `${host}:${type}:${id}`;
  }

  /**
   * API 不可用时的兜底：@meting/core 直连网易云。
   *
   * 必须套硬超时：该库内部是「单次 20s 超时 × 最多 3 次重试 + 每次间隔 1s」，
   * 最坏可挂 60s+，且它不是通过我们的 fetch 发出的，REQUEST_TIMEOUT 管不到。
   * 在 serverless 下这种长尾请求会持续占用实例，最终导致整站无响应。
   */
  private async fallback<T>(fn: (m: Meting) => Promise<T>): Promise<T> {
    if (!this.fallbackMeting) {
      const m = new Meting("netease");
      m.format(true);
      this.fallbackMeting = m;
    }
    return withTimeout(fn(this.fallbackMeting), FALLBACK_TIMEOUT, "meting-core fallback");
  }

  /** 统一入口：给每个方法套整体截止时间（主路径 + 兜底路径合计不超过 METING_DEADLINE） */
  private static run<T>(p: Promise<T>, label: string): Promise<T> {
    return withTimeout(p, METING_DEADLINE, `meting ${label}`);
  }

  async playlist(id: string): Promise<string> {
    const key = this.cacheKey("playlist", id);
    const cached = getCache(key);
    if (cached) return cached;
    return MetingApiClient.run(
      (async () => {
        try {
          const text = await this.tryBases((b) => fetchText(this.buildUrl("playlist", id, {}, b)));
          const tracks = toTrackList(JSON.parse(text))
            .map((t) => normalizeTrack(t))
            .filter((t): t is NormalizedTrack => t !== null);
          // 封面是锦上添花：单独限时限错，失败就用 Meting 给的小图
          await withTimeout(attachHighResCovers(tracks), REQUEST_TIMEOUT, "high-res covers").catch(
            () => {}
          );
          const result = JSON.stringify(tracks);
          setCache(key, result, TTL.playlist);
          return result;
        } catch {
          const raw = await this.fallback((m) => m.playlist(id));
          return raw as string;
        }
      })(),
      "playlist"
    );
  }

  async song(id: string): Promise<string> {
    const key = this.cacheKey("song", id);
    const cached = getCache(key);
    if (cached) return cached;
    return MetingApiClient.run(
      (async () => {
        try {
          const text = await this.tryBases((b) => fetchText(this.buildUrl("song", id, {}, b)));
          const tracks = toTrackList(JSON.parse(text))
            .map((t) => normalizeTrack(t))
            .filter((t): t is NormalizedTrack => t !== null);
          await withTimeout(attachHighResCovers(tracks), REQUEST_TIMEOUT, "high-res covers").catch(
            () => {}
          );
          const result = JSON.stringify(tracks);
          setCache(key, result, TTL.song);
          return result;
        } catch {
          const raw = await this.fallback((m) => m.song(id));
          return raw as string;
        }
      })(),
      "song"
    );
  }

  async url(id: string, br = 320): Promise<string> {
    return MetingApiClient.run(
      (async () => {
        try {
          const realUrl = await this.tryBases((b) =>
            resolveUrlLike(this.buildUrl("url", id, { br: String(br) }, b))
          );
          return JSON.stringify({ url: realUrl, size: 0, br });
        } catch {
          const raw = await this.fallback((m) => m.url(id, br));
          return raw as string;
        }
      })(),
      "url"
    );
  }

  async pic(id: string, size = 300): Promise<string> {
    const key = this.cacheKey(`pic:${size}`, id);
    const cached = getCache(key);
    if (cached) return cached;
    return MetingApiClient.run(
      (async () => {
        try {
          const realUrl = await this.tryBases((b) =>
            resolveUrlLike(this.buildUrl("pic", id, { size: String(size) }, b))
          );
          const result = JSON.stringify({ url: realUrl });
          setCache(key, result, TTL.pic);
          return result;
        } catch {
          const raw = await this.fallback((m) => m.pic(id, size));
          return raw as string;
        }
      })(),
      "pic"
    );
  }

  async lyric(id: string): Promise<string> {
    const key = this.cacheKey("lyric", id);
    const cached = getCache(key);
    if (cached) return cached;
    // 优先走配置的 Meting API（type=lrc，injahow 等标准实现）；为空/失败时回退网易云官方接口
    return MetingApiClient.run(
      (async () => {
        try {
          const lrc = await this.tryBases(async (b) => {
            const t = await resolveLyricText(this.buildUrl("lrc", id, {}, b));
            if (!t.trim()) throw new Error("empty lyric");
            return t;
          });
          if (lrc.trim()) {
            const result = JSON.stringify({ lyric: lrc, tlyric: "" });
            setCache(key, result, TTL.lyric);
            return result;
          }
          throw new Error("empty lyric");
        } catch {
          try {
            const lrc = await fetchOfficialLyric(id);
            const result = JSON.stringify({ lyric: lrc, tlyric: "" });
            setCache(key, result, TTL.lyric);
            return result;
          } catch {
            const raw = await this.fallback((m) => m.lyric(id));
            return raw as string;
          }
        }
      })(),
      "lyric"
    );
  }
}

/** 创建音乐数据客户端（网易云歌单模式） */
export async function createMeting(): Promise<MusicClient> {
  const raw = (await getDbConfigValue("cloudMusicApiUrl", "")).trim().replace(/\/+$/, "");
  let api = raw;
  if (!api) {
    api = DEFAULT_METING_API;
  } else if (!/^https?:\/\//i.test(api)) {
    api = `https://${api}`;
  }
  return new MetingApiClient(api);
}
