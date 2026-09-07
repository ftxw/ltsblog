"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Reply,
  Send,
  Heart,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Smile,
  UserRound,
  X,
} from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import { relativeTime, flattenReplies } from "@/app/lib/format";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";
import { getLikeState, setLike, type LikeTargetType } from "@/app/api/like";

/**
 * 通用评论项形状。ChatterCommentItem / ProjectCommentItem 都满足该结构。
 */
export interface CommentItem {
  id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  email_user_name: string;
  email_user_avatar: string;
  replies: CommentItem[];
}

export interface CommentsProps<T extends CommentItem> {
  targetId: string;
  /** 用于本地存储 key（默认 liked_${kind}_comments） */
  kind: "moment" | "project" | "post";
  /** 拉取评论列表 */
  getComments: (targetId: string) => Promise<T[]>;
  /** 提交评论（父组件负责把 targetId 映射到对应 idField） */
  createComment: (data: {
    targetId: string;
    parent_id?: string;
    content: string;
  }) => Promise<T>;
  /** 点赞/取消评论 */
  likeComment: (commentId: string, unlike: boolean) => Promise<{ likes: number }>;
  /** 自定义本地点赞 key（用于与历史 key 保持兼容，避免老用户点赞态被重置） */
  likedKey?: string;
  /** 列表加载失败时展示「加载失败 + 重新加载」（默认关闭，静默失败） */
  showErrorRetry?: boolean;
  /** 实体点赞目标类型（默认按 kind 映射：moment→chatter / post→post / project→project） */
  likeTargetType?: LikeTargetType;
  /** 初始点赞数（列表数据自带时传入，避免闪烁） */
  initialLikes?: number;
  /** 初始评论总数（列表数据自带时传入，避免闪烁） */
  initialCommentCount?: number;
}

const KIND_TARGET: Record<string, LikeTargetType> = {
  moment: "chatter",
  post: "post",
  project: "project",
};

const EMOJIS = [
  "😀","😄","😊","😍","😘","😎","🤔","😅","😂","😭",
  "😡","🥳","😇","🙃","😴","🤗","👍","👎","👏","🙏",
  "💪","🔥","❤️","💔","✨","⭐","🎉","🌹","🌸","☕",
  "🐱","🐶","🍀","✌️","🤝","💯","✅","❓","❗","🎂",
];

/** 递归统计评论总数（含回复） */
function countAll(nodes: CommentItem[]): number {
  return nodes.reduce((s, c) => s + 1 + countAll(c.replies ?? []), 0);
}

