// 工具：修复 UTF-8 -> Latin-1 -> UTF-8 的"双重编码"乱码
// 部署环境（如 EdgeOne CI）的 PG client_encoding 若非 UTF8，
// seed.ts 写入的中文字符就会被以 Latin-1 字节流落到库里，
// 之后再以 UTF-8 读出，就会看到例如 "æ¬¢è¿æ¥å°æçåå®¢" 这样的字符串。
// 反向解码即 `Buffer.from(value, 'latin1').toString('utf8')`。

/** 给定一段字符串，如果它已被双重编码（Latin-1 字节被当字符串落库），反解回正确 UTF-8 */
function decodeMojibake(value: string | undefined | null): string {
  if (!value) return "";
  // 没出现扩展 ASCII 字符（高于 U+007F），就一定不是 Latin1 -> UTF-8 双重编码
  if (!/[\u00A0-\u00FF]/.test(value)) return value;

  try {
    if (typeof Buffer === "undefined") return value;
    const decoded = Buffer.from(value, "latin1").toString("utf8");

    // 校验：解码后必须能产生正常字符
    if (/\uFFFD/.test(decoded)) return value; // 出现替换字符 = 解码失败
    if (
      // 包含中日韩统一表意 / 全角字符 -> 正常中文
      /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(decoded) ||
      // 或纯可读 ASCII + 全角
      /^[\u0020-\u007E\u3000-\u303F\uFF00-\uFFEF]*$/.test(decoded)
    ) {
      return decoded;
    }
    return value;
  } catch {
    return value;
  }
}

/** 遍历配置对象，把疑似 mojibake 的值反解掉 */
export function decodeConfigMojibake(config: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = { ...config };
  for (const key of Object.keys(result)) {
    result[key] = decodeMojibake(result[key]);
  }
  return result;
}
