import { prisma } from "./prisma";
import { peekGeo, warmGeo, formatAddress } from "./geo";
import { getClientIp } from "./utils";
import { parseBrowser, parseOS } from "./ua";

export async function recordLoginLog({
  request,
  userId,
  username,
  summary,
}: {
  request: Request;
  userId: string;
  username: string;
  summary: string;
}) {
  try {
    const ua = request.headers.get("user-agent") || "";
    // 归属地：只读缓存命中即用；未命中不阻塞登录流程（在线查询放后台预热）。
    // 首次登录日志可能记空地址，后续同 IP 日志/访客记录即可命中缓存。
    const ip = getClientIp(request);
    const cached = peekGeo(ip);
    const address = cached ? formatAddress(cached) : "";
    if (cached === null) warmGeo(ip);
    await prisma.loginLog.create({
      data: {
        user_id: userId,
        username,
        ip,
        address,
        system: parseOS(ua),
        browser: parseBrowser(ua),
        summary,
      },
    });
  } catch (e) {
    console.error("记录登录日志失败:", e);
  }
}
