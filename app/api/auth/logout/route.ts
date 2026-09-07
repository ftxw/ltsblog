import { NextResponse } from "next/server";

/** 退出登录：客户端清除 token 即可；此接口保留供未来需要 revoke 时扩展 */
export async function POST() {
  return NextResponse.json({ code: 0, message: "已退出登录" });
}
