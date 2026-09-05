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
 * 说说评论：包装通用 Comments 组件。
 * 保留原默认导出 / props 不变，向后兼容现有 page.tsx。
 */
export default function MomentComments({ chatterId }: { chatterId: string }) {
  return (
    <Comments<ChatterCommentItem>
      targetId={chatterId}
      kind="moment"
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
