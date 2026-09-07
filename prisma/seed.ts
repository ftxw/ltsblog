import { prisma } from "../app/lib/prisma";
import { siteConfigDefs } from "../app/lib/site-config-defs";

/**
 * 数据填充（仅站点配置默认值）。
 *
 * 注意：管理员账号不再由 seed 创建 —— 登录身份已切换为 Supabase Auth，
 * 管理员由环境变量 ADMIN_EMAIL 在登录时实时判定（见 app/lib/supabase.ts）。
 */
async function main() {
  // 创建默认站点配置（数据源为 app/lib/site-config-defs.ts）
  const siteConfigs = siteConfigDefs.map((def) => ({
    key: def.key,
    value: def.defaultValue,
    description: def.description,
  }));

  // 只在记录不存在时插入默认值——保留用户在后台对已存在配置（如
  // useGradient / bgImages / themeColors 等）的修改，避免每次部署被覆盖。
  for (const cfg of siteConfigs) {
    const existing = await prisma.siteConfig.findUnique({ where: { key: cfg.key } });
    if (!existing) {
      await prisma.siteConfig.create({ data: cfg });
    }
  }

  console.log("Seed completed: default site configs created.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