export default function Comments<T extends CommentItem>({
  targetId,
  kind,
  getComments,
  createComment,
  likeComment,
  likedKey: likedKeyProp,
  showErrorRetry = false,
  likeTargetType: likeTargetTypeProp,
  initialLikes,
  initialCommentCount,
}: CommentsProps<T>) {
  const { user, openLogin, loginOpen } = useCommentAuth();
  const likedKey = likedKeyProp ?? `liked_${kind}_comments`;
  const likeTargetType = likeTargetTypeProp ?? KIND_TARGET[kind];

  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const saved = localStorage.getItem(likedKey);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [likeState, setLikeState] = useState<{ likes: number; liked: boolean }>({
    likes: initialLikes ?? 0,
    liked: false,
  });
  const [likeBusy, setLikeBusy] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(initialCommentCount ?? null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // 加载评论（列表与总数）
  useEffect(() => {
    let active = true;
    setCommentsLoading(true);
    getComments(targetId)
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setComments(list);
        setTotalCount(countAll(list as CommentItem[]));
      })
      .catch(() => {
        if (active && showErrorRetry) setLoadError(true);
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [targetId, getComments, retryTick, showErrorRetry]);

  // 加载实体点赞状态（登录则带 liked）
  useEffect(() => {
    let active = true;
    getLikeState(likeTargetType, targetId)
      .then((s) => {
        if (active) setLikeState(s);
      })
      .catch(() => {
        // 忽略：保留 initialLikes
      });
    return () => {
      active = false;
    };
  }, [likeTargetType, targetId, loginOpen]);

  function retryLoad() {
    setLoadError(false);
    setCommentsLoading(true);
    setRetryTick((t) => t + 1);
  }

  function cancelCompose() {
    setComposing(false);
    setReplyTo(null);
    setCommentInput("");
    setShowEmoji(false);
  }

  async function handleCommentLike(commentId: string) {
    const alreadyLiked = likedCommentIds.has(commentId);
    try {
      const data = await likeComment(commentId, alreadyLiked);
      const newLikes = typeof data?.likes === "number" ? data.likes : 0;
      setLikedCommentIds((p) => {
        const n = new Set(p);
        if (alreadyLiked) n.delete(commentId);
        else n.add(commentId);
        localStorage.setItem(likedKey, JSON.stringify([...n]));
        return n;
      });
      setComments((prev) =>
        prev.map((c) => updateCommentLikes(c, commentId, newLikes))
      );
    } catch {}
  }

  function updateCommentLikes(c: CommentItem, targetId: string, likes: number): CommentItem {
    if (c.id === targetId) return { ...c, likes };
    if (c.replies?.length)
      return { ...c, replies: c.replies.map((r) => updateCommentLikes(r, targetId, likes)) };
    return c;
  }

  function startReply(c: CommentItem) {
    if (!user) {
      openLogin();
      return;
    }
    setReplyTo(c);
    setComposing(true);
    setCommentInput("");
    setShowEmoji(false);
    setTimeout(() => inputRef.current?.focus(), 120);
  }

  function findTopLevelId(comments: CommentItem[], targetId: string): string | null {
    for (const c of comments) {
      if (c.id === targetId) return c.id;
      for (const r of c.replies ?? []) {
        if (r.id === targetId) return c.id;
        for (const rr of r.replies ?? []) {
          if (rr.id === targetId) return c.id;
        }
      }
    }
    return null;
  }

  /** 递归把新回复插入到 parentId 对应评论的 replies 下（支持回复子评论的层级） */
  function insertReply(
    list: CommentItem[],
    parentId: string,
    nc: CommentItem
  ): CommentItem[] {
    return list.map((c) => {
      if (c.id === parentId) {
        return { ...c, replies: [...(c.replies ?? []), nc] };
      }
      if (c.replies?.length) {
        return { ...c, replies: insertReply(c.replies, parentId, nc) };
      }
      return c;
    });
  }

  /** 评论/回复提交（需登录） */
  async function handleSubmitComment() {
    if (!commentInput.trim() || submitting) return;
    if (!user) {
      openLogin();
      return;
    }
    setSubmitting(true);
    try {
      const nc = await createComment({
        targetId,
        content: commentInput.trim(),
        parent_id: replyTo?.id,
      });
      if (replyTo) {
        const topId = findTopLevelId(comments, replyTo.id) ?? replyTo.id;
        const next = insertReply(comments, replyTo.id, { ...nc, replies: [] });
        setComments(next);
        setTotalCount(countAll(next));
        setExpandedReplies((p) => new Set([...p, topId]));
      } else {
        const next = [...comments, { ...nc, replies: [] }];
        setComments(next);
        setTotalCount(countAll(next));
      }
      setCommentInput("");
      setReplyTo(null);
      setComposing(false);
      setShowEmoji(false);
      setListOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSubmitting(false);
    }
  }

  /** 实体点赞：未登录弹窗，登录后 optimistic 切换 */
  async function handleEntityLike() {
    if (likeBusy) return;
    if (!user) {
      openLogin();
      return;
    }
    const nextLiked = !likeState.liked;
    setLikeState((s) => ({ likes: Math.max(0, s.likes + (nextLiked ? 1 : -1)), liked: nextLiked }));
    setLikeBusy(true);
    try {
      const res = await setLike(likeTargetType, targetId, nextLiked);
      setLikeState({ likes: res.likes, liked: res.liked });
    } catch {
      // 回滚
      setLikeState((s) => ({ likes: Math.max(0, s.likes + (nextLiked ? -1 : 1)), liked: !nextLiked }));
    } finally {
      setLikeBusy(false);
    }
  }

  /** 插入表情（追加到输入末尾） */
  function insertEmoji(emoji: string) {
    setCommentInput((v) => v + emoji);
    setShowEmoji(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const loggedIn = Boolean(user);

  return (
    <div>
      {/* ===== 评论条：第一行 = 输入框（头像在输入框内部），展开时原地变全宽 ===== */}
      <div className="flex items-center">
        <div
          className={`flex-1 min-w-0 flex items-center gap-2 rounded-full bg-slate-100/80 dark:bg-slate-800/70 border px-2.5 md:px-3 py-1 md:py-1.5 transition-colors ${
            composing && loggedIn
              ? "border-indigo-300 dark:border-indigo-500/50"
              : "border-white/40 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50"
          }`}
        >
          {/* 头像：位于输入框内部左侧，默认显示昵称首字 */}
          <button
            type="button"
            onClick={() => (loggedIn ? setComposing((v) => !v) : openLogin())}
            className="shrink-0 rounded-full overflow-hidden"
            aria-label="头像"
          >
            {loggedIn && user!.avatar ? (
              <SafeImage
                src={user!.avatar}
                alt={user!.nickname}
                width={30}
                height={30}
                className="w-7 h-7 md:w-8 md:h-8 rounded-full"
              />
            ) : (
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-indigo-400 to-sky-400 dark:from-indigo-600 dark:to-sky-600 flex items-center justify-center text-white text-xs md:text-sm font-bold">
                {loggedIn
                  ? (user!.nickname || user!.email || "?").slice(0, 1).toUpperCase()
                  : <UserRound className="w-3.5 h-3.5 md:w-4 md:h-4" />}
              </div>
            )}
          </button>

          {composing && loggedIn ? (
            <textarea
              ref={inputRef}
              autoFocus
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder={replyTo ? "写下你的回复..." : "说点什么..."}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleSubmitComment();
              }}
              className="flex-1 min-w-0 bg-transparent text-xs md:text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => (loggedIn ? setComposing(true) : openLogin())}
              className="flex-1 min-w-0 text-left text-xs md:text-sm text-slate-400 dark:text-slate-500 cursor-pointer"
            >
              {loggedIn ? "说点什么..." : "登录评论"}
            </button>
          )}
        </div>

        {/* 💬 评论数 / ♡ 点赞：收起态显示；输入框展开后隐藏（第一行只留输入框） */}
        {!(composing && loggedIn) && (
          <>
            {/* 💬 评论数：展开/收起列表 */}
            <button
              type="button"
              onClick={() => {
                setListOpen((v) => !v);
                if (!listOpen && commentsLoading && loadError) setLoadError(false);
              }}
              className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-colors cursor-pointer ${
                listOpen
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500 hover:text-indigo-500"
              }`}
              aria-label="评论"
            >
              <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
              <span className="tabular-nums">{totalCount ?? 0}</span>
            </button>

            {/* ♡ 点赞 */}
            <button
              type="button"
              onClick={handleEntityLike}
              disabled={likeBusy}
              className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-all cursor-pointer ${
                likeState.liked
                  ? "text-pink-500"
                  : "text-slate-400 dark:text-slate-500 hover:text-pink-500"
              }`}
              aria-label="点赞"
            >
              <Heart
                className={`w-5 h-5 md:w-6 md:h-6 transition-all ${
                  likeState.liked ? "fill-pink-500 scale-110" : ""
                }`}
              />
              <span className="tabular-nums">{likeState.likes}</span>
            </button>
          </>
        )}
      </div>

      {/* ===== 展开后的第二行：左 表情，右 取消 / 发表（💬/♡ 始终在第一行） ===== */}
      <AnimatePresence>
        {composing && loggedIn && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <AnimatePresence>
              {replyTo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 pt-2 text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                    <Reply className="w-3 h-3" />
                    <span>
                      回复{" "}
                      <span className="font-medium text-sky-600 dark:text-sky-400">
                        {replyTo.email_user_name || "匿名"}
                      </span>
                    </span>
                    <span className="truncate flex-1 opacity-60 ml-1">
                      {replyTo.content.slice(0, 40)}
                    </span>
                    <button
                      type="button"
                      onClick={cancelCompose}
                      className="text-slate-400 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    showEmoji
                      ? "text-amber-500 bg-amber-50 dark:bg-amber-500/10"
                      : "text-slate-400 hover:text-amber-500"
                  }`}
                  title="插入表情"
                >
                  <Smile className="w-5 h-5 md:w-6 md:h-6" />
                </button>


              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelCompose}
                  className="px-3 py-1.5 rounded-full text-xs md:text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={!commentInput.trim() || submitting}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-indigo-600 text-xs md:text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  发表
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showEmoji && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-2 grid grid-cols-10 gap-0.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 max-h-28 overflow-y-auto">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => insertEmoji(e)}
                        className="text-base md:text-lg p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 评论列表（💬 展开/收起） ===== */}
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {showErrorRetry && loadError && (
              <div className="text-center py-8 md:py-12 text-slate-400">
                <MessageCircle className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2 md:mb-3 opacity-40" />
                <p className="text-xs md:text-sm mb-3">评论加载失败</p>
                <button
                  type="button"
                  onClick={retryLoad}
                  className="text-[10px] md:text-xs text-sky-500 hover:text-sky-600 transition-colors underline underline-offset-2"
                >
                  重新加载
                </button>
              </div>
            )}

            {commentsLoading && !loadError && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl bg-white/30 dark:bg-slate-700/20 animate-pulse"
                  />
                ))}
              </div>
            )}

            {!commentsLoading && comments.length === 0 && !loadError && (
              <div className="text-center py-8 text-xs md:text-sm text-slate-400">
                还没有评论，来抢沙发吧
              </div>
            )}

            {!commentsLoading && comments.length > 0 && (
              <div className="space-y-3 md:space-y-4">
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    expandedReplies={expandedReplies}
                    onReply={startReply}
                    onToggleReplies={(id) =>
                      setExpandedReplies((p) => {
                        const n = new Set(p);
                        if (n.has(id)) n.delete(id);
                        else n.add(id);
                        return n;
                      })
                    }
                    likedCommentIds={likedCommentIds}
                    onCommentLike={handleCommentLike}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommentCard({
  comment,
  expandedReplies,
  onReply,
  onToggleReplies,
  likedCommentIds,
  onCommentLike,
}: {
  comment: CommentItem;
  expandedReplies: Set<string>;
  onReply: (c: CommentItem) => void;
  onToggleReplies: (id: string) => void;
  likedCommentIds: Set<string>;
  onCommentLike: (id: string) => void;
}) {
  const isExpanded = expandedReplies.has(comment.id);
  const flat = flattenReplies(comment.replies ?? []);
  const replyCount = flat.length;

  return (
    <div className="rounded-2xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
      <div className="p-3 md:p-5">
        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
          {comment.email_user_avatar ? (
            <SafeImage
              src={comment.email_user_avatar}
              alt={comment.email_user_name}
              width={32}
              height={32}
              className="rounded-full md:w-9 md:h-9"
            />
          ) : (
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-white text-xs md:text-sm font-bold">
              ?
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200">
              {comment.email_user_name || "匿名用户"}
            </span>
          </div>
          <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 shrink-0">
            {relativeTime(comment.created_at)}
          </span>
        </div>
        <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-3 md:mb-4">
          {comment.content}
        </p>
        <div className="flex items-center gap-2 md:gap-4 pt-2 md:pt-3 border-t border-slate-200/50 dark:border-white/5">
          <button
            type="button"
            onClick={() => onCommentLike(comment.id)}
            className={`flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs transition-colors ${
              likedCommentIds.has(comment.id)
                ? "text-pink-500"
                : "text-slate-400 hover:text-pink-500"
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-all duration-300 ${
                likedCommentIds.has(comment.id) ? "fill-pink-500 scale-110" : ""
              }`}
            />
            <span>{comment.likes}</span>
          </button>
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-slate-400 hover:text-sky-500 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span>回复</span>
          </button>
          {replyCount > 0 && (
            <button
              type="button"
              onClick={() => onToggleReplies(comment.id)}
              className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-slate-400 hover:text-blue-500 transition-colors ml-auto"
            >
              {isExpanded ? (
                <ChevronUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
              ) : (
                <ChevronDown className="w-3 h-3 md:w-3.5 md:h-3.5" />
              )}
              <span>{replyCount} 条回复</span>
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && replyCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
              {flat.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  onReply={onReply}
                  likedCommentIds={likedCommentIds}
                  onCommentLike={onCommentLike}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReplyCard({
  reply,
  onReply,
  likedCommentIds,
  onCommentLike,
}: {
  reply: CommentItem & { replyToUser?: string };
  onReply: (c: CommentItem) => void;
  likedCommentIds: Set<string>;
  onCommentLike: (id: string) => void;
}) {
  return (
    <div className="px-3 py-2 md:px-5 md:py-3 border-b border-slate-200/30 dark:border-white/5 last:border-0">
      <div className="flex items-start gap-2 md:gap-3">
        {reply.email_user_avatar ? (
          <SafeImage
            src={reply.email_user_avatar}
            alt={reply.email_user_name}
            width={24}
            height={24}
            className="rounded-full mt-0.5 md:w-7 md:h-7"
          />
        ) : (
          <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-white text-[10px] md:text-xs font-bold mt-0.5">
            ?
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
            <span className="text-[10px] md:text-xs font-semibold text-slate-700 dark:text-slate-300">
              {reply.email_user_name || "匿名用户"}
            </span>
            <span className="text-[10px] md:text-xs text-slate-400">
              {relativeTime(reply.created_at)}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
            {reply.replyToUser && (
              <span className="text-sky-500 dark:text-sky-400 mr-1">
                回复 @{reply.replyToUser}：
              </span>
            )}
            {reply.content}
          </p>
          <div className="flex items-center gap-2 md:gap-3 mt-1.5 md:mt-2">
            <button
              type="button"
              onClick={() => onCommentLike(reply.id)}
              className={`flex items-center gap-0.5 md:gap-1 text-[10px] md:text-xs transition-colors ${
                likedCommentIds.has(reply.id)
                  ? "text-pink-500"
                  : "text-slate-400 hover:text-pink-500"
              }`}
            >
              <Heart
                className={`w-3 h-3 md:w-3.5 md:h-3.5 ${
                  likedCommentIds.has(reply.id) ? "fill-pink-500" : ""
                }`}
              />
              <span>{reply.likes}</span>
            </button>
            <button
              type="button"
              onClick={() => onReply(reply)}
              className="flex items-center gap-0.5 md:gap-1 text-[10px] md:text-xs text-slate-400 hover:text-sky-500 transition-colors"
            >
              <Reply className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>回复</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
