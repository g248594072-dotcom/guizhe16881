/**
 * 第二 API 默认配置（独立文件，供 localSettings / apiSettings 共用，避免循环依赖）
 */
import type { SecondaryApiConfig } from '../types';

export const DEFAULT_SECONDARY_API_CONFIG: SecondaryApiConfig = {
  url: '',
  key: '',
  model: '',
  maxRetries: 2,
  useTavernMainConnection: true,
  /** 设置里暂锁为关，见 `SettingsPanel`「额外API执行额外任务（更新中）」 */
  splitSecondaryVariablePassAndExtras: false,
  maintextBeautifyHtmlcontentChance: 50,
  tasks: {
    includeMaintextBeautification: false,
    includeWorldChanges: false,
    includeWorldEvolution: false,
  },
};

/** 将旧版或部分字段 tasks 规范为当前 schema（变量更新始终为第二 API 默认行为，不再存开关） */
export function normalizeSecondaryApiTasks(raw: unknown): SecondaryApiConfig['tasks'] {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const legacyWorldEnabled = t.includeWorldTrend === true || t.includeResidentLife === true;
  const includeWorldChanges =
    typeof t.includeWorldChanges === 'boolean' ? t.includeWorldChanges : legacyWorldEnabled;
  return {
    includeMaintextBeautification:
      typeof t.includeMaintextBeautification === 'boolean'
        ? t.includeMaintextBeautification
        : DEFAULT_SECONDARY_API_CONFIG.tasks.includeMaintextBeautification,
    includeWorldChanges,
    includeWorldEvolution:
      typeof t.includeWorldEvolution === 'boolean'
        ? t.includeWorldEvolution
        : DEFAULT_SECONDARY_API_CONFIG.tasks.includeWorldEvolution,
  };
}
