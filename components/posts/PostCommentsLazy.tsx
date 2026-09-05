"use client";

import dynamic from "next/dynamic";

/**
 * 评论区懒加载包装：评论在文章底部、首屏不可见，
 * 通过 ssr:false 拆分 JS chunk，滚动到评论区时才加载评论组件及其动画依赖。
 */
const PostComments = dynamic(() => import("./PostComments"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12 text-sm text-slate-400 dark:text-slate-500">
      加载评论中…
    </div>
  ),
});

export default function PostCommentsLazy({ postId }: { postId: string }) {
  return <PostComments postId={postId} />;
}
