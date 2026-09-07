/**
 * Supabase Auth 服务端封装（零新增依赖）。
 *
 * 身份体系已整体从「自研 JWT（jose+bcrypt）」切换到 Supabase Auth：
 * - 登录/注册/刷新：直接调 GoTrue REST（{SUPABASE_URL}/auth/v1/*）；
 * - 令牌校验：调用 GoTrue 的 /auth/v1/user（用 access token 换取用户）。
 *
 * 为什么不在本地校验 JWT 签名：新版 Supabase 项目可能使用**非对称签名密钥**，
 * 本地按 HS256 + JWT Secret 验签会失败（表现为「登录成功但评论/点赞 401 未登录」）。
 * 交给 GoTrue 校验则与签名算法无关，永不失效。
 *
 * 环境变量：
 *   SUPABASE_URL        项目地址（完整 URL，如 https://xxxx.supabase.co）
 *   SUPABASE_ANON_KEY   anon / publishable（公开）key
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY);
}

/** 未配置时给出可读错误（避免裸 undefined 请求） */
function requireConfig() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置：请设置 SUPABASE_URL / SUPABASE_ANON_KEY");
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
 * 校验 Supabase access token：调 GoTrue 的 /auth/v1/user。
 * 与签名算法无关（兼容 HS256 legacy secret 与新版非对称签名密钥），
 * 失败抛 Error("无效的令牌")。
 */
export async function verifyAccessToken(token: string): Promise<AppUser> {
  try {
    const json = await authFetchWithToken(token, "/user");
    const user = mapUser(json as never);
    if (!user) throw new Error("无效的令牌");
    return user;
  } catch (e) {
    if (e instanceof Error && e.message === "Supabase 未配置：请设置 SUPABASE_URL / SUPABASE_ANON_KEY") {
      throw e;
    }
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
