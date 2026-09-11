// 站点配置的"权威定义"（代码驱动）：
// seed / init-config / 后台站点配置页 schema 均以本文件为唯一数据源。
// 新增配置键时只需在此处添加一项，并在需要读取的代码中通过
// getDbConfigValue(key, defaultValue) 或 useConfigValue(key) 使用。
// 配置项按 group 分组，后台站点配置页按分组展示与批量编辑。

/** 关于页正文默认值（原始 Markdown，含 frontmatter 封面，供前台渲染兜底） */
export const aboutContentDefaultRaw = `---
cover: "/images/2.webp"
---

## 关于本站

本站是基于 [Starhiro](https://github.com/Xinghongia) 的开源博客项目进行二次开发与个性化修改的个人博客。

## 技术栈

一个基于现代 Web 技术打造的个人空间，采用玻璃拟态设计风格，支持文章、说说、照片墙、收藏夹等多种内容形态，并配有季节特效、网易云音乐播放器、暗黑模式等交互元素。

- **内容管理：** Markdown 文章、说说动态、照片墙、项目展示
- **互动功能：** 评论系统、收藏夹
- **音乐系统：** 网易云音乐在线播放、歌词同步
- **其他功能：** 网易云音乐播放器、RSS 订阅、暗黑模式、访客统计

## 在人间

夏夜，满天星斗。奶奶讲的故事与众不同，她不是说地上死一个人，天上就熄灭了一颗星星，而是说，地上死一个人，天上就又多了一个星星。

干吗变成星星呀？

给走夜道儿的人照个亮儿……

## 相关链接

- **原项目作者 GitHub：** [github.com/Xinghongia](https://github.com/Xinghongia)
- **原项目主页：** [Starhiro の小站](https://hiromu.top)

> 基于开源，致敬原创。
`;

/** 关于页正文默认值（剥离 frontmatter 后的纯 Markdown） */
export const aboutContentDefault = aboutContentDefaultRaw.replace(/^---[\s\S]*?---\n?/, "");

export type SiteConfigFieldType =
  | "text"
  | "textarea"
  | "switch"
  | "singleImage"
  | "multiImage"
  | "json"
  | "select";

/** 下拉选项（type=select 时使用） */
export interface SiteConfigOption {
  label: string;
  value: string;
}

/** 配置分组（后台按此分组展示与编辑） */
export interface SiteConfigGroup {
  id: string;
  label: string;
  description?: string;
}

export interface SiteConfigDef {
  key: string;
  label: string;
  type: SiteConfigFieldType;
  description: string;
  defaultValue: string;
  /** 所属分组 id，对应 siteConfigGroups 中的 id */
  group: string;
  /** type=select 时的选项列表 */
  options?: SiteConfigOption[];
}

export const siteConfigGroups: SiteConfigGroup[] = [
  {
    id: "siteInfo",
    label: "站点信息",
    description: "网站标题、导航 Logo 与建站日期",
  },
  {
    id: "site",
    label: "站点配置",
    description: "整体视觉风格与背景特效",
  },
  {
    id: "basic",
    label: "作者信息",
    description: "作者昵称、简介、头像与技能 logo",
  },
  {
    id: "music",
    label: "音乐设置",
    description: "云音乐歌单 / 单曲与播放 API",
  },
  {
    id: "imageHost",
    label: "图床设置",
    description: "S3 兼容对象存储（R2 / 缤纷云 / OSS / COS / MinIO 等）作为图床，私有桶 + 代理访问",
  },
  {
    id: "about",
    label: "关于页",
    description: "关于页封面与正文内容（正文为 Markdown，建议在「内容管理 → 关于页」中编辑）",
  },
  {
    id: "icp",
    label: "备案信息",
    description: "ICP 备案与公安备案",
  },
];

