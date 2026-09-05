// siteConfig.ts - 全站配置中心（前端兜底配置，优先使用数据库中的站点配置）

export const siteConfig = {
  // 网站标题与博主信息
  title: "My Blog",
  url: "https://example.com/",
  authorName: "Admin",
  bio: "欢迎来到我的博客",

  // 顶部导航 Logo（三段式：标题 + 分隔符 + 后缀）
  navTitle: "",
  navSuffix: "の",
  navAfter: "宝藏之地",

  // 头像设置（空字符串时组件会用本地 hong.jpg 作为默认头像）
  avatarUrl: "/images/hong.jpg",

  // 背景设置
  useGradient: true,
  themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"],
  bgImages: ["/images/2.webp"],

  // 默认封面图
  defaultPostCover: "/images/default.avif",

  // 云音乐配置（网易云音乐）
  cloudMusicPlaylistId: "",
  cloudMusicIds: [],
  // 网易云音乐 API 地址（Meting 兼容格式），留空使用默认公共 API（https://music.3e0.cn/）；
  // 公共 API 不稳定时可自建后在此配置（如 https://your-api.com/meting/api）
  cloudMusicApiUrl: "",

  // 后端 API 地址
  apiBaseUrl: "",

  // 技能 Logo 图片（数组，前台最多展示 5 张，纯展示无链接）
  socialLogos: [] as string[],

  // 站点信息
  buildDate: "2026-06-26T00:00:00",
  // 备案信息：全部以后台数据库为准（icp_name/icp_link、gongan_name/gongan_link），此处仅作类型参考
  icpConfig: {
    name: "",
    link: "",
  },
  gonganIcpConfig: {
    name: "",
    link: "",
  },
};
