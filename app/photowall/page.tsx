import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import PhotoWallClient, { type Album } from "./PhotoWallClient";

// ISR：300s 静态化照片墙首屏（后台相册/照片变更会 revalidatePath('/photowall')）
export const revalidate = 300;

export const metadata: Metadata = {
  title: "光影画廊",
  description: "记录生活的每一个瞬间",
};

/** YYYY-MM-DD（对齐组件内 formatAlbumDateFull 的输出） */
function formatAlbumDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * 服务端一次查询组装首屏数据（相册 + 相册内全部照片），供 ISR 静态化。
 * 照片带 taken_at：前端展开相册详情（时间轴分组、日期章）依赖它，一次下发后
 * 点相册不再走 /photowall/[id] RSC 路由，全程零函数调用。
 */
async function fetchInitialAlbums(): Promise<Album[]> {
  try {
    const albums = await prisma.album.findMany({
      orderBy: [{ sort: "asc" }, { created_at: "desc" }],
      include: {
        photos: {
          orderBy: [{ sort: "asc" }, { created_at: "asc" }],
          select: {
            url: true,
            caption: true,
            taken_at: true,
          },
        },
      },
    });
    return albums.map((a) => {
      const photos: Album["photos"] = a.photos.map((p) => ({
        url: p.url,
        caption: p.caption || undefined,
        takenAt: p.taken_at ? p.taken_at.toISOString() : undefined,
      }));
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        cover: a.cover || photos[0]?.url || "",
        date: formatAlbumDate(a.published_at ?? a.updated_at),
        layout: a.layout,
        photos,
      };
    });
  } catch {
    return [];
  }
}

export default async function PhotoWallPage() {
  const initialAlbums = await fetchInitialAlbums();
  return <PhotoWallClient initialAlbums={initialAlbums} />;
}
