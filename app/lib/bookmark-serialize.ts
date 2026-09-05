/**
 * 书签站点序列化工具。
 *
 * 数据库里 BookmarkSite.platforms 以字符串存 JSON，接口返回前需要解析成数组。
 * 原实现散落在 3 个 route 文件且参数为 any，这里收敛为共享工具：
 * - platforms 是合法 JSON 字符串 → 解析为数组/对象后返回新对象
 * - 非字符串或解析失败 → 返回原样对象（保持 Prisma 形状）
 *
 * 注意：返回对象与原对象引用不同（不做原地 mutation），避免给 string 类型字段
 * 赋非 string 值造成类型不一致。
 */

interface SiteLike {
  platforms?: string | null;
}

export function parseSitePlatforms<T extends SiteLike>(site: T): T {
  if (!site) return site;
  if (typeof site.platforms !== "string") return site;
  try {
    return { ...site, platforms: JSON.parse(site.platforms) };
  } catch {
    // platforms 不是合法 JSON 时保持原样
    return site;
  }
}
