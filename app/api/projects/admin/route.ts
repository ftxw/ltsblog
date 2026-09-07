import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { parseStringArray as safeParseStringArray } from "@/app/lib/utils";
import { errMsg } from "@/app/lib/http";

function serializeProject<
  T extends { images: string; tech_stack: string }
>(project: T) {
  return {
    ...project,
    images: safeParseStringArray(project.images),
    tech_stack: safeParseStringArray(project.tech_stack),
  };
}

/**
 * 后台项目管理（分页 + status 筛选）
 * status: published / draft
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get("size") || "20")));
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { sort: "asc" },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(serializeProject),
      total,
      page,
      size,
    });
  } catch (err) {
    return NextResponse.json(
      { code: 1, message: errMsg(err, "获取项目列表失败") },
      { status: 500 }
    );
  }
}
