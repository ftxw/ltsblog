/**
 * 在线 IP 归属地查询（默认源 ip258.cn，兜底 ip9.com.cn）。
 *
 * 统一解析为拆分字段 GeoInfo（国家/省/市/运营商），展示时用 formatAddress()
 * 拼成整串（如「陕西省 西安市 中国电信」）再落库，库内不拆字段。
 * 拆分的好处：后续更换查询源时，只需在 geo 层新增一个解析函数（见 SOURCES），
 * 各调用方与存储格式完全不受影响。
 *
 * 设计：
 * - 归属地只用于展示，落库前拼整串，不在库内拆列。
 * - 可靠性（EdgeOne Pages / serverless）：高频路径只读缓存 peekGeo()，
 *   绝不阻塞等待外网；缓存未命中用 warmGeo() 后台预热，本次记空，后续命中。
 * - 在线查询自带保护：全局并发上限 + 同 IP in-flight 去重 + 超时 + 失败负缓存，
 *   避免外部源慢/不可达时请求堆积占满函数并发，导致同实例其它路由 502。
 */

const GEO_TIMEOUT = 1500; // 查询超时（收紧：统计上报是高频路径，过长会占用实例）
const CACHE_TTL = 24 * 60 * 60 * 1000; // 结果缓存 24h
const FAIL_TTL = 10 * 60 * 1000; // 失败负缓存 10min
const MAX_CONCURRENT_LOOKUPS = 3; // 同时最多发起的在线查询数，超出直接返回空（不排队）

/** 拆分后的归属地信息（各查询源统一归一到该结构） */
export interface GeoInfo {
  /** 国家，如 中国 / 美国 */
  country: string;
  /** 省级，如 陕西（不带「省/自治区」后缀） */
  region: string;
  /** 市级，如 西安（不带「市」后缀；直辖市时与省同名） */
  city: string;
  /** 运营商，如 中国电信 */
  isp: string;
}

/** 空归属地（内网地址/查询失败/源无数据），表示无可展示的地址 */
export const EMPTY_GEO: Readonly<GeoInfo> = {
  country: "",
  region: "",
  city: "",
  isp: "",
};

export function isEmptyGeo(geo: GeoInfo | null | undefined): boolean {
  return !geo || (!geo.country && !geo.region && !geo.city && !geo.isp);
}

const geoCache = new Map<string, { value: GeoInfo; t: number }>();
const inflight = new Map<string, Promise<GeoInfo>>();
let activeLookups = 0;

/** 是否为内网/本机地址（环回 / 10.x / 172.16-31 / 192.168 / IPv6 私网） */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^fc|^fd|^fe80::/.test(ip)) return true; // IPv6 私网
  return false;
}

/**
 * 只读缓存命中（不发起请求）。
 * 返回 GeoInfo；无缓存/内网地址返回 null；命中失败负缓存时返回空 GeoInfo（EMPTY_GEO）。
 */
