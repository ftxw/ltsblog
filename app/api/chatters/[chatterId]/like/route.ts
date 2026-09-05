import { NextResponse } from "next/server";
import { parseId } from "@/app/lib/comment-auth";
import { fail } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { invalidateChatterCaches } from "@/app/lib/api-cache";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatterId: string }> }
) {
  try {
    const p = await params;
    const chatterId = parseId(p.chatterId);
    if (chatterId === null) {
      return fail("无效的说说ID");
    }

    const chatter = await prisma.chatter.update({
      where: { id: chatterId },
      data: { likes: { increment: 1 } },
    });

    invalidateChatterCaches();

    return NextResponse.json(chatter);
  } catch {
    return fail("点赞失败", 500);
  }
}
