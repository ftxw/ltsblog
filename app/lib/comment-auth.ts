import { verifyAccessToken } from "@/app/lib/supabase";

/**
 * 评论/留言用户解析：从 Supabase access token 中解析出可存储的评论用户信息。
 *
 * - 已登录 → { type: "email", email_user_name: 昵称, email_user_avatar }
 * - 未登录/无效 token → null（调用方自行决定放行或拒绝）
 */
export async function getCommentUser(
  request: Request
): Promise<{
  type: "email";
  email_user_name: string;
  email_user_avatar: string;
} | null> {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const user = await verifyAccessToken(auth.slice(7));
    return {
      type: "email" as const,
      email_user_name: user.nickname || user.email.split("@")[0] || "用户",
      email_user_avatar: user.avatar,
    };
  } catch {
    return null;
  }
}

/** 解析路径参数为内容 ID（cuid 字符串）；空值返回 null */
export function parseId(value: string | undefined): string | null {
  if (value === undefined) return null;
  const s = value.trim();
  return s === "" ? null : s;
}
