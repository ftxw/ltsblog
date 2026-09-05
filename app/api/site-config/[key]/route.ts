import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { clearSiteConfigCache } from "@/app/lib/site-config-db";
import { invalidateAllPublicCaches } from "@/app/lib/api-cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  try {
    const config = await prisma.siteConfig.findUnique({
      where: { key },
    });
    if (!config) {
      return NextResponse.json(
        { code: 1, message: "配置不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json(config);
  } catch (e) {
    console.error("[site-config] 读取失败:", e instanceof Error ? e.message : e);
    return NextResponse.json({ code: 1, message: "配置不存在" }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireAdmin(request);
    const { key } = await params;
    const body = await request.json();
    const config = await prisma.siteConfig.upsert({
      where: { key },
      update: {
        value: body.value,
        description: body.description,
      },
      create: {
        key,
        value: body.value,
        description: body.description,
      },
    });
    clearSiteConfigCache();
    invalidateAllPublicCaches();
    return NextResponse.json({ code: 0, message: "success", data: config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    if (message === "需要管理员权限") {
      return NextResponse.json({ code: 1, message }, { status: 403 });
    }
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}


