import { prisma } from "./prisma";
import { decodeConfigMojibake } from "./mojibake";
import { singleFlight } from "./single-flight";

let cachedConfig: Record<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30秒进程内缓存兜底；Vercel ISR 页面已缓存，配置读取频率低；后台修改会 clearSiteConfigCache + revalidatePath 即时失效

/** 从数据库获取所有站点配置 */
export async function getDbSiteConfig(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  // 并发去重：站点配置几乎每个请求都要读（layout、middleware 之外的所有页面、
  // 图片代理、S3 配置等）。没有去重时，TTL 到期的瞬间所有并发请求会同时查库，
  // 而 Prisma 连接池只有 5 个连接，多余请求只能排队 8s → 整站卡顿。
  return singleFlight("site-config", async () => {
    // 进入 singleFlight 后可能已经有其它请求把缓存填好了（双重检查）
    const now2 = Date.now();
    if (cachedConfig && now2 - cacheTime < CACHE_TTL) {
      return cachedConfig;
    }

    const rows = await prisma.siteConfig.findMany();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }

    // 修复历史双重编码（如 "æ¬¢è¿æ¥å°æçåå®¢" -> "欢迎来到我的博客"）
    const decoded = decodeConfigMojibake(result);

    cachedConfig = decoded;
    cacheTime = Date.now();
    return decoded;
  });
}

/** 获取单个配置值 */
export async function getDbConfigValue(key: string, defaultValue = ""): Promise<string> {
  const config = await getDbSiteConfig();
  return config[key] ?? defaultValue;
}

/** 清除缓存（后台更新配置后调用） */
export function clearSiteConfigCache() {
  cachedConfig = null;
  cacheTime = 0;
}
