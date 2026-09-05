"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

export interface DragSortItem {
  id: string;
}

export type SortStrategy = "vertical" | "horizontal" | "rect";

/**
 * 基于 dnd-kit 的通用拖拽排序（实时交换 + 平滑动画）：
 * - items：当前渲染的列表（顺序受控，页面负责用 setState 更新）
 * - onReorder(nextIds)：拖拽过程中实时让位时的本地更新（同步 setState）
 * - onCommit(ids)：松手后的最终顺序持久化（调 reorder API，失败请自行 reload 恢复）
 *
 * 用法：
 *   const { sensors, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel, ids, strategy } = useDragSort(...);
 *   <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={...} onDragOver={...} onDragEnd={...} onDragCancel={...}>
 *     <SortableContext items={ids} strategy={strategy}>
 *       {items.map((x) => <SortableXxx key={x.id} item={x} />)}
 *     </SortableContext>
 *   </DndContext>
 *   其中 SortableXxx 内部调用 useSortable({ id: item.id })。
 */
export function useDragSort<T extends DragSortItem>({
  items,
  onReorder,
  onCommit,
  strategy = "vertical",
}: {
  items: T[];
  onReorder: (nextIds: string[]) => void;
  onCommit: (ids: string[]) => void | Promise<void>;
  strategy?: SortStrategy;
}) {
  const ids = useMemo(() => items.map((x) => x.id), [items]);
  const idsRef = useRef(ids);
  const initialIdsRef = useRef<string[]>(ids);

  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(() => {
    initialIdsRef.current = idsRef.current;
  }, []);

  // 拖拽过程中实时让位：把 active 项移动到 over 项的位置
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const cur = idsRef.current;
      const oldIndex = cur.indexOf(String(active.id));
      const newIndex = cur.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(cur, oldIndex, newIndex);
      idsRef.current = next;
      onReorder(next);
    },
    [onReorder]
  );

  // 松手：持久化拖拽结束后的最终顺序（顺序没变化则跳过）
  const handleDragEnd = useCallback(() => {
    const next = idsRef.current;
    const initial = initialIdsRef.current;
    if (
      initial.length === next.length &&
      initial.every((id, i) => id === next[i])
    ) {
      return;
    }
    void onCommit(next);
  }, [onCommit]);

  // 取消（Esc / 中断）：恢复拖拽前的顺序
  const handleDragCancel = useCallback(() => {
    const initial = initialIdsRef.current;
    idsRef.current = initial;
    onReorder(initial);
  }, [onReorder]);

  const strategyImpl = useMemo(() => {
    if (strategy === "horizontal") return horizontalListSortingStrategy;
    if (strategy === "rect") return rectSortingStrategy;
    return verticalListSortingStrategy;
  }, [strategy]);

  return {
    ids,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    strategy: strategyImpl,
  };
}

/** 按 ids 重排 items：ids 中的项按新顺序排前，其余项保持原顺序跟在后面（支持分页场景） */
export function reorderItemsByIds<T extends DragSortItem>(
  items: T[],
  ids: string[]
): T[] {
  const map = new Map(items.map((x) => [x.id, x]));
  const set = new Set(ids);
  return [
    ...ids.map((id) => map.get(id)).filter((x): x is T => Boolean(x)),
    ...items.filter((x) => !set.has(x.id)),
  ];
}
