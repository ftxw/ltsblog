import { jwtVerify } from "jose";

/**
 * Supabase Auth 服务端封装（零新增依赖）。
 *
 * 身份体系已整体从「自研 JWT（jose+bcrypt）」切换到 Supabase Auth：
 * - 登录/注册/刷新：直接调 GoTrue REST（{SUPABASE_URL}/auth/v1/*）；
 * - 令牌校验：access token 是 GoTrue 用项目 JWT Secret 签的 HS256 JWT，
 *   用现有 jose 校验即可，无需额外网络请求，也无需 @supabase/supabase-js。
 *
 * 环境变量：
 *   SUPABASE_URL             项目地址，如 https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY        anon（公开）key
 *   SUPABASE_JWT_SECRET      项目 JWT Secret（Settings → API → JWT Secret）
 *   ADMIN_EMAIL              管理员邮箱，逗号分隔（登录时实时比对，不落库）
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "";

/** 管理员邮箱清单（env ADMIN_EMAIL，逗号分隔，统一小写比对） */
export const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAIL || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY && JWT_SECRET);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/** 未配置时给出可读错误（避免裸 undefined 请求） */
function requireConfig() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置：请设置 SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET");
  }
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** 过期时间（毫秒时间戳） */
  expires: number;
}

export interface AppUser {
  /** Supabase Auth 用户 UUID */
  id: string;
  email: string;
  nickname: string;
  avatar: string;
}

/** 无自定义头像时的默认头像（dicebear，按邮箱派生，稳定不变） */
export function defaultAvatar(email: string): string {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`;
}

function mapUser(raw: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): AppUser | null {
  if (!raw?.id) return null;
  const meta = (raw.user_metadata || {}) as { nickname?: string; avatar?: string };
  const email = raw.email || "";
  return {
    id: raw.id,
    email,
    nickname: meta.nickname || (email ? email.split("@")[0] : "用户"),
    avatar: meta.avatar || (email ? defaultAvatar(email) : ""),
  };
}

/** GoTrue 基础请求（带 apikey） */
async function authFetch(path: string, init?: RequestInit & { body?: BodyInit }) {
  requireConfig();
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      apikey: ANON_KEY,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (json as { msg?: string; error_description?: string; error?: string })?.msg ||
      (json as { error_description?: string })?.error_description ||
      (json as { error?: string })?.error ||
      "请求失败";
    throw new Error(msg);
  }
  return json as Record<string, unknown>;
}

function mapSession(json: Record<string, unknown>): { session: AuthSession; user: AppUser } {
  const user = mapUser(json.user as never);
  if (!user || typeof json.access_token !== "string") {
    throw new Error("登录失败");
  }
  return {
    session: {
      accessToken: json.access_token as string,
      refreshToken: (json.refresh_token as string) || "",
      expires: Date.now() + ((json.expires_in as number) || 3600) * 1000,
    },
    user,
  };
}

/** 邮箱+密码登录 */
export async function supabaseLogin(email: string, password: string) {
  const json = await authFetch("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return mapSession(json);
}

/** 注册（nickname 写入 user_metadata）。开启邮箱验证时无 session，需收信确认 */
export async function supabaseRegister(email: string, password: string, nickname: string) {
  const avatar = defaultAvatar(email);
  const json = await authFetch("/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: { nickname, avatar } }),
  });
  const user = mapUser(json.user as never);
  if (!user) throw new Error("注册失败");
  const accessToken = typeof json.access_token === "string" ? (json.access_token as string) : "";
  if (accessToken) {
    return { user, session: mapSession(json).session, needsConfirm: false };
  }
  // 项目开启邮件确认：注册成功但未激活，需用户收信确认后再登录
  return { user, session: null, needsConfirm: true };
}

/** refresh_token 换新 session */
export async function supabaseRefresh(refreshToken: string) {
  const json = await authFetch("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return mapSession(json);
}

/**
 * 校验 Supabase access token（HS256，key=项目 JWT Secret）。
 * 校验通过返回用户信息（昵称/头像从 token 的 user_metadata 取），
 * 失败抛错。不校验 aud，避免 anon key 变动导致误杀。
 */
export async function verifyAccessToken(token: string): Promise<AppUser> {
  requireConfig();
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    if (!payload.sub || payload.role !== "authenticated") {
      throw new Error("无效的令牌");
    }
    const meta = (payload.user_metadata || {}) as { nickname?: string; avatar?: string };
    const email = String(payload.email || "");
    return {
      id: String(payload.sub),
      email,
      nickname: meta.nickname || (email ? email.split("@")[0] : "用户"),
      avatar: meta.avatar || (email ? defaultAvatar(email) : ""),
    };
  } catch {
    throw new Error("无效的令牌");
  }
}

/** 用 access token 调用需登录的 GoTrue 端点 */
async function authFetchWithToken(token: string, path: string, init?: RequestInit) {
  requireConfig();
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (json as { msg?: string; error_description?: string; error?: string })?.msg ||
      (json as { error_description?: string })?.error_description ||
      (json as { error?: string })?.error ||
      "请求失败";
    throw new Error(msg);
  }
  return json as Record<string, unknown>;
}

/** 拉取最新用户信息（更新昵称/头像后刷新展示用） */
export async function supabaseGetUser(token: string): Promise<AppUser> {
  const json = await authFetchWithToken(token, "/user");
  const user = mapUser(json as never);
  if (!user) throw new Error("获取用户失败");
  return user;
}

/** 更新昵称/头像/简介（存入 user_metadata） */
export async function supabaseUpdateProfile(
  token: string,
  data: { nickname?: string; avatar?: string; bio?: string }
) {
  const patch: Record<string, unknown> = {};
  if (data.nickname !== undefined) patch.nickname = data.nickname;
  if (data.avatar !== undefined) patch.avatar = data.avatar;
  if (data.bio !== undefined) patch.bio = data.bio;
  const json = await authFetchWithToken(token, "/user", {
    method: "PUT",
    body: JSON.stringify({ data: patch }),
  });
  return mapUser(json as never);
}

/** 修改密码（登录态直接 PUT /user） */
export async function supabaseUpdatePassword(token: string, newPassword: string) {
  const json = await authFetchWithToken(token, "/user", {
    method: "PUT",
    body: JSON.stringify({ password: newPassword }),
  });
  return mapUser(json as never);
}
