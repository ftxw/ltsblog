import { NextRequest, NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { invalidateProjectCaches } from "@/app/lib/api-cache";

/**
 * 公开点赞某项目（无身份校验，用于前端简单计数）
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const id = parseId(projectId);
  if (id === null) {
    return NextResponse.json({ code: 1, message: "项目ID不合法" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { likes: { increment: 1 } },
  });

  invalidateProjectCaches();

  return NextResponse.json({ likes: updated.likes });
}
