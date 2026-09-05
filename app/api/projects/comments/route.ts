import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { invalidateProjectCaches } from "@/app/lib/api-cache";
import { getCommentUser } from "@/app/lib/comment-auth";
import { errMsg } from "@/app/lib/http";

/**
 * 任意已认证用户（匿名/昵称）发表评论。
 */
export async function POST(request: NextRequest) {
  try {
    const userInfo = await getCommentUser(request);
    if (!userInfo) {
      return NextResponse.json({ code: 1, message: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const projectId = body.project_id;
    const content = (body.content ?? "").toString().trim();
    const parentId = body.parent_id ? body.parent_id : null;
    if (!Number.isFinite(projectId) || !content) {
      return NextResponse.json({ code: 1, message: "参数错误" }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json({ code: 1, message: "评论内容过长（最长 1000 字）" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ code: 1, message: "项目不存在" }, { status: 404 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "";

    const created = await prisma.projectComment.create({
      data: {
        project_id: projectId,
        parent_id: parentId,
        content,
        status: "approved",
        ip,
        email_user_name: userInfo.email_user_name,
        email_user_avatar: userInfo.email_user_avatar,
      },
    });

    invalidateProjectCaches();

    return NextResponse.json(
      {
        id: created.id,
        project_id: created.project_id,
        parent_id: created.parent_id,
        content: created.content,
        likes: created.likes,
        status: created.status,
        created_at: created.created_at,
        email_user_name: created.email_user_name,
        email_user_avatar: created.email_user_avatar,
        replies: [],
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { code: 1, message: errMsg(err, "发表评论失败") },
      { status: 500 }
    );
  }
}
