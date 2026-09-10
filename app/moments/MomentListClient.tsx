"use client";

import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { MapPin, ArrowDownAZ, ArrowUpZA, ChevronLeft, ChevronRight, Ghost, Clock, Heart, MessageCircle } from 'lucide-react';
import CommentAuthProvider from "@/components/providers/CommentAuthProvider";
import { useEntityLike } from "@/components/useEntityLike";
import { relativeTime, formatDateCN } from "@/app/lib/format";
import MomentComments from './MomentComments';
import { getChatterComments, type ChatterCommentItem } from '@/app/api';
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import SegmentedFilter from "@/components/ui/SegmentedFilter";
import Reveal from "@/components/ui/Reveal";
import { thumbUrlOf, fallbackThumbImage } from "@/app/lib/image-thumb";

export type Moment = {
  id: string;
  date: string;
  location: string;
  images: string[];
  content: string;
  likes: number;
  comments_count: number;
};

function timeAgo(dateStr: string) {
  return relativeTime(dateStr, {
    dateFormat: (d) => formatDateCN(d),
  });
}

/**
 * 说说卡片底部操作区：♡ 点赞 + 💬 评论。
 * 位置在卡片底部（最初位置），样式与文章/项目的评论、点赞按钮保持一致。
 * 点 💬 展开该说说的评论输入框（自动完全展开）与评论列表。
 */
function MomentActions({
  moment,
  commentCount,
  commentsOpen,
  onToggleComments,
}: {
  moment: Moment;
  commentCount: number;
  commentsOpen: boolean;
  onToggleComments: () => void;
}) {
  const { likes, liked, busy, toggle } = useEntityLike("chatter", moment.id, moment.likes);
  return (
    <div className="flex items-center gap-1 md:gap-2 shrink-0">
      {/* 💬 评论数 */}
      <button
        type="button"
        onClick={onToggleComments}
        className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-colors cursor-pointer ${
          commentsOpen
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-slate-400 dark:text-slate-500 hover:text-indigo-500"
        }`}
        aria-label="评论"
      >
        <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
        <span className="tabular-nums">{commentCount > 0 ? commentCount : "评论"}</span>
      </button>

      {/* ♡ 点赞 */}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-all cursor-pointer ${
          liked
            ? "text-pink-500"
            : "text-slate-400 dark:text-slate-500 hover:text-pink-500"
        }`}
        aria-label="点赞"
      >
        <Heart
          className={`w-4 h-4 md:w-5 md:h-5 transition-all ${
            liked ? "fill-pink-500 scale-110" : ""
          }`}
        />
        <span className="tabular-nums">{likes > 0 ? likes : "点赞"}</span>
      </button>
    </div>
  );
}

