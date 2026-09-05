"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "@/siteConfig";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import SafeImage from "@/components/ui/SafeImage";

interface ProfileStats {
  postCount: number;
  chatterCount: number;
  photoCount: number;
}

export default function ProfileCard({
  postCount: initialPost = 0,
  chatterCount: initialChatter = 0,
  photoCount: initialPhoto = 0,
}: {
  postCount?: number;
  chatterCount?: number;
  photoCount?: number;
}) {
  const router = useRouter();

  // 数据库可覆盖的站点配置
  const avatarUrl = useConfigValue("avatarUrl", siteConfig.avatarUrl);
  const authorName = useConfigValue("authorName", siteConfig.authorName);
  const bio = useConfigValue("bio", siteConfig.bio);
  // 技能 Logo 图片（multiImage，JSON 数组，上传几张显示几张，最多 5 张，纯展示无链接）
  const socialLogosRaw = useConfigValue("socialLogos", JSON.stringify(siteConfig.socialLogos || []));
  const socialLogos = useMemo(() => {
    try {
      const parsed = JSON.parse(socialLogosRaw || "[]");
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [socialLogosRaw]);

  // 统计数字：先展示服务端初始值（首页 SSR 已传真实计数），
  // 挂载时**不再重复请求**；仅当页面可见时每 60s 轮询一次保持新鲜，
  // 省掉每次整页访问的一次 serverless 调用。
  const [stats, setStats] = useState<ProfileStats>({
    postCount: initialPost,
    chatterCount: initialChatter,
    photoCount: initialPhoto,
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        const r = await fetch("/api/dashboard/profile-stats?_t=" + Date.now(), { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled || !d || typeof d !== "object") return;
        setStats({
          postCount: Number(d.postCount ?? initialPost),
          chatterCount: Number(d.chatterCount ?? initialChatter),
          photoCount: Number(d.photoCount ?? initialPhoto),
        });
      } catch {
        /* 静默失败，保留现有数字 */
      }
    }
    const refresh = () => {
      if (document.visibilityState === "visible") void fetchStats();
    };
    // 可见时 60s 轮询（切回前台立即刷一次）
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [initialPost, initialChatter, initialPhoto]);

  return (    <div
      onClick={() => router.push("/about")}
      className="md:col-span-7 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 md:p-8 flex flex-col justify-between transition-all duration-700 hover:scale-[1.01] cursor-pointer group relative overflow-hidden h-full min-h-[220px] md:min-h-[280px]"
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-4 md:gap-6 w-full">
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl md:rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-1 shadow-lg flex-shrink-0 transition-transform duration-500 group-hover:rotate-3 relative">
            {/* 内层相对容器：让 p-1 的渐变边框在四周露出来，不被 fill 图片盖住 */}
            <div className="relative w-full h-full overflow-hidden rounded-lg md:rounded-xl">
              <SafeImage src={avatarUrl} alt="avatar" fill className="object-cover bg-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1 md:mb-2 pb-1 leading-snug tracking-wider transition-colors duration-700 truncate">
              {authorName}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed max-w-md transition-colors duration-700 line-clamp-2 md:line-clamp-none">
              {bio}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-end justify-between mt-6 md:mt-8 gap-5 md:gap-6 relative z-10">
        <div className="flex gap-2 sm:gap-6 w-full md:w-auto justify-between sm:justify-around md:justify-start px-2 sm:px-0">
          <StatItem count={stats.postCount} label="文章" color="text-indigo-600 dark:text-indigo-400" />
          <div className="w-px h-8 md:h-10 bg-slate-300/50 dark:bg-slate-700 hidden md:block"></div>
          <StatItem count={stats.chatterCount} label="杂谈" color="text-purple-600 dark:text-purple-400" />
          <div className="w-px h-8 md:h-10 bg-slate-300/50 dark:bg-slate-700 hidden md:block"></div>
          <StatItem count={stats.photoCount} label="照片" color="text-pink-600 dark:text-pink-400" />
        </div>

        {socialLogos.length > 0 && (
          <div className="flex gap-2 md:gap-3 flex-wrap justify-center md:justify-end w-full md:w-auto" onClick={(e) => e.stopPropagation()}>
            {socialLogos.slice(0, 5).map((logo, i) => (
              <div key={`${logo}-${i}`} className="w-11 h-11 md:w-12 md:h-12 relative rounded-xl bg-white/50 dark:bg-slate-700/50 overflow-hidden border border-white/40 dark:border-white/10 shadow-sm transform-gpu">
                <SafeImage src={logo} alt={`social-logo-${i + 1}`} fill className="object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ count, label, color }: { count: number, label: string, color: string }) {
  return (
    <div className="text-center group/stat px-2">
      <div className={`text-xl md:text-2xl font-black ${color} transition-transform group-hover/stat:scale-110`}>{count}</div>
      <div className="text-[9px] md:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}


