/**
 * Post 序列化工具：把 Prisma 文章行转为前台/后台通用的 PostOut 形状。
 * 原实现散落在 /api/posts 与 /api/posts/[postId] 两个 route 且参数为 any，
 * 这里收敛并做结构化类型约束（兼容 select 裁剪行与 include 全行）。
 */

/** toPostItem 读取的最小字段形状（select 行与 include 行都满足） */
export interface PostRowShape {
  id: string;
  title: string;
  description: string;
  cover: string | null;
  status: string;
  is_pinned: boolean;
  views: number;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  category?: { name: string } | null;
  tags?: { tag: { name: string } }[] | null;
}

export function toPostItem(post: PostRowShape) {
  return {
    id: post.id,
    title: post.title,
    description: post.description,
    cover: post.cover,
    category: post.category?.name || "",
    tags: post.tags?.map((pt) => pt.tag.name) || [],
    status: post.status,
    is_pinned: post.is_pinned,
    views: post.views,
    published_at: post.published_at ? post.published_at.toISOString() : null,
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
  };
}
