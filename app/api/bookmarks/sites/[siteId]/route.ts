import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { invalidateBookmarkCaches } from "@/app/lib/api-cache";
import { parseSitePlatforms } from "@/app/lib/bookmark-serialize";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await requireAdmin(request);
    const { siteId } = await params;
    const id = siteId;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.category_id !== undefined) data.category_id = body.category_id;
    if (body.name !== undefined) data.name = body.name;
    if (body.url !== undefined) data.url = body.url;
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.description !== undefined) data.description = body.description;
    if (body.platforms !== undefined)
      data.platforms =
        typeof body.platforms === "string"
          ? body.platforms
          : JSON.stringify(body.platforms);
    if (body.sort !== undefined) data.sort = body.sort;

    const site = await prisma.bookmarkSite.update({ where: { id }, data });

    invalidateBookmarkCaches();

    return NextResponse.json({ code: 0, message: "success", data: parseSitePlatforms(site) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    if (err instanceof Error && err.message.includes("未登录")) {
      return NextResponse.json({ code: 1, message }, { status: 401 });
    }
    return NextResponse.json({ code: 1, message: "更新站点失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await requireAdmin(request);
    const { siteId } = await params;
    const id = siteId;

    await prisma.bookmarkSite.delete({ where: { id } });

    invalidateBookmarkCaches();

    return NextResponse.json({ code: 0, message: "success" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    if (err instanceof Error && err.message.includes("未登录")) {
      return NextResponse.json({ code: 1, message }, { status: 401 });
    }
    return NextResponse.json({ code: 1, message: "删除站点失败" }, { status: 500 });
  }
}