export const siteConfigDefs: SiteConfigDef[] = [
  // ===== 站点信息 =====
  { key: "title", label: "网站标题", type: "text", description: "浏览器标签页与导航栏标题", defaultValue: "My Blog", group: "siteInfo" },
  { key: "url", label: "网站地址", type: "text", description: "用于 RSS 等场景（如 https://example.com/）", defaultValue: "https://example.com/", group: "siteInfo" },
  { key: "authorName", label: "作者名", type: "text", description: "博主昵称", defaultValue: "Admin", group: "basic" },
  { key: "bio", label: "个人简介", type: "textarea", description: "首页卡片与关于页展示的简介", defaultValue: "欢迎来到我的博客", group: "basic" },
  { key: "avatarUrl", label: "头像", type: "singleImage", description: "头像图片地址（空则使用默认）", defaultValue: "/images/hong.jpg", group: "basic" },
  { key: "socialLogos", label: "技能 Logo", type: "multiImage", description: "上传技能 logo 图片，前台展示（最多 5 张，上传几张显示几张，纯展示无链接）", defaultValue: "[]", group: "basic" },
  { key: "navTitle", label: "导航标题", type: "text", description: "顶部导航 Logo 标题（留空使用作者名）", defaultValue: "", group: "siteInfo" },
  { key: "navSuffix", label: "分隔符", type: "text", description: "Logo 中间的分隔符（默认の）", defaultValue: "の", group: "siteInfo" },
  { key: "navAfter", label: "导航后缀", type: "text", description: "Logo 后段文字（默认宝藏之地）", defaultValue: "宝藏之地", group: "siteInfo" },
  { key: "buildDate", label: "建站日期", type: "text", description: "建站日期（ISO 格式，如 2026-06-26T00:00:00）", defaultValue: "2026-06-26T00:00:00", group: "siteInfo" },

  // ===== 站点配置（视觉风格）=====
  { key: "useGradient", label: "渐变背景", type: "switch", description: "是否使用渐变背景", defaultValue: "false", group: "site" },
  { key: "themeColors", label: "主题颜色", type: "json", description: "主题颜色数组（JSON），如 [\"#a18cd1\",\"#fbc2eb\"]", defaultValue: JSON.stringify(["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"]), group: "site" },
  { key: "bgImages", label: "背景图片", type: "multiImage", description: "背景图片地址数组（JSON）", defaultValue: JSON.stringify(["/images/2.webp"]), group: "site" },
  { key: "defaultPostCover", label: "文章默认封面", type: "singleImage", description: "文章未设置封面时使用", defaultValue: "/images/default.avif", group: "site" },
  { key: "themeMode", label: "默认主题", type: "select", description: "访客首次访问（未手动切换过主题）时使用的主题，默认夜晚", defaultValue: "dark", group: "site", options: [
    { label: "夜晚（暗色）", value: "dark" },
    { label: "白天（亮色）", value: "light" },
    { label: "跟随系统", value: "system" },
  ] },

  // ===== 音乐设置 =====
  { key: "cloudMusicApiUrl", label: "Meting 格式 API 地址", type: "text", description: "Meting 格式 API 地址，留空使用公共 API", defaultValue: "", group: "music" },
  { key: "cloudMusicPlaylistId", label: "网易云歌单 ID", type: "text", description: "网易云音乐歌单 ID（留空不显示歌单）", defaultValue: "", group: "music" },
  { key: "cloudMusicIds", label: "网易云歌曲 ID", type: "json", description: "网易云音乐歌曲 ID 数组（JSON）", defaultValue: "[]", group: "music" },

  // ===== 图床设置（S3 兼容）=====
  { key: "endpoint", label: "EndPoint 端点", type: "text", description: "S3 兼容服务端点，如 R2：https://<account-id>.r2.cloudflarestorage.com", defaultValue: "", group: "imageHost" },
  { key: "region", label: "Region 区域", type: "text", description: "区域标识：R2 填 auto，其他服务按服务商要求（如 us-east-1）", defaultValue: "", group: "imageHost" },
  { key: "bucket", label: "Bucket 桶名", type: "text", description: "存储桶名称（如 my-bucket），必填", defaultValue: "", group: "imageHost" },
  { key: "accessKey", label: "Access Key ID", type: "text", description: "API 访问密钥 ID（R2 在 Manage R2 API Tokens 创建），必填", defaultValue: "", group: "imageHost" },
  { key: "secretKey", label: "Secret Access Key", type: "text", description: "API 访问密钥（敏感，仅服务器可见），必填", defaultValue: "", group: "imageHost" },
  { key: "imageCdnDomain", label: "图床访问域名（可选）", type: "text", description: "填写后图片直链走该域名（对象存储/CDN，不经博客代理），如 https://img.example.com；留空则维持代理模式（私有桶 + /api/img-proxy 中转）。需先在存储服务侧把桶绑定该域名并放行访问", defaultValue: "", group: "imageHost" },

  // ===== 关于页 =====
  { key: "aboutCover", label: "关于页封面", type: "singleImage", description: "关于页顶部大图（空则使用默认）", defaultValue: "/images/2.webp", group: "about" },
  { key: "aboutContent", label: "关于页正文", type: "textarea", description: "关于页正文内容（Markdown 格式）", defaultValue: aboutContentDefault, group: "about" },

  // ===== 备案信息 =====
  { key: "icp_name", label: "ICP 备案号", type: "text", description: "ICP 备案号（留空不显示）", defaultValue: "", group: "icp" },
  { key: "icp_link", label: "ICP 备案链接", type: "text", description: "ICP 备案查询链接", defaultValue: "", group: "icp" },
  { key: "gongan_name", label: "公安备案号", type: "text", description: "公安备案号（留空不显示）", defaultValue: "", group: "icp" },
  { key: "gongan_link", label: "公安备案链接", type: "text", description: "公安备案查询链接", defaultValue: "", group: "icp" },
];
