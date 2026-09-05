import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash } from "crypto";
import { prisma } from "@/app/lib/prisma";

function getSecretKey(): Uint8Array {
  if (process.env.SECRET_KEY) {
    return new TextEncoder().encode(process.env.SECRET_KEY);
  }
  // 使用固定派生密钥作为 fallback，避免每次重启导致所有用户 token 失效
  // 生产环境请务必设置 SECRET_KEY 环境变量，不要使用默认 fallback
  const fallbackKey = createHash("sha256")
    .update("Blog-Default-Secret-Key-Please-Change-In-Production")
    .digest("hex");
  return new TextEncoder().encode(fallbackKey);
}

const SECRET_KEY = getSecretKey();
const ALGORITHM = "HS256";
const ACCESS_TOKEN_EXPIRE_HOURS = 72;
const REFRESH_TOKEN_EXPIRE_DAYS = 30;

/**
 * 一律使用 bcrypt 的**异步** API。
 *
 * bcryptjs 是纯 JS 实现，cost=10 的 hashSync / compareSync 会**完全占死**
 * Node 事件循环约 50~100ms —— 这期间该实例无法接受新连接、无法处理任何
 * 其它请求的回调。并发登录/后台操作时表现为「点一下卡一下」。
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRE_HOURS}h`)
    .sign(SECRET_KEY);
}

export async function createRefreshToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: ALGORITHM })
    .setExpirationTime(`${REFRESH_TOKEN_EXPIRE_DAYS}d`)
    .sign(SECRET_KEY);
}

export async function decodeToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      clockTolerance: 60,
    });
    return payload;
  } catch {
    throw new Error("无效的令牌");
  }
}

export async function getCurrentUser(request: Request) {
  // 优先从 Authorization header 读取
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    return decodeToken(token);
  }

  // 支持从 Cookie 读取（用于浏览器直接访问）
  const cookieHeader = request.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/authorized-token=([^;]+)/);
  if (tokenMatch) {
    try {
      const cookieData = JSON.parse(decodeURIComponent(tokenMatch[1]));
      if (cookieData.accessToken) {
        return decodeToken(cookieData.accessToken);
      }
    } catch {
      // cookie 格式不对，忽略
    }
  }

  throw new Error("未登录");
}

/**
 * 管理员鉴权：要求登录且 is_admin，返回用户记录。
 * 未登录抛 Error("未登录")；非管理员抛 Error("需要管理员权限")。
 */
export async function requireAdmin(request: Request) {
  const payload = await getCurrentUser(request);
  const userId = String(payload.sub || "");
  if (!userId) {
    throw new Error("未登录");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.is_admin) {
    throw new Error("需要管理员权限");
  }
  return user;
}
