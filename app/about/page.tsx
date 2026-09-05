import matter from "gray-matter";
import { siteConfig } from "@/siteConfig";
import { getDbSiteConfig } from "@/app/lib/site-config-db";
import { aboutContentDefaultRaw } from "@/app/lib/site-config-defs";
import FadeIn from "@/components/ui/FadeIn";
import ThumbCoverImg from "@/components/ui/ThumbCoverImg";
import AboutMarkdown from "@/components/about/AboutMarkdown";

// ISR 300s：后台保存站点配置时 invalidateAllPublicCaches() 会 revalidatePath("/", "layout")
// 即时重建本页，兼顾"首次打开快"与"配置变更立即生效"
export const revalidate = 300;

export default async function AboutPage() {
  const dbConfig = await getDbSiteConfig().catch(() => ({} as Record<string, string>));
  // 兜底链：DB 配置 -> siteConfig.ts 默认 -> 本地默认图
  const avatarUrl = dbConfig.avatarUrl || siteConfig.avatarUrl || "/images/hong.jpg";
  const authorName = dbConfig.authorName || siteConfig.authorName || "博主";
  // 正文：后台「内容管理 → 关于页」编辑，存于 DB；未配置时回退到源码默认内容
  const aboutContent = dbConfig.aboutContent || aboutContentDefaultRaw;
  let coverImage = dbConfig.aboutCover || "/images/2.webp";
  // 只剥离 frontmatter 拿封面/正文；正文渲染交给 AboutMarkdown（服务端 unified 管线 + 缓存）
  let markdown = aboutContent;
  try {
    const { data, content } = matter(aboutContent);
    // 兼容旧版内容中 frontmatter 里的 cover 字段
    if (data.cover) coverImage = data.cover;
    markdown = content;
  } catch (e) {
    console.error("解析关于页内容失败", e);
  }

  return (
    <FadeIn className="container-page relative z-10">
      <div className="w-[90%] mx-auto bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-[40px] shadow-2xl border border-white/40 dark:border-white/10 overflow-hidden transition-colors duration-700 relative">

        {/* 封面大图：先加载缩略图，点开可后续扩展为 lightbox 看原图 */}
        <div className="w-full h-40 sm:h-48 md:h-64 relative bg-slate-200 dark:bg-slate-700 overflow-hidden group">
          <ThumbCoverImg
            src={coverImage}
            alt="About Hero"
            className="w-full h-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
        </div>

        <div className="px-5 sm:px-8 md:px-16 pb-10 md:pb-16 relative">
          {/* 头像 */}
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-2xl overflow-hidden -mt-12 md:-mt-16 relative z-20 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- 头像可为图床外链（imageCdnDomain/avatarUrl），原生 img 直连最优 */}
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          </div>

          {/* 标题区（无独立动画，随整块卡片一起出现） */}
          <div className="mt-4 md:mt-6 mb-16 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-widest mb-2 transition-colors duration-700">
                关于我
              </h1>
              <p className="text-slate-600 dark:text-slate-400 font-medium tracking-wider transition-colors duration-700">
                Hello World, I&apos;m {authorName}
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-slate-300/50 dark:bg-slate-700 mb-6 md:mb-8" />

          {/* Markdown 正文（服务端渲染 + 哈希缓存，复用文章详情的 unified 管线） */}
          <AboutMarkdown markdown={markdown} />
        </div>
      </div>
    </FadeIn>
  );
}
