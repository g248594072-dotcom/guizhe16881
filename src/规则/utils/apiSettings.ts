/**
 * API设置管理工具
 * 管理输出模式设置、世界书条目切换、双API流程处理
 */

import type { OutputMode, SecondaryApiConfig, WorldbookEntry } from '../types';
import { getCharBoundWorldbookName } from './charBoundWorldbookName';
import { loadOutputMode, loadSecondaryApiConfig } from './localSettings';
import { normalizeOpenAiUrl, type NormalizedOpenAiUrl } from './openaiUrl';
import { DEFAULT_SECONDARY_API_CONFIG } from './secondaryApiDefaults';
import { getMergedSensitiveDevelopment } from './tagMap';
import { getTavernMainOpenAiEndpoint } from './tavernMainConnection';
import {
  formatPersonalRuleKeysSection,
  VARIABLE_JSON_PATCH_RUNTIME_RULES,
} from './variableUpdatePromptExtras';
import { processMaintextBeautification } from './maintextBeautify';
import { extractFilteredContent, parseMaintext, replaceLastMaintextInnerContent } from './messageParser';
import { mergeVariableUpdateJsonPatchInners } from './variablePatchMerge';
import { traceWrappedGenerateRaw } from './generationTrace';
import {
  extractLastUpdateVariableInner,
  mergeUpdateVariableInnerBodiesForPrompt,
  stripAllClosedUpdateVariableBlocks,
} from './updateVariableExtract';

export { DEFAULT_SECONDARY_API_CONFIG };

/** 失败后的最大重试次数（0–10） */
export function clampSecondaryApiRetries(n: unknown): number {
  const x = Math.floor(Number(n));
  if (Number.isNaN(x)) return 2;
  return Math.min(10, Math.max(0, x));
}

// 类型声明
declare function waitGlobalInitialized<T>(global: 'Mvu' | string): Promise<T>;
declare function getChatMessages(
  range: string | number,
  opts?: { role?: 'all' | 'system' | 'assistant' | 'user'; hide_state?: 'all' | 'hidden' | 'unhidden' },
): { message_id: number; role: string; message: string }[];
declare const Mvu: {
  getMvuData: (options: { type: 'message' | 'chat' | 'character' | 'global'; message_id?: number | 'latest' }) => {
    stat_data: Record<string, any>;
    display_data?: Record<string, any>;
    delta_data?: Record<string, any>;
  };
};

// 世界书条目名称常量
const WORLDBOOK_ENTRIES = {
  // 单API模式条目
  variableUpdateRule: '变量更新规则',
  variableList: '变量列表',
  variableOutputFormat: '变量输出格式',
  singleApiMainFormat: '单API正文格式',
  // 双API模式条目
  dualApiMainFormat: '多API正文格式',
} as const;

/** 变量相关世界书：优先按条目标题前缀识别（与 MVU 脚本命名一致） */
export const MVU_WORLDBOOK_ENTRY_PREFIXES = ['[mvu_update]', '[mvu]'] as const;

/**
 * 是否为 MVU 前缀的变量世界书条目（第二 API 优先聚合此类条目）
 */
export function isMvUVariableWorldbookEntryName(entryName: string): boolean {
  const n = String(entryName || '').trim();
  return MVU_WORLDBOOK_ENTRY_PREFIXES.some(p => n.startsWith(p));
}

/**
 * 切换单/双 API 时由 {@link updateWorldbookEntriesByMode} 同步开关的「变量相关」条目标题。
 * 仅 `[mvu_update]`、`[mvu]`；**不含** `[initvar]`（由用户自行开关，不参与模式同步）。
 * 须先判 `[mvu_update]` 再判 `[mvu]`，避免 `'[mvu_update]'.startsWith('[mvu]')` 误判。
 */
export function isModeSyncVariableRelatedEntryName(entryName: string): boolean {
  const n = String(entryName || '').trim();
  if (n.startsWith('[mvu_update]')) return true;
  if (n.startsWith('[mvu]')) return true;
  return false;
}

function matchesLegacySingleApiVariableEntryName(entryName: string): boolean {
  return (
    entryName.includes(WORLDBOOK_ENTRIES.variableUpdateRule) ||
    entryName.includes(WORLDBOOK_ENTRIES.variableList) ||
    entryName.includes(WORLDBOOK_ENTRIES.variableOutputFormat) ||
    entryName.includes(WORLDBOOK_ENTRIES.singleApiMainFormat)
  );
}

