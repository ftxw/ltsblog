"use client";

import { useState } from "react";
import { GripVertical, Plus, ExternalLink } from "lucide-react";
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

interface BookmarkCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  created_at: string;
}

interface BookmarkSite {
  id: string;
  category_id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  platforms: string[];
  created_at: string;
}

/** 可拖拽排序的书签分类行 */
function SortableCategoryRow({
  cat,
  onEdit,
  onDelete,
}: {
  cat: BookmarkCategory;
  onEdit: (cat: BookmarkCategory) => void;
  onDelete: (cat: BookmarkCategory) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "grid grid-cols-[8%_20%_34%_8%_15%_15%] cursor-grab border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50/70 active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg ring-2 ring-inset ring-indigo-400"
      )}
      {...attributes}
      {...listeners}
    >
      {/* 图标 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate">{cat.icon || "-"}</span>
      </div>
      {/* 名称（左对齐） */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate font-medium text-slate-900">
          {cat.name}
        </span>
      </div>
      {/* 描述 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate text-slate-500">
          {cat.description || "-"}
        </span>
      </div>
      {/* 排序（拖拽手柄） */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-slate-300">
        <GripVertical className="h-4 w-4" />
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

/** 可拖拽排序的书签站点行 */
function SortableSiteRow({
  site,
  categoryName,
  onEdit,
  onDelete,
}: {
  site: BookmarkSite;
  categoryName: string;
  onEdit: (site: BookmarkSite) => void;
  onDelete: (site: BookmarkSite) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: site.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "grid grid-cols-[20%_24%_12%_16%_8%_20%] cursor-grab border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50/70 active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-lg ring-2 ring-inset ring-indigo-400"
      )}
      {...attributes}
      {...listeners}
    >
      {/* 名称（左对齐） */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center gap-2 px-4">
        {site.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={site.icon} alt="" className="h-5 w-5 shrink-0 rounded" />
        )}
        <span className="truncate font-medium text-slate-900">
          {site.name}
        </span>
      </div>
      {/* URL */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 truncate text-indigo-600 hover:underline"
        >
          <span className="truncate">{site.url}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
      {/* 分类 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate">{categoryName}</span>
      </div>
      {/* 平台 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
        <span className="truncate text-xs text-slate-500">
          {site.platforms?.length ? site.platforms.join(" / ") : "-"}
        </span>
      </div>
      {/* 排序（拖拽手柄） */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-slate-300">
        <GripVertical className="h-4 w-4" />
      </div>
      {/* 操作 */}
      <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
        <Button size="sm" variant="ghost" onClick={() => onEdit(site)}>
          编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onDelete(site)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

export default function AdminBookmarksPage() {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const categories = useApi<BookmarkCategory[]>("/api/bookmarks/categories");
  const sites = useApi<BookmarkSite[]>("/api/bookmarks/sites");

  const [tab, setTab] = useState<"sites" | "categories">("sites");

  // 前端内存分页
  const PAGE_SIZE = 10;
  const [catPage, setCatPage] = useState(1);
  const [sitePage, setSitePage] = useState(1);
  const catList = (categories.data ?? []).slice(
    (catPage - 1) * PAGE_SIZE,
    catPage * PAGE_SIZE
  );
  const siteList = (sites.data ?? []).slice(
    (sitePage - 1) * PAGE_SIZE,
    sitePage * PAGE_SIZE
  );

  // 分类表单
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<BookmarkCategory | null>(null);
  const [catForm, setCatForm] = useState({
    name: "",
    icon: "",
    description: "",
  });
  const [catSaving, setCatSaving] = useState(false);

  // 打开「新建分类」：显式重置编辑态与表单（替代「关闭后清空」的 effect，语义等价）
  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ name: "", icon: "", description: "" });
    setCatModalOpen(true);
  };

  // 站点表单
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<BookmarkSite | null>(null);
  const [siteForm, setSiteForm] = useState({
    category_id: "",
    name: "",
    url: "",
    icon: "",
    description: "",
    platforms: "",
  });
  const [siteSaving, setSiteSaving] = useState(false);

  // 打开「新建站点」：显式重置编辑态与表单（替代「关闭后清空」的 effect，语义等价）
  const openNewSite = () => {
    setEditingSite(null);
    setSiteForm({
      category_id: "",
      name: "",
      url: "",
      icon: "",
      description: "",
      platforms: "",
    });
    setSiteModalOpen(true);
  };

  const catName = (id: string) =>
    (categories.data ?? []).find((c) => c.id === id)?.name ?? `#${id}`;

  /* ===== 排序 ===== */

  /* 排序：拖拽过程中实时本地重排，松手后持久化 */
  const commitCatReorder = async (ids: string[]) => {
    try {
      await apiJson("/api/bookmarks/categories/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      addToast("success", "排序已更新");
      categories.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      categories.reload();
    }
  };

  const commitSiteReorder = async (ids: string[]) => {
    try {
      await apiJson("/api/bookmarks/sites/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      addToast("success", "排序已更新");
      sites.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      sites.reload();
    }
  };

  const catDrag = useDragSort<BookmarkCategory>({
    items: catList,
    onReorder: (nextIds) =>
      categories.setData((prev) => (prev ? reorderItemsByIds(prev, nextIds) : prev)),
    onCommit: commitCatReorder,
  });
  const siteDrag = useDragSort<BookmarkSite>({
    items: siteList,
    onReorder: (nextIds) =>
      sites.setData((prev) => (prev ? reorderItemsByIds(prev, nextIds) : prev)),
    onCommit: commitSiteReorder,
  });

  /* ===== 分类 ===== */

  const saveCategory = async () => {
    if (!catForm.name.trim()) {
      addToast("warning", "请填写分类名称");
      return;
    }
    setCatSaving(true);
    try {
      const body = {
        name: catForm.name.trim(),
        icon: catForm.icon,
        description: catForm.description,
      };
      if (editingCat) {
        await apiJson(`/api/bookmarks/categories/${editingCat.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        addToast("success", "分类已更新");
      } else {
        await apiJson("/api/bookmarks/categories", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "分类已创建");
      }
      setCatModalOpen(false);
      categories.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (cat: BookmarkCategory) => {
    const ok = await confirm(
      "删除分类",
      `确定删除书签分类「${cat.name}」？该分类下的站点会一并失效。`
    );
    if (!ok) return;
    try {
      await apiJson(`/api/bookmarks/categories/${cat.id}`, { method: "DELETE" });
      addToast("success", "分类已删除");
      categories.reload();
      sites.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  /* ===== 站点 ===== */

  const saveSite = async () => {
    if (!siteForm.name.trim() || !siteForm.url.trim() || !siteForm.category_id) {
      addToast("warning", "请填写分类、名称和 URL");
      return;
    }
    setSiteSaving(true);
    try {
      const platforms = siteForm.platforms
        .split(/[,，]/)
        .map((p) => p.trim())
        .filter(Boolean);
      const body = {
        // 分类/站点 ID 均为数据库字符串主键，不能 Number()（会变 NaN → null）
        category_id: siteForm.category_id,
        name: siteForm.name.trim(),
        url: siteForm.url.trim(),
        icon: siteForm.icon,
        description: siteForm.description,
        platforms,
      };
      if (editingSite) {
        await apiJson(`/api/bookmarks/sites/${editingSite.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        addToast("success", "站点已更新");
      } else {
        await apiJson("/api/bookmarks/sites", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "站点已创建");
      }
      setSiteModalOpen(false);
      sites.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSiteSaving(false);
    }
  };

  const deleteSite = async (site: BookmarkSite) => {
    const ok = await confirm("删除站点", `确定删除站点「${site.name}」？`);
    if (!ok) return;
    try {
      await apiJson(`/api/bookmarks/sites/${site.id}`, { method: "DELETE" });
      addToast("success", "站点已删除");
      sites.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      <PageHeader title="书签管理" description="管理导航书签的分类与站点" />

      {/* Tab 切换 */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm">
        {(
          [
            ["sites", `站点（${sites.data?.length ?? 0}）`],
            ["categories", `分类（${categories.data?.length ?? 0}）`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md px-3 py-1.5 cursor-pointer transition-colors",
              tab === key
                ? "bg-white font-medium text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {label}
          </button>
        ))}
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => (tab === "sites" ? openNewSite() : openNewCat())}
        >
          <Plus className="h-3.5 w-3.5" />
          {tab === "sites" ? "新建站点" : "新建分类"}
        </Button>
      </div>

      {tab === "categories" ? (
        <Card>
          {categories.loading && !categories.data ? (
            <Loading />
          ) : (categories.data ?? []).length === 0 ? (
            <EmptyState text="暂无书签分类" />
          ) : (
            // CSS Grid 表格：与文章管理同写法
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="grid grid-cols-[8%_20%_34%_8%_15%_15%] border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                {["图标", "名称", "描述", "拖拽排序", "创建时间", "操作"].map(
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
                sensors={catDrag.sensors}
                collisionDetection={closestCenter}
                onDragStart={catDrag.handleDragStart}
                onDragOver={catDrag.handleDragOver}
                onDragEnd={catDrag.handleDragEnd}
                onDragCancel={catDrag.handleDragCancel}
              >
                <SortableContext items={catDrag.ids} strategy={catDrag.strategy}>
                  {catList.map((cat) => (
                    <SortableCategoryRow
                      key={cat.id}
                      cat={cat}
                      onEdit={(c) => {
                        setEditingCat(c);
                        setCatForm({
                          name: c.name,
                          icon: c.icon || "",
                          description: c.description || "",
                        });
                        setCatModalOpen(true);
                      }}
                      onDelete={deleteCategory}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div className="px-4 pb-3">
            <Pagination
              page={catPage}
              pageSize={PAGE_SIZE}
              total={categories.data?.length ?? 0}
              onChange={setCatPage}
            />
          </div>
        </Card>
      ) : (
        <Card>
          {sites.loading && !sites.data ? (
            <Loading />
          ) : (sites.data ?? []).length === 0 ? (
            <EmptyState text="暂无书签站点" />
          ) : (
            // CSS Grid 表格：与文章管理同写法
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="grid grid-cols-[20%_24%_12%_16%_8%_20%] border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                {["名称", "URL", "分类", "平台", "拖拽排序", "操作"].map((h) => (
                  <div
                    key={h}
                    className="flex h-11 overflow-hidden items-center justify-center px-4"
                  >
                    {h}
                  </div>
                ))}
              </div>
              <DndContext
                sensors={siteDrag.sensors}
                collisionDetection={closestCenter}
                onDragStart={siteDrag.handleDragStart}
                onDragOver={siteDrag.handleDragOver}
                onDragEnd={siteDrag.handleDragEnd}
                onDragCancel={siteDrag.handleDragCancel}
              >
                <SortableContext items={siteDrag.ids} strategy={siteDrag.strategy}>
                  {siteList.map((site) => (
                    <SortableSiteRow
                      key={site.id}
                      site={site}
                      categoryName={catName(site.category_id)}
                      onEdit={(s) => {
                        setEditingSite(s);
                        setSiteForm({
                          category_id: String(s.category_id),
                          name: s.name,
                          url: s.url,
                          icon: s.icon || "",
                          description: s.description || "",
                          platforms: (s.platforms ?? []).join(", "),
                        });
                        setSiteModalOpen(true);
                      }}
                      onDelete={deleteSite}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div className="px-4 pb-3">
            <Pagination
              page={sitePage}
              pageSize={PAGE_SIZE}
              total={sites.data?.length ?? 0}
              onChange={setSitePage}
            />
          </div>
        </Card>
      )}

      {/* 分类弹窗 */}
      <Modal
        open={catModalOpen}
        title={editingCat ? "编辑书签分类" : "新建书签分类"}
        onClose={() => setCatModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModalOpen(false)}>
              取消
            </Button>
            <Button onClick={saveCategory} loading={catSaving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="名称" required>
            <Input
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              placeholder="分类名称"
            />
          </Field>
          <Field label="图标" hint="Emoji 或图标地址">
            <Input
              value={catForm.icon}
              onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
              placeholder="如 🛠️"
            />
          </Field>
          <Field label="描述">
            <Textarea
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
      </Modal>

      {/* 站点弹窗 */}
      <Modal
        open={siteModalOpen}
        title={editingSite ? "编辑书签站点" : "新建书签站点"}
        onClose={() => setSiteModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setSiteModalOpen(false)}>
              取消
            </Button>
            <Button onClick={saveSite} loading={siteSaving}>
              保存
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="分类" required>
            <select
              value={siteForm.category_id}
              onChange={(e) => setSiteForm({ ...siteForm, category_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">请选择分类</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="名称" required>
            <Input
              value={siteForm.name}
              onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
              placeholder="站点名称"
            />
          </Field>
          <Field label="URL" required className="sm:col-span-2">
            <Input
              value={siteForm.url}
              onChange={(e) => setSiteForm({ ...siteForm, url: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="图标地址" hint="站点 favicon 或图片地址">
            <Input
              value={siteForm.icon}
              onChange={(e) => setSiteForm({ ...siteForm, icon: e.target.value })}
              placeholder="https://…/favicon.ico"
            />
          </Field>
          <Field label="描述" className="sm:col-span-2">
            <Textarea
              value={siteForm.description}
              onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
              rows={2}
            />
          </Field>
          <Field label="支持平台" hint="逗号分隔，如：Web, iOS, Android" className="sm:col-span-2">
            <Input
              value={siteForm.platforms}
              onChange={(e) => setSiteForm({ ...siteForm, platforms: e.target.value })}
              placeholder="Web, iOS, Android"
            />
          </Field>
        </div>
      </Modal>

      {confirmElement}
    </>
  );
}
