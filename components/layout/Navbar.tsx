"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import { siteConfig } from "@/siteConfig";
import {
  Menu,
  X,
  Home,
  BookOpen,
  MessageSquare,
  Camera,
  Music,
  Bookmark,
  FolderGit2,
  User,
} from "lucide-react";

const navLinks = [
  { href: "/", label: "首页", icon: Home },
  { href: "/posts", label: "文章", icon: BookOpen },
  { href: "/moments", label: "说说", icon: MessageSquare },
  { href: "/photowall", label: "照片墙", icon: Camera },
  { href: "/music", label: "音乐", icon: Music },
  { href: "/bookmark", label: "收藏夹", icon: Bookmark },
  { href: "/projects", label: "项目", icon: FolderGit2 },
  { href: "/about", label: "关于", icon: User },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navTitle = useConfigValue("navTitle", siteConfig.navTitle);
  const navSuffix = useConfigValue("navSuffix", siteConfig.navSuffix);
  const navAfter = useConfigValue("navAfter", siteConfig.navAfter);

  // --- 滚动隐藏 / 显示顶部导航栏 ---
  const [showNav, setShowNav] = useState(true);
  // 用 ref 保存滚动位置，避免 lastScrollY 变化导致滚动监听反复解绑/重绑
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 路由切换后关闭移动端菜单：渲染期 prev 比较（效果等价于 effect 内 setState，
  // 但不会触发 React 19 set-state-in-effect 反模式的级联渲染）
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileMenuOpen(false);
  }

  const logoClass =
    "text-xl font-black tracking-tighter transition-all duration-300 text-slate-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400";

  return (
    <header
      className={`w-full fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${showNav ? "translate-y-0" : "-translate-y-full"} bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border-white/20 dark:border-white/5 shadow-sm`}
    >
      <div className="w-[90%] max-w-6xl mx-auto h-16 flex items-center justify-between px-4 sm:px-[30px] box-border">
        {pathname === "/" ? (
          <div className="flex items-center select-none cursor-pointer">
            <span className={logoClass}>
              {navTitle || siteConfig.authorName}
              <span className="text-indigo-500 mx-1">{navSuffix || "の"}</span>
              {navAfter || "宝藏之地"}
            </span>
          </div>
        ) : (
          <Link href="/" className="flex items-center select-none">
            <span className={logoClass}>
              {navTitle || siteConfig.authorName}
              <span className="text-indigo-500 mx-1">{navSuffix || "の"}</span>
              {navAfter || "宝藏之地"}
            </span>
          </Link>
        )}

        {/* 桌面端：水平导航链接，右对齐 */}
        <nav className="hidden md:flex gap-8 text-sm font-bold ml-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname === `${link.href}/`;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1 transition-colors whitespace-nowrap ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200 hover:text-indigo-600"}`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 移动端汉堡按钮 */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            title="菜单"
            aria-label="切换导航菜单"
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 移动端下拉抽屉（参考 wryygx/ddmer-1 样式：毛玻璃 + 图标纵向列表） */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.nav
            key="mobile-drawer"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden glass-card rounded-none border-x-0 border-t-0 overflow-hidden"
          >
            <div className="p-4 space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || pathname === `${link.href}/`;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}