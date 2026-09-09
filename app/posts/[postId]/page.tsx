import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Clock } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
// 本路由正文经服务端 Markdown 渲染产出语法高亮(.hljs)与公式(.katex)，按需引入样式
import "highlight.js/styles/vs2015.css";
import "katex/dist/katex.min.css";
import { prisma } from "@/app/lib/prisma";
import { siteConfig } from "@/siteConfig";
import { cachedRenderPost } from "@/app/lib/post-render";
import FadeIn from "@/components/ui/FadeIn";
import SafeImage from "@/components/ui/SafeImage";
import BackButton from "@/components/posts/BackButton";
import ClientSocials from "@/components/posts/ClientSocials";
import ClientTOC from "@/components/posts/ClientTOC";
import PostContent from "@/components/posts/PostContent";
import PostContentWithHighlight from "@/components/posts/PostContentWithHighlight";
import ViewCounter from "@/components/posts/ViewCounter";
import PostComments from "@/components/posts/PostCommentsLazy";
import PostCover from "@/components/posts/PostCover";
import { thumbUrlOf } from "@/app/lib/image-thumb";

/** 页面级 ISR：300s 增量静态生成；发布/编辑/删除文章时由 API 层 revalidatePath 即时失效 */
export const revalidate = 300;

/** 构建时预渲染所有已发布文章：首次访问直接命中静态 HTML，
 *  不再现场渲染（DB 查询 + Markdown 高亮/KaTeX 是主要耗时点）。
 *  发布新文章后访问 /posts/{id} 会触发 ISR 增量生成并缓存。 */
export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    where: { status: "published" },
    select: { id: true },
  });
  return posts.map((p) => ({ postId: p.id }));
}

/** 需要原样输出的图片：远程绝对 URL（未匹配 remotePatterns 时优化器会报错）与 SVG */
function imageUnoptimized(url: string): boolean {
  return /^https?:\/\//i.test(url) || /\.svg(\?|#|$)/i.test(url);
}

export async function generateMetadata({ params }: { params: Promise<{ postId: string }> }): Promise<Metadata> {
  const { postId } = await params;
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { title: true, description: true },
  });
  return {
    title: post?.title || "文章",
    description: post?.description || undefined,
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  // 文章详情与推荐阅读并行查询（互不依赖，减少一次远程 DB 往返）
  const [post, recentPosts] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      include: { tags: { include: { tag: true } } },
    }),
    prisma.post.findMany({
      where: { status: "published", id: { not: postId } },
      orderBy: { published_at: "desc" },
      take: 3,
      select: { id: true, title: true, published_at: true },
    }),
  ]);

  if (!post || post.status !== "published") notFound();

  const { contentHtml, toc } = await cachedRenderPost(post.content);

  const date = post.published_at ? new Date(post.published_at).toISOString().slice(0, 10) : "";
  const tags = post.tags.map((t) => t.tag.name);

  return (
    <div className="min-h-screen relative pb-20">
      {/* 浏览量客户端异步上报（不阻塞渲染） */}
      <ViewCounter postId={postId} />
      <FadeIn className="container-page flex flex-col lg:flex-row gap-6 md:gap-8 relative z-10">
        <article className="flex-1 bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 overflow-hidden transition-colors duration-700">
          <div className="w-full aspect-video bg-slate-200 dark:bg-slate-700 relative group overflow-hidden">
            <PostCover
              src={post.cover || siteConfig.defaultPostCover}
              alt="封面"
              sizes="(max-width: 768px) 100vw, 70vw"
              className="object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none transition-transform duration-1000 group-hover:scale-105"></div>
          </div>

          <div className="p-5 md:p-12 relative">
            <BackButton />

            <header className="mb-6 md:mb-8 border-b border-slate-300/50 dark:border-slate-700 pb-5 md:pb-6 relative">
              <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight transition-colors duration-700 pr-16 md:pr-24 leading-snug">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <div className="flex items-center gap-1.5 md:gap-2 text-indigo-700 dark:text-indigo-400 font-bold bg-white/30 dark:bg-slate-900/50 px-3 md:px-4 py-1.5 md:py-2 rounded-full w-max text-xs md:text-sm transition-colors duration-700 shadow-sm border border-white/20 dark:border-white/5">
                  <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  写作时间：{date}
                </div>
                {tags.map((tag) => (
                  <div key={tag} className="bg-slate-100/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs md:text-sm font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/20 dark:border-white/5 transition-colors duration-700 shadow-sm">
                    # {tag}
                  </div>
                ))}
              </div>
            </header>

            <Suspense fallback={<PostContent contentHtml={contentHtml} />}>
              <PostContentWithHighlight contentHtml={contentHtml} />
            </Suspense>

            <div className="mt-12 md:mt-16">
              <PostComments postId={post.id} />
            </div>
          </div>
        </article>

        <aside className="w-full lg:w-[320px] flex flex-col gap-6 flex-shrink-0">
          {/* 作者信息卡片 */}
          <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-white/40 dark:border-white/10 shadow-xl text-center">
            <div className="w-20 h-20 mx-auto rounded-full p-1 bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-md mb-4 transition-transform duration-500 hover:rotate-3">
              <Image
                src={siteConfig.avatarUrl}
                alt="avatar"
                width={80}
                height={80}
                unoptimized={imageUnoptimized(siteConfig.avatarUrl)}
                className="w-full h-full rounded-full object-cover bg-white"
              />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{siteConfig.authorName}</h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium mb-4">{siteConfig.bio}</p>
            <ClientSocials />
          </div>

          {/* 推荐阅读 */}
          <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-white/40 dark:border-white/10 shadow-xl">
            <h3 className="font-black text-slate-900 dark:text-white mb-4 border-l-4 border-indigo-500 pl-2 text-sm tracking-widest">RECOMMENDED</h3>
            <div className="space-y-4">
              {recentPosts.map((p) => (
                <Link key={p.id} href={`/posts/${p.id}`} className="group block">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">{p.title}</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-bold uppercase">
                    {p.published_at ? new Date(p.published_at).toISOString().slice(0, 10) : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {toc.length > 0 && <ClientTOC toc={toc} />}
        </aside>
      </FadeIn>
    </div>
  );
}

