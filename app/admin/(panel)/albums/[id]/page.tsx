"use client";

import { use } from "react";
import AlbumEditor from "@/components/admin/AlbumEditor";

export default function AdminAlbumEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  if (!id) {
    return <p className="py-24 text-center text-sm text-slate-400">无效的相册 ID</p>;
  }
  return <AlbumEditor albumId={id} />;
}
