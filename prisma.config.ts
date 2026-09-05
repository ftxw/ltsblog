import "dotenv/config";
import { defineConfig } from "prisma/config";

// 数据库连接策略（Supabase / 其它 Postgres 统一适用）：
// - 应用运行时（Prisma Client）：只依赖 DATABASE_URL = Transaction pooler（6543），
//   见 app/lib/prisma.ts，连接直接使用该串，不做任何降级。
// - Prisma CLI 的 DDL（db push / migrate / seed）：必须在直连/会话池(5432)上执行，
//   事务池(6543) 不支持 DDL。这里优先取 DIRECT_URL（可选），否则自动把
//   DATABASE_URL 的 6543 降级为 5432。
//   因此线上环境只需配置 DATABASE_URL 一个变量，构建期 DDL 也能正常工作；
//   DIRECT_URL 仅在需要独立直连串（如 Supabase Direct connection）时按需追加。
function cliDdlUrl(): string {
  const direct = (process.env.DIRECT_URL || "").trim();
  if (direct) return direct;
  const url = (process.env.DATABASE_URL || "").trim();
  return url.includes(":6543/") ? url.replace(":6543/", ":5432/") : url;
}

export default defineConfig({
  // 数据填充命令（替代已弃用的 package.json#prisma.seed）
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  // 提供 datasource URL（config 文件存在时 Prisma 不再自动加载 .env）
  datasource: {
    url: cliDdlUrl(),
  },
});
