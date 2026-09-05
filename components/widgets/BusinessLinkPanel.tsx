"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, LayoutGrid, Plus, ExternalLink } from "lucide-react";

interface BusinessLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  status: string;
}

/**
 * 业务链接悬浮面板：左下角圆形按钮，点开弹出链接列表。
 * 数据来源：后台「链接管理」配置（/api/business-links，仅 active）。
 * 懒加载：默认折叠时**不发请求**，首次点击展开才拉取
 * （serverless 下省掉每个页面整载时的 1 次函数调用）。
 */
export default function BusinessLinkPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [links, setLinks] = useState<BusinessLink[]>([]);
  const loadedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadLinks = () => {
    fetch("/api/business-links")
      .then((res) => res.json())
      .then((data) => {
        if (mountedRef.current && Array.isArray(data)) setLinks(data);
      })
      .catch(() => {
        // 失败允许下次展开时重试
        loadedRef.current = false;
      });
  };

  const togglePanel = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !loadedRef.current) {
      loadedRef.current = true;
      loadLinks();
    }
  };

  // 按钮始终显示；无链接时面板显示空状态提示

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-6 z-40 w-64 overflow-hidden rounded-2xl border border-white/30 bg-white/85 p-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/85"
          >
            <div className="mb-1 flex items-center gap-2 px-2 py-1.5">
              <Link2 className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                我的链接
              </span>
            </div>
            <div className="max-h-72 space-y-0.5 overflow-y-auto">
              {links.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-slate-400">
                  暂无链接，可到后台「链接管理」添加
                </div>
              ) : (
                links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {link.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.icon}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        link.name.slice(0, 1)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <span className="truncate">{link.name}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      {link.description && (
                        <p className="truncate text-xs text-slate-400">
                          {link.description}
                        </p>
                      )}
                    </div>
                  </a>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 悬浮按钮 */}
      <div className="fixed bottom-6 left-6 z-30">
        <button
          type="button"
          onClick={togglePanel}
          title="我的链接"
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl backdrop-blur-xl border border-white/40 dark:border-white/10 transition-all duration-500 group active:scale-95 z-50 cursor-pointer
            ${isOpen ? "bg-indigo-500 text-white rotate-45" : "bg-white/70 dark:bg-slate-800/80 text-slate-700 dark:text-white"}
          `}
        >
          {isOpen ? (
            <Plus className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <LayoutGrid className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />
          )}
        </button>
      </div>
    </>
  );
}
