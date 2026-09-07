import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { invalidateAlbumCaches } from "@/app/lib/api-cache";
import { deleteImagesByUrls } from "@/app/lib/s3-image-host";


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const id = albumId;
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      _count: { select: { photos: true } },
      photos: { orderBy: { sort: "asc" } },
    },
  });
  if (!album) {
    return NextResponse.json({ code: 1, message: "相册不存在" }, { status: 404 });
  }
  const { _count, ...rest } = album;
  return NextResponse.json({ ...rest, photo_count: _count.photos });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    await requireAdmin(request);
    const { albumId } = await params;
    const id = albumId;
    const body = await request.json();
    const album = await prisma.album.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        cover: body.cover,
        layout:
          body.layout === "timeline"
            ? "timeline"
            : body.layout === "grid"
            ? "grid"
            : undefined,
        sort: body.sort,
        published_at: body.published_at
          ? new Date(body.published_at)
          : null,
      },
    });

    invalidateAlbumCaches();

    return NextResponse.json({ code: 0, message: "success", data: album });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    await requireAdmin(request);
    const { albumId } = await params;
    const id = albumId;

    // 先收集需要同步删除的图床文件，再删除数据库记录
    const photos = await prisma.photo.findMany({
      where: { album_id: id },
      select: { url: true },
    });
    const album = await prisma.album.findUnique({ where: { id } });

    // 级联删除数据库记录
    await prisma.photo.deleteMany({ where: { album_id: id } });
    await prisma.album.delete({ where: { id } });

    invalidateAlbumCaches();

    // 清理图床文件（尽力而为，失败不影响数据库结果）。
    // 走有界并发版本：一个相册可能有上百张照片，每张还要删原图 + 缩略图，
    // 全并发时两三百个 S3 请求同时发出会直接把实例并发额度占满。
    let syncedCount = 0;
    try {
      const urls: string[] = photos.map((p) => p.url);
      if (album?.cover && /^https?:\/\//i.test(album.cover)) urls.push(album.cover);
      syncedCount = await deleteImagesByUrls(urls);
    } catch (e) {
      console.warn("[album-delete] 图床同步删除跳过:", e);
    }

    return NextResponse.json({ code: 0, message: "success", synced: syncedCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
