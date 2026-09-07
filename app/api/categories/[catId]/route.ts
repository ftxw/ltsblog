import { NextRequest, NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { invalidateCatalogCaches } from "@/app/lib/api-cache";
import { errMsg } from "@/app/lib/http";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ catId: string }> }
) {
  try {
    await requireAdmin(req);
    const { catId } = await params;
    const id = parseId(catId);
    if (id === null) {
      return NextResponse.json({ error: "无效的分类 ID" }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    const body = await req.json();
    const { name, slug, description, sort } = body;

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        slug: slug !== undefined ? slug : undefined,
        description: description !== undefined ? description : undefined,
        sort: sort !== undefined ? sort : undefined,
      },
    });

    invalidateCatalogCaches();

    return NextResponse.json(category);
  } catch (err) {
    console.error("PUT /api/categories/[catId] error:", err);
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "更新分类失败" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ catId: string }> }
) {
  try {
    await requireAdmin(req);
    const { catId } = await params;
    const id = parseId(catId);
    if (id === null) {
      return NextResponse.json({ error: "无效的分类 ID" }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    await prisma.category.delete({ where: { id } });

    invalidateCatalogCaches();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/categories/[catId] error:", err);
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "删除分类失败" }, { status: 500 });
  }
}
