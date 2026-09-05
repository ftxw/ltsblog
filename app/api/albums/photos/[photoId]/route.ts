import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { invalidateAlbumCaches } from "@/app/lib/api-cache";
import { deleteImageByUrl } from "@/app/lib/s3-image-host";


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    await getCurrentUser(request);
    const { photoId } = await params;
    const id = photoId;
    const body = await request.json();

    const photo = await prisma.photo.update({
      where: { id },
      data: {
        caption: body.caption,
        taken_at: body.taken_at ? new Date(body.taken_at) : undefined,
      },
    });

    invalidateAlbumCaches();

    return NextResponse.json({ code: 0, message: "success", data: photo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    await getCurrentUser(request);
    const { photoId } = await params;
    const id = photoId;

    let imageUrl = "";
    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) throw new Error("照片不存在");
    imageUrl = photo.url;

    await prisma.photo.delete({ where: { id } });

    invalidateAlbumCaches();

    // 查询对象 key，同步删除图床文件（尽力而为，失败不影响数据库结果）
    let synced = false;
    try {
      const uploadRec = await prisma.imageUpload.findUnique({
        where: { url: imageUrl },
      });
      const assetKey = uploadRec?.asset_id || undefined;
      synced = await deleteImageByUrl(imageUrl, assetKey);
    } catch (e) {
      console.warn(`[photo-delete] 图床同步删除跳过（无法查询 image_upload）: ${imageUrl}`, e);
    }

    return NextResponse.json({ code: 0, message: "success", synced });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
