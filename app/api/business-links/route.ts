import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import {
  cachedPublicGet,
  CACHE_NAMESPACE,
  invalidateBusinessLinkCaches,
} from "@/app/lib/api-cache";
import { fail } from "@/app/lib/http";

/** GET：前台取启用的链接；?all=1 时后台取全部（需管理员） */
export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all") === "1";
  if (all) {
    try {
      await requireAdmin(request);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "需要管理员权限") {
        return fail("需要管理员权限", 403);
      }
      return fail("未登录", 401);
    }
    try {
      const links = await prisma.businessLink.findMany({
        orderBy: [{ sort: "asc" }, { id: "asc" }],
      });
      return NextResponse.json(links);
    } catch {
      return fail("获取链接失败", 500);
    }
  }
  return cachedPublicGet(CACHE_NAMESPACE.businessLinks, request, async () => {
    const links = await prisma.businessLink.findMany({
      where: { status: "active" },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    });
    return links;
  });
}

/** POST：后台新增业务链接 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const name = String(body.name || "").trim();
    const url = String(body.url || "").trim();
    if (!name || !url) {
      return fail("名称和链接不能为空");
    }
    if (url.length > 2000) {
      return fail("链接过长（最长 2000 字符）");
    }

    const link = await prisma.businessLink.create({
      data: {
        name,
        url,
        icon: String(body.icon || "").trim(),
        description: String(body.description || "").trim(),
        sort: body.sort || 0,
        status: body.status === "hidden" ? "hidden" : "active",
      },
    });

    invalidateBusinessLinkCaches();
    return NextResponse.json({ code: 0, message: "success", data: link });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "需要管理员权限") {
      return fail("需要管理员权限", 403);
    }
    return fail("创建链接失败", 500);
  }
}
