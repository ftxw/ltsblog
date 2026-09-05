import { request, qs, getToken } from "./client";

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  long_description: string;
  cover_image: string;
  images: string[];
  tech_stack: string[];
  link_github: string;
  link_gitee: string;
  link_live: string;
  link_docs: string;
  status: string;
  status_label: string;
  is_featured: boolean;
  sort: number;
  likes: number;
  created_at: string;
  updated_at?: string;
}

export interface ProjectCommentItem {
  id: string;
  project_id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  email_user_name: string;
  email_user_avatar: string;
  replies: ProjectCommentItem[];
}

export function getProjects(params?: { status?: string }) {
  return request<ProjectItem[]>(`/api/projects${qs(params)}`);
}

export function getProjectComments(projectId: string) {
  return request<ProjectCommentItem[]>(
    `/api/projects/${projectId}/comments`
  );
}

export function createProjectComment(data: {
  project_id: string;
  parent_id?: string;
  content: string;
}) {
  return request<ProjectCommentItem>("/api/projects/comments", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}

export function likeProject(projectId: string, unlike = false) {
  return request<{ likes: number }>(
    `/api/projects/${projectId}/${unlike ? "unlike" : "like"}`,
    { method: "POST" }
  );
}

export function likeProjectComment(commentId: string, unlike = false) {
  return request<{ id: string; likes: number }>(
    `/api/projects/comments/${commentId}/${unlike ? "unlike" : "like"}`,
    { method: "POST" }
  );
}