function joinWorldbookEntryBlocks(entries: WorldbookEntry[]): string {
  return entries
    .map(e => `## ${(e.name || '').trim()}\n${(e.content || '').trim()}`)
    .filter(block => block.replace(/^##\s[^\n]*\n/, '').trim().length > 0)
    .join('\n\n---\n\n');
}

/** 当前角色卡绑定世界书中，所有以 [mvu] / [mvu_update] 开头的条目全文（变量工作时注入，避免仅按标题分流时漏段） */
export function joinAllMvUPrefixedEntryBlocks(entries: WorldbookEntry[]): string {
  const list = entries.filter(e => isMvUVariableWorldbookEntryName(e.name || ''));
  if (list.length === 0) return '';
  return list
    .map(e => `### ${(e.name || '').trim()}\n${String(e.content || '').trim()}`)
    .filter(block => block.replace(/^###\s[^\n]*\n/, '').trim().length > 0)
    .join('\n\n---\n\n');
}

/**
 * 从世界书条目解析「变量更新规则 / 变量列表 / 变量输出格式」三段内容。
 * - 若存在任一条目标题以 `[mvu_update]` 或 `[mvu]` 开头：只聚合这些条目（按名称含「输出格式」「变量列表」分流，其余进更新规则）。
 * - 否则回退为按名称子串匹配单条条目（与旧行为兼容）。
 */
export function collectVariableWorldbookContentsFromEntries(entries: WorldbookEntry[]): {
  variableUpdateRule: string;
  variableList: string;
  variableOutputFormat: string;
} {
  const mvu = entries.filter(e => isMvUVariableWorldbookEntryName(e.name || ''));
  if (mvu.length > 0) {
    const formatEntries: WorldbookEntry[] = [];
    const listEntries: WorldbookEntry[] = [];
    const ruleEntries: WorldbookEntry[] = [];
    for (const e of mvu) {
      const n = e.name || '';
      if (n.includes('输出格式')) {
        formatEntries.push(e);
      } else if (n.includes('变量列表')) {
        listEntries.push(e);
      } else {
        ruleEntries.push(e);
      }
    }
    return {
      variableUpdateRule: joinWorldbookEntryBlocks(ruleEntries).trim(),
      variableList: joinWorldbookEntryBlocks(listEntries).trim(),
      variableOutputFormat: joinWorldbookEntryBlocks(formatEntries).trim(),
    };
  }

  const findByIncludes = (sub: string) => entries.find(e => (e.name || '').includes(sub));
  return {
    variableUpdateRule: (findByIncludes(WORLDBOOK_ENTRIES.variableUpdateRule)?.content || '').trim(),
    variableList: (findByIncludes(WORLDBOOK_ENTRIES.variableList)?.content || '').trim(),
    variableOutputFormat: (findByIncludes(WORLDBOOK_ENTRIES.variableOutputFormat)?.content || '').trim(),
  };
}

/**
 * 根据输出模式更新世界书条目启用状态。
 * 单 API：启用 `[mvu]` / `[mvu_update]` 及旧标题子串的变量规则；关闭「多API正文格式」。`[initvar]` 不改动。
 * 双 API：关闭上述同步条目；启用「多API正文格式」。`[initvar]` 不改动。第二 API 仍可通过 `getWorldbook` 读取已禁用条目的正文。
 * @param mode 输出模式
 * @returns 是否成功
 */
export async function updateWorldbookEntriesByMode(mode: OutputMode): Promise<boolean> {
  try {
    const worldbookName = getCurrentCharWorldbookName();
    if (!worldbookName) {
      console.warn('⚠️ [apiSettings] 无法获取当前角色卡绑定的世界书');
      return false;
    }

    console.log(`🔄 [apiSettings] 更新世界书条目，模式: ${mode}`);

    // 获取当前世界书条目
    const entries: WorldbookEntry[] = await getWorldbook(worldbookName);

    if (!entries || entries.length === 0) {
      console.warn('⚠️ [apiSettings] 世界书条目为空');
      return false;
    }

    const shouldEnableForSingleApi = (entryName: string) =>
      isModeSyncVariableRelatedEntryName(entryName) || matchesLegacySingleApiVariableEntryName(entryName);

    // 根据模式更新条目启用状态
    const updatedEntries = entries.map(entry => {
      const entryName = entry.name || '';

      if (mode === 'dual') {
        // 双API：启用「多API正文格式」；关闭 mvu 前缀及旧标题的变量规则（[initvar] 不碰；第二 API 仍可读禁用条目 content）
        if (entryName.includes(WORLDBOOK_ENTRIES.dualApiMainFormat)) {
          return { ...entry, enabled: true };
        }
        if (shouldEnableForSingleApi(entryName)) {
          return { ...entry, enabled: false };
        }
      } else {
        // 单API：先关「多API正文格式」，再打开 mvu 及旧标题变量条目（[initvar] 不碰）
        if (entryName.includes(WORLDBOOK_ENTRIES.dualApiMainFormat)) {
          return { ...entry, enabled: false };
        }
        if (shouldEnableForSingleApi(entryName)) {
          return { ...entry, enabled: true };
        }
      }

      return entry;
    });

    // 应用更新
    await replaceWorldbook(worldbookName, updatedEntries, { render: 'debounced' });

    console.log(`✅ [apiSettings] 世界书条目更新完成: ${mode} 模式`);
    return true;
  } catch (error) {
    console.error('❌ [apiSettings] 更新世界书条目失败:', error);
    return false;
  }
}

/**
 * 获取当前输出模式（从 localStorage）
 * @returns 输出模式
 */
export function getCurrentOutputMode(): OutputMode {
  try {
    return loadOutputMode();
  } catch (error) {
    console.warn('⚠️ [apiSettings] 获取输出模式失败，默认使用双API模式:', error);
    return 'dual';
  }
}

/**
 * 获取第二API配置（从 localStorage）
 * @returns 第二API配置
 */
export function getSecondaryApiConfig(): SecondaryApiConfig {
  try {
    return loadSecondaryApiConfig();
  } catch (error) {
    console.warn('⚠️ [apiSettings] 获取第二API配置失败:', error);
    return { ...DEFAULT_SECONDARY_API_CONFIG };
  }
}

/**
 * 保存第二API配置
 * @param config 配置对象
 * @returns 是否成功
 */
export async function saveSecondaryApiConfig(config: SecondaryApiConfig): Promise<boolean> {
  try {
    const { updateStatData } = await import('./dialogAndVariable');

    const normalized: SecondaryApiConfig = { ...config, splitSecondaryVariablePassAndExtras: false };
    updateStatData(stat => {
      if (!stat.player) {
        stat.player = { name: '玩家', settings: {} };
      }
      if (!stat.player.settings) {
        stat.player.settings = {};
      }
      stat.player.settings.secondaryApi = normalized;
      return stat;
    });

    console.log('✅ [apiSettings] 第二API配置已保存');
    return true;
  } catch (error) {
    console.error('❌ [apiSettings] 保存第二API配置失败:', error);
    return false;
  }
}

/** 第二 API 是否已配置（含「使用酒馆相同连接」） */
export function isSecondaryApiConfigured(config: SecondaryApiConfig | null | undefined): boolean {
  if (!config) return false;
  if (config.useTavernMainConnection === true) return true;
  return Boolean(String(config.url || '').trim());
}

/**
 * 双 API 模式主流程（发消息、第二路 generate 等）发送前：是否允许进入（不因「未读到凭据」拦死）。
 * - 勾选与主对话相同插头：视为第二路已配置，始终 true；若运行时尚无可用第二路，由实际调用抛错。
 * - 自定义第二 API：须有非空 Key，且 API 地址为合法 `http(s)` 并经 `normalizeOpenAiUrl` 校验通过。
 */
export function isSecondaryApiReadyForDualOperation(config: SecondaryApiConfig | null | undefined): boolean {
  if (!config) return false;
  if (config.useTavernMainConnection === true) {
    return true;
  }
  const key = String(config.key || '').trim();
  const url = String(config.url || '').trim();
  if (!key || !url) return false;
  try {
    normalizeOpenAiUrl(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 招募「AI 生成候选人」是否具备调用条件（与 `generateCompanionRecruitBlock` 直连 chat/completions 一致）。
 * - 仅当第二路为自定义 URL（未勾选与主对话相同插头）且非空 URL、Key、模型，且 URL 可经 normalizeOpenAiUrl 校验。勾选酒馆插头、第二路仅走主对话时不可用招募生成。
 */
export function isRecruitCompanionGenerateReady(): boolean {
  const config = getSecondaryApiConfig();
  if (config.useTavernMainConnection === true) {
    return false;
  }
  const key = String(config.key || '').trim();
  const url = String(config.url || '').trim();
  const model = String(config.model || '').trim();
  if (!key || !url || !model) return false;
  try {
    normalizeOpenAiUrl(url);
    return true;
  } catch {
    return false;
  }
}

const SECONDARY_SYSTEM_PROMPT =
  '你是一个专业的游戏变量更新助手。必须严格遵守用户消息中的变量更新规则、世界书中以 [mvu] / [mvu_update] 开头的条目全文，以及 JSON Patch 约定：path 相对 stat_data 根，仅使用 replace/add/remove/move，禁止使用 delta；路径与字段名须与当前变量 JSON 的 schema 一致。';

/** 第二 API：详规已在 [mvu]/[mvu_update] 世界书节内时，「变量输出格式」块仅用短示例，避免与上文重复 */
const SECONDARY_OUTPUT_FORMAT_SNIPPET = `[
  { "op": "replace", "path": "/示例路径", "value": "示例值" },
  { "op": "add", "path": "/示例数组/-", "value": {} }
]`;

const SECONDARY_STAT_JSON_MAX_CHARS = 14000;
const SECONDARY_WB_OUTPUT_FORMAT_MAX_CHARS = 4500;

/** 为第二 API 压缩 stat 快照：去掉开局大块与 UI 杂项，并限制总长 */
function shrinkStatDataForSecondaryPrompt(stat: Record<string, unknown>): string {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(JSON.stringify(stat)) as Record<string, unknown>;
  } catch {
    raw = { ...stat };
  }
  delete raw.openingConfig;
  if (raw.player && typeof raw.player === 'object' && !Array.isArray(raw.player)) {
    const p = { ...(raw.player as Record<string, unknown>) };
    if (p.settings && typeof p.settings === 'object' && !Array.isArray(p.settings)) {
      const s = { ...(p.settings as Record<string, unknown>) };
      delete s.other;
      p.settings = s;
    }
    raw.player = p;
  }
  let text = JSON.stringify(raw, null, 2);
  if (text.length > SECONDARY_STAT_JSON_MAX_CHARS) {
    text = `${text.slice(0, SECONDARY_STAT_JSON_MAX_CHARS)}\n…（stat JSON 已截断；path 仍相对 stat_data 根）`;
  }
  return text;
}

function pickSecondaryOutputFormatSnippet(
  worldbookFormat: string,
  hasMvuFullBlock: boolean,
): string {
  if (hasMvuFullBlock) {
    return SECONDARY_OUTPUT_FORMAT_SNIPPET;
  }
  const t = String(worldbookFormat || '').trim();
  if (!t) return SECONDARY_OUTPUT_FORMAT_SNIPPET;
  if (t.length <= SECONDARY_WB_OUTPUT_FORMAT_MAX_CHARS) return t;
  return `${t.slice(0, SECONDARY_WB_OUTPUT_FORMAT_MAX_CHARS)}\n…（世界书「变量输出格式」节录已截断）`;
}

/**
 * 自定义 OpenAI 兼容端点：第二路一律走 `generateRaw` + `custom_api`（短上下文，不附带完整预设/聊天记录）。
 */
async function callSecondaryGenerateRawCustom(
  userPrompt: string,
  config: SecondaryApiConfig,
  opts?: { includeSystem?: boolean; traceStepName?: string },
): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用');
  }
  if (!String(config.key || '').trim()) {
    throw new Error('第二 API Key 未配置');
  }
  const normalized = normalizeOpenAiUrl(config.url);
  const modelTrim = String(config.model || '').trim();
  const ordered: { role: 'system' | 'user'; content: string }[] = [];
  if (opts?.includeSystem !== false) {
    ordered.push({ role: 'system', content: SECONDARY_SYSTEM_PROMPT });
  }
  ordered.push({ role: 'user', content: userPrompt });
  const genConfig: Parameters<typeof generateRaw>[0] = {
    user_input: '',
    should_stream: false,
    should_silence: true,
    max_chat_history: 0,
    automatic_trigger: true, // 标记为自动触发，避免触发数据库剧情推进
    ordered_prompts: ordered,
    custom_api: {
      apiurl: normalized.base,
      key: config.key,
      source: 'openai',
    },
  };
  if (modelTrim) {
    genConfig.custom_api!.model = modelTrim;
  }
  const traceName =
    opts?.traceStepName ||
    (opts?.includeSystem === false
      ? '第二API·generateRaw（自定义URL·无系统预设）'
      : '第二API·JSON变量·generateRaw（自定义URL）');
  const result = await traceWrappedGenerateRaw(traceName, genConfig as unknown as Record<string, unknown>, () =>
    generateRaw(genConfig),
  );
  return String(result ?? '');
}

function stripTrailingUrlSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/** 解析 OpenAI 风格 `GET /v1/models` 的 JSON（`data[].id` 或少数网关的 `models[]`） */
function parseOpenAiModelsResponse(data: unknown): string[] {
  if (data == null || typeof data !== 'object') return [];
  const o = data as Record<string, unknown>;
  const pickIds = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    const ids: string[] = [];
    for (const x of arr) {
      if (typeof x === 'string' && x.trim()) ids.push(x.trim());
      else if (x && typeof x === 'object' && 'id' in x) {
        const id = String((x as { id?: unknown }).id ?? '').trim();
        if (id) ids.push(id);
      }
    }
    return ids;
  };
  const fromData = pickIds(o.data);
  if (fromData.length) return fromData;
  return pickIds(o.models);
}

/**
 * 与酒馆「自定义端点」对齐：优先带 `/v1` 的 apiBase，再试去掉 `/v1` 的 base，最后试用户原始输入（去尾斜杠）。
 */
function uniqueSecondaryGetModelListApiUrls(urlInput: string, normalized: NormalizedOpenAiUrl): string[] {
  const raw = stripTrailingUrlSlashes(urlInput.trim());
  const ordered = [normalized.apiBase, normalized.base, raw];
  const out: string[] = [];
  for (const u of ordered) {
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

async function trySecondaryGetModelList(
  apiurl: string,
  key: string | undefined,
): Promise<{ ok: true; models: string[] } | { ok: false; reason: string }> {
  try {
    const models = await getModelList({ apiurl, key });
    if (Array.isArray(models) && models.length > 0) {
      return { ok: true, models };
    }
    return {
      ok: false,
      reason: !Array.isArray(models) ? '返回非数组' : '列表为空（0 个模型）',
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** 在 iframe 内直连拉取模型列表（绕过部分环境下 `getModelList` 与酒馆主连接行为不一致的问题）；可能受 CORS 限制。 */
async function tryFetchOpenAiModelsDirect(
  urls: string[],
  key: string,
): Promise<{ ok: true; models: string[] } | { ok: false; reason: string }> {
  const keyTrim = String(key || '').trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (keyTrim) {
    headers.Authorization = `Bearer ${keyTrim}`;
  }
  let last = '';
  for (const url of urls) {
    if (!url) continue;
    try {
      const res = await fetch(url, { method: 'GET', headers });
      const text = await res.text();
      if (!res.ok) {
        last = `${url} → HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`;
        continue;
      }
      let data: unknown;
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        last = `${url} → 响应不是合法 JSON`;
        continue;
      }
      const ids = parseOpenAiModelsResponse(data);
      if (ids.length) {
        const uniq = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
        return { ok: true, models: uniq };
      }
      last = `${url} → JSON 中未解析到模型 id`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      last = `${url} → ${msg.includes('Failed to fetch') ? 'Failed to fetch（常见于 CORS 或网络）' : msg}`;
    }
  }
  return { ok: false, reason: last || '直连候选 URL 均失败' };
}

/**
 * 从当前配置拉取可用模型列表（OpenAI 兼容 `/v1/models`）。
 * 依次：`getModelList`（apiBase → base → 用户原始 URL），仍失败则对 `modelsUrlCandidates` 发起直连 GET 再解析 JSON。
 */
export async function fetchSecondaryApiModelList(config: SecondaryApiConfig): Promise<string[]> {
  if (typeof getModelList !== 'function') {
    throw new Error('getModelList 不可用');
  }
  if (config.useTavernMainConnection) {
    const ep = getTavernMainOpenAiEndpoint();
    if (!ep?.url) {
      throw new Error('无法读取酒馆当前聊天补全 URL（请检查连接或关闭「使用酒馆相同 API」并手动填写）');
    }
    return getModelList({ apiurl: ep.url });
  }
  if (!String(config.url || '').trim()) {
    throw new Error('请填写 API URL');
  }
  const normalized = normalizeOpenAiUrl(config.url);
  const key = config.key;
  const triedLines: string[] = [];

  for (const apiurl of uniqueSecondaryGetModelListApiUrls(config.url, normalized)) {
    const r = await trySecondaryGetModelList(apiurl, key);
    if (r.ok) {
      return r.models;
    }
    triedLines.push(`getModelList(${apiurl}): ${r.reason}`);
  }

  const directUrls = [...new Set(normalized.modelsUrlCandidates)];
  console.info('[fetchSecondaryApiModelList] getModelList 均未返回列表，尝试直连:', directUrls.join(', '));
  const direct = await tryFetchOpenAiModelsDirect(directUrls, key);
  if (direct.ok) {
    return direct.models;
  }
  triedLines.push(`直连: ${direct.reason}`);

  throw new Error(`获取模型列表失败：\n${triedLines.join('\n')}`);
}

/** 第二 API 即将发起网络请求时派发，供界面显示横幅（`App.vue` 监听） */
export const SECONDARY_API_START_EVENT = 'rule-modifier-secondary-api-start' as const;

/** 地图等短请求结束时派发，用于收起 `scope: tactical_map` 的顶栏提示（变量路仍由各流程自行 hide） */
export const SECONDARY_API_END_EVENT = 'rule-modifier-secondary-api-end' as const;

export type SecondaryApiStartDetail = {
  attempt?: number;
  /** 未传或 `variable_update`：沿用「变量更新」顶栏；`tactical_map`：地图专用文案，须配合 {@link notifySecondaryApiEnd} */
  scope?: 'variable_update' | 'tactical_map';
  /** `scope === 'tactical_map'` 时展示；缺省为通用地图提示 */
  message?: string;
};

export type SecondaryApiEndDetail = {
  scope?: 'tactical_map';
};

export function notifySecondaryApiStart(detail?: SecondaryApiStartDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SECONDARY_API_START_EVENT, { detail: detail ?? {} }));
}

export function notifySecondaryApiEnd(detail?: SecondaryApiEndDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SECONDARY_API_END_EVENT, { detail: detail ?? {} }));
}

/** 第二 API 读「当前变量」时使用的消息楼层（与主文所在回合一致，勿滥用 latest） */
export type ProcessWithSecondaryApiOptions = {
  statDataMessageId?: number | 'latest';
  /**
   * 本回合实际发给酒馆的 user 全文（含待发 `<UpdateVariable>`）。
   * 当 `getChatMessages` 取到的正文因酒馆正则/同步等原因不含块时，用此字符串再提取一次注入第二路提示。
   */
  fallbackUserRawText?: string;
};

/** 注入第二 API 提示时，玩家附加块的最大字符数（避免撑爆上下文） */
const MAX_PLAYER_STAGED_UV_PROMPT_CHARS = 24000;

/**
 * 本回合锚点对应的 **user 楼层正文全文**（未抠标签），供与 `fallbackUserRawText` 合并提取。
 * - 锚点为 **assistant** 楼层 id：从该 id 之前最近一条 user 取正文；
 * - 锚点为 **user** 楼层 id：使用该 user 正文；
 * - `latest`：以当前聊天最后一楼为准，若为 assistant 则再向前找 user。
 */
export function getUserRoundMessageBodyForStatAnchor(statDataMessageId: number | 'latest'): string {
  if (typeof getChatMessages !== 'function') return '';

  const findPreviousUserBody = (beforeExclusive: number): string => {
    for (let i = beforeExclusive - 1; i >= 0; i--) {
      const u = getChatMessages(i, { role: 'user' });
      if (u?.[0]) return String(u[0].message || '');
    }
    return '';
  };

  if (statDataMessageId === 'latest') {
    const last = getChatMessages(-1);
    const row = last?.[0];
    if (!row) return '';
    if (row.role === 'user') return String(row.message || '');
    return findPreviousUserBody(row.message_id);
  }

  const rows = getChatMessages(statDataMessageId);
  const row = rows?.[0];
  if (!row) return '';
  if (row.role === 'user') return String(row.message || '');
  return findPreviousUserBody(statDataMessageId);
}

/**
 * 从聊天正文与可选兜底字符串中合并提取所有闭合块的**标签内部**正文（去重；先聊天再兜底独有项）。
 * 开标签允许属性，与 `extractLastUpdateVariableInner` / `xmlTagExtract` 规则一致；不依赖整段 user 剧情进第二路。
 */
export function resolvePlayerStagedUpdateVariableBlocksForPromptWithFallback(
  statDataMessageId: number | 'latest',
  fallbackUserRawText?: string | null,
): string {
  const chatBody = getUserRoundMessageBodyForStatAnchor(statDataMessageId);
  return mergeUpdateVariableInnerBodiesForPrompt(
    chatBody,
    String(fallbackUserRawText ?? ''),
    MAX_PLAYER_STAGED_UV_PROMPT_CHARS,
  );
}

/**
 * 根据 `statDataMessageId` 解析「本回合相关的 user 楼层」上玩家附加的闭合 UpdateVariable 块（仅聊天正文，无兜底）。
 */
export function resolvePlayerStagedUpdateVariableBlocksForPrompt(statDataMessageId: number | 'latest'): string {
  const chatBody = getUserRoundMessageBodyForStatAnchor(statDataMessageId);
  return mergeUpdateVariableInnerBodiesForPrompt(chatBody, '', MAX_PLAYER_STAGED_UV_PROMPT_CHARS);
}

function formatPlayerStagedUpdateVariablePromptSection(joinedInnerBodies: string): string {
  const t = String(joinedInnerBodies || '').trim();
  if (!t) return '';
  return `## 玩家已在 user 消息中附加的变量（须保留）
请注意：**玩家**已通过发送内容修改或附加了变量。下列为相关 **user** 消息中**成对闭合**的 \`<UpdateVariable>…</UpdateVariable>\` **标签内部**原文（不含外层标签；多段之间以单独一行 \`---\` 分隔；按字面引用，勿改写 path/取值意图）：

${t}

**约束**：你本轮输出的 Patch **不得撤销、删改或与上述内容相冲突地覆盖**上述块中的 path 与取值意图；仅可在与它**兼容**的前提下追加本回合正文所需的增量。若与正文表面不一致，以**上述玩家附加内容为准**。

`;
}

/**
 * 在 {@link SecondaryApiConfig.splitSecondaryVariablePassAndExtras} 开启时，于「纯变量」轮之后执行：
 * 已勾选的「正文美化」「NPC生活」，Patch 类结果会合并为一段 `updateVariableFragment`。
 */
export async function processSecondaryApiExtraTasksPass(
  maintext: string,
  config: SecondaryApiConfig,
  options?: ProcessWithSecondaryApiOptions,
): Promise<{ updateVariableFragment: string | null; beautifiedMaintextInner: string | null }> {
  if (config.splitSecondaryVariablePassAndExtras !== true) {
    return { updateVariableFragment: null, beautifiedMaintextInner: null };
  }
  const hasBeautify = config.tasks?.includeMaintextBeautification === true;
  const hasWorldChanges = config.tasks?.includeWorldChanges === true;
  if (!hasBeautify && !hasWorldChanges) {
    return { updateVariableFragment: null, beautifiedMaintextInner: null };
  }

  const statMid = options?.statDataMessageId ?? 'latest';
  let currentVariables: Record<string, any> = {};
  try {
    await waitGlobalInitialized('Mvu');
    const mvuData = Mvu.getMvuData({ type: 'message', message_id: statMid });
    currentVariables = mvuData?.stat_data || {};
  } catch {
    /* noop */
  }

  let beautifiedMaintextInner: string | null = null;
  if (hasBeautify) {
    beautifiedMaintextInner = await processMaintextBeautification(maintext, config);
  }

  let patchAccum: string | null = null;
  let worldbookContents: SecondaryApiWorldbookContents;
  try {
    worldbookContents = await getWorldbookContentsForSecondaryApi();
  } catch {
    worldbookContents = {
      variableUpdateRule: '',
      variableList: '',
      variableOutputFormat: '',
      mvuPrefixedEntriesFull: '',
    };
  }

  if (hasWorldChanges) {
    const wc = await processWorldChangesSecondaryApi(
      maintext,
      config,
      currentVariables,
      worldbookContents,
      statMid,
      options?.fallbackUserRawText,
    );
    if (wc?.trim()) {
      patchAccum = patchAccum ? mergeVariableUpdateJsonPatchInners(patchAccum, wc.trim()) : wc.trim();
    }
  }

  return { updateVariableFragment: patchAccum, beautifiedMaintextInner };
}

async function processWorldChangesSecondaryApi(
  maintext: string,
  config: SecondaryApiConfig,
  currentVariables: Record<string, any>,
  worldbookContents: SecondaryApiWorldbookContents,
  statDataMessageId: number | 'latest',
  fallbackUserRawText?: string,
): Promise<string | null> {
  const retryCount = clampSecondaryApiRetries(config.maxRetries);
  const maxAttempts = 1 + retryCount;
  let lastError: Error | null = null;
  const prompt = buildWorldChangesExtrasPrompt(
    maintext,
    currentVariables,
    worldbookContents,
    statDataMessageId,
    fallbackUserRawText,
  );

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`🔄 [apiSettings] 第二API「NPC生活」附加轮 ${attempt + 1}/${maxAttempts}`);
      notifySecondaryApiStart({
        attempt: attempt + 1,
        scope: 'variable_update',
        message: '第二 API：NPC生活（游戏状态等）…',
      });
      const response = config.useTavernMainConnection
        ? await callSecondaryApiViaGenerateRaw(prompt, config, '第二API·NPC生活·generateRaw（酒馆插头）')
        : await callSecondaryGenerateRawCustom(prompt, config, {
            traceStepName: '第二API·NPC生活·generateRaw（自定义URL）',
          });
      const inner = extractUpdateVariable(response);
      if (inner?.trim()) return inner.trim();
      throw new Error('响应中未找到 <UpdateVariable> 标签');
    } catch (e) {
      lastError = e as Error;
      console.warn(`⚠️ [apiSettings] NPC生活附加轮失败 (${attempt + 1}):`, e);
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  console.warn('⚠️ [apiSettings] NPC生活附加轮放弃:', lastError?.message);
  return null;
}

function buildWorldChangesExtrasPrompt(
  maintext: string,
  currentVariables: Record<string, any>,
  worldbookContents: SecondaryApiWorldbookContents,
  statDataMessageId: number | 'latest',
  fallbackUserRawText?: string,
): string {
  const statSourceLabel =
    statDataMessageId === 'latest' ? 'latest（当前聊天最近一层消息的 stat_data）' : `消息楼层 #${statDataMessageId} 的 stat_data`;
  let gameStateJson: string;
  try {
    gameStateJson = JSON.stringify(currentVariables?.游戏状态 ?? {}, null, 2);
  } catch {
    gameStateJson = '{}';
  }
  if (gameStateJson.length > 14000) {
    gameStateJson = `${gameStateJson.slice(0, 14000)}\n…（已截断）`;
  }
  const mvuSection =
    (worldbookContents.mvuPrefixedEntriesFull || '').trim().length > 0
      ? `## 世界书 [mvu] / [mvu_update] 条目（与「世界大势 / 居民」描写相关处请遵守）\n${worldbookContents.mvuPrefixedEntriesFull.trim().slice(0, 6000)}\n\n`
      : '';

  const playerStagedSection = formatPlayerStagedUpdateVariablePromptSection(
    resolvePlayerStagedUpdateVariableBlocksForPromptWithFallback(statDataMessageId, fallbackUserRawText),
  );

  return `你是第二 API「NPC生活」专用助手，与上一轮「纯变量」Patch **分工不同**。

## 变量快照来源
以下上下文取自：**${statSourceLabel}**。

${playerStagedSection}${mvuSection}## 当前「游戏状态」JSON（**仅允许**对本对象下路径做 Patch；禁止 /角色档案、/区域数据、/建筑数据、/活动数据、/元信息、/世界规则、/个人规则、/区域规则 等）
\`\`\`json
${gameStateJson}
\`\`\`

${VARIABLE_JSON_PATCH_RUNTIME_RULES}

## 正文（据此更新世界大势、居民生活摘要、NPC 群体状态等「游戏状态」内已有或合理新增的键）
<maintext>
${maintext}
</maintext>

## 输出
只输出 **一段** \`<UpdateVariable>…</UpdateVariable>\`，内为 JSON Patch 数组；若无需改动可输出 \`<UpdateVariable>[]</UpdateVariable>\`。`;
}

/**
 * 主流程用：根据配置决定「并行变量+美化」或「变量 → 附加任务两轮」。
 */
export async function runSecondaryApiForMaintextPipeline(
  maintext: string,
  config: SecondaryApiConfig,
  variableOptions?: ProcessWithSecondaryApiOptions,
): Promise<{ variableUpdate: string; beautifiedInner: string | null }> {
  if (!isSecondaryApiConfigured(config)) {
    return { variableUpdate: '', beautifiedInner: null };
  }
  if (config.splitSecondaryVariablePassAndExtras === true) {
    const variableUpdate = await processWithSecondaryApi(maintext, config, variableOptions);
    const extras = await processSecondaryApiExtraTasksPass(maintext, config, variableOptions);
    let merged = variableUpdate;
    if (extras.updateVariableFragment?.trim()) {
      merged = mergeVariableUpdateJsonPatchInners(merged.trim(), extras.updateVariableFragment.trim());
    }
    return {
      variableUpdate: merged,
      beautifiedInner: extras.beautifiedMaintextInner,
    };
  }
  const wantBeautify = config.tasks?.includeMaintextBeautification === true;
  const [variableUpdate, beautifiedInner] = await Promise.all([
    processWithSecondaryApi(maintext, config, variableOptions),
    wantBeautify ? processMaintextBeautification(maintext, config) : Promise.resolve(null),
  ]);
  return { variableUpdate, beautifiedInner };
}

/**
 * 使用第二API处理变量更新
 * @param maintext 主API生成的正文内容
 * @param config 第二API配置
 * @param options.statDataMessageId 从该楼层的 MVU 取 stat_data；未传时默认 latest
 * @returns 生成的变量更新内容
 */
export async function processWithSecondaryApi(
  maintext: string,
  config: SecondaryApiConfig,
  options?: ProcessWithSecondaryApiOptions,
): Promise<string> {
  const retryCount = clampSecondaryApiRetries(config.maxRetries);
  const maxAttempts = 1 + retryCount;
  let lastError: Error | null = null;

  if (!config.useTavernMainConnection && !String(config.url || '').trim()) {
    throw new Error('第二 API URL 未配置');
  }
  if (!config.useTavernMainConnection && !String(config.key || '').trim()) {
    throw new Error('第二 API Key 未配置');
  }

  // 获取当前变量数据（默认 latest；调用方应传入本回合 user 楼或正在编辑的 assistant 楼等）
  let currentVariables: Record<string, any> = {};
  const statMid = options?.statDataMessageId ?? 'latest';
  try {
    await waitGlobalInitialized('Mvu');
    const mvuData = Mvu.getMvuData({ type: 'message', message_id: statMid });
    currentVariables = mvuData?.stat_data || {};
    console.log('✅ [apiSettings] 已获取当前变量数据', { statDataMessageId: statMid });
  } catch (error) {
    console.warn('⚠️ [apiSettings] 获取当前变量数据失败，使用空对象:', error);
  }

  // 获取世界书内容（变量相关条目）
  let worldbookContents: {
    variableUpdateRule: string;
    variableList: string;
    variableOutputFormat: string;
  };
  try {
    worldbookContents = await getWorldbookContentsForSecondaryApi();
    console.log('✅ [apiSettings] 已获取世界书变量相关内容');
  } catch (error) {
    console.warn('⚠️ [apiSettings] 获取世界书内容失败，使用默认值:', error);
    worldbookContents = {
      variableUpdateRule: '根据正文内容合理更新变量',
      variableList: '请参考当前变量数据中的字段',
      variableOutputFormat: `[
  { "op": "replace", "path": "/路径", "value": 值 },
  { "op": "add", "path": "/路径", "value": 值 }
]`,
      mvuPrefixedEntriesFull: '',
    };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`🔄 [apiSettings] 第二API调用尝试 ${attempt + 1}/${maxAttempts}`);

      // 构建完整提示词（包含变量数据+世界书内容+正文）
      const variablesOnly = config.splitSecondaryVariablePassAndExtras === true;
      const playerStagedSection = formatPlayerStagedUpdateVariablePromptSection(
        resolvePlayerStagedUpdateVariableBlocksForPromptWithFallback(statMid, options?.fallbackUserRawText),
      );
      const prompt = buildSecondaryApiPrompt(
        maintext,
        config.tasks,
        currentVariables,
        worldbookContents,
        statMid,
        variablesOnly,
        playerStagedSection,
      );

      notifySecondaryApiStart({ attempt: attempt + 1, scope: 'variable_update' });

      // 第二路一律 generateRaw：酒馆插头或自定义 URL+密钥+模型
      const response = config.useTavernMainConnection
        ? await callSecondaryApiViaGenerateRaw(prompt, config)
        : await callSecondaryGenerateRawCustom(prompt, config);

      // 解析响应
      const updateVariable = extractUpdateVariable(response);

      if (updateVariable) {
        console.log('✅ [apiSettings] 第二API返回有效变量更新');
        return updateVariable;
      }

      throw new Error('响应中未找到 <UpdateVariable> 标签');
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ [apiSettings] 第二API调用失败 (尝试 ${attempt + 1}):`, error);

      if (attempt < maxAttempts - 1) {
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  // 所有重试都失败了
  throw new Error(`第二API调用失败（${maxAttempts} 次尝试均失败）: ${lastError?.message}`);
}

/**
 * 获取世界书内容供第二API使用
 * 读取变量更新规则、变量列表、变量输出格式
 * @returns 世界书条目内容
 */
export type SecondaryApiWorldbookContents = {
  variableUpdateRule: string;
  variableList: string;
  variableOutputFormat: string;
  /** 所有 [mvu] / [mvu_update] 前缀条目的完整正文，与上面三段一并注入第二 API */
  mvuPrefixedEntriesFull: string;
};

async function getWorldbookContentsForSecondaryApi(): Promise<SecondaryApiWorldbookContents> {
  const worldbookName = getCurrentCharWorldbookName();

  // 获取世界书条目
  const entries: WorldbookEntry[] = await getWorldbook(worldbookName);

  if (!entries || entries.length === 0) {
    throw new Error('世界书条目为空');
  }

  // 优先聚合 [mvu] / [mvu_update] 前缀条目（即使被禁用也能读取 content）
  const split = collectVariableWorldbookContentsFromEntries(entries);
  const mvuPrefixedEntriesFull = joinAllMvUPrefixedEntryBlocks(entries);
  return { ...split, mvuPrefixedEntriesFull };
}

/**
 * 构建第二API提示词
 * @param maintext 主API生成的正文
 * @param tasks 任务配置
 * @param currentVariables 当前变量数据
 * @param worldbookContents 世界书条目内容
 * @param statDataMessageId 与 currentVariables 对应的楼层 id（仅用于说明）
 * @returns 完整提示词
 */
function buildSecondaryApiPrompt(
  maintext: string,
  tasks: SecondaryApiConfig['tasks'],
  currentVariables: Record<string, any>,
  worldbookContents: SecondaryApiWorldbookContents,
  statDataMessageId: number | 'latest',
  variablesOnly: boolean,
  playerStagedSection: string,
): string {
  // 构建任务说明（变量更新为第二 API 默认职责，始终说明）
  let tasksDescription =
    '- 根据正文内容和当前变量数据，按照变量更新规则输出 <UpdateVariable> 标签\n';
  if (!variablesOnly && tasks.includeWorldChanges) {
    tasksDescription +=
      '- 分析正文对 NPC 生活（世界大势与居民生活 / NPC 状态）的影响，更新相关数据（若规则或变量结构要求）\n';
  }

  const hasMvuFullBlock = (worldbookContents.mvuPrefixedEntriesFull || '').trim().length > 0;
  const variablesJson = shrinkStatDataForSecondaryPrompt(currentVariables as Record<string, unknown>);
  const outputFormat = pickSecondaryOutputFormatSnippet(
    worldbookContents.variableOutputFormat,
    hasMvuFullBlock,
  );

  // 分析现有角色的空缺字段
  const characterArchives = currentVariables?.角色档案 || {};
  const characterGaps: string[] = [];
  for (const [charId, charData] of Object.entries(characterArchives)) {
    const gaps: string[] = [];
    const c = charData as any;
    if (!c.性格 || Object.keys(c.性格).length === 0) gaps.push('性格（空对象，需填充）');
    if (!c.性癖 || Object.keys(c.性癖).length === 0) gaps.push('性癖（空对象，需填充）');
    if (Object.keys(getMergedSensitiveDevelopment(c)).length === 0) {
      gaps.push('敏感点开发（空对象，需填充；兼容旧键「敏感部位」）');
    }
    if (!c.隐藏性癖 || c.隐藏性癖 === '') gaps.push('隐藏性癖（空字符串，需填充）');
    if (!c.当前内心想法 || c.当前内心想法 === '') gaps.push('当前内心想法（空，需基于正文推断）');
    const loc = c.当前位置;
    const locBad =
      loc == null ||
      typeof loc !== 'object' ||
      Array.isArray(loc) ||
      (String((loc as Record<string, unknown>).区域ID ?? '').trim() === '' &&
        String((loc as Record<string, unknown>).建筑ID ?? '').trim() === '');
    if (locBad) {
      gaps.push('当前位置（须为对象且含区域ID、建筑ID；与区域数据/建筑数据 id 对齐；活动ID可空）');
    }
    if (!c.当前综合生理描述 || c.当前综合生理描述 === '') gaps.push('当前综合生理描述（空，需基于正文推断）');
    const pr = c.参与活动记录;
    if (pr != null && typeof pr === 'object' && !Array.isArray(pr)) {
      const badStringValue = Object.values(pr as Record<string, unknown>).some(v => typeof v === 'string');
      if (badStringValue) {
        gaps.push('参与活动记录（须为「活动ID→{开始时间,结束时间,参与程度}」对象，禁止用单条字符串代替对象）');
      }
    }
    if (gaps.length > 0) {
      characterGaps.push(`- ${c.姓名 || charId}: ${gaps.join('、')}`);
    }
  }

  const characterGapSection =
    characterGaps.length > 0
      ? `## ⚠️ 现有角色档案空缺检测\n以下角色存在空缺的字段，请**务必基于正文内容**进行推断和填充：\n${characterGaps.join('\n')}\n\n`
      : '';

  const variablesOnlyScopeSection = variablesOnly
    ? `## ⚠️ 本轮为「纯变量」路（与附加任务路分离）
- **禁止**在 Patch 中使用以下 path 前缀：\`/游戏状态\`、\`/区域数据\`、\`/建筑数据\`、\`/活动数据\`（世界大势、居民生活等综合说明与地图相关变更由下一轮第二 API 附加任务处理）。
- 仍须正常维护 \`/角色档案\`、\`/元信息\`、\`/世界规则\`、\`/区域规则\`、\`/个人规则\` 等与角色、规则、进度相关的路径；**当前位置** 等字段请使用**已有**区域/建筑 id，勿新建地图条目。

`
    : '';

  const statSourceLabel =
    statDataMessageId === 'latest' ? 'latest（当前聊天最近一层消息的 stat_data）' : `消息楼层 #${statDataMessageId} 的 stat_data`;

  const mvuFullSection = hasMvuFullBlock
    ? `## 世界书 [mvu] / [mvu_update] 全文\n（本节已含变量列表、更新规则与输出格式约定；**勿**与下文重复对照；若有冲突以本节全文为准）\n${worldbookContents.mvuPrefixedEntriesFull.trim()}\n\n`
    : '';

  const wlListSection =
    !hasMvuFullBlock && (worldbookContents.variableList || '').trim().length > 0
      ? `## 变量列表\n${(worldbookContents.variableList || '').trim()}\n\n`
      : '';
  const wlRuleSection =
    !hasMvuFullBlock && (worldbookContents.variableUpdateRule || '').trim().length > 0
      ? `## 变量更新规则\n${(worldbookContents.variableUpdateRule || '').trim()}\n\n`
      : '';

  return `## 当前变量数据（JSON）
\`\`\`json
${variablesJson}
\`\`\`

## 变量快照来源
以下 JSON 取自：**${statSourceLabel}**。请在此基础上输出 JSON Patch（path 相对 stat_data 根），与正文及世界书规则一致。

${playerStagedSection}${variablesOnlyScopeSection}${mvuFullSection}${formatPersonalRuleKeysSection(currentVariables)}${wlListSection}${wlRuleSection}${characterGapSection}${VARIABLE_JSON_PATCH_RUNTIME_RULES}
## Patch 输出形式（示例）
\`\`\`json
${outputFormat}
\`\`\`

## 正文
<maintext>
${maintext}
</maintext>

## 任务与输出约定
${tasksDescription}- **仅输出** \`<UpdateVariable>…</UpdateVariable>\`（内为 JSON Patch 数组或带 Analysis 的结构须与世界书要求一致）；不要复述正文。
- 补足上文「空缺检测」中的角色字段；按正文更新数值；新角色须建档；规则有变再改规则路径。
- **优先 replace**；性格/性癖/敏感点开发不得留空对象；隐藏性癖、当前内心想法不得留空串；op 仅 replace / add / remove / move。

**示例：**
<UpdateVariable>
[
  { "op": "replace", "path": "/元信息/进度", "value": 5 },
  { "op": "replace", "path": "/角色档案/CHR-001/数值/发情值", "value": 12 }
]
</UpdateVariable>`;
}

/**
 * 通过酒馆助手 `generateRaw` 调用当前聊天补全连接（与主对话同一「插头」）
 */
async function callSecondaryApiViaGenerateRaw(
  prompt: string,
  _config: SecondaryApiConfig,
  traceStepName = '第二API·JSON变量·generateRaw（酒馆插头）',
): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用，无法使用酒馆相同 API');
  }
  const genConfig: Parameters<typeof generateRaw>[0] = {
    user_input: '',
    should_stream: false,
    should_silence: true,
    max_chat_history: 0,
    automatic_trigger: true, // 标记为自动触发，避免触发数据库剧情推进
    ordered_prompts: [
      { role: 'system', content: SECONDARY_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  };
  // 不设置 custom_api.model：与主插头当前模型一致（第二 API「模型」栏仅在自定义 URL 时生效）
  const result = await traceWrappedGenerateRaw(traceStepName, genConfig as unknown as Record<string, unknown>, () =>
    generateRaw(genConfig),
  );
  return String(result ?? '');
}

/**
 * 与当前聊天同一插头的 `generateRaw`（主连接 / 第一 API），短上下文仅含 `ordered_prompts`。
 * 用于战术地图等在第二 API 未配置或失败时的回退（与 {@link generateSecondaryRawOrderedPrompts} 在 `useTavernMainConnection` 时的行为一致）。
 */
export async function generatePrimaryRawOrderedPrompts(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    maxTokens?: number;
    bannerMessage?: string;
    bannerAttempt?: number;
    skipBanner?: boolean;
  },
): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用');
  }
  const maxTokens = Math.min(65536, Math.max(256, Math.floor(Number(options?.maxTokens) || 4096)));
  const msg = options?.bannerMessage?.trim() || 'AI 正在使用主连接处理地图请求…';
  const skipBanner = options?.skipBanner === true;
  if (!skipBanner) {
    notifySecondaryApiStart({
      attempt: options?.bannerAttempt ?? 1,
      scope: 'tactical_map',
      message: msg,
    });
  }
  try {
    const genConfig: Parameters<typeof generateRaw>[0] = {
      user_input: '',
      should_stream: false,
      should_silence: true,
      max_chat_history: 0,
      automatic_trigger: true,
      ordered_prompts: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      custom_api: {
        max_tokens: maxTokens,
      },
    };
    return String(
      (await traceWrappedGenerateRaw(
        '主连接·generateRaw（战术地图等）',
        genConfig as unknown as Record<string, unknown>,
        () => generateRaw(genConfig),
      )) ?? '',
    );
  } finally {
    if (!skipBanner) {
      notifySecondaryApiEnd({ scope: 'tactical_map' });
    }
  }
}

