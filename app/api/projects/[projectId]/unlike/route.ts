import { NextRequest, NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { invalidateProjectCaches } from "@/app/lib/api-cache";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const id = parseId(projectId);
  if (id === null) {
    return NextResponse.json({ code: 1, message: "项目ID不合法" }, { status: 400 });
  }

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ code: 1, message: "项目不存在" }, { status: 404 });
  }

  const next = Math.max(0, (existing.likes ?? 0) - 1);
  const updated = await prisma.project.update({
    where: { id },
    data: { likes: next },
  });

  invalidateProjectCaches();

  return NextResponse.json({ likes: updated.likes });
}
