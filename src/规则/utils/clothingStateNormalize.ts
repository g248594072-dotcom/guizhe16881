/**
 * 「服装状态」身体槽位：旧版单对象 { 名称, 状态, 描述 } → 新版 Record<服装名, { 状态, 描述 }>
 * 供 schema preprocess 与 dialogAndVariable 读侧统一使用。
 */

import { CLOTHING_BODY_SLOT_KEYS, type ClothingBodySlotKeyZh } from '../types';

const LEGACY_SLOT_KEYS = new Set(['名称', '状态', '描述']);

function isLegacySingleGarmentObject(o: Record<string, unknown>): boolean {
  if ('名称' in o) return true;
  const keys = Object.keys(o);
  if (keys.length === 0) return false;
  return keys.every(k => LEGACY_SLOT_KEYS.has(k));
}

/**
 * 规范化单个身体槽位（上装/下装等）的原始值。
 */
export function normalizeClothingBodySlotRecord(raw: unknown): Record<string, { 状态: string; 描述: string }> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;

  if (isLegacySingleGarmentObject(o)) {
    const 名称 = String(o.名称 ?? '').trim();
    const 状态 = String(o.状态 ?? '正常').trim() || '正常';
    const 描述 = String(o.描述 ?? '');
    if (!名称 && !描述 && 状态 === '正常') return {};
    if (!名称) return { '（未命名）': { 状态, 描述 } };
    return { [名称]: { 状态, 描述 } };
  }

  const out: Record<string, { 状态: string; 描述: string }> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null || typeof v !== 'object' || Array.isArray(v)) continue;
    const entry = v as Record<string, unknown>;
    if (isLegacySingleGarmentObject(entry)) {
      const nm = String(entry.名称 ?? k).trim() || String(k).trim();
      if (!nm) continue;
      out[nm] = {
        状态: String(entry.状态 ?? '正常').trim() || '正常',
        描述: String(entry.描述 ?? ''),
      };
      continue;
    }
    const nameKey = String(k).trim();
    if (!nameKey) continue;
    out[nameKey] = {
      状态: String(entry.状态 ?? '正常').trim() || '正常',
      描述: String(entry.描述 ?? ''),
    };
  }
  return out;
}

/** 对完整「服装状态」对象做身体槽迁移与缺键补全（饰品仅保证为 object） */
export function normalize服装状态Raw(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  for (const k of CLOTHING_BODY_SLOT_KEYS) {
    o[k] = normalizeClothingBodySlotRecord(o[k]);
  }
  const acc = o.饰品;
  if (acc == null || typeof acc !== 'object' || Array.isArray(acc)) o.饰品 = {};
  return o;
}

export function mergeBodySlotRecords(
  base: Record<string, { 状态: string; 描述: string }>,
  incoming: Record<string, { 状态: string; 描述: string }>,
): Record<string, { 状态: string; 描述: string }> {
  const out = { ...base };
  for (const [name, item] of Object.entries(incoming)) {
    const key = String(name).trim();
    if (!key) continue;
    const prev = out[key] ?? { 状态: '正常', 描述: '' };
    out[key] = {
      状态: String(item?.状态 ?? prev.状态 ?? '正常').trim() || '正常',
      描述: String(item?.描述 ?? prev.描述 ?? ''),
    };
  }
  return out;
}
