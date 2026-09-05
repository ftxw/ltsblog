"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2 } from "lucide-react";
import PostCard, { type PostOut } from "@/components/posts/PostCard";
import { getPosts } from "@/app/api";
import type { CategoryItem } from "@/app/api/categories";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import SegmentedFilter from "@/components/ui/SegmentedFilter";
import Reveal from "@/components/ui/Reveal";

/**
 * 文章列表（客户端交互部分）。
 * 首屏数据由服务端 RSC/ISR 注入（initial*），挂载时**不再重复请求**；
 * 仅当切换分类 / 加载更多时才调用分页接口。
 */
export default function PostsClient({
  initialCategories,
  initialPosts,
  initialHasMore,
}: {
  initialCategories: CategoryItem[];
  initialPosts: PostOut[];
  initialHasMore: boolean;
}) {
  const [categories] = useState<CategoryItem[]>(initialCategories);
  const [posts, setPosts] = useState<PostOut[]>(initialPosts);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 12;
  // 首次挂载已有服务端注入的数据，跳过第一次自动请求
  const hydratedRef = useRef(false);

  // 拉分页文章（按分类过滤）—— 首屏已由 SSR 提供，这里只处理后续翻页/切分类
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    setLoading(true);
    getPosts({
      status: "published",
      page,
      size: pageSize,
      ...(activeCategory ? { category: activeCategory } : {}),
    })
      .then((data) => {
        if (page === 1) {
          setPosts(data);
        } else {
          setPosts((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === pageSize);
      })
      .catch(() => {
        if (page === 1) setPosts([]);
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeCategory, page]);

  const handleCategoryChange = (cat: string | null) => {
    setActiveCategory(cat);
    setPage(1);
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  // 搜索过滤：标题 / 描述 / 标签
  const visiblePosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [posts, searchQuery]);

  return (
    <div className="container-page relative z-10">
      {/* 页头：标题 + 简介 + 搜索（统一 PageHeader） */}
      <PageHeader
        title="文章"
        subtitle="记录技术探索、学术研究与生活感悟"
        right={
          <InlineSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜索文章..."
          />
        }
      />

      {/* 分类筛选（统一 SegmentedFilter bar 全宽左对齐，归入下方卡片组动画） */}
      <Reveal className="mb-8">
        <SegmentedFilter
          variant="bar"
          options={[
            { value: "all", label: "全部" },
            ...categories.map((cat) => ({
              value: cat.slug,
              label: cat.name,
              count: cat.post_count,
            })),
          ]}
          active={activeCategory ?? "all"}
          onChange={(v) => handleCategoryChange(v === "all" ? null : v)}
        />
      </Reveal>

      {/* 文章网格 */}
      {loading && posts.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
          <BookOpen className="w-12 h-12 mb-4 opacity-40" />
          <p>{searchQuery.trim() ? "没有找到匹配的文章" : "暂无文章"}</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory ?? "all"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6"
          >
            {visiblePosts.map((post, index) => (
              <Reveal key={post.id} delay={index * 0.08}>
                <PostCard post={post} />
              </Reveal>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* 加载更多 */}
      {hasMore && posts.length > 0 && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center mt-10"
        >
          <button
            type="button"
            onClick={handleLoadMore}
            className="px-5 py-2 md:px-8 md:py-3 rounded-2xl bg-white/10 dark:bg-white/[0.05] backdrop-blur-xl border border-white/20 text-sm md:text-base text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-white/[0.1] transition-all duration-300 hover:-translate-y-0.5"
          >
            加载更多
          </button>
        </motion.div>
      )}

      {/* 加载中指示器（加载更多时） */}
      {loading && posts.length > 0 && (
        <div className="flex justify-center mt-10">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      )}
    </div>
  );
}
