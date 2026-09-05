import { NextRequest, NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";

/**
 * 公开读取某个项目已审核（approved）的评论，返回树形结构。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const id = parseId(projectId);
  if (id === null) {
    return NextResponse.json({ code: 1, message: "项目ID不合法" }, { status: 400 });
  }

  return cachedPublicGet(CACHE_NAMESPACE.projectComments, request, async () => {
    const flat = await prisma.projectComment.findMany({
      where: { project_id: id, status: "approved" },
      orderBy: { created_at: "asc" },
    });

    type Row = (typeof flat)[number] & { replies: Row[] };
    const map = new Map<string, Row>();
    flat.forEach((c) => map.set(c.id, { ...c, replies: [] }));
    const roots: Row[] = [];
    map.forEach((c) => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.replies.push(c);
      } else {
        roots.push(c);
      }
    });

    return roots;
  });
}
