import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { invalidateBusinessLinkCaches } from "@/app/lib/api-cache";
import { parseId } from "@/app/lib/comment-auth";
import { fail } from "@/app/lib/http";

/** PUT：更新业务链接 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    await requireAdmin(request);
    const { linkId } = await params;
    const id = parseId(linkId);
    if (id === null) return fail("无效的链接ID");

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.url !== undefined) {
      const url = String(body.url).trim();
      if (!url) return fail("链接不能为空");
      if (url.length > 2000) return fail("链接过长（最长 2000 字符）");
      data.url = url;
    }
    if (body.icon !== undefined) data.icon = String(body.icon).trim();
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.sort !== undefined) data.sort = body.sort || 0;
    if (body.status !== undefined) {
      data.status = body.status === "hidden" ? "hidden" : "active";
    }

    const link = await prisma.businessLink.update({
      where: { id },
      data,
    });
    invalidateBusinessLinkCaches();
    return NextResponse.json({ code: 0, message: "success", data: link });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "需要管理员权限") {
      return fail("需要管理员权限", 403);
    }
    return fail("更新链接失败", 500);
  }
}

/** DELETE：删除业务链接 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    await requireAdmin(request);
    const { linkId } = await params;
    const id = parseId(linkId);
    if (id === null) return fail("无效的链接ID");

    await prisma.businessLink.delete({ where: { id } });
    invalidateBusinessLinkCaches();
    return NextResponse.json({ code: 0, message: "success" });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "需要管理员权限") {
      return fail("需要管理员权限", 403);
    }
    return fail("删除链接失败", 500);
  }
}
