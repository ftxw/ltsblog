import { NextRequest, NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { invalidateProjectCaches } from "@/app/lib/api-cache";
import { errMsg } from "@/app/lib/http";

/**
 * 后台审核评论状态：approved / pending / rejected
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    await requireAdmin(request);
    const { commentId } = await params;
    const id = parseId(commentId);
    if (id === null) {
      return NextResponse.json({ code: 1, message: "评论ID不合法" }, { status: 400 });
    }
    const body = await request.json();
    const status = body.status;
    if (!["approved", "pending", "rejected"].includes(status)) {
      return NextResponse.json({ code: 1, message: "状态不合法" }, { status: 400 });
    }

    const c = await prisma.projectComment.findUnique({ where: { id } });
    if (!c) {
      return NextResponse.json({ code: 1, message: "评论不存在" }, { status: 404 });
    }

    const updated = await prisma.projectComment.update({
      where: { id },
      data: { status },
    });

    invalidateProjectCaches();
    return NextResponse.json({ code: 0, message: "success", data: updated });
  } catch (err) {
    return NextResponse.json(
      { code: 1, message: errMsg(err, "操作失败") },
      { status: 500 }
    );
  }
}
