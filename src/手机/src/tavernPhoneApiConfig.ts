/**
 * 小手机全局 API 配置（OpenAI 兼容）。持久化在 localStorage，供各功能模块读取。
 */
export const TAVERN_PHONE_API_STORAGE_KEY = 'tavern-phone:openai-api-config';

export interface TavernPhoneApiConfig {
  /** 含 /v1 的 Base URL，如 https://api.openai.com/v1 */
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  /** 0–10 */
  maxRetries: number;
}

export const defaultTavernPhoneApiConfig: TavernPhoneApiConfig = {
  apiBaseUrl: '',
  apiKey: '',
  model: '',
  maxRetries: 3,
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
    };
  } catch {
    return { ...defaultTavernPhoneApiConfig };
  }
}

export function saveTavernPhoneApiConfig(cfg: TavernPhoneApiConfig): void {
  localStorage.setItem(TAVERN_PHONE_API_STORAGE_KEY, JSON.stringify(cfg));
}

/** 供其它模块同步读取当前配置（只读快照） */
export function getTavernPhoneApiConfig(): TavernPhoneApiConfig {
  return loadTavernPhoneApiConfig();
}
