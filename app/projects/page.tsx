import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import ProjectsListClient from "./ProjectsListClient";
import type { ProjectItem } from "@/app/api";

// ISR：300s 静态化项目列表首屏（后台发布/编辑项目会 revalidatePath('/projects')）
export const revalidate = 300;

export const metadata: Metadata = {
  title: "我的项目",
  description: "一些亲手打造的小作品",
};

/** 解析 DB 里 JSON 文本存的数组字段 */
function parseArr(v: string): string[] {
  try {
    const p = JSON.parse(v || "[]");
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

/** 服务端读取首屏全部已发布项目，供 ISR 静态化（项目量小，一次性全量） */
async function fetchInitialProjects(): Promise<ProjectItem[]> {
  try {
    const rows = await prisma.project.findMany({
      where: { status: "published" },
      orderBy: { sort: "asc" },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      long_description: p.long_description,
      cover_image: p.cover_image,
      images: parseArr(p.images),
      tech_stack: parseArr(p.tech_stack),
      link_github: p.link_github,
      link_gitee: p.link_gitee,
      link_live: p.link_live,
      link_docs: p.link_docs,
      status: p.status,
      status_label: p.status_label,
      is_featured: p.is_featured,
      sort: p.sort,
      likes: p.likes,
      created_at: p.created_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
    }));
  } catch {
    return [];
  }
}

export default async function ProjectsPage() {
  const initialProjects = await fetchInitialProjects();
  return <ProjectsListClient initialProjects={initialProjects} />;
}
