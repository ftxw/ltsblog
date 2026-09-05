"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { pad2 } from "@/app/lib/format";

const ITEM_H = 36;
const VISIBLE = 5;

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 单列滚轮：鼠标滚轮 / 触摸滑动 选择 */
function WheelColumn({
  items,
  index,
  onIndexChange,
}: {
  items: string[];
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; index: number } | null>(null);

  const step = (delta: number) =>
    onIndexChange(clamp(index + delta, 0, items.length - 1));

  const handleWheel = (e: React.WheelEvent) => {
    const delta = Math.sign(e.deltaY);
    if (delta !== 0) {
      e.preventDefault();
      step(delta);
    }
  };

  // 统一用 Pointer Events：鼠标 / 触摸 均可拖动
  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { y: e.clientY, index };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setDragY(e.clientY - dragStart.current.y);
  };
  const onPointerUp = () => {
    const s = dragStart.current;
    if (s) {
      const steps = Math.round(dragY / ITEM_H);
      if (steps !== 0) {
        onIndexChange(clamp(s.index - steps, 0, items.length - 1));
      }
    }
    dragStart.current = null;
    setDragging(false);
    setDragY(0);
  };

  const centerIndex = (VISIBLE - 1) / 2;

  return (
    <div
      className="relative flex-1 overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{ height: ITEM_H * VISIBLE, touchAction: "none" }}
      onWheel={handleWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* 上下渐隐遮罩 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-white to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-white to-transparent" />
      {/* 选中高亮条（置于文字下层） */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 bg-slate-100" style={{ height: ITEM_H }} />
      <div
        className="absolute inset-x-0 will-change-transform"
        style={{
          transition: dragging ? "none" : "transform 180ms ease",
          transform: `translateY(${
            -(index * ITEM_H) + centerIndex * ITEM_H + dragY
          }px)`,
        }}
      >
        {items.map((item, i) => (
          <div
            key={item}
            className={cn(
              "flex h-9 items-center justify-center text-sm",
              i === index
                ? "font-semibold text-slate-900"
                : "text-slate-500"
            )}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 年月日三滚轮日期选择器（替代原生 datetime-local 日历点选）。
 * value 格式：`YYYY-MM-DD` 或空字符串（未设置）。
 */
export default function DateWheelPicker({
  value,
  onChange,
  placeholder = "未设置",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => {
    if (!value) return null;
    const m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    return { year: +m[1], month: +m[2], day: +m[3] };
  }, [value]);

  const nowYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const min = 1970;
    const max = nowYear + 5;
    const list: number[] = [];
    for (let y = min; y <= max; y++) list.push(y);
    return list;
  }, [nowYear]);

  const [draft, setDraft] = useState(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  });

  const openPanel = () => {
    if (parsed) setDraft(parsed);
    setOpen((o) => !o);
  };

  const daysInMonth = new Date(draft.year, draft.month, 0).getDate();
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`);

  const setYear = (year: number) => {
    setDraft((d) => ({
      ...d,
      year,
      day: Math.min(d.day, new Date(year, d.month, 0).getDate()),
    }));
  };
  const setMonth = (month: number) => {
    setDraft((d) => ({
      ...d,
      month,
      day: Math.min(d.day, new Date(d.year, month, 0).getDate()),
    }));
  };
  const setDay = (day: number) => setDraft((d) => ({ ...d, day }));

  const confirm = () => {
    onChange(`${draft.year}-${pad2(draft.month)}-${pad2(draft.day)}`);
    setOpen(false);
  };
  const clear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPanel}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors",
          "hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100",
          open && "border-indigo-400 ring-2 ring-indigo-100"
        )}
      >
        <span className={cn(!value && "text-slate-400")}>
          {value || placeholder}
        </span>
        <svg
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180"
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex divide-x divide-slate-100">
            <WheelColumn
              items={yearOptions.map(String)}
              index={Math.max(0, yearOptions.indexOf(draft.year))}
              onIndexChange={(i) => setYear(yearOptions[i])}
            />
            <WheelColumn
              items={MONTHS}
              index={draft.month - 1}
              onIndexChange={(i) => setMonth(i + 1)}
            />
            <WheelColumn
              items={dayOptions}
              index={draft.day - 1}
              onIndexChange={(i) => setDay(i + 1)}
            />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-3 w-3" />
              清除
            </button>
            <button
              type="button"
              onClick={confirm}
              className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600 cursor-pointer"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
