/**
 * 合并多段「&lt;UpdateVariable&gt; 标签内部」的 Patch 文本（JSON 数组或 &lt;JSONPatch&gt; 包裹）。
 * 供第二 API 变量路、NPC 生活、附加任务等共用。
 */

function tryParseJsonPatchArrayFromInner(inner: string): unknown[] | null {
  const t = inner.trim();
  const jp = t.match(/^<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
  const jsonStr = jp ? jp[1].trim() : t;
  try {
    const v = JSON.parse(jsonStr) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * 合并两段「UpdateVariable 标签内部」的 Patch 文本（通常为 JSON 数组或 &lt;JSONPatch&gt; 包裹的数组）。
 */
export function mergeVariableUpdateJsonPatchInners(primary: string, secondary: string): string {
  const a = tryParseJsonPatchArrayFromInner(primary);
  const b = tryParseJsonPatchArrayFromInner(secondary);
  if (a === null && b === null) return primary.trim();
  if (a === null) return (b?.length ?? 0) > 0 ? secondary.trim() : primary.trim();
  if (b === null || b.length === 0) return primary.trim();
  return JSON.stringify([...a, ...b], null, 2);
}
