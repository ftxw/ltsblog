"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { CategoriesPanelHandle } from "@/components/admin/CategoriesPanel";
import type { TagsPanelHandle } from "@/components/admin/TagsPanel";
import { useToast } from "@/components/providers/ToastProvider";
import {
  apiJson,
  useApi,
  formatDate,
} from "@/components/admin/lib";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import CategoriesPanel from "@/components/admin/CategoriesPanel";
import TagsPanel from "@/components/admin/TagsPanel";
import CommentsAdminPanel from "@/components/admin/CommentsAdminPanel";

interface PostItem {
  id: string;
  title: string;
  slug: string;
  cover: string;
  category: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  views: number;
  comments_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
}

type Tab = "posts" | "categories" | "tags" | "comments";

const PAGE_SIZE = 15;

export default function AdminPostsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  const categoriesRef = useRef<CategoriesPanelHandle>(null);
  const tagsRef = useRef<TagsPanelHandle>(null);

  const categories = useApi<CategoryItem[]>("/api/categories");
  const allPostsCount = useApi<{ count: number }>("/api/posts/count");
  const tags = useApi<{ id: string }[]>("/api/tags");
  const commentsCount = useApi<{ items: unknown[]; total: number }>(
    "/api/comments/admin?page=1&size=1"
  );

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (searchText.trim()) params.set("keyword", searchText.trim());
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
    return `/api/posts?${params.toString()}`;
  }, [status, category, searchText, page]);

  const posts = useApi<PostItem[]>(listUrl);
  const countUrl = `/api/posts/count${status ? `?status=${status}` : ""}`;
  const count = useApi<{ count: number }>(countUrl);

  const total = count.data?.count ?? 0;

  const refresh = () => {
    posts.reload();
    count.reload();
  };

  const handleTogglePinned = async (post: PostItem) => {
    try {
      await apiJson(`/api/posts/${post.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_pinned: !post.is_pinned }),
      });
      addToast("success", post.is_pinned ? "已取消置顶" : "已置顶");
      refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleDelete = async (post: PostItem) => {
    const ok = await confirm("删除文章", `确定删除「${post.title}」？此操作不可撤销。`);
    if (!ok) return;
    try {
      await apiJson(`/api/posts/${post.id}`, { method: "DELETE" });
      addToast("success", "文章已删除");
      refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  const headerDescription =
    activeTab === "posts"
      ? `共 ${total} 篇文章`
      : activeTab === "categories"
        ? "管理文章分类"
        : activeTab === "tags"
          ? "管理文章标签"
          : "审核与管理文章评论";

  const actionLabel =
    activeTab === "posts"
      ? "新建文章"
      : activeTab === "categories"
        ? "新建分类"
        : activeTab === "tags"
          ? "新建标签"
          : "";

  const handleAction = () => {
    if (activeTab === "posts") router.push("/admin/posts/new");
    else if (activeTab === "categories") categoriesRef.current?.openCreate();
    else if (activeTab === "tags") tagsRef.current?.openCreate();
  };

  return (
    <>
      <PageHeader title="文章管理" description={headerDescription} />

      {/* 标签页：文章 / 分类 / 标签 / 评论 + 新建按钮 */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm">
        {(
          [
            { key: "posts", label: `文章（${allPostsCount.data?.count ?? 0}）` },
            {
              key: "categories",
              label: `分类（${categories.data?.length ?? 0}）`,
            },
            { key: "tags", label: `标签（${tags.data?.length ?? 0}）` },
            {
              key: "comments",
              label: `评论（${commentsCount.data?.total ?? 0}）`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
        {actionLabel && (
          <Button size="sm" className="ml-auto" onClick={handleAction}>
            <Plus className="h-3.5 w-3.5" />
            {actionLabel}
          </Button>
        )}
      </div>

      {activeTab === "categories" && <CategoriesPanel ref={categoriesRef} />}
      {activeTab === "tags" && <TagsPanel ref={tagsRef} />}
      {activeTab === "comments" && <CommentsAdminPanel kind="post" showOwner />}

      {activeTab === "posts" && (
        <>
      {/* 筛选区 */}
      <Card className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="!w-28 !py-1"
        >
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </Select>
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="!w-32 !py-1"
        >
          <option value="">全部分类</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <form
          className="ml-auto flex gap-2"
          style={{ minWidth: 200 }}
          onSubmit={(e) => {
            e.preventDefault();
            setSearchText(searchText);
            setPage(1);
          }}
        >
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索标题 / 摘要 / 正文"
            className="!w-44 !py-1"
          />
          <Button type="submit" variant="secondary" className="whitespace-nowrap !py-1">
            搜索
          </Button>
        </form>
      </Card>

      <Card>
        {posts.loading && !posts.data ? (
          <Loading />
        ) : (posts.data ?? []).length === 0 ? (
          <EmptyState text="暂无文章，点击右上角「新建文章」开始创作" />
        ) : (
          // 用 CSS Grid 替代 table，完全控制每列位置/宽度/对齐，避免 table-cell 默认行为干扰
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[35%_8%_8%_8%_8%_15%_18%] border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
              {(
                [
                  "标题",
                  "分类",
                  "状态",
                  "浏览",
                  "评论",
                  "发布时间",
                  "操作",
                ] as const
              ).map((h) => (
                <div
                  key={h}
                  className="flex h-11 overflow-hidden items-center justify-center px-4"
                >
                  {h}
                </div>
              ))}
            </div>
            {(posts.data ?? []).map((post) => (
              <div
                key={post.id}
                className="grid grid-cols-[35%_8%_8%_8%_8%_15%_18%] border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50/70"
              >
                {/* 标题列：文字+封面 右对齐 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-start gap-2 px-4">
                  <div className="min-w-0 flex-1">
                    <Link prefetch={false}
                      href={`/admin/posts/${post.id}`}
                      className="block truncate font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {post.title}
                    </Link>
                    {post.tags.length > 0 && (
                      <span className="block truncate text-xs text-slate-400">
                        {post.tags.join(" / ")}
                      </span>
                    )}
                  </div>
                  {post.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-14 shrink-0 rounded object-cover"
                    />
                  )}
                </div>
                {/* 分类 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                  {post.category || "-"}
                </div>
                {/* 状态 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                  <StatusBadge status={post.status} />
                </div>
                {/* 浏览 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                  {post.views}
                </div>
                {/* 评论 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                  {post.comments_count ?? 0}
                </div>
                {/* 发布时间 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-xs text-slate-500">
                  {formatDate(post.published_at || post.created_at)}
                </div>
                {/* 操作 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTogglePinned(post)}
                    title={post.is_pinned ? "取消置顶" : "置顶"}
                    className={cn(
                      post.is_pinned
                        ? "text-amber-500 hover:bg-amber-50"
                        : "text-slate-400 hover:bg-slate-100 hover:text-amber-500"
                    )}
                  >
                    {post.is_pinned ? "已置顶" : "置顶"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/admin/posts/${post.id}`)}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDelete(post)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-4 pb-3">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
          />
        </div>
      </Card>
        </>
      )}

      {confirmElement}
    </>
  );
}
