"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, Clock, GitBranch, GitFork, Globe, X } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import { type ProjectItem } from "@/app/api";
import CommentAuthProvider from "@/components/providers/CommentAuthProvider";
import ProjectComments from "./ProjectComments";
import { formatDateCN } from "@/app/lib/format";
import { siteConfig } from "@/siteConfig";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import PageHeader from "@/components/ui/PageHeader";
import SegmentedFilter from "@/components/ui/SegmentedFilter";
import Reveal from "@/components/ui/Reveal";
import { thumbUrlOf } from "@/app/lib/image-thumb";

/** 归一化 tech_stack / images：兼容后端缓存里残留的 JSON 字符串格式 */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string");
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/* -------------------- ProjectTimelineNode 时间链路节点 -------------------- */
function ProjectTimelineNode({
  project,
  index,
  onOpen,
}: {
  project: ProjectItem;
  index: number;
  onOpen: (p: ProjectItem) => void;
}) {
  // 判断是放在左边还是右边（偶数左，奇数右）
  const isLeft = index % 2 === 0;
  const techStack = useMemo(() => toStringArray(project.tech_stack), [project.tech_stack]);
  // 默认封面与文章一致（后台可配置 defaultPostCover）
  const defaultCover = useConfigValue("defaultPostCover", siteConfig.defaultPostCover);
  const cover =
    project.images?.[0] || project.cover_image || defaultCover;
  // 列表封面显示缩略图；切换 project/封面时重置 broken（渲染期 prev 比较）
  const [coverBroken, setCoverBroken] = useState(false);
  const [prevCoverKey, setPrevCoverKey] = useState(`${project.id}::${cover}`);
  if (prevCoverKey !== `${project.id}::${cover}`) {
    setPrevCoverKey(`${project.id}::${cover}`);
    setCoverBroken(false);
  }
  const coverSrc = coverBroken ? cover : thumbUrlOf(cover);

  return (
    <Reveal
      delay={index * 0.08}
      className={`-mb-6 flex justify-between items-center w-full ${
        isLeft ? "md:flex-row-reverse" : "flex-row"
      }`}
    >
      {/* 留出对面的一半空白 */}
      <div className="order-1 w-5/12 hidden md:block"></div>

      {/* 中间的圆形节点 */}
      <div className="z-20 flex items-center justify-center order-1 bg-white dark:bg-slate-900 shadow-xl w-6 h-6 rounded-full border-4 border-indigo-400 ring-4 ring-indigo-200/50 dark:ring-indigo-900/30 transition-colors duration-1000"></div>

      {/* 卡片实体 */}
      <button
        type="button"
        onClick={() => onOpen(project)}
        className="order-1 w-full md:w-5/12 group text-left"
      >
        <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg rounded-3xl shadow-lg border border-white/60 dark:border-white/10 transition-all duration-500 hover:scale-[1.03] hover:bg-white/70 dark:hover:bg-slate-800/70 hover:shadow-2xl overflow-hidden flex flex-col">
          {/* 上半部分：封面图 */}
          <div className="w-full h-40 sm:h-48 overflow-hidden relative bg-slate-200 dark:bg-slate-700">
            <SafeImage
              src={coverSrc}
              fallbackSrc={cover}
              alt={project.name}
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none transition-transform duration-700 group-hover:scale-110"></div>
            {project.status_label && (
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/90 text-slate-700 dark:bg-slate-900/80 dark:text-slate-200 backdrop-blur">
                {project.status_label}
              </span>
            )}
          </div>

          {/* 下半部分：文本信息 */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px] flex items-center gap-1 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />
                {formatDateCN(new Date(project.created_at))}
              </div>
              {project.is_featured && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-gradient-to-r from-amber-400 to-pink-500 text-white shadow">
                  推荐
                </span>
              )}
            </div>

            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-tight">
              {project.name}
            </h3>

            {/* 技术栈标签 */}
            {techStack.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {techStack.slice(0, 6).map((t: string) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400 border border-indigo-500/10 dark:border-indigo-400/10"
                  >
                    #{t}
                  </span>
                ))}
                {techStack.length > 6 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/10">
                    +{techStack.length - 6}
                  </span>
                )}
              </div>
            )}

            </div>
            </div>
            </button>
            </Reveal>
  );
}

