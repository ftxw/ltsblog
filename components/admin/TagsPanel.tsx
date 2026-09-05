"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, useApi } from "@/components/admin/lib";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  useConfirm,
} from "@/components/admin/ui";

interface TagItem {
  id: string;
  name: string;
  slug: string;
  post_count: number;
}

interface FormState {
  name: string;
  slug: string;
}

const emptyForm: FormState = { name: "", slug: "" };

export interface TagsPanelHandle {
  openCreate: () => void;
}

/** 标签管理面板：可嵌入文章管理页的「标签」标签页 */
const TagsPanel = forwardRef<TagsPanelHandle>(function TagsPanel(_props, ref) {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();
  const { data, loading, reload } = useApi<TagItem[]>("/api/tags");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TagItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  useImperativeHandle(ref, () => ({ openCreate }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      addToast("warning", "名称和 slug 不能为空");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim(),
      };
      if (editing) {
        await apiJson(`/api/tags/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        addToast("success", "标签已更新");
      } else {
        await apiJson("/api/tags", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "标签已创建");
      }
      setModalOpen(false);
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagItem) => {
    const ok = await confirm("删除标签", `确定删除标签「${tag.name}」？`);
    if (!ok) return;
    try {
      await apiJson(`/api/tags/${tag.id}`, { method: "DELETE" });
      addToast("success", "标签已删除");
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      <Card>
        {loading && !data ? (
          <Loading />
        ) : (data ?? []).length === 0 ? (
          <EmptyState text="暂无标签" />
        ) : (
          // CSS Grid 表格：与文章管理同写法
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[30%_25%_20%_25%] border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
              {["名称", "slug", "文章数", "操作"].map((h) => (
                <div
                  key={h}
                  className="flex h-11 overflow-hidden items-center justify-center px-4"
                >
                  {h}
                </div>
              ))}
            </div>
            {(data ?? []).map((tag) => (
              <div
                key={tag.id}
                className="grid grid-cols-[30%_25%_20%_25%] border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50/70"
              >
                {/* 名称（左对齐） */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm text-indigo-600">
                    {tag.name}
                  </span>
                </div>
                {/* slug */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                  <span className="truncate font-mono text-xs">{tag.slug}</span>
                </div>
                {/* 文章数 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                  {tag.post_count}
                </div>
                {/* 操作 */}
                <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(tag);
                      setForm({ name: tag.name, slug: tag.slug });
                      setModalOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDelete(tag)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "编辑标签" : "新建标签"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="名称" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="标签名称"
            />
          </Field>
          <Field label="slug" required>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="url-slug"
            />
          </Field>
        </div>
      </Modal>

      {confirmElement}
    </>
  );
});

export default TagsPanel;
