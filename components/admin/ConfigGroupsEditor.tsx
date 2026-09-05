"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, useApi } from "@/components/admin/lib";
import {
  Button,
  Card,
  Loading,
  PageHeader,
  Input,
  Textarea,
  cn,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";
import BusinessLinksManager from "@/components/admin/BusinessLinksManager";

interface SiteConfigItem {
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

interface SiteConfigDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "switch" | "singleImage" | "multiImage" | "json" | "select";
  description: string;
  defaultValue: string;
  group: string;
  options?: { label: string; value: string }[];
}

interface SiteConfigGroup {
  id: string;
  label: string;
  description?: string;
}

/** 业务链接（特殊分组，独立组件渲染） */
const BUSINESS_LINKS_GROUP: SiteConfigGroup = {
  id: "business-links",
  label: "业务链接",
  description: "管理前台左下角悬浮按钮展示的链接",
};

/** 敏感字段（token/key/secret）默认密码框显示 */
function isSecretField(key: string): boolean {
  return /token|secret|passwd|password|api_?key/i.test(key);
}

export default function ConfigGroupsEditor({
  title,
  description,
  groupIds,
}: {
  title: string;
  description?: string;
  /** 展示哪些配置分组 id（可含 business-links 特殊分组） */
  groupIds: string[];
}) {
  const { addToast } = useToast();
  const schema = useApi<{ groups: SiteConfigGroup[]; defs: SiteConfigDef[] }>(
    "/api/site-config/schema"
  );
  const list = useApi<SiteConfigItem[]>("/api/site-config/list");

  const [values, setValues] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState<string>("");
  const [saving, setSaving] = useState(false);
  // 敏感字段（密码框）的显示/隐藏状态
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  // 关于页有独立编辑页（内容管理 → 关于页），不在配置页中重复展示
  const groups = useMemo(() => {
    const list = (schema.data?.groups ?? [])
      .filter((g) => groupIds.includes(g.id))
      .filter((g) => g.id !== "about");
    if (groupIds.includes("business-links")) list.push(BUSINESS_LINKS_GROUP);
    return list;
  }, [schema.data, groupIds]);

  // 初始化：合并 DB 值与 schema 默认值（仅首次两者就绪时同步一次，避免 effect 内 setState）
  const [valuesSynced, setValuesSynced] = useState(false);
  if (!valuesSynced && schema.data && list.data) {
    setValuesSynced(true);
    const next: Record<string, string> = {};
    for (const def of schema.data.defs) {
      const dbItem = list.data.find((item) => item.key === def.key);
      next[def.key] = dbItem ? dbItem.value : def.defaultValue;
    }
    setValues(next);
    setActiveGroup((prev) => prev || groups[0]?.id || "");
  }

  const groupDefs = useMemo(
    () => (schema.data?.defs ?? []).filter((d) => d.group === activeGroup),
    [schema.data, activeGroup]
  );

  const handleSave = async () => {
    if (!schema.data) return;
    const groupKeys = groupDefs.map((d) => d.key);
    // 只提交当前分组内的配置项
    const payload: Record<string, string> = {};
    for (const key of groupKeys) {
      payload[key] = values[key] ?? "";
    }
    setSaving(true);
    try {
      await apiJson("/api/site-config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      addToast("success", "配置已保存");
      list.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (def: SiteConfigDef) => {
    const value = values[def.key] ?? "";
    switch (def.type) {
      case "textarea":
        return (
          <Textarea
            value={value}
            onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
            rows={3}
          />
        );
      case "json":
        return (
          <Textarea
            value={value}
            onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
            rows={3}
            className="font-mono text-xs"
          />
        );
      case "switch":
        return (
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={value === "true"}
                onChange={() => setValues({ ...values, [def.key]: "true" })}
                className="accent-indigo-600"
              />
              开启
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={value !== "true"}
                onChange={() => setValues({ ...values, [def.key]: "false" })}
                className="accent-indigo-600"
              />
              关闭
            </label>
          </div>
        );
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
          >
            {(def.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case "singleImage":
        return (
          <ImageUploader
            mode="single"
            value={value}
            onChange={(urls) => setValues({ ...values, [def.key]: urls[0] || "" })}
            height="h-28"
            square
            category="system"
          />
        );
      case "multiImage": {
        let urls: string[] = [];
        try {
          const parsed = JSON.parse(value || "[]");
          if (Array.isArray(parsed)) urls = parsed.filter((x) => typeof x === "string");
        } catch {
          // ignore
        }
        return (
          <ImageUploader
            mode="multi"
            value={urls}
            onChange={(next) =>
              setValues({ ...values, [def.key]: JSON.stringify(next) })
            }
            category="system"
          />
        );
      }
      default: {
        const secret = isSecretField(def.key);
        return (
          <div className="relative">
            <Input
              type={secret && !visibleKeys[def.key] ? "password" : "text"}
              value={value}
              onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
              autoComplete="off"
              className={secret ? "pr-14" : undefined}
            />
            {secret && (
              <button
                type="button"
                onClick={() =>
                  setVisibleKeys((v) => ({ ...v, [def.key]: !v[def.key] }))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-xs text-slate-400 hover:text-slate-600"
              >
                {visibleKeys[def.key] ? "隐藏" : "显示"}
              </button>
            )}
          </div>
        );
      }
    }
  };

  const loading = schema.loading || list.loading;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={handleSave} loading={saving} disabled={loading || !activeGroup}>
            <Save className="h-4 w-4" />
            保存当前分组
          </Button>
        }
      />

      {loading ? (
        <Card>
          <Loading />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {/* 分组侧栏 */}
          <Card className="h-fit p-2 lg:col-span-1">
            <nav className="space-y-0.5">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={cn(
                    "block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                    activeGroup === group.id
                      ? "bg-indigo-50 font-medium text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {group.label}
                </button>
              ))}
            </nav>
          </Card>

          {/* 配置表单 */}
          <Card className="p-5 lg:col-span-3">
            {activeGroup === "business-links" ? (
              <BusinessLinksManager />
            ) : (
              <>
                {(() => {
                  const group = groups.find((g) => g.id === activeGroup);
                  return (
                    <div className="mb-4">
                      <h2 className="text-base font-semibold text-slate-900">
                        {group?.label ?? ""}
                      </h2>
                      {group?.description && (
                        <p className="mt-0.5 text-sm text-slate-500">{group.description}</p>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-5">
                  {(() => {
                    // 导航三段式（标题/分隔符/后缀）同一行展示
                    const NAV_ROW_KEYS = ["navTitle", "navSuffix", "navAfter"];
                    const navRow = groupDefs.filter((d) => NAV_ROW_KEYS.includes(d.key));
                    return groupDefs.map((def) => {
                      if (def.key === "navTitle") {
                        return (
                          <div key="nav-row" className="space-y-1.5">
                            <div className="grid grid-cols-3 gap-4 items-end">
                              {navRow.map((nd) => (
                                <div key={nd.key} className="space-y-1.5 min-w-0">
                                  <label className="block text-sm font-medium text-slate-700">
                                    {nd.label}
                                    <span className="ml-1.5 font-mono text-xs font-normal text-slate-400">
                                      {nd.key}
                                    </span>
                                  </label>
                                  {renderField(nd)}
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-400">
                              {navRow.map((nd) => nd.description).join("；")}
                            </p>
                          </div>
                        );
                      }
                      if (NAV_ROW_KEYS.includes(def.key)) return null;
                      return (
                        <div key={def.key} className="space-y-1.5">
                          <label className="block text-sm font-medium text-slate-700">
                            {def.label}
                            <span className="ml-1.5 font-mono text-xs font-normal text-slate-400">
                              {def.key}
                            </span>
                          </label>
                          {renderField(def)}
                          {def.description && (
                            <p className="text-xs text-slate-400">{def.description}</p>
                          )}
                        </div>
                      );
                    });
                  })()}
                  {groupDefs.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-400">
                      该分组暂无配置项
                    </p>
                  )}
                </div>

                <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                  <Button onClick={handleSave} loading={saving}>
                    <Save className="h-4 w-4" />
                    保存当前分组
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
