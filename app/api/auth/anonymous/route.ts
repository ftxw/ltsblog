import { NextResponse } from "next/server";
import { createToken } from "@/app/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nickname, email, website } = body;

    if (!nickname || typeof nickname !== "string") {
      return NextResponse.json({ error: "请输入昵称" }, { status: 400 });
    }

    const name = nickname.trim();
    if (name.length < 1 || name.length > 20) {
      return NextResponse.json({ error: "昵称长度 1-20 个字符" }, { status: 400 });
    }

    // 生成随机头像
    const avatar = `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(name)}`;

    const token = await createToken({
      sub: name,
      avatar,
      email: typeof email === "string" ? email.trim().slice(0, 320) : "",
      website: typeof website === "string" ? website.trim().slice(0, 1024) : "",
      type: "anonymous",
    });

    return NextResponse.json({
      token,
      user: { login: name, avatar },
    });
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}