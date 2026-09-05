/**
 * 文章标签批量同步助手
 *
 * 背景：文章创建 / 更新时，原来的实现是在交互式事务里对每个标签
 * 依次 `await tx.tag.upsert + tx.postTag.create + tx.tag.update`，
 * 一篇 10 个标签的文章 = 30+ 次串行数据库往返。Prisma 交互式事务默认
 * 5 秒超时、且全程持有连接 —— 后端管理员连续保存大文章时很容易把
 * max=5 的连接池占满，其它请求只能排队等连接，表现就是「整站卡住」。
 *
 * 本模块把所有标签操作收敛为固定几次批量查询：
 *   findMany(已有标签) → createMany(缺的标签) → findMany(最终 id 映射)
 *   → createMany/deleteMany(post_tag 关联差集) → updateMany(post_count 差集)
 */

import type { Prisma } from "@prisma/client";

/** 标签/分类名 → slug（中文保留，其余转小写连字符） */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, "")
    .substring(0, 50);
}

/** 规范化并去重（按 slug 去重，保留首个名字） */
function normalizeTagNames(names: string[]): { name: string; slug: string }[] {
  const seen = new Set<string>();
  const out: { name: string; slug: string }[] = [];
  for (const raw of names) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    const slug = generateSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ name, slug });
  }
  return out;
}

/**
 * 事务内把一篇文章的标签同步到目标集合。
 *
 * @param tx         事务客户端
 * @param postId     文章 id
 * @param oldTagIds  文章当前已关联的 tag id（更新前读取）
 * @param tagNames   目标标签名数组（传 [] 表示清空全部标签）
 *
 * 增量语义：只在「新增关联」时给 tag.post_count +1，只在「移除关联」时 -1，
 * 未变化的标签零写入 —— 不会像旧实现那样先全删再全建造成无谓的写放大。
 */
export async function syncPostTags(
  tx: Prisma.TransactionClient,
  postId: string,
  oldTagIds: string[],
  tagNames: string[]
): Promise<void> {
  const oldSet = new Set(oldTagIds.filter(Boolean));
  const wanted = normalizeTagNames(tagNames);

  if (wanted.length === 0) {
    // 目标为空：移除全部旧关联并回填计数
    if (oldSet.size > 0) {
      await tx.postTag.deleteMany({
        where: { post_id: postId, tag_id: { in: [...oldSet] } },
      });
      await tx.tag.updateMany({
        where: { id: { in: [...oldSet] } },
        data: { post_count: { decrement: 1 } },
      });
    }
    return;
  }

  const slugs = wanted.map((w) => w.slug);

  // 1) 已有标签 → id
  let rows = await tx.tag.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));

  // 2) 缺失的批量创建（并发重复创建时由唯一约束兜底）
  const missing = wanted.filter((w) => !idBySlug.has(w.slug));
  if (missing.length > 0) {
    await tx.tag.createMany({
      data: missing.map((m) => ({ name: m.name, slug: m.slug })),
      skipDuplicates: true,
    });
    // 3) 再查一次拿到所有 id（以库为准）
    rows = await tx.tag.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    for (const r of rows) idBySlug.set(r.slug, r.id);
  }

  const newIds = wanted
    .map((w) => idBySlug.get(w.slug))
    .filter((x): x is string => Boolean(x));
  const newSet = new Set(newIds);

  const added = newIds.filter((id) => !oldSet.has(id));
  const removed = [...oldSet].filter((id) => !newSet.has(id));

  // 4) 关联表差集 + post_count 差集（各两条批量语句，与标签数量无关）
  if (added.length > 0) {
    await tx.postTag.createMany({
      data: added.map((tag_id) => ({ post_id: postId, tag_id })),
      skipDuplicates: true,
    });
    await tx.tag.updateMany({
      where: { id: { in: added } },
      data: { post_count: { increment: 1 } },
    });
  }
  if (removed.length > 0) {
    await tx.postTag.deleteMany({
      where: { post_id: postId, tag_id: { in: removed } },
    });
    await tx.tag.updateMany({
      where: { id: { in: removed } },
      data: { post_count: { decrement: 1 } },
    });
  }
}

/** 事务内批量把若干 tag 的 post_count 减一（删除文章后标签随之失联） */
export async function decrementTagCounts(
  tx: Prisma.TransactionClient,
  tagIds: string[]
): Promise<void> {
  const ids = [...new Set(tagIds.filter(Boolean))];
  if (ids.length === 0) return;
  await tx.tag.updateMany({
    where: { id: { in: ids } },
    data: { post_count: { decrement: 1 } },
  });
}