export default function MomentListClient({ initialMoments }: { initialMoments: Moment[] }) {
  const [moments] = useState<Moment[]>(initialMoments);
  const [loading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [lightbox, setLightbox] = useState<{ images: string[], index: number } | null>(null);
  // 展开评论区的说说：默认不展开（不显示评论输入框与评论列表）
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  // 评论数：发表后由评论区回传更新，默认用列表自带的 comments_count
  const [commentCountMap, setCommentCountMap] = useState<Record<string, number>>({});
  // 说说卡片进入视口后预拉取的评论缓存（让"评论跟随说说"：展开秒开）
  const [commentCache, setCommentCache] = useState<Record<string, ChatterCommentItem[]>>({});
  const prefetchedSet = useRef<Set<string>>(new Set());
  const prefetchComments = (momentId: string) => {
    if (prefetchedSet.current.has(momentId)) return;
    prefetchedSet.current.add(momentId);
    getChatterComments(momentId)
      .then((data) => {
        if (!Array.isArray(data)) return;
        setCommentCache((m) => ({ ...m, [momentId]: data as ChatterCommentItem[] }));
      })
      .catch(() => {
        // 预加载失败忽略，展开时会再次尝试
        prefetchedSet.current.delete(momentId);
      });
  };

  const processedMoments = useMemo(() => {
    let result = [...moments];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(m =>
        (m.content || '').toLowerCase().includes(query) ||
        (m.location || '').toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [moments, searchQuery, sortOrder]);

  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.images.length });
  };

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length });
  };

  const renderImages = (images: string[]) => {
    if (!images || images.length === 0) return null;
    const count = images.length;

    if (count === 1) {
      return (
        <div className="mt-4 md:mt-8 flex justify-start sm:justify-center w-full">
          <div onClick={() => setLightbox({ images, index: 0 })} className="max-w-[80%] sm:max-w-[280px] overflow-hidden rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-lg md:shadow-xl cursor-zoom-in group">
            {/* 列表显示缩略图，点开全屏看原图 */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 图床/代理动态 URL，原生 img + 缩略图回退为正确实现 */}
            <img src={thumbUrlOf(images[0])} onError={(e) => fallbackThumbImage(e.currentTarget, images[0])} alt="moment" className="w-full h-auto max-h-[300px] md:max-h-[400px] object-contain group-hover:scale-105 transition-transform duration-500" />
          </div>
        </div>
      );
    }

    const columns = count === 4 ? 2 : 3;
    const maxWidth = count === 4 ? '210px' : '320px';

    return (
      <div className="w-full flex justify-start sm:justify-center mt-4 md:mt-8">
        <div className="grid gap-1.5 md:gap-2 sm:mx-auto" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, width: '100%', maxWidth: maxWidth }}>
          {images.slice(0, 9).map((src, idx) => {
            const isLastVisible = idx === 8 && count > 9;
            return (
              <div key={`${idx}-${src}`} onClick={() => setLightbox({ images, index: idx })} className="group relative aspect-square overflow-hidden rounded-lg md:rounded-xl bg-slate-200/20 dark:bg-slate-700/20 border border-slate-200/50 dark:border-white/10 cursor-zoom-in">
                {/* 列表显示缩略图，点开全屏看原图 */}
                {/* eslint-disable-next-line @next/next/no-img-element -- 图床/代理动态 URL，原生 img + 缩略图回退为正确实现 */}
                <img src={thumbUrlOf(src)} loading="lazy" decoding="async" onError={(e) => fallbackThumbImage(e.currentTarget, src)} alt="moment" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                {isLastVisible && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white backdrop-blur-[2px]">
                    <span className="text-lg md:text-xl font-black">+{count - 9}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMomentCard = (moment: Moment, index: number) => (
    <motion.div
      key={moment.id}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      onViewportEnter={() => prefetchComments(moment.id)}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="flex flex-col bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl md:rounded-[40px] shadow-lg md:shadow-xl border border-white/40 dark:border-white/10 p-5 md:p-10 transition-shadow hover:shadow-2xl overflow-hidden relative group w-full"
    >
      <p className="text-slate-800 dark:text-slate-200 text-base md:text-lg leading-relaxed whitespace-pre-wrap font-medium break-words">{moment.content}</p>

      {renderImages(moment.images)}

      {/* 底部一行：左侧时间/地点，右侧 ♡点赞 + 💬评论（最初位置） */}
      <div className="mt-5 md:mt-10 flex items-center justify-between gap-2 md:gap-3">
        <div className="min-w-0 flex-1 pr-2 flex items-center gap-1.5 md:gap-2">
          <span className="inline-flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[11px] font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400 shrink-0 border border-slate-500/10">
            <Clock size={10} className="md:w-3 md:h-3 shrink-0" />
            {timeAgo(moment.date)}
          </span>
          {moment.location && (
            <span className="inline-flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[11px] font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 max-w-full truncate border border-indigo-500/10">
              <MapPin size={10} className="md:w-3 md:h-3 shrink-0" />
              <span className="truncate">{moment.location}</span>
            </span>
          )}
        </div>

        <MomentActions
          moment={moment}
          commentCount={commentCountMap[moment.id] ?? moment.comments_count}
          commentsOpen={openCommentId === moment.id}
          onToggleComments={() =>
            setOpenCommentId(openCommentId === moment.id ? null : moment.id)
          }
        />
      </div>

      {/* 点 💬 展开：评论输入框 + 评论列表（不做高度动画，避免展开卡顿） */}
      {openCommentId === moment.id && (
        <div className="pt-4 md:pt-5">
              <MomentComments
                chatterId={moment.id}
                initialLikes={moment.likes}
                initialCommentCount={commentCountMap[moment.id] ?? moment.comments_count}
                preloadedComments={commentCache[moment.id]}
                onCountChange={(n) =>
                  setCommentCountMap((m) => ({ ...m, [moment.id]: n }))
                }
              />
        </div>
      )}
    </motion.div>
  );

  return (
    <CommentAuthProvider>
      <div className="container-page relative z-10 flex-1 flex flex-col min-h-[85vh]">

      {/* 页头：标题 + 简介 + 搜索（统一 PageHeader） */}
      <PageHeader
        title="生活动态"
        subtitle="在代码之外捕捉瞬间的温度"
        right={
          <InlineSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜寻被遗忘的记忆..."
          />
        }
      />

      {/* 排序栏：统一 SegmentedFilter（居中胶囊），归入下方内容组动画 */}
      <Reveal className="mb-8 flex justify-center">
        <SegmentedFilter
          options={[
            { value: 'desc', label: '最新', icon: <ArrowDownAZ size={12} className="md:w-3.5 md:h-3.5"/> },
            { value: 'asc', label: '最早', icon: <ArrowUpZA size={12} className="md:w-3.5 md:h-3.5"/> },
          ]}
          active={sortOrder}
          onChange={(v) => setSortOrder(v as 'desc' | 'asc')}
        />
      </Reveal>

      <LayoutGroup>
        {loading ? (
          <div className="flex flex-col md:flex-row gap-5 md:gap-8 pb-32 w-full items-start">
            <div className="flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-3xl md:rounded-[40px] bg-white/40 dark:bg-slate-800/30 p-5 md:p-10 animate-pulse">
                  <div className="h-4 w-3/4 bg-slate-200/50 dark:bg-slate-700/50 rounded" />
                  <div className="h-4 w-1/2 bg-slate-200/40 dark:bg-slate-700/40 rounded mt-3" />
                  <div className="h-32 rounded-2xl bg-slate-200/30 dark:bg-slate-700/30 mt-4" />
                </div>
              ))}
            </div>
            <div className="flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-3xl md:rounded-[40px] bg-white/40 dark:bg-slate-800/30 p-5 md:p-10 animate-pulse">
                  <div className="h-4 w-3/4 bg-slate-200/50 dark:bg-slate-700/50 rounded" />
                  <div className="h-4 w-1/2 bg-slate-200/40 dark:bg-slate-700/40 rounded mt-3" />
                  <div className="h-32 rounded-2xl bg-slate-200/30 dark:bg-slate-700/30 mt-4" />
                </div>
              ))}
            </div>
          </div>
        ) : processedMoments.length > 0 ? (
          <div className="flex flex-col md:flex-row gap-5 md:gap-8 pb-32 w-full items-start">
            <div className="flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0">
              <AnimatePresence mode='popLayout'>
                {processedMoments.map((moment, idx) => (
                  idx % 2 === 0 ? renderMomentCard(moment, idx) : null
                ))}
              </AnimatePresence>
            </div>
            <div className="flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0">
              <AnimatePresence mode='popLayout'>
                {processedMoments.map((moment, idx) => (
                  idx % 2 === 1 ? renderMomentCard(moment, idx) : null
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-12 md:py-24 min-h-[300px] md:min-h-[450px]">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center px-6 md:px-10 py-12 md:py-20 bg-white/40 dark:bg-slate-800/30 backdrop-blur-3xl rounded-[32px] md:rounded-[50px] border border-white/30 dark:border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] max-w-lg w-full mx-auto">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-indigo-500/10 rounded-2xl md:rounded-3xl flex items-center justify-center mb-6 md:mb-8 relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse"></div>
                <Ghost size={32} className="md:w-12 md:h-12 text-indigo-500 relative z-10" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 tracking-tight">{searchQuery ? "没找到相关记忆" : "朋友圈空空如也"}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-lg leading-relaxed px-2 md:px-4">{searchQuery ? `尝试精简你的搜索词，或者换个心情再次出发。` : `还没有记录下任何生活碎片呢。`}</p>
            </motion.div>
          </div>
        )}
      </LayoutGroup>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/98 backdrop-blur-xl flex items-center justify-center cursor-pointer overflow-hidden"
            onClick={() => setLightbox(null)}
          >
            {lightbox.images.length > 1 && (
              <>
                <button type="button" className="absolute left-4 md:left-12 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 border border-white/5 backdrop-blur-md" onClick={prevImg}><ChevronLeft size={24} className="md:w-9 md:h-9"/></button>
                <button type="button" className="absolute right-4 md:right-12 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 border border-white/5 backdrop-blur-md" onClick={nextImg}><ChevronRight size={24} className="md:w-9 md:h-9"/></button>
              </>
            )}
            <motion.div key={lightbox.index} initial={{ opacity: 0, scale: 0.9, x: 50 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: -50 }} className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-12 pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element -- 全屏原图是图床大图，原生 img 直连不放大 */}
              <img src={lightbox.images[lightbox.index]} className="max-w-full max-h-[75vh] md:max-h-[85vh] object-contain rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-auto" alt="fullscreen" />
              <div className="absolute bottom-8 md:bottom-10 px-4 md:px-5 py-1.5 md:py-2 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-[10px] md:text-xs font-black tracking-widest border border-white/10">
                {lightbox.index + 1} / {lightbox.images.length}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>
    </CommentAuthProvider>
  );
}