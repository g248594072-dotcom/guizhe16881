import type { OpeningFormData } from '../types';

/** 从开局表单文案中解析出的公历故事时间（用于「现代」纪历基底覆盖系统日期） */
export interface OpeningGregorianDateOverride {
  年: number;
  月: number;
  日: number;
  时?: number;
  分?: number;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < 100 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isValidHm(h: number, m: number): boolean {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** 合并开场补充、场景行、世界简介，优先采用靠前字段中出现的日期（用户常把具体时间写在开场补充里） */
export function collectOpeningDateSearchText(formData: OpeningFormData): string {
  const chunks = [formData.openingSceneDetail, formData.sceneDescription, formData.worldIntro]
    .map(s => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  return chunks.join('\n');
}

/**
 * 从文本中提取首个可验证的公历「年月日」，可选紧跟的「时:分」。
 * 支持：2008年6月10日、2008年06月10日 14:30、2008-6-10、2008/06/10 等。
 */
export function parseGregorianYmdFromText(text: string): OpeningGregorianDateOverride | null {
  if (!text || !text.trim()) return null;

  type Hit = { index: number; result: OpeningGregorianDateOverride };
  const hits: Hit[] = [];

  const zhRe = /(?:公元\s*)?(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  let m: RegExpExecArray | null;
  while ((m = zhRe.exec(text)) !== null) {
    const 年 = Number(m[1]);
    const 月 = Number(m[2]);
    const 日 = Number(m[3]);
    if (!isValidYmd(年, 月, 日)) continue;
    const tail = text.slice(m.index + m[0].length);
    const timeTail = tail.match(/^\s*[,，]?\s*(\d{1,2})\s*[:：]\s*(\d{2})\b/);
    const result: OpeningGregorianDateOverride = { 年, 月, 日 };
    if (timeTail) {
      const 时 = Number(timeTail[1]);
      const 分 = Number(timeTail[2]);
      if (isValidHm(时, 分)) {
        result.时 = 时;
        result.分 = 分;
      }
    }
    hits.push({ index: m.index, result });
  }

  const isoRe = /\b(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})\b)?/g;
  while ((m = isoRe.exec(text)) !== null) {
    const 年 = Number(m[1]);
    const 月 = Number(m[2]);
    const 日 = Number(m[3]);
    if (!isValidYmd(年, 月, 日)) continue;
    const result: OpeningGregorianDateOverride = { 年, 月, 日 };
    if (m[4] != null && m[5] != null) {
      const 时 = Number(m[4]);
      const 分 = Number(m[5]);
      if (isValidHm(时, 分)) {
        result.时 = 时;
        result.分 = 分;
      }
    }
    hits.push({ index: m.index, result });
  }

  const slashRe = /\b(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})\b)?/g;
  while ((m = slashRe.exec(text)) !== null) {
    const 年 = Number(m[1]);
    const 月 = Number(m[2]);
    const 日 = Number(m[3]);
    if (!isValidYmd(年, 月, 日)) continue;
    const result: OpeningGregorianDateOverride = { 年, 月, 日 };
    if (m[4] != null && m[5] != null) {
      const 时 = Number(m[4]);
      const 分 = Number(m[5]);
      if (isValidHm(时, 分)) {
        result.时 = 时;
        result.分 = 分;
      }
    }
    hits.push({ index: m.index, result });
  }

  if (hits.length === 0) return null;
  hits.sort((a, b) => a.index - b.index);
  return hits[0].result;
}

/** 从开局表单解析公历日期；无有效日期时返回 null */
export function parseGregorianYmdFromOpeningForm(formData: OpeningFormData): OpeningGregorianDateOverride | null {
  return parseGregorianYmdFromText(collectOpeningDateSearchText(formData));
}
