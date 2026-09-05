import { prisma } from "@/app/lib/prisma";
import {
  cachedPublicGet,
  CACHE_NAMESPACE,
} from "@/app/lib/api-cache";

/** 单相册返回照片数量上限：防止相册数据量大时一次性拉爆内存与数据库连接 */
const MAX_PHOTOS = 300;

/** 相册照片列表：photowall 首屏会并发请求所有相册的照片，
 *  加 60s 内存缓存（照片上传/修改/删除/排序均已调用 invalidateAlbumCaches 即时失效） */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const id = albumId;
  return cachedPublicGet(CACHE_NAMESPACE.albumPhotos, req, async () => {
    const photos = await prisma.photo.findMany({
      where: { album_id: id },
      orderBy: { sort: "asc" },
      // 必须限制条数：照片墙首页会对每个相册并发请求一次，
      // 无 take 时大数据量相册会把整个表拉进内存并长时间占用数据库连接。
      take: MAX_PHOTOS,
    });
    return photos;
  });
}
