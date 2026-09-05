import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";

// 个人卡片用的轻量统计接口（首页 ProfileCard 30s 轮询一次）
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  try {
    return cachedPublicGet(CACHE_NAMESPACE.profileStats, null, async () => {
      const [postCount, chatterCount, albums] = await Promise.all([
        prisma.post.count({ where: { status: "published" } }),
        prisma.chatter.count({ where: { status: "published" } }),
        prisma.album.findMany({ select: { _count: { select: { photos: true } } } }),
      ]);
      return {
        postCount,
        chatterCount,
        photoCount: albums.reduce((acc, a) => acc + a._count.photos, 0),
      };
    });
  } catch {
    return NextResponse.json(
      { postCount: 0, chatterCount: 0, photoCount: 0 },
      { status: 200 }
    );
  }
}
