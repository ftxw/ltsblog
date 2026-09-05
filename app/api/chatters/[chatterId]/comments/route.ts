import { NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";

type CommentNode<T> = T & { replies: CommentNode<T>[] };

/** 把扁平评论列表按 parent_id 组装成树（顶层 parent_id=null） */
function buildCommentTree<T extends { id: string; parent_id: string | null }>(
  comments: T[],
  parentId: string | null = null
): CommentNode<T>[] {
  return comments
    .filter((c) => c.parent_id === parentId)
    .map((c) => ({
      ...c,
      replies: buildCommentTree(comments, c.id),
    }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatterId: string }> }
) {
  try {
    const p = await params;
    const chatterId = parseId(p.chatterId);
    if (chatterId === null) {
      return NextResponse.json({ error: "无效的说说ID" }, { status: 400 });
    }

    return cachedPublicGet(CACHE_NAMESPACE.comments, request, async () => {
      const comments = await prisma.chatterComment.findMany({
        where: { chatter_id: chatterId, status: "approved" },
        orderBy: { created_at: "asc" },
      });

      return buildCommentTree(comments);
    });
  } catch {
    return NextResponse.json({ error: "获取评论失败" }, { status: 500 });
  }
}
