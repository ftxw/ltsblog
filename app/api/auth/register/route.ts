import { NextResponse } from "next/server";
import { supabaseRegister } from "@/app/lib/supabase";

/**
 * 公开注册评论账号（邮箱+密码+昵称）。
 * - Supabase 项目「邮箱确认」关闭：注册即自动登录，返回 session；
 * - 开启确认：返回 code=2，提示收信确认后再登录。
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const nickname = String(body.nickname || "").trim();

    if (!email || !password) {
      return NextResponse.json(
        { code: 1, message: "请输入邮箱和密码" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { code: 1, message: "邮箱格式不正确" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { code: 1, message: "密码长度不能少于 6 位" },
        { status: 400 }
      );
    }
    if (!nickname) {
      return NextResponse.json(
        { code: 1, message: "请填写昵称" },
        { status: 400 }
      );
    }
    if (nickname.length > 20) {
      return NextResponse.json(
        { code: 1, message: "昵称最多 20 个字符" },
        { status: 400 }
      );
    }

    const res = await supabaseRegister(email, password, nickname);
    if (res.needsConfirm || !res.session) {
      return NextResponse.json({
        code: 2,
        message: "注册成功，请前往邮箱完成确认后登录",
      });
    }
    return NextResponse.json({
      code: 0,
      message: "success",
      data: {
        accessToken: res.session.accessToken,
        refreshToken: res.session.refreshToken,
        expires: res.session.expires,
        avatar: res.user.avatar,
        email: res.user.email,
        nickname: res.user.nickname,
      },
    });
  } catch (e) {
    console.error("[POST /api/auth/register] error:", e);
    const message = e instanceof Error ? e.message : "注册失败";
    return NextResponse.json({ code: 1, message }, { status: 400 });
  }
}
