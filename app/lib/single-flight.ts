/**
 * single-flight（并发去重）
 *
 * 解决的问题：缓存 TTL 到期（或被主动 invalidate）的那一瞬间，所有并发进来的
 * 请求会同时 miss，然后**各自**执行一遍 loader。
 * - 对数据库接口：N 个并发请求 = N 倍查询量，而 Prisma 连接池只有 5 个连接，
 *   其余全部排队等待 → 表现为整站卡顿。
 * - 对外部接口（如 /api/music）：N 个并发请求 = N 个同时打向外网的请求，
 *   外网一慢就会长时间占满函数实例 → 整站点不动。
 *
 * 用法：把「可能很慢且结果可复用」的异步操作包进来，同一 key 并发时只执行一次。
 */

type Entry = { promise: Promise<unknown>; expiresAt: number };

const inflight = new Map<string, Entry>();

/**
 * 同一 key 的并发调用共享同一个 Promise；执行完（成功或失败）立即从表中移除。
 *
 * @param key 去重键
 * @param fn  真正的加载逻辑
 * @param staleMs 兜底过期时间。正常情况 fn 结束就会清除；这里防止 fn 因外部
 *                依赖挂死而永久占位，导致该 key 之后永远拿不到数据。
 */
export function singleFlight<T>(
  key: string,
  fn: () => Promise<T>,
  staleMs = 30_000
): Promise<T> {
  const existing = inflight.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.promise as Promise<T>;
  }

  const promise = fn().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, { promise, expiresAt: Date.now() + staleMs });
  return promise;
}
