import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getClientIp } from "@/app/lib/utils";
import { invalidateCommentCaches } from "@/app/lib/api-cache";
import { getCommentUser } from "@/app/lib/comment-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { post_id, parent_id, content } = body;

    if (!post_id || !content || typeof content !== "string") {
      return NextResponse.json(
        { error: "缺少必要字段" },
        { status: 400 }
      );
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
    }
    if (trimmedContent.length > 2000) {
      return NextResponse.json(
        { error: "评论内容过长（最多 2000 字）" },
        { status: 400 }
      );
    }

    const userInfo = await getCommentUser(request);
    if (!userInfo) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const ip = getClientIp(request);

    const comment = await prisma.comment.create({
      data: {
        post_id,
        parent_id: parent_id || null,
        content: trimmedContent,
        ip,
        status: "approved",
        email_user_name: userInfo.email_user_name,
        email_user_avatar: userInfo.email_user_avatar,
      },
    });

    invalidateCommentCaches();

    return NextResponse.json(comment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建评论失败" }, { status: 500 });
  }
}
