/**
 * 地图「确认应用」：生成与 App.vue 中 extractJsonPatchFromUpdateVariable 兼容的发送框文本。
 * Patch 为增量：仅 add / remove / replace 实际变化路径，不整表 replace `/建筑数据` 等顶层对象。
 */

import { isEqual } from 'lodash';
import { klona } from 'klona';
import type { Schema } from '../schema';

export type TacticalMvuMapRecordsSnapshot = {
  区域数据: Schema['区域数据'];
  建筑数据: Schema['建筑数据'];
  活动数据: Schema['活动数据'];
};

export type TacticalMapCommitPatchOp = {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
};

/** RFC 6901：路径段内的 ~ 与 / 须转义 */
function encodePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function joinPointer(basePath: string, rawKey: string): string {
  return `${basePath}/${encodePointerToken(rawKey)}`;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 对两个 JSON 值做结构化差分，生成相对 basePath 的 Patch（path 以 / 开头，相对 stat_data 根）。
 * - 对象对对象：按 key 并集递归；仅新 key → add；仅旧 key → remove；共有 key 继续比
 * - 数组或非对象：整体有变则一条 replace（避免数组项错位误 diff）
 */
export function diffValueToJsonPatches(basePath: string, before: unknown, after: unknown): TacticalMapCommitPatchOp[] {
  if (isEqual(before, after)) return [];

  if (!isPlainRecord(before) || !isPlainRecord(after)) {
    return [{ op: 'replace', path: basePath, value: klona(after) }];
  }

  const patches: TacticalMapCommitPatchOp[] = [];
  const keysB = new Set(Object.keys(before));
  const keysA = new Set(Object.keys(after));

  for (const k of keysA) {
    if (!keysB.has(k)) {
      patches.push({ op: 'add', path: joinPointer(basePath, k), value: klona((after as Record<string, unknown>)[k]) });
    }
  }
  for (const k of keysB) {
    if (!keysA.has(k)) {
      patches.push({ op: 'remove', path: joinPointer(basePath, k) });
    }
  }
  for (const k of keysA) {
    if (!keysB.has(k)) continue;
    const bv = (before as Record<string, unknown>)[k];
    const av = (after as Record<string, unknown>)[k];
    patches.push(...diffValueToJsonPatches(joinPointer(basePath, k), bv, av));
  }
  return patches;
}

export function buildTacticalMapJsonPatchesForMvuCommit(
  before: TacticalMvuMapRecordsSnapshot,
  after: TacticalMvuMapRecordsSnapshot,
): TacticalMapCommitPatchOp[] {
  return [
    ...diffValueToJsonPatches('/区域数据', before.区域数据 ?? {}, after.区域数据 ?? {}),
    ...diffValueToJsonPatches('/建筑数据', before.建筑数据 ?? {}, after.建筑数据 ?? {}),
    ...diffValueToJsonPatches('/活动数据', before.活动数据 ?? {}, after.活动数据 ?? {}),
  ];
}

export function formatTacticalMapCommitForSendBox(patches: TacticalMapCommitPatchOp[]): string {
  if (patches.length === 0) return '';
  const inner = JSON.stringify(patches, null, 2);
  return `<UpdateVariable>\n<JSONPatch>\n${inner}\n</JSONPatch>\n</UpdateVariable>`;
}

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 单条 `<UpdateVariable>`：可选 `<PlayerStagingSummary>` + `<JSONPatch>`（path 仍相对 stat_data）。
 * 无摘要且 patches 非空时与 `formatTacticalMapCommitForSendBox` 等价。
 */
export function formatMergedUpdateVariableBlock(opts: {
  summary?: string;
  patches: TacticalMapCommitPatchOp[];
}): string {
  const summary = opts.summary?.trim();
  const patches = opts.patches ?? [];
  if (!summary && patches.length === 0) return '';
  if (!summary) {
    return formatTacticalMapCommitForSendBox(patches);
  }
  const patchInner = JSON.stringify(patches, null, 2);
  return `<UpdateVariable>\n<PlayerStagingSummary>${escapeXmlText(summary)}</PlayerStagingSummary>\n<JSONPatch>\n${patchInner}\n</JSONPatch>\n</UpdateVariable>`;
}
