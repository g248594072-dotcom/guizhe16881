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
  /** 开启后每次直连 chat/completions 完成会弹窗展示请求与响应（含角色分析等所有经此 API 的生成） */
  debugAiTraffic: boolean;
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
  debugAiTraffic: boolean;
}

export const defaultTavernPhoneApiConfig: TavernPhoneApiConfig = {
  apiBaseUrl: '',
  apiKey: '',
  model: '',
  maxRetries: 3,
  injectMainStory: true,
  phoneMemoryWrite: false,
  enableNsfw: false,
  debugAiTraffic: false,
};

export function loadTavernPhoneApiConfig(): TavernPhoneApiConfig {
  try {
    const raw = localStorage.getItem(TAVERN_PHONE_API_STORAGE_KEY);
    if (!raw) {
      return { ...defaultTavernPhoneApiConfig };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mr = Number(parsed.maxRetries);
    return {
      apiBaseUrl: typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl : defaultTavernPhoneApiConfig.apiBaseUrl,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : defaultTavernPhoneApiConfig.apiKey,
      model: typeof parsed.model === 'string' ? parsed.model : defaultTavernPhoneApiConfig.model,
      maxRetries: Number.isFinite(mr) ? Math.max(0, Math.min(10, Math.floor(mr))) : defaultTavernPhoneApiConfig.maxRetries,
      injectMainStory:
        typeof parsed.injectMainStory === 'boolean' ? parsed.injectMainStory : defaultTavernPhoneApiConfig.injectMainStory,
      phoneMemoryWrite:
        typeof parsed.phoneMemoryWrite === 'boolean' ? parsed.phoneMemoryWrite : defaultTavernPhoneApiConfig.phoneMemoryWrite,
      enableNsfw:
        typeof parsed.enableNsfw === 'boolean' ? parsed.enableNsfw : defaultTavernPhoneApiConfig.enableNsfw,
      debugAiTraffic:
        typeof parsed.debugAiTraffic === 'boolean'
          ? parsed.debugAiTraffic
          : defaultTavernPhoneApiConfig.debugAiTraffic,
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

/** 是否已填写 URL、Key 与模型（各功能生成前可据此判断） */
export function isPhoneOpenAiConfigured(): boolean {
  const c = loadTavernPhoneApiConfig();
  return Boolean(String(c.apiBaseUrl).trim() && String(c.apiKey).trim() && String(c.model).trim());
}
