/**
 * 统一超时工具（serverless 生命线）
 *
 * 背景：部署在函数计算 / EdgeOne 这类「实例数有限、按并发计费」的环境时，
 * 一个没有超时上限的外部请求（数据库以外的任何网络调用）就可能长时间独占
 * 实例。并发一上来，新请求全部排队 => 表现就是「点击没反应、刷新也没反应，
 * 过一会又自己好了」。
 *
 * 规则：所有对外请求（HTTP / S3 / 第三方库）都必须用 withTimeout 或
 * AbortSignal.timeout 设置硬上限，宁可快速失败也不要挂住。
 */

/**
 * 给 Promise 套硬超时：超时立即 reject。
 * 注意：这不会取消底层的网络请求（除非配合 AbortSignal），
 * 但能保证调用方不再等待，从而释放函数实例。
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}
