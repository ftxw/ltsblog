import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    return cachedPublicGet(CACHE_NAMESPACE.postsCount, req, async () => {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status") || undefined;

      const where: Prisma.PostWhereInput = {};
      if (status) where.status = status as Prisma.PostWhereInput["status"];

      const count = await prisma.post.count({ where });
      return { count };
    });
  } catch (err) {
    console.error("GET /api/posts/count error:", err);
    return NextResponse.json({ error: "获取文章数量失败" }, { status: 500 });
  }
}
