/**
 * 将 MVU `stat_data` 根级快照 diff 为 JSON Patch 并入待发队列，供本界面发送时拼入 `<UpdateVariable>`。
 * 调用方须在变更前传入 `klona(useDataStore().data)`。
 */

import { klona } from 'klona';
import { useDataStore } from '../store';
import { diffValueToJsonPatches } from './tacticalMapCommitSendBox';
import { appendPendingUpdateVariablePatches } from './pendingUpdateVariableQueue';

export function queuePendingPatchesFromBeforeSnapshot(beforeStatData: unknown): void {
  const after = klona(useDataStore().data);
  const patches = diffValueToJsonPatches('', beforeStatData, after);
  if (patches.length > 0) {
    appendPendingUpdateVariablePatches(patches);
  }
}
