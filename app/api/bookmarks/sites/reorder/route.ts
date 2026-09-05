import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { invalidateBookmarkCaches } from "@/app/lib/api-cache";
import { applySegmentReorder } from "@/app/lib/reorder";

/**
 * 排序接口，两种调用方式：
 * - 拖拽排序：body = { ids: string[] }，按 ids 顺序段内重排
 * - 相邻交换（兼容）：body = { id, swapId }，交换两者位置
 * 重排后整表 sort 归一为 1..N。
 */
export async function POST(request: NextRequest) {
  try {
    await getCurrentUser(request);
    const body = await request.json();
    const list = await prisma.bookmarkSite.findMany({
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    // 拖拽排序：完整/段内顺序
    if (Array.isArray(body.ids)) {
      const ids = (body.ids as string[]).filter((s: unknown): s is string => typeof s === "string");
      const known = new Set(list.map((x) => x.id));
      if (
        ids.length < 2 ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !known.has(id))
      ) {
        return NextResponse.json({ code: 1, message: "参数无效" }, { status: 400 });
      }
      const full = applySegmentReorder(list, ids);
      await prisma.$transaction(
        full.map((id, idx) =>
          prisma.bookmarkSite.update({ where: { id }, data: { sort: idx + 1 } })
        )
      );
      invalidateBookmarkCaches();
      return NextResponse.json({ code: 0, message: "success" });
    }

    // 相邻交换（向后兼容）
    const id = body.id;
    const swapId = body.swapId;
    if (typeof id !== "string" || typeof swapId !== "string" || id === swapId) {
      return NextResponse.json({ code: 1, message: "参数无效" }, { status: 400 });
    }
    const i = list.findIndex((x) => x.id === id);
    const j = list.findIndex((x) => x.id === swapId);
    if (i === -1 || j === -1) {
      return NextResponse.json(
        { code: 1, message: "书签站点不存在" },
        { status: 404 }
      );
    }
    [list[i], list[j]] = [list[j], list[i]];
    await prisma.$transaction(
      list.map((x, idx) =>
        prisma.bookmarkSite.update({ where: { id: x.id }, data: { sort: idx + 1 } })
      )
    );
    invalidateBookmarkCaches();
    return NextResponse.json({ code: 0, message: "success" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ code: 1, message }, { status: 401 });
  }
}
