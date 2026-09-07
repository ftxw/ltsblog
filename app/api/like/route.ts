import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyAccessToken } from "@/app/lib/supabase";
import { errMsg } from "@/app/lib/http";
import {
  invalidateChatterCaches,
  invalidatePostCaches,
  invalidateProjectCaches,
} from "@/app/lib/api-cache";

export type LikeTargetType = "post" | "chatter" | "project";

const TARGETS: Record<LikeTargetType, { field: "post" | "chatter" | "project"; invalidate?: () => void }> = {
  post: { field: "post", invalidate: invalidatePostCaches },
  chatter: { field: "chatter", invalidate: invalidateChatterCaches },
  project: { field: "project", invalidate: invalidateProjectCaches },
};

const uniqueWhere = (userId: string, targetType: LikeTargetType, targetId: string) => ({
  user_id_target_type_target_id: { user_id: userId, target_type: targetType, target_id: targetId },
});

async function getCount(targetType: LikeTargetType, targetId: string): Promise<number> {
  const t = TARGETS[targetType];
  const row = (prisma[t.field] as unknown as {
    findUnique: (a: { where: { id: string }; select: { likes: true } }) => Promise<{ likes: number } | null>;
  });
  const rec = await row.findUnique({ where: { id: targetId }, select: { likes: true } });
  return rec?.likes ?? 0;
}

async function targetExists(targetType: LikeTargetType, targetId: string): Promise<boolean> {
  const t = TARGETS[targetType];
  const row = (prisma[t.field] as unknown as {
    findUnique: (a: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  });
  return Boolean(await row.findUnique({ where: { id: targetId }, select: { id: true } }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("targetType") as LikeTargetType;
    const targetId = searchParams.get("targetId") || "";
    if (!TARGETS[targetType] || !targetId) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const likes = await getCount(targetType, targetId);

    let liked = false;
    const auth = request.headers.get("Authorization") || "";
    if (auth.startsWith("Bearer ")) {
      try {
        const user = await verifyAccessToken(auth.slice(7));
        const rec = await prisma.contentLike.findUnique({
          where: uniqueWhere(user.id, targetType, targetId),
          select: { id: true },
        });
        liked = Boolean(rec);
      } catch {
        liked = false;
      }
    }

    return NextResponse.json({ likes, liked });
  } catch {
    return NextResponse.json({ error: "获取点赞失败" }, { status: 500 });
  }
}

/** 登录态点赞/取消（每账号每内容一次，记录表 + 计数原子更新） */
export async function POST(request: Request) {
  try {
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const user = await verifyAccessToken(auth.slice(7)).catch(() => null);
    if (!user) {
      return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
    }

    const body = await request.json();
    const targetType = body.targetType as LikeTargetType;
    const targetId = String(body.targetId || "");
    const wantLike = body.liked === true;
    const t = TARGETS[targetType];
    if (!t || !targetId) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    if (!(await targetExists(targetType, targetId))) {
      return NextResponse.json({ error: "目标不存在" }, { status: 404 });
    }

    const model = (prisma[t.field] as unknown as {
      update: (a: { where: { id: string }; data: { likes: { increment: number } } }) => Promise<unknown>;
      updateMany: (a: { where: { id: string; likes: { gt: number } }; data: { likes: { decrement: number } } }) => Promise<{ count: number }>;
    });

    const rec = await prisma.contentLike.findUnique({
      where: uniqueWhere(user.id, targetType, targetId),
      select: { id: true },
    });

    if (wantLike) {
      if (!rec) {
        try {
          await prisma.contentLike.create({
            data: { user_id: user.id, target_type: targetType, target_id: targetId },
          });
        } catch {
          // 并发重复创建被唯一约束拦下，视为已点赞
        }
        await model.update({
          where: { id: targetId },
          data: { likes: { increment: 1 } },
        });
      }
    } else if (rec) {
      await prisma.contentLike.delete({ where: { id: rec.id } });
      await model.updateMany({
        where: { id: targetId, likes: { gt: 0 } },
        data: { likes: { decrement: 1 } },
      });
    }

    t.invalidate?.();

    return NextResponse.json({
      likes: await getCount(targetType, targetId),
      liked: wantLike,
    });
  } catch (err) {
    if (errMsg(err) === "无效的令牌" || errMsg(err) === "未登录") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    console.error("[POST /api/like] error:", err);
    return NextResponse.json({ error: "点赞失败" }, { status: 500 });
  }
}
