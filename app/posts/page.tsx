import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import type { PostOut } from "@/components/posts/PostCard";
import type { CategoryItem } from "@/app/api/categories";
import PostsClient from "./PostsClient";

// ISR：300s 静态化列表首屏，避免每次访问都走「空壳 + 并发拉接口 + 跨境 DB」
export const revalidate = 300;

export const metadata: Metadata = {
  title: "文章",
  description: "记录技术探索、学术研究与生活感悟",
};

const PAGE_SIZE = 12;

/** 服务端读取首屏数据（分类 + 第一页文章 + 总数），供 ISR 静态化 */
async function fetchInitialData() {
  try {
    const [categories, posts, total] = await Promise.all([
      prisma.category.findMany({
        orderBy: { sort: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          sort: true,
          post_count: true,
        },
      }),
      prisma.post.findMany({
        where: { status: "published" },
        orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
        take: PAGE_SIZE,
        // 列表卡片不需要正文 content（大字段），用 select 显式裁剪，避免整行拉取
        select: {
          id: true,
          title: true,
          description: true,
          cover: true,
          status: true,
          is_pinned: true,
          views: true,
          published_at: true,
          created_at: true,
          updated_at: true,
          tags: { select: { tag: { select: { name: true } } } },
          category: { select: { name: true } },
        },
      }),
      prisma.post.count({ where: { status: "published" } }),
    ]);

    const initialPosts: PostOut[] = posts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      cover: p.cover,
      category: p.category?.name || "",
      tags: p.tags.map((t) => t.tag.name),
      status: p.status,
      is_pinned: p.is_pinned,
      views: p.views,
      published_at: p.published_at ? p.published_at.toISOString() : null,
      created_at: p.created_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
    }));

    const initialCategories: CategoryItem[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      sort: c.sort,
      post_count: c.post_count,
    }));

    return {
      initialCategories,
      initialPosts,
      initialHasMore: total > PAGE_SIZE,
    };
  } catch {
    // DB 不可用时回退为空（避免整页 500），客户端仍可通过接口兜底
    return {
      initialCategories: [] as CategoryItem[],
      initialPosts: [] as PostOut[],
      initialHasMore: false,
    };
  }
}

export default async function PostsPage() {
  const initial = await fetchInitialData();
  return <PostsClient {...initial} />;
}
