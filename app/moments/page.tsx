import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import MomentListClient, { type Moment } from "./MomentListClient";

// ISR：300s 静态化说说列表首屏（后台发布/改说说会 revalidatePath('/moments')）
export const revalidate = 300;

export const metadata: Metadata = {
  title: "生活动态",
  description: "在代码之外捕捉瞬间的温度",
};

/** 服务端读取首屏全部已发布说说，供 ISR 静态化（说说量小，一次性全量） */
async function fetchInitialMoments(): Promise<Moment[]> {
  try {
    const chatters = await prisma.chatter.findMany({
      where: { status: "published" },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        content: true,
        images: true,
        location: true,
        likes: true,
        created_at: true,
        _count: { select: { comments: { where: { status: "approved" } } } },
      },
    });
    return chatters.map((c) => {
      let images: string[] = [];
      try {
        const parsed = JSON.parse(c.images || "[]");
        if (Array.isArray(parsed)) images = parsed.map(String);
      } catch {
        /* 保持空 */
      }
      return {
        id: c.id,
        date: c.created_at.toISOString(),
        location: c.location || "",
        images,
        content: c.content,
        likes: c.likes,
        comments_count: c._count.comments,
      };
    });
  } catch {
    return [];
  }
}

export default async function MomentsPage() {
  const initialMoments = await fetchInitialMoments();
  return <MomentListClient initialMoments={initialMoments} />;
}
