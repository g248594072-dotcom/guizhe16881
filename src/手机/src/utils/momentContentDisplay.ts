/**
 * 朋友圈动态正文展示：兼容模型返回完整 JSON、截断 JSON 或纯文本。
 * 历史数据里可能存了未解析成功的整段 JSON 字符串，这里在 UI 层再抽一层正文。
 */
export function extractMomentContentForDisplay(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;

  const stripped = raw.replace(/```json|```/gi, '').trim();
  if (!stripped.startsWith('{')) return raw;

  const tryParse = (s: string): string | null => {
    try {
      const jsonStr = s.replace(/,(\s*[}\]])/g, '$1');
      const parsed = JSON.parse(jsonStr) as { content?: unknown };
      if (typeof parsed.content === 'string') return parsed.content;
      if (parsed.content && typeof parsed.content === 'object' && parsed.content !== null) {
        const nested = (parsed.content as { content?: unknown }).content;
        if (typeof nested === 'string') return nested;
      }
    } catch {
      /* 尝试下一种方式 */
    }
    return null;
  };

  const fromParse = tryParse(stripped);
  if (fromParse !== null) return fromParse;

  // 截断或不合法 JSON：从 "content": "… 中抽取（支持未闭合的引号，即模型输出被截断）
  const keyMatch = stripped.match(/"content"\s*:\s*"/);
  if (!keyMatch || keyMatch.index === undefined) {
    return raw;
  }

  let i = keyMatch.index + keyMatch[0].length;
  let out = '';
  while (i < stripped.length) {
    const c = stripped[i]!;
    if (c === '\\') {
      const n = stripped[i + 1];
      if (n === 'n') {
        out += '\n';
        i += 2;
        continue;
      }
      if (n === 'r') {
        out += '\r';
        i += 2;
        continue;
      }
      if (n === 't') {
        out += '\t';
        i += 2;
        continue;
      }
      if (n === '"' || n === '\\' || n === '/') {
        out += n!;
        i += 2;
        continue;
      }
      if (n === 'u' && stripped.slice(i + 2, i + 6).match(/^[0-9a-fA-F]{4}$/)) {
        out += String.fromCharCode(parseInt(stripped.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (c === '"') break;
    out += c;
    i++;
  }

  return out.trim() || raw;
}
