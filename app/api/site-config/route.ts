import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { getDbSiteConfig, clearSiteConfigCache } from "@/app/lib/site-config-db";
import { invalidateAllPublicCaches } from "@/app/lib/api-cache";

// 强制动态渲染，不缓存任何内容
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 走内存缓存（600s TTL）：一页多个组件并发拉取 site-config 时只查一次库
    const decoded = await getDbSiteConfig();

    // 安全：accessKey/secretKey 是 S3 私钥，绝不能下发给匿名访客。
    // 后台编辑器走 /api/site-config/list（已 requireAdmin）拿到全量，此接口
    // 只服务前台展示（标题/主题/图床域名等），一律过滤敏感键。
    const publicConfig = { ...decoded };
    delete publicConfig.accessKey;
    delete publicConfig.secretKey;
    return NextResponse.json(publicConfig, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (e) {
    console.error("[site-config] 读取失败:", e instanceof Error ? e.message : e);
    // 数据库异常时返回空对象（客户端回退静态 siteConfig），不抛裸 500
    return NextResponse.json({}, { status: 200 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as Record<string, unknown>;

    // 只收集字符串值（与旧实现一致，忽略非字符串字段）
    const keys: string[] = [];
    const values: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string") continue;
      keys.push(key);
      values.push(value);
    }

    if (keys.length > 0) {
      // 单条语句批量 upsert（Postgres INSERT ... ON CONFLICT），替代原来
      // 逐 key 串行 upsert —— 保存一组配置由 N 次往返降为 1 次。
      // 新增行 description 置空（与旧 create 行为一致）；已存在的行只更新
      // value 与 updated_at，不覆盖 description。
      await prisma.$executeRaw`
        INSERT INTO "site_config" ("key", "value", "description", "updated_at")
        SELECT src."key", src."value", ''::varchar(1024), now()
        FROM UNNEST(${keys}::text[], ${values}::text[]) AS src("key", "value")
        ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now()
      `;
    }

    // 回读本次保存的完整行，保持与旧响应相同的 data 形状（全量配置记录）
    const data = keys.length
      ? await prisma.siteConfig.findMany({
          where: { key: { in: keys } },
          orderBy: { key: "asc" },
        })
      : [];

    clearSiteConfigCache();
    invalidateAllPublicCaches();
    return NextResponse.json({ code: 0, message: "success", data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    if (message === "需要管理员权限") {
      return NextResponse.json({ code: 1, message }, { status: 403 });
    }
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
