/**
 * 性格 / 性癖 / 敏感部位：与《变量更新规则》一致，为 Record<名称, 描述字符串>；
 * 兼容旧存档与 AI 偶发的 string[]。
 */

/** 归一化为 Record（供 Zod preprocess、store、variableReader 共用） */
export function normalizeTagMap(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const o: Record<string, string> = {};
    raw.forEach((item, i) => {
      const s = String(item ?? '');
      const m = s.match(/^([^：:]+)[：:]\s*(.*)$/);
      if (m) o[m[1].trim()] = m[2].trim();
      else o[`标签${i + 1}`] = s;
    });
    return o;
  }
  if (typeof raw === 'object') {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      o[String(k)] = v == null ? '' : String(v);
    }
    return o;
  }
  return {};
}

/** 弹窗多行编辑：每行「名称：描述」或单独一行描述 */
export function parseEditableTextToTagMap(text: string): Record<string, string> {
  const raw = String(text ?? '');
  const lines = raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const o: Record<string, string> = {};
  lines.forEach((line, i) => {
    const m = line.match(/^([^：:]+)[：:]\s*(.*)$/);
    if (m) o[m[1].trim()] = m[2].trim();
    else o[`标签${i + 1}`] = line;
  });
  return o;
}

/** 变量 / Record → 弹窗多行文案 */
export function tagMapToEditableText(field: unknown): string {
  if (field == null) return '';
  if (Array.isArray(field)) return field.join('\n');
  if (typeof field === 'object') {
    return Object.entries(field as Record<string, string>)
      .map(([k, v]) => (String(v).trim() ? `${k}：${v}` : k))
      .join('\n');
  }
  return '';
}

/** Badge 列表：对象展平为「键：值」，数组保持原样字符串 */
export function tagFieldToBadgeLines(field: unknown): string[] {
  if (field == null) return [];
  if (Array.isArray(field)) return field.map(s => String(s));
  if (typeof field === 'object') {
    return Object.entries(field as Record<string, string>).map(([k, v]) =>
      String(v).trim() ? `${k}：${v}` : k,
    );
  }
  return [];
}

/** 三围：字符串 / 数字 / { B,W,H } 与更新规则、AI 输出对齐 */
export function normalize三围(raw: unknown): string {
  if (raw == null || raw === '') return '未知';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    const B = o.B ?? o.b;
    const W = o.W ?? o.w;
    const H = o.H ?? o.h;
    if (B != null && W != null && H != null) return `B${B} W${W} H${H}`;
  }
  return '未知';
}
