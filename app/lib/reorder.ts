/**
 * 拖拽排序的段内重排工具：
 * 只重排 ids 覆盖的位置区间，区间外元素保持原有相对顺序与 sort 值。
 * 这样分页列表（如项目/书签）在页内拖拽时不会影响其它页的顺序。
 */
export function applySegmentReorder<T extends { id: string }>(
  list: T[],
  ids: string[]
): string[] {
  const posMap = new Map<string, number>();
  list.forEach((x, i) => posMap.set(x.id, i));
  const positions = ids.map((id) => posMap.get(id)!);
  const minPos = Math.min(...positions);
  const maxPos = Math.max(...positions);
  const rangeIds = list.slice(minPos, maxPos + 1).map((x) => x.id);
  const idSet = new Set(ids);
  const rest = rangeIds.filter((id) => !idSet.has(id));
  const newRange = [...ids, ...rest];
  const full = list.map((x) => x.id);
  newRange.forEach((id, i) => {
    full[minPos + i] = id;
  });
  return full;
}
