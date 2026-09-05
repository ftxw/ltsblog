import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getDbConfigValue } from "@/app/lib/site-config-db";

/**
 * 通用 S3 兼容图床（Cloudflare R2 / 缤纷云 S4 / 阿里 OSS / 腾讯 COS / MinIO 等均可）。
 *
 * 架构（私有桶 + 代理）：
 * - 上传：PutObject 写入私有桶（服务器中转）
 * - 访问：统一走博客 /api/img-proxy/imgs/{key} 代理，不暴露公网直链
 *   （私有桶无公开 URL，且流量算在博客侧，避免被刷出流量账单）
 * - 删除：DeleteObject
 *
 * 配置（后台「站点配置」优先，环境变量兜底）：
 *   - endpoint    S3 兼容端点（如 R2：https://<account-id>.r2.cloudflarestorage.com）
 *   - bucket      桶名
 *   - accessKey   Access Key ID
 *   - secretKey   Secret Access Key
 *   - region      区域（R2 填 auto；其他服务按服务商要求）
 * 环境变量兜底：S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY / S3_REGION
 */

const DEFAULT_REGION = "us-east-1";

/**
 * 所有 S3 操作的硬超时（毫秒）。
 *
 * AWS SDK v3 默认 *没有* 请求超时，且默认重试 3 次（带指数退避）。
 * 一旦图床端点不可达 / 半开连接，client.send() 可以无限期挂住 ——
 * 而 img-proxy 是 force-dynamic，每张图片每次访问都真打一次 S3。
 * 照片墙一页几十张图，几十个挂死请求足以占满全部函数实例，
 * 表现为「整站点不动，过一会又恢复」。
 */
const S3_TIMEOUT_MS = 5_000;
/** 失败重试次数：默认 3 次会把最坏耗时放大 3 倍，压到 1 次重试 */
const S3_MAX_ATTEMPTS = 2;

export interface S3ImageHostConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  /**
   * 图床公网访问域名（可选，含协议，如 https://img.example.com）。
   * 填写后图片 URL 直接使用该域名直链（走对象存储/CDN，不经博客代理）；
   * 留空则维持 /api/img-proxy/... 代理模式。
   * 直链对象默认仍按同约定生成 thumb/ 缩略图（见 thumbKeyOf）。
   */
  imageCdnDomain: string;
}

let cachedClient: S3Client | null = null;

export async function getS3ImageHostConfig(): Promise<S3ImageHostConfig> {
  const [endpoint, bucket, accessKey, secretKey, region, imageCdnDomain] =
    await Promise.all([
      getDbConfigValue("endpoint", process.env.S3_ENDPOINT || ""),
      getDbConfigValue("bucket", process.env.S3_BUCKET || ""),
      getDbConfigValue("accessKey", process.env.S3_ACCESS_KEY || ""),
      getDbConfigValue("secretKey", process.env.S3_SECRET_KEY || ""),
      getDbConfigValue("region", process.env.S3_REGION || ""),
      getDbConfigValue("imageCdnDomain", process.env.IMAGE_CDN_DOMAIN || ""),
    ]);
  return { endpoint, bucket, accessKey, secretKey, region, imageCdnDomain: imageCdnDomain.trim().replace(/\/+$/, "") };
}

/** 是否已配置 S3 图床 */
export async function isS3Configured(): Promise<boolean> {
  const cfg = await getS3ImageHostConfig();
  return Boolean(cfg.endpoint && cfg.bucket && cfg.accessKey && cfg.secretKey);
}

function createClient(cfg: S3ImageHostConfig): S3Client {
  return new S3Client({
    region: cfg.region || DEFAULT_REGION,
    endpoint: cfg.endpoint,
    forcePathStyle: true, // 自定义 S3 兼容端点通常需要路径样式（R2 官方要求）
    // 校验和仅在必需时计算：部分 S3 兼容服务（如 R2）会拒绝新版 SDK 默认的 CRC32 校验头
    requestChecksumCalculation: "WHEN_REQUIRED",
    // 限制重试次数：默认 3 次尝试 + 退避会让最坏耗时成倍放大
    maxAttempts: S3_MAX_ATTEMPTS,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
  });
}

