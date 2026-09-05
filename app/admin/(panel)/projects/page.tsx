"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, formatDate, useApi } from "@/components/admin/lib";
import { Button, Card, useConfirm } from "@/components/admin/ui";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";
import { thumbUrlOf, fallbackThumbImage } from "@/app/lib/image-thumb";
import type { ProjectItem } from "@/components/admin/ProjectEditor";

const PAGE_SIZE = 15;

export default function AdminProjectsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [page, setPage] = useState(1);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
    return `/api/projects/admin?${params.toString()}`;
  }, [page]);

  const { data, setData, reload } = useApi<{
    items: ProjectItem[];
    total: number;
    page: number;
    size: number;
  }>(listUrl);

  const list = data?.items ?? [];

  /** 排序：松手后按最终顺序持久化 */
  const commitReorder = async (ids: string[]) => {
    try {
      await apiJson("/api/projects/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      addToast("success", "排序已更新");
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
  } = useDragSort<ProjectItem>({
    items: list,
    onReorder: (nextIds) =>
      setData((prev) =>
        prev
          ? { ...prev, items: reorderItemsByIds(prev.items, nextIds) }
          : prev
      ),
    onCommit: commitReorder,
    strategy: "vertical",
  });

  const handleDelete = async (p: ProjectItem) => {
    const ok = await confirm("删除项目", `确定删除项目「${p.name}」？`);
    if (!ok) return;
    try {
      await apiJson(`/api/projects/${p.id}`, { method: "DELETE" });
      addToast("success", "项目已删除");
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-slate-900">项目管理</h1>
        <Button onClick={() => router.push("/admin/projects/new")}>
          <Plus className="h-4 w-4" />
          新建项目
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {/* 列表头 */}
        <div className="grid grid-cols-[28%_10%_16%_8%_8%_16%_14%] border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
          {["项目", "状态", "技术栈", "点赞", "排序", "创建时间", "操作"].map((h) => (
            <div
              key={h}
              className="flex h-11 overflow-hidden items-center justify-center px-4"
            >
              {h}
            </div>
          ))}
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
            {list.map((p) => (
              <SortableProjectRow
                key={p.id}
                project={p}
                onEdit={() => router.push(`/admin/projects/${p.id}`)}
                onDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
        <div className="px-4 py-3 flex items-center justify-between text-sm text-slate-500">
          <span>共 {data?.total ?? 0} 个项目</span>
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span>
                {page} / {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= Math.ceil(data.total / PAGE_SIZE)}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      </Card>

      {confirmElement}
    </>
  );
}

function SortableProjectRow({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectItem;
  onEdit: () => void;
  onDelete: (p: ProjectItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const coverSrc = project.cover_image || project.images?.[0] || "";
  // coverSrc 变化时重置 broken（渲染期 prev 比较，避免 effect 内 setState）
  const [coverBroken, setCoverBroken] = useState(false);
  const [prevCoverKey, setPrevCoverKey] = useState(coverSrc);
  if (prevCoverKey !== coverSrc) {
    setPrevCoverKey(coverSrc);
    setCoverBroken(false);
  }
  const thumbSrc = coverBroken ? coverSrc : thumbUrlOf(coverSrc);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        isDragging
          ? "z-10 opacity-60 shadow-lg ring-2 ring-inset ring-indigo-400 grid grid-cols-[28%_10%_16%_8%_8%_16%_14%] cursor-grab border-b border-slate-100 bg-white text-slate-700 hover:bg-slate-50/70 active:cursor-grabbing"
          : "grid grid-cols-[28%_10%_16%_8%_8%_16%_14%] cursor-grab border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50/70 active:cursor-grabbing"
      }
      {...attributes}
      {...listeners}
    >
      <div className="flex h-[60px] overflow-hidden items-center justify-center gap-2 px-4">
        {thumbSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => fallbackThumbImage(e.currentTarget, coverSrc)}
            className="h-9 w-14 shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0">
          <span className="block truncate font-medium text-slate-900">
            {project.name}
            {project.is_featured && (
              <span className="ml-1 text-xs text-amber-500">★</span>
            )}
          </span>
        </div>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="text-xs">
          {project.status}
          {project.status_label && (
            <span className="ml-1 text-xs text-slate-400">
              {project.status_label}
            </span>
          )}
        </span>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate text-xs text-slate-500">
          {(project.tech_stack ?? []).join(" / ") || "-"}
        </span>
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
        {project.likes}
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-slate-300">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-xs text-slate-500">
        {formatDate(project.created_at)}
      </div>
      <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onDelete(project)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}
