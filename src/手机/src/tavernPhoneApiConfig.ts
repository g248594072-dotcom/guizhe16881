/**
 * 小手机全局 API 配置（OpenAI 兼容）。持久化在 localStorage，供各功能模块读取。
 */

/** 存储键名 */
export const TAVERN_PHONE_API_STORAGE_KEY = 'tavern-phone:openai-api-config';

/**
 * 小手机本地配置的 API 设置
 */
export interface TavernPhoneApiConfig {
  /** 含 /v1 的 Base URL，如 https://api.openai.com/v1 */
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  /** 0–10 */
  maxRetries: number;
  /** 是否在 system 中注入主剧情节选与档案剧情摘要（阶段 B） */
  injectMainStory: boolean;
  /** 是否在每轮微信后生成摘要并写入酒馆聊天变量（需壳脚本，阶段 C） */
  phoneMemoryWrite: boolean;
  /** 是否启用 3 层破限提示词 */
  enableNsfw: boolean;
}

/**
 * 实际使用的 API 配置
 */
export interface ResolvedTavernPhoneApiConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  maxRetries: number;
  injectMainStory: boolean;
  phoneMemoryWrite: boolean;
  enableNsfw: boolean;
}

export const defaultTavernPhoneApiConfig: TavernPhoneApiConfig = {
  apiBaseUrl: '',
  apiKey: '',
  model: '',
  maxRetries: 3,
  injectMainStory: true,
  phoneMemoryWrite: false,
  enableNsfw: false,
};

export function loadTavernPhoneApiConfig(): TavernPhoneApiConfig {
  try {
    const raw = localStorage.getItem(TAVERN_PHONE_API_STORAGE_KEY);
    if (!raw) {
      return { ...defaultTavernPhoneApiConfig };
    }
    const parsed = JSON.parse(raw) as Partial<TavernPhoneApiConfig>;
    const mr = Number(parsed.maxRetries);
    return {
      ...defaultTavernPhoneApiConfig,
      ...parsed,
      maxRetries: Number.isFinite(mr) ? Math.max(0, Math.min(10, Math.floor(mr))) : defaultTavernPhoneApiConfig.maxRetries,
      injectMainStory: typeof parsed.injectMainStory === 'boolean' ? parsed.injectMainStory : defaultTavernPhoneApiConfig.injectMainStory,
      phoneMemoryWrite:
        typeof parsed.phoneMemoryWrite === 'boolean' ? parsed.phoneMemoryWrite : defaultTavernPhoneApiConfig.phoneMemoryWrite,
      enableNsfw:
        typeof parsed.enableNsfw === 'boolean' ? parsed.enableNsfw : defaultTavernPhoneApiConfig.enableNsfw,
    };
  } catch {
    return { ...defaultTavernPhoneApiConfig };
  }
}

export function saveTavernPhoneApiConfig(cfg: TavernPhoneApiConfig): void {
  localStorage.setItem(TAVERN_PHONE_API_STORAGE_KEY, JSON.stringify(cfg));
}

/** 获取当前 API 配置 */
export function getTavernPhoneApiConfig(): ResolvedTavernPhoneApiConfig {
  return loadTavernPhoneApiConfig();
}
