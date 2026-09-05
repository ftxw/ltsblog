"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

/**
 * 手动主题选择：localStorage 外部 store。
 * 用 useSyncExternalStore 订阅，替代「挂载后 effect 内 setState」——
 * 后者每次进入页面都会触发一次级联渲染（React 19 set-state-in-effect 反模式）。
 */
const THEME_KEY = "theme";

let storedThemeCache: Theme | null = null;
let themeCacheInitialized = false;
const themeListeners = new Set<() => void>();

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function ensureThemeCache() {
  if (!themeCacheInitialized) {
    storedThemeCache = readStoredTheme();
    themeCacheInitialized = true;
  }
}

function emitThemeChange() {
  for (const l of themeListeners) l();
}

function subscribeTheme(cb: () => void) {
  ensureThemeCache();
  themeListeners.add(cb);
  // 多标签页场景：其它标签页改主题后本页同步（同页写入由 setStoredTheme 直接 emit）
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      storedThemeCache = readStoredTheme();
      emitThemeChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getThemeSnapshot(): Theme | null {
  ensureThemeCache();
  return storedThemeCache;
}

/** SSR 无 localStorage，服务端快照固定为 null（未手动选择） */
function getThemeServerSnapshot(): Theme | null {
  return null;
}

function setStoredTheme(t: Theme | null) {
  try {
    if (t) localStorage.setItem(THEME_KEY, t);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    /* localStorage 不可用时仅内存生效 */
  }
  storedThemeCache = t;
  themeCacheInitialized = true;
  emitThemeChange();
}

/** 系统 prefers-color-scheme 订阅（defaultMode=system 时使用） */
function subscribePrefersDark(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getPrefersDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getPrefersDarkServerSnapshot(): boolean {
  return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 站点配置「默认主题」：dark / light / system，决定未手动选择过主题的访客首屏
  const defaultMode = useConfigValue("themeMode", "dark");

  // 手动选择（localStorage）优先；未选择时按站点默认主题派生
  const manualTheme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    getPrefersDarkSnapshot,
    getPrefersDarkServerSnapshot
  );

  const theme: Theme =
    manualTheme === "light" || manualTheme === "dark"
      ? manualTheme
      : defaultMode === "light"
        ? "light"
        : defaultMode === "system"
          ? prefersDark
            ? "dark"
            : "light"
          : "dark";

  // 派生主题变化 → 同步 html 的 dark class（纯副作用，非 setState）
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setStoredTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
