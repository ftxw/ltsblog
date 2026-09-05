import { decodeToken } from "@/app/lib/auth";

/**
 * 评论/留言用户解析：从请求 token 中解析出可存储的评论用户信息。
 * 自建评论体系（匿名/昵称登录），数据存数据库。
 *
 * - 邮箱/匿名用户 → { type: "email", email_user_name, email_user_avatar }
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
    const token = auth.slice(7);
    const payload = await decodeToken(token);

    if (payload.type === "email" || payload.type === "anonymous") {
      const name =
        String(payload.name || "") ||
        String(payload.sub || "") ||
        String(payload.email || "").split("@")[0] ||
        "匿名用户";
      return {
        type: "email" as const,
        email_user_name: name,
        email_user_avatar:
          String(payload.avatar || "") ||
          (payload.type === "anonymous" && payload.name
            ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
                String(payload.name)
              )}`
            : ""),
      };
    }

    return null;
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
