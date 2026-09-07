import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import {
  siteConfigDefs,
  siteConfigGroups,
} from "@/app/lib/site-config-defs";

// 站点配置 schema（代码驱动）：返回后台可编辑的配置项定义与分组
// 后台站点配置页按分组展示与编辑。
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ groups: siteConfigGroups, defs: siteConfigDefs });
  } catch (err: unknown) {
    console.error("Get site config schema error:", err);
    const message = err instanceof Error ? err.message : "获取配置定义失败";
    return NextResponse.json(
      { code: 1, message },
      { status: message === "未登录" || message === "无效的令牌" ? 401 : 500 }
    );
  }
}
