const CHR_RE = /^CHR-(\d{3})$/;

/**
 * 从现有 `角色档案` 键名中分配下一个 `CHR-001` … `CHR-999` 序号（与开局 Patch 一致）。
 * @returns 新键名；若已满 999 则返回 null（调用方应提示用户）。
 */
export function allocateNextChrId(角色档案: Record<string, unknown> | null | undefined): string | null {
  const keys = 角色档案 && typeof 角色档案 === 'object' ? Object.keys(角色档案) : [];
  let max = 0;
  for (const k of keys) {
    const m = CHR_RE.exec(k);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  const next = max + 1;
  if (next > 999) return null;
  return `CHR-${String(next).padStart(3, '0')}`;
}
