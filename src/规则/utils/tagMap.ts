/**
 * 性格：Record<名称, 描述字符串>；兼容 string[]。
 * 性癖 / 敏感部位：Record<名称, 嵌套对象>；兼容旧版「名→描述」纯字符串、string[]、JSON 字符串。
 */

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const s = raw.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return null;
  try {
    const v = JSON.parse(s) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return null;
}

function isCorruptObjectString(s: string): boolean {
  return s === '[object Object]' || s.startsWith('[object ');
}

/** 性癖单条（中文键，与 MVU / 详情编辑一致） */
export interface FetishEntryZh {
  等级: number;
  细节描述: string;
  自我合理化: string;
}

/** 敏感部位单条 */
export interface SensitiveEntryZh {
  敏感等级: number;
  生理反应: string;
  开发细节: string;
}

function coerceFetishEntry(v: Record<string, unknown>): FetishEntryZh {
  const level = v['等级'] ?? v['level'];
  const n = typeof level === 'number' && Number.isFinite(level) ? level : Number(level);
  const 等级 = Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 1;
  return {
    等级,
    细节描述: String(v['细节描述'] ?? v['description'] ?? ''),
    自我合理化: String(v['自我合理化'] ?? v['justification'] ?? ''),
  };
}

function coerceSensitiveEntry(v: Record<string, unknown>): SensitiveEntryZh {
  const level = v['敏感等级'] ?? v['level'];
  const n = typeof level === 'number' && Number.isFinite(level) ? level : Number(level);
  const 敏感等级 = Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 1;
  return {
    敏感等级,
    生理反应: String(v['生理反应'] ?? v['reaction'] ?? ''),
    开发细节: String(v['开发细节'] ?? v['devDetails'] ?? ''),
  };
}

/**
 * 将任意存档形态规范为「名 → { 等级, 细节描述, 自我合理化 }」。
 * 禁止对 object 使用 String()，避免 "[object Object]" 污染 MVU。
 */
export function normalizeFetishRecord(raw: unknown): Record<string, FetishEntryZh> {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const o: Record<string, FetishEntryZh> = {};
    raw.forEach((item, i) => {
      const s = String(item ?? '');
      const m = s.match(/^([^：:]+)[：:]\s*(.*)$/);
      if (m) {
        o[m[1].trim()] = { 等级: 1, 细节描述: m[2].trim(), 自我合理化: '' };
      } else {
        o[`标签${i + 1}`] = { 等级: 1, 细节描述: s, 自我合理化: '' };
      }
    });
    return o;
  }
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === 'string') {
    const parsed = tryParseJsonObject(raw);
    obj = parsed;
  }
  if (!obj) return {};

  const out: Record<string, FetishEntryZh> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k);
    if (v == null) continue;
    if (typeof v === 'string') {
      if (isCorruptObjectString(v)) {
        out[key] = { 等级: 1, 细节描述: '', 自我合理化: '' };
        continue;
      }
      const jp = tryParseJsonObject(v);
      if (jp) {
        out[key] = coerceFetishEntry(jp);
        continue;
      }
      out[key] = { 等级: 1, 细节描述: v, 自我合理化: '' };
      continue;
    }
    if (typeof v === 'object' && !Array.isArray(v)) {
      out[key] = coerceFetishEntry(v as Record<string, unknown>);
    }
  }
  return out;
}

/** 将任意存档形态规范为「名 → { 敏感等级, 生理反应, 开发细节 }」。 */
export function normalizeSensitivePartRecord(raw: unknown): Record<string, SensitiveEntryZh> {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const o: Record<string, SensitiveEntryZh> = {};
    raw.forEach((item, i) => {
      const s = String(item ?? '');
      const m = s.match(/^([^：:]+)[：:]\s*(.*)$/);
      if (m) {
        o[m[1].trim()] = { 敏感等级: 1, 生理反应: m[2].trim(), 开发细节: '' };
      } else {
        o[`标签${i + 1}`] = { 敏感等级: 1, 生理反应: s, 开发细节: '' };
      }
    });
    return o;
  }
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === 'string') {
    const parsed = tryParseJsonObject(raw);
    obj = parsed;
  }
  if (!obj) return {};

  const out: Record<string, SensitiveEntryZh> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k);
    if (v == null) continue;
    if (typeof v === 'string') {
      if (isCorruptObjectString(v)) {
        out[key] = { 敏感等级: 1, 生理反应: '', 开发细节: '' };
        continue;
      }
      const jp = tryParseJsonObject(v);
      if (jp) {
        out[key] = coerceSensitiveEntry(jp);
        continue;
      }
      out[key] = { 敏感等级: 1, 生理反应: v, 开发细节: '' };
      continue;
    }
    if (typeof v === 'object' && !Array.isArray(v)) {
      out[key] = coerceSensitiveEntry(v as Record<string, unknown>);
    }
  }
  return out;
}

/** 性癖嵌套对象 → 多行文案（供弹窗编辑） */
export function fetishRecordToEditableText(field: unknown): string {
  const n = normalizeFetishRecord(field);
  return Object.entries(n)
    .map(([k, o]) => {
      const d = o.细节描述.trim();
      const j = o.自我合理化.trim();
      let line = `${k}：Lv.${o.等级}`;
      if (d) line += ` ${d}`;
      if (j) line += `｜${j}`;
      return line;
    })
    .join('\n');
}

/** 敏感部位嵌套对象 → 多行文案 */
export function sensitiveRecordToEditableText(field: unknown): string {
  const n = normalizeSensitivePartRecord(field);
  return Object.entries(n)
    .map(([k, o]) => {
      const r = o.生理反应.trim();
      const d = o.开发细节.trim();
      let line = `${k}：Lv.${o.敏感等级}`;
      if (r) line += ` ${r}`;
      if (d) line += `｜${d}`;
      return line;
    })
    .join('\n');
}

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

/** 多行编辑 → 性癖嵌套对象（每行「名称：描述」） */
export function parseEditableTextToFetishRecord(text: string): Record<string, FetishEntryZh> {
  return normalizeFetishRecord(parseEditableTextToTagMap(text));
}

/** 多行编辑 → 敏感部位嵌套对象 */
export function parseEditableTextToSensitiveRecord(text: string): Record<string, SensitiveEntryZh> {
  return normalizeSensitivePartRecord(parseEditableTextToTagMap(text));
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
