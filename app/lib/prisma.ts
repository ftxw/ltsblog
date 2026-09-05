import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * 数据库连接（PostgreSQL / Supabase）
 * - 使用 @prisma/adapter-pg 驱动（node-postgres）。
 * - DATABASE_URL 应配置为 Supabase **Transaction pooler（Supavisor 事务池，端口 6543）**：
 *   serverless 下大量短连接实例会互相抢占连接，事务池把客户端连接复用为少量后端连接，
 *   不会打满 Postgres 连接上限。Session pooler / 直连（5432）由多个函数实例 × 每实例
 *   连接池叠加后极易耗尽连接 → 全站间歇性无响应（卡死几十秒后随连接释放自动恢复）。
 * - 建表/迁移（DDL）不受事务池支持，走 DIRECT_URL（5432 直连/会话池），见 prisma.config.ts
 *   与 scripts/ensure-db.mjs。
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL 未配置");
  }
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(
      "DATABASE_URL 不是 PostgreSQL 连接串（如 postgresql://user:pass@host:5432/dbname）"
    );
  }
  // 博客是低频应用，但首页会并发发起约 6-8 个查询；走事务池后服务端连接由
  // Supavisor 复用，本地池可适度放大以容纳页面级并发，避免查询排队。
  // 加连接/空闲/语句超时让请求快速失败而非无限等待：
  // （宁可一次请求报错，也不让排队请求占满函数实例导致同实例其它路由 502）。
  const adapter = new PrismaPg({
    connectionString: url, // 原样使用（事务池 6543 或自建 PG 均直连，不再强制降级端口）
    max: 10,
    connectionTimeoutMillis: 8000, // 8s 拿不到连接直接报错
    idleTimeoutMillis: 120000, // 空闲连接 120s 回收：缩短为 30s 会让「实例活着但闲置 >30s」的首个查询
    // 重新走 TCP+TLS 握手（实测会叠加数百 ms~1s+ 的冷连接延迟）。博客经 Supabase 事务池(6543)
    // 复用服务端连接，实例闲置 2 分钟内保持连接是无害的；实例被平台回收后连接自然释放。
    query_timeout: 15000, // 单条查询 15s 上限（默认行为 pg 无限制）
    statement_timeout: 15000, // 服务端语句 15s 上限，防止慢查询拖死连接
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * 生产环境同样必须挂到 globalThis。
 *
 * 早期只在 dev 下缓存，是因为开发时 HMR 会反复求值模块。但 Next.js 在
 * App Router 下会为「RSC 渲染」和「Route Handler」等场景产出多份 server bundle，
 * 生产环境同样可能多次求值本模块 —— 每求值一次就新建一个 PrismaClient，
 * 也就新建了一个 max=5 的连接池。几个实例叠加起来很快就会把 Postgres
 * （尤其 Supabase 免费版）的连接数打满，之后所有查询都在等连接 → 全站卡死。
 * 挂到 globalThis 可保证同一进程内全局唯一。
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

// 启动时预热数据库连接：远程 Postgres（如 Supabase）首次查询需要 TCP+TLS+认证握手，
// 冷启动可能耗时数百毫秒甚至数秒。常驻 Node 服务器启动即建立连接，首次请求不再等待握手。
void prisma.$connect().catch(() => {
  /* 连接失败静默：请求时会再次重试并返回明确错误，避免启动崩溃 */
});
