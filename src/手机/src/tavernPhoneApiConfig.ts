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
  /** 是否在 system 中注入主剧情节选与档案剧情摘要（阶段 B） */
  injectMainStory: boolean;
  /** 是否在每轮微信后生成摘要并写入酒馆聊天变量（需壳脚本，阶段 C） */
  phoneMemoryWrite: boolean;
}

export const defaultTavernPhoneApiConfig: TavernPhoneApiConfig = {
  apiBaseUrl: '',
  apiKey: '',
  model: '',
  maxRetries: 3,
  injectMainStory: true,
  phoneMemoryWrite: false,
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

/**
 * 父窗口（小手机壳）下发的默认 API URL / 模型：仅当本地对应项为空时写入 localStorage，
 * 不覆盖用户已在设置中填写的内容；不下发 API Key。
 */
export function applyOpenAiDefaultsFromParent(defaults: { apiBaseUrl?: string | null; model?: string | null } | undefined): void {
  if (!defaults) {
    return;
  }
  const cfg = loadTavernPhoneApiConfig();
  let changed = false;
  const next = { ...cfg };
  if (!cfg.apiBaseUrl.trim() && typeof defaults.apiBaseUrl === 'string' && defaults.apiBaseUrl.trim()) {
    next.apiBaseUrl = defaults.apiBaseUrl.trim();
    changed = true;
  }
  if (!cfg.model.trim() && typeof defaults.model === 'string' && defaults.model.trim()) {
    next.model = defaults.model.trim();
    changed = true;
  }
  if (changed) {
    saveTavernPhoneApiConfig(next);
    try {
      window.dispatchEvent(new CustomEvent('tavern-phone-api-config-changed'));
    } catch {
      /* */
    }
  }
}
