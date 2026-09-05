"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateCN, formatDateTimeCN } from "@/app/lib/format";
import { jsonHeadersFor, errorText } from "@/app/lib/response";

/* ========== Token Cookie 管理 ========== */

const TOKEN_KEY = "authorized-token";

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expires: number;
}

export function getTokenData(): TokenData | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${TOKEN_KEY}=([^;]*)`)
  );
  if (!match) return null;
  try {
    const data = JSON.parse(decodeURIComponent(match[1]));
    if (data && typeof data.accessToken === "string") {
      return data as TokenData;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setTokenData(data: TokenData) {
  const maxAge = 30 * 24 * 60 * 60; // 30 天（与 refreshToken 有效期一致）
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(
    JSON.stringify(data)
  )}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function clearTokenData() {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
}

/* ========== 请求封装（带 token 自动刷新） ========== */

let refreshing: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const token = getTokenData();
      if (!token?.refreshToken) return false;
      try {
        const res = await fetch("/api/auth/refresh-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: token.refreshToken }),
        });
        if (!res.ok) return false;
        const json = await res.json();
        if (json.code !== 0 || !json.data?.accessToken) return false;
        setTokenData({
          accessToken: json.data.accessToken,
          refreshToken: json.data.refreshToken,
          expires: json.data.expires,
        });
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

export function redirectToLogin() {
  clearTokenData();
  window.location.href = "/admin/login";
}

/** 统一 fetch：附带 cookie 鉴权，401 时自动刷新 token 并重试一次 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const doFetch = () =>
    fetch(path, {
      ...init,
      headers: {
        ...jsonHeadersFor(init?.body),
        ...(init?.headers || {}),
      },
    });

  let res = await doFetch();
  if (res.status === 401) {
    const ok = await tryRefreshToken();
    if (ok) {
      res = await doFetch();
    } else {
      redirectToLogin();
      throw new Error("登录已过期，请重新登录");
    }
  }
  return res;
}

/** 请求并解析 JSON，非 2xx 时抛出后端返回的错误信息 */
export async function apiJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    throw new Error(await errorText(res));
  }
  return res.json() as Promise<T>;
}

/* ========== 通用数据请求 Hook ========== */

export function useApi<T = unknown>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    apiJson<T>(url)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // loading 为派生状态：url 有效且尚无数据/错误（与各消费方 `loading && !data`
  // 的骨架屏条件一致，也避免在 effect 内同步 setLoading 触发额外渲染）
  const loading = url !== null && data === null && error === null;

  return { data, loading, error, reload, setData };
}

/* ========== 工具函数 ========== */

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : formatDateTimeCN(d);
}

/** 只显示到日：YYYY-MM-DD */
export function formatDateOnly(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : formatDateCN(d);
}

/**
 * 浏览器端用 canvas 生成 webp 缩略图。
 * 约束「宽度 ≤ 640px」，高度按原图比例：
 * - 相册/瀑布流的列宽是固定的，只需保证缩略图宽度够列宽用即可；
 * - 若按"最长边"约束，长截图/竖长图会被压得很窄看不清，按宽度约束则任何图都有足够宽度。
 * 不依赖服务器图片处理（规避 serverless 运行时 sharp native binding 崩溃 / OOM）。
 * GIF / SVG / 无法解码的图片返回 null → 上传接口跳过缩略图，前端直接使用原图。
 */
const MAX_THUMB_WIDTH = 640;

async function createThumbBlob(file: File): Promise<Blob | null> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return null;
  try {
    const bmp = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_THUMB_WIDTH / bmp.width);
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0, w, h);
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.85)
      );
    } finally {
      bmp.close();
    }
  } catch {
    return null;
  }
}

/** 上传用途分类：articles / albums / projects / moments / system；folder 按实体 id 细分 */
export interface UploadImageOptions {
  category?: string;
  folder?: string;
}

export async function uploadImage(
  file: File,
  opts: UploadImageOptions = {}
): Promise<{ url: string; thumbUrl: string; orientation: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (opts.category) formData.append("category", opts.category);
  if (opts.folder) formData.append("folder", opts.folder);
  // 系统类目（头像 / 背景 / 站点配置等）不需要缩略图：列表里直接展示原图，
  // 也避免为这些小体量图片额外生成一份 webp。
  if (opts.category !== "system") {
    const thumbBlob = await createThumbBlob(file);
    if (thumbBlob) {
      const base = file.name.replace(/\.[^/.]+$/, "");
      formData.append("thumb", thumbBlob, `${base}.webp`);
    }
  }
  const res = await apiFetch("/api/upload/image", {
    method: "POST",
    body: formData,
  });
  let json: {
    url?: string;
    thumbUrl?: string;
    orientation?: string;
    error?: string;
  } | null = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok || !json?.url) {
    throw new Error(json?.error || "图片上传失败");
  }
  return {
    url: json.url,
    thumbUrl: json.thumbUrl || "",
    orientation: json.orientation || "landscape",
  };
}