/* -------------------- 详情弹窗 -------------------- */
function ProjectDetailModal({
  project,
  onClose,
}: {
  project: ProjectItem;
  onClose: () => void;
}) {
  const slides = useMemo(
    () =>
      project.images?.length
        ? project.images
        : project.cover_image
          ? [project.cover_image]
          : [],
    [project]
  );
  const techStack = useMemo(
    () => toStringArray(project.tech_stack),
    [project.tech_stack]
  );
  const [idx, setIdx] = useState(0);
  // 点击轮播图 → 全屏查看当前原图
  const [fullImg, setFullImg] = useState<string | null>(null);
  // 弹窗底部固定输入区的宿主节点（评论输入区 portal 到这里）
  const inputHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        setIdx((p) => (slides.length ? (p - 1 + slides.length) % slides.length : 0));
      if (e.key === "ArrowRight")
        setIdx((p) => (slides.length ? (p + 1) % slides.length : 0));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, slides.length]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4"
      >
        <div
          className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="relative w-full max-w-6xl h-full md:h-[88vh] md:max-h-[90vh] bg-white dark:bg-slate-900 md:rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
        >
          {/* 左侧：图片幻灯片 */}
          <div className="relative w-full md:w-2/3 h-[40vh] md:h-full bg-slate-100 dark:bg-slate-800 flex-shrink-0">
            {slides.length > 0 ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 cursor-zoom-in"
                    onClick={() => setFullImg(slides[idx])}
                  >
                    <SafeImage
                      src={thumbUrlOf(slides[idx])}
                      fallbackSrc={slides[idx]}
                      alt={`${project.name}-${idx}`}
                      fill
                      sizes="(min-width: 768px) 60vw, 100vw"
                      className="object-contain"
                    />
                  </motion.div>
                </AnimatePresence>
                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setIdx((p) => (p - 1 + slides.length) % slides.length)
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdx((p) => (p + 1) % slides.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {slides.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setIdx(i)}
                          className={`h-1.5 rounded-full transition-all ${
                            i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] bg-black/50 text-white backdrop-blur">
                      {idx + 1} / {slides.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                暂无图片
              </div>
            )}
          </div>

          {/* 右侧：项目信息 + 评论（去掉原头部，右侧内容整体上移；关闭按钮移到弹窗外的 onClose 由 ESC / 背景点击触发） */}
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900">
            <div className="flex-1 min-h-0 flex flex-col">
              {/* 顶部信息滚动区 */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-7 pt-5 pb-3 space-y-5">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                  {project.name}
                </h2>
                {project.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {project.description}
                  </p>
                )}
              </div>

              {(project.link_github ||
                project.link_gitee ||
                project.link_live ||
                project.link_docs) && (
                <div className="flex flex-wrap gap-2">
                  {project.link_github && (
                    <a
                      href={project.link_github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      GitHub
                    </a>
                  )}
                  {project.link_gitee && (
                    <a
                      href={project.link_gitee}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 text-white text-[11px] font-medium hover:bg-red-600 transition-colors"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      Gitee
                    </a>
                  )}
                  {project.link_live && (
                    <a
                      href={project.link_live}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500 text-white text-[11px] font-medium hover:bg-sky-600 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      在线预览
                    </a>
                  )}
                  {project.link_docs && (
                    <a
                      href={project.link_docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-medium hover:bg-emerald-600 transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      文档
                    </a>
                  )}
                  {project.link_github === "" &&
                    project.link_gitee === "" &&
                    project.link_live === "" &&
                    project.link_docs === "" &&
                    null}
                </div>
              )}

              {project.long_description && (
                <div className="prose prose-slate dark:prose-invert max-w-none text-[13px] leading-7 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                  {project.long_description}
                </div>
              )}

              {/* 技术栈：内容下方、发布时间之上 */}
              {techStack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {techStack.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/40"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* 发表时间 */}
              <div className="text-[11px] text-slate-400">
                发表于 {formatDateCN(new Date(project.created_at))}
              </div>

              {/* 分割线：位于"发表于"下方，下方为评论列表 */}
              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* 评论列表：在滚动流内，位于分割线下方 */}
              <ProjectComments
                projectId={project.id}
                initialLikes={project.likes}
                inputHostRef={inputHostRef}
              />
              </div>

              {/* 评论输入框：与弹窗一体，固定在最底部（输入区由 Comments portal 进来） */}
              <div
                ref={inputHostRef}
                className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 md:px-7 py-2"
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* 全屏原图预览：点击轮播图打开，再点关闭 */}
      {fullImg && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
          onClick={() => setFullImg(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFullImg(null);
            }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="关闭预览"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- 项目封面为图床动态 URL，原生 img 直连 */}
          <img
            src={fullImg}
            alt="项目截图大图"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </AnimatePresence>
  );
}

/* -------------------- 页面主入口 -------------------- */
export default function ProjectsListClient({ initialProjects }: { initialProjects: ProjectItem[] }) {
  const [projects] = useState<ProjectItem[]>(initialProjects);
  const [loading] = useState(false);
  const [selected, setSelected] = useState<ProjectItem | null>(null);
  const [selectedTag, setSelectedTag] = useState("All");

  // 汇总所有项目的技术栈为标签列表（带数量，按数量降序）
  const tagList = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      for (const t of toStringArray(p.tech_stack)) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [projects]);

  // 按当前选中标签过滤
  const filteredProjects = useMemo(() => {
    if (selectedTag === "All") return projects;
    return projects.filter((p) =>
      toStringArray(p.tech_stack).includes(selectedTag)
    );
  }, [projects, selectedTag]);

  const onOpen = useCallback((p: ProjectItem) => setSelected(p), []);
  const onClose = useCallback(() => setSelected(null), []);

  return (
    <CommentAuthProvider>
      <div className="min-h-screen">
      <div className="container-page relative z-10">
        {/* 标题 + 简介（统一 PageHeader，项目无搜索） */}
        <PageHeader
          title="我的项目"
          subtitle="一些亲手打造的小作品 · 点击卡片查看详情"
        />

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-slate-400">暂无项目</div>
        ) : (
          <>
            {/* 标签/分类栏（统一 SegmentedFilter bar 全宽左对齐，归入下方卡片组动画） */}
            <Reveal className="mb-8">
              <SegmentedFilter
                variant="bar"
                options={[
                  { value: "All", label: "全部项目" },
                  ...tagList.map((tag) => ({
                    value: tag.name,
                    label: tag.name,
                    count: tag.count,
                  })),
                ]}
                active={selectedTag}
                onChange={setSelectedTag}
              />
            </Reveal>

            {/* 时间链路布局（与归档页一致） */}
            <div className="relative overflow-hidden min-h-[500px] w-[90%] mx-auto">
              <div className="absolute border-opacity-20 border-indigo-500 dark:border-indigo-400/20 h-full border-2 left-1/2 transform -translate-x-1/2 rounded-full transition-colors duration-1000"></div>
              <div className="relative z-10 flex flex-col gap-0 pb-10">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 font-bold text-sm">
                    该分类下暂无项目
                  </div>
                ) : (
                  filteredProjects.map((p, i) => (
                    <ProjectTimelineNode
                      key={p.id}
                      project={p}
                      index={i + 1}
                      onOpen={onOpen}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <ProjectDetailModal project={selected} onClose={onClose} />
      )}
      </div>
    </CommentAuthProvider>
  );
}
