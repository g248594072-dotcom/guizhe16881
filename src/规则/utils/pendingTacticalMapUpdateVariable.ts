/**
 * 地图「确认应用」产生的 JSON Patch：暂存于此，在用户于规则界面发送下一条消息时并入 `user_input`。
 * 多次确认会把多段 Patch 合并为**一个** `<UpdateVariable><JSONPatch>...</JSONPatch></UpdateVariable>` 块。
 */

import {
  formatTacticalMapCommitForSendBox,
  type TacticalMapCommitPatchOp,
} from './tacticalMapCommitSendBox';

let mergedOps: TacticalMapCommitPatchOp[] = [];

/**
 * 追加一段 Patch（与已有项按时间顺序拼接，发送时格式化为单个块）。
 */
export function appendPendingTacticalMapPatches(patches: TacticalMapCommitPatchOp[]): void {
  if (!Array.isArray(patches) || patches.length === 0) return;
  mergedOps.push(...patches);
}

/** 当前队列中 Patch 条数（仅作 UI 提示等） */
export function getPendingTacticalMapPatchOpCount(): number {
  return mergedOps.length;
}

/** 清空队列（例如用户放弃发送时；一般不需要） */
export function clearPendingTacticalMapUpdateVariable(): void {
  mergedOps = [];
}

/**
 * 取出并清空：格式化为单个 UpdateVariable 块；若无内容返回空字符串。
 */
export function takePendingTacticalMapUpdateVariableBlock(): string {
  if (mergedOps.length === 0) return '';
  const block = formatTacticalMapCommitForSendBox(mergedOps);
  mergedOps = [];
  return block;
}