/**
 * 短上下文第二 API：`ordered_prompts` 使用调用方自定义 system + user（地图等）。
 * 与变量更新路不同，不注入 {@link SECONDARY_SYSTEM_PROMPT}。
 */
export async function generateSecondaryRawOrderedPrompts(
  systemPrompt: string,
  userPrompt: string,
  config: SecondaryApiConfig,
  options?: {
    maxTokens?: number;
    bannerMessage?: string;
    bannerAttempt?: number;
    /** 为 true 时不派发顶栏第二 API 横幅（例如嵌套在变量更新流程内的子调用） */
    skipBanner?: boolean;
  },
): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用');
  }
  const maxTokens = Math.min(65536, Math.max(256, Math.floor(Number(options?.maxTokens) || 4096)));
  const msg = options?.bannerMessage?.trim() || 'AI 正在处理第二 API 请求…';
  const skipBanner = options?.skipBanner === true;
  if (!skipBanner) {
    notifySecondaryApiStart({
      attempt: options?.bannerAttempt ?? 1,
      scope: 'tactical_map',
      message: msg,
    });
  }
  try {
    if (config.useTavernMainConnection) {
      const genConfig: Parameters<typeof generateRaw>[0] = {
        user_input: '',
        should_stream: false,
        should_silence: true,
        max_chat_history: 0,
        automatic_trigger: true,
        ordered_prompts: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        custom_api: {
          max_tokens: maxTokens,
        },
      };
      return String(
        (await traceWrappedGenerateRaw(
          '第二API·generateRaw（酒馆插头·自定义 system/user）',
          genConfig as unknown as Record<string, unknown>,
          () => generateRaw(genConfig),
        )) ?? '',
      );
    }
    if (!String(config.key || '').trim()) {
      throw new Error('第二 API Key 未配置');
    }
    const normalized = normalizeOpenAiUrl(config.url);
    const modelTrim = String(config.model || '').trim();
    const genConfig: Parameters<typeof generateRaw>[0] = {
      user_input: '',
      should_stream: false,
      should_silence: true,
      max_chat_history: 0,
      automatic_trigger: true,
      ordered_prompts: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      custom_api: {
        apiurl: normalized.base,
        key: config.key,
        source: 'openai',
        max_tokens: maxTokens,
      },
    };
    if (modelTrim) {
      genConfig.custom_api!.model = modelTrim;
    }
    return String(
      (await traceWrappedGenerateRaw(
        '第二API·generateRaw（自定义URL·自定义 system/user）',
        genConfig as unknown as Record<string, unknown>,
        () => generateRaw(genConfig),
      )) ?? '',
    );
  } finally {
    if (!skipBanner) {
      notifySecondaryApiEnd({ scope: 'tactical_map' });
    }
  }
}

