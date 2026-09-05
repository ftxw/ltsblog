"use client";

import ConfigGroupsEditor from "@/components/admin/ConfigGroupsEditor";

/** 站点设置：视觉风格、音乐设置、图床设置、业务链接 */
const GROUP_IDS = ["site", "music", "imageHost", "business-links"];

export default function AdminSystemSettingsPage() {
  return (
    <ConfigGroupsEditor
      title="站点设置"
      description="整体视觉风格、音乐播放、图床存储与业务链接配置"
      groupIds={GROUP_IDS}
    />
  );
}
