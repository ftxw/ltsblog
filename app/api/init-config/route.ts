import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { siteConfigDefs } from "@/app/lib/site-config-defs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const siteConfigs = siteConfigDefs.map((def) => ({
      key: def.key,
      value: def.defaultValue,
      description: def.description,
    }));

    // 批量补齐缺失键（三次固定语句，替代原来的「每 key 查一次 + 建一次」）
    // 1) 一次查出已存在的 key
    const existingRows = await prisma.siteConfig.findMany({
      where: { key: { in: siteConfigs.map((c) => c.key) } },
      select: { key: true },
    });
    const existingSet = new Set(existingRows.map((r) => r.key));

    // 2) 只创建缺失的
    const missing = siteConfigs.filter((c) => !existingSet.has(c.key));
    let created = 0;
    if (missing.length > 0) {
      // skipDuplicates 兜底并发初始化时重复创建（唯一约束冲突被跳过）
      const res = await prisma.siteConfig.createMany({
        data: missing,
        skipDuplicates: true,
      });
      created = res.count;
    }

    // 只做「补齐缺失键」，不做删除：避免误删历史/自定义配置
    const skipped = siteConfigs.length - created;
    return NextResponse.json({
      code: 0,
      message: "站点配置初始化完成",
      created,
      skipped,
    });
  } catch (err: unknown) {
    console.error("Init config error:", err);
    const message = err instanceof Error ? err.message : "初始化失败";
    return NextResponse.json(
      { code: 1, message },
      { status: message === "未登录" || message === "无效的令牌" ? 401 : 500 }
    );
  }
}
