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
  tasks: {
    includeVariableUpdate: true,
    includeWorldTrend: false,
    includeResidentLife: false,
  },
};