/**
 * 从响应中提取UpdateVariable标签内容
 * @param response API响应
 * @returns UpdateVariable标签内容，或null
 */
function extractUpdateVariable(response: string): string | null {
  const inner = extractLastUpdateVariableInner(String(response || '')).trim();
  return inner.length > 0 ? inner : null;
}

/**
 * 获取当前角色卡绑定的世界书名称
 * @returns 世界书名称
 */
export function getCurrentCharWorldbookName(): string {
  return getCharBoundWorldbookName();
}

// 导出常量供外部使用
export { WORLDBOOK_ENTRIES };

/**
 * 对单条 assistant 全文：按需并行第二路「变量 + 正文美化」，写回 maintext 内层并追加 UpdateVariable。
 * 变量与美化均基于**原始** parseMaintext 内层（美化前正文）。
 * 双 API 且第二路返回变量块时：先移除主模型（及重复）输出的所有变量块，再只追加第二路结果，避免错误 Patch 残留。
 */
export async function mergeSecondaryPipelineIntoAssistantText(
  assistantRaw: string,
  config: SecondaryApiConfig,
  variableOptions?: ProcessWithSecondaryApiOptions,
): Promise<string> {
  if (!assistantRaw || !isSecondaryApiConfigured(config)) {
    return assistantRaw;
  }
  const filtered = extractFilteredContent(assistantRaw);
  const maintext = parseMaintext(filtered);
  if (!maintext) {
    return assistantRaw;
  }

  const { variableUpdate, beautifiedInner } = await runSecondaryApiForMaintextPipeline(
    maintext,
    config,
    variableOptions,
  );

  let out = assistantRaw;

  if (beautifiedInner != null && String(beautifiedInner).trim().length > 0) {
    out = replaceLastMaintextInnerContent(out, String(beautifiedInner).trim());
  }

  const variableInner = variableUpdate != null ? String(variableUpdate).trim() : '';
  if (variableInner.length > 0) {
    out = stripAllClosedUpdateVariableBlocks(out);
    out = `${out.trim().replace(/\n{3,}/g, '\n\n')}\n\n<UpdateVariable>${variableInner}</UpdateVariable>`;
  }

  return out;
}
