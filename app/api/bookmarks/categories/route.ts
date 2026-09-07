import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { cachedPublicGet, CACHE_NAMESPACE, invalidateBookmarkCaches } from "@/app/lib/api-cache";

export async function GET() {
  return cachedPublicGet(CACHE_NAMESPACE.bookmarks, null, async () => {
    const categories = await prisma.bookmarkCategory.findMany({
      orderBy: { sort: "asc" },
    });
    return categories;
  });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    // 检查同名分类是否已存在
    const existing = await prisma.bookmarkCategory.findFirst({
      where: { name: body.name },
    });
    if (existing) {
      return NextResponse.json(
        { code: 1, message: `分类「${body.name}」已存在，请勿重复创建` },
        { status: 409 }
      );
    }
    // 未显式传 sort 时自动排到末尾（当前最大 sort + 1）
    let sort = body.sort;
    if (typeof sort !== "number") {
      const max = await prisma.bookmarkCategory.aggregate({
        _max: { sort: true },
      });
      sort = (max._max.sort ?? 0) + 1;
    }
    const category = await prisma.bookmarkCategory.create({
      data: {
        name: body.name,
        icon: body.icon || "",
        description: body.description || "",
        sort,
      },
    });

    invalidateBookmarkCaches();

    return NextResponse.json({ code: 0, message: "success", data: category });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
