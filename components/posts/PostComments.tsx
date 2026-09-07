"use client";

import Comments from "@/components/Comments";
import CommentAuthProvider from "@/components/providers/CommentAuthProvider";
import {
  getPostComments,
  createComment,
  likeComment,
} from "@/app/api/comments";

/**
 * 文章评论区：复用通用评论区组件（说说/项目同款），
 * 这里只负责把 postId 映射为 Comments 的 targetId。
 * - likedKey 沿用历史 key "liked_comments"，避免老用户点赞态被重置；
 * - showErrorRetry 保留文章侧原有的「评论加载失败 + 重新加载」能力。
 */
export default function PostComments({ postId }: { postId: string }) {
  return (
    <CommentAuthProvider>
      <div className="mt-8 md:mt-12">
        {/* 与文章标题下方一致的分割线 */}
        <div className="border-b border-slate-300/50 dark:border-slate-700 pb-5 md:pb-6 mb-4 md:mb-6" />
        <Comments
          targetId={postId}
          kind="post"
          likedKey="liked_comments"
          showErrorRetry
          getComments={getPostComments}
          createComment={(d) =>
            createComment({
              post_id: postId,
              parent_id: d.parent_id,
              content: d.content,
            })
          }
          likeComment={likeComment}
        />
      </div>
    </CommentAuthProvider>
  );
}
