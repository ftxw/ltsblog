import { NextRequest, NextResponse } from "next/server";
import { isS3Configured, getImageFromS3 } from "@/app/lib/s3-image-host";
import { withTimeout } from "@/app/lib/timeout";

/**
 * 图床图片代理：浏览器侧不暴露存储凭证，由服务端带凭证拉取后透传。
 *
 * URL 形态：/api/img-proxy/imgs/{图片路径}
 * - 上传时生成 /api/img-proxy/imgs/{path} 相对地址（不依赖外部域名）
 * - 图片存于 S3 兼容私有桶（缤纷云 / R2 / OSS / COS / MinIO 等）
 * - 文件名唯一（uuid），缓存可设长：public, max-age=31536000, immutable
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 取图前的「拿连接 / 读配置」整体硬超时。
 * S3 单次操作已在上层设 5s 超时，这里再兜一层总闸，保证极端情况下
 * （配置查询慢 + 两次 S3 重试都超时）本路由也能在 ~10s 内失败返回，
 * 而不是无限占住函数实例。
 */
const PROXY_DEADLINE = 10_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    // URL 形态 /api/img-proxy/imgs/{图片路径}：开头的 "imgs" 是类型标记段（对齐上传时生成的地址），
    // 真正的图片路径在其后，这里剥掉标记得到对象 key
    const imgPath = (path || []).join("/").replace(/^imgs\//, "");
    if (!imgPath) {
      return NextResponse.json({ error: "缺少图片路径" }, { status: 400 });
    }

    const hit = await withTimeout(
      (async () => {
        if (!(await isS3Configured())) {
          return null;
        }
        return getImageFromS3(imgPath);
      })(),
      PROXY_DEADLINE,
      "img-proxy S3 fetch"
    );
    if (hit === null) {
      // 未配置与图片不存在都返回 null，这里再区分一次（配置读取有 30s 缓存，开销可忽略）
      const configured = await isS3Configured();
      return NextResponse.json(
        { error: configured ? "图片不存在" : "S3 图床未配置" },
        { status: configured ? 404 : 503 }
      );
    }

    return new NextResponse(hit.body as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": hit.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[img-proxy] 代理图片失败:", err);
    return NextResponse.json({ error: "图片代理失败" }, { status: 502 });
  }
}
