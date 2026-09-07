import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import {
  cachedPublicGet,
  CACHE_NAMESPACE,
  invalidateProjectCaches,
} from "@/app/lib/api-cache";
import { parseStringArray as safeParseStringArray } from "@/app/lib/utils";

function serializeProject<
  T extends { images: string; tech_stack: string }
>(project: T) {
  return {
    ...project,
    images: safeParseStringArray(project.images),
    tech_stack: safeParseStringArray(project.tech_stack),
  };
}

export async function GET() {
  return cachedPublicGet(CACHE_NAMESPACE.projects, null, async () => {
    try {
      const projects = await prisma.project.findMany({
        orderBy: { sort: "asc" },
      });
      return projects.map(serializeProject);
    } catch (e) {
      console.error("[projects] 查询失败:", e instanceof Error ? e.message : e);
      return [] as unknown[];
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    // 未显式传 sort 时自动排到末尾（当前最大 sort + 1）
    let sort = body.sort;
    if (typeof sort !== "number") {
      const max = await prisma.project.aggregate({ _max: { sort: true } });
      sort = (max._max.sort ?? 0) + 1;
    }
    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description || "",
        long_description: body.long_description || "",
        cover_image: body.cover_image || "",
        images: body.images ? JSON.stringify(body.images) : "[]",
        tech_stack: body.tech_stack ? JSON.stringify(body.tech_stack) : "[]",
        link_github: body.link_github || "",
        link_gitee: body.link_gitee || "",
        link_live: body.link_live || "",
        link_docs: body.link_docs || "",
        status: body.status || "published",
        status_label: body.status_label || "",
        is_featured: body.is_featured || false,
        sort,
        likes: body.likes || 0,
      },
    });

    invalidateProjectCaches();

    return NextResponse.json({
      code: 0,
      message: "success",
      data: serializeProject(project),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
