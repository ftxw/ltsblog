import { verifyAccessToken, type AppUser } from "@/app/lib/supabase";
import { prisma } from "@/app/lib/prisma";

/**
 * 统一鉴权入口（服务端）。
 *
 * 身份体系已切换为 Supabase Auth：本模块不签发/校验自研 JWT，
 * 只负责从请求中取出 Supabase access token 并交由 GoTrue 校验。
 *
 * 管理员判定：**第一个注册（或登录）的账号自动成为管理员**——
 * 注册/登录成功时调用 claimAdminIfFirst() 在 user 表落一条 is_admin 记录，
 * 之后 requireAdmin 按登录邮箱查该表判定。无需任何环境变量。
 */

export interface CurrentUser extends AppUser {
  is_admin: boolean;
  /** 兼容历史 payload 字段：user id（与 AppUser.id 相同） */
  sub: string;
  /** 兼容历史 payload 字段：以邮箱作为 username */
  username: string;
}

function asCurrent(u: AppUser, isAdmin: boolean): CurrentUser {
  return { ...u, is_admin: isAdmin, sub: u.id, username: u.email };
}

/** 按登录邮箱查 user 表的管理员标记（查不到=非管理员，DB 异常时同样按非管理员兜底） */
async function withAdminFlag(u: AppUser): Promise<CurrentUser> {
  let isAdmin = false;
  try {
    const row = await prisma.user.findUnique({
      where: { username: u.email },
      select: { is_admin: true },
    });
    isAdmin = Boolean(row?.is_admin);
  } catch {
    isAdmin = false;
  }
  return asCurrent(u, isAdmin);
}

/**
 * 注册/登录成功后调用：确保 user 表存在该账号的记录；
 * 若全库尚无任何「真实管理员」（排除历史遗留的空邮箱 admin 行），
 * 则把当前账号立为管理员（先到先得）。
 */
export async function claimAdminIfFirst(u: AppUser) {
  const existing = await prisma.user.findUnique({
    where: { username: u.email },
  });
  if (existing) return existing;

  const anyRealAdmin = await prisma.user.findFirst({
    where: { is_admin: true, email: { not: "" } },
    select: { id: true },
  });

  return prisma.user.create({
    data: {
      username: u.email,
      email: u.email,
      nickname: u.nickname,
      avatar: u.avatar,
      hashed_password: "",
      is_admin: !anyRealAdmin,
    },
  });
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
  return withAdminFlag(await verifyAccessToken(token));
}

/**
 * 管理员鉴权：要求登录且 user 表中 is_admin。
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
    return await withAdminFlag(await verifyAccessToken(token));
  } catch {
    return null;
  }
}

/** 判断 token 是否为管理员（供服务端组件在渲染期使用） */
export async function isAdminToken(token: string): Promise<boolean> {
  const user = await checkAuthorizedAccessToken(token);
  return Boolean(user?.is_admin);
}
