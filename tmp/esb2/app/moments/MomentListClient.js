"use strict";
"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { MapPin, ArrowDownAZ, ArrowUpZA, ChevronLeft, ChevronRight, Ghost, Clock, Heart, MessageCircle } from "lucide-react";
import CommentAuthProvider from "@/components/providers/CommentAuthProvider";
import { useEntityLike } from "@/components/useEntityLike";
import { relativeTime, formatDateCN } from "@/app/lib/format";
import MomentComments from "./MomentComments";
import { getChatterComments } from "@/app/api";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import SegmentedFilter from "@/components/ui/SegmentedFilter";
import Reveal from "@/components/ui/Reveal";
import { thumbUrlOf, fallbackThumbImage } from "@/app/lib/image-thumb";
function timeAgo(dateStr) {
  return relativeTime(dateStr, {
    dateFormat: (d) => formatDateCN(d)
  });
}
function MomentActions({
  moment,
  commentCount,
  commentsOpen,
  onToggleComments
}) {
  const { likes, liked, busy, toggle } = useEntityLike("chatter", moment.id, moment.likes);
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 md:gap-2 shrink-0", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: onToggleComments,
        className: `flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-colors cursor-pointer ${commentsOpen ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 hover:text-indigo-500"}`,
        "aria-label": "\u8BC4\u8BBA",
        children: [
          /* @__PURE__ */ jsx(MessageCircle, { className: "w-4 h-4 md:w-5 md:h-5" }),
          /* @__PURE__ */ jsx("span", { className: "tabular-nums", children: commentCount > 0 ? commentCount : "\u8BC4\u8BBA" })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: toggle,
        disabled: busy,
        className: `flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-all cursor-pointer ${liked ? "text-pink-500" : "text-slate-400 dark:text-slate-500 hover:text-pink-500"}`,
        "aria-label": "\u70B9\u8D5E",
        children: [
          /* @__PURE__ */ jsx(
            Heart,
            {
              className: `w-4 h-4 md:w-5 md:h-5 transition-all ${liked ? "fill-pink-500 scale-110" : ""}`
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "tabular-nums", children: likes > 0 ? likes : "\u70B9\u8D5E" })
        ]
      }
    )
  ] });
}
export default function MomentListClient({ initialMoments }) {
  const [moments] = useState(initialMoments);
  const [loading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [lightbox, setLightbox] = useState(null);
  const [openCommentId, setOpenCommentId] = useState(null);
  const [commentCountMap, setCommentCountMap] = useState({});
  const [commentCache, setCommentCache] = useState({});
  const prefetchedSet = useRef(/* @__PURE__ */ new Set());
  const prefetchComments = (momentId) => {
    if (prefetchedSet.current.has(momentId)) return;
    prefetchedSet.current.add(momentId);
    getChatterComments(momentId).then((data) => {
      if (!Array.isArray(data)) return;
      setCommentCache((m) => ({ ...m, [momentId]: data }));
    }).catch(() => {
      prefetchedSet.current.delete(momentId);
    });
  };
  const processedMoments = useMemo(() => {
    let result = [...moments];
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (m) => (m.content || "").toLowerCase().includes(query) || (m.location || "").toLowerCase().includes(query)
      );
    }
    result.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [moments, searchQuery, sortOrder]);
  const nextImg = (e) => {
    e.stopPropagation();
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.images.length });
  };
  const prevImg = (e) => {
    e.stopPropagation();
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length });
  };
  const renderImages = (images) => {
    if (!images || images.length === 0) return null;
    const count = images.length;
    if (count === 1) {
      return /* @__PURE__ */ jsx("div", { className: "mt-4 md:mt-8 flex justify-start sm:justify-center w-full", children: /* @__PURE__ */ jsx("div", { onClick: () => setLightbox({ images, index: 0 }), className: "max-w-[80%] sm:max-w-[280px] overflow-hidden rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-lg md:shadow-xl cursor-zoom-in group", children: /* @__PURE__ */ jsx("img", { src: thumbUrlOf(images[0]), onError: (e) => fallbackThumbImage(e.currentTarget, images[0]), alt: "moment", className: "w-full h-auto max-h-[300px] md:max-h-[400px] object-contain group-hover:scale-105 transition-transform duration-500" }) }) });
    }
    const columns = count === 4 ? 2 : 3;
    const maxWidth = count === 4 ? "210px" : "320px";
    return /* @__PURE__ */ jsx("div", { className: "w-full flex justify-start sm:justify-center mt-4 md:mt-8", children: /* @__PURE__ */ jsx("div", { className: "grid gap-1.5 md:gap-2 sm:mx-auto", style: { gridTemplateColumns: `repeat(${columns}, 1fr)`, width: "100%", maxWidth }, children: images.slice(0, 9).map((src, idx) => {
      const isLastVisible = idx === 8 && count > 9;
      return /* @__PURE__ */ jsxs("div", { onClick: () => setLightbox({ images, index: idx }), className: "group relative aspect-square overflow-hidden rounded-lg md:rounded-xl bg-slate-200/20 dark:bg-slate-700/20 border border-slate-200/50 dark:border-white/10 cursor-zoom-in", children: [
        /* @__PURE__ */ jsx("img", { src: thumbUrlOf(src), loading: "lazy", decoding: "async", onError: (e) => fallbackThumbImage(e.currentTarget, src), alt: "moment", className: "absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" }),
        isLastVisible && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/60 flex items-center justify-center text-white backdrop-blur-[2px]", children: /* @__PURE__ */ jsxs("span", { className: "text-lg md:text-xl font-black", children: [
          "+",
          count - 9
        ] }) })
      ] }, `${idx}-${src}`);
    }) }) });
  };
  const renderMomentCard = (moment, index) => /* @__PURE__ */ jsxs(
    motion.div,
    {
      initial: { opacity: 0, y: 40 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, amount: 0.1 },
      onViewportEnter: () => prefetchComments(moment.id),
      exit: { opacity: 0, scale: 0.9 },
      transition: { duration: 0.5, delay: index * 0.08, ease: "easeOut" },
      className: "flex flex-col bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl md:rounded-[40px] shadow-lg md:shadow-xl border border-white/40 dark:border-white/10 p-5 md:p-10 transition-shadow hover:shadow-2xl overflow-hidden relative group w-full",
      children: [
        /* @__PURE__ */ jsx("p", { className: "text-slate-800 dark:text-slate-200 text-base md:text-lg leading-relaxed whitespace-pre-wrap font-medium break-words", children: moment.content }),
        renderImages(moment.images),
        /* @__PURE__ */ jsxs("div", { className: "mt-5 md:mt-10 flex items-center justify-between gap-2 md:gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 pr-2 flex items-center gap-1.5 md:gap-2", children: [
            /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[11px] font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400 shrink-0 border border-slate-500/10", children: [
              /* @__PURE__ */ jsx(Clock, { size: 10, className: "md:w-3 md:h-3 shrink-0" }),
              timeAgo(moment.date)
            ] }),
            moment.location && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[11px] font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 max-w-full truncate border border-indigo-500/10", children: [
              /* @__PURE__ */ jsx(MapPin, { size: 10, className: "md:w-3 md:h-3 shrink-0" }),
              /* @__PURE__ */ jsx("span", { className: "truncate", children: moment.location })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            MomentActions,
            {
              moment,
              commentCount: commentCountMap[moment.id] ?? moment.comments_count,
              commentsOpen: openCommentId === moment.id,
              onToggleComments: () => setOpenCommentId(openCommentId === moment.id ? null : moment.id)
            }
          )
        ] }),
        openCommentId === moment.id && /* @__PURE__ */ jsx("div", { className: "pt-4 md:pt-5", children: /* @__PURE__ */ jsx(
          MomentComments,
          {
            chatterId: moment.id,
            initialLikes: moment.likes,
            initialCommentCount: commentCountMap[moment.id] ?? moment.comments_count,
            preloadedComments: commentCache[moment.id],
            onCountChange: (n) => setCommentCountMap((m) => ({ ...m, [moment.id]: n }))
          }
        ) })
      ]
    },
    moment.id
  );
  return /* @__PURE__ */ jsx(CommentAuthProvider, { children: /* @__PURE__ */ jsxs("div", { className: "container-page relative z-10 flex-1 flex flex-col min-h-[85vh]", children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        title: "\u751F\u6D3B\u52A8\u6001",
        subtitle: "\u5728\u4EE3\u7801\u4E4B\u5916\u6355\u6349\u77AC\u95F4\u7684\u6E29\u5EA6",
        right: /* @__PURE__ */ jsx(
          InlineSearch,
          {
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: "\u641C\u5BFB\u88AB\u9057\u5FD8\u7684\u8BB0\u5FC6..."
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(Reveal, { className: "mb-8 flex justify-center", children: /* @__PURE__ */ jsx(
      SegmentedFilter,
      {
        options: [
          { value: "desc", label: "\u6700\u65B0", icon: /* @__PURE__ */ jsx(ArrowDownAZ, { size: 12, className: "md:w-3.5 md:h-3.5" }) },
          { value: "asc", label: "\u6700\u65E9", icon: /* @__PURE__ */ jsx(ArrowUpZA, { size: 12, className: "md:w-3.5 md:h-3.5" }) }
        ],
        active: sortOrder,
        onChange: (v) => setSortOrder(v)
      }
    ) }),
    /* @__PURE__ */ jsx(LayoutGroup, { children: loading ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row gap-5 md:gap-8 pb-32 w-full items-start", children: [
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0", children: [1, 2, 3].map((i) => /* @__PURE__ */ jsxs("div", { className: "rounded-3xl md:rounded-[40px] bg-white/40 dark:bg-slate-800/30 p-5 md:p-10 animate-pulse", children: [
        /* @__PURE__ */ jsx("div", { className: "h-4 w-3/4 bg-slate-200/50 dark:bg-slate-700/50 rounded" }),
        /* @__PURE__ */ jsx("div", { className: "h-4 w-1/2 bg-slate-200/40 dark:bg-slate-700/40 rounded mt-3" }),
        /* @__PURE__ */ jsx("div", { className: "h-32 rounded-2xl bg-slate-200/30 dark:bg-slate-700/30 mt-4" })
      ] }, i)) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0", children: [1, 2].map((i) => /* @__PURE__ */ jsxs("div", { className: "rounded-3xl md:rounded-[40px] bg-white/40 dark:bg-slate-800/30 p-5 md:p-10 animate-pulse", children: [
        /* @__PURE__ */ jsx("div", { className: "h-4 w-3/4 bg-slate-200/50 dark:bg-slate-700/50 rounded" }),
        /* @__PURE__ */ jsx("div", { className: "h-4 w-1/2 bg-slate-200/40 dark:bg-slate-700/40 rounded mt-3" }),
        /* @__PURE__ */ jsx("div", { className: "h-32 rounded-2xl bg-slate-200/30 dark:bg-slate-700/30 mt-4" })
      ] }, i)) })
    ] }) : processedMoments.length > 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row gap-5 md:gap-8 pb-32 w-full items-start", children: [
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0", children: /* @__PURE__ */ jsx(AnimatePresence, { mode: "popLayout", children: processedMoments.map((moment, idx) => idx % 2 === 0 ? renderMomentCard(moment, idx) : null) }) }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0", children: /* @__PURE__ */ jsx(AnimatePresence, { mode: "popLayout", children: processedMoments.map((moment, idx) => idx % 2 === 1 ? renderMomentCard(moment, idx) : null) }) })
    ] }) : /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center py-12 md:py-24 min-h-[300px] md:min-h-[450px]", children: /* @__PURE__ */ jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, className: "flex flex-col items-center text-center px-6 md:px-10 py-12 md:py-20 bg-white/40 dark:bg-slate-800/30 backdrop-blur-3xl rounded-[32px] md:rounded-[50px] border border-white/30 dark:border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] max-w-lg w-full mx-auto", children: [
      /* @__PURE__ */ jsxs("div", { className: "w-16 h-16 md:w-24 md:h-24 bg-indigo-500/10 rounded-2xl md:rounded-3xl flex items-center justify-center mb-6 md:mb-8 relative", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" }),
        /* @__PURE__ */ jsx(Ghost, { size: 32, className: "md:w-12 md:h-12 text-indigo-500 relative z-10", strokeWidth: 1.5 })
      ] }),
      /* @__PURE__ */ jsx("h2", { className: "text-xl md:text-3xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 tracking-tight", children: searchQuery ? "\u6CA1\u627E\u5230\u76F8\u5173\u8BB0\u5FC6" : "\u670B\u53CB\u5708\u7A7A\u7A7A\u5982\u4E5F" }),
      /* @__PURE__ */ jsx("p", { className: "text-slate-500 dark:text-slate-400 font-medium text-sm md:text-lg leading-relaxed px-2 md:px-4", children: searchQuery ? `\u5C1D\u8BD5\u7CBE\u7B80\u4F60\u7684\u641C\u7D22\u8BCD\uFF0C\u6216\u8005\u6362\u4E2A\u5FC3\u60C5\u518D\u6B21\u51FA\u53D1\u3002` : `\u8FD8\u6CA1\u6709\u8BB0\u5F55\u4E0B\u4EFB\u4F55\u751F\u6D3B\u788E\u7247\u5462\u3002` })
    ] }) }) }),
    /* @__PURE__ */ jsx(AnimatePresence, { children: lightbox && /* @__PURE__ */ jsxs(
      motion.div,
      {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        className: "fixed inset-0 z-[9999] bg-slate-950/98 backdrop-blur-xl flex items-center justify-center cursor-pointer overflow-hidden",
        onClick: () => setLightbox(null),
        children: [
          lightbox.images.length > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "absolute left-4 md:left-12 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 border border-white/5 backdrop-blur-md", onClick: prevImg, children: /* @__PURE__ */ jsx(ChevronLeft, { size: 24, className: "md:w-9 md:h-9" }) }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "absolute right-4 md:right-12 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 border border-white/5 backdrop-blur-md", onClick: nextImg, children: /* @__PURE__ */ jsx(ChevronRight, { size: 24, className: "md:w-9 md:h-9" }) })
          ] }),
          /* @__PURE__ */ jsxs(motion.div, { initial: { opacity: 0, scale: 0.9, x: 50 }, animate: { opacity: 1, scale: 1, x: 0 }, exit: { opacity: 0, scale: 0.9, x: -50 }, className: "relative w-full h-full flex flex-col items-center justify-center p-4 md:p-12 pointer-events-none", children: [
            /* @__PURE__ */ jsx("img", { src: lightbox.images[lightbox.index], className: "max-w-full max-h-[75vh] md:max-h-[85vh] object-contain rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-auto", alt: "fullscreen" }),
            /* @__PURE__ */ jsxs("div", { className: "absolute bottom-8 md:bottom-10 px-4 md:px-5 py-1.5 md:py-2 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-[10px] md:text-xs font-black tracking-widest border border-white/10", children: [
              lightbox.index + 1,
              " / ",
              lightbox.images.length
            ] })
          ] }, lightbox.index)
        ]
      }
    ) })
  ] }) });
}
