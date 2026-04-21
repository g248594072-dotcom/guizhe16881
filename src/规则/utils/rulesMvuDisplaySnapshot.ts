import {
  extractMvuStatData,
  mergeMessageRefRecordsWithCharacterAndMaybeMessage0,
} from '@util/mvu';
import { sanitizeStatDataRoleArchivesNestedMaps } from './tagMap';

/**
 * 与 `useDataStore` 绑定的 message 选项一致：从酒馆现拉 `stat_data`，再做角色卡 / 第 0 层合并。
 * 供只读展示（如角色详情名称解析），以 `getVariables` 结果为准，避免与 Pinia 内快照短暂不一致。
 */
export function getRulesMergedStatSnapshotForDisplay(): Record<string, unknown> {
  const mid = getCurrentMessageId();
  const last = getLastMessageId();
  const live = mid === last;
  const resolvedOption = { type: 'message' as const, message_id: live ? -1 : mid };
  const variables = getVariables(resolvedOption);
  let statData = sanitizeStatDataRoleArchivesNestedMaps(extractMvuStatData(variables)) as Record<
    string,
    unknown
  >;
  statData = mergeMessageRefRecordsWithCharacterAndMaybeMessage0(statData, resolvedOption);
  return statData;
}
