"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { decodeConfigMojibake } from "@/app/lib/mojibake";
import { configureCdnDomain } from "@/app/lib/image-thumb";

/** 后台兜底轮询间隔：60s（切回前台由 visibilitychange/focus 即时触发，轮询只是兜底） */
const POLL_INTERVAL = 60_000;

export type SiteConfigContextType = {
  config: Record<string, string>;
  loading: boolean;
  refreshConfig: () => Promise<void>;
};

/** 浅比较两个字符串字典是否完全一致（用于避免无意义的 setState） */
function shallowEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

const SiteConfigContext = createContext<SiteConfigContextType>({
  config: {},
  loading: true,
  refreshConfig: async () => {},
});

export function SiteConfigProvider({
  children,
  initialConfig = {},
}: {
  children: React.ReactNode;
  initialConfig?: Record<string, string>;
}) {
  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  // SSR 已注入 initialConfig，初始即为可用状态（避免任何"等待首拉"的加载态）
  const [loading, setLoading] = useState(false);

  const pathname = usePathname();
  // 用 ref 镜像当前路由，保证 fetchConfig 保持稳定引用
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const fetchConfig = useCallback(async () => {
    // 后台 /admin/* 不渲染前台视觉（导航/背景/特效），
    // 无需拉取站点配置 —— 直接跳过，少一次后端调用/实例占用。
    if (pathnameRef.current?.startsWith("/admin")) return;
    try {
      // 添加时间戳防止 CDN 或代理的 URL 级别缓存
      const res = await fetch(`/api/site-config?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        console.warn("[SiteConfig] API 返回非 200 状态:", res.status);
        return;
      }
      const data = await res.json();
      if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        // 检查是否真的返回了配置数据（至少有一个键）
        const keys = Object.keys(data);
        if (keys.length > 0) {
          // 修复历史双重编码（如 "æ¬¢è¿æ¥å°æçåå®¢" -> "欢迎来到我的博客"）
          const decoded = decodeConfigMojibake(data as Record<string, string>);
          // 内容没变就不要 setState：否则每次轮询都会产生一个新的 config 对象，
          // 导致整棵 Provider 子树（导航、背景、特效、所有页面组件）全量重渲染。
          setConfig((prev) => (shallowEqual(prev, decoded) ? prev : decoded));
        } else {
          console.warn("[SiteConfig] API 返回空对象，保留当前配置");
        }
      } else {
        console.warn("[SiteConfig] API 返回格式异常:", typeof data);
      }
    } catch (err) {
      console.warn("[SiteConfig] 拉取配置失败:", err);
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    setLoading(true);
    await fetchConfig();
    setLoading(false);
  }, [fetchConfig]);

  // 从后台切回前台时补拉一次配置（后台期间被跳过，避免前台一直用旧配置）
  const prevIsAdminRef = useRef<boolean | null>(null);
  useEffect(() => {
    const isAdmin = pathname?.startsWith("/admin") ?? false;
    const prev = prevIsAdminRef.current;
    prevIsAdminRef.current = isAdmin;
    if (prev === true && !isAdmin) {
      void fetchConfig();
    }
  }, [pathname, fetchConfig]);

  useEffect(() => {
    // 挂载时**不再请求** /api/site-config：
    // layout.tsx 已在 SSR 把最新配置注入 initialConfig（带 30s 内存缓存 + singleFlight），
    // 客户端再拉一次等于每次整页访问多打一次 serverless 函数。
    // 配置保持最新由下面三件事保证：切回前台 / 窗口获焦 / 60s 可见轮询兜底。

    // 页面切换回前台时自动刷新（后台修改配置后切回页面就生效）
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchConfig();
      }
    };
    // 窗口获得焦点时刷新（覆盖部分浏览器行为）
    const handleFocus = () => {
      fetchConfig();
    };
    // 从 bfcache 恢复时刷新（移动端返回/前进时常见）
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        fetchConfig();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);

    // 定时轮询：每 60 秒一次。
    // 原先是 15 秒 —— 一个停留 10 分钟的标签页会多打 40 次接口；
    // 而这些请求会穿透到数据库（site-config 缓存仅 30s），
    // 在 serverless 下纯粹是浪费宝贵的实例并发。
    // 「切回前台立即刷新」已由上面的 visibilitychange / focus / pageshow 覆盖，
    // 轮询只作为兜底，放慢完全不影响体验。
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval === null) interval = setInterval(pollIfVisible, POLL_INTERVAL);
    };
    const stopPolling = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };
    /** 页面在后台时不发请求：不可见标签页没必要消耗服务端资源 */
    const pollIfVisible = () => {
      if (document.visibilityState === "visible") fetchConfig();
    };
    startPolling();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      stopPolling();
    };
  }, [fetchConfig]);

  // 图床直链域名同步到 image-thumb 模块（渲染期执行，先于所有子组件；
  // 站点配置全站一致，单实例模块变量安全）。配置改变即生效。
  configureCdnDomain(config.imageCdnDomain || "");

  return (
    <SiteConfigContext.Provider value={{ config, loading, refreshConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

export function useConfigValue(key: string, defaultValue = ""): string {
  const { config } = useContext(SiteConfigContext);
  return config[key] ?? defaultValue;
}

/** 从站点配置读取 JSON 数组（如 bgImages、themeColors），解析失败返回 fallback */
export function useConfigJson<T>(key: string, fallback: T): T {
  const raw = useConfigValue(key, "");
  return useMemo(() => {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as T;
    } catch {
      // ignore
    }
    return fallback;
  }, [raw, fallback]);
}
