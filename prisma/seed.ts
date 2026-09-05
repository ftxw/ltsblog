import bcrypt from "bcryptjs";
import { prisma } from "../app/lib/prisma";
import { siteConfigDefs } from "../app/lib/site-config-defs";

async function main() {
  // 创建 admin 用户（部署后请立即修改默认密码）
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { nickname: "Admin" },
    create: {
      username: "admin",
      hashed_password: adminPassword,
      nickname: "Admin",
      is_admin: true,
    },
  });

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

  console.log("Seed completed: admin user and default site configs created.");
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
