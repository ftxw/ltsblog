import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { cachedPublicGet, CACHE_NAMESPACE, invalidateCatalogCaches } from "@/app/lib/api-cache";
import { errMsg } from "@/app/lib/http";

export async function GET() {
  try {
    return cachedPublicGet(CACHE_NAMESPACE.tags, null, async () => {
      const tags = await prisma.tag.findMany({
        orderBy: { post_count: "desc" },
      });
      return tags;
    });
  } catch (err) {
    console.error("GET /api/tags error:", err);
    return NextResponse.json({ error: "获取标签列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "名称和 slug 不能为空" },
        { status: 400 }
      );
    }

    const tag = await prisma.tag.create({
      data: { name, slug },
    });

    invalidateCatalogCaches();

    return NextResponse.json(tag);
  } catch (err) {
    console.error("POST /api/tags error:", err);
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "创建标签失败" }, { status: 500 });
  }
}
