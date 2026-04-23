/**
 * 待发 `<UpdateVariable>`：地图确认、购物车批量确认、购物车关闭时的单次编辑等共用。
 * 多次 append 的 JSON Patch 在 take 时合并为**一个** `<JSONPatch>` 数组；可选一条 `<PlayerStagingSummary>` 与补丁同处**唯一**闭合 `<UpdateVariable>` 内。
 */

import type { TacticalMapCommitPatchOp } from './tacticalMapCommitSendBox';
import { formatMergedUpdateVariableBlock } from './tacticalMapCommitSendBox';

let mergedOps: TacticalMapCommitPatchOp[] = [];
/** 下一次 `takePendingUpdateVariableBlock` 时并入同一条 `<UpdateVariable>`（「修改是否写入对话框」关闭时使用） */
let stagingSummaryForNextTake = '';

export function appendPendingUpdateVariablePatches(patches: TacticalMapCommitPatchOp[]): void {
  if (!Array.isArray(patches) || patches.length === 0) return;
  mergedOps.push(...patches);
}

export function setStagingSummaryForNextPendingUvBlock(text: string): void {
  stagingSummaryForNextTake = String(text ?? '').trim();
}

/** 与已有待发摘要拼接（用于「不写输入框」时多次编辑的说明累加）；空则等同 set */
export function appendStagingSummaryForNextPendingUvBlock(text: string): void {
  const t = String(text ?? '').trim();
  if (!t) return;
  const prev = stagingSummaryForNextTake.trim();
  stagingSummaryForNextTake = prev ? `${prev}\n\n${t}` : t;
}

export function getPendingUpdateVariablePatchCount(): number {
  return mergedOps.length;
}

/** 是否有待合并的 `<UpdateVariable>`（`take` 前调用，不消耗队列） */
export function hasPendingUpdateVariableToMerge(): boolean {
  if (mergedOps.length > 0) return true;
  return Boolean(stagingSummaryForNextTake.trim());
}

export function clearPendingUpdateVariablePatches(): void {
  mergedOps = [];
  stagingSummaryForNextTake = '';
}

/**
 * 取出并清空：至多一条完整 `<UpdateVariable>…</UpdateVariable>`；若无摘要且无 patch 则返回空字符串。
 */
export function takePendingUpdateVariableBlock(): string {
  const patches = mergedOps;
  mergedOps = [];
  const summary = stagingSummaryForNextTake;
  stagingSummaryForNextTake = '';
  return formatMergedUpdateVariableBlock({
    summary: summary || undefined,
    patches,
  });
}
