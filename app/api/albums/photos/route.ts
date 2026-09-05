import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { invalidateAlbumCaches } from "@/app/lib/api-cache";

export async function POST(request: NextRequest) {
  try {
    await getCurrentUser(request);
    const body = await request.json();
    const photo = await prisma.photo.create({
      data: {
        album_id: body.album_id,
        url: body.url,
        caption: body.caption || "",
        taken_at: body.taken_at ? new Date(body.taken_at) : undefined,
        sort: body.sort || 0,
      },
    });

    invalidateAlbumCaches(`/photowall/${body.album_id}`);

    return NextResponse.json({ code: 0, message: "success", data: photo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
