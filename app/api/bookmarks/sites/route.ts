import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { cachedPublicGet, CACHE_NAMESPACE, invalidateBookmarkCaches } from "@/app/lib/api-cache";
import { parseSitePlatforms } from "@/app/lib/bookmark-serialize";

export async function GET(request: NextRequest) {
  return cachedPublicGet(CACHE_NAMESPACE.bookmarks, request, async () => {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");
    const where = categoryId ? { category_id: categoryId } : {};
    const sites = await prisma.bookmarkSite.findMany({
      where,
      orderBy: { sort: "asc" },
    });
    return sites.map(parseSitePlatforms);
  });
}

export async function POST(request: NextRequest) {
  try {
    await getCurrentUser(request);
    const body = await request.json();
    const categoryId = String(body.category_id || "").trim();
    const name = String(body.name || "").trim();
    const url = String(body.url || "").trim();
    if (!categoryId) {
      return NextResponse.json({ code: 1, message: "请选择收藏分类" }, { status: 400 });
    }
    if (!name || !url) {
      return NextResponse.json({ code: 1, message: "名称和链接不能为空" }, { status: 400 });
    }
    // 未显式传 sort 时自动排到末尾（当前最大 sort + 1）
    let sort = body.sort;
    if (typeof sort !== "number") {
      const max = await prisma.bookmarkSite.aggregate({ _max: { sort: true } });
      sort = (max._max.sort ?? 0) + 1;
    }
    const site = await prisma.bookmarkSite.create({
      data: {
        category_id: categoryId,
        name,
        url,
        icon: String(body.icon || "").trim(),
        description: String(body.description || "").trim(),
        platforms: body.platforms
          ? typeof body.platforms === "string"
            ? body.platforms
            : JSON.stringify(body.platforms)
          : "[]",
        sort,
      },
    });

    invalidateBookmarkCaches();

    return NextResponse.json({ code: 0, message: "success", data: parseSitePlatforms(site) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    // 未登录（getCurrentUser 抛"未登录"）返回 401，其余为服务端错误
    if (err instanceof Error && err.message.includes("未登录")) {
      return NextResponse.json({ code: 1, message }, { status: 401 });
    }
    return NextResponse.json({ code: 1, message: "创建站点失败" }, { status: 500 });
  }
}
