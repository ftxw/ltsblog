"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, apiJson, uploadImage, formatDate } from "@/components/admin/lib";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";
import DateWheelPicker from "@/components/ui/DateWheelPicker";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";

interface PhotoItem {
  id: string;
  album_id: string;
  url: string;
  caption: string;
  taken_at: string;
  sort: number;
}

interface AlbumDetail {
  id: string;
  title: string;
  description: string;
  cover: string;
  layout: string;
  sort: number;
  photo_count: number;
  created_at: string;
  updated_at: string | null;
  published_at: string | null;
  photos: PhotoItem[];
}

/** 可拖拽排序的照片卡片 */
function SortablePhoto({
  photo,
  isCover,
  onSetCover,
  onEdit,
  onDelete,
}: {
  photo: PhotoItem;
  isCover: boolean;
  onSetCover: (photo: PhotoItem) => void;
  onEdit: (photo: PhotoItem) => void;
  onDelete: (photo: PhotoItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative cursor-grab overflow-hidden rounded-lg border border-slate-200 bg-slate-50 active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || "photo"}
        loading="lazy"
        decoding="async"
        className="aspect-square w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-xs text-white">
          {photo.caption || photo.taken_at?.slice(0, 10) || "无说明"}
        </p>
      </div>
      <button
        title={isCover ? "当前封面，点击取消" : "设为封面"}
        onClick={() => onSetCover(photo)}
        className={cn(
          "absolute left-1.5 top-1.5 z-10 rounded-md p-1 transition-opacity cursor-pointer",
          isCover
            ? "bg-indigo-500 text-white opacity-100"
            : "bg-white/90 text-slate-600 opacity-0 hover:text-indigo-600 group-hover:opacity-100"
        )}
      >
        <Pin className={cn("h-3.5 w-3.5", isCover && "fill-current")} />
      </button>
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          title="编辑信息"
          onClick={() => onEdit(photo)}
          className="rounded-md bg-white/90 p-1 text-slate-600 hover:text-indigo-600 cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          title="删除照片"
          onClick={() => onDelete(photo)}
          className="rounded-md bg-white/90 p-1 text-slate-600 hover:text-red-600 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** ISO 时间转为日期选择器的值（YYYY-MM-DD） */
function toDateInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AlbumEditor({ albumId }: { albumId?: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  // 当前正在编辑的相册 id：编辑页初始即存在；新建页在上传照片/保存时自动创建后写入
  const [currentId, setCurrentId] = useState<string | undefined>(albumId);
  const isNew = !currentId;
  const [loading, setLoading] = useState(Boolean(albumId));
  const [saving, setSaving] = useState(false);

  // 相册基本信息
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [layout, setLayout] = useState("grid");
  const [photoCount, setPhotoCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // 照片操作
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoEdit, setPhotoEdit] = useState<PhotoItem | null>(null);
  const [photoForm, setPhotoForm] = useState({ caption: "", taken_at: "" });
  const [photoSaving, setPhotoSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /** 将接口返回的相册数据一次性写入表单状态（setter 稳定，空依赖） */
  const applyAlbum = useCallback((album: AlbumDetail) => {
    setTitle(album.title);
    setDescription(album.description || "");
    setCover(album.cover || "");
    setLayout(album.layout || "grid");
    setPhotoCount(album.photo_count);
    setUpdatedAt(album.updated_at);
    setPublishedAt(toDateInputValue(album.published_at));
    setPhotos(album.photos || []);
  }, []);

  const loadAlbum = useCallback(
    async (id?: string) => {
      const aid = id ?? currentId;
      if (!aid) return;
      const album = await apiJson<AlbumDetail>(`/api/albums/${aid}`);
      applyAlbum(album);
    },
    [currentId, applyAlbum]
  );

  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    // 取数在 .then 异步回调中 setState，避免 effect 体内同步调用含 setState 的函数
    apiJson<AlbumDetail>(`/api/albums/${currentId}`)
      .then((album) => {
        if (!cancelled) applyAlbum(album);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        addToast("error", e.message);
        router.replace("/admin/albums");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentId, applyAlbum, addToast, router]);

  const saveAlbum = async () => {
    if (!title.trim()) {
      addToast("warning", "请填写相册标题");
      return;
    }
    setSaving(true);
    try {
      if (currentId) {
        await apiJson(`/api/albums/${currentId}`, {
          method: "PUT",
          body: JSON.stringify({
            title: title.trim(),
            description,
            cover,
            layout,
            published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
          }),
        });
        addToast("success", "相册已保存");
        await loadAlbum();
      } else {
        const res = await apiJson<{ data: AlbumDetail }>("/api/albums", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description,
            cover,
            layout,
            published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
          }),
        });
        addToast("success", "相册已创建");
        // 新建成功后直接进入该相册的编辑页继续上传照片
        setCurrentId(res.data.id);
        router.replace(`/admin/albums/${res.data.id}`);
      }
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  /** 新建模式下上传照片前先自动创建相册，拿到 id 再关联照片 */
  const ensureAlbum = async (): Promise<string> => {
    if (currentId) return currentId;
    const res = await apiJson<{ data: AlbumDetail }>("/api/albums", {
      method: "POST",
      body: JSON.stringify({
        title: title.trim() || "未命名相册",
        description,
        cover,
        layout,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
      }),
    });
    setCurrentId(res.data.id);
    return res.data.id;
  };

  const handleUploadPhotos = async (files: FileList) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setPhotoUploading(true);
    try {
      const aid = await ensureAlbum();
      let sortIdx = photos.length;
      for (const file of list) {
        // 相册照片存入 photowall/{相册id}/ 目录
        const { url } = await uploadImage(file, {
          category: "photowall",
          folder: String(aid),
        });
        const caption = file.name.replace(/\.[^/.]+$/, "");
        await apiJson("/api/albums/photos", {
          method: "POST",
          body: JSON.stringify({
            album_id: aid,
            url,
            caption,
            sort: sortIdx++,
          }),
        });
      }
      addToast("success", `已上传 ${list.length} 张照片`);
      await loadAlbum(aid);
      // 新建模式下 URL 保持 /albums/new，跳转到编辑页便于继续管理
      if (!albumId) router.replace(`/admin/albums/${aid}`);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "上传失败");
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const savePhoto = async () => {
    if (!photoEdit) return;
    setPhotoSaving(true);
    try {
      await apiJson(`/api/albums/photos/${photoEdit.id}`, {
        method: "PUT",
        body: JSON.stringify({
          caption: photoForm.caption,
          taken_at: photoForm.taken_at || undefined,
        }),
      });
      addToast("success", "照片信息已更新");
      setPhotoEdit(null);
      await loadAlbum();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setPhotoSaving(false);
    }
  };

  const deletePhoto = async (photo: PhotoItem) => {
    const ok = await confirm("删除照片", "确定删除这张照片？");
    if (!ok) return;
    try {
      await apiJson(`/api/albums/photos/${photo.id}`, { method: "DELETE" });
      addToast("success", "照片已删除");
      await loadAlbum();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  /** 设为封面：点击后写入封面并自动把该照片排到第一位；已是封面时点击则取消封面 */
  const setAsCover = async (photo: PhotoItem) => {
    const isCurrent = cover === photo.url;
    try {
      await apiJson(`/api/albums/${currentId}`, {
        method: "PUT",
        body: JSON.stringify({ cover: isCurrent ? "" : photo.url }),
      });
      const prevCover = cover;
      const nextCover = isCurrent ? "" : photo.url;
      setCover(nextCover);
      addToast("success", isCurrent ? "已取消封面" : "已设置为封面");
      // 旧封面若是独立上传文件（不在相册照片中）则从图床清理，避免残留
      if (
        prevCover &&
        prevCover !== nextCover &&
        !photos.some((p) => p.url === prevCover)
      ) {
        try {
          await apiFetch(
            `/api/upload/image?url=${encodeURIComponent(prevCover)}`,
            { method: "DELETE" }
          );
        } catch {
          // 清理失败不影响设置结果
        }
      }
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  /** 排序：拖拽过程中实时本地重排，松手后持久化 */
  const commitReorder = async (ids: string[]) => {
    try {
      await apiJson("/api/albums/photos/reorder", {
        method: "POST",
        body: JSON.stringify({ album_id: currentId, ids }),
      });
      addToast("success", "排序已更新");
      await loadAlbum();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      await loadAlbum();
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
  } = useDragSort<PhotoItem>({
    items: photos,
    onReorder: (nextIds) => setPhotos((prev) => reorderItemsByIds(prev, nextIds)),
    onCommit: commitReorder,
    strategy: "rect",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">加载相册中…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isNew ? "新建相册" : "编辑相册"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {updatedAt ? `最后更新于 ${formatDate(updatedAt)}` : "填写内容后保存"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            返回
          </Button>
          <Button onClick={saveAlbum} loading={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* 主区域：标题 / 简介 / 照片列表 */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="space-y-4 p-5">
            <Field label="标题" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="相册标题"
              />
            </Field>
            <Field label="简介">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="相册简介（可选）"
              />
            </Field>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">照片列表</h2>
                <p className="text-xs text-slate-400">
                  {photoCount} 张照片，按 sort 升序展示
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    e.target.files && handleUploadPhotos(e.target.files)
                  }
                />
                <Button
                  onClick={() => photoInputRef.current?.click()}
                  loading={photoUploading}
                >
                  <Plus className="h-4 w-4" />
                  {photoUploading ? "上传中…" : "上传照片"}
                </Button>
              </div>
            </div>

            {photos.length === 0 ? (
              <EmptyState
                text={
                  currentId
                    ? "该相册还没有照片，点击右上角「上传照片」添加"
                    : "点击右上角「上传照片」添加照片，未保存的相册会自动创建"
                }
              />
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
                  <div className="grid grid-cols-5 gap-3">
                    {photos.map((photo) => (
                      <SortablePhoto
                        key={photo.id}
                        photo={photo}
                        isCover={photo.url === cover}
                        onSetCover={setAsCover}
                        onEdit={(p) => {
                          setPhotoEdit(p);
                          setPhotoForm({
                            caption: p.caption || "",
                            taken_at: toDateInputValue(p.taken_at),
                          });
                        }}
                        onDelete={deletePhoto}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </Card>
        </div>

        {/* 侧栏：设置时间 / 布局 / 封面 */}
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <Field label="设置时间" hint="未设置时按最近更新时间显示">
              <DateWheelPicker
                value={publishedAt}
                onChange={setPublishedAt}
                placeholder="未设置"
              />
            </Field>
            <Field label="布局">
              <Select value={layout} onChange={(e) => setLayout(e.target.value)}>
                <option value="grid">网格瀑布流</option>
                <option value="timeline">时间轴</option>
              </Select>
            </Field>
          </Card>

          <Card className="p-5">
            <p className="mb-2 text-sm font-medium text-slate-700">封面图片</p>
            <ImageUploader
              mode="single"
              value={cover}
              onChange={(urls) => setCover(urls[0] || "")}
              height="h-40"
              category="photowall"
              folder={currentId ? String(currentId) : undefined}
              // 封面若来自相册照片（设为封面），保护该照片文件不被误删
              canDeleteImage={(url) => !photos.some((p) => p.url === url)}
            />
            <p className="mt-2 text-xs text-slate-400">
              可上传新图，也可在照片列表中把某张照片设为封面
            </p>
          </Card>
        </div>
      </div>

      {/* 照片编辑弹窗 */}
      <Modal
        open={Boolean(photoEdit)}
        title="编辑照片信息"
        onClose={() => setPhotoEdit(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPhotoEdit(null)}>
              取消
            </Button>
            <Button onClick={savePhoto} loading={photoSaving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {photoEdit && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoEdit.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="max-h-52 w-full rounded-lg border border-slate-200 object-contain"
            />
          )}
          <Field label="照片说明">
            <Input
              value={photoForm.caption}
              onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
              placeholder="照片说明（可选）"
            />
          </Field>
          <Field label="拍摄日期" hint="时间轴视图按此日期分组">
            <DateWheelPicker
              value={photoForm.taken_at}
              onChange={(v) => setPhotoForm({ ...photoForm, taken_at: v })}
              placeholder="未设置"
            />
          </Field>
        </div>
      </Modal>

      {confirmElement}
    </div>
  );
}
