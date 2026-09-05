"use client";

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { thumbUrlOf } from "@/app/lib/image-thumb";
import { Image as ImageIcon, X } from "lucide-react";
import {
  PhotoCard,
  imgFallback,
} from "@/components/photowall/PhotoWallShared";
import AlbumDetailView, {
  type AlbumDetailData,
} from "@/components/photowall/AlbumDetailView";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import Reveal from "@/components/ui/Reveal";

/** 照片元数据（服务端一次下发，JSON 可序列化） */
export interface AlbumPhoto {
  url: string;
  caption?: string;
  /** 拍摄日期 ISO（时间轴分组用）；服务端下发，客户端解析 */
  takenAt?: string | null;
}

/** 相册数据结构（服务端 RSC 也按此形状组装，见 app/photowall/page.tsx） */
export interface Album {
  id: string;
  title: string;
  description: string;
  cover: string;
  date: string;
  /** 相册布局：grid（网格瀑布流）/timeline（按拍摄日期分组的时间轴） */
  layout: "grid" | "timeline";
  photos: AlbumPhoto[];
}

/** 相册瀑布流列数订阅：响应式列数（<640px=1、640~1024px=2、≥1024px=3）
 *  用 useSyncExternalStore 订阅媒体查询，替代挂载时 effect 内 setState */
function subscribeAlbumCols(onStoreChange: () => void) {
  const mqLg = window.matchMedia("(min-width: 1024px)");
  const mqSm = window.matchMedia("(min-width: 640px)");
  const onChange = () => onStoreChange();
  mqLg.addEventListener("change", onChange);
  mqSm.addEventListener("change", onChange);
  return () => {
    mqLg.removeEventListener("change", onChange);
    mqSm.removeEventListener("change", onChange);
  };
}

