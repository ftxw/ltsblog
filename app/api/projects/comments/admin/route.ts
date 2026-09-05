import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { errMsg } from "@/app/lib/http";

/**
 * 后台评论列表（树形 + status 筛选 + 分页限制在 size=100）
 */
export async function GET(request: NextRequest) {
  try {
    await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const size = Math.min(parseInt(searchParams.get("size") || "100"), 200);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const flat = await prisma.projectComment.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: size,
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

    return NextResponse.json(roots);
  } catch (err) {
    return NextResponse.json(
      { code: 1, message: errMsg(err, "获取评论失败") },
      { status: 500 }
    );
  }
}
