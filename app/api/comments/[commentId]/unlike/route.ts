import { NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { fail } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { invalidateCommentCaches } from "@/app/lib/api-cache";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const p = await params;
    const commentId = parseId(p.commentId);
    if (commentId === null) {
      return fail("无效的评论ID");
    }

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { likes: { decrement: 1 } },
    });

    invalidateCommentCaches();

    return NextResponse.json(comment);
  } catch {
    return fail("取消点赞失败", 500);
  }
}
