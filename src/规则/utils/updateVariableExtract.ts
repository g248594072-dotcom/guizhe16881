/**
 * 从聊天/发送框文本中提取成对闭合的 `<UpdateVariable>…</UpdateVariable>`。
 * 开标签允许可选属性（与 `xmlTagExtract` / 原 `App.vue` 规则一致）；闭标签大小写不敏感；
 * 使用栈处理嵌套同名标签，避免仅用 `*?` 正则在遇到内层 `</UpdateVariable>` 子串时截断错误。
 */

const UPDATE_VARIABLE_OPEN_RE = /<UpdateVariable(\s+[^>]*)?>/gi;
const UPDATE_VARIABLE_CLOSE_RE = /<\/UpdateVariable\s*>/gi;

export type UpdateVariableBlockRange = { start: number; end: number };

/**
 * 返回所有**顶层**闭合块在原字符串中的区间（按出现顺序，互不重叠）。
 */
export function extractAllClosedUpdateVariableBlockRanges(text: string): UpdateVariableBlockRange[] {
  const s = String(text || '');
  const combined = new RegExp(
    `${UPDATE_VARIABLE_OPEN_RE.source}|${UPDATE_VARIABLE_CLOSE_RE.source}`,
    'gi',
  );
  const stack: number[] = [];
  const completed: UpdateVariableBlockRange[] = [];
  let m: RegExpExecArray | null;
  while ((m = combined.exec(s)) !== null) {
    const raw = m[0];
    const isClose = /^<\//i.test(raw);
    if (!isClose) {
      stack.push(m.index);
    } else if (stack.length > 0) {
      const start = stack.pop()!;
      if (stack.length === 0) {
        completed.push({ start, end: m.index + raw.length });
      }
    }
  }
  return completed;
}

export function extractAllClosedUpdateVariableBlocks(text: string): string[] {
  const s = String(text || '');
  return extractAllClosedUpdateVariableBlockRanges(s).map(({ start, end }) => s.slice(start, end));
}

/** 去掉文中所有成对闭合的 UpdateVariable 块（用于双 API 合并前清理主模型重复块） */
export function stripAllClosedUpdateVariableBlocks(text: string): string {
  const ranges = extractAllClosedUpdateVariableBlockRanges(text).sort((a, b) => b.start - a.start);
  let out = String(text || '');
  for (const r of ranges) {
    out = out.slice(0, r.start) + out.slice(r.end);
  }
  return out;
}

/** 单块：标签内部正文（不含外壳标签） */
export function innerBodyOfUpdateVariableBlock(block: string): string {
  const b = String(block || '');
  const open = b.match(/^<UpdateVariable(\s+[^>]*)?>/i);
  if (!open) return b.trim();
  const rest = b.slice(open[0].length);
  const close = rest.toLowerCase().lastIndexOf('</updatevariable');
  if (close === -1) return rest.trim();
  return rest.slice(0, close).trim();
}

/**
 * 从整段文本取出所有块的**内部**正文，去重后拼接（先 chat 再 fallback 独有项）。
 * @param maxChars 总长度上限（超出截断并附说明）
 */
export function mergeUpdateVariableInnerBodiesForPrompt(
  chatBody: string,
  fallbackBody: string,
  maxChars: number,
): string {
  const innersA = extractAllClosedUpdateVariableBlocks(chatBody).map(innerBodyOfUpdateVariableBlock);
  const innersB = extractAllClosedUpdateVariableBlocks(fallbackBody).map(innerBodyOfUpdateVariableBlock);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of [...innersA, ...innersB]) {
    const k = x.trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x.trim());
  }
  let joined = out.join('\n\n---\n\n');
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars)}\n\n…（以上内容已截断，仍以已展示部分为准：勿删改其中 path/取值意图）`;
}

/**
 * 取文本中**最后一处**闭合 `<UpdateVariable>` 块的内部正文（嵌套安全）。
 * 供 `App.vue` 与第二 API 解析与原先 `extractLastTagContent(..., 'UpdateVariable')` 对齐且更稳。
 */
export function extractLastUpdateVariableInner(text: string): string {
  const blocks = extractAllClosedUpdateVariableBlocks(text);
  if (blocks.length === 0) return '';
  return innerBodyOfUpdateVariableBlock(blocks[blocks.length - 1] ?? '');
}
