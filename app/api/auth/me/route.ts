import { NextResponse } from "next/server";
import { getCurrentUser, getRequestToken } from "@/app/lib/auth";
import { supabaseUpdateProfile, supabaseGetUser } from "@/app/lib/supabase";
import { errMsg } from "@/app/lib/http";

/**
 * 当前用户信息（基于 Supabase Auth）。
 * GET：解析 access token 返回用户资料；PUT：更新昵称/头像/简介（写入 user_metadata）。
 * 邮箱为登录主键，修改需 Supabase 邮件确认流程，本接口不支持直接改邮箱。
 */
function toMeData(
  u: { id: string; email: string; nickname: string; avatar: string; is_admin: boolean },
  bio = ""
) {
  return {
    id: u.id,
    username: u.email,
    nickname: u.nickname,
    avatar: u.avatar,
    email: u.email,
    bio,
    is_admin: u.is_admin,
    roles: u.is_admin ? ["admin"] : ["user"],
    permissions: u.is_admin ? ["*"] : [],
  };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    return NextResponse.json({
      code: 0,
      message: "success",
      data: toMeData(user),
    });
  } catch (err) {
    const msg = errMsg(err);
    if (msg === "未登录" || msg === "无效的令牌") {
      return NextResponse.json({ code: 1, message: msg }, { status: 401 });
    }
    return NextResponse.json(
      { code: 1, message: "获取用户信息失败" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const token = getRequestToken(request);
    if (!token) {
      return NextResponse.json({ code: 1, message: "未登录" }, { status: 401 });
    }
    const body = await request.json();
    const { nickname, avatar, bio } = body;

    const updated = await supabaseUpdateProfile(token, {
      nickname: typeof nickname === "string" ? nickname : undefined,
      avatar: typeof avatar === "string" ? avatar : undefined,
      bio: typeof bio === "string" ? bio : undefined,
    });
    const cur = await supabaseGetUser(token);
    const isAdmin = updated.email
      ? (await import("@/app/lib/supabase")).isAdminEmail(updated.email)
      : false;

    return NextResponse.json({
      code: 0,
      message: "success",
      data: toMeData(
        { ...(updated || cur), is_admin: isAdmin },
        typeof bio === "string" ? bio : ""
      ),
    });
  } catch (err) {
    const msg = errMsg(err);
    if (msg === "未登录" || msg === "无效的令牌") {
      return NextResponse.json({ code: 1, message: msg }, { status: 401 });
    }
    console.error("[PUT /api/auth/me] error:", err);
    return NextResponse.json(
      { code: 1, message: "更新用户信息失败" },
      { status: 500 }
    );
  }
}
