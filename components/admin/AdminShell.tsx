"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageCircle,
  Image,
  Bookmark,
  FolderGit2,
  UserRound,
  Settings,
  Wrench,
  UserCog,
  LogOut,
  Menu,
  X,
  Home,
} from "lucide-react";
import { apiJson, clearTokenData } from "@/components/admin/lib";
import { cn } from "@/components/admin/ui";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "概览",
    items: [{ href: "/admin", label: "仪表盘", icon: LayoutDashboard }],
  },
  {
    title: "内容管理",
    items: [
      { href: "/admin/posts", label: "文章管理", icon: FileText },
      { href: "/admin/moments", label: "说说管理", icon: MessageCircle },
      { href: "/admin/albums", label: "相册管理", icon: Image },
      { href: "/admin/bookmarks", label: "书签管理", icon: Bookmark },
      { href: "/admin/projects", label: "项目管理", icon: FolderGit2 },
      { href: "/admin/about", label: "关于页", icon: UserRound },
    ],
  },
  {
    title: "系统管理",
    items: [
      { href: "/admin/settings", label: "信息设置", icon: Settings },
      { href: "/admin/system-settings", label: "站点设置", icon: Wrench },
      { href: "/admin/account", label: "账号设置", icon: UserCog },
    ],
  },
];

interface MeInfo {
  nickname: string;
  username: string;
  avatar: string;
  roles: string[];
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    apiJson<{ code: number; data: MeInfo }>("/api/auth/me")
      .then((res) => setMe(res.data))
      .catch(() => {
        // 静默失败：布局层已完成服务端鉴权，这里只是展示信息
      });
  }, []);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const handleLogout = () => {
    clearTokenData();
    router.replace("/admin/login");
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
          管
        </div>
        <span className="text-base font-bold text-white">博客后台</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link prefetch={false}
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-indigo-500/20 font-medium text-indigo-300"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-3">
        <Link prefetch={false}
          href="/"
          target="_blank"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
        >
          <Home className="h-4 w-4" />
          回到前台
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* 桌面端侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-slate-900 lg:block">
        {sidebar}
      </aside>

      {/* 移动端抽屉 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900">
            <button
              className="absolute right-3 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-800 cursor-pointer"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* 顶栏 */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-6">
          <button
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">
            欢迎回来{me ? `，${me.nickname || me.username}` : ""}
          </div>
          <div className="flex items-center gap-3">
            {me && (
              <div className="flex items-center gap-2">
                {me.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={me.avatar}
                    alt="avatar"
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600">
                    {(me.nickname || me.username || "?").slice(0, 1)}
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700">
                  {me.nickname || me.username}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
