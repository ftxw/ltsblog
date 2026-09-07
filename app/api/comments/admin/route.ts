import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { errMsg } from "@/app/lib/http";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const statusFilter =
      status === "approved" || status === "pending" || status === "rejected"
        ? status
        : undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get("size") || "20")));

    const where: Prisma.CommentWhereInput = statusFilter
      ? { status: statusFilter }
      : {};

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { ...where, parent_id: null },
        include: {
          post: { select: { title: true, id: true } },
          replies: { include: { replies: { include: {} } } },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.comment.count({ where }),
    ]);

    return NextResponse.json({ items: comments, total });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "获取评论列表失败" }, { status: 500 });
  }
}
