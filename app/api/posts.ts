import { request, qs } from "./client";

export interface PostItem {
  id: string;
  title: string;
  description: string;
  cover: string;
  category: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export function getPosts(params?: {
  status?: string;
  category?: string;
  tag?: string;
  keyword?: string;
  page?: number;
  size?: number;
}) {
  return request<PostItem[]>(`/api/posts${qs(params)}`);
}

