import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { invalidateChatterCaches } from "@/app/lib/api-cache";
import { parseId } from "@/app/lib/comment-auth";
import { fail } from "@/app/lib/http";

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

    const comment = await prisma.chatterComment.update({
      where: { id: commentId },
      data: { likes: { increment: 1 } },
    });

    invalidateChatterCaches();

    return NextResponse.json(comment);
  } catch {
    return fail("点赞失败", 500);
  }
}
