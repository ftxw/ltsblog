import { request, qs, getToken } from "./client";

export type LikeTargetType = "post" | "chatter" | "project";

export interface LikeState {
  likes: number;
  liked: boolean;
}

/** 查询某内容的点赞数与当前账号点赞态（未登录 liked=false） */
export function getLikeState(
  targetType: LikeTargetType,
  targetId: string
): Promise<LikeState> {
  const token = getToken();
  return request<LikeState>(
    `/api/like${qs({ targetType, targetId })}`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  );
}

/** 登录态点赞/取消（未登录会被后端 401 拒绝） */
export function setLike(
  targetType: LikeTargetType,
  targetId: string,
  liked: boolean
): Promise<LikeState> {
  return request<LikeState>("/api/like", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, liked }),
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}
