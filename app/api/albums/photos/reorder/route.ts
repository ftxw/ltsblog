import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { invalidateAlbumCaches } from "@/app/lib/api-cache";
import { applySegmentReorder } from "@/app/lib/reorder";

/** 相册照片拖拽排序：body = { album_id, ids: string[] }，按 ids 顺序段内重排，sort 归一为 1..N */
export async function POST(request: NextRequest) {
  try {
    await getCurrentUser(request);
    const body = await request.json();
    const albumId = body.album_id;
    if (typeof albumId !== "string") {
      return NextResponse.json({ code: 1, message: "参数无效" }, { status: 400 });
    }
    const list = await prisma.photo.findMany({
      where: { album_id: albumId },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const ids = Array.isArray(body.ids)
      ? (body.ids as string[]).filter((s: unknown): s is string => typeof s === "string")
      : [];
    const known = new Set(list.map((x) => x.id));
    if (
      ids.length < 2 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !known.has(id))
    ) {
      return NextResponse.json({ code: 1, message: "参数无效" }, { status: 400 });
    }
    const full = applySegmentReorder(list, ids);
    await prisma.$transaction(
      full.map((id, idx) =>
        prisma.photo.update({ where: { id }, data: { sort: idx + 1 } })
      )
    );
    invalidateAlbumCaches();
    return NextResponse.json({ code: 0, message: "success" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
