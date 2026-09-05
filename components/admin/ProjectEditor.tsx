"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, formatDate, useApi } from "@/components/admin/lib";
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Select,
  Loading,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  long_description: string;
  cover_image: string;
  images: string[];
  tech_stack: string[];
  link_github: string;
  link_gitee: string;
  link_live: string;
  link_docs: string;
  status: string;
  status_label: string;
  is_featured: boolean;
  likes: number;
  created_at: string;
  updated_at?: string | null;
}

interface FormState {
  name: string;
  description: string;
  long_description: string;
  cover_image: string;
  images: string[];
  /** 表单内用逗号分隔字符串编辑，提交时再拆为数组 */
  techStackText: string;
  link_github: string;
  link_gitee: string;
  link_live: string;
  link_docs: string;
  status: string;
  status_label: string;
  is_featured: boolean;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  long_description: "",
  cover_image: "",
  images: [],
  techStackText: "",
  link_github: "",
  link_gitee: "",
  link_live: "",
  link_docs: "",
  status: "published",
  status_label: "",
  is_featured: false,
};

/** 新建草稿占位名（用于判断"用户未改默认"以便离开时清理） */
const DRAFT_NAME = "未命名项目";

/**
 * 项目编辑页：new / [id] 两种场景共用。
 *
 * 与文章/相册编辑器机制一致：进入 new 页不会自动创建草稿；
 * 仅当用户「保存」或「上传封面/截图」时才按需创建项目拿到 id，
 * 之后所有图片都落入 projects/{id}/ 子目录。
 */
export default function ProjectEditor({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const isNew = !projectId;

  // 当前项目 id：编辑页初始即有；新建页在保存/上传图片时自动创建后写入
  const [currentId, setCurrentId] = useState<string | undefined>(projectId);
  const effectiveId = currentId;
  const listUrl = effectiveId ? `/api/projects/${effectiveId}` : null;
  const { data, loading: dataLoading } = useApi<ProjectItem>(listUrl);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  // 记录上次已同步进表单的数据引用：data 更新（载入/重载）时同步一次（渲染期 prev 比较）
  const [appliedData, setAppliedData] = useState<ProjectItem | null>(null);
  if (data && data !== appliedData) {
    setAppliedData(data);
    setForm({
      name: data.name || "",
      description: data.description || "",
      long_description: data.long_description || "",
      cover_image: data.cover_image || "",
      images: data.images || [],
      techStackText: (data.tech_stack || []).join(", "),
      link_github: data.link_github || "",
      link_gitee: data.link_gitee || "",
      link_live: data.link_live || "",
      link_docs: data.link_docs || "",
      status: data.status || "published",
      status_label: data.status_label || "",
      is_featured: Boolean(data.is_featured),
    });
  }

  /** 未保存前上传图片时按需创建项目拿 id（名称用当前输入或占位名，草稿态） */
  const ensureProject = async (): Promise<string | undefined> => {
    if (currentId) return currentId;
    const res = await apiJson<{ data: ProjectItem }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim() || DRAFT_NAME,
        status: "draft",
      }),
    });
    setCurrentId(res.data.id);
    return res.data.id;
  };

  const handleSave = async (overrideStatus?: string) => {
    if (!form.name.trim()) {
      addToast("warning", "请填写项目名称");
      return;
    }
    setSaving(true);
    try {
      const techStack = form.techStackText
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        name: form.name.trim(),
        description: form.description,
        long_description: form.long_description,
        cover_image: form.cover_image,
        images: form.images,
        tech_stack: techStack,
        link_github: form.link_github,
        link_gitee: form.link_gitee,
        link_live: form.link_live,
        link_docs: form.link_docs,
        status: overrideStatus || form.status,
        status_label: form.status_label,
        is_featured: form.is_featured,
      };
      if (!currentId) {
        // 新建：点保存才创建（与相册/文章机制一致），创建后进入编辑页便于继续传图
        const res = await apiJson<{ data: ProjectItem }>("/api/projects", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setCurrentId(res.data.id);
        router.replace(`/admin/projects/${res.data.id}`);
        addToast("success", "项目已创建");
      } else {
        await apiJson(`/api/projects/${currentId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        addToast("success", "项目已保存");
      }
      router.refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  /** 返回列表（新建未保存时无草稿残留，无需清理） */
  const handleBack = () => {
    router.push("/admin/projects");
  };

  if (!isNew && dataLoading) {
    return (
      <Card>
        <Loading />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">编辑项目</h1>
          {data?.updated_at && (
            <p className="mt-0.5 text-sm text-slate-500">
              最后更新于 {formatDate(data.updated_at)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <Button onClick={() => handleSave()} loading={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* 主区：表单字段 */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="space-y-4 p-5">
            <Field label="项目名称" required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="项目名称"
              />
            </Field>
            <Field label="简介">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="一句话介绍"
              />
            </Field>
            <Field label="详细介绍">
              <Textarea
                value={form.long_description}
                onChange={(e) => setForm({ ...form, long_description: e.target.value })}
                rows={5}
                placeholder="详细介绍（支持 Markdown）"
              />
            </Field>
            <Field label="技术栈" hint="逗号分隔">
              <Input
                value={form.techStackText}
                onChange={(e) => setForm({ ...form, techStackText: e.target.value })}
                placeholder="Next.js, Prisma, Tailwind"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GitHub">
                <Input
                  value={form.link_github}
                  onChange={(e) => setForm({ ...form, link_github: e.target.value })}
                  placeholder="https://github.com/…"
                />
              </Field>
              <Field label="Gitee">
                <Input
                  value={form.link_gitee}
                  onChange={(e) => setForm({ ...form, link_gitee: e.target.value })}
                  placeholder="https://gitee.com/…"
                />
              </Field>
              <Field label="演示地址">
                <Input
                  value={form.link_live}
                  onChange={(e) => setForm({ ...form, link_live: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
              <Field label="文档地址">
                <Input
                  value={form.link_docs}
                  onChange={(e) => setForm({ ...form, link_docs: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </Card>

          {/* 截图（多图）：放在主区下方，参考相册编辑器照片列表区 */}
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">项目截图</h2>
                <p className="text-xs text-slate-400">支持批量上传，上传顺序即展示顺序</p>
              </div>
            </div>
            <ImageUploader
              mode="multi"
              value={form.images}
              onChange={(images) => setForm({ ...form, images })}
              category="projects"
              folder={effectiveId ? String(effectiveId) : undefined}
              folderResolver={ensureProject}
            />
          </Card>
        </div>

        {/* 侧栏：封面 / 状态 / 精选 */}
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <Field label="封面图">
              <ImageUploader
                mode="single"
                value={form.cover_image}
                onChange={(urls) => setForm({ ...form, cover_image: urls[0] || "" })}
                height="h-32"
                category="projects"
                folder={effectiveId ? String(effectiveId) : undefined}
                folderResolver={ensureProject}
              />
            </Field>
          </Card>
          <Card className="space-y-4 p-5">
            <Field label="状态">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="wip">开发中</option>
                <option value="archived">已归档</option>
              </Select>
            </Field>
            <Field label="状态标签" hint="如：开发中 / 稳定运行">
              <Input
                value={form.status_label}
                onChange={(e) => setForm({ ...form, status_label: e.target.value })}
                placeholder="稳定运行"
              />
            </Field>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) =>
                    setForm({ ...form, is_featured: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                精选项目
              </label>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
