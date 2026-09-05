"use client";

import { useRouter } from "next/navigation";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { GripVertical, Images, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, formatDateOnly, useApi } from "@/components/admin/lib";
import {
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";

interface AlbumItem {
  id: string;
  title: string;
  description: string;
  cover: string;
  layout: string;
  photo_count: number;
  sort: number;
  created_at: string;
  updated_at: string | null;
  published_at: string | null;
}

/** 可拖拽的相册卡片：整卡任何位置均可拖动，左上角拖动图标 + 右上角编辑/删除 */
function SortableAlbumCard({
  album,
  onOpen,
  onDelete,
}: {
  album: AlbumItem;
  onOpen: (id: string) => void;
  onDelete: (album: AlbumItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: album.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group cursor-pointer", isDragging && "relative z-10")}
      onClick={() => onOpen(album.id)}
      // 整卡绑定 dnd 监听：卡片任意位置按下都能拖动；
      // dnd-kit PointerSensor activationConstraint distance:5 保证短按仍触发 onClick 进入编辑
      {...attributes}
      {...listeners}
    >
      <Card
        className={cn(
          "relative flex flex-col overflow-hidden transition-shadow hover:shadow-md",
          isDragging && "opacity-70 ring-2 ring-inset ring-indigo-400"
        )}
      >
        <div className="aspect-video w-full overflow-hidden bg-slate-100">
          {album.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={album.cover}
              alt={album.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <Images className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-3">
          <p className="truncate font-medium text-slate-900">{album.title}</p>
          {album.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
              {album.description}
            </p>
          ) : null}
          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <p className="truncate text-xs text-slate-400">
              {album.photo_count} 张照片 ·{" "}
              {album.layout === "timeline" ? "时间轴" : "网格"}
            </p>
            <p className="shrink-0 text-xs text-slate-400">
              {formatDateOnly(album.published_at || album.updated_at)}
            </p>
          </div>
        </div>
        {/* 左上角：拖动提示图标（dnd 监听已绑在外层整卡，图标仅为视觉提示，pointer-events-none 防止阻挡 drag） */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-slate-500 shadow-sm"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        {/* 右上角：编辑 / 删除按钮（独立按钮阻止冒泡，避免触发外层 onClick） */}
        <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            title="编辑相册"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(album.id);
            }}
            className="rounded-md bg-white/90 p-1 text-slate-600 hover:text-indigo-600 cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            title="删除相册"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(album);
            }}
            className="rounded-md bg-white/90 p-1 text-slate-600 hover:text-red-600 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>
    </div>
  );
}

export default function AdminAlbumsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const albums = useApi<AlbumItem[]>("/api/albums");
  const items = albums.data ?? [];

  const deleteAlbum = async (album: AlbumItem) => {
    const ok = await confirm(
      "删除相册",
      `确定删除相册「${album.title}」及其全部 ${album.photo_count} 张照片？`
    );
    if (!ok) return;
    try {
      await apiJson(`/api/albums/${album.id}`, { method: "DELETE" });
      addToast("success", "相册已删除");
      albums.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  /** 排序：松手后按最终顺序持久化 */
  const commitReorder = async (ids: string[]) => {
    try {
      await apiJson("/api/albums/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      addToast("success", "排序已更新");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      albums.reload();
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
  } = useDragSort<AlbumItem>({
    items,
    onReorder: (nextIds) =>
      albums.setData((prev) =>
        Array.isArray(prev) ? reorderItemsByIds(prev, nextIds) : prev
      ),
    onCommit: commitReorder,
    strategy: "rect",
  });

  return (
    <>
      <PageHeader
        title="相册管理"
        description={`共 ${items.length} 个相册 · 拖拽卡片右上角手柄可排序`}
        actions={
          <Button onClick={() => router.push("/admin/albums/new")}>
            <Plus className="h-4 w-4" />
            新建相册
          </Button>
        }
      />

      {albums.loading && !albums.data ? (
        <Card>
          <Loading />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState text="暂无相册，点击右上角「新建相册」创建" />
        </Card>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((album) => (
                <SortableAlbumCard
                  key={album.id}
                  album={album}
                  onOpen={(id) => router.push(`/admin/albums/${id}`)}
                  onDelete={deleteAlbum}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {confirmElement}
    </>
  );
}
