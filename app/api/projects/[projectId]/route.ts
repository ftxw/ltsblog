import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { invalidateProjectCaches } from "@/app/lib/api-cache";
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return NextResponse.json(
        { code: 1, message: "项目不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json(serializeProject(project));
  } catch (e) {
    console.error("[project] 读取失败:", e instanceof Error ? e.message : e);
    return NextResponse.json({ code: 1, message: "项目不存在" }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    await getCurrentUser(request);
    const { projectId } = await params;
    const id = projectId;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.long_description !== undefined)
      data.long_description = body.long_description;
    if (body.cover_image !== undefined) data.cover_image = body.cover_image;
    if (body.images !== undefined) {
      data.images = Array.isArray(body.images)
        ? JSON.stringify(body.images)
        : typeof body.images === "string"
          ? body.images
          : "[]";
    }
    if (body.tech_stack !== undefined)
      data.tech_stack =
        typeof body.tech_stack === "string"
          ? body.tech_stack
          : JSON.stringify(body.tech_stack);
    if (body.link_github !== undefined) data.link_github = body.link_github;
    if (body.link_gitee !== undefined) data.link_gitee = body.link_gitee;
    if (body.link_live !== undefined) data.link_live = body.link_live;
    if (body.link_docs !== undefined) data.link_docs = body.link_docs;
    if (body.status !== undefined) data.status = body.status;
    if (body.status_label !== undefined) data.status_label = body.status_label;
    if (body.is_featured !== undefined) data.is_featured = body.is_featured;
    if (body.sort !== undefined) data.sort = body.sort;
    if (body.likes !== undefined) data.likes = body.likes;

    const project = await prisma.project.update({ where: { id }, data });

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    await getCurrentUser(request);
    const { projectId } = await params;
    const id = projectId;

    await prisma.project.delete({ where: { id } });

    invalidateProjectCaches();

    return NextResponse.json({ code: 0, message: "success" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
