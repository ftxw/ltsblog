"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMusic } from "@/components/providers/MusicProvider";

export default function FloatingPlayer() {
  const { currentSong, isPlaying, togglePlay, nextSong, prevSong } = useMusic();
  const [expanded, setExpanded] = useState(false);

  if (!currentSong) return null;

  const toggleExpanded = () => setExpanded((e) => !e);

  return (
    <div className="fixed bottom-22 left-6 z-30">
      {/*
        胶囊容器：高度恒为 56px，宽度由 framer-motion 在 56 ↔ 296 之间过渡。
        封面固定 w-10 h-10 + flex-shrink-0，永不被拉伸变形。
        封面位置始终保持在左侧固定边距（收缩态 px-[7px] / 展开态 pl-2），
        不使用 justify-center，避免收缩动画期间封面随 flex 居中来回滑动。
        容器 overflow-hidden 让展开时右侧内容从胶囊内"滑出"，视觉上是平滑的展开。
      */}
      <motion.div
        layout
        animate={{ width: expanded ? 296 : 56 }}
        transition={{ duration: 0.35, type: "spring", stiffness: 300, damping: 30 }}
        style={{ height: 56 }}
        className={`bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl rounded-full flex items-center overflow-hidden ${
          expanded ? "pl-[7px] pr-4" : "px-[7px]"
        }`}
      >
        {/* 封面（始终保留，含中心白点）：点击切换展开/收缩。
            收缩态 px-[7px]：容器 56px 含 1px 边框，内容区 54px，7+40+7=54，
            封面在圆内左右各 7px 真正居中；展开态 pl-[7px] 与收缩态左间距一致，
            封面位置在展开/收缩间零位移。 */}
        <button
          onClick={toggleExpanded}
          title={expanded ? "收起" : "展开播放器"}
          className="w-10 h-10 rounded-full border border-white/50 shadow-sm flex-shrink-0 overflow-hidden relative cursor-pointer hover:scale-105 transition-transform"
          style={{ animation: isPlaying ? "spin 6s linear infinite" : "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 歌曲封面外链动态 URL */}
          <img
            src={currentSong.cover}
            alt="cover"
            className="w-full h-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-black/10"></div>
          {/* 封面中心圆点（始终渲染） */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-inner"></div>
        </button>

        {/* 展开内容：仅 expanded=true 时渲染。延迟淡入让内容在容器宽度到位后再出现，避免"瞬移"。
            ml-3 让标题块与封面之间有呼吸位，pr 已在容器上额外增加 4px 让按钮距离右边留 16px。 */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.2, delay: 0.12 }}
              className="flex items-center gap-3 ml-3"
            >
              {/* 标题/作者（与封面之间留 ml-3 间距） */}
              <div className="flex flex-col w-32 max-w-[120px] overflow-hidden">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate transition-colors duration-700">
                  {currentSong.title}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate transition-colors duration-700">
                  {currentSong.artist}
                </span>
              </div>

              {/* 控制按钮：上一首 / 播放-暂停 / 下一首 */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={prevSong}
                  title="上一首"
                  className="text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={togglePlay}
                  title={isPlaying ? "暂停" : "播放"}
                  className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={nextSong}
                  title="下一首"
                  className="text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 封面旋转动画（无论展开/收缩，封面在播放时都会旋转） */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
