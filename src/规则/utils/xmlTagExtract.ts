/**
 * 从一段文本中取「最后一个」成对 XML 风格标签的**内部**正文（不含标签壳）。
 * 适用于 `maintext` 等**不会与自身嵌套**的标签；若需嵌套安全的 `<UpdateVariable>`，请用
 * `extractLastUpdateVariableInner`（见 `updateVariableExtract.ts`）。
 */

function escapeReTagName(tag: string): string {
  return String(tag || '').replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
}

/** 最后一个 `</tag…>` 的起始下标（忽略大小写；允许 `</tag >`） */
function lastClosingTagStart(text: string, tag: string): number {
  const lo = text.toLowerCase();
  const needle = `</${String(tag || '').toLowerCase()}`;
  let from = lo.length;
  while (from > 0) {
    const i = lo.lastIndexOf(needle, from - 1);
    if (i === -1) return -1;
    const gt = text.indexOf('>', i);
    if (gt === -1) {
      from = i;
      continue;
    }
    return i;
  }
  return -1;
}

/**
 * 与原先 `App.vue` 的 `extractLastTagContent` 行为一致：最后闭合处往前取最后一个开标签，返回其间内容。
 */
export function extractLastTagInnerContent(text: string, tag: string): string {
  const s = String(text || '');
  const t = String(tag || '').trim();
  if (!s || !t) return '';

  const closeIdx = lastClosingTagStart(s, t);
  if (closeIdx === -1) return '';

  const textBeforeClose = s.slice(0, closeIdx);
  const reOpen = new RegExp(`<${escapeReTagName(t)}(\\s+[^>]*)?>`, 'gi');
  let m: RegExpExecArray | null;
  let lastOpen: RegExpExecArray | null = null;
  while ((m = reOpen.exec(textBeforeClose)) !== null) lastOpen = m;
  if (!lastOpen) return '';

  const openIdx = lastOpen.index;
  const openLen = lastOpen[0].length;
  return s.slice(openIdx + openLen, closeIdx).trim();
}
