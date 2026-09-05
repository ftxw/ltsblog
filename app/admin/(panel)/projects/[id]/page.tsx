import ProjectEditor from "@/components/admin/ProjectEditor";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) {
    return <div className="p-8 text-slate-500">无效的项目 ID</div>;
  }
  return <ProjectEditor projectId={id} />;
}
