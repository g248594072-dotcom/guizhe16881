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
  /** 是否使用酒馆插头的API配置（地址和模型） */
  useTavernApiSettings: boolean;
  /** 是否启用 3 层破限提示词 */
  enableNsfw: boolean;
}

/**
 * 实际使用的 API 配置（可能来自酒馆或本地）
 */
export interface ResolvedTavernPhoneApiConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  maxRetries: number;
  injectMainStory: boolean;
  phoneMemoryWrite: boolean;
  enableNsfw: boolean;
  /** 配置来源：'tavern' | 'local' */
  source: 'tavern' | 'local';
}

export const defaultTavernPhoneApiConfig: TavernPhoneApiConfig = {
  apiBaseUrl: '',
  apiKey: '',
  model: '',
  maxRetries: 3,
  injectMainStory: true,
  phoneMemoryWrite: false,
  useTavernApiSettings: false,
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
      useTavernApiSettings:
        typeof parsed.useTavernApiSettings === 'boolean' ? parsed.useTavernApiSettings : defaultTavernPhoneApiConfig.useTavernApiSettings,
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

/** 缓存酒馆API配置（从父窗口获取） */
let cachedTavernApiConfig: { apiBaseUrl: string; apiKey: string; model: string } | null = null;

/**
 * 从酒馆获取API配置（通过 SillyTavern 或 postMessage）
 * 需要在连接酒馆后调用以缓存配置
 */
export function setTavernApiConfig(config: { apiBaseUrl: string; apiKey: string; model: string }): void {
  cachedTavernApiConfig = config;
}

/** 供其它模块同步读取当前配置（只读快照）
 * 如果 useTavernApiSettings 为 true，则使用酒馆配置；否则使用本地配置
 */
export function getTavernPhoneApiConfig(): ResolvedTavernPhoneApiConfig {
  const local = loadTavernPhoneApiConfig();
  if (local.useTavernApiSettings && cachedTavernApiConfig) {
    return {
      ...cachedTavernApiConfig,
      maxRetries: local.maxRetries,
      injectMainStory: local.injectMainStory,
      phoneMemoryWrite: local.phoneMemoryWrite,
      enableNsfw: local.enableNsfw,
      source: 'tavern',
    };
  }
  return {
    apiBaseUrl: local.apiBaseUrl,
    apiKey: local.apiKey,
    model: local.model,
    maxRetries: local.maxRetries,
    injectMainStory: local.injectMainStory,
    phoneMemoryWrite: local.phoneMemoryWrite,
    enableNsfw: local.enableNsfw,
    source: 'local',
  };
}

/**
 * 父窗口（小手机壳）下发的默认 API URL / 模型：仅当本地对应项为空时写入 localStorage，
 * 不覆盖用户已在设置中填写的内容；不下发 API Key。
 * 同时缓存酒馆配置供后续使用。
 */
export function applyOpenAiDefaultsFromParent(defaults: { apiBaseUrl?: string | null; model?: string | null; apiKey?: string | null } | undefined): void {
  if (!defaults) {
    return;
  }
  // 缓存酒馆配置
  const tavernConfig: { apiBaseUrl: string; apiKey: string; model: string } = {
    apiBaseUrl: typeof defaults.apiBaseUrl === 'string' ? defaults.apiBaseUrl.trim() : '',
    apiKey: typeof defaults.apiKey === 'string' ? defaults.apiKey.trim() : '',
    model: typeof defaults.model === 'string' ? defaults.model.trim() : '',
  };
  setTavernApiConfig(tavernConfig);

  // 只有当本地配置中启用了"使用酒馆配置"时才更新本地配置
  const cfg = loadTavernPhoneApiConfig();
  if (!cfg.useTavernApiSettings) {
    return; // 用户未开启此功能，不自动填充
  }

  let changed = false;
  const next = { ...cfg };
  if (!cfg.apiBaseUrl.trim() && tavernConfig.apiBaseUrl) {
    next.apiBaseUrl = tavernConfig.apiBaseUrl;
    changed = true;
  }
  if (!cfg.model.trim() && tavernConfig.model) {
    next.model = tavernConfig.model;
    changed = true;
  }
  // 注意：不下发 API Key 到 localStorage
  if (changed) {
    saveTavernPhoneApiConfig(next);
    try {
      window.dispatchEvent(new CustomEvent('tavern-phone-api-config-changed'));
    } catch {
      /* */
    }
  }
}
