"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, useApi, formatDate } from "@/components/admin/lib";
import {
  Button,
  Card,
  EmptyState,
  Loading,
  Select,
  StatusBadge,
  cn,
  useConfirm,
} from "@/components/admin/ui";

interface CommentItem {
  id: string;
  parent_id: string | null;
  content: string;
  ip: string;
  status: string;
  created_at: string;
  email_user_name?: string | null;
  email_user_avatar?: string | null;
  post?: { title: string; id: string } | null;
  /** 说说评论（评论统一管理里 kind=chatter 时挂在 chatter 上） */
  chatter?: { title: string; id: string } | null;
  replies?: CommentItem[];
}

const PAGE_SIZE = 20;

/** 递归展开嵌套回复为扁平列表（带层级深度） */
function flattenReplies(
  replies: CommentItem[] | undefined,
  depth = 1
): Array<CommentItem & { _depth: number }> {
  const result: Array<CommentItem & { _depth: number }> = [];
  for (const reply of replies ?? []) {
    result.push({ ...reply, _depth: depth });
    result.push(...flattenReplies(reply.replies, depth + 1));
  }
  return result;
}

function UserCell({ comment }: { comment: CommentItem }) {
  if (comment.email_user_avatar) {
    return (
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={comment.email_user_avatar}
          alt=""
          className="h-6 w-6 rounded-full"
        />
        <span className="text-sm text-slate-700">
          {comment.email_user_name || "匿名用户"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500">
        {(comment.email_user_name || "匿").slice(0, 1)}
      </div>
      <span className="text-sm text-slate-700">
        {comment.email_user_name || "匿名用户"}
      </span>
    </div>
  );
}

function CommentRow({
  comment,
  onStatus,
  onDelete,
}: {
  comment: CommentItem & { _depth?: number };
  onStatus: (c: CommentItem, status: string) => void;
  onDelete: (c: CommentItem) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg bg-slate-50 p-3",
        comment._depth ? "bg-white border border-slate-100" : ""
      )}
      style={{ marginLeft: (comment._depth ?? 0) * 24 }}
    >
      <UserCell comment={comment} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-slate-800">{comment.content}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <StatusBadge status={comment.status} />
          <span>{formatDate(comment.created_at)}</span>
          <span className="font-mono">{comment.ip || "-"}</span>
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {comment.status !== "approved" && (
          <Button size="sm" variant="ghost" onClick={() => onStatus(comment, "approved")}>
            通过
          </Button>
        )}
        {comment.status !== "rejected" && (
          <Button size="sm" variant="ghost" onClick={() => onStatus(comment, "rejected")}>
            拒绝
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onDelete(comment)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

/**
 * 评论管理面板：可复用于文章管理 / 说说管理的「评论」标签页。
 *
 * kind: "post"   → 走 /api/comments/admin（文章评论）
 *       "moment" → 走 /api/chatters/comments/admin（说说评论）
 */
export default function CommentsAdminPanel({
  kind,
  showOwner = false,
}: {
  kind: "post" | "moment";
  showOwner?: boolean;
}) {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
    const base = kind === "post" ? "/api/comments/admin" : "/api/chatters/comments/admin";
    return `${base}?${params.toString()}`;
  }, [kind, status, page]);

  const { data, loading, reload } = useApi<{ items: CommentItem[] }>(listUrl);
  const comments = data?.items ?? [];
  const hasMore = comments.length >= PAGE_SIZE;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatus = async (comment: CommentItem, next: string) => {
    try {
      const base = kind === "post" ? "comments" : "chatters/comments";
      await apiJson(`/api/${base}/${comment.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      addToast("success", next === "approved" ? "已通过" : "已拒绝");
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleDelete = async (comment: CommentItem) => {
    const ok = await confirm("删除评论", "确定删除这条评论？其子回复将一并删除。");
    if (!ok) return;
    try {
      const base = kind === "post" ? "comments" : "chatters/comments";
      await apiJson(`/api/${base}/${comment.id}`, { method: "DELETE" });
      addToast("success", "评论已删除");
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="!w-28 !py-1"
        >
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm tabular-nums text-slate-400">第 {page} 页</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasMore}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        {loading && !data ? (
          <Loading />
        ) : comments.length === 0 ? (
          <EmptyState text="暂无评论" />
        ) : (
          comments.map((comment) => {
            const replies = flattenReplies(comment.replies);
            const isExpanded = expanded.has(comment.id);
            return (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3">
                  <UserCell comment={comment} />
                  <div className="min-w-0 flex-1">
                    {showOwner && comment[kind === "post" ? "post" : "chatter"]?.title && (
                      <p className="mb-1 truncate text-xs text-indigo-500">
                        《{comment[kind === "post" ? "post" : "chatter"]!.title}》
                      </p>
                    )}
                    <p className="text-sm leading-relaxed text-slate-800">
                      {comment.content}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <StatusBadge status={comment.status} />
                      <span>{formatDate(comment.created_at)}</span>
                      <span className="font-mono">{comment.ip || "-"}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {comment.status !== "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatus(comment, "approved")}
                      >
                        通过
                      </Button>
                    )}
                    {comment.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatus(comment, "rejected")}
                      >
                        拒绝
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDelete(comment)}
                    >
                      删除
                    </Button>
                  </div>
                </div>

                {replies.length > 0 && (
                  <div className="pl-4">
                    <button
                      onClick={() => toggleExpand(comment.id)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      回复（{replies.length}）
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        {replies.map((reply) => (
                          <CommentRow
                            key={reply.id}
                            comment={reply}
                            onStatus={handleStatus}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

      {confirmElement}
    </>
  );
}
