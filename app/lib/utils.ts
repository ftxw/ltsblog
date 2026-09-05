/**
 * JSON 字符串安全解析：null/空串/解析失败时返回 fallback，永不抛错。
 * 服务端与客户端通用（无 Node 依赖）。
 */
export function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === undefined || raw === null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 把存成 JSON 数组字符串的字段解析为 string[]（非法/非数组返回 fallback） */
export function parseStringArray(
  raw: string | null | undefined,
  fallback: string[] = []
): string[] {
  const parsed = safeParseJson<unknown>(raw, null);
  return Array.isArray(parsed)
    ? parsed.filter((x): x is string => typeof x === "string")
    : fallback;
}

/**
 * 从请求头解析客户端真实 IP。
 * 优先级：EO-Connecting-IP（EdgeOne 回源默认携带的客户端真实 IP，最可靠）
 * → X-Forwarded-For 首值 → X-Real-IP。
 * 实测 Pages 注入：EO-Connecting-IP=客户端公网 IP；X-Real-IP=腾讯内部节点，不可用。
 */
export function getClientIp(request: Request): string {
  const eo = request.headers.get("eo-connecting-ip");
  if (eo && eo.trim() && eo.trim() !== "unknown") {
    return eo.trim();
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
