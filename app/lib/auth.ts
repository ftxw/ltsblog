import { verifyAccessToken, isAdminEmail, type AppUser } from "@/app/lib/supabase";

/**
 * 统一鉴权入口（服务端）。
 *
 * 身份体系已切换为 Supabase Auth：本模块不再签发/校验自研 JWT，
 * 只负责从请求中取出 Supabase access token 并校验、按邮箱判定管理员。
 *
 * - 后台管理接口：requireAdmin / getCurrentUser（Bearer 或 authorized-token cookie）
 * - 前台评论/点赞：comment-auth.ts 走 verifyAccessToken（Bearer）
 *
 * 管理员判定：登录邮箱 ∈ env ADMIN_EMAIL（逗号分隔），实时比对、不落库，
 * 因此无需改动 user 表，也无需「首个注册者=管理员」等引导逻辑。
 */

export interface CurrentUser extends AppUser {
  is_admin: boolean;
  /** 兼容历史 payload 字段：user id（与 AppUser.id 相同） */
  sub: string;
  /** 兼容历史 payload 字段：以邮箱作为 username */
  username: string;
}

function asCurrent(u: AppUser): CurrentUser {
  return {
    ...u,
    is_admin: isAdminEmail(u.email),
    sub: u.id,
    username: u.email,
  };
}

/** 从请求头或 cookie 提取 access token（兼容旧的 authorized-token cookie 结构） */
export function getRequestToken(request: Request): string {
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);

  const cookieHeader = request.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/authorized-token=([^;]+)/);
  if (tokenMatch) {
    try {
      const cookieData = JSON.parse(decodeURIComponent(tokenMatch[1]));
      if (typeof cookieData.accessToken === "string") return cookieData.accessToken;
    } catch {
      // cookie 格式不对，忽略
    }
  }
  return "";
}

/** 解析当前登录用户；未登录抛 Error("未登录") */
export async function getCurrentUser(request: Request): Promise<CurrentUser> {
  const token = getRequestToken(request);
  if (!token) throw new Error("未登录");
  return asCurrent(await verifyAccessToken(token));
}

/**
 * 管理员鉴权：要求登录且邮箱 ∈ ADMIN_EMAIL。
 * 未登录抛 Error("未登录")；非管理员抛 Error("需要管理员权限")。
 */
export async function requireAdmin(request: Request): Promise<CurrentUser> {
  const user = await getCurrentUser(request);
  if (!user.is_admin) throw new Error("需要管理员权限");
  return user;
}

/**
 * 仅校验 token 是否有效（供服务端组件在渲染期判断登录态，如 admin 面板布局）。
 * 无效/缺失返回 null，不抛错。
 */
export async function checkAuthorizedAccessToken(
  token: string
): Promise<CurrentUser | null> {
  if (!token) return null;
  try {
    return asCurrent(await verifyAccessToken(token));
  } catch {
    return null;
  }
}

/** 判断 token 是否为管理员（供服务端组件在渲染期使用） */
export async function isAdminToken(token: string): Promise<boolean> {
  const user = await checkAuthorizedAccessToken(token);
  return Boolean(user?.is_admin);
}
