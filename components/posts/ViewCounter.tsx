"use client";

import { useEffect } from "react";

/** 页面挂载时异步上报一次浏览量（不阻塞 SSR，失败静默） */
export default function ViewCounter({ postId }: { postId: string }) {
  useEffect(() => {
    fetch(`/api/posts/${encodeURIComponent(postId)}/views`, {
      method: "POST",
    }).catch(() => {
      /* 统计失败不影响阅读 */
    });
  }, [postId]);
  return null;
}
