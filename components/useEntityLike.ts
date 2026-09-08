"use client";

import { useState, useEffect, useCallback } from "react";
import { getLikeState, setLike, type LikeTargetType } from "@/app/api/like";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";

/**
 * 实体（文章 / 说说 / 项目）点赞状态与切换。
 *
 * - 登录后才能点赞，未登录点击会弹出登录窗；
 * - 点赞记录落库（ContentLike），换设备状态一致；
 * - enabled=false 时不拉取数据（例如评论区把点赞按钮交给外部卡片渲染的场景）。
 */
export function useEntityLike(
  targetType: LikeTargetType,
  targetId: string,
  initialLikes?: number,
  enabled = true
) {
  const { user, openLogin } = useCommentAuth();
  const [likes, setLikes] = useState(initialLikes ?? 0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const userId = user?.id ?? "";

  // 拉取点赞数与当前账号点赞态（登录态变化后重新拉取）
  useEffect(() => {
    if (!enabled || !targetId) return;
    let active = true;
    getLikeState(targetType, targetId)
      .then((s) => {
        if (!active) return;
        setLikes(s.likes);
        setLiked(s.liked);
      })
      .catch(() => {
        // 忽略：保留初始值
      });
    return () => {
      active = false;
    };
  }, [targetType, targetId, enabled, userId]);

  const toggle = useCallback(async () => {
    if (busy || !enabled) return;
    if (!user) {
      openLogin();
      return;
    }
    const next = !liked;
    // 乐观更新
    setLiked(next);
    setLikes((p) => Math.max(0, p + (next ? 1 : -1)));
    setBusy(true);
    try {
      const res = await setLike(targetType, targetId, next);
      setLikes(res.likes);
      setLiked(res.liked);
    } catch {
      // 失败回滚；仅当确实未登录/令牌失效时才提示登录（网络错误不误弹）
      setLiked(!next);
      setLikes((p) => Math.max(0, p + (next ? -1 : 1)));
      if (!user) openLogin();
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, user, openLogin, liked, targetType, targetId]);

  return { likes, liked, busy, toggle };
}
