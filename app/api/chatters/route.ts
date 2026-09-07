import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { cachedPublicGet, CACHE_NAMESPACE, invalidateChatterCaches } from "@/app/lib/api-cache";
import { parseStringArray as safeParseImages } from "@/app/lib/utils";
import { errMsg } from "@/app/lib/http";

export async function GET(request: Request) {
  try {
    return cachedPublicGet(CACHE_NAMESPACE.chatters, request, async () => {
      const { searchParams } = new URL(request.url);
      const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
      const size = Math.min(100, Math.max(1, parseInt(searchParams.get("size") || "20")));

      const chatters = await prisma.chatter.findMany({
        where: { status: "published" },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * size,
        take: size,
      });

      // 评论数：实时统计（与文章侧一致，只计已通过），避免存储计数残留脏数据
      const commentCounts = await prisma.chatterComment.groupBy({
        by: ["chatter_id"],
        where: {
          chatter_id: { in: chatters.map((c) => c.id) },
          status: "approved",
        },
        _count: { _all: true },
      });
      const commentMap = new Map(
        commentCounts.map((c) => [c.chatter_id, c._count._all])
      );

      return chatters.map((c) => ({
        ...c,
        images: safeParseImages(c.images),
        comments_count: commentMap.get(c.id) ?? 0,
      }));
    });
  } catch {
    return NextResponse.json({ error: "获取说说失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { content, images, location, status } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "缺少内容" }, { status: 400 });
    }

    const chatter = await prisma.chatter.create({
      data: {
        content: content.trim(),
        images: images ? JSON.stringify(images) : "[]",
        location: location || "",
        status: status === "draft" ? "draft" : "published",
      },
    });

    invalidateChatterCaches();

    return NextResponse.json(chatter, { status: 201 });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "创建说说失败" }, { status: 500 });
  }
}
