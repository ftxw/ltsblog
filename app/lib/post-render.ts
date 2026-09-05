import { createHash } from "crypto";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { memoryCacheGet, memoryCacheSet } from "./memory-cache";
import { thumbUrlOf } from "./image-thumb";

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

/** 从 Markdown 原文提取目录（h1-h3） */
export function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    toc.push({
      level: match[1].length,
      text: match[2].trim(),
      id: match[2].trim().toLowerCase().replace(/\s+/g, "-"),
    });
  }
  return toc;
}

/** 服务端 Markdown 渲染管线（与参考项目 XHBlogs 一致） */
export async function renderPostContent(content: string): Promise<{ contentHtml: string; toc: TocItem[] }> {
  let mdContent = content;

  // 1. 修复数字列表缺少空格："1.百度" -> "1. 百度"
  mdContent = mdContent.replace(/^(\s*\d+)\.([^ \n])/gm, "$1. $2");

  // 2. 统一换行符，清理纯空格行
  mdContent = mdContent.replace(/\r\n/g, "\n").replace(/^[ \t]+$/gm, "");

  // 3. 连续空行 -> <br/>（跳过代码块，保留间距）
  const blocks = mdContent.split(/(```[\s\S]*?```)/g);
  mdContent = blocks
    .map((block, index) => {
      if (index % 2 === 1) return block;
      return block.replace(/\n{3,}/g, (match) => "\n\n" + "<br/>".repeat(match.length - 2) + "\n\n");
    })
    .join("");

  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight, {
      detect: true,
      ignoreMissing: true,
      subset: [
        "cpp", "c", "python", "java", "javascript", "typescript", "go", "rust",
        "bash", "json", "html", "css", "sql", "xml", "php", "ruby", "yaml", "markdown",
      ],
    })
    .use(rehypeKatex)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(mdContent);

  let contentHtml = processed.toString();
  // 正文图床图片：列表内直接加载缩略图（更快），同时保留原图到 data-original，
  // 供前端 <img> 点击时打开全屏原图灯箱。
  contentHtml = contentHtml.replace(
    /(<img\b[^>]*?src=["'])(\/api\/img-proxy\/imgs\/[^"']+)(["'])/gi,
    (_m, pre: string, src: string, post: string) => {
      const thumb = thumbUrlOf(src);
      if (thumb === src) return _m;
      return `${pre}${thumb}${post} data-original="${src}"`;
    }
  );

  return {
    contentHtml,
    toc: extractToc(mdContent),
  };
}

/** Markdown 渲染结果缓存：按内容哈希做 key（内容变 key 变，自动失效），
 *  dev/prod 均生效，避免语法高亮/KaTeX 每次访问重渲染（CPU 大户）。
 *  文章详情页、关于页共用。
 *  注意：key 加版本后缀（v2-thumbs），旧版本渲染的 HTML 没有 data-original
 *  和缩略图处理，重启后会按新 key 重新渲染。 */
export const cachedRenderPost = async (content: string) => {
  const key = "post-render:v2-thumbs:" + createHash("sha1").update(content).digest("hex");
  const hit = memoryCacheGet<{ contentHtml: string; toc: TocItem[] }>(
    "post-render",
    key
  );
  if (hit) return hit;
  const rendered = await renderPostContent(content);
  memoryCacheSet("post-render", key, rendered, 3600_000);
  return rendered;
};
