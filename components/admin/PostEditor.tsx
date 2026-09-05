"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import {
  Bold,
  Italic,
  Heading2,
  Link as LinkIcon,
  Code,
  List,
  Quote,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import {
  apiJson,
  uploadImage,
  formatDate,
} from "@/components/admin/lib";
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
  cn,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";

marked.setOptions({ gfm: true, breaks: true });

interface PostDetail {
  id: string;
  title: string;
  description: string;
  cover: string;
  category: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  content: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

export default function PostEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [coverOrientation, setCoverOrientation] = useState("landscape");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tagsText, setTagsText] = useState("");
  const [status, setStatus] = useState("draft");
  const [isPinned, setIsPinned] = useState(false);
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  // 加载分类
  useEffect(() => {
    apiJson<CategoryItem[]>("/api/categories")
      .then((list) => setCategories(list))
      .catch(() => addToast("error", "获取分类列表失败"));
  }, [addToast]);

  // 加载文章详情
  useEffect(() => {
    if (!postId) return;
    apiJson<PostDetail>(`/api/posts/${postId}`)
      .then((post) => {
        setTitle(post.title);
        setDescription(post.description || "");
        setCover(post.cover || "");
        setStatus(post.status);
        setIsPinned(Boolean(post.is_pinned));
        setContent(post.content || "");
        setUpdatedAt(post.updated_at);
        setTagsText((post.tags || []).join(", "));
        // 分类需要按名称匹配 id
        apiJson<CategoryItem[]>("/api/categories").then((list) => {
          setCategories(list);
          const cat = list.find((c) => c.name === post.category);
          setCategoryId(cat ? String(cat.id) : "");
        });
      })
      .catch((e: Error) => {
        addToast("error", e.message);
        router.replace("/admin/posts");
      })
      .finally(() => setLoading(false));
  }, [postId, addToast, router]);

  const parsedTags = useMemo(
    () =>
      tagsText
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsText]
  );

  const previewHtml = useMemo(
    () => (tab === "preview" ? (marked.parse(content || "") as string) : ""),
    [tab, content]
  );

  /** 在光标处插入 Markdown 片段 */
  const insertAtCursor = (before: string, after = "", defaultText = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end) || defaultText;
    const next =
      content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const insertImage = async (file: File) => {
    setUploadingImage(true);
    try {
      // 文章正文图存入 posts/{id}/ 目录（已有 id 的文章按 id 归档；新建未保存时落在 posts/ 下）
      const { url } = await uploadImage(file, {
        category: "posts",
        folder: postId || "",
      });
      insertAtCursor(`\n![图片](${url})\n`);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "图片上传失败");
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async (overrideStatus?: string) => {
    if (!title.trim()) {
      addToast("warning", "请填写文章标题");
      return;
    }
    setSaving(true);
    const body = {
      title: title.trim(),
      description,
      content,
      cover,
      category_id: categoryId ? Number(categoryId) : undefined,
      tags: parsedTags,
      status: overrideStatus ?? status,
      is_pinned: isPinned,
    };
    try {
      if (postId) {
        await apiJson(`/api/posts/${postId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        addToast("success", "文章已更新");
      } else {
        await apiJson("/api/posts", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "文章已创建");
      }
      router.push("/admin/posts");
      router.refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">加载文章中…</span>
      </div>
    );
  }

  const toolbarBtn =
    "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {postId ? "编辑文章" : "新建文章"}
          </h1>
          {postId && (
            <p className="mt-0.5 text-sm text-slate-500">
              {updatedAt ? `最后更新于 ${formatDate(updatedAt)}` : "填写内容后保存"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            返回
          </Button>
          <Button variant="secondary" onClick={() => handleSave()} loading={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button
            onClick={() => handleSave("published")}
            loading={saving}
          >
            {saving ? "发布中…" : "发布文章"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* 主区域 */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="space-y-4 p-5">
            <Field label="标题" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入文章标题"
              />
            </Field>
            <Field label="摘要">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="文章摘要（列表页展示）"
                rows={2}
              />
            </Field>
          </Card>

          {/* Markdown 编辑器 */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  title="加粗"
                  className={toolbarBtn}
                  onClick={() => insertAtCursor("**", "**", "粗体")}
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="斜体"
                  className={toolbarBtn}
                  onClick={() => insertAtCursor("*", "*", "斜体")}
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="二级标题"
                  className={toolbarBtn}
                  onClick={() => insertAtCursor("\n## ", "", "标题")}
                >
                  <Heading2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="列表"
                  className={toolbarBtn}
                  onClick={() => insertAtCursor("\n- ", "", "列表项")}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="引用"
                  className={toolbarBtn}
                  onClick={() => insertAtCursor("\n> ", "", "引用")}
                >
                  <Quote className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="代码块"
                  className={toolbarBtn}
                  onClick={() => insertAtCursor("\n```", "\n```\n", "code")}
                >
                  <Code className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="链接"
                  className={toolbarBtn}
                  onClick={() => insertAtCursor("[", "](https://)", "链接文字")}
                >
                  <LinkIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="插入图片"
                  className={toolbarBtn}
                  disabled={uploadingImage}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && insertImage(e.target.files[0])
                  }
                />
              </div>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 cursor-pointer",
                    tab === "edit"
                      ? "bg-white font-medium text-slate-900 shadow-sm"
                      : "text-slate-500"
                  )}
                  onClick={() => setTab("edit")}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 cursor-pointer",
                    tab === "preview"
                      ? "bg-white font-medium text-slate-900 shadow-sm"
                      : "text-slate-500"
                  )}
                  onClick={() => setTab("preview")}
                >
                  预览
                </button>
              </div>
            </div>

            {tab === "edit" ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在此输入 Markdown 正文…"
                className="min-h-[420px] w-full resize-y px-4 py-3 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none"
                onKeyDown={(e) => {
                  // 支持 Ctrl+B / Ctrl+I 快捷键
                  if (e.ctrlKey && e.key.toLowerCase() === "b") {
                    e.preventDefault();
                    insertAtCursor("**", "**", "粗体");
                  } else if (e.ctrlKey && e.key.toLowerCase() === "i") {
                    e.preventDefault();
                    insertAtCursor("*", "*", "斜体");
                  }
                }}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files).filter((f) =>
                    f.type.startsWith("image/")
                  );
                  if (files.length > 0) {
                    e.preventDefault();
                    insertImage(files[0]);
                  }
                }}
              />
            ) : (
              <div
                className="prose prose-slate max-w-none min-h-[420px] px-4 py-3"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
            <div className="flex justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              <span>Markdown 编辑 · 支持粘贴/上传插图</span>
              <span>{content.length} 字</span>
            </div>
          </Card>
        </div>

        {/* 侧栏设置 */}
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <Field label="发布状态">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
              </Select>
            </Field>
            <Field label="分类">
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="标签" hint="多个标签用逗号分隔">
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="如：Next.js, React"
              />
              {parsedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {parsedTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">置顶文章</span>
              <Switch checked={isPinned} onChange={setIsPinned} />
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-2 text-sm font-medium text-slate-700">封面图片</p>
            <ImageUploader
              mode="single"
              value={cover}
              onChange={(urls) => setCover(urls[0] || "")}
              onOrientation={setCoverOrientation}
              height="h-40"
              category="posts"
            />
            <p className="mt-2 text-xs text-slate-400">
              方向：{coverOrientation === "portrait" ? "竖版" : "横版"}（上传后自动识别）
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
