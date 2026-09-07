import { NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { invalidateChatterCaches } from "@/app/lib/api-cache";
import { errMsg } from "@/app/lib/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatterId: string }> }
) {
  try {
    const p = await params;
    const chatterId = parseId(p.chatterId);
    if (chatterId === null) {
      return NextResponse.json({ error: "无效的说说ID" }, { status: 400 });
    }

    const chatter = await prisma.chatter.findUnique({
      where: { id: chatterId },
    });

    if (!chatter) {
      return NextResponse.json({ error: "说说不存在" }, { status: 404 });
    }

    // 评论数：实时统计（只计已通过），避免存储计数残留脏数据
    const comments_count = await prisma.chatterComment.count({
      where: { chatter_id: chatter.id, status: "approved" },
    });

    return NextResponse.json({ ...chatter, comments_count });
  } catch {
    return NextResponse.json({ error: "获取说说详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chatterId: string }> }
) {
  try {
    await requireAdmin(request);
    const p = await params;
    const chatterId = parseId(p.chatterId);
    if (chatterId === null) {
      return NextResponse.json({ error: "无效的说说ID" }, { status: 400 });
    }

    const body = await request.json();
    const { content, images, location, status } = body;

    const chatter = await prisma.chatter.update({
      where: { id: chatterId },
      data: {
        content: content !== undefined ? content.trim() : undefined,
        images: images !== undefined ? JSON.stringify(images) : undefined,
        location: location !== undefined ? location : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    invalidateChatterCaches();

    return NextResponse.json(chatter);
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "更新说说失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatterId: string }> }
) {
  try {
    await requireAdmin(request);
    const p = await params;
    const chatterId = parseId(p.chatterId);
    if (chatterId === null) {
      return NextResponse.json({ error: "无效的说说ID" }, { status: 400 });
    }

    await prisma.chatter.delete({ where: { id: chatterId } });

    invalidateChatterCaches();

    return NextResponse.json({ success: true });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "删除说说失败" }, { status: 500 });
  }
}
