import { NextRequest, NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { invalidateProjectCaches } from "@/app/lib/api-cache";
import { errMsg } from "@/app/lib/http";

/**
 * 后台删除某条项目评论
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    await getCurrentUser(request);
    const { commentId } = await params;
    const id = parseId(commentId);
    if (id === null) {
      return NextResponse.json({ code: 1, message: "评论ID不合法" }, { status: 400 });
    }

    const c = await prisma.projectComment.findUnique({ where: { id } });
    if (!c) {
      return NextResponse.json({ code: 1, message: "评论不存在" }, { status: 404 });
    }

    await prisma.projectComment.delete({ where: { id } });
    invalidateProjectCaches();
    return NextResponse.json({ code: 0, message: "success" });
  } catch (err) {
    return NextResponse.json(
      { code: 1, message: errMsg(err, "删除失败") },
      { status: 500 }
    );
  }
}
