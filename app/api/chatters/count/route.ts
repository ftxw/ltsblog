import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";

export async function GET(request: NextRequest) {
  try {
    return cachedPublicGet(CACHE_NAMESPACE.chattersCount, request, async () => {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const statusFilter =
        status === "published" || status === "draft" ? status : undefined;
      const where: Prisma.ChatterWhereInput = statusFilter
        ? { status: statusFilter }
        : {};
      const count = await prisma.chatter.count({ where });
      return { count };
    });
  } catch {
    return NextResponse.json({ error: "获取说说总数失败" }, { status: 500 });
  }
}
