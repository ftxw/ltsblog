import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { errMsg } from "@/app/lib/http";

export async function GET(request: Request) {
  try {
    const payload = await getCurrentUser(request);
    const userId = String(payload.sub || "");
    if (!userId) {
      return NextResponse.json(
        { code: 1, message: "无效的令牌" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { code: 1, message: "用户不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: 0,
      message: "success",
      data: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        email: user.email,
        bio: user.bio,
        is_admin: user.is_admin,
        roles: user.is_admin ? ["admin"] : ["user"],
        permissions: user.is_admin ? ["*"] : [],
      },
    });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json(
        { code: 1, message: errMsg(err) },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { code: 1, message: "获取用户信息失败" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await getCurrentUser(request);
    const userId = String(payload.sub || "");
    if (!userId) {
      return NextResponse.json(
        { code: 1, message: "无效的令牌" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nickname, email, bio, avatar } = body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nickname !== undefined && { nickname }),
        ...(email !== undefined && { email }),
        ...(bio !== undefined && { bio }),
        ...(avatar !== undefined && { avatar }),
      },
    });

    return NextResponse.json({
      code: 0,
      message: "success",
      data: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        email: user.email,
        bio: user.bio,
      },
    });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json(
        { code: 1, message: errMsg(err) },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { code: 1, message: "更新用户信息失败" },
      { status: 500 }
    );
  }
}
