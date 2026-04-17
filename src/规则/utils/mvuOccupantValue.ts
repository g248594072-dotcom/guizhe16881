/**
 * 建筑数据「当前角色」：值可为 boolean | string | number（与 MVU schema、变量更新规则一致）。
 */

export function isMvuOccupantValuePresent(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw == null) return false;
  if (typeof raw === 'number') return raw !== 0 && !Number.isNaN(raw);
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s === '') return false;
    const lower = s.toLowerCase();
    if (
      lower === 'false' ||
      lower === '0' ||
      lower === '否' ||
      lower === '不在' ||
      lower === '离开' ||
      lower === '离场' ||
      lower === '退场'
    ) {
      return false;
    }
    return true;
  }
  return false;
}

/** 列出视为「在场」的标识符，用于角色详情等只读展示 */
export function formatMvuBuildingOccupantsLine(当前角色: Record<string, unknown> | null | undefined): string {
  if (!当前角色 || typeof 当前角色 !== 'object' || Array.isArray(当前角色)) return '';
  const keys = Object.keys(当前角色).filter(k => isMvuOccupantValuePresent(当前角色[k]));
  if (keys.length === 0) return '';
  return keys.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')).join('，');
}
