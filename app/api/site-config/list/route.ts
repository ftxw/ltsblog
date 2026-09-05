import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await getCurrentUser(request);
    const configs = await prisma.siteConfig.findMany({
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        updated_at: true,
      },
      orderBy: { key: "asc" },
    });
    return NextResponse.json(configs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    const status = message.includes("未登录") || message.includes("无效的令牌") ? 401 : 500;
    return NextResponse.json({ code: 1, message: "获取站点配置失败" }, { status });
  }
}