function getAlbumColsSnapshot(): number {
  if (typeof window === "undefined") return 3;
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

/** SSR 默认按 3 列渲染，避免 hydration 时第一帧从单列跳到三列 */
function getAlbumColsServerSnapshot(): number {
  return 3;
}

export default function PhotoWallClient({ initialAlbums }: { initialAlbums: Album[] }) {
  const [albums] = useState<Album[]>(initialAlbums);
  const [loading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; caption?: string } | null>(null);
  // 前端展开的相册详情：点卡片 setState 展开，返回 = 收起，全程零 RSC 请求。
  const [activeAlbum, setActiveAlbum] = useState<Album | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  // 记录展开详情前的滚动位置，收起时恢复，避免从底部详情返回后列表跳到顶部
  const listScrollRef = useRef(0);

  // 搜索防抖：输入变化立即进入过渡态（在 onChange 处理器中置位，避免 effect 内同步 setState），
  // 停止输入 250ms 后应用搜索词并结束过渡。
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsTransitioning(true);
  };

  useEffect(() => {
    if (isTransitioning === false) return;
    const timer = setTimeout(() => {
      setActiveQuery(searchQuery.toLowerCase());
      setIsTransitioning(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, isTransitioning]);

  const { matchedAlbums, matchedPhotos } = useMemo(() => {
    if (!activeQuery) return { matchedAlbums: albums, matchedPhotos: [] };

    const matchedAlbums = albums.filter(
      (album) =>
        album.title.toLowerCase().includes(activeQuery) ||
        album.description.toLowerCase().includes(activeQuery)
    );

    const matchedPhotos = albums
      .flatMap((album) => album.photos.map((p) => ({ ...p, albumName: album.title })))
      .filter((photo) => photo.caption?.toLowerCase().includes(activeQuery));

    return { matchedAlbums, matchedPhotos };
  }, [activeQuery, albums]);

  /**
   * 相册列表的真正瀑布流（grid 行约束会被"上一排最高"挤压，CSS columns 又会
   * 让列被打乱顺序——这里改成 JS 调度：每张卡片按"当前最矮列"插入）。
   * 列数随视口响应式变化，订阅 matchMedia 自动更新。
   */
  const albumColsCount = useSyncExternalStore(
    subscribeAlbumCols,
    getAlbumColsSnapshot,
    getAlbumColsServerSnapshot
  );

  const distributedAlbums = useMemo(() => {
    const n = Math.max(1, albumColsCount);
    const cols: Album[][] = Array.from({ length: n }, () => []);
    if (matchedAlbums.length === 0) return cols;
    // 列高估算：空相册占位卡片偏矮、其它相册（aspect-[4/3] + 标题 + 描述 + mb-2）固定
    // 这里粗估的目的是让"轻卡片填轻列"，不需要像素级精确——瀑布流天然抗错。
    const estimate = (a: Album) => (a.photos.length === 0 ? 280 : 520);
    const heights = new Array(n).fill(0);
    for (const album of matchedAlbums) {
      let minIdx = 0;
      for (let i = 1; i < n; i++) {
        if (heights[i] < heights[minIdx]) minIdx = i;
      }
      cols[minIdx].push(album);
      heights[minIdx] += estimate(album);
    }
    return cols;
  }, [matchedAlbums, albumColsCount]);

  const renderAlbumCard = (album: Album, index: number) => {
    // 堆叠三层统一使用封面图（无封面时服务端已兜底为第一张照片）。
    // 中/底层的偏转 + 灰度 + 模糊均为纯 CSS 滤镜，三层同 URL 只发一次网络请求，
    // 立体堆叠视觉完全保留，首屏并发从 3N 张缩略图降为 N 张。
    const cover = album.cover || album.photos[0]?.url || "";
    const openAlbum = () => {
      listScrollRef.current = window.scrollY;
      setSearchQuery("");
      setActiveQuery("");
      // 数据已在客户端（一次下发），展开详情不再 router.push 打 RSC
      setActiveAlbum(album);
      requestAnimationFrame(() => window.scrollTo({ top: 0 }));
    };
    return (
    <Reveal
      key={album.id}
      delay={(index % 12) * 0.08}
      onClick={openAlbum}
      className="group cursor-pointer flex flex-col items-center"
    >
      <div className="relative w-[85%] aspect-[4/3] mb-8">
        {album.photos.length > 0 ? (
          <>
            <div className="absolute inset-0 bg-slate-300 dark:bg-slate-700 rounded-[4px] shadow-md transform rotate-6 translate-x-4 translate-y-2 group-hover:rotate-12 group-hover:translate-x-8 transition-all duration-500 border-[6px] border-white dark:border-slate-200 overflow-hidden opacity-60">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element -- 堆叠背面层复用封面缩略图，thumb/ 404 需 onError 回退原图
                <img
                  src={thumbUrlOf(cover)}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => imgFallback(e, cover)}
                  className="w-full h-full object-cover grayscale blur-[2px]"
                  alt=""
                />
              )}
            </div>
            <div className="absolute inset-0 bg-slate-200 dark:bg-slate-600 rounded-[4px] shadow-lg transform -rotate-3 -translate-x-2 -translate-y-1 group-hover:-rotate-6 group-hover:-translate-x-6 transition-all duration-500 border-[6px] border-white dark:border-slate-200 overflow-hidden opacity-80 z-10">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element -- 堆叠中间层复用封面缩略图，thumb/ 404 需 onError 回退原图
                <img
                  src={thumbUrlOf(cover)}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => imgFallback(e, cover)}
                  className="w-full h-full object-cover grayscale-[50%]"
                  alt=""
                />
              )}
            </div>
            <div className="absolute inset-0 bg-white dark:bg-slate-200 rounded-[4px] shadow-2xl border-[6px] border-white dark:border-slate-200 overflow-hidden z-20 transform group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-500 relative">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- 图床缩略图动态 URL，thumb/ 404 需 onError 回退原图
                <img
                  src={thumbUrlOf(cover)}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => imgFallback(e, cover)}
                  alt={album.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-4xl font-black">
                  {album.title.slice(0, 1)}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-5">
                <span className="text-white font-bold text-lg drop-shadow-md translate-y-2 group-hover:translate-y-0 transition-transform duration-500">{album.photos.length} 张照片</span>
                <span className="text-indigo-300 font-medium text-xs mt-1 drop-shadow-md translate-y-2 group-hover:translate-y-0 transition-transform duration-500 delay-75">Click to Open</span>
              </div>
            </div>
          </>
        ) : (
          /* 空相册占位：无照片时不再显示顶部名称缩写 */
          <div className="absolute inset-0 rounded-[4px] border-[3px] border-dashed border-slate-300/80 dark:border-slate-600/80 bg-slate-100/60 dark:bg-slate-800/40 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 transition-colors group-hover:border-indigo-400/70 group-hover:text-indigo-500">
            <ImageIcon className="w-12 h-12 mb-2 opacity-70" strokeWidth={1.5} />
            <span className="text-sm font-medium tracking-wide">暂无照片</span>
            <span className="text-[10px] mt-1 opacity-70">Click to Open</span>
          </div>
        )}
      </div>

      <div className="text-center px-4 w-full">
        <div className="flex items-center justify-center gap-2 mb-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{album.title}</h2>
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-sm uppercase tracking-wider">{album.date}</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">{album.description}</p>
      </div>
    </Reveal>
    );
  };

  // 前端展开相册详情：数据已在客户端（ISR 一次下发），直接复用详情视图组件，
  // 返回 = 收起 state（恢复列表滚动位置），全程零 RSC 请求。
  if (activeAlbum) {
    const data: AlbumDetailData = {
      id: activeAlbum.id,
      title: activeAlbum.title,
      description: activeAlbum.description,
      cover: activeAlbum.cover,
      date: activeAlbum.date,
      layout: activeAlbum.layout,
      photos: activeAlbum.photos.map((p) => ({
        url: p.url,
        caption: p.caption,
        takenAt: p.takenAt ?? undefined,
      })),
    };
    return (
      <AlbumDetailView
        data={data}
        onBack={() => {
          setActiveAlbum(null);
          requestAnimationFrame(() => window.scrollTo({ top: listScrollRef.current }));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen relative pb-32">
      <div className="container-page relative z-10">
        <div>
          <PageHeader
            title="光影画廊"
            subtitle="定格时间，封存泰拉与现实的每一次心跳"
            right={
              <InlineSearch
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="搜索相册名或照片描述..."
              />
            }
          />

          <div className={`transition-opacity duration-300 ease-in-out ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            {activeQuery && matchedPhotos.length > 0 && (
              <div className="mb-16">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                  <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                  匹配的单张照片 ({matchedPhotos.length})
                </h3>
                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                  {matchedPhotos.map((photo, index) => (
                    <PhotoCard
                      key={`search-photo-${index}`}
                      url={photo.url}
                      alt={photo.caption ?? ""}
                      index={index}
                      onClick={() => setSelectedImage(photo)}
                      className="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-zoom-in shadow-lg bg-white/20 dark:bg-slate-800/20 border border-white/30 dark:border-white/10 transition-shadow duration-500 hover:shadow-2xl hover:shadow-indigo-500/20"
                      imgClassName="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-5">
                        <span className="text-indigo-300 font-black text-[10px] tracking-widest uppercase mb-1 drop-shadow-md">{photo.albumName}</span>
                        <p className="text-white font-medium text-sm drop-shadow-md translate-y-4 group-hover:translate-y-0 transition-transform duration-500">{photo.caption}</p>
                      </div>
                    </PhotoCard>
                  ))}
                </div>
              </div>
            )}

            {activeQuery && matchedAlbums.length > 0 && (
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
                相关相册 ({matchedAlbums.length})
              </h3>
            )}

            {matchedAlbums.length === 0 ? (
              loading ? (
                <div className="py-10 space-y-10">
                  {[1, 2, 3].map((i) => (
                    <div key={i}>
                      <div className="h-5 w-24 bg-slate-200/50 dark:bg-slate-700/50 rounded animate-pulse mb-4" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {[1, 2, 3, 4].map((j) => (
                          <div key={j} className="aspect-[4/3] rounded-2xl bg-white/20 dark:bg-slate-800/20 animate-pulse" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !activeQuery && albums.length === 0 ? (
                <div className="text-center py-20 text-slate-500 font-medium">
                  还没有相册，去后台添加一个吧
                </div>
              ) : (
                activeQuery && matchedPhotos.length === 0 && (
                  <div className="text-center py-20 text-slate-500 font-medium">
                    在泰拉大陆的任何角落都没找到相关的记忆...
                  </div>
                )
              )
            ) : (
              <div className="flex gap-8 mt-10 items-start">
                {distributedAlbums.map((col, colIdx) => (
                  <div key={colIdx} className="flex-1 min-w-0 flex flex-col gap-8">
                    {col.map((album, i) => renderAlbumCard(album, i))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-10 cursor-zoom-out animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-2">
            <X className="w-6 h-6" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element -- 全屏原图为图床大图，原生 img 直连（next/image 代理反而多一层函数调用） */}
          <img
            src={selectedImage.url}
            alt={selectedImage.caption || '全屏照片'}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {selectedImage.caption && (
            <div className="absolute bottom-10 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-white text-sm font-medium tracking-wide shadow-2xl">
              {selectedImage.caption}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}
