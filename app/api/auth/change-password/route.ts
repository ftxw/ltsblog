import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getRequestToken } from "@/app/lib/auth";
import { supabaseLogin, supabaseUpdatePassword } from "@/app/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const token = getRequestToken(request);
    if (!token) {
      return NextResponse.json({ code: 1, message: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { code: 1, message: "请填写旧密码和新密码" },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { code: 1, message: "新密码长度不能少于 6 位" },
        { status: 400 }
      );
    }

    // 校验旧密码：用当前邮箱+旧密码走一次密码授权
    try {
      await supabaseLogin(user.email, String(oldPassword));
    } catch {
      return NextResponse.json(
        { code: 1, message: "旧密码不正确" },
        { status: 400 }
      );
    }

    await supabaseUpdatePassword(token, String(newPassword));

    return NextResponse.json({
      code: 0,
      message: "密码修改成功",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "修改密码失败";
    console.error("[POST /api/auth/change-password] error:", err);
    return NextResponse.json({ code: 1, message }, { status: 500 });
  }
}
