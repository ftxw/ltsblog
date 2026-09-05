"use client";

import ConfigGroupsEditor from "@/components/admin/ConfigGroupsEditor";

/** 信息设置：站点信息、作者信息、备案信息（视觉风格已移到「站点设置」） */
const GROUP_IDS = ["siteInfo", "basic", "icp"];

export default function AdminSettingsPage() {
  return (
    <ConfigGroupsEditor
      title="信息设置"
      description="修改站点信息、作者信息与备案信息"
      groupIds={GROUP_IDS}
    />
  );
}
