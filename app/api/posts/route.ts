import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { cachedPublicGet, CACHE_NAMESPACE, invalidatePostCaches } from "@/app/lib/api-cache";
import { syncPostTags } from "@/app/lib/tag-sync";
import { errMsg } from "@/app/lib/http";
import { toPostItem } from "@/app/lib/post-serialize";

export async function GET(req: NextRequest) {
  try {
    return cachedPublicGet(CACHE_NAMESPACE.posts, req, async () => {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status") || undefined;
      const categorySlug = searchParams.get("category") || undefined;
      const tagSlug = searchParams.get("tag") || undefined;
      const keyword = searchParams.get("keyword") || undefined;
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const size = Math.min(100, Math.max(1, parseInt(searchParams.get("size") || "10", 10)));

      let categoryId: string | undefined;
      if (categorySlug) {
        const cat = await prisma.category.findUnique({
          where: { slug: categorySlug },
        });
        if (cat) categoryId = cat.id;
      }

      let tagId: string | undefined;
      if (tagSlug) {
        const tag = await prisma.tag.findUnique({
          where: { slug: tagSlug },
        });
        if (tag) tagId = tag.id;
      }

      const where: Prisma.PostWhereInput = {};
      if (status) where.status = status as Prisma.PostWhereInput["status"];
      if (categoryId) where.category_id = categoryId;
      if (tagId) {
        where.tags = { some: { tag_id: tagId } };
      }
      if (keyword?.trim()) {
        const k = keyword.trim();
        where.OR = [
          { title: { contains: k } },
          { description: { contains: k } },
          { content: { contains: k } },
        ];
      }

      const posts = await prisma.post.findMany({
        where,
        orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
        skip: (page - 1) * size,
        take: size,
        // 列表项不含正文（toPostItem 只取展示字段），select 显式裁剪 content 大字段
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
          category: { select: { name: true } },
          tags: { select: { tag: { select: { name: true } } } },
        },
      });

      // 评论数：一次 groupBy 批量取，避免 N+1
      // 注意：依赖当前页文章 id，无法与主查询并行；同 URL 已有 60s 内存缓存覆盖
      const commentCounts = await prisma.comment.groupBy({
        by: ["post_id"],
        where: {
          post_id: { in: posts.map((p) => p.id) },
          status: "approved",
        },
        _count: { _all: true },
      });
      const commentMap = new Map(
        commentCounts.map((c) => [c.post_id, c._count._all])
      );

      return posts.map((post) => ({
        ...toPostItem(post),
        comments_count: commentMap.get(post.id) ?? 0,
      }));
    });
  } catch (err) {
    console.error("GET /api/posts error:", err);
    return NextResponse.json({ error: "获取文章列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const {
      title,
      description,
      content,
      cover,
      category_id,
      status,
      is_pinned,
      tags: tagNames,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "标题不能为空" },
        { status: 400 }
      );
    }

    // 未设置封面但正文含图时，自动取正文第一张图作为封面（前台列表/详情展示用）
    const contentStr = content || "";
    const firstImg =
      contentStr.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] ||
      contentStr.match(/<img[^>]+src=["']([^"']+)["']/)?.[1] ||
      "";
    const coverVal = cover || firstImg;

    let published_at = body.published_at ? new Date(body.published_at) : null;
    if (status === "published" && !published_at) {
      published_at = new Date();
    }

    const post = await prisma.$transaction(
      async (tx) => {
        const newPost = await tx.post.create({
          data: {
            title,
            description: description || "",
            content: contentStr,
            cover: coverVal,
            category_id: category_id || null,
            status: status || "draft",
            is_pinned: is_pinned || false,
            published_at,
          },
          include: {
            category: true,
            tags: { include: { tag: true } },
          },
        });

        // 批量同步标签（差集写入，固定几次批量语句，不再逐个 await）
        if (tagNames && Array.isArray(tagNames)) {
          await syncPostTags(tx, newPost.id, [], tagNames);
        }
        return newPost;
      },
      // 显式放宽交互式事务超时（默认 5s 在保存长文+多标签时可能不够）
      { timeout: 20_000 }
    );

    // 更新 category.post_count
    if (category_id) {
      await prisma.category.update({
        where: { id: category_id },
        data: { post_count: { increment: 1 } },
      });
    }

    invalidatePostCaches();
    revalidatePath(`/posts/${post.id}`);

    // 带标签的响应：事务内未返回标签名，这里重取一次（仅新增标签时）
    let resp = post;
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      resp = (await prisma.post.findUnique({
        where: { id: post.id },
        include: { category: true, tags: { include: { tag: true } } },
      })) || post;
    }
    return NextResponse.json(toPostItem(resp));
  } catch (err) {
    console.error("POST /api/posts error:", err);
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "创建文章失败" }, { status: 500 });
  }
}
