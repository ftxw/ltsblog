"use client";

import { useState, useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
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
import { relativeTime, flattenReplies } from "@/app/lib/format";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";
import { useEntityLike } from "@/components/useEntityLike";
import { type LikeTargetType } from "@/app/api/like";

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
  /** 隐藏评论条右侧的 💬/♡ 按钮（说说的按钮放在卡片底部原位置） */
  hideActions?: boolean;
  /** 挂载后自动展开输入框（说说：点 💬 后直接展开输入区 + 表情/发表/取消） */
  autoCompose?: boolean;
  /**
   * 预加载的评论数据（说说卡片滚动到视口时随说说一起拉取，展开评论秒开），
   * 传入后跳过首次网络请求。
   */
  initialComments?: T[];
  /**
   * 输入框的外部挂载容器（项目详情用）：传入后，输入区会通过 portal
   * 渲染到该节点（例如弹窗底部固定栏），而评论列表仍留在原滚动流中。
   */
  inputHostRef?: RefObject<HTMLElement | null>;
  /** 评论总数变化回调（供外部卡片同步 💬 数字） */
  onCountChange?: (n: number) => void;
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
  hideActions = false,
  autoCompose = false,
  inputHostRef,
  initialComments,
  onCountChange,
}: CommentsProps<T>) {
  const { user, openLogin } = useCommentAuth();
  const likedKey = likedKeyProp ?? `liked_${kind}_comments`;
  const likeTargetType = likeTargetTypeProp ?? KIND_TARGET[kind];

  // 实体点赞（说说把按钮交给卡片底部时不拉取）
  const {
    likes: entityLikes,
    liked: entityLiked,
    busy: likeBusy,
    toggle: toggleEntityLike,
  } = useEntityLike(likeTargetType, targetId, initialLikes, !hideActions);

  // onCountChange 用 ref 持有，避免父组件传内联函数导致请求死循环
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>(
    () => (initialComments ? (initialComments as CommentItem[]) : [])
  );
  const [commentsLoading, setCommentsLoading] = useState(!Boolean(initialComments));
  const listRef = useRef<HTMLDivElement>(null);
  const [composing, setComposing] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  // 浮动表情面板：按钮屏幕坐标 + 面板位置
  const [emojiPos, setEmojiPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const saved = localStorage.getItem(likedKey);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [totalCount, setTotalCount] = useState<number | null>(() =>
    initialComments
      ? countAll(initialComments as CommentItem[])
      : initialCommentCount ?? null
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // 自动展开输入框（说说：点 💬 后直接展开输入区，无需再点输入框）
  const autoComposedRef = useRef(false);
  useEffect(() => {
    if (!autoCompose || autoComposedRef.current) return;
    if (!user) return;
    autoComposedRef.current = true;
    setComposing(true);
    setShowEmoji(false);
    setTimeout(() => inputRef.current?.focus(), 120);
  }, [autoCompose, user]);

  // 输入区 portal 目标（项目详情：输入框渲染到弹窗底部固定栏）
  const [inputHost, setInputHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!inputHostRef) return;
    setInputHost(inputHostRef.current ?? null);
  }, [inputHostRef]);

  // 自动增高：多行内容时输入框随内容变高（超过 max-h 后内部滚动）
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [commentInput, composing, replyTo]);

  // 加载评论（列表与总数）；若已传入 initialComments 则跳过首次拉取
  useEffect(() => {
    if (initialComments) {
      setCommentsLoading(false);
      // 同步外部（首次挂载时通知总条数）
      onCountChangeRef.current?.(countAll(initialComments as CommentItem[]));
      return;
    }
    let active = true;
    setCommentsLoading(true);
    getComments(targetId)
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setComments(list);
        const n = countAll(list as CommentItem[]);
        setTotalCount(n);
        onCountChangeRef.current?.(n);
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
        onCountChangeRef.current?.(countAll(next));
        setExpandedReplies((p) => new Set([...p, topId]));
      } else {
        const next = [...comments, { ...nc, replies: [] }];
        setComments(next);
        setTotalCount(countAll(next));
        onCountChangeRef.current?.(countAll(next));
      }
      setCommentInput("");
      setReplyTo(null);
      setComposing(false);
      setShowEmoji(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSubmitting(false);
    }
  }

  /** 💬 评论按钮行为：项目=定位到第一条评论；文章/其他=展开输入框 */
  function handleCommentButton() {
    if (kind === "project") {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!user) {
      openLogin();
      return;
    }
    setComposing(true);
    setShowEmoji(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  /** 插入表情（追加到输入末尾） */
  function insertEmoji(emoji: string) {
    setCommentInput((v) => v + emoji);
    setShowEmoji(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  /** 打开/关闭浮动表情面板（按按钮位置直接算坐标：优先贴按钮上方，空间不足放下方） */
  function toggleEmoji() {
    if (showEmoji) {
      setShowEmoji(false);
      return;
    }
    const btn = emojiBtnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 316));
      if (r.top > 210) {
        // 按钮上方空间足够：面板底边贴按钮顶 8px（fixed bottom 锚定，高度自适应）
        setEmojiPos({ left, bottom: window.innerHeight - r.top + 8 });
      } else {
        // 空间不足：落到按钮下方
        setEmojiPos({ left, top: r.bottom + 8 });
      }
    }
    setShowEmoji(true);
  }

  const loggedIn = Boolean(user);

  // 项目详情：输入框通过 portal 渲染到弹窗底部固定栏，列表留在滚动流中
  const usePortal = Boolean(inputHostRef);
  const inputArea = (
    <div className={kind === "project" ? "pt-1.5" : ""}>
      {/* ===== 回复横幅：位于输入框上方（两行 14px，左缘与输入文字对齐） ===== */}
      <AnimatePresence>
        {composing && loggedIn && replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-1.5 pl-2.5 md:pl-3">
              {/* 第一行：回复 XXX（昵称与"回复"同色，输入框展开后无头像，文字靠左） */}
              <div className="text-[14px] font-medium text-slate-700 dark:text-slate-200">
                回复 {replyTo.email_user_name || "匿名"}
              </div>
              <div className="mt-0.5 text-[14px] text-slate-500 dark:text-slate-400 truncate">
                {replyTo.content}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 评论条：第一行 = 输入框（头像在输入框内部），展开时原地变全宽 ===== */}
      <div className="flex items-center">
        <div
          className={`flex-1 min-w-0 flex items-center gap-2 rounded-[21px] bg-slate-100/80 dark:bg-slate-800/70 border min-h-[42px] transition-colors ${
            composing && loggedIn
              ? "py-[11px] px-2.5 md:px-3 border-indigo-300 dark:border-indigo-500/50"
              : "pl-[5px] pr-3 py-[6px] border-white/40 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50"
          }`}
        >
          {/* 头像：距输入框左边 5px（输入框展开输入时隐藏） */}
          {!(composing && loggedIn) && (
            <button
              type="button"
              onClick={() => (loggedIn ? setComposing((v) => !v) : openLogin())}
              className="shrink-0 rounded-full overflow-hidden"
              aria-label="头像"
            >
              <div
                className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold ${
                  loggedIn
                    ? "bg-gradient-to-br from-indigo-400 to-sky-400 dark:from-indigo-600 dark:to-sky-600 text-white text-xs md:text-sm"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-300"
                }`}
              >
                {loggedIn
                  ? (user!.nickname || user!.email || "?").slice(0, 1).toUpperCase()
                  : <UserRound className="w-4 h-4" />}
              </div>
            </button>
          )}

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
              className="flex-1 min-w-0 min-h-5 max-h-40 bg-transparent text-[13px] md:text-sm leading-[20px] text-justify text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none outline-none overflow-y-auto"
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

        {/* 💬 评论数 / ♡ 点赞：说说由卡片底部按钮承载时隐藏；输入框展开后隐藏 */}
        {!hideActions && !(composing && loggedIn) && (
          <>
            {/* 💬 评论数 */}
            <button
              type="button"
              onClick={handleCommentButton}
              className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold text-slate-400 dark:text-slate-500 hover:text-indigo-500 transition-colors cursor-pointer ${
                kind === "project" ? "order-3" : ""
              }`}
              aria-label="评论"
            >
              <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
              <span className="tabular-nums">
                {(totalCount ?? 0) > 0 ? totalCount : "评论"}
              </span>
            </button>

            {/* ♡ 点赞 */}
            <button
              type="button"
              onClick={toggleEntityLike}
              disabled={likeBusy}
              className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-all cursor-pointer ${
                kind === "project" ? "order-2" : ""
              } ${
                entityLiked
                  ? "text-pink-500"
                  : "text-slate-400 dark:text-slate-500 hover:text-pink-500"
              }`}
              aria-label="点赞"
            >
              <Heart
                className={`w-4 h-4 md:w-5 md:h-5 transition-all ${
                  entityLiked ? "fill-pink-500 scale-110" : ""
                }`}
              />
              <span className="tabular-nums">
                {entityLikes > 0 ? entityLikes : "点赞"}
              </span>
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
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  type="button"
                  ref={emojiBtnRef}
                  onClick={toggleEmoji}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    showEmoji
                      ? "bg-indigo-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300"
                      : "text-slate-400 dark:text-slate-500 hover:bg-indigo-50 dark:hover:bg-slate-800"
                  }`}
                  title="插入表情"
                >
                  <Smile className="w-4 h-4 md:w-5 md:h-5" />
                </button>

              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={!commentInput.trim() || submitting}
                  className="flex items-center justify-center min-w-[64px] px-4 py-1.5 rounded-full bg-indigo-600 text-xs md:text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                  发送
                </button>
                <button
                  type="button"
                  onClick={cancelCompose}
                  className="min-w-[64px] px-4 py-1.5 rounded-full text-xs md:text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 浮动表情面板：portal 到 body，fixed 定位在表情按钮上方 */}
      {showEmoji &&
        typeof document !== "undefined" &&
        emojiPos &&
        createPortal(
          <div className="fixed inset-0 z-[300]" onClick={() => setShowEmoji(false)}>
            <div
              className="absolute w-[300px] max-w-[85vw]"
              style={{ left: emojiPos.left, top: emojiPos.top, bottom: emojiPos.bottom }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 grid grid-cols-10 gap-0.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl max-h-44 overflow-y-auto">
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
            </div>
          </div>,
          document.body
        )}
    </div>
  );

  return (
    <div>
      {!usePortal && inputArea}
      {/* ===== 评论列表 ===== */}
      <div ref={listRef} className={kind === "project" ? "mt-0" : "mt-3"}>
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
              <div className="text-center py-3 text-xs md:text-sm text-slate-400">
                暂时没有评论
              </div>
            )}

            {!commentsLoading && comments.length > 0 && (
              <div className={kind === "project" ? "" : "space-y-3 md:space-y-4"}>
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    flat
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
      </div>
      {/* 项目详情：输入区渲染到弹窗底部固定栏 */}
      {inputHost ? createPortal(inputArea, inputHost) : null}
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
  flat = false,
}: {
  comment: CommentItem;
  expandedReplies: Set<string>;
  onReply: (c: CommentItem) => void;
  onToggleReplies: (id: string) => void;
  likedCommentIds: Set<string>;
  onCommentLike: (id: string) => void;
  flat?: boolean;
}) {
  const isExpanded = expandedReplies.has(comment.id);
  const flatReplies = flattenReplies(comment.replies ?? []);
  const replyCount = flatReplies.length;
  // 二级评论默认只展示第一条，其余折叠
  const restCount = Math.max(0, replyCount - 1);

  const nameText = comment.email_user_name || "匿名用户";

  /* ---- 扁平样式（项目详情：截图同款） ---- */
  if (flat) {
    return (
      <div className="py-3 md:py-4">
        <div className="flex items-start gap-2.5 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-indigo-400 to-sky-400 dark:from-indigo-600 dark:to-sky-600 flex items-center justify-center text-white text-xs md:text-sm font-bold shrink-0">
            {(comment.email_user_name || "匿").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] md:text-[14px] font-medium text-slate-700 dark:text-slate-200 truncate">
                {nameText}
              </span>
              <span className="text-[13px] md:text-[14px] text-slate-400 dark:text-slate-500 shrink-0">
                {relativeTime(comment.created_at)}
              </span>
            </div>
            <p className="mt-1 text-[13px] md:text-sm text-justify text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
              {comment.content}
            </p>
            <div className="mt-1.5 md:mt-2 flex items-center justify-end gap-4 md:gap-5 text-[12px] md:text-sm text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => onCommentLike(comment.id)}
                className={`flex items-center gap-1 transition-colors cursor-pointer ${
                  likedCommentIds.has(comment.id)
                    ? "text-pink-500"
                    : "hover:text-pink-500"
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-all ${
                    likedCommentIds.has(comment.id) ? "fill-pink-500" : ""
                  }`}
                />
                <span>{comment.likes > 0 ? comment.likes : "点赞"}</span>
              </button>
              <button
                type="button"
                onClick={() => onReply(comment)}
                className="flex items-center gap-1 hover:text-sky-500 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{replyCount > 0 ? replyCount : "回复"}</span>
              </button>
            </div>
          </div>
        </div>
        {replyCount > 0 && (
          <div className="mt-1 pl-10 md:pl-[52px]">
            <ReplyCard
              reply={flatReplies[0]}
              flat
              onReply={onReply}
              likedCommentIds={likedCommentIds}
              onCommentLike={onCommentLike}
            />
            {isExpanded &&
              flatReplies.slice(1).map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  flat
                  onReply={onReply}
                  likedCommentIds={likedCommentIds}
                  onCommentLike={onCommentLike}
                />
              ))}
            {restCount > 0 && (
              <button
                type="button"
                onClick={() => onToggleReplies(comment.id)}
                className="text-[12px] md:text-xs text-slate-400 hover:text-indigo-500 transition-colors py-1 cursor-pointer"
              >
                {isExpanded ? "收起回复" : `展开 ${restCount} 条回复`}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---- 卡片样式（文章 / 说说） ---- */
  return (
    <div className="rounded-2xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
      <div className="p-3 md:p-5">
        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
          {/* 头像：昵称首字（与评论输入框风格一致） */}
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-indigo-400 to-sky-400 dark:from-indigo-600 dark:to-sky-600 flex items-center justify-center text-white text-xs md:text-sm font-bold shrink-0">
            {(comment.email_user_name || "匿").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200">
              {nameText}
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
              {flatReplies.map((reply) => (
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
  flat = false,
}: {
  reply: CommentItem & { replyToUser?: string };
  onReply: (c: CommentItem) => void;
  likedCommentIds: Set<string>;
  onCommentLike: (id: string) => void;
  flat?: boolean;
}) {
  const nameText = reply.email_user_name || "匿名用户";

  /* ---- 扁平样式（项目详情：截图同款） ---- */
  if (flat) {
    return (
      <div className="py-2">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-indigo-400 to-sky-400 dark:from-indigo-600 dark:to-sky-600 flex items-center justify-center text-white text-[10px] md:text-xs font-bold mt-0.5 shrink-0">
            {(reply.email_user_name || "匿").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] md:text-[14px] font-medium text-slate-700 dark:text-slate-200 truncate">
                {nameText}
              </span>
              <span className="text-[13px] md:text-[14px] text-slate-400 dark:text-slate-500 shrink-0">
                {relativeTime(reply.created_at)}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] md:text-sm text-justify text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
              {reply.replyToUser && (
                <span className="text-sky-500 dark:text-sky-400 mr-1">
                  回复 @{reply.replyToUser}：
                </span>
              )}
              {reply.content}
            </p>
            <div className="mt-1 flex items-center justify-end gap-4 md:gap-5 text-[12px] md:text-sm text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => onCommentLike(reply.id)}
                className={`flex items-center gap-1 transition-colors cursor-pointer ${
                  likedCommentIds.has(reply.id)
                    ? "text-pink-500"
                    : "hover:text-pink-500"
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-all ${
                    likedCommentIds.has(reply.id) ? "fill-pink-500" : ""
                  }`}
                />
                <span>{reply.likes > 0 ? reply.likes : "点赞"}</span>
              </button>
              <button
                type="button"
                onClick={() => onReply(reply)}
                className="flex items-center gap-1 hover:text-sky-500 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>回复</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 md:px-5 md:py-3 border-b border-slate-200/30 dark:border-white/5 last:border-0">
      <div className="flex items-start gap-2 md:gap-3">
        {/* 头像：昵称首字 */}
        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-indigo-400 to-sky-400 dark:from-indigo-600 dark:to-sky-600 flex items-center justify-center text-white text-[10px] md:text-xs font-bold mt-0.5 shrink-0">
          {(reply.email_user_name || "匿").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
            <span className="text-[10px] md:text-xs font-semibold text-slate-700 dark:text-slate-300">
              {nameText}
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
