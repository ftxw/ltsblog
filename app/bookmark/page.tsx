import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import BookmarkClient from "./BookmarkClient";
import type { BookmarkCategory, BookmarkSite } from "@/app/api";

// ISR：300s 静态化收藏夹首屏（后台增删会 invalidateBookmarkCaches 即时重建）
export const revalidate = 300;

export const metadata: Metadata = {
  title: "收藏夹",
  description: "收集常用的好用站点和工具",
};

/** DB JSON 文本 → string[] */
function parseArr(v: string): string[] {
  try {
    const p = JSON.parse(v || "[]");
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

/** 服务端读取首屏（分类 + 启用的站点），供 ISR 静态化 */
async function fetchInitialData(): Promise<BookmarkCategory[]> {
  try {
    const rows = await prisma.bookmarkCategory.findMany({
      orderBy: { sort: "asc" },
      include: {
        sites: {
          orderBy: { sort: "asc" },
        },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description,
      sort: c.sort,
      created_at: c.created_at.toISOString(),
      sites: c.sites.map((s): BookmarkSite => ({
        id: s.id,
        category_id: s.category_id,
        name: s.name,
        url: s.url,
        icon: s.icon,
        description: s.description,
        platforms: parseArr(s.platforms),
        sort: s.sort,
        created_at: s.created_at.toISOString(),
      })),
    }));
  } catch {
    return [];
  }
}

export default async function BookmarkPage() {
  const initialData = await fetchInitialData();
  return <BookmarkClient initialData={initialData} />;
}
