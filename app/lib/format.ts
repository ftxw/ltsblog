/**
 * 通用展示工具：相对时间、评论树展平。
 * 纯函数，前台/后台通用，可在服务端与客户端安全引用。
 */

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 展示日期：YYYY-MM-DD（全站统一用 `-` 作连接符） */
export function formatDateCN(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 展示日期时间：YYYY-MM-DD HH:mm */
export function formatDateTimeCN(d: Date): string {
  return `${formatDateCN(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 相对时间：3 天以内显示「刚刚 / N分钟前 / N小时前 / N天前」，
 * 更早则显示完整日期。dateFormat 可自定义完整日期格式。
 */
export function relativeTime(
  dateStr: string,
  opts?: { dateFormat?: (d: Date) => string }
): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 3) return `${days}天前`;
  const format =
    opts?.dateFormat ??
    ((date: Date) =>
      `${formatDateCN(date)} ${pad2(date.getHours())}:${pad2(
        date.getMinutes()
      )}`);
  return format(d);
}

/** 评论回复树展平为一维列表，同时记录每条回复的 @ 目标用户 */
export function flattenReplies<
  T extends {
    id: string;
    parent_id: string | null;
    replies?: T[];
    email_user_name?: string;
  }
>(replies: T[], parentMap?: Map<string, string>): (T & { replyToUser?: string })[] {
  const map = parentMap ?? new Map<string, string>();
  const result: (T & { replyToUser?: string })[] = [];
  for (const r of replies) {
    const replyToUser = map.get(r.parent_id!);
    result.push(replyToUser ? { ...r, replyToUser } : r);
    if (r.replies?.length) {
      map.set(r.id, r.email_user_name || "匿名用户");
      result.push(...flattenReplies(r.replies, map));
    }
  }
  return result;
}
