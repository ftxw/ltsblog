import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import { formatDateCN } from "@/app/lib/format";
import AlbumDetailView, {
  type AlbumDetailData,
} from "@/components/photowall/AlbumDetailView";

// ISR：构建/首访后静态化 300s；后台改动相册会 revalidatePath('/photowall') 令新相册即时生成
export const revalidate = 300;

/** 构建/首访时预生成全部相册详情：图片页不再每次现场渲染 + 现场查库 */
export async function generateStaticParams() {
  const albums = await prisma.album.findMany({
    select: { id: true },
    orderBy: [{ sort: "asc" }, { created_at: "desc" }],
  });
  return albums.map((a) => ({ albumId: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { title: true, description: true },
  });
  return {
    title: album ? `${album.title} - 光影画廊` : "光影画廊",
    description: album?.description || undefined,
  };
}

/** 相册详情独立页：/photowall/{相册id} */
export default async function PhotoWallAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: {
      photos: { orderBy: [{ sort: "asc" }, { created_at: "asc" }] },
    },
  });
  if (!album) notFound();

  const data: AlbumDetailData = {
    id: album.id,
    title: album.title,
    description: album.description || "",
    cover: album.cover || "",
    date: formatDateCN(album.published_at ?? album.updated_at),
    layout: album.layout,
    photos: album.photos.map((p) => ({
      url: p.url,
      caption: p.caption || undefined,
      takenAt: p.taken_at ? p.taken_at.toISOString() : undefined,
    })),
  };

  return <AlbumDetailView data={data} />;
}
