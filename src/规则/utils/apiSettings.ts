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
import { mergeVariableUpdateJsonPatchInners } from './worldEvolutionSecondaryApi';

export { DEFAULT_SECONDARY_API_CONFIG };

/** 失败后的最大重试次数（0–10） */
export function clampSecondaryApiRetries(n: unknown): number {
  const x = Math.floor(Number(n));
  if (Number.isNaN(x)) return 2;
  return Math.min(10, Math.max(0, x));
}

// 类型声明
declare function waitGlobalInitialized<T>(global: 'Mvu' | string): Promise<T>;
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
 * 根据输出模式更新世界书条目启用状态
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

    // 根据模式更新条目启用状态
    const updatedEntries = entries.map(entry => {
      const entryName = entry.name || '';

      if (mode === 'dual') {
        // 双API模式：关闭单API相关条目，启用双API格式条目
        // 不自动关闭 [mvu] / [mvu_update] 前缀条目（供 MVU / 第二 API 读取，由用户自行开关）
        if (
          !isMvUVariableWorldbookEntryName(entryName) &&
          (entryName.includes(WORLDBOOK_ENTRIES.variableUpdateRule) ||
            entryName.includes(WORLDBOOK_ENTRIES.variableList) ||
            entryName.includes(WORLDBOOK_ENTRIES.variableOutputFormat) ||
            entryName.includes(WORLDBOOK_ENTRIES.singleApiMainFormat))
        ) {
          return { ...entry, enabled: false };
        }
        if (entryName.includes(WORLDBOOK_ENTRIES.dualApiMainFormat)) {
          return { ...entry, enabled: true };
        }
      } else {
        // 单API模式：启用单API相关条目，关闭双API格式条目
        if (
          entryName.includes(WORLDBOOK_ENTRIES.variableUpdateRule) ||
          entryName.includes(WORLDBOOK_ENTRIES.variableList) ||
          entryName.includes(WORLDBOOK_ENTRIES.variableOutputFormat) ||
          entryName.includes(WORLDBOOK_ENTRIES.singleApiMainFormat)
        ) {
          return { ...entry, enabled: true };
        }
        if (entryName.includes(WORLDBOOK_ENTRIES.dualApiMainFormat)) {
          return { ...entry, enabled: false };
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

    updateStatData(stat => {
      if (!stat.player) {
        stat.player = { name: '玩家', settings: {} };
      }
      if (!stat.player.settings) {
        stat.player.settings = {};
      }
      stat.player.settings.secondaryApi = config;
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

const SECONDARY_SYSTEM_PROMPT =
  '你是一个专业的游戏变量更新助手。必须严格遵守用户消息中的变量更新规则、世界书中以 [mvu] / [mvu_update] 开头的条目全文，以及 JSON Patch 约定：path 相对 stat_data 根，仅使用 replace/add/remove/move，禁止使用 delta；路径与字段名须与当前变量 JSON 的 schema 一致。';

/**
 * 自定义 OpenAI 兼容端点：第二路一律走 `generateRaw` + `custom_api`（短上下文，不附带完整预设/聊天记录）。
 */
async function callSecondaryGenerateRawCustom(
  userPrompt: string,
  config: SecondaryApiConfig,
  opts?: { includeSystem?: boolean },
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
  const result = await generateRaw(genConfig);
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
};

/**
 * 在 {@link SecondaryApiConfig.splitSecondaryVariablePassAndExtras} 开启时，于「纯变量」轮之后执行：
 * 已勾选的「正文美化」「NPC生活」「世界演化」，Patch 类结果会合并为一段 `updateVariableFragment`。
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
  const hasWorldEvolution = config.tasks?.includeWorldEvolution === true;
  if (!hasBeautify && !hasWorldChanges && !hasWorldEvolution) {
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
    const wc = await processWorldChangesSecondaryApi(maintext, config, currentVariables, worldbookContents, statMid);
    if (wc?.trim()) {
      patchAccum = patchAccum ? mergeVariableUpdateJsonPatchInners(patchAccum, wc.trim()) : wc.trim();
    }
  }

  if (hasWorldEvolution) {
    try {
      const { runWorldEvolutionSecondaryApi } = await import('./worldEvolutionSecondaryApi');
      const evo = await runWorldEvolutionSecondaryApi(maintext, config, currentVariables);
      if (evo?.trim()) {
        patchAccum = patchAccum ? mergeVariableUpdateJsonPatchInners(patchAccum, evo.trim()) : evo.trim();
      }
    } catch (e) {
      console.warn('⚠️ [apiSettings] 附加任务路：世界演化失败:', e);
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
): Promise<string | null> {
  const retryCount = clampSecondaryApiRetries(config.maxRetries);
  const maxAttempts = 1 + retryCount;
  let lastError: Error | null = null;
  const prompt = buildWorldChangesExtrasPrompt(maintext, currentVariables, worldbookContents, statDataMessageId);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`🔄 [apiSettings] 第二API「NPC生活」附加轮 ${attempt + 1}/${maxAttempts}`);
      notifySecondaryApiStart({
        attempt: attempt + 1,
        scope: 'variable_update',
        message: '第二 API：NPC生活（游戏状态等）…',
      });
      const response = config.useTavernMainConnection
        ? await callSecondaryApiViaGenerateRaw(prompt, config)
        : await callSecondaryGenerateRawCustom(prompt, config);
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

  return `你是第二 API「NPC生活」专用助手，与上一轮「纯变量」Patch **分工不同**。

## 变量快照来源
以下上下文取自：**${statSourceLabel}**。

${mvuSection}## 当前「游戏状态」JSON（**仅允许**对本对象下路径做 Patch；禁止 /角色档案、/区域数据、/建筑数据、/活动数据、/元信息、/世界规则、/个人规则、/区域规则 等）
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
      const prompt = buildSecondaryApiPrompt(
        maintext,
        config.tasks,
        currentVariables,
        worldbookContents,
        statMid,
        variablesOnly,
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
        let merged = updateVariable;
        if (config.splitSecondaryVariablePassAndExtras !== true && config.tasks?.includeWorldEvolution === true) {
          try {
            const { mergeVariableUpdateJsonPatchInners, runWorldEvolutionSecondaryApi } = await import(
              './worldEvolutionSecondaryApi'
            );
            const evoInner = await runWorldEvolutionSecondaryApi(maintext, config, currentVariables);
            if (evoInner) {
              merged = mergeVariableUpdateJsonPatchInners(merged, evoInner);
              console.log('✅ [apiSettings] 世界演化 Patch 已并入本轮变量更新');
            }
          } catch (evoErr) {
            console.warn('⚠️ [apiSettings] 世界演化失败，仅使用变量更新结果:', evoErr);
          }
        }
        return merged;
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
): string {
  // 构建任务说明（变量更新为第二 API 默认职责，始终说明）
  let tasksDescription =
    '- 根据正文内容和当前变量数据，按照变量更新规则输出 <UpdateVariable> 标签\n';
  if (!variablesOnly && tasks.includeWorldChanges) {
    tasksDescription +=
      '- 分析正文对 NPC 生活（世界大势与居民生活 / NPC 状态）的影响，更新相关数据（若规则或变量结构要求）\n';
  }

  // 准备变量数据JSON（限制大小避免提示词过长）
  const variablesJson = JSON.stringify(currentVariables, null, 2);

  // 使用世界书中的格式要求，如果没有则使用默认格式
  const outputFormat =
    worldbookContents.variableOutputFormat ||
    `[
  { "op": "replace", "path": "/路径", "value": 值 },
  { "op": "add", "path": "/路径", "value": 值 }
]`;

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
- **禁止**在 Patch 中使用以下 path 前缀：\`/游戏状态\`、\`/区域数据\`、\`/建筑数据\`、\`/活动数据\`（世界大势、居民生活、地图演化由下一轮第二 API 处理）。
- 仍须正常维护 \`/角色档案\`、\`/元信息\`、\`/世界规则\`、\`/区域规则\`、\`/个人规则\` 等与角色、规则、进度相关的路径；**当前位置** 等字段请使用**已有**区域/建筑 id，勿新建地图条目。

`
    : '';

  const statSourceLabel =
    statDataMessageId === 'latest' ? 'latest（当前聊天最近一层消息的 stat_data）' : `消息楼层 #${statDataMessageId} 的 stat_data`;

  const mvuFullSection =
    (worldbookContents.mvuPrefixedEntriesFull || '').trim().length > 0
      ? `## 世界书：以 [mvu] / [mvu_update] 开头的全部条目（变量工作时必读，勿遗漏；与下文「变量列表 / 更新规则」分段互补，若有冲突以条目全文为准）\n${worldbookContents.mvuPrefixedEntriesFull.trim()}\n\n`
      : '';

  return `你是一位专门负责游戏变量更新的AI助手。你的任务是根据提供的游戏正文和当前变量数据，生成变量更新指令。

## 当前变量数据（JSON格式）
\`\`\`json
${variablesJson}
\`\`\`

## 变量快照来源
以下 JSON 取自：**${statSourceLabel}**。请在该快照基础上输出 JSON Patch（path 仍相对于 stat_data 根），使更新后与正文及世界书要求一致。

${variablesOnlyScopeSection}${mvuFullSection}${formatPersonalRuleKeysSection(currentVariables)}${
  worldbookContents.variableList
    ? `## 变量列表
${worldbookContents.variableList}

`
    : ''
}${
    worldbookContents.variableUpdateRule
      ? `## 变量更新规则
${worldbookContents.variableUpdateRule}

`
      : ''
  }${characterGapSection}${VARIABLE_JSON_PATCH_RUNTIME_RULES}
## 变量输出格式
请严格按照以下JSON Patch格式输出变量更新：
\`\`\`json
${outputFormat}
\`\`\`

## 正文内容（请据此分析变量变化）
<maintext>
${maintext}
</maintext>

## 第二 API 本轮职责清单
${tasksDescription}
## 核心任务（优先级从高到低）
1. **补足现有角色空缺**：检查上述"现有角色档案空缺检测"中的角色，基于正文推断并填充所有空缺字段（性格、性癖、敏感点开发、隐藏性癖、当前内心想法、**当前位置**、当前综合生理描述；**敏感点开发**为新键名，与旧 **敏感部位** 同形）
2. **更新现有角色数值**：根据正文中的互动，更新好感度、发情值、性癖开发值等数值
3. **创建新角色**：如果正文出现新角色，生成完整的角色档案（不得遗漏任何字段）
4. **更新世界规则**：如有新规则生效或规则状态变化

## 重要原则
- **优先使用 replace 操作更新现有角色**，而非 insert 创建新条目
- **绝对禁止**：让性格、性癖、敏感点开发保持为空对象 {}；让隐藏性癖、当前内心想法保持为空白字符串
- **基于正文推断**：即使没有直接描述，也要根据上下文合理推断角色的心理和生理状态

## 输出要求
1. 只输出 <UpdateVariable> 标签及其内容
2. 不要输出正文、解释或任何其他内容
3. 使用标准的 JSON Patch 格式（op: 仅 replace / add / remove / move；**禁止 delta**）
4. 确保 JSON 格式正确无误
5. 检查确认：所有现有角色的空缺字段都已被填充

## 输出示例
<UpdateVariable>
[
  { "op": "replace", "path": "/元信息/进度", "value": 5 },
  { "op": "replace", "path": "/角色档案/CHR-001/数值/发情值", "value": 12 },
  { "op": "replace", "path": "/区域规则/警局/细分规则/执法/描述", "value": "……" }
]
</UpdateVariable>`;
}

/**
 * 通过酒馆助手 `generateRaw` 调用当前聊天补全连接（与主对话同一「插头」）
 */
async function callSecondaryApiViaGenerateRaw(prompt: string, _config: SecondaryApiConfig): Promise<string> {
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
  const result = await generateRaw(genConfig);
  return String(result ?? '');
}

/**
 * 短上下文第二 API：`ordered_prompts` 使用调用方自定义 system + user（地图、世界演化等）。
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
    /** 为 true 时不派发顶栏第二 API 横幅（例如嵌套在变量更新流程内的世界演化） */
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
      return String((await generateRaw(genConfig)) ?? '');
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
    return String((await generateRaw(genConfig)) ?? '');
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
  const match = response.match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i);
  return match ? match[1].trim() : null;
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

  if (variableUpdate && !out.includes('<UpdateVariable>')) {
    out = `${out.trim()}\n\n<UpdateVariable>${variableUpdate}</UpdateVariable>`;
  }

  return out;
}
