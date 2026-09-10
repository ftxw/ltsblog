"use strict";
"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, Clock, GitBranch, GitFork, Globe, X } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import CommentAuthProvider from "@/components/providers/CommentAuthProvider";
import ProjectComments from "./ProjectComments";
import { formatDateCN, relativeTime } from "@/app/lib/format";
import { siteConfig } from "@/siteConfig";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import PageHeader from "@/components/ui/PageHeader";
import SegmentedFilter from "@/components/ui/SegmentedFilter";
import Reveal from "@/components/ui/Reveal";
import { thumbUrlOf } from "@/app/lib/image-thumb";
function toStringArray(v) {
  if (Array.isArray(v)) return v.filter((s) => typeof s === "string");
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}
function ProjectTimelineNode({
  project,
  index,
  onOpen
}) {
  const isLeft = index % 2 === 0;
  const techStack = useMemo(() => toStringArray(project.tech_stack), [project.tech_stack]);
  const defaultCover = useConfigValue("defaultPostCover", siteConfig.defaultPostCover);
  const cover = project.images?.[0] || project.cover_image || defaultCover;
  const [coverBroken, setCoverBroken] = useState(false);
  const [prevCoverKey, setPrevCoverKey] = useState(`${project.id}::${cover}`);
  if (prevCoverKey !== `${project.id}::${cover}`) {
    setPrevCoverKey(`${project.id}::${cover}`);
    setCoverBroken(false);
  }
  const coverSrc = coverBroken ? cover : thumbUrlOf(cover);
  return /* @__PURE__ */ jsxs(
    Reveal,
    {
      delay: index * 0.08,
      className: `-mb-6 flex justify-between items-center w-full ${isLeft ? "md:flex-row-reverse" : "flex-row"}`,
      children: [
        /* @__PURE__ */ jsx("div", { className: "order-1 w-5/12 hidden md:block" }),
        /* @__PURE__ */ jsx("div", { className: "z-20 flex items-center justify-center order-1 bg-white dark:bg-slate-900 shadow-xl w-6 h-6 rounded-full border-4 border-indigo-400 ring-4 ring-indigo-200/50 dark:ring-indigo-900/30 transition-colors duration-1000" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => onOpen(project),
            className: "order-1 w-full md:w-5/12 group text-left",
            children: /* @__PURE__ */ jsxs("div", { className: "bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg rounded-3xl shadow-lg border border-white/60 dark:border-white/10 transition-all duration-500 hover:scale-[1.03] hover:bg-white/70 dark:hover:bg-slate-800/70 hover:shadow-2xl overflow-hidden flex flex-col", children: [
              /* @__PURE__ */ jsxs("div", { className: "w-full h-40 sm:h-48 overflow-hidden relative bg-slate-200 dark:bg-slate-700", children: [
                /* @__PURE__ */ jsx(
                  SafeImage,
                  {
                    src: coverSrc,
                    fallbackSrc: cover,
                    alt: project.name,
                    fill: true,
                    sizes: "(min-width: 768px) 45vw, 100vw",
                    className: "object-cover transition-transform duration-700 group-hover:scale-110"
                  }
                ),
                /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none transition-transform duration-700 group-hover:scale-110" }),
                project.status_label && /* @__PURE__ */ jsx("span", { className: "absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/90 text-slate-700 dark:bg-slate-900/80 dark:text-slate-200 backdrop-blur", children: project.status_label })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-3", children: [
                  /* @__PURE__ */ jsxs("div", { className: "text-indigo-600 dark:text-indigo-400 font-bold text-[11px] flex items-center gap-1 uppercase tracking-wider", children: [
                    /* @__PURE__ */ jsx(Clock, { className: "w-3.5 h-3.5", strokeWidth: 2.5 }),
                    formatDateCN(new Date(project.created_at))
                  ] }),
                  project.is_featured && /* @__PURE__ */ jsx("span", { className: "px-2 py-0.5 rounded-md text-[10px] font-black bg-gradient-to-r from-amber-400 to-pink-500 text-white shadow", children: "\u63A8\u8350" })
                ] }),
                /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg text-slate-800 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-tight", children: project.name }),
                techStack.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
                  techStack.slice(0, 6).map((t) => /* @__PURE__ */ jsxs(
                    "span",
                    {
                      className: "px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400 border border-indigo-500/10 dark:border-indigo-400/10",
                      children: [
                        "#",
                        t
                      ]
                    },
                    t
                  )),
                  techStack.length > 6 && /* @__PURE__ */ jsxs("span", { className: "px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/10", children: [
                    "+",
                    techStack.length - 6
                  ] })
                ] })
              ] })
            ] })
          }
        )
      ]
    }
  );
}
function ProjectDetailModal({
  project,
  onClose
}) {
  const slides = useMemo(
    () => project.images?.length ? project.images : project.cover_image ? [project.cover_image] : [],
    [project]
  );
  const techStack = useMemo(
    () => toStringArray(project.tech_stack),
    [project.tech_stack]
  );
  const [idx, setIdx] = useState(0);
  const [fullImg, setFullImg] = useState(null);
  const inputHostRef = useRef(null);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        setIdx((p) => slides.length ? (p - 1 + slides.length) % slides.length : 0);
      if (e.key === "ArrowRight")
        setIdx((p) => slides.length ? (p + 1) % slides.length : 0);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, slides.length]);
  return /* @__PURE__ */ jsxs(AnimatePresence, { children: [
    /* @__PURE__ */ jsxs(
      motion.div,
      {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        className: "fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4",
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "absolute inset-0 bg-slate-900/70 backdrop-blur-sm",
              onClick: onClose
            }
          ),
          /* @__PURE__ */ jsxs(
            motion.div,
            {
              initial: { opacity: 0, scale: 0.96, y: 10 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.96 },
              transition: { type: "spring", stiffness: 260, damping: 24 },
              className: "relative w-full max-w-6xl h-full md:h-[88vh] md:max-h-[90vh] bg-white dark:bg-slate-900 md:rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row",
              children: [
                /* @__PURE__ */ jsx("div", { className: "relative w-full md:w-2/3 h-[40vh] md:h-full bg-slate-100 dark:bg-slate-800 flex-shrink-0", children: slides.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(AnimatePresence, { mode: "wait", children: /* @__PURE__ */ jsx(
                    motion.div,
                    {
                      initial: { opacity: 0 },
                      animate: { opacity: 1 },
                      exit: { opacity: 0 },
                      transition: { duration: 0.3 },
                      className: "absolute inset-0 cursor-zoom-in",
                      onClick: () => setFullImg(slides[idx]),
                      children: /* @__PURE__ */ jsx(
                        SafeImage,
                        {
                          src: thumbUrlOf(slides[idx]),
                          fallbackSrc: slides[idx],
                          alt: `${project.name}-${idx}`,
                          fill: true,
                          sizes: "(min-width: 768px) 60vw, 100vw",
                          className: "object-contain"
                        }
                      )
                    },
                    idx
                  ) }),
                  slides.length > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        onClick: () => setIdx((p) => (p - 1 + slides.length) % slides.length),
                        className: "absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur transition-colors",
                        children: /* @__PURE__ */ jsx(ChevronLeft, { className: "w-5 h-5" })
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        onClick: () => setIdx((p) => (p + 1) % slides.length),
                        className: "absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur transition-colors",
                        children: /* @__PURE__ */ jsx(ChevronRight, { className: "w-5 h-5" })
                      }
                    ),
                    /* @__PURE__ */ jsx("div", { className: "absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5", children: slides.map((_, i) => /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        onClick: () => setIdx(i),
                        className: `h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`
                      },
                      i
                    )) }),
                    /* @__PURE__ */ jsxs("div", { className: "absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] bg-black/50 text-white backdrop-blur", children: [
                      idx + 1,
                      " / ",
                      slides.length
                    ] })
                  ] })
                ] }) : /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center text-slate-400 text-sm", children: "\u6682\u65E0\u56FE\u7247" }) }),
                /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900", children: /* @__PURE__ */ jsxs("div", { className: "flex-1 min-h-0 flex flex-col", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 md:px-7 pt-8 md:pt-10 pb-3 space-y-5", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("h2", { className: "text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2", children: project.name }),
                      project.description && /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 leading-relaxed", children: project.description })
                    ] }),
                    (project.link_github || project.link_gitee || project.link_live || project.link_docs) && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
                      project.link_github && /* @__PURE__ */ jsxs(
                        "a",
                        {
                          href: project.link_github,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors",
                          children: [
                            /* @__PURE__ */ jsx(GitBranch, { className: "w-3.5 h-3.5" }),
                            "GitHub"
                          ]
                        }
                      ),
                      project.link_gitee && /* @__PURE__ */ jsxs(
                        "a",
                        {
                          href: project.link_gitee,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 text-white text-[11px] font-medium hover:bg-red-600 transition-colors",
                          children: [
                            /* @__PURE__ */ jsx(GitFork, { className: "w-3.5 h-3.5" }),
                            "Gitee"
                          ]
                        }
                      ),
                      project.link_live && /* @__PURE__ */ jsxs(
                        "a",
                        {
                          href: project.link_live,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500 text-white text-[11px] font-medium hover:bg-sky-600 transition-colors",
                          children: [
                            /* @__PURE__ */ jsx(Globe, { className: "w-3.5 h-3.5" }),
                            "\u5728\u7EBF\u9884\u89C8"
                          ]
                        }
                      ),
                      project.link_docs && /* @__PURE__ */ jsxs(
                        "a",
                        {
                          href: project.link_docs,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-medium hover:bg-emerald-600 transition-colors",
                          children: [
                            /* @__PURE__ */ jsx(BookOpen, { className: "w-3.5 h-3.5" }),
                            "\u6587\u6863"
                          ]
                        }
                      ),
                      project.link_github === "" && project.link_gitee === "" && project.link_live === "" && project.link_docs === "" && null
                    ] }),
                    project.long_description && /* @__PURE__ */ jsx("div", { className: "prose prose-slate dark:prose-invert prose-base md:prose-lg max-w-none text-slate-800 dark:text-slate-200 whitespace-pre-wrap transition-colors duration-700", children: project.long_description }),
                    techStack.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5", children: techStack.map((t) => /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "px-2.5 py-1 text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/40",
                        children: t
                      },
                      t
                    )) }),
                    /* @__PURE__ */ jsxs("div", { className: "text-[13px] md:text-[14px] text-slate-400 dark:text-slate-500", children: [
                      "\u53D1\u8868\u4E8E ",
                      relativeTime(project.created_at)
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "border-t border-slate-100 dark:border-slate-800" }),
                    /* @__PURE__ */ jsx(
                      ProjectComments,
                      {
                        projectId: project.id,
                        initialLikes: project.likes,
                        inputHostRef
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      ref: inputHostRef,
                      className: "shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 md:px-7 py-2"
                    }
                  )
                ] }) })
              ]
            }
          )
        ]
      }
    ),
    fullImg && /* @__PURE__ */ jsxs(
      "div",
      {
        className: "fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4",
        onClick: () => setFullImg(null),
        children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                setFullImg(null);
              },
              className: "absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors",
              "aria-label": "\u5173\u95ED\u9884\u89C8",
              children: /* @__PURE__ */ jsx(X, { size: 20 })
            }
          ),
          /* @__PURE__ */ jsx(
            "img",
            {
              src: fullImg,
              alt: "\u9879\u76EE\u622A\u56FE\u5927\u56FE",
              onClick: (e) => e.stopPropagation(),
              className: "max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            }
          )
        ]
      }
    )
  ] });
}
export default function ProjectsListClient({ initialProjects }) {
  const [projects] = useState(initialProjects);
  const [loading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedTag, setSelectedTag] = useState("All");
  const tagList = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const p of projects) {
      for (const t of toStringArray(p.tech_stack)) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [projects]);
  const filteredProjects = useMemo(() => {
    if (selectedTag === "All") return projects;
    return projects.filter(
      (p) => toStringArray(p.tech_stack).includes(selectedTag)
    );
  }, [projects, selectedTag]);
  const onOpen = useCallback((p) => setSelected(p), []);
  const onClose = useCallback(() => setSelected(null), []);
  return /* @__PURE__ */ jsx(CommentAuthProvider, { children: /* @__PURE__ */ jsxs("div", { className: "min-h-screen", children: [
    /* @__PURE__ */ jsxs("div", { className: "container-page relative z-10", children: [
      /* @__PURE__ */ jsx(
        PageHeader,
        {
          title: "\u6211\u7684\u9879\u76EE",
          subtitle: "\u4E00\u4E9B\u4EB2\u624B\u6253\u9020\u7684\u5C0F\u4F5C\u54C1 \xB7 \u70B9\u51FB\u5361\u7247\u67E5\u770B\u8BE6\u60C5"
        }
      ),
      loading ? /* @__PURE__ */ jsx("div", { className: "flex justify-center py-24", children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" }) }) : projects.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-20 text-slate-400", children: "\u6682\u65E0\u9879\u76EE" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Reveal, { className: "mb-8", children: /* @__PURE__ */ jsx(
          SegmentedFilter,
          {
            variant: "bar",
            options: [
              { value: "All", label: "\u5168\u90E8\u9879\u76EE" },
              ...tagList.map((tag) => ({
                value: tag.name,
                label: tag.name,
                count: tag.count
              }))
            ],
            active: selectedTag,
            onChange: setSelectedTag
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "relative overflow-hidden min-h-[500px] w-[90%] mx-auto", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute border-opacity-20 border-indigo-500 dark:border-indigo-400/20 h-full border-2 left-1/2 transform -translate-x-1/2 rounded-full transition-colors duration-1000" }),
          /* @__PURE__ */ jsx("div", { className: "relative z-10 flex flex-col gap-0 pb-10", children: filteredProjects.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-20 text-slate-400 font-bold text-sm", children: "\u8BE5\u5206\u7C7B\u4E0B\u6682\u65E0\u9879\u76EE" }) : filteredProjects.map((p, i) => /* @__PURE__ */ jsx(
            ProjectTimelineNode,
            {
              project: p,
              index: i + 1,
              onOpen
            },
            p.id
          )) })
        ] })
      ] })
    ] }),
    selected && /* @__PURE__ */ jsx(ProjectDetailModal, { project: selected, onClose })
  ] }) });
}
