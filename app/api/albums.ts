export interface AlbumItem {
  id: string;
  title: string;
  description: string;
  cover: string;
  /** 照片列表布局方式：grid=瀑布流排列，timeline=按拍摄日期分组 */
  layout: "grid" | "timeline";
  photo_count: number;
  sort: number;
  created_at: string;
  updated_at: string;
  /** 手动设置的相册时间（未设置时为 null） */
  published_at: string | null;
}

export interface PhotoItem {
  id: string;
  album_id: string;
  url: string;
  caption: string;
  /** 拍摄日期，用于相册的时间轴视图分组 */
  taken_at: string;
  sort: number;
  created_at: string;
}
