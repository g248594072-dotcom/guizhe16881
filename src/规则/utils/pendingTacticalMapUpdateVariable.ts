/**
 * @deprecated 逻辑已迁至 {@link pendingUpdateVariableQueue}；保留同名导出供战术地图等旧 import。
 */

export {
  appendPendingUpdateVariablePatches as appendPendingTacticalMapPatches,
  takePendingUpdateVariableBlock as takePendingTacticalMapUpdateVariableBlock,
  clearPendingUpdateVariablePatches as clearPendingTacticalMapUpdateVariable,
  getPendingUpdateVariablePatchCount as getPendingTacticalMapPatchOpCount,
} from './pendingUpdateVariableQueue';
