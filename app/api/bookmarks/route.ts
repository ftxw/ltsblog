import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { parseSitePlatforms } from "@/app/lib/bookmark-serialize";

export async function GET() {
  try {
    return cachedPublicGet(CACHE_NAMESPACE.bookmarks, null, async () => {
      const categories = await prisma.bookmarkCategory.findMany({
        orderBy: { sort: "asc" },
        include: {
          sites: {
            orderBy: { sort: "asc" },
          },
        },
      });
      // 解析每个分类下每个站点的 platforms 字段
      return categories.map((cat) => ({
        ...cat,
        sites: cat.sites.map(parseSitePlatforms),
      }));
    });
  } catch (error) {
    console.error("获取收藏夹失败:", error);
    // 表不存在时返回空数组而不是 500
    return NextResponse.json([]);
  }
}
