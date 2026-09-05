"use client";

import { useSearchParams } from "next/navigation";
import PostContent from "./PostContent";

/** 客户端读取 URL 中的 highlight 关键词，供文章正文做搜索高亮。
 *  必须包在 <Suspense> 内使用：fallback 输出无高亮正文，水合后本组件接管并加高亮 */
export default function PostContentWithHighlight({
  contentHtml,
}: {
  contentHtml: string;
}) {
  const searchParams = useSearchParams();
  const keyword = searchParams.get("highlight") ?? "";
  return <PostContent contentHtml={contentHtml} highlightKeyword={keyword} />;
}
