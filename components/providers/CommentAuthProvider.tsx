"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mail, Lock, UserRound, X, Smile } from "lucide-react";
import {
  saveCommentSession,
  clearCommentSession,
  loadCommentUser,
  type CommentSessionUser,
} from "@/app/api/client";

/**
 * 前台登录上下文：为评论/点赞提供统一账号态与登录弹窗。
 * - 账号体系 = Supabase Auth（邮箱+密码），token 存 localStorage（anonymous_token），
 *   与后台 authorized-token cookie 相互独立；
 * - 弹窗一次挂载（页面根组件），任意评论条/点赞均可触发。
 */

interface CommentAuthValue {
  user: CommentSessionUser | null;
  /** 校验本地 token 是否仍有效（无效自动登出） */
  refresh: () => Promise<void>;
  /** 登录并保存会话；失败抛错（message 可直接展示） */
  login: (email: string, password: string) => Promise<void>;
  /** 注册并自动登录；返回 true 表示需去邮箱确认（无会话） */
  register: (email: string, password: string, nickname: string) => Promise<boolean>;
  logout: () => void;
  openLogin: () => void;
  closeLogin: () => void;
  loginOpen: boolean;
}

const CommentAuthContext = createContext<CommentAuthValue | null>(null);

export function useCommentAuth(): CommentAuthValue {
  const ctx = useContext(CommentAuthContext);
  if (!ctx) throw new Error("useCommentAuth 必须在 CommentAuthProvider 内使用");
  return ctx;
}

interface AuthResult {
  code: number;
  message?: string;
  data?: {
    accessToken: string;
    refreshToken?: string;
    expires?: number;
    nickname?: string;
    avatar?: string;
    email?: string;
    id?: string;
  };
}

export default function CommentAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<CommentSessionUser | null>(() => loadCommentUser());
  const [loginOpen, setLoginOpen] = useState(false);

  // 挂载时若本地有 token，向 /api/auth/me 校验有效性
  useEffect(() => {
    let active = true;
    const token = (() => {
      try {
        return localStorage.getItem("anonymous_token") || "";
      } catch {
        return "";
      }
    })();
    if (!token || !loadCommentUser()) {
      if (token && !loadCommentUser()) clearCommentSession();
      return;
    }    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((json: AuthResult) => {
        if (!active) return;
        if (json.code === 0 && json.data?.email) {
          const u = loadCommentUser();
          setUser({
            id: u?.id || token,
            email: json.data.email,
            nickname: json.data.nickname || u?.nickname || "用户",
            avatar: json.data.avatar || u?.avatar || "",
          });
        } else {
          clearCommentSession();
          setUser(null);
        }
      })
      .catch(() => {
        if (active) {
          // 网络异常不强制登出，保留本地态
        }
      })
      .finally(() => {      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySession = useCallback((json: AuthResult) => {
    const d = json.data;
    if (!d?.accessToken || !d?.email) return;
    const nu: CommentSessionUser = {
      id: d.id || d.accessToken,
      email: d.email,
      nickname: d.nickname || d.email.split("@")[0],
      avatar: d.avatar || "",
    };
    saveCommentSession(d.accessToken, nu);
    setUser(nu);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json: AuthResult = await res.json().catch(() => null);
      if (!res.ok || json?.code !== 0 || !json?.data?.accessToken) {
        throw new Error(json?.message || "登录失败");
      }
      applySession(json);
      setLoginOpen(false);
    },
    [applySession]
  );

  const register = useCallback(
    async (email: string, password: string, nickname: string) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nickname }),
      });
      const json: AuthResult = await res.json().catch(() => null);
      if (!res.ok || json?.code !== 0) {
        throw new Error(json?.message || "注册失败");
      }
      if (json.code === 2) return true; // 需邮箱确认
      if (json.data?.accessToken) {
        applySession(json);
        setLoginOpen(false);
      }
      return false;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    clearCommentSession();
    setUser(null);
  }, []);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  const value = useMemo<CommentAuthValue>(
    () => ({ user, refresh: async () => {}, login, register, logout, openLogin, closeLogin, loginOpen }),
    [user, login, register, logout, openLogin, closeLogin, loginOpen]
  );

  return (
    <CommentAuthContext.Provider value={value}>
      {children}
      <CommentLoginModal />
    </CommentAuthContext.Provider>
  );
}

/** 登录/注册弹窗（模态） */
function CommentLoginModal() {
  const { loginOpen, closeLogin, login, register } = useCommentAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 每次打开重置表单
  useEffect(() => {
    if (loginOpen) {
      setMode("login");
      setEmail("");
      setPassword("");
      setNickname("");
      setError(null);
      setInfo(null);
    }
  }, [loginOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        const needConfirm = await register(email, password, nickname);
        if (needConfirm) setInfo("注册成功，请前往邮箱完成确认后再登录");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {loginOpen && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeLogin}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.94, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-white/60 dark:border-white/10 p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {mode === "login" ? "登录后评论" : "注册账号"}
              </h3>
              <button
                type="button"
                onClick={closeLogin}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab 切换 */}
            <div className="grid grid-cols-2 gap-1 mb-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setInfo(null);
                  }}
                  className={`rounded-md py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                    mode === m
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {m === "login" ? "登录" : "注册"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "register" && (
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="昵称（最多 20 字）"
                    maxLength={20}
                    required
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  autoComplete="username"
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "密码（至少 6 位）" : "密码"}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                  {info}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === "login" ? "登 录" : "注册并登录"}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <Smile className="w-3 h-3" />
              评论需登录真实账号，未注册请切换到「注册」
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
