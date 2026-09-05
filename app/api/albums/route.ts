import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { cachedPublicGet, CACHE_NAMESPACE, invalidateAlbumCaches } from "@/app/lib/api-cache";

export async function GET() {
  return cachedPublicGet(CACHE_NAMESPACE.albums, null, async () => {
    try {
      const albums = await prisma.album.findMany({
        orderBy: { sort: "asc" },
        include: {
        _count: { select: { photos: true } },
        // 无封面时取第一张照片（与前端相册封面显示逻辑一致：sort 升序第一张）
        photos: {
          orderBy: { sort: "asc" },
          take: 1,
          select: { url: true },
        },
      },
    });
    const list = albums.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      cover: a.cover || a.photos[0]?.url || "",
      layout: a.layout,
      photo_count: a._count.photos,
      sort: a.sort,
      created_at: a.created_at,
      updated_at: a.updated_at,
      published_at: a.published_at,
    }));
      return list;
    } catch (e) {
      console.error("[albums] 查询失败:", e instanceof Error ? e.message : e);
      return [] as unknown[];
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    await getCurrentUser(request);
    const body = await request.json();
    const album = await prisma.album.create({
      data: {
        title: body.title,
        description: body.description || "",
        cover: body.cover || "",
        layout: body.layout === "timeline" ? "timeline" : "grid",
        sort: body.sort || 0,
        published_at: body.published_at
          ? new Date(body.published_at)
          : undefined,
      },
    });

    invalidateAlbumCaches();

    return NextResponse.json({ code: 0, message: "success", data: album });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
