import { NextResponse } from "next/server";
import { supabaseLogin } from "@/app/lib/supabase";
import { claimAdminIfFirst } from "@/app/lib/auth";
import {
  getLoginAttempts,
  recordLoginFailure,
  clearLoginAttempts,
} from "@/app/lib/rate-limit";
import { recordLoginLog } from "@/app/lib/login-log";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { code: 1, message: "请输入邮箱和密码" },
        { status: 400 }
      );
    }

    // 登录失败限制检查（按邮箱）
    const attempts = getLoginAttempts(email);
    if (attempts.locked) {
      const minutes = Math.ceil(attempts.remainingTime / 60);
      return NextResponse.json(
        { code: 1, message: `登录失败次数过多，请 ${minutes} 分钟后再试` },
        { status: 429 }
      );
    }

    let session: { accessToken: string; refreshToken: string; expires: number };
    let user: { id: string; email: string; nickname: string; avatar: string };
    try {
      const res = await supabaseLogin(email, password);
      session = res.session;
      user = res.user;
    } catch {
      const result = recordLoginFailure(email);
      try {
        await recordLoginLog({
          request,
          userId: "",
          username: email,
          summary: "登录失败：邮箱或密码错误",
        });
      } catch {}
      if (result.locked) {
        return NextResponse.json(
          { code: 1, message: "登录失败次数过多，请 5 分钟后再试" },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { code: 1, message: "邮箱或密码错误" },
        { status: 400 }
      );
    }

    clearLoginAttempts(email);
    try {
      await recordLoginLog({
        request,
        userId: user.id,
        username: email,
        summary: "登录成功",
      });
    } catch {}

    // 第一个注册/登录的账号自动成为管理员（user 表落 is_admin）
    let isAdmin = false;
    try {
      const row = await claimAdminIfFirst(user);
      isAdmin = Boolean(row?.is_admin);
    } catch {}

    return NextResponse.json({
      code: 0,
      message: "success",
      data: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expires: session.expires,
        avatar: user.avatar,
        username: user.email,
        email: user.email,
        nickname: user.nickname,
        roles: isAdmin ? ["admin"] : ["user"],
        permissions: isAdmin ? ["*"] : [],
      },
    });
  } catch (e) {
    console.error("[POST /api/auth/login] error:", e);
    return NextResponse.json(
      { code: 1, message: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
