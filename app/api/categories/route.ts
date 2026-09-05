import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { cachedPublicGet, CACHE_NAMESPACE, invalidateCatalogCaches } from "@/app/lib/api-cache";
import { errMsg } from "@/app/lib/http";

export async function GET() {
  try {
    return cachedPublicGet(CACHE_NAMESPACE.categories, null, async () => {
      const categories = await prisma.category.findMany({
        orderBy: { sort: "asc" },
      });
      return categories;
    });
  } catch (err) {
    console.error("GET /api/categories error:", err);
    return NextResponse.json({ error: "获取分类列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await getCurrentUser(req);
    const body = await req.json();
    const { name, slug, description, sort: bodySort } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "名称和 slug 不能为空" },
        { status: 400 }
      );
    }

    // 未显式传 sort 时自动排到末尾（当前最大 sort + 1）
    let sort = bodySort;
    if (typeof sort !== "number") {
      const max = await prisma.category.aggregate({ _max: { sort: true } });
      sort = (max._max.sort ?? 0) + 1;
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || "",
        sort,
      },
    });

    invalidateCatalogCaches();

    return NextResponse.json(category);
  } catch (err) {
    console.error("POST /api/categories error:", err);
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "创建分类失败" }, { status: 500 });
  }
}
