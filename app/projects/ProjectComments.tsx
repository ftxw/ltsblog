"use client";

import Comments from "@/components/Comments";
import {
  getProjectComments,
  createProjectComment,
  likeProjectComment,
  type ProjectCommentItem,
} from "@/app/api";

export type { ProjectCommentItem as CommentItem };

/**
 * 项目评论：复用通用 Comments 组件（新单行评论条：输入 + 💬评论数 + ♡点赞）。
 */
export default function ProjectComments({
  projectId,
  initialLikes,
  initialCommentCount,
}: {
  projectId: string;
  initialLikes?: number;
  initialCommentCount?: number;
}) {
  return (
    <Comments<ProjectCommentItem>
      targetId={projectId}
      kind="project"
      initialLikes={initialLikes}
      initialCommentCount={initialCommentCount}
      getComments={getProjectComments}
      createComment={(d) =>
        createProjectComment({
          project_id: projectId,
          parent_id: d.parent_id,
          content: d.content,
        })
      }
      likeComment={likeProjectComment}
    />
  );
}
