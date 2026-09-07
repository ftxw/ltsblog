import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { parseStringArray as safeParseImages } from "@/app/lib/utils";
import { errMsg } from "@/app/lib/http";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const statusFilter =
      status === "published" || status === "draft" ? status : undefined;
    const keyword = searchParams.get("keyword")?.trim() || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get("size") || "20")));

    const where: Prisma.ChatterWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(keyword ? { content: { contains: keyword } } : {}),
    };

    const [chatters, total] = await Promise.all([
      prisma.chatter.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.chatter.count({ where }),
    ]);

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

    const parsed = chatters.map((c) => ({
      ...c,
      images: safeParseImages(c.images),
      comments_count: commentMap.get(c.id) ?? 0,
    }));

    return NextResponse.json({ items: parsed, total });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "获取说说列表失败" }, { status: 500 });
  }
}
