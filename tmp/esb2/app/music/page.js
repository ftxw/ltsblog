"use strict";
"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  RefreshCcw,
  Shuffle,
  Disc3,
  Volume2,
  VolumeX
} from "lucide-react";
import { useMusic } from "@/components/providers/MusicProvider";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
export default function MusicClient() {
  const {
    playlist,
    currentSong,
    isPlaying,
    progress,
    currentTime,
    duration,
    currentLyric,
    allLyrics,
    isLoading,
    togglePlay,
    nextSong,
    prevSong,
    handleSeek,
    playSong,
    playMode,
    togglePlayMode,
    volume,
    setVolume,
    isMuted,
    toggleMute
  } = useMusic();
  const lyricContainerRef = useRef(null);
  const activeLyricRef = useRef(null);
  const [activeTab, setActiveTab] = useState("lyrics");
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const activeLyricIndex = useMemo(() => {
    if (!allLyrics.length) return -1;
    let idx = allLyrics.findIndex((l) => l.time > currentTime) - 1;
    if (idx === -2) idx = allLyrics.length - 1;
    return Math.max(0, idx);
  }, [currentTime, allLyrics]);
  useEffect(() => {
    if (activeLyricRef.current && lyricContainerRef.current && activeTab === "lyrics") {
      const container = lyricContainerRef.current;
      const activeItem = activeLyricRef.current;
      const scrollTarget = activeItem.offsetTop - container.offsetHeight / 2 + activeItem.offsetHeight / 2;
      container.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  }, [activeLyricIndex, activeTab]);
  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  const getPlayModeIcon = () => {
    switch (playMode) {
      case "loop":
        return /* @__PURE__ */ jsx(Repeat, { size: 18, className: "text-slate-500 hover:text-indigo-500 md:w-5 md:h-5" });
      case "single":
        return /* @__PURE__ */ jsx(RefreshCcw, { size: 18, className: "text-indigo-500 md:w-5 md:h-5" });
      case "random":
        return /* @__PURE__ */ jsx(Shuffle, { size: 18, className: "text-slate-500 hover:text-indigo-500 md:w-5 md:h-5" });
      default:
        return /* @__PURE__ */ jsx(Repeat, { size: 18, className: "text-slate-500 md:w-5 md:h-5" });
    }
  };
  const filteredPlaylist = useMemo(() => {
    if (!searchQuery.trim()) return playlist;
    const lowerQuery = searchQuery.toLowerCase();
    return playlist.filter(
      (song) => song.title.toLowerCase().includes(lowerQuery) || song.artist.toLowerCase().includes(lowerQuery)
    );
  }, [playlist, searchQuery]);
  const songCover = currentSong?.cover || "/images/default-cover.webp";
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen relative pb-10 flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-0 pointer-events-none", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "absolute inset-[-10%] bg-cover bg-center transition-all duration-1000 blur-[50px] opacity-40 dark:opacity-20 saturate-150",
          style: { backgroundImage: `url(${songCover})` }
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "container-page relative z-10", children: [
      /* @__PURE__ */ jsx(
        PageHeader,
        {
          title: "\u4E91\u7AEF\u4E50\u5F8B",
          subtitle: "\u5728\u4EE3\u7801\u7684\u7F1D\u9699\u4E2D\u5BFB\u627E\u7075\u9B42\u7684\u5171\u9E23",
          right: /* @__PURE__ */ jsx(
            InlineSearch,
            {
              value: searchQuery,
              onChange: setSearchQuery,
              placeholder: "\u641C\u7D22\u97F3\u8F68..."
            }
          )
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8 w-full md:items-stretch md:h-[calc(100vh-320px)] md:min-h-[600px] md:max-h-[720px]", children: [
        /* @__PURE__ */ jsxs(
          motion.div,
          {
            initial: { opacity: 0, y: 40 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.1 },
            transition: { duration: 0.5, ease: "easeOut" },
            className: "md:col-span-5 min-w-0 flex flex-col bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-[32px] shadow-2xl p-6 md:p-10 relative overflow-hidden transition-colors duration-700 shrink-0 min-h-[460px] sm:min-h-[500px] md:min-h-0",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex-1 flex flex-col items-center justify-center relative z-10 w-full overflow-hidden py-4 md:py-0", children: [
                /* @__PURE__ */ jsx("div", { className: "relative w-40 h-40 sm:w-48 sm:h-48 lg:w-64 lg:h-64 flex-shrink-0 aspect-square mb-6 md:mb-10 flex items-center justify-center", children: /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: `absolute inset-0 m-auto w-[85%] h-[85%] bg-indigo-500/25 blur-[35px] rounded-full transition-all duration-1000 z-0 ${isPlaying ? "opacity-90 scale-105" : "opacity-20 scale-100"}`
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 m-auto w-[90%] h-[90%] rounded-full shadow-[0_0_40px_-5px_rgba(99,102,241,0.4)] z-0" }),
                  /* @__PURE__ */ jsxs(
                    motion.div,
                    {
                      className: `absolute inset-0 w-full h-full rounded-full border-[4px] md:border-[6px] border-white/80 dark:border-slate-600/80 shadow-2xl overflow-hidden transition-transform duration-700 z-10 music-rotating-disc ${isPlaying ? "scale-100" : "scale-95"}`,
                      style: { animationPlayState: isPlaying ? "running" : "paused" },
                      children: [
                        /* @__PURE__ */ jsx(
                          "img",
                          {
                            src: songCover,
                            alt: "cover",
                            className: "w-full h-full object-cover",
                            referrerPolicy: "no-referrer",
                            onError: (e) => {
                              const t = e.currentTarget;
                              if (t.src !== window.location.origin + "/images/default-cover.webp") {
                                t.src = "/images/default-cover.webp";
                              }
                            }
                          }
                        ),
                        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 m-auto w-10 h-10 md:w-12 md:h-12 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-full z-30 shadow-inner border border-slate-300 dark:border-slate-700" }),
                        /* @__PURE__ */ jsx(
                          "div",
                          {
                            className: "absolute inset-0 z-20 rounded-full pointer-events-none opacity-20",
                            style: {
                              background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.4), transparent, rgba(255,255,255,0.4), transparent)"
                            }
                          }
                        )
                      ]
                    }
                  )
                ] }) }),
                /* @__PURE__ */ jsx("div", { className: "w-full text-center px-2 md:px-4 mb-2 md:mb-6", children: isLoading ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2", children: [
                  /* @__PURE__ */ jsx("div", { className: "h-5 w-44 bg-slate-200/50 dark:bg-slate-700/50 rounded animate-pulse" }),
                  /* @__PURE__ */ jsx("div", { className: "h-4 w-28 bg-slate-200/40 dark:bg-slate-700/40 rounded animate-pulse" })
                ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("h1", { className: "text-lg md:text-xl lg:text-2xl font-black text-slate-900 dark:text-white truncate drop-shadow-sm tracking-tight", children: currentSong?.title || "\u672A\u77E5\u6B4C\u66F2" }),
                  /* @__PURE__ */ jsx("h2", { className: "text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 truncate mt-1 md:mt-2 tracking-widest", children: currentSong?.artist || "\u672A\u77E5\u6B4C\u624B" })
                ] }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "w-full mt-auto relative z-20", children: [
                /* @__PURE__ */ jsxs("div", { className: "w-full flex flex-col gap-1.5 mb-6 md:mb-8 px-1 md:px-3", children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "range",
                      min: "0",
                      max: "100",
                      value: progress || 0,
                      onChange: (e) => handleSeek(Number(e.target.value)),
                      className: "w-full h-1 md:h-1.5 rounded-full appearance-none cursor-pointer",
                      style: {
                        background: `linear-gradient(to right, #4f46e5 ${progress}%, rgba(0, 0, 0, 0.15) 0)`
                      }
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums", children: [
                    /* @__PURE__ */ jsx("span", { children: formatTime(currentTime) }),
                    /* @__PURE__ */ jsx("span", { children: formatTime(duration) })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "w-full flex items-center justify-between px-1 md:px-2 lg:px-4", children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: togglePlayMode,
                      className: "p-2 transition-transform hover:scale-110",
                      children: getPlayModeIcon()
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 md:gap-4 lg:gap-6", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: prevSong,
                        className: "p-2 text-slate-700 dark:text-slate-300 hover:text-indigo-500 transition-transform hover:scale-110",
                        children: /* @__PURE__ */ jsx(SkipBack, { size: 24, className: "md:w-7 md:h-7", fill: "currentColor" })
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: togglePlay,
                        className: "w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 flex items-center justify-center bg-indigo-500 text-white rounded-full hover:scale-105 shadow-xl shadow-indigo-500/40",
                        children: isPlaying ? /* @__PURE__ */ jsx(Pause, { size: 28, className: "md:w-8 md:h-8", fill: "currentColor" }) : /* @__PURE__ */ jsx(Play, { size: 28, className: "md:w-8 md:h-8 ml-1", fill: "currentColor" })
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: nextSong,
                        className: "p-2 text-slate-700 dark:text-slate-300 hover:text-indigo-500 transition-transform hover:scale-110",
                        children: /* @__PURE__ */ jsx(SkipForward, { size: 24, className: "md:w-7 md:h-7", fill: "currentColor" })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center", onMouseLeave: () => setShowVolumeSlider(false), children: [
                    /* @__PURE__ */ jsx(AnimatePresence, { children: showVolumeSlider && /* @__PURE__ */ jsx(
                      motion.div,
                      {
                        initial: { width: 0, opacity: 0 },
                        animate: { width: 80, opacity: 1 },
                        exit: { width: 0, opacity: 0 },
                        className: "hidden md:flex overflow-hidden items-center mr-2 bg-white/30 dark:bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20",
                        children: /* @__PURE__ */ jsx(
                          "input",
                          {
                            type: "range",
                            min: "0",
                            max: "1",
                            step: "0.01",
                            value: isMuted ? 0 : volume || 0,
                            onChange: (e) => setVolume(Number(e.target.value)),
                            className: "w-16 h-1 appearance-none rounded-full cursor-pointer",
                            style: {
                              background: `linear-gradient(to right, #4f46e5 ${(volume || 0) * 100}%, rgba(0, 0, 0, 0.15) 0)`
                            }
                          }
                        )
                      }
                    ) }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setShowVolumeSlider(!showVolumeSlider),
                        onDoubleClick: toggleMute,
                        className: `p-2 rounded-full transition-all ${showVolumeSlider ? "bg-indigo-500 text-white shadow-lg" : "text-slate-500 hover:text-indigo-500"}`,
                        children: isMuted || volume === 0 ? /* @__PURE__ */ jsx(VolumeX, { size: 18, className: "md:w-5 md:h-5" }) : /* @__PURE__ */ jsx(Volume2, { size: 18, className: "md:w-5 md:h-5" })
                      }
                    )
                  ] })
                ] })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          motion.div,
          {
            initial: { opacity: 0, y: 40 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.1 },
            transition: { duration: 0.5, delay: 0.16, ease: "easeOut" },
            className: "md:col-span-7 min-w-0 flex flex-col bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-[32px] shadow-2xl relative transition-colors duration-700 overflow-hidden h-[450px] md:h-auto shrink-0",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center gap-1 p-1 mt-4 md:mt-6 mx-auto bg-white/50 dark:bg-slate-900/50 rounded-full shadow-inner border border-white/40 w-48 md:w-64 z-20 shrink-0", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => setActiveTab("lyrics"),
                    className: `flex-1 py-1.5 md:py-2 rounded-full font-black text-xs md:text-[13px] transition-all ${activeTab === "lyrics" ? "bg-indigo-500 text-white shadow-md" : "text-slate-500"}`,
                    children: "\u6B4C\u8BCD"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => setActiveTab("playlist"),
                    className: `flex-1 py-1.5 md:py-2 rounded-full font-black text-xs md:text-[13px] transition-all ${activeTab === "playlist" ? "bg-indigo-500 text-white shadow-md" : "text-slate-500"}`,
                    children: "\u6B4C\u5355"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 relative mt-2 flex flex-col overflow-hidden", children: [
                activeTab === "lyrics" && /* @__PURE__ */ jsxs(
                  motion.div,
                  {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    transition: { duration: 0.3 },
                    className: "absolute inset-0 flex flex-col h-full",
                    children: [
                      /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 right-0 h-32 md:h-40 bg-gradient-to-b from-white/40 dark:from-slate-800/60 to-transparent z-10 pointer-events-none" }),
                      /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 left-0 right-0 h-32 md:h-40 bg-gradient-to-t from-white/40 dark:from-slate-800/60 to-transparent z-10 pointer-events-none" }),
                      /* @__PURE__ */ jsx(
                        "div",
                        {
                          ref: lyricContainerRef,
                          className: `h-full ${allLyrics.length > 0 ? "overflow-y-auto" : "overflow-hidden"} music-no-scrollbar scroll-smooth relative px-4 md:px-6 music-lyric-mask`,
                          children: allLyrics.length > 0 ? /* @__PURE__ */ jsx("div", { className: "py-[30vh] md:py-[35vh] flex flex-col gap-4 md:gap-6 text-center lg:px-10", children: allLyrics.map((line, index) => {
                            const isActive = index === activeLyricIndex;
                            return /* @__PURE__ */ jsx(
                              "div",
                              {
                                ref: isActive ? activeLyricRef : null,
                                className: `transition-all duration-700 cursor-pointer px-2 md:px-4 rounded-2xl ${isActive ? "opacity-100 scale-105 py-2 md:py-3 bg-white/10" : "opacity-20 hover:opacity-40"}`,
                                onClick: () => duration > 0 && handleSeek(line.time / duration * 100),
                                children: /* @__PURE__ */ jsx(
                                  "p",
                                  {
                                    className: `font-black tracking-tight leading-relaxed transition-all duration-700 ${isActive ? "text-lg md:text-2xl text-indigo-600 dark:text-indigo-400" : "text-sm md:text-lg text-slate-700 dark:text-slate-300"}`,
                                    style: isActive ? { textShadow: "0 0 20px rgba(99,102,241,0.15)" } : {},
                                    children: line.text
                                  }
                                )
                              },
                              index
                            );
                          }) }) : /* @__PURE__ */ jsx("div", { className: "h-full flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-3 md:gap-4", children: [
                            /* @__PURE__ */ jsx(Disc3, { className: "animate-spin text-indigo-500/40", size: 32 }),
                            /* @__PURE__ */ jsx("p", { className: "text-base md:text-xl font-black text-indigo-500 animate-pulse", children: currentLyric || "\u6B63\u5728\u6355\u83B7\u7075\u9B42\u65CB\u5F8B..." })
                          ] }) })
                        }
                      )
                    ]
                  }
                ),
                activeTab === "playlist" && /* @__PURE__ */ jsx(
                  motion.div,
                  {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    transition: { duration: 0.3 },
                    className: "absolute inset-0 px-4 md:px-8 pb-4 md:pb-8 pt-2 md:pt-4 flex flex-col",
                    children: /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto pr-2 flex flex-col gap-2 md:gap-2.5", children: isLoading ? /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2 md:gap-2.5 pr-2 py-2", children: [1, 2, 3, 4, 5].map((i) => /* @__PURE__ */ jsx("div", { className: "h-16 rounded-xl md:rounded-2xl bg-slate-200/30 dark:bg-slate-700/30 animate-pulse" }, i)) }) : /* @__PURE__ */ jsx(AnimatePresence, { mode: "popLayout", children: filteredPlaylist.map((song) => {
                      const originalIndex = playlist.findIndex((s) => s.id === song.id);
                      const isPlayingThis = song.id === currentSong?.id;
                      return /* @__PURE__ */ jsx(
                        motion.div,
                        {
                          layout: true,
                          initial: { opacity: 0, y: 10 },
                          animate: { opacity: 1, y: 0 },
                          exit: { opacity: 0, scale: 0.95 },
                          onClick: () => playSong(originalIndex),
                          className: `group flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl cursor-pointer transition-all border ${isPlayingThis ? "bg-white/60 dark:bg-slate-700/80 shadow-md border-indigo-500/30" : "border-transparent hover:bg-white/30 dark:hover:bg-slate-700/40"}`,
                          children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 md:gap-4 w-[85%]", children: [
                            /* @__PURE__ */ jsxs("div", { className: "relative w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-lg md:rounded-xl overflow-hidden shadow-sm", children: [
                              /* @__PURE__ */ jsx(
                                "img",
                                {
                                  src: song.cover || "/images/default-cover.webp",
                                  alt: "cover",
                                  className: "w-full h-full object-cover",
                                  onError: (e) => {
                                    const t = e.currentTarget;
                                    if (t.src !== window.location.origin + "/images/default-cover.webp") {
                                      t.src = "/images/default-cover.webp";
                                    }
                                  }
                                }
                              ),
                              isPlayingThis && isPlaying && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-[3px] items-end h-2 md:h-3", children: [
                                /* @__PURE__ */ jsx("span", { className: "w-0.5 bg-white rounded-full animate-[bounce_1s_infinite_0ms]" }),
                                /* @__PURE__ */ jsx("span", { className: "w-0.5 bg-white rounded-full animate-[bounce_1s_infinite_200ms]" }),
                                /* @__PURE__ */ jsx("span", { className: "w-0.5 bg-white rounded-full animate-[bounce_1s_infinite_400ms]" })
                              ] }) })
                            ] }),
                            /* @__PURE__ */ jsxs("div", { className: "flex flex-col truncate", children: [
                              /* @__PURE__ */ jsx(
                                "span",
                                {
                                  className: `text-sm md:text-[15px] font-black truncate ${isPlayingThis ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-200"}`,
                                  children: song.title
                                }
                              ),
                              /* @__PURE__ */ jsx("span", { className: "text-[10px] md:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5", children: song.artist })
                            ] })
                          ] })
                        },
                        song.id
                      );
                    }) }) })
                  }
                )
              ] })
            ]
          }
        )
      ] })
    ] })
  ] });
}
