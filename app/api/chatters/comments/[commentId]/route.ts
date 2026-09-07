import { NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { invalidateChatterCaches } from "@/app/lib/api-cache";
import { errMsg } from "@/app/lib/http";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    await requireAdmin(request);
    const p = await params;
    const commentId = parseId(p.commentId);
    if (commentId === null) {
      return NextResponse.json({ error: "无效的评论ID" }, { status: 400 });
    }

    const comment = await prisma.chatterComment.findUnique({
      where: { id: commentId },
      select: { chatter_id: true },
    });

    if (comment) {
      await prisma.chatterComment.delete({ where: { id: commentId } });
    }

    invalidateChatterCaches();

    return NextResponse.json({ success: true });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "删除评论失败" }, { status: 500 });
  }
}
