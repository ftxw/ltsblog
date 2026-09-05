import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/** 浏览量上报：客户端异步调用，不阻塞文章页 SSR 渲染，postId 为文章主键 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    // 只统计已发布文章；updateMany 避免查询后更新的两次往返
    await prisma.post.updateMany({
      where: { id: postId, status: "published" },
      data: { views: { increment: 1 } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
