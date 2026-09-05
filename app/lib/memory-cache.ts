/**
 * 进程内内存缓存（默认 60s TTL + 写操作主动失效）
 *
 * 设计说明：
 * - 用于缓解公开只读接口的数据库访问频率：同一 URL 在 TTL 内只查一次库。
 * - 写入接口在成功写库后调用 invalidateXxx 主动清缓存，保证"发布/修改后立即生效"。
 * - 部署注意：若存在多实例，各实例缓存相互独立，写入只会失效当前实例，
 *   其他实例最坏 TTL 后自动过期。个人博客单实例场景可完全满足需求。
 */

type CacheEntry = { data: unknown; expiresAt: number };

const store = new Map<string, CacheEntry>();

/** 每个命名空间最多缓存的 key 数量，超出后整体清空该命名空间，防止内存无限增长 */
const MAX_KEYS_PER_NAMESPACE = 200;

function fullKey(namespace: string, key: string) {
  return `${namespace}::${key}`;
}

/** 读取缓存；未命中或已过期返回 undefined（缓存值本身不会是 undefined） */
export function memoryCacheGet<T>(namespace: string, key: string): T | undefined {
  const k = fullKey(namespace, key);
  const entry = store.get(k);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(k);
    return undefined;
  }
  return entry.data as T;
}

/** 写入缓存；data 为 undefined 时不缓存 */
export function memoryCacheSet<T>(namespace: string, key: string, data: T, ttlMs = 60_000): void {
  if (data === undefined) return;
  const k = fullKey(namespace, key);

  if (!store.has(k)) {
    // 防内存膨胀：该命名空间 key 数量达到上限时，淘汰**最老的一个** key。
    // 早期实现是「达到上限就整体清空该命名空间」，这会人为制造缓存雪崩 ——
    // 所有 key 同时消失，下一个瞬间全部并发回源（打库 / 打外网），
    // 正是「卡一阵子又自己好」的典型触发点。
    const prefix = `${namespace}::`;
    let count = 0;
    let oldestKey: string | null = null;
    for (const existing of store.keys()) {
      if (!existing.startsWith(prefix)) continue;
      count += 1;
      // Map 保持插入顺序，第一个匹配到的就是最老的（未被覆盖过的）key
      if (oldestKey === null) oldestKey = existing;
    }
    if (count >= MAX_KEYS_PER_NAMESPACE && oldestKey !== null) {
      store.delete(oldestKey);
    }
  }

  store.set(k, { data, expiresAt: Date.now() + ttlMs });
}

/** 清空某个命名空间下的全部缓存 */
export function invalidateMemoryCache(namespace: string): void {
  const prefix = `${namespace}::`;
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

/** 按命名空间前缀批量清空 */
export function invalidateMemoryCacheNamespaces(namespaces: string[]): void {
  if (!namespaces.length) return;
  for (const k of [...store.keys()]) {
    for (const namespace of namespaces) {
      if (k.startsWith(`${namespace}::`)) {
        store.delete(k);
        break;
      }
    }
  }
}

/** 清空全部缓存（站点配置等全局改动时使用） */
export function clearAllMemoryCache(): void {
  store.clear();
}
