"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, useApi, formatDate } from "@/components/admin/lib";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";
import CommentsAdminPanel from "@/components/admin/CommentsAdminPanel";

interface MomentItem {
  id: string;
  content: string;
  images: string[];
  likes: number;
  comments_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FormState {
  content: string;
  images: string[];
  status: string;
}

const PAGE_SIZE = 10;
const emptyForm: FormState = { content: "", images: [], status: "published" };

export default function AdminMomentsPage() {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<"moments" | "comments">("moments");
  const commentsCount = useApi<{ items: unknown[]; total: number }>(
    "/api/chatters/comments/admin?page=1&size=1"
  );

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (searchText.trim()) params.set("keyword", searchText.trim());
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
    return `/api/chatters/admin?${params.toString()}`;
  }, [status, searchText, page]);

  const { data, loading, reload } = useApi<{
    items: MomentItem[];
    total: number;
  }>(listUrl);
  const moments = data?.items ?? [];
  const total = data?.total ?? 0;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MomentItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openEdit = (m: MomentItem) => {
    setEditing(m);
    setForm({
      content: m.content,
      images: m.images ?? [],
      
      status: m.status,
    });
    setModalOpen(true);
  };

  /** 点击「发布说说」：先创建一条空草稿（status=draft）拿到 id，
   *  这样后续配图能进入 moments/{id}/ 子目录（解决"第一个没子目录"问题）。
   *  草稿前台不展示，模态中用户填好内容后点保存走 PUT 即可。 */
  const openNewWithDraft = async () => {
    try {
      // 用单空格作为占位 content（API 校验 content 非空且是 string；单空格 trim 后仍 1 字符能通过）
      const raw = await apiJson<{
        id: string;
        content: string;
        images?: string | string[];
        status: string;
        created_at: string;
        updated_at: string;
      }>("/api/chatters", {
        method: "POST",
        body: JSON.stringify({ content: " ", status: "draft" }),
      });
      // POST /api/chatters 直接返回 chatter 行，images 字段是 JSON 字符串 → 解析为数组
      const images = Array.isArray(raw.images)
        ? raw.images
        : (() => {
            try {
              const parsed = JSON.parse((raw.images as string) || "[]");
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })();
      const draft: MomentItem = {
        id: raw.id,
        content: raw.content,
        images,
        likes: 0,
        comments_count: 0,
        status: raw.status,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
      };
      setEditing(draft);
      setForm({
        content: draft.content === " " ? "" : draft.content,
        images: draft.images,
        status: draft.status,
      });
      setModalOpen(true);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "创建草稿失败");
    }
  };

  /** 关闭模态：若该条记录是「新建未填内容」的空草稿，删除清理 */
  const closeModal = async () => {
    if (
      editing &&
      form.content.trim() === "" &&
      (editing.content === " " || editing.content.trim() === "")
    ) {
      try {
        await apiJson(`/api/chatters/${editing.id}`, { method: "DELETE" });
      } catch {
        /* 清理失败不影响 UI 关闭 */
      }
    }
    setModalOpen(false);
  };

  const handleSave = async () => {
    if (!form.content.trim()) {
      addToast("warning", "说说内容不能为空");
      return;
    }
    setSaving(true);
    try {
      const body = {
        content: form.content.trim(),
        images: form.images,
        
        status: form.status,
      };
      if (editing) {
        await apiJson(`/api/chatters/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        addToast("success", "说说已更新");
      } else {
        // 兼容路径（新建草稿流程已切换到 openNewWithDraft → editing 总有 id；这里只是兜底）
        await apiJson("/api/chatters", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "说说已发布");
      }
      closeModal();
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: MomentItem) => {
    const ok = await confirm("删除说说", "确定删除这条说说？");
    if (!ok) return;
    try {
      await apiJson(`/api/chatters/${m.id}`, { method: "DELETE" });
      addToast("success", "说说已删除");
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      <PageHeader
        title="说说管理"
        description="发布、编辑说说动态"
      />

      {/* 标签页：说说 / 评论 + 新建按钮（与书签页同样式） */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("moments")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "moments"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          说说（{total}）
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("comments")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "comments"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          评论（{commentsCount.data?.total ?? 0}）
        </button>
        <Button
          size="sm"
          className="ml-auto"
          onClick={openNewWithDraft}
        >
          <Plus className="h-3.5 w-3.5" />
          发布说说
        </Button>
      </div>

      {activeTab === "comments" ? (
        <CommentsAdminPanel kind="moment" />
      ) : (
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
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </Select>
        <form
          className="ml-auto flex gap-2"
          style={{ minWidth: 180 }}
          onSubmit={(e) => {
            e.preventDefault();
            setSearchText(keyword);
            setPage(1);
          }}
        >
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索说说内容"
            className="!w-44 !py-1"
          />
          <Button type="submit" variant="secondary" className="whitespace-nowrap !py-1">
            搜索
          </Button>
        </form>
      </Card>

      <Card>
        {loading && !data ? (
          <Loading />
        ) : moments.length === 0 ? (
          <EmptyState text="暂无说说" />
        ) : (
          // CSS Grid 表格：与文章管理同风格
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[35%_10%_8%_8%_20%_19%] border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
            {["内容", "状态", "点赞", "评论", "发布时间", "操作"].map((h) => (
              <div
                key={h}
                className="flex h-11 overflow-hidden items-center justify-center px-4"
              >
                {h}
              </div>
            ))}
          </div>
          {moments.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[35%_10%_8%_8%_20%_19%] border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50/70"
            >
              {/* 内容（左对齐） */}
              <div className="flex h-[60px] overflow-hidden items-center justify-start gap-2 px-4">
                <p className="min-w-0 flex-1 truncate font-medium text-slate-900">
                  {m.content}
                </p>
                {m.images.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element -- 说说配图走图床/代理，原生 img 直连
                  <img
                    src={m.images[0]}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-9 w-14 shrink-0 rounded object-cover"
                  />
                )}
              </div>
              {/* 状态 */}
              <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                <StatusBadge status={m.status} />
              </div>
              {/* 点赞 */}
              <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                {m.likes}
              </div>
              {/* 评论 */}
              <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                {m.comments_count}
              </div>
              {/* 发布时间 */}
              <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-xs text-slate-500">
                {formatDate(m.created_at)}
              </div>
              {/* 操作 */}
              <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
                <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleDelete(m)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
          </div>
        )}

        <div className="px-4 pb-3">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
          />
        </div>
      </Card>
        </>
      )}

      <Modal
        open={modalOpen}
        title={editing ? "编辑说说" : "发布说说"}
        onClose={closeModal}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "保存" : "发布"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="内容" required>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              placeholder="这一刻的想法…"
            />
          </Field>
          <Field label="配图" hint="支持批量上传">
            <ImageUploader
              mode="multi"
              value={form.images}
              onChange={(images) => setForm({ ...form, images })}
              category="moments"
              folder={editing ? String(editing.id) : undefined}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="状态">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="published">发布</option>
                <option value="draft">仅自己可见（草稿）</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      {confirmElement}
    </>
  );
}
