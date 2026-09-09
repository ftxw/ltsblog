"use client";

import Comments from "@/components/Comments";
import {
  getChatterComments,
  createChatterComment,
  likeChatterComment,
  type ChatterCommentItem,
} from "@/app/api";

export type { ChatterCommentItem as CommentItem };

/**
 * 说说评论：包装通用 Comments 组件（新单行评论条：输入 + 💬评论数 + ♡点赞）。
 */
export default function MomentComments({
  chatterId,
  initialLikes,
  initialCommentCount,
  onCountChange,
  preloadedComments,
}: {
  chatterId: string;
  initialLikes?: number;
  initialCommentCount?: number;
  onCountChange?: (n: number) => void;
  preloadedComments?: ChatterCommentItem[];
}) {
  return (
    <Comments<ChatterCommentItem>
      targetId={chatterId}
      kind="moment"
      initialLikes={initialLikes}
      initialCommentCount={initialCommentCount}
      // 说说的 💬/♡ 由卡片底部（原位置）承载，评论区不再重复渲染；
      // 点开评论时输入框自动完全展开（表情 + 发表/取消直接可见）
      hideActions
      autoCompose
      initialComments={preloadedComments}
      onCountChange={onCountChange}
      getComments={getChatterComments}
      createComment={(d) =>
        createChatterComment({
          chatter_id: chatterId,
          parent_id: d.parent_id,
          content: d.content,
        })
      }
      likeComment={likeChatterComment}
    />
  );
}
