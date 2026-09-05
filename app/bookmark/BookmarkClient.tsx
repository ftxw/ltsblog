"use client";

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Bookmark, Search } from "lucide-react";
import { getBookmarks } from "@/app/api";
import type { BookmarkCategory, BookmarkSite } from "@/app/api";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import Reveal from "@/components/ui/Reveal";

function getIcon(site: BookmarkSite): string {
  if (site.icon) return site.icon;
  try {
    const origin = new URL(site.url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return "";
  }
}

export default function BookmarkClient({ initialData }: { initialData: BookmarkCategory[] }) {
  const [data, setData] = useState<BookmarkCategory[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const catRefs = useRef<Record<string, HTMLElement | null>>({});

  // 归一化：保证是数组 + 每个分类都有 sites 数组（防御旧缓存/异常数据）
  const safeData = useMemo(
    () =>
      (Array.isArray(data) ? data : []).map((c) => ({
        ...c,
        sites: Array.isArray(c.sites) ? c.sites : [],
      })),
    [data]
  );

  // 按搜索词过滤
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return safeData;
    const q = searchQuery.trim().toLowerCase();
    return safeData
      .map((cat) => ({
        ...cat,
        sites: cat.sites.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.description || "").toLowerCase().includes(q) ||
            (s.platforms || []).some((p) => p.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.sites.length > 0);
  }, [safeData, searchQuery]);

  const totalSites = useMemo(
    () => safeData.reduce((sum, cat) => sum + cat.sites.length, 0),
    [safeData]
  );

  return (
    <div className="container-page relative z-10">
      {/* Header：标题 + 简介 + 搜索（统一 PageHeader） */}
      <PageHeader
        title="收藏夹"
        subtitle={
          "收集常用的好用站点和工具" +
          (totalSites > 0 ? `  ·  共 ${totalSites} 个站点` : "")
        }
        right={
          <InlineSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜索站点名称、描述或平台..."
          />
        }
      />

      {/* 分类快捷导航 */}
      {!loading && !error && safeData.length > 1 && !searchQuery && (
        <Reveal className="mb-6 md:mb-8 flex flex-wrap gap-1.5 md:gap-2">
          {safeData.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                const el = catRefs.current[cat.id];
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActiveCat(cat.id);
                }
              }}
              className={`px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-all duration-300 ${
                activeCat === cat.id
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                  : "bg-white/30 dark:bg-slate-800/30 border border-white/40 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-300/40"
              }`}
            >
              {cat.name}
              <span className="ml-1 opacity-50 text-[10px]">{cat.sites.length}</span>
            </button>
          ))}
        </Reveal>
      )}

      {/* Loading 骨架屏 */}
      {loading && (
        <div className="space-y-10">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-5 w-24 bg-slate-200/50 dark:bg-slate-700/50 rounded animate-pulse" />
                <div className="h-4 w-6 bg-slate-200/50 dark:bg-slate-700/50 rounded-full animate-pulse" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="h-14 rounded-xl bg-white/20 dark:bg-slate-800/20 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="text-center py-20">
          <p className="text-slate-400 text-sm mb-4">加载失败，请刷新重试</p>
          <button
            onClick={() => {
              setError(false);
              setLoading(true);
              getBookmarks()
                .then((res) => setData(Array.isArray(res) ? res : []))
                .catch(() => setError(true))
                .finally(() => setLoading(false));
            }}
            className="px-4 py-2 rounded-full bg-sky-500/10 text-sky-600 text-sm font-medium hover:bg-sky-500/20 transition-colors border border-sky-500/20"
          >
            重新加载
          </button>
        </div>
      )}

      {/* 空数据 */}
      {!loading && !error && safeData.length === 0 && (
        <div className="text-center py-20">
          <Bookmark className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-400 text-sm">暂无收藏，请先在后台添加站点</p>
        </div>
      )}

      {/* 分类列表 */}
      {!loading && !error && safeData.length > 0 && (
        <div className="space-y-10 md:space-y-14">
          {filtered.map((category) => (
              <motion.section
                key={category.id}
                ref={(el) => { catRefs.current[category.id] = el as HTMLElement | null; }}
              >
                {/* 分类标题（统一 Reveal，归入下方内容动画） */}
                <Reveal className="flex items-center gap-2.5 mb-4 md:mb-6">
                  <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">
                    {category.name}
                  </h2>
                  <span className="text-xs text-slate-400 bg-slate-100/50 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                    {category.sites.length}
                  </span>
                </Reveal>
                {category.description && (
                  <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-4 -mt-2">
                    {category.description}
                  </p>
                )}

                {/* 站点卡片网格（左 icon + 右 名称/描述，桌面 4 列） */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
                >
                  {category.sites.map((site, siteIndex) => (
                    <Reveal
                      key={site.id}
                      delay={siteIndex * 0.08}
                      className="h-full"
                    >
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex h-full items-center gap-2.5 md:gap-3 rounded-2xl md:rounded-3xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg md:shadow-xl overflow-hidden transition-all duration-500 hover:-translate-y-1 md:hover:-translate-y-2 hover:scale-[1.02] hover:shadow-2xl p-3 md:p-4 cursor-pointer"
                      >
                      {/* 底部动态光晕 */}
                      <div className="absolute -bottom-16 -right-10 w-16 h-16 md:w-24 md:h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-tr from-indigo-500 to-purple-500 pointer-events-none"></div>

                      {/* 左侧：网站 icon（渐变描边圆） */}
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full p-[2px] md:p-0.5 bg-gradient-to-tr from-indigo-500/50 to-purple-500/50 shadow-sm group-hover:rotate-[360deg] transition-transform duration-1000 flex-shrink-0 relative z-10">
                        <div className="w-full h-full rounded-full overflow-hidden bg-white/80 dark:bg-slate-700/60 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element -- 站点 icon 是任意外链 favicon（getIcon），原生 img + onError 隐藏兜底 */}
                          <img
                            src={getIcon(site)}
                            alt={site.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const t = e.currentTarget;
                              t.style.display = "none";
                              const span = t.nextElementSibling as HTMLElement;
                              if (span) span.style.display = "flex";
                            }}
                          />
                          <span className="text-xs md:text-sm font-bold text-indigo-500 items-center justify-center hidden">
                            {site.name[0]}
                          </span>
                        </div>
                      </div>

                      {/* 右侧：名称 + 描述 */}
                      <div className="flex-1 min-w-0 relative z-10">
                        <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {site.name}
                        </h3>
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 leading-snug line-clamp-2 mt-0.5">
                          {site.description || "暂无描述"}
                        </p>
                      </div>
                    </a>
                    </Reveal>
                  ))}
                </motion.div>
              </motion.section>
            ))}

          {/* 搜索无结果 */}
          {searchQuery && filtered.length === 0 && (
            <div className="text-center py-16">
              <Search className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-400 text-sm">
                没有找到匹配 「{searchQuery}」 的站点
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}