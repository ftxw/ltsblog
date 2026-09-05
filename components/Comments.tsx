"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reply, Send, Heart, MessageCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import { relativeTime, flattenReplies } from "@/app/lib/format";

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
}

export default function Comments<T extends CommentItem>({
  targetId,
  kind,
  getComments,
  createComment,
  likeComment,
  likedKey: likedKeyProp,
  showErrorRetry = false,
}: CommentsProps<T>) {
  const likedKey = likedKeyProp ?? `liked_${kind}_comments`;
  const [nicknameInput, setNicknameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [websiteInput, setWebsiteInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const saved = localStorage.getItem(likedKey);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // 加载评论
  useEffect(() => {
    let active = true;
    getComments(targetId)
      .then((data) => {
        if (active) setComments(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // 仅在开启 showErrorRetry 时记录错误态（供重试 UI 使用），
        // 否则与旧行为一致：静默失败。
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

  function cancelReply() {
    setReplyTo(null);
    setCommentInput("");
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
    setReplyTo(c);
    setCommentInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
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

  async function handleSubmitComment() {
    if (!commentInput.trim() || submitting) return;
    const name = nicknameInput.trim();
    if (!name) {
      alert("请输入昵称");
      return;
    }
    if (name.length > 20) {
      alert("昵称最多 20 个字符");
      return;
    }
    setSubmitting(true);
    try {
      // 同步确认身份：带上昵称/邮箱/网址匿名登录，拿到 token 后发评论
      const loginRes = await fetch("/api/auth/anonymous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: name,
          email: emailInput.trim(),
          website: websiteInput.trim(),
        }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || "登录失败");
      localStorage.setItem("anonymous_token", loginData.token);
      localStorage.setItem("anonymous_user", JSON.stringify(loginData.user));

      const nc = await createComment({
        targetId,
        content: commentInput.trim(),
        parent_id: replyTo?.id,
      });
      if (replyTo) {
        const topId = findTopLevelId(comments, replyTo.id) ?? replyTo.id;
        setComments((p) => insertReply(p, replyTo.id, { ...nc, replies: [] }));
        setExpandedReplies((p) => new Set([...p, topId]));
      } else {
        setComments((p) => [...p, { ...nc, replies: [] }]);
      }
      setCommentInput("");
      setReplyTo(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* 输入框 */}
      <div className="rounded-2xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 overflow-hidden">
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1.5 px-2 pt-2 pb-0 text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
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
                  onClick={cancelReply}
                  className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="p-2.5 md:p-3">
          <textarea
            ref={inputRef}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder={replyTo ? "写下你的回复..." : "说点什么吧..."}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                handleSubmitComment();
            }}
            className="w-full bg-transparent text-xs md:text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none outline-none"
          />
          {/* 身份信息 + 发送：发送时同步确认（匿名登录），无需单独确认按钮 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 pt-2 md:mt-3 md:pt-3 border-t border-slate-200/50 dark:border-white/5">
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="昵称"
              maxLength={20}
              className="flex-1 min-w-[80px] bg-transparent px-1 py-0 text-xs md:text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />
            <span className="text-slate-300 dark:text-slate-600 select-none">|</span>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="邮箱"
              maxLength={320}
              className="flex-1 min-w-[120px] bg-transparent px-1 py-0 text-xs md:text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />
            <span className="text-slate-300 dark:text-slate-600 select-none">|</span>
            <input
              type="url"
              value={websiteInput}
              onChange={(e) => setWebsiteInput(e.target.value)}
              placeholder="网址（选填）"
              maxLength={1024}
              className="flex-1 min-w-[120px] bg-transparent px-1 py-0 text-xs md:text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />
            <button
              type="button"
              onClick={handleSubmitComment}
              disabled={!commentInput.trim() || submitting}
              title="发送"
              className="flex items-center justify-center p-0 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors flex-shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

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

      {commentsLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-10 rounded-xl bg-white/30 dark:bg-slate-700/20 animate-pulse"
            />
          ))}
        </div>
      )}

      {!commentsLoading && comments.length > 0 && (
        <div className="space-y-3 md:space-y-4 mt-3 md:mt-4">
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
