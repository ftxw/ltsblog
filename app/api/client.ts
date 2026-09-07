import { siteConfig } from "@/siteConfig";
import { jsonHeadersFor, errorText } from "@/app/lib/response";

const BASE_URL = siteConfig.apiBaseUrl;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const body = (options as { body?: unknown } | undefined)?.body;
  const res = await fetch(`${BASE_URL}${path}`, {
    cache: "no-store", // 禁用 HTTP 缓存，保证发布后立即看到新数据
    ...options,
    headers: {
      // 仅 JSON 请求体加 Content-Type（FormData / GET 不加）
      ...jsonHeadersFor(body),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new ApiError(await errorText(res), res.status);
  }
  return res.json();
}

/** 前台登录（评论/点赞）身份令牌：Supabase access token，供 API 客户端使用 */
export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("anonymous_token") || "";
}

export interface CommentSessionUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
}

/** 保存前台登录会话（token + 用户信息） */
export function saveCommentSession(token: string, user: CommentSessionUser) {
  try {
    localStorage.setItem("anonymous_token", token);
    localStorage.setItem("anonymous_user", JSON.stringify(user));
  } catch {
    // ignore
  }
}

/** 读取本地保存的前台用户（无则 null） */
export function loadCommentUser(): CommentSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("anonymous_user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && typeof u.id === "string") return u as CommentSessionUser;
    // 兼容旧格式 {login, avatar}（历史匿名身份），按无效处理
    return null;
  } catch {
    return null;
  }
}

/** 清除前台登录会话 */
export function clearCommentSession() {
  try {
    localStorage.removeItem("anonymous_token");
    localStorage.removeItem("anonymous_user");
  } catch {
    // ignore
  }
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export { request, qs, ApiError, BASE_URL };
