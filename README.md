# lts-blog（Vercel 版）

一个基于 [Starhiro](https://github.com/Xinghongia) 开源博客项目二次开发与个性化修改的个人博客，采用玻璃拟态设计风格，支持文章、说说、照片墙、收藏夹、网易云音乐等多种内容形态，并配有四季特效、暗黑模式、访客统计等交互元素。

## 功能特性

- **文章系统**：Markdown 写作、代码高亮、KaTeX 数学公式、文章目录（TOC）、封面图
- **说说动态**：短内容发布与评论互动
- **照片墙**：相册管理与瀑布流展示
- **项目展示**：个人作品集管理与评论
- **收藏夹**：分类整理的书签收藏
- **留言板 / 评论系统**：支持匿名与账号登录两种方式
- **友链与商务合作**：外链管理
- **音乐系统**：网易云歌单 / 单曲在线播放、歌词同步（Meting 兼容 API）
- **图片图床**：S3 兼容对象存储直传（私有桶 + 图片代理访问）
- **后台管理**：内置 Next.js 管理后台，涵盖仪表盘统计、文章、相册、评论、友链、站点配置等
- **仪表盘统计**：近 30 天 PV / UV 趋势、最新访客、最新留言、登录记录
- **个性化**：玻璃拟态背景、四季悬浮特效、暗黑模式、RSS 订阅
- **访客统计**：页面 PV / UV 自动记录

## 技术栈

| 类别 | 选型 |
|------|------|
| 前端框架 | Next.js 16 + React 19 + TypeScript |
| 样式方案 | Tailwind CSS 4 + @tailwindcss/typography |
| 动画 | Framer Motion |
| 图标 | lucide-react |
| Markdown 渲染 | unified + remark + rehype（highlight.js 高亮、KaTeX 公式） |
| 后端 | Next.js API Routes |
| 数据库 | PostgreSQL（Prisma 6 ORM） |
| 认证 | JWT（jose）+ bcrypt 密码哈希 |
| 音乐播放 | @meting/core |
| 图片存储 | S3 兼容对象存储（@aws-sdk/client-s3，R2 / 缤纷云 / OSS / COS / MinIO 等） |

## 目录结构

```
app/           Next.js 页面与 API 路由（后台位于 app/admin）
components/    通用组件（文章、音乐、特效、后台等）
data/          静态数据（文章、说说、照片等）
prisma/        Prisma schema、迁移与种子数据
public/        静态资源与本地图片
scripts/       辅助脚本
```

## 本地开发

### 环境要求

- Node.js 20+（建议 22）
- pnpm（项目使用 pnpm 管理依赖）
- 一个可访问的 PostgreSQL 数据库（本地安装或 Supabase 免费版）

### 步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量（复制示例文件并填写）
cp .env.example .env

# 3. 初始化数据库（自动建表 + 写入默认管理员与站点配置）
pnpm db:push
pnpm db:seed

# 4. 启动开发服务器
pnpm dev
```

访问 `http://localhost:3000` 查看前台，`http://localhost:3000/admin` 进入后台（默认账号 `admin` / `admin123`，首次登录后请立即修改密码）。

### 构建生产版本

```bash
pnpm build
pnpm start
```

`pnpm build` 会自动执行 `prisma generate`、`prisma db push`、`prisma db seed`，无需手动执行 SQL。

### 环境变量

复制 `.env.example` 为 `.env` 后填写：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串（部署到 Serverless 平台推荐使用 6543 端口连接池） |
| `SECRET_KEY` | ✅ | JWT 签名密钥，至少 32 字符，生产环境务必使用强随机值 |
| `S3_ENDPOINT` | 可选 | S3 兼容图床端点（也可在后台「站点配置 → 图床设置」中填写，数据库值优先） |
| `S3_BUCKET` | 可选 | 图床桶名 |
| `S3_ACCESS_KEY` | 可选 | 图床 Access Key ID |
| `S3_SECRET_KEY` | 可选 | 图床 Secret Access Key |
| `S3_REGION` | 可选 | 图床区域（R2 填 `auto`） |

---

# 博客系统——从零到一的部署指南

## 前言

本项目基于 **Next.js 16 + Prisma + PostgreSQL**，支持文章、相册、网易云音乐、收藏夹、照片墙等多种内容形式，以及账号登录与匿名评论系统。图片统一使用 **S3 兼容图床**（支持 R2 / 缤纷云 / OSS / COS / MinIO 等），私有桶 + 图片代理访问。

> **部署平台**：本版本面向 **Vercel**（hnd1 东京节点）优化——Vercel 提供原生 ISR / revalidatePath 即时失效、函数无单实例并发限制（自动扩至 3 万）、函数默认 300s 超时，Next.js 16 代码零适配直接部署。数据库使用免费的 PostgreSQL（如 Supabase）。

## 一、准备工作

### 1.1 所需账号

| 序号 | 账号 | 用途 | 注册地址 |
|------|------|------|----------|
| 1 | GitHub | 代码托管 | https://github.com |
| 2 | Vercel | 网站部署托管 | https://vercel.com |
| 3 | Supabase | PostgreSQL 数据库 | https://supabase.com |
| 4 | S3 兼容对象存储（可选） | 图片图床 | Cloudflare R2 / 缤纷云 / 阿里云 OSS / 腾讯云 COS 等 |
| 5 | 自定义域名（可选） | 绑定自己的域名 | 任意域名注册商 |

### 1.2 所需工具

- 在线随机字符串生成器（生成 `SECRET_KEY`）：https://www.xyutil.com/random-string/zh/

### 1.3 环境变量清单

| 变量名 | 说明 | 是否必须 | 来源 |
|--------|------|----------|------|
| `DATABASE_URL` | PostgreSQL 数据库连接串 | ✅ 必须 | Supabase 控制台 |
| `SECRET_KEY` | JWT 签名密钥（至少 32 位随机字符串） | ✅ 必须 | 自己生成 |
| `S3_ENDPOINT` | S3 图床端点（也可在后台配置） | 可选 | 图床服务商 |
| `S3_BUCKET` | S3 图床桶名 | 可选 | 图床服务商 |
| `S3_ACCESS_KEY` | S3 图床 Access Key ID | 可选 | 图床服务商 |
| `S3_SECRET_KEY` | S3 图床 Secret Access Key | 可选 | 图床服务商 |
| `S3_REGION` | S3 图床区域 | 可选 | 图床服务商 |

---

## 二、第一步：准备代码仓库

1. 打开 https://github.com/ftxw/lts-blog
2. 点击右上角的 **Fork** 按钮（或直接 Clone 到本地推到自己的仓库）
3. 选择你的 GitHub 账号，确认 Fork
4. 等待几秒，代码就会复制到你的账号下

---

## 三、第二步：创建数据库（Supabase）

Supabase 提供免费的 PostgreSQL 数据库（每个项目 500MB，个人博客完全够用）。Serverless 平台不内置 SQL 数据库，需要单独创建。

### 3.1 创建项目

1. 打开 https://supabase.com，点击 **Start your project** 登录（可用 GitHub 账号）
2. 点击 **New project**（新建项目）
3. 在弹出的页面里填写：
   - **Name**：`blog-db`
   - **Database Password**：设置一个数据库密码（务必记住，连接串要用）
   - **Region**（地区）：选择 **Southeast Asia (Singapore)**（新加坡，离中国最近）
   - 其他保持默认，点击 **Create new project**
4. 等待约 1-2 分钟，项目创建完成

### 3.2 获取连接字符串

1. 进入项目后，点击左侧 **Project Settings（项目设置）→ Database（数据库）**
2. 在 **Connection string** 区域，选择 **URI** 连接方式，并复制：
   - **直连串**（端口 5432）：适合本地开发
   - **Transaction pooler**（端口 6543）：Serverless 部署推荐使用
3. 把复制的连接串保存到记事本，这就是 `DATABASE_URL` 的值

> **提示**：连接串中的密码就是创建项目时设置的数据库密码；如果密码包含 `@`、`#` 等特殊字符，需要先做 URL 编码（如 `@` → `%40`）。
>
> **推荐**：部署到 EdgeOne / Vercel 等 Serverless 平台时，使用 **Transaction pooler**（端口 6543）的连接串，可避免连接数被占满。

---

## 四、第三步：配置图床（可选，建议）

图片统一通过 **S3 兼容对象存储**（私有桶 + 代理）管理，支持 Cloudflare R2、缤纷云 S4、阿里 OSS、腾讯 COS、MinIO 等。两种配置方式：

1. **后台配置（推荐）**：登录后台 → 「站点配置」→「图床设置」，填写：
   - **EndPoint 端点**：如 R2：`https://<account-id>.r2.cloudflarestorage.com`
   - **Region 区域**：R2 填 `auto`，其他服务按服务商要求（如 `us-east-1`）
   - **Bucket 桶名**：存储桶名称（如 `my-blog-images`）
   - **Access Key ID / Secret Access Key**：服务商 API 密钥
2. **环境变量兜底**：配置 `S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY / S3_REGION`（数据库配置优先）

> **架构说明**：上传由服务器中转写入私有桶，图片访问统一走 `/api/img-proxy/` 代理，不暴露公网直链（私有桶无公开 URL，流量算在博客侧，避免被刷出流量账单）。
>
> **注意**：不配置图床也能正常使用，所有图片位置都支持直接粘贴图片 URL。

### 推荐的免费图床

| 图床 | 特点 |
|------|------|
| Cloudflare R2 | 10GB 免费存储 + 免费流量，全球访问快 |
| 缤纷云（S4） | 国内访问快，有免费额度 |
| 阿里云 OSS / 腾讯云 COS | 新用户限时免费 |

---

## 五、第四步：在 Vercel 上部署

Vercel 是 Next.js 的**官方托管平台**（hnd1 东京节点），对 ISR / revalidatePath / Serverless 函数提供原生支持，导入仓库即可部署。

### 5.1 导入项目

1. 打开 https://vercel.com，用 GitHub 账号登录
2. 点 **Add New → Project**（导入项目）
3. 选择你 Fork/推送的仓库（本仓库即面向 Vercel 的版本），Vercel 会自动识别为 Next.js 框架
4. 框架预设保持默认（Next.js），**根目录**保持 `/`，无需改构建命令（脚本内置 Prisma 初始化）

### 5.2 配置环境变量

在项目的 **Settings → Environment Variables** 中，逐条添加：

| 变量名 | 值（示例） | 来源 |
|--------|-----------|------|
| `DATABASE_URL` | `postgresql://...` | 第三步 Supabase 复制的连接串（推荐 6543 端口 pooler） |
| `SECRET_KEY` | `a3f8e2b...`（至少 32 位随机字符串） | 用在线工具生成 |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com`（可选） | 第四步图床端点 |
| `S3_BUCKET` | `my-blog-images`（可选） | 第四步桶名 |
| `S3_ACCESS_KEY` | `xxx...`（可选） | 第四步图床密钥 |
| `S3_SECRET_KEY` | `xxx...`（可选） | 第四步图床密钥 |
| `S3_REGION` | `auto` 或 `us-east-1`（可选） | 第四步图床区域 |

> **注意**：
> - `SECRET_KEY` 请使用至少 32 位的随机字符串，可以在 https://www.xyutil.com/random-string/zh/ 生成
> - 图床也可不配置环境变量，改在后台「站点配置 → 图床设置」中填写（数据库值优先）
> - 若图床服务商提供公网 CDN 域名，可在后台「图床设置」填写 `imageCdnDomain`，图片将浏览器直连图床 CDN、完全不经过应用函数

### 5.3 部署

点 **Deploy**，等待构建完成（首次约 2-5 分钟，期间会自动建表并写入默认数据）。构建完成后 Vercel 分配 `xxx.vercel.app` 域名，即可访问。

> **提示**：如需自定义域名（如 blog.lts.cc），在项目 **Settings → Domains** 中添加域名并到 DNS 服务商完成 CNAME 解析。也可在域名前再套一层 CDN（如腾讯云 EdgeOne）做国内加速，源站指向 Vercel。

---

## 六、数据库初始化（自动完成）

**无需任何手动操作。** 项目的构建脚本已内置数据库初始化流程，每次部署时会自动执行：

1. `prisma generate`：生成 Prisma Client
2. `prisma db push`：按 `prisma/schema.prisma` 自动创建所有表
3. `prisma db seed`：自动写入默认管理员和站点配置

> **提示**：整个过程是幂等的——已存在的表和配置不会重复创建，也不会覆盖你的数据，因此首次部署和后续每次部署都可以安全地自动执行。

### 默认管理员账户

部署构建成功后，系统会自动创建一个默认管理员账户：

| 项目 | 值 |
|------|-----|
| 用户名 | `admin` |
| 密码 | `admin123` |

> **安全提示**：首次登录后，请立即在后台修改默认密码！

---

## 七、验证部署

部署完成且数据库初始化后，访问以下地址验证：

| 地址 | 预期结果 |
|------|----------|
| `https://你的域名/` | 博客首页 |
| `https://你的域名/admin` | 后台登录页面（账号 `admin` / `admin123`） |

---

## 八、常见问题

### Q1：部署后页面报错 500？

检查 Vercel 的 **部署日志**（Deployments → Logs），最常见的原因是环境变量配置错误，特别是：
- `DATABASE_URL` 是否使用了 6543 端口连接池串
- 密码中的特殊字符是否已做 URL 编码（如 `@` → `%40`）
- `SECRET_KEY` 是否已设置

### Q2：数据库连接失败？

1. 确认 `DATABASE_URL` 使用的是 Supabase 的 **Transaction pooler** 连接串（端口 6543，Serverless 推荐）
2. 确认密码正确，且密码中的特殊字符已做 URL 编码（如 `@` → `%40`）
3. 确认数据库名正确（Supabase 默认数据库为 `postgres`）

### Q3：图片上传失败？

1. 检查后台「站点配置 → 图床设置」中 `endpoint / bucket / accessKey / secretKey` 是否已正确填写（或环境变量 `S3_*` 是否配置）
2. 检查桶是否允许写入（R2 需在 "Manage R2 API Tokens" 创建带对象读写权限的 Token）
3. 部分服务需要指定 `region`，R2 填 `auto`
4. 不配置图床时，请直接使用「粘贴图片 URL」方式添加图片

### Q4：为什么我没有执行任何 SQL，数据库就自动建好了？

因为构建脚本内置了 `prisma db push` + `prisma db seed`，每次部署时会自动建表并写入默认配置，**无需手动执行任何 SQL**。

### Q5：音乐无法播放？

1. 在后台「站点配置 → 音乐设置」中填写 `cloudMusicPlaylistId`（网易云歌单 ID）或 `cloudMusicIds`（歌曲 ID 数组）
2. 默认使用公共 Meting-API 拉取歌曲与歌词；公共 API 可能不稳定或被限流，若出现音乐加载失败，建议在后台配置 `cloudMusicApiUrl` 为自建的 Meting 兼容 API（如 `https://your-api.com/meting/api`），留空则回退默认公共 API

---

## 结语

到这里博客系统就部署完成了！通过 `https://你的域名/admin` 进入后台管理界面，开始发布文章、上传照片、添加项目等内容吧。

如果在部署过程中遇到问题，欢迎在 [GitHub Issues](https://github.com/ftxw/haoblog/issues) 提出。

## 相关链接

- **原项目作者 GitHub：** [github.com/Xinghongia](https://github.com/Xinghongia)
- **原项目主页：** [Starhiro の小站](https://hiromu.top)

> 基于开源，致敬原创。
