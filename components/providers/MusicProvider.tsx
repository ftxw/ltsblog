"use client";

import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/siteConfig";
import { useSiteConfig } from "@/components/providers/SiteConfigProvider";

function parseLrc(lrcText: string) {
  if (!lrcText || lrcText.length > 30000) return [];
  const lines = lrcText.split(/\r?\n/);
  const result: { time: number; text: string }[] = [];
  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    if (matches.length > 0) {
      const text = line
        .replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, "")
        .replace(/[-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, "")
        .trim();
      if (text) {
        for (const match of matches) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = match[3] ? parseInt(match[3]) : 0;
          const divisor = match[3] && match[3].length === 3 ? 1000 : 100;
          result.push({ time: min * 60 + sec + ms / divisor, text });
        }
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

type PlayMode = "loop" | "single" | "random";
type SongType = "netease" | "local";

interface Song {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl: string;
  lyrics: { time: number; text: string }[];
  type: SongType;
  dbId?: number;
}

interface MusicContextType {
  playlist: Song[];
  currentIndex: number;
  currentSong: Song | undefined;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  currentLyric: string;
  allLyrics: { time: number; text: string }[];
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  refreshPlaylist: () => Promise<void>;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  handleSeek: (value: number) => void;
  playSong: (index: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

// ---------------------------------------------------------------------------
// 歌单浏览器缓存：让「悬浮播放器 / 首页音乐卡片」在刷新或二次访问时立即有内容，
// 不必等 /api/music 网络往返；网络成功返回后自动覆盖刷新（后台静默）。
// 缓存键带配置指纹：歌单配置变了自动失效。
// ---------------------------------------------------------------------------
const PLAYLIST_CACHE_PREFIX = "music-playlist:v1:";

function playlistFingerprint(playlistId: string, ids: readonly string[]): string {
  return `${playlistId}|${ids.join(",")}`;
}

function readCachedPlaylist(
  playlistId: string,
  ids: readonly string[]
): Song[] | null {
  try {
    const fp = playlistFingerprint(playlistId, ids);
    const raw = window.localStorage.getItem(PLAYLIST_CACHE_PREFIX + fp);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { songs: Song[]; ts: number };
    if (!Array.isArray(parsed.songs) || parsed.songs.length === 0) return null;
    return parsed.songs;
  } catch {
    return null;
  }
}

function writeCachedPlaylist(
  playlistId: string,
  ids: readonly string[],
  songs: Song[]
): void {
  try {
    const fp = playlistFingerprint(playlistId, ids);
    window.localStorage.setItem(
      PLAYLIST_CACHE_PREFIX + fp,
      JSON.stringify({ songs, ts: Date.now() })
    );
  } catch {
    /* localStorage 不可用（隐私模式等）时忽略 */
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("loop");
  const audioRef = useRef<HTMLAudioElement>(null);
  const playModeRef = useRef(playMode);
  const nextSongRef = useRef<() => void>(() => {});
  const fetchIdRef = useRef(0);
  // 用 ref 保存当前 playlist，避免 fetchMusicData 依赖它导致引用变化引发无限重取
  const playlistRef = useRef<Song[]>([]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  const pathname = usePathname();

  // 用 ref 镜像当前路由：fetchMusicData 是稳定引用（无 pathname 依赖），
  // 在后台 /admin/* 下必须跳过音乐拉取，但回调内要拿到「最新」路径判断。
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // 云音乐配置直接复用 SiteConfigProvider 的上下文：
  // layout 里已经服务端注入了 initialConfig，MusicProvider 再自己 fetch 一次
  // /api/site-config 就是纯浪费（serverless 下每次页面加载多一次函数调用）。
  // SiteConfigProvider 内部用 shallowEqual 保证内容不变时 config 引用稳定，
  // 所以下面这两个值只在配置真的变了时才变，不会导致无限重取。
  const { config } = useSiteConfig();
  const cloudMusicPlaylistId =
    config.cloudMusicPlaylistId || siteConfig.cloudMusicPlaylistId;
  const cloudMusicIdsRaw = config.cloudMusicIds || "";

  const cloudMusicIds = useMemo<string[]>(() => {
    if (cloudMusicIdsRaw) {
      try {
        const parsed = JSON.parse(cloudMusicIdsRaw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
      } catch {
        /* 解析失败，回退静态配置 */
      }
    }
    return siteConfig.cloudMusicIds as string[];
  }, [cloudMusicIdsRaw]);

  // 实际的拉取逻辑：被「进入 /music 路由」/ refreshPlaylist 两处复用
  const fetchMusicData = useCallback(
    async (opts?: { silent?: boolean }) => {
      // 后台页面不渲染前台播放器，跳过一切音乐数据拉取
      // （否则每次进后台都会额外触发 /api/music → 外部 Meting 服务，
      //   冷启动/外网慢时会明显拖慢后台首屏）。
      if (pathnameRef.current?.startsWith("/admin")) return;
      const myId = ++fetchIdRef.current;
      if (!opts?.silent) setIsLoading(true);
      // 首屏非静默拉取 8 秒还没回来，强制解除 loading，避免 Meting/外网挂掉时永远卡住
      let safetyTimer: ReturnType<typeof setTimeout> | null = null;
      if (!opts?.silent) {
        safetyTimer = setTimeout(() => {
          if (myId === fetchIdRef.current) setIsLoading(false);
        }, 8000);
      }
      try {
        // 未配置任何歌单/单曲：无需请求 /api/music（接口也会直接返回空，
        // 但少一次后端调用就少一次实例占用，利于后台与整体稳定性）。
        if (!cloudMusicPlaylistId && cloudMusicIds.length === 0) {
          if (myId === fetchIdRef.current) {
            setPlaylist([]);
            setCurrentIndex(0);
          }
          return;
        }

        let apiUrl = "/api/music";
        const params = new URLSearchParams();
        if (cloudMusicPlaylistId) params.set("id", cloudMusicPlaylistId);
        else if (cloudMusicIds.length > 0) params.set("ids", cloudMusicIds.join(","));
        // 始终附加时间戳，避免浏览器/CDN 缓存拿到旧的歌单
        params.set("_t", String(Date.now()));
        const qs = params.toString();
        if (qs) apiUrl += `?${qs}`;

        const res = await fetch(apiUrl, { cache: "no-store" });
        const data = await res.json();

        const songs = (Array.isArray(data) ? data : [])
          .map((r: Record<string, unknown>) => ({
            id: String(r.id || Math.random()),
            title: String(r.title || r.name || "未知歌曲"),
            artist: String(r.artist || r.author || "未知歌手"),
            cover: String(r.cover || r.pic || ""),
            src: String(r.src || r.url || ""),
            lrcUrl: String(r.lrcUrl || r.lrc || ""),
            lyrics: [] as { time: number; text: string }[],
            type: (r.type as SongType) || "netease" as SongType,
            dbId: r.dbId as number | undefined,
          }))
          .filter((s) => s.src);

        // 若本轮拉取被更新的请求取代，丢弃旧结果
        if (myId !== fetchIdRef.current) return;

        // 关键：直接覆盖 playlist（而不是只在空时写入）
        if (songs.length > 0) {
          setPlaylist(songs);
          writeCachedPlaylist(cloudMusicPlaylistId, cloudMusicIds, songs);
          // 当前播放的歌如果还在新列表里，保留索引；否则重置到第一首
          setCurrentIndex((prev) => {
            const stillExists = songs.findIndex((s) => s.id === playlistRef.current[prev]?.id);
            return stillExists >= 0 ? stillExists : 0;
          });
        } else {
          setPlaylist([]);
          setCurrentIndex(0);
        }
      } catch {
        // 静默失败：保持原列表不变
      } finally {
        if (safetyTimer) clearTimeout(safetyTimer);
        if (myId === fetchIdRef.current) setIsLoading(false);
      }
    },
    [cloudMusicPlaylistId, cloudMusicIds]
  );

  // 初次加载策略（体验优先，兼顾 serverless 负载）：
  // - 悬浮播放器与首页音乐卡片全站可见，歌单必须在客户端就绪，因此需要拉取；
  // - 但不再与首屏其它请求同时爆发：先读 localStorage 缓存「秒开」播放器/卡片，
  //   再延迟 ~800ms 静默刷新一次拿最新（Meting 外网慢时也不阻塞页面）。
  // - 未配置歌单 / 后台路由不发请求（fetchMusicData 内已处理）。
  useEffect(() => {
    if (pathnameRef.current?.startsWith("/admin")) return;
    // 1) 缓存秒开：有缓存立刻渲染，播放器不再显示"暂无音乐"
    const cached = readCachedPlaylist(cloudMusicPlaylistId, cloudMusicIds);
    if (cached) {
      // 水合后以本地缓存同步一次歌单（播放器跨页面可见的体验关键）
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: hydrate from localStorage cache
      setPlaylist(cached);
    }
    // 2) 错峰静默刷新（延迟执行，避开首屏请求潮）
    const timer = window.setTimeout(() => {
      void fetchMusicData({ silent: true });
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMusicPlaylistId, cloudMusicIds]);

  // 进入 /music 路由时强制刷新：
  // - 已有歌单（如切页回来）→ 静默刷新，避免闪 loading（兼容后台改歌单后不生效问题）
  // - 歌单为空（缓存也未命中）→ 正常拉取并展示 loading
  useEffect(() => {
    if (pathname && pathname.startsWith("/music")) {
      fetchMusicData({ silent: playlistRef.current.length > 0 });
    }
  }, [pathname, fetchMusicData]);

  // 暴露给外部的手动刷新（UI 上可加按钮）
  const refreshPlaylist = useCallback(async () => {
    await fetchMusicData({ silent: true });
  }, [fetchMusicData]);

  // Fetch lyrics when song changes
  useEffect(() => {
    if (playlist.length === 0) return;
    const song = playlist[currentIndex];
    if (!song) return;
    let mounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally reset on song change only
    setLyrics([]);
    setCurrentLyric("");

    if (song.lrcUrl) {
      fetch(song.lrcUrl)
        .then((r) => r.text())
        .then((text) => {
          if (!mounted) return;
          const parsed = parseLrc(text);
          setLyrics(parsed);
          setPlaylist((prev) => {
            const next = [...prev];
            next[currentIndex] = { ...next[currentIndex], lyrics: parsed };
            return next;
          });
        })
        .catch(() => {});
    }

    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isPlaying only used for auto-play, lyrics should not re-fetch
  }, [currentIndex, playlist.length]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const nextSong = useCallback(() => {
    if (playMode === "random") {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((p) => (p + 1) % playlist.length);
    }
  }, [playMode, playlist.length]);

  useEffect(() => { playModeRef.current = playMode; }, [playMode]);
  useEffect(() => { nextSongRef.current = nextSong; }, [nextSong]);

  const prevSong = useCallback(() => {
    if (playMode === "random") {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((p) => (p - 1 + playlist.length) % playlist.length);
    }
  }, [playMode, playlist.length]);

  const playSong = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const ct = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(ct);
    setDuration(dur);
    setProgress(dur > 0 ? (ct / dur) * 100 : 0);
    if (lyrics.length > 0) {
      const active = [...lyrics].reverse().find((l) => ct >= l.time);
      if (active) setCurrentLyric(active.text);
    }
  }, [lyrics]);

  const handleEnded = useCallback(() => {
    if (playModeRef.current === "single" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      nextSongRef.current();
    }
  }, []);

  const handleSeek = useCallback((value: number) => {
    setProgress(value);
    if (audioRef.current?.duration) {
      audioRef.current.currentTime = (value / 100) * audioRef.current.duration;
    }
  }, []);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    if (isMuted && val > 0) setIsMuted(false);
  }, [isMuted]);

  const toggleMute = useCallback(() => setIsMuted((p) => !p), []);

  const togglePlayMode = useCallback(() => {
    setPlayMode((p) => (p === "loop" ? "single" : p === "single" ? "random" : "loop"));
  }, []);

  return (
    <MusicContext.Provider
      value={{
        playlist, currentIndex, currentSong: playlist[currentIndex],
        isPlaying, progress, currentTime, duration,
        currentLyric, allLyrics: lyrics, isLoading,
        volume, isMuted, playMode, refreshPlaylist,
        togglePlay, nextSong, prevSong, handleSeek, playSong,
        setVolume, toggleMute, togglePlayMode,
      }}
    >
      {children}
      {playlist[currentIndex] && (
        <audio
          key={playlist[currentIndex].id}
          ref={audioRef}
          src={playlist[currentIndex].src}
          // 关键：默认 preload 会让浏览器在**每次页面加载**都去请求 src，
          // 而 src 指向 /api/music/stream —— 意味着每个访客、每个页面都会
          // 触发一次服务端到网易云的外网请求。外网一慢就会占满函数实例。
          // 设为 none：只有用户真的点了播放才去解析真实播放地址。
          preload="none"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={handleTimeUpdate}
        />
      )}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
}
