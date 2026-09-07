import { NextResponse } from "next/server";
import { supabaseRefresh } from "@/app/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { code: 1, message: "缺少 refreshToken" },
        { status: 400 }
      );
    }

    const { session } = await supabaseRefresh(String(refreshToken));

    return NextResponse.json({
      code: 0,
      message: "success",
      data: session,
    });
  } catch {
    return NextResponse.json(
      { code: 1, message: "Token 刷新失败" },
      { status: 401 }
    );
  }
}
