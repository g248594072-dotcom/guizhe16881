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

/**
 * MVU 常见存盘形态：叶子为 [实际值, "描述字符串"]，若不拆包会被当成数组或错误解析。
 */
export function unwrapMvuTaggedValue(v: unknown): unknown {
  if (Array.isArray(v) && v.length >= 2 && typeof v[1] === 'string') {
    return v[0];
  }
  return v;
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

/** MVU「爱好」单条 */
export interface HobbyEntryZh {
  等级: number;
  喜欢的原因: string;
}

function coerceFetishEntry(v: Record<string, unknown>): FetishEntryZh {
  const levelRaw = unwrapMvuTaggedValue(v['等级'] ?? v['level']);
  const n =
    typeof levelRaw === 'number' && Number.isFinite(levelRaw) ? levelRaw : Number(levelRaw);
  const 等级 = Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 1;
  const 细节Raw = unwrapMvuTaggedValue(v['细节描述'] ?? v['description']);
  const 自我Raw = unwrapMvuTaggedValue(v['自我合理化'] ?? v['justification']);
  return {
    等级,
    细节描述: 细节Raw == null ? '' : String(细节Raw),
    自我合理化: 自我Raw == null ? '' : String(自我Raw),
  };
}

function coerceSensitiveEntry(v: Record<string, unknown>): SensitiveEntryZh {
  const levelRaw = unwrapMvuTaggedValue(v['敏感等级'] ?? v['level']);
  const n =
    typeof levelRaw === 'number' && Number.isFinite(levelRaw) ? levelRaw : Number(levelRaw);
  const 敏感等级 = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 1;
  const 反应Raw = unwrapMvuTaggedValue(v['生理反应'] ?? v['reaction']);
  const 开发Raw = unwrapMvuTaggedValue(v['开发细节'] ?? v['devDetails']);
  return {
    敏感等级,
    生理反应: 反应Raw == null ? '' : String(反应Raw),
    开发细节: 开发Raw == null ? '' : String(开发Raw),
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
    const vUn = unwrapMvuTaggedValue(v);
    if (typeof vUn === 'string') {
      if (isCorruptObjectString(vUn)) {
        out[key] = { 等级: 1, 细节描述: '', 自我合理化: '' };
        continue;
      }
      const jp = tryParseJsonObject(vUn);
      if (jp) {
        out[key] = coerceFetishEntry(jp);
        continue;
      }
      out[key] = { 等级: 1, 细节描述: vUn, 自我合理化: '' };
      continue;
    }
    if (typeof vUn === 'object' && vUn !== null && !Array.isArray(vUn)) {
      out[key] = coerceFetishEntry(vUn as Record<string, unknown>);
    }
  }
  return out;
}

function coerceHobbyEntry(v: Record<string, unknown>): HobbyEntryZh {
  const levelRaw = unwrapMvuTaggedValue(v['等级'] ?? v['level']);
  const n =
    typeof levelRaw === 'number' && Number.isFinite(levelRaw) ? levelRaw : Number(levelRaw);
  const 等级 = Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 1;
  const reasonRaw = unwrapMvuTaggedValue(v['喜欢的原因'] ?? v['原因']);
  return {
    等级,
    喜欢的原因: reasonRaw == null ? '' : String(reasonRaw),
  };
}

/**
 * 将任意存档形态规范为「爱好名 → { 等级, 喜欢的原因 }」；兼容旧 string / string[] / JSON 字符串。
 */
export function normalizeHobbyRecord(raw: unknown): Record<string, HobbyEntryZh> {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const o: Record<string, HobbyEntryZh> = {};
    raw.forEach((item, i) => {
      const s = String(item ?? '');
      const m = s.match(/^([^：:]+)[：:]\s*(.*)$/);
      if (m) {
        o[m[1].trim()] = { 等级: 1, 喜欢的原因: m[2].trim() };
      } else {
        o[`爱好${i + 1}`] = { 等级: 1, 喜欢的原因: s };
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

  const out: Record<string, HobbyEntryZh> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k);
    if (v == null) continue;
    const vUn = unwrapMvuTaggedValue(v);
    if (typeof vUn === 'string') {
      if (isCorruptObjectString(vUn)) {
        out[key] = { 等级: 1, 喜欢的原因: '' };
        continue;
      }
      const jp = tryParseJsonObject(vUn);
      if (jp) {
        out[key] = coerceHobbyEntry(jp);
        continue;
      }
      out[key] = { 等级: 1, 喜欢的原因: vUn };
      continue;
    }
    if (typeof vUn === 'object' && vUn !== null && !Array.isArray(vUn)) {
      out[key] = coerceHobbyEntry(vUn as Record<string, unknown>);
    }
  }
  return out;
}

/**
 * 「代表性发言」：语境标识 → 台词字符串；兼容 JSON 字符串、纯对象。
 */
export function normalizeRepresentativeSpeechRecord(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const o: Record<string, string> = {};
    raw.forEach((item, i) => {
      o[`台词${i + 1}`] = String(item ?? '').trim();
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

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k).trim();
    if (!key) continue;
    const vUn = unwrapMvuTaggedValue(v);
    out[key] = vUn == null ? '' : String(vUn).trim();
  }
  return out;
}

/**
 * 读侧合并：`敏感点开发` 优先覆盖同名键，再并入旧键 `敏感部位`。
 */
export function getMergedSensitiveDevelopment(rawChar: unknown): Record<string, SensitiveEntryZh> {
  if (rawChar == null || typeof rawChar !== 'object' || Array.isArray(rawChar)) {
    return {};
  }
  const o = rawChar as Record<string, unknown>;
  const legacy = normalizeSensitivePartRecord(o['敏感部位']);
  const current = normalizeSensitivePartRecord(o['敏感点开发']);
  return { ...legacy, ...current };
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
    const vUn = unwrapMvuTaggedValue(v);
    if (typeof vUn === 'string') {
      if (isCorruptObjectString(vUn)) {
        out[key] = { 敏感等级: 1, 生理反应: '', 开发细节: '' };
        continue;
      }
      const jp = tryParseJsonObject(vUn);
      if (jp) {
        out[key] = coerceSensitiveEntry(jp);
        continue;
      }
      out[key] = { 敏感等级: 1, 生理反应: vUn, 开发细节: '' };
      continue;
    }
    if (typeof vUn === 'object' && vUn !== null && !Array.isArray(vUn)) {
      out[key] = coerceSensitiveEntry(vUn as Record<string, unknown>);
    }
  }
  return out;
}

/**
 * 写入 MVU 前对 stat_data 做一次浅修正：保证「角色档案」内 性癖/敏感点开发/敏感部位 为规范嵌套对象，
 * 避免 MVU 变量树把子项显示成 [object Object] 或脏字符串长期残留。
 */
export function sanitizeStatDataRoleArchivesNestedMaps(statData: unknown): unknown {
  if (statData == null || typeof statData !== 'object' || Array.isArray(statData)) {
    return statData;
  }
  const sd = statData as Record<string, unknown>;
  const 角色档案 = sd['角色档案'];
  if (角色档案 == null || typeof 角色档案 !== 'object' || Array.isArray(角色档案)) {
    return statData;
  }
  const chars = { ...(角色档案 as Record<string, unknown>) };
  for (const [id, ch] of Object.entries(chars)) {
    if (ch == null || typeof ch !== 'object' || Array.isArray(ch)) continue;
    const c = { ...(ch as Record<string, unknown>) };
    if ('性癖' in c) c['性癖'] = normalizeFetishRecord(c['性癖']);
    if ('敏感点开发' in c) c['敏感点开发'] = normalizeSensitivePartRecord(c['敏感点开发']);
    if ('敏感部位' in c) c['敏感部位'] = normalizeSensitivePartRecord(c['敏感部位']);
    if ('爱好' in c) c['爱好'] = normalizeHobbyRecord(c['爱好']);
    if ('代表性发言' in c) c['代表性发言'] = normalizeRepresentativeSpeechRecord(c['代表性发言']);
    chars[id] = c;
  }
  return { ...sd, 角色档案: chars };
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

/** 变量 / Record → 弹窗多行文案（主要用于性格等「名→字符串」；遇嵌套对象时用 JSON，避免 [object Object]） */
export function tagMapToEditableText(field: unknown): string {
  if (field == null) return '';
  if (Array.isArray(field)) return field.join('\n');
  if (typeof field === 'object') {
    return Object.entries(field as Record<string, unknown>)
      .map(([k, v]) => {
        if (v == null) return k;
        if (typeof v === 'string') return String(v).trim() ? `${k}：${v}` : k;
        if (typeof v === 'object' && !Array.isArray(v)) {
          try {
            return `${k}：${JSON.stringify(v)}`;
          } catch {
            return k;
          }
        }
        const sv = String(v).trim();
        return sv && !isCorruptObjectString(sv) ? `${k}：${sv}` : k;
      })
      .join('\n');
  }
  return '';
}

export type TagFieldBadgeNested = 'none' | 'fetish' | 'sensitive';

/** Badge 列表：对象展平为「键：值」；嵌套对象勿用 String(v)，避免 [object Object] */
export function tagFieldToBadgeLines(field: unknown, nested: TagFieldBadgeNested = 'none'): string[] {
  if (field == null) return [];
  if (Array.isArray(field)) return field.map(s => String(s));
  if (typeof field === 'object') {
    return Object.entries(field as Record<string, unknown>).map(([k, v]) => {
      if (v == null) return k;
      if (typeof v === 'string') {
        return String(v).trim() ? `${k}：${v}` : k;
      }
      if (nested === 'fetish' && typeof v === 'object' && !Array.isArray(v)) {
        const one = normalizeFetishRecord({ [k]: unwrapMvuTaggedValue(v) });
        const e = one[k];
        if (e) {
          const d = e.细节描述.trim();
          const j = e.自我合理化.trim();
          let s = `${k}：Lv.${e.等级}`;
          if (d) s += ` ${d}`;
          if (j) s += `｜${j}`;
          return s;
        }
        return k;
      }
      if (nested === 'sensitive' && typeof v === 'object' && !Array.isArray(v)) {
        const one = normalizeSensitivePartRecord({ [k]: unwrapMvuTaggedValue(v) });
        const e = one[k];
        if (e) {
          const r = e.生理反应.trim();
          const d = e.开发细节.trim();
          let s = `${k}：Lv.${e.敏感等级}`;
          if (r) s += ` ${r}`;
          if (d) s += `｜${d}`;
          return s;
        }
        return k;
      }
      const sv = String(v).trim();
      return sv && !isCorruptObjectString(sv) ? `${k}：${sv}` : k;
    });
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
