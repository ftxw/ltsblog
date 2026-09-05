import { NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import {fail, errMsg} from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { invalidateCommentCaches } from "@/app/lib/api-cache";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    await getCurrentUser(request);
    const p = await params;
    const commentId = parseId(p.commentId);
    if (commentId === null) {
      return fail("无效的评论ID");
    }

    const body = await request.json();
    const { status } = body;
    if (!status) {
        return fail("缺少状态字段");
      }

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { status },
    });

    invalidateCommentCaches();

    return NextResponse.json(comment);
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
        return fail(errMsg(err), 401);
      }
    return fail("更新评论状态失败", 500);
  }
}
