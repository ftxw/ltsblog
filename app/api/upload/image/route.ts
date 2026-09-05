import { NextRequest, NextResponse } from "next/server";
import imageSize from "image-size";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { errMsg } from "@/app/lib/http";
import {
  generateFileName,
  uploadImageToS3,
  deleteImageByUrl,
  thumbKeyOf,
} from "@/app/lib/s3-image-host";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** 上传分类白名单：对象 key 前缀 = {category}/[{folder}/]{filename}
 *  目录与前台路由/语义一致：文章=posts、相册=photowall、项目=projects、说说=moments、系统=system */
const CATEGORIES = ["posts", "photowall", "projects", "moments", "system"] as const;

/** 分类文件夹安全化：只保留字母数字 - _，长度限 80（防路径注入 / 过深） */
function safeFolder(v: string): string {
  return v.replace(/[^\w-]/g, "").slice(0, 80);
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "缺少文件" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "文件大小超过 10MB 限制" }, { status: 400 });
    }

    const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
    const filename = generateFileName(ext);
    const buffer = await file.arrayBuffer();

    // 按上传用途分类存放：{category}/[{folder}/]{filename}
    // category 来自前端（文章/相册/项目/说说/系统）；folder 仅文章按 slug 细分
    const category = (formData.get("category") as string | null || "system").trim();
    const folder = safeFolder((formData.get("folder") as string | null || "").trim());
    const safeCategory = CATEGORIES.includes(category as (typeof CATEGORIES)[number])
      ? category
      : "system";
    const objectKey = folder
      ? `${safeCategory}/${folder}/${filename}`
      : `${safeCategory}/${filename}`;

    // S3 兼容私有桶直存：不做压缩 / 格式转换 / 缩略图，原图原样上传
    const { url: imageUrl, key } = await uploadImageToS3(
      buffer,
      objectKey,
      file.type
    );

    // 可选缩略图：前端 canvas 生成的 webp 小图，放入内容目录下的 thumb/ 子目录。
    // 例：albums/3/photo.jpeg → albums/3/thumb/photo.jpeg；
    // img-proxy 按路径透传，缩略图 URL 由前端在原 URL 的文件名前插 thumb/ 推导。
    let thumbUrl = "";
    const thumbFile = formData.get("thumb") as File | null;
    if (thumbFile && thumbFile.size > 0) {
      const thumbBuffer = await thumbFile.arrayBuffer();
      const { url } = await uploadImageToS3(
        thumbBuffer,
        thumbKeyOf(key),
        thumbFile.type
      );
      thumbUrl = url;
    }

    // 记录对象 key，供后续删除时按 key 删（存 asset_id 字段复用现有表结构）。
    // 失败不阻塞主流程。
    try {
      await prisma.imageUpload.upsert({
        where: { url: imageUrl },
        update: { asset_id: key },
        create: { url: imageUrl, asset_id: key },
      });
    } catch (e) {
      console.warn("[upload] 写入图床 key 失败（忽略，不影响上传）:", e);
    }

    // 根据图片实际宽高比判断横竖（竖版高>宽，其余视为横版）。
    // 用 image-size 纯 JS 读尺寸 + EXIF orientation，规避 sharp 的 native binding
    // （在 serverless linux runtime 上 sharp 找不到 libvips 会直接抛 ERR_DLOPEN_FAILED）。
    // 注意处理 EXIF 方向：方向 5-8 表示图片需要旋转，宽高应互换后再比较。
    let orientation = "landscape";
    try {
      // SVG 没有像素尺寸概念，提前跳过
      if (file.type !== "image/svg+xml") {
        // 直接传 Uint8Array，避免 Buffer.from 再全量拷贝一份 10MB 内存
        const dim = imageSize(new Uint8Array(buffer)) as {
          width?: number;
          height?: number;
          orientation?: number;
        };
        if (dim.width && dim.height) {
          const swapped = (dim.orientation ?? 1) >= 5;
          const width = swapped ? dim.height : dim.width;
          const height = swapped ? dim.width : dim.height;
          orientation = height > width ? "portrait" : "landscape";
        }
      }
    } catch {
      // 解析失败时回退为横版，不影响上传
    }

    return NextResponse.json({
      url: imageUrl,
      thumbUrl,
      orientation,
    });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    console.error("Upload image error:", err);
    return NextResponse.json({ error: errMsg(err, "上传失败") }, { status: 500 });
  }
}

// 删除图床文件：按 image_upload 表记录的对象 key 调 DeleteObject（无 key 时从 URL 提取）
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 });
    }

    // 从 image_upload 表查询对象 key 后同步删除图床文件（尽力而为）
    const uploadRec = await prisma.imageUpload
      .findUnique({ where: { url } })
      .catch(() => null);
    const deleted = await deleteImageByUrl(url, uploadRec?.asset_id || undefined);
    return NextResponse.json({
      code: 0,
      deleted,
      message: deleted
        ? "图床文件已删除"
        : "图床未配置或删除失败（已忽略）",
    });
  } catch (err) {
    if (errMsg(err) === "未登录" || errMsg(err) === "无效的令牌") {
      return NextResponse.json({ error: errMsg(err) }, { status: 401 });
    }
    if (errMsg(err) === "需要管理员权限") {
      return NextResponse.json({ error: errMsg(err) }, { status: 403 });
    }
    return NextResponse.json({ error: errMsg(err, "删除失败") }, { status: 500 });
  }
}