/**
 * 统一的发送入口：每次调用都带中止信号，保证任何一次 S3 操作都不会超过
 * S3_TIMEOUT_MS。AbortSignal 会真正取消底层 HTTP 请求（而不只是让调用方不等）。
 *
 * 命令类型约束为当前文件实际使用的三种 Command；扩展命令时同步扩充联合类型。
 */
type S3Command = PutObjectCommand | GetObjectCommand | DeleteObjectCommand;

async function send(client: S3Client, command: S3Command) {
  return client.send(command, {
    abortSignal: AbortSignal.timeout(S3_TIMEOUT_MS),
  });
}

async function getClient(): Promise<S3Client> {
  const cfg = await getS3ImageHostConfig();
  if (!cachedClient) cachedClient = createClient(cfg);
  return cachedClient;
}

/** 生成唯一文件名：{timestamp}-{random}.{ext} */
export function generateFileName(ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}.${ext}`;
}

/** 生成对象键：直接用文件名（不带前缀，与 img-proxy 的路径提取逻辑一致） */
export function generateKey(filename: string): string {
  return filename;
}

/**
 * 约定式缩略图对象 key：在原对象路径的文件名前插入 thumb/。
 * 例：albums/3/a.jpeg → albums/3/thumb/a.jpeg；system/a.jpeg → system/thumb/a.jpeg
 * （缩略图放在各自内容目录下的 thumb/ 子目录，而非集中在一个顶层目录）
 */
export function thumbKeyOf(key: string): string {
  const idx = key.lastIndexOf("/");
  if (idx === -1) return `thumb/${key}`;
  return `${key.slice(0, idx)}/thumb/${key.slice(idx + 1)}`;
}

export interface S3UploadResult {
  /** 图片可访问 URL（/api/img-proxy/imgs/{key} 相对地址） */
  url: string;
  /** 对象键（存 image_upload 表，删除时按 key 删） */
  key: string;
}

/**
 * 上传图片到 S3 兼容私有桶（原图原格式，不做压缩/转换）。
 * 未配置时抛出明确错误。
 */
export async function uploadImageToS3(
  fileBuffer: ArrayBuffer,
  filename: string,
  contentType: string
): Promise<S3UploadResult> {
  const cfg = await getS3ImageHostConfig();
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKey || !cfg.secretKey) {
    throw new Error(
      "S3 图床未配置：请在后台「站点配置」填写 endpoint / bucket / accessKey / secretKey（或设置环境变量 S3_ENDPOINT 等）"
    );
  }
  const key = generateKey(filename);
  const client = await getClient();
  await send(
    client,
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: new Uint8Array(fileBuffer),
      ContentType: contentType,
    })
  );
  // 直链模式：URL 用 CDN/对象存储域名（图不经过博客函数）；
  // 代理模式：维持 /api/img-proxy/imgs/{key}（私有桶由服务器中转）
  const url = cfg.imageCdnDomain
    ? `${cfg.imageCdnDomain}/${key}`
    : `/api/img-proxy/imgs/${key}`;
  return { url, key };
}

/**
 * 从 S3 兼容存储读取图片（供 img-proxy 使用）。
 * 未命中（对象不存在）返回 null。
 */
export async function getImageFromS3(key: string): Promise<{
  body: ReadableStream | null;
  contentType: string;
} | null> {
  try {
    const cfg = await getS3ImageHostConfig();
    if (!cfg.bucket) return null;
    const client = await getClient();
    const obj = await send(
      client,
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key })
    ) as { Body?: unknown; ContentType?: string };
    if (!obj.Body) return null;
    return {
      body: obj.Body as unknown as ReadableStream,
      contentType: obj.ContentType || "application/octet-stream",
    };
  } catch {
    // NoSuchKey / 403 / 网络错误等统一视为未命中
    return null;
  }
}

/** 从 S3 兼容存储删除图片（尽力而为） */
export async function deleteImageFromS3(key: string): Promise<boolean> {
  try {
    const cfg = await getS3ImageHostConfig();
    if (!cfg.bucket) return false;
    const client = await getClient();
    await send(client, new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return true;
  } catch (e) {
    console.warn("[s3-image-host] 删除失败:", (e as Error).message);
    return false;
  }
}

/**
 * 按图片 URL 删除（统一删除入口）：优先用记录的 key（asset_id），
 * 否则从 /api/img-proxy/imgs/{key} URL 提取 key。
 * 原图与约定式缩略图（内容目录 thumb/ 子目录）一并删除。
 */
export async function deleteImageByUrl(
  imageUrl: string,
  key?: string
): Promise<boolean> {
  let k = key || null;
  if (!k) {
    const proxyMatch = imageUrl.match(/\/api\/img-proxy\/imgs\/(.+)$/);
    if (proxyMatch) k = proxyMatch[1];
    else {
      // 直链模式：{imageCdnDomain}/{key}
      const cfg = await getS3ImageHostConfig().catch(() => null);
      const domain = cfg?.imageCdnDomain;
      if (domain && imageUrl.startsWith(`${domain}/`)) {
        k = imageUrl.slice(domain.length + 1);
      }
    }
  }
  if (!k) return false;
  const results = await Promise.allSettled([
    deleteImageFromS3(k),
    deleteImageFromS3(thumbKeyOf(k)),
  ]);
  return results[0].status === "fulfilled" && results[0].value;
}

/** 批量删除时的并发上限：避免一次打开上百条连接把本实例（和函数并发额度）打满 */
const DELETE_CONCURRENCY = 8;

/** 带并发上限的 map，顺序无关、永不抛错 */
async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<unknown>
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        await fn(items[idx]);
      } catch {
        // 单个失败忽略
      }
    }
  });
  await Promise.all(workers);
}

/**
 * 批量按 URL 删除图床文件（原图 + 约定式缩略图）。
 *
 * 尽力而为 + 有界执行：
 * - 并发上限 DELETE_CONCURRENCY，避免一次打出上百个 S3 请求；
 * - 每次请求都有 S3_TIMEOUT_MS 硬超时；
 * - 返回成功删除的 URL 数量，失败不影响调用方。
 */
export async function deleteImagesByUrls(
  urls: string[],
  keyOf?: (url: string) => string | undefined
): Promise<number> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return 0;

  // 先批量查出对象 key（一次查询，而非每个 URL 查一次）
  let keyMap = new Map<string, string>();
  try {
    const { prisma } = await import("./prisma");
    const recs = await prisma.imageUpload.findMany({
      where: { url: { in: unique } },
      select: { url: true, asset_id: true },
    });
    keyMap = new Map(recs.map((r) => [r.url, r.asset_id]));
  } catch (e) {
    console.warn("[s3-image-host] 查询 image_upload 失败，按 URL 提取 key:", e);
  }

  let deleted = 0;
  await mapLimit(unique, DELETE_CONCURRENCY, async (url) => {
    const key = keyOf?.(url) || keyMap.get(url) || undefined;
    if (await deleteImageByUrl(url, key)) deleted += 1;
  });
  return deleted;
}

/** 从 Markdown 文章内容提取图片 URL（删除文章时同步清理图床文件用） */
export function extractImageUrlsFromContent(content: string): string[] {
  const urls: string[] = [];
  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/gi,
    /!\[[^\]]*\]\(([^)\s]+)\)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      const u = m[1];
      if (/^https?:\/\//i.test(u)) urls.push(u);
    }
  }
  return urls;
}
