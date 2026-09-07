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
}: {
  chatterId: string;
  initialLikes?: number;
  initialCommentCount?: number;
}) {
  return (
    <Comments<ChatterCommentItem>
      targetId={chatterId}
      kind="moment"
      initialLikes={initialLikes}
      initialCommentCount={initialCommentCount}
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