export function peekGeo(ip: string): GeoInfo | null {
  if (isPrivateIp(ip)) return null;
  const hit = geoCache.get(ip);
  if (!hit) return null;
  const ttl = isEmptyGeo(hit.value) ? FAIL_TTL : CACHE_TTL;
  if (Date.now() - hit.t >= ttl) return null;
  return hit.value;
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(GEO_TIMEOUT),
      headers,
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    console.warn(
      "[geo] fetch failed:",
      url,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * ip9.com.cn 实测归属地不准，已移除；当前只使用 ip258.cn。
 * 若需更换/增加查询源：加一个返回 GeoInfo 的解析函数并放进 SOURCES 数组即可
 *（统一归一，各调用方与存储格式不受影响）。
 */
const IP258_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Referer: "https://ip258.cn/",
};
async function parseIp258(ip: string): Promise<GeoInfo | null> {
  const data = await fetchJson(
    `https://ip258.cn/api/ip_api.php?ip=${encodeURIComponent(ip)}`,
    IP258_HEADERS
  );
  if (!data || data.code !== 200) return null;
  const d = data.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return null;
  return {
    country: text(d.country),
    region: text(d.prov),
    city: text(d.city),
    isp: text(d.isp),
  };
}

/**
 * 查询源列表：按顺序尝试，第一个返回非空结果的即采用。
 * 当前仅使用 ip258.cn（实测归属地较准）。
 */
const SOURCES: Array<(ip: string) => Promise<GeoInfo | null>> = [parseIp258];

/** 实际发起一次在线查询（不含缓存逻辑），全部源失败返回空 GeoInfo */
async function lookupOnline(ip: string): Promise<GeoInfo> {
  for (const parse of SOURCES) {
    const geo = await parse(ip);
    if (geo && !isEmptyGeo(geo)) return geo;
  }
  return EMPTY_GEO;
}

/**
 * 查询 IP 归属地：命中缓存立即返回；未命中时在并发限制内发起在线查询。
 * 返回拆分字段 GeoInfo，失败/超限/内网返回空 GeoInfo。
 */
export async function resolveGeo(ip: string): Promise<GeoInfo> {
  if (isPrivateIp(ip)) return EMPTY_GEO;

  const cached = peekGeo(ip);
  if (cached !== null) return cached;

  const pending = inflight.get(ip);
  if (pending) return pending;

  // 并发保护：在线查询槽位已满直接返回空，不排队、不阻塞调用方
  if (activeLookups >= MAX_CONCURRENT_LOOKUPS) return EMPTY_GEO;

  const task = (async () => {
    activeLookups++;
    try {
      const value = await lookupOnline(ip);
      geoCache.set(ip, { value, t: Date.now() });
      return value;
    } finally {
      activeLookups--;
      inflight.delete(ip);
    }
  })();
  inflight.set(ip, task);
  return task;
}

/** 后台预热归属地缓存（高频路径用，不 await、不抛错） */
export function warmGeo(ip: string): void {
  void resolveGeo(ip).catch(() => {
    /* 预热失败忽略：下次请求再试 */
  });
}

// ---------------------------------------------------------------------------
// 展示整串拼接（各省市名称规范化）
// ---------------------------------------------------------------------------

/** 无需补「省」后缀的省级单位：直辖市 + 港澳（北京/上海/天津/重庆/香港/澳门） */
const NO_SUFFIX_REGION = new Set(["北京", "上海", "天津", "重庆", "香港", "澳门"]);
/** 省级全称映射（自治区等） */
const REGION_FULL: Record<string, string> = {
  内蒙古: "内蒙古自治区",
  广西: "广西壮族自治区",
  西藏: "西藏自治区",
  宁夏: "宁夏回族自治区",
  新疆: "新疆维吾尔自治区",
  台湾: "台湾省",
};

/** 展示省级名称：陕西 → 陕西省；北京 → 北京；内蒙古 → 内蒙古自治区 */
function displayRegion(region: string): string {
  if (!region) return "";
  if (REGION_FULL[region]) return REGION_FULL[region];
  if (NO_SUFFIX_REGION.has(region)) return region;
  if (/省|市|自治区|自治州|特别行政区$/.test(region)) return region;
  return `${region}省`;
}

/** 展示市级名称：西安 → 西安市；直辖市与省同名时省略 */
function displayCity(city: string, region: string): string {
  if (!city || city === region) return "";
  if (/(市|州|盟|地区)$/.test(city)) return city;
  return `${city}市`;
}

/**
 * 把拆分字段拼成展示用整串（落库值），空归属地返回 ""。
 * 国内：陕西省 西安市 中国电信（含运营商）
 * 国外：美国 加利福尼亚 洛杉矶（运营商为英文长串，不拼入）
 */
export function formatAddress(geo: GeoInfo | null | undefined): string {
  if (isEmptyGeo(geo)) return "";
  const g = geo as GeoInfo;
  const isCn = !g.country || g.country.includes("中国");
  if (isCn) {
    const parts: string[] = [];
    const region = displayRegion(g.region);
    if (region) parts.push(region);
    else if (g.country) parts.push(g.country);
    const city = displayCity(g.city, g.region);
    if (city) parts.push(city);
    if (g.isp) parts.push(g.isp);
    return parts.join(" ");
  }
  // 国外：国家/省/市，跳过重复项（如 新加坡 新加坡）
  const parts: string[] = [];
  for (const s of [g.country, g.region, g.city]) {
    if (s && !parts.includes(s)) parts.push(s);
  }
  return parts.join(" ");
}
