// 构建期数据库自动初始化脚本
// 逻辑：
//  1. 检测目标数据库中是否已有数据表（以 post 表为准）
//  2. 已初始化 → 跳过，直接进入构建（快速且不依赖网络稳定）
//  3. 未初始化（首次部署/新数据库）→ 自动执行 prisma db push + seed
//
// 注意：之后如果 Prisma schema 新增了模型/字段，需要本地手动执行 `pnpm db:push` 同步，
//       本脚本只在"表不存在"时初始化，不会检测 schema 差异。
import { execSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;

/**
 * Supabase pooler：6543 = 事务连接池（不适合 DDL），5432 = 直连/会话池。
 * Prisma db push（建表/改 schema）在事务池上会一直挂起，必须在直连上执行。
 * 两个端口同 host 同账号，仅改端口即可；其它宿主（自建 PG 等）原样使用。
 */
function toDirectUrl(u) {
  return u.includes(":6543/") ? u.replace(":6543/", ":5432/") : u;
}

// DDL / 建表探测必须走直连：
// 优先用 DIRECT_URL（Supabase Session pooler 5432），否则对 DATABASE_URL 降级端口兜底。
const _rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!_rawUrl) {
  console.log("[ensure-db] DATABASE_URL/DIRECT_URL not set, skip DB check.");
  process.exit(0);
}
const url = toDirectUrl(_rawUrl);

async function main() {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    const res = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post'"
    );
    await client.end();

    if (res.rowCount > 0) {
      console.log("[ensure-db] Database already initialized, skip push/seed.");
      return;
    }

    console.log("[ensure-db] Database not initialized, running db push + seed...");
    // 统一覆盖为直连地址，让 prisma db push / db seed 都走 5432（事务池无法执行 DDL）
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    execSync("pnpm db:push && pnpm db:seed", { stdio: "inherit", shell: process.platform === "win32" });
    console.log("[ensure-db] Database initialized.");
  } catch (e) {
    console.error("[ensure-db] Failed to reach/initialize database:", e.message);
    process.exit(1);
  }
}

main();
