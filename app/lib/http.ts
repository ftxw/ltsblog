import { NextResponse } from "next/server";

/**
 * 统一 HTTP 响应工具。
 *
 * 项目历史原因存在两种响应风格：
 *   - `{ error: string }`（旧接口）
 *   - `{ code: 1, message: string }`（部分新接口）
 * 既有接口保持各自格式不动，避免破坏前端契约。
 */

/** 失败响应：fail("xx") → 400，fail("xx", 401) → 401 */
export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 从 catch 的 unknown 变量安全提取错误消息。
 * strict 下 catch 参数默认 unknown，直接 .message 需要收窄；
 * 项目历史大量 `catch (err: any)` + `err.message`，统一经此函数收窄。
 */
export function errMsg(err: unknown, fallback = "未知错误"): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
