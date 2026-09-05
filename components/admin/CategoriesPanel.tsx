"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { GripVertical } from "lucide-react";
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
  Textarea,
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

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  post_count: number;
  created_at: string;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
}

const emptyForm: FormState = { name: "", slug: "", description: "" };

/** 可拖拽排序的分类行 */
function SortableCategoryRow({
  cat,
  onEdit,
  onDelete,
}: {
  cat: CategoryItem;
  onEdit: (cat: CategoryItem) => void;
  onDelete: (cat: CategoryItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "grid grid-cols-[4%_20%_12%_26%_8%_16%_14%] cursor-grab border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50/70 active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      {/* 排序（拖拽手柄） */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center text-slate-300">
        <GripVertical className="h-4 w-4" />
      </div>
      {/* 名称（左对齐） */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate font-medium text-slate-900">
          {cat.name}
        </span>
      </div>
      {/* slug */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate font-mono text-xs">{cat.slug}</span>
      </div>
      {/* 描述 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate text-slate-500">
          {cat.description || "-"}
        </span>
      </div>
      {/* 文章数 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
        {cat.post_count}
      </div>
      {/* 创建时间 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-xs text-slate-500">
        {formatDate(cat.created_at)}
      </div>
      {/* 操作 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
        <Button size="sm" variant="ghost" onClick={() => onEdit(cat)}>
          编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onDelete(cat)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

export interface CategoriesPanelHandle {
  openCreate: () => void;
}

/** 分类管理面板：可嵌入文章管理页的「分类」标签页 */
const CategoriesPanel = forwardRef<CategoriesPanelHandle>(function CategoriesPanel(
  _props,
  ref
) {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();
  const { data, setData, loading, reload } = useApi<CategoryItem[]>(
    "/api/categories"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  useImperativeHandle(ref, () => ({ openCreate }));

  const list = data ?? [];

  const commitReorder = async (ids: string[]) => {
    try {
      await apiJson("/api/categories/reorder", {
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
  } = useDragSort<CategoryItem>({
    items: list,
    onReorder: (nextIds) =>
      setData((prev) => (prev ? reorderItemsByIds(prev, nextIds) : prev)),
    onCommit: commitReorder,
  });

  const openEdit = (cat: CategoryItem) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
    });
    setModalOpen(true);
  };

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
        description: form.description,
      };
      if (editing) {
        await apiJson(`/api/categories/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        addToast("success", "分类已更新");
      } else {
        await apiJson("/api/categories", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "分类已创建");
      }
      setModalOpen(false);
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: CategoryItem) => {
    const ok = await confirm(
      "删除分类",
      `确定删除分类「${cat.name}」？该分类下有 ${cat.post_count} 篇文章。`
    );
    if (!ok) return;
    try {
      await apiJson(`/api/categories/${cat.id}`, { method: "DELETE" });
      addToast("success", "分类已删除");
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
          <EmptyState text="暂无分类" />
        ) : (
          // CSS Grid 表格：与文章管理同写法
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[4%_20%_12%_26%_8%_16%_14%] border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
              <div className="h-11" />
              {["名称", "slug", "描述", "文章数", "创建时间", "操作"].map(
                (h) => (
                  <div
                    key={h}
                    className="flex h-11 overflow-hidden items-center justify-center px-4"
                  >
                    {h}
                  </div>
                )
              )}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={sortIds} strategy={strategy}>
                {list.map((cat) => (
                  <SortableCategoryRow
                    key={cat.id}
                    cat={cat}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "编辑分类" : "新建分类"}
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
              placeholder="分类名称"
            />
          </Field>
          <Field label="slug" required>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="url-slug"
            />
          </Field>
          <Field label="描述">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="分类描述（可选）"
            />
          </Field>
        </div>
      </Modal>

      {confirmElement}
    </>
  );
});

export default CategoriesPanel;
