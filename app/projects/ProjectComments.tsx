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
 * 项目评论：复用通用 Comments 组件。
 */
export default function ProjectComments({ projectId }: { projectId: string }) {
  return (
    <Comments<ProjectCommentItem>
      targetId={projectId}
      kind="project"
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
