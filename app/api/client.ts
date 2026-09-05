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

/** 匿名评论/点赞的身份令牌（统一入口，供前台 API 客户端使用） */
export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("anonymous_token") || "";
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
