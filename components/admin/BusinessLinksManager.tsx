"use client";

import { useState } from "react";
import { Eye, EyeOff, GripVertical, Plus } from "lucide-react";
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
  StatusBadge,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";

interface BusinessLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  sort: number;
  status: string;
}

const emptyForm = {
  name: "",
  url: "",
  icon: "",
  description: "",
  status: "active",
};

/** 可拖拽排序的业务链接卡片 */
function SortableLinkCard({
  link,
  onToggle,
  onEdit,
  onDelete,
}: {
  link: BusinessLink;
  onToggle: (link: BusinessLink) => void;
  onEdit: (link: BusinessLink) => void;
  onDelete: (link: BusinessLink) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex cursor-grab items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
        {link.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={link.icon} alt="" className="h-6 w-6 rounded" />
        ) : (
          link.name.slice(0, 1)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">
            {link.name}
          </span>
          <StatusBadge
            status={link.status === "active" ? "published" : "draft"}
          />
        </div>
        <p className="truncate text-xs text-slate-400">{link.url}</p>
        {link.description && (
          <p className="truncate text-xs text-slate-500">
            {link.description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="mr-0.5 text-slate-300">
          <GripVertical className="h-4 w-4" />
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onToggle(link)}
          title={link.status === "active" ? "隐藏" : "显示"}
        >
          {link.status === "active" ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(link)}>
          编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onDelete(link)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

/**
 * 业务链接管理器：嵌入「站点设置」页的分组面板。
 * 管理前台左下角悬浮按钮展示的链接（增删改/排序/显示隐藏）。
 */
export default function BusinessLinksManager() {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const { data, setData, loading, reload } = useApi<BusinessLink[]>(
    "/api/business-links?all=1"
  );
  const links = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessLink | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (link: BusinessLink) => {
    setEditing(link);
    setForm({
      name: link.name,
      url: link.url,
      icon: link.icon,
      description: link.description,
      status: link.status,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      addToast("error", "名称和链接不能为空");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiJson(`/api/business-links/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        addToast("success", "链接已更新");
      } else {
        await apiJson("/api/business-links", {
          method: "POST",
          body: JSON.stringify({ ...form, sort: links.length }),
        });
        addToast("success", "链接已添加");
      }
      setModalOpen(false);
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (link: BusinessLink) => {
    const ok = await confirm("删除链接", `确定删除「${link.name}」？`);
    if (!ok) return;
    try {
      await apiJson(`/api/business-links/${link.id}`, { method: "DELETE" });
      addToast("success", "链接已删除");
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  /** 排序：松手后按最终顺序持久化 */
  const commitReorder = async (ids: string[]) => {
    try {
      await apiJson("/api/business-links/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      addToast("success", "排序已更新");
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      reload();
    }
  };

  const {
    ids: sortIds,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    strategy,
  } = useDragSort<BusinessLink>({
    items: links,
    onReorder: (nextIds) =>
      setData((prev) => (prev ? reorderItemsByIds(prev, nextIds) : prev)),
    onCommit: commitReorder,
  });

  const handleToggleStatus = async (link: BusinessLink) => {
    try {
      await apiJson(`/api/business-links/${link.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: link.status === "active" ? "hidden" : "active",
        }),
      });
      addToast("success", link.status === "active" ? "已隐藏" : "已显示");
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            添加链接
          </Button>
        </div>

        {loading && !data ? (
          <Loading />
        ) : links.length === 0 ? (
          <EmptyState text="暂无链接，点击右上角「添加链接」开始" />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortIds} strategy={strategy}>
              <div className="space-y-2">
                {links.map((link) => (
                  <SortableLinkCard
                    key={link.id}
                    link={link}
                    onToggle={handleToggleStatus}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "编辑链接" : "添加链接"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "保存" : "添加"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="名称" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：我的图床"
            />
          </Field>
          <Field label="链接地址" required>
            <Input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com"
            />
          </Field>
          <Field label="图标 URL" hint="可选，填写后显示图标，留空显示首字母">
            <Input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="https://example.com/icon.png"
            />
          </Field>
          <Field label="描述" hint="可选">
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="一句话说明这个链接是干什么的"
            />
          </Field>
        </div>
      </Modal>

      {confirmElement}
    </>
  );
}
