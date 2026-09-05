import { NextRequest, NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { invalidateProjectCaches } from "@/app/lib/api-cache";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  const id = parseId(commentId);
  if (id === null) {
    return NextResponse.json({ code: 1, message: "评论ID不合法" }, { status: 400 });
  }
  const updated = await prisma.projectComment.update({
    where: { id },
    data: { likes: { decrement: 1 } },
  });
  invalidateProjectCaches();
  return NextResponse.json({ id: updated.id, likes: updated.likes });
}
