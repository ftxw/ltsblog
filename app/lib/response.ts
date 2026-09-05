/**
 * 浏览器端请求辅助（前后台 fetch 封装共用）。
 *
 * 原先后台 components/admin/lib.ts 与前台 app/api/client.ts 各自实现了
 * 「Content-Type 头构造」和「从非 2xx 响应解析错误信息」，逻辑几乎相同。
 * 统一收口到本文件：
 * - jsonHeadersFor(body)：body 是 FormData / 无 body 时不强制 JSON 头
 * - errorText(res)：从响应（优先 JSON message/error，其次状态码）解析错误
 */

/** 根据请求体决定是否注入 JSON Content-Type（FormData/无 body 不加） */
export function jsonHeadersFor(body: unknown): Record<string, string> {
  if (body === undefined || body === null) return {};
  if (typeof FormData !== "undefined" && body instanceof FormData) return {};
  return { "Content-Type": "application/json" };
}

/** 从非 2xx 响应解析人类可读错误信息（尽力而为，绝不抛错） */
export async function errorText(res: Response): Promise<string> {
  const fallback = `请求失败（${res.status}）`;
  try {
    const json = (await res.json()) as
      | { message?: unknown; error?: unknown }
      | null;
    const msg = json && (json.message || json.error);
    if (typeof msg === "string" && msg.trim()) return msg;
    return fallback;
  } catch {
    return fallback;
  }
}
