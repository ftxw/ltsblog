import crypto from "crypto";

/**
 * EdgeOne 节点缓存按需刷新（腾讯云 API CreatePurgeTask）。
 *
 * 用途：后台发布/修改内容后，立即清掉 blog.lts.cc 上的 HTML 节点缓存，
 * 让新内容对前端即时可见，同时不影响平时的 5 分钟 HTML 缓存。
 *
 * 需要环境变量（未配置时静默跳过，不影响保存主流程）：
 * - TENCENTCLOUD_SECRET_ID  腾讯云 API 密钥 ID
 * - TENCENTCLOUD_SECRET_KEY 腾讯云 API 密钥 Key
 * - EDGEONE_ZONE_ID         EdgeOne 站点 ID（lts.cc zone）
 *
 * Vercel 已有 revalidatePath 负责自家边缘缓存，这里只负责 EdgeOne 这一层。
 */

const TEO_HOST = "teo.tencentcloudapi.com";
const TEO_SERVICE = "teo";
const TEO_VERSION = "2022-09-01";

/** 加速域名（lts.cc 站点下绑定 blog.lts.cc） */
const PUBLIC_HOST = process.env.EDGEONE_PURGE_HOST || "blog.lts.cc";

export function edgeonePurgeConfigured(): boolean {
  return Boolean(
    process.env.TENCENTCLOUD_SECRET_ID &&
      process.env.TENCENTCLOUD_SECRET_KEY &&
      process.env.EDGEONE_ZONE_ID
  );
}

/** TC3-HMAC-SHA256 签名 + 调用 CreatePurgeTask。失败只打日志，绝不抛出。 */
async function createPurgeTask(
  type: "purge_url" | "purge_prefix",
  targets: string[]
): Promise<boolean> {
  if (!edgeonePurgeConfigured() || targets.length === 0) return false;

  const secretId = process.env.TENCENTCLOUD_SECRET_ID as string;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY as string;
  const zoneId = process.env.EDGEONE_ZONE_ID as string;

  const payload = JSON.stringify({ ZoneId: zoneId, Type: type, Targets: targets });
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  // ---- TC3-HMAC-SHA256 签名 ----
  const hashedPayload = crypto.createHash("sha256").update(payload).digest("hex");
  const canonicalRequest = [
    "POST",
    "/",
    "",
    `content-type:application/json\nhost:${TEO_HOST}\n`,
    "content-type;host",
    hashedPayload,
  ].join("\n");
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    `${date}/${TEO_SERVICE}/tc3_request`,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const kDate = crypto.createHmac("sha256", `TC3${secretKey}`).update(date).digest();
  const kService = crypto.createHmac("sha256", kDate).update(TEO_SERVICE).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("tc3_request").digest();
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${date}/${TEO_SERVICE}/tc3_request, ` +
    "SignedHeaders=content-type;host, " +
    `Signature=${signature}`;

  try {
    const res = await fetch(`https://${TEO_HOST}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: TEO_HOST,
        "X-TC-Action": "CreatePurgeTask",
        "X-TC-Version": TEO_VERSION,
        "X-TC-Timestamp": String(timestamp),
        Authorization: authorization,
      },
      body: payload,
    });
    const data = (await res.json()) as { Response?: { Error?: unknown } };
    if (data?.Response?.Error) {
      console.error("[edgeone-purge] API 返回错误:", data.Response.Error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[edgeone-purge] 请求失败:", e);
    return false;
  }
}

/**
 * 按 URL 刷新（用于单篇文章的发布/更新/删除）。
 * paths 传站内路径，如 ["/", "/posts", "/posts/abc123"]。
 */
export async function purgeEdgeOneUrls(paths: string[]): Promise<boolean> {
  return createPurgeTask(
    "purge_url",
    paths.map((p) => `https://${PUBLIC_HOST}${p.startsWith("/") ? p : `/${p}`}`)
  );
}

/**
 * 按前缀刷新整个站（用于站点配置变更——配置影响所有页面的外壳）。
 * EdgeOne 前缀格式不带协议头，如 "blog.lts.cc/"。
 */
export async function purgeEdgeOneSite(): Promise<boolean> {
  return createPurgeTask("purge_prefix", [`${PUBLIC_HOST}/`]);
}
