import { NextRequest, NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { invalidatePostCaches } from "@/app/lib/api-cache";
import { deleteImagesByUrls, extractImageUrlsFromContent } from "@/app/lib/s3-image-host";
import { syncPostTags, decrementTagCounts } from "@/app/lib/tag-sync";
import { errMsg } from "@/app/lib/http";
import { toPostItem } from "@/app/lib/post-serialize";

function toPostDetail(post: Parameters<typeof toPostItem>[0] & { content: string }) {
  return {
    ...toPostItem(post),
    content: post.content,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;

    // 前台 /posts/{id} 与后台编辑均按主键精确访问（浏览量由 ViewCounter 单独上报）
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    return NextResponse.json(toPostDetail(post));
  } catch (err) {
    console.error("GET /api/posts/[postId] error:", err);
    return NextResponse.json({ error: "获取文章失败" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    await getCurrentUser(req);
    const { postId } = await params;
    const id = parseId(postId);
    if (id === null) {
      return NextResponse.json({ error: "无效的文章 ID" }, { status: 400 });
    }

    const existing = await prisma.post.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

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

    // 未设置封面但正文含图时，自动取正文第一张图作为封面（前台列表/详情展示用）
    const effectiveContent =
      content !== undefined ? content : existing.content || "";
    let coverVal = cover !== undefined ? cover : existing.cover;
    if ((coverVal === undefined || coverVal === "") && effectiveContent) {
      coverVal =
        effectiveContent.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] ||
        effectiveContent.match(/<img[^>]+src=["']([^"']+)["']/)?.[1] ||
        "";
    }

    let published_at = body.published_at
      ? new Date(body.published_at)
      : existing.published_at;
    if (status === "published" && !published_at) {
      published_at = new Date();
    }

    const oldCategoryId = existing.category_id;
    const newCategoryId = category_id !== undefined ? category_id : oldCategoryId;

    const post = await prisma.$transaction(
      async (tx) => {
        // 更新文章
        const updated = await tx.post.update({
          where: { id },
          data: {
            title: title !== undefined ? title : undefined,
            description: description !== undefined ? description : undefined,
            content: content !== undefined ? content : undefined,
            cover: coverVal,
            category_id: category_id !== undefined ? category_id || null : undefined,
            status: status !== undefined ? status : undefined,
            is_pinned: is_pinned !== undefined ? is_pinned : undefined,
            published_at,
          },
          include: {
            category: true,
            tags: { include: { tag: true } },
          },
        });

        // 批量同步标签（差集写入：只动新增/移除的关联，固定几次批量语句）
        if (tagNames && Array.isArray(tagNames)) {
          await syncPostTags(
            tx,
            id,
            existing.tags.map((pt) => pt.tag_id),
            tagNames
          );
        }
        return updated;
      },
      // 放宽交互式事务默认 5s 超时，避免保存长文时在连接池里排队被掐断
      { timeout: 20_000 }
    );

    // 同步标签后重取，让响应带最新标签（仅在本次真的传了 tags 时多查一次）
    let resp = post;
    if (tagNames && Array.isArray(tagNames)) {
      resp =
        (await prisma.post.findUnique({
          where: { id },
          include: {
            category: true,
            tags: { include: { tag: true } },
          },
        })) || post;
    }

    // 更新新旧 category 的 post_count
    if (oldCategoryId !== newCategoryId) {
      if (oldCategoryId) {
        await prisma.category.update({
          where: { id: oldCategoryId },
          data: { post_count: { decrement: 1 } },
        });
      }
      if (newCategoryId) {
        await prisma.category.update({
          where: { id: newCategoryId },
          data: { post_count: { increment: 1 } },
        });
      }
    }

    invalidatePostCaches();
    if (resp) revalidatePath(`/posts/${resp.id}`);

    return NextResponse.json(toPostItem(resp));
  } catch (err) {
    console.error("PUT /api/posts/[postId] error:", err);
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "更新文章失败" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    await getCurrentUser(req);
    const { postId } = await params;
    const id = parseId(postId);
    if (id === null) {
      return NextResponse.json({ error: "无效的文章 ID" }, { status: 400 });
    }

    const existing = await prisma.post.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, category: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    await prisma.$transaction(
      async (tx) => {
        // 更新 category.post_count
        if (existing.category_id) {
          await tx.category.update({
            where: { id: existing.category_id },
            data: { post_count: { decrement: 1 } },
          });
        }
        // 更新 tag.post_count（批量一次，不再逐个 await）
        await decrementTagCounts(
          tx,
          existing.tags.map((pt) => pt.tag_id)
        );

        // 删除文章（级联删除 PostTag）
        await tx.post.delete({ where: { id } });
      },
      { timeout: 20_000 }
    );

    invalidatePostCaches();
    revalidatePath(`/posts/${existing.id}`);

    // 同步删除图床文件：封面 + 正文中的外部图片（尽力而为，失败不影响数据库结果）
    const urls = new Set<string>();
    if (existing.cover && /^https?:\/\//i.test(existing.cover)) urls.add(existing.cover);
    for (const u of extractImageUrlsFromContent(existing.content || "")) urls.add(u);
    const uniqueUrls = [...urls];
    // 清理图床文件（尽力而为，失败/表缺失不影响文章删除）。
    // 走有界并发版本：早期是 Promise.allSettled 全并发，一篇文章几十张图
    // 就是上百个 S3 请求同时发出，很容易把实例的并发额度占满。
    let syncedCount = 0;
    try {
      syncedCount = await deleteImagesByUrls(uniqueUrls);
    } catch (e) {
      console.warn("[post-delete] 图床同步删除跳过:", e);
    }

    return NextResponse.json({ success: true, synced: syncedCount });
  } catch (err) {
    console.error("DELETE /api/posts/[postId] error:", err);
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "删除文章失败" }, { status: 500 });
  }
}
