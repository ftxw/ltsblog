import { request } from "./client";

export interface BookmarkSite {
  id: string;
  category_id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  platforms: string[];
  sort: number;
  created_at: string;
}

export interface BookmarkCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  sort: number;
  created_at: string;
  sites: BookmarkSite[];
}

export function getBookmarks() {
  return request<BookmarkCategory[]>("/api/bookmarks");
}
