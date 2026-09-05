"use client";

import { useMusic } from "@/components/providers/MusicProvider";

export default function LyricBar() {
  const { isPlaying, currentLyric, currentSong, isLoading } = useMusic();

  // 目标文字：播放时显示歌词；未播放显示当前歌曲；无歌显示加载/占位。
  // 始终有内容，歌词栏不依赖歌词加载完成，避免滞后显示。
  // 直接显示完整文字（去掉打字机逐字重打：歌词逐句更新时"清空重打"会造成抖动）。
  const targetText = isPlaying
    ? currentLyric
    : currentSong
      ? `♪ ${currentSong.title} - ${currentSong.artist}`
      : isLoading
        ? "音乐加载中..."
        : "♪ 暂无播放歌曲";

  const waves = [
    { color: "bg-indigo-400", delay: "0ms" },
    { color: "bg-purple-400", delay: "200ms" },
    { color: "bg-indigo-500", delay: "400ms" },
    { color: "bg-purple-500", delay: "100ms" },
    { color: "bg-indigo-300", delay: "300ms" },
  ];

  return (
    <>
      <style>{`
        @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-cursor { animation: cursorBlink 0.8s step-end infinite; }
        @keyframes safeWave { 0%, 100% { height: 8px; } 50% { height: 28px; } }
        .safe-wave-active { animation: safeWave 1s ease-in-out infinite; }
      `}</style>

      <div
        className="w-full rounded-3xl bg-slate-900/80 dark:bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl p-3 md:p-5 flex items-center justify-between transition-all duration-700 hover:shadow-indigo-500/20 group h-14 md:h-20"
      >
        {/* Waveform */}
        <div className="flex items-end justify-center gap-[4px] h-8 w-10 md:w-16">
          {waves.map((wave, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-t-sm transition-all duration-500 ease-out ${
                isPlaying ? `${wave.color} safe-wave-active` : "h-1 bg-slate-600"
              }`}
              style={{ animationDelay: wave.delay, height: isPlaying ? undefined : "4px" }}
            />
          ))}
        </div>

        {/* Lyric */}
        <div className="flex-1 px-3 md:px-8 flex justify-center items-center overflow-hidden">
          <p className="text-white text-sm md:text-lg font-bold tracking-wider md:tracking-widest truncate drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]">
            {targetText}
            <span className="inline-block w-[3px] h-5 bg-indigo-400 align-middle ml-1 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-cursor" />
          </p>
        </div>

        {/* Music icon */}
        <div className="w-10 md:w-16 flex justify-end">
          <svg
            className={`w-6 h-6 text-indigo-400/50 transition-all duration-500 ${isPlaying ? "animate-bounce" : "opacity-30"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      </div>
    </>
  );
}
