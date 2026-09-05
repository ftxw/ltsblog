import { request, qs, getToken } from "./client";

export interface ChatterItem {
  id: string;
  content: string;
  images: string[];
  location: string;
  likes: number;
  comments_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatterCommentItem {
  id: string;
  chatter_id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  email_user_name: string;
  email_user_avatar: string;
  replies: ChatterCommentItem[];
}

export function getChatters(params?: {
  status?: string;
  page?: number;
  size?: number;
}) {
  return request<ChatterItem[]>(`/api/chatters${qs(params)}`);
}

export function getChatterComments(chatterId: string) {
  return request<ChatterCommentItem[]>(
    `/api/chatters/${chatterId}/comments`
  );
}

export function createChatterComment(data: {
  chatter_id: string;
  parent_id?: string;
  content: string;
}) {
  return request<ChatterCommentItem>("/api/chatters/comments", {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
}

export function likeChatter(chatterId: string, unlike = false) {
  return request<{ likes: number }>(
    `/api/chatters/${chatterId}/${unlike ? "unlike" : "like"}`,
    { method: "POST" }
  );
}

export function likeChatterComment(commentId: string, unlike = false) {
  return request<ChatterCommentItem>(
    `/api/chatters/comments/${commentId}/${unlike ? "unlike" : "like"}`,
    { method: "POST" }
  );
}
