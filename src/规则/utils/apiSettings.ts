/**
 * API设置管理工具
 * 管理输出模式设置、世界书条目切换、双API流程处理
 */

import type { OutputMode, SecondaryApiConfig } from '../types';
import type { WorldbookEntry } from '../types';
import { normalizeOpenAiUrl } from './openaiUrl';
import { loadOutputMode, loadSecondaryApiConfig } from './localSettings';

/** 无存档或未配置第二 API 时使用的默认：双 API 流程中的第二路走酒馆插头 */
export const DEFAULT_SECONDARY_API_CONFIG: SecondaryApiConfig = {
  url: '',
  key: '',
  model: '',
  maxRetries: 3,
  useTavernMainConnection: true,
  tasks: {
    includeVariableUpdate: true,
    includeWorldTrend: false,
    includeResidentLife: false,
  },
};

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
  return MVU_WORLDBOOK_ENTRY_PREFIXES.some((p) => n.startsWith(p));
}

function joinWorldbookEntryBlocks(entries: WorldbookEntry[]): string {
  return entries
    .map((e) => `## ${(e.name || '').trim()}\n${(e.content || '').trim()}`)
    .filter((block) => block.replace(/^##\s[^\n]*\n/, '').trim().length > 0)
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
  const mvu = entries.filter((e) => isMvUVariableWorldbookEntryName(e.name || ''));
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

  const findByIncludes = (sub: string) => entries.find((e) => (e.name || '').includes(sub));
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
    const updatedEntries = entries.map((entry) => {
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
        if (entryName.includes(WORLDBOOK_ENTRIES.variableUpdateRule) ||
            entryName.includes(WORLDBOOK_ENTRIES.variableList) ||
            entryName.includes(WORLDBOOK_ENTRIES.variableOutputFormat) ||
            entryName.includes(WORLDBOOK_ENTRIES.singleApiMainFormat)) {
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

    updateStatData((stat) => {
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

/**
 * 测试「使用酒馆相同 API」时第二 API 是否可走通（经 `generateRaw`，不读取页面密钥）
 */
export async function testSecondaryApiTavernPlug(modelOverride?: string): Promise<void> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用');
  }
  const modelTrim = String(modelOverride || '').trim();
  const cfg: Parameters<typeof generateRaw>[0] = {
    user_input: '',
    should_stream: false,
    should_silence: true,
    max_chat_history: 0,
    ordered_prompts: [{ role: 'user', content: 'Reply with exactly one word: OK' }],
  };
  if (modelTrim) {
    cfg.custom_api = { model: modelTrim };
  }
  await generateRaw(cfg);
}

/** 第二 API 即将发起网络请求时派发，供界面显示横幅（`App.vue` 监听） */
export const SECONDARY_API_START_EVENT = 'rule-modifier-secondary-api-start' as const;

export function notifySecondaryApiStart(detail?: { attempt?: number }): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SECONDARY_API_START_EVENT, { detail: detail ?? {} }));
}

/**
 * 使用第二API处理变量更新
 * @param maintext 主API生成的正文内容
 * @param config 第二API配置
 * @returns 生成的变量更新内容
 */
export async function processWithSecondaryApi(
  maintext: string,
  config: SecondaryApiConfig,
): Promise<string> {
  const maxRetries = config.maxRetries || 3;
  let lastError: Error | null = null;

  if (!config.useTavernMainConnection && !String(config.url || '').trim()) {
    throw new Error('第二 API URL 未配置');
  }

  // 获取当前变量数据
  let currentVariables: Record<string, any> = {};
  try {
    await waitGlobalInitialized('Mvu');
    const mvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    currentVariables = mvuData?.stat_data || {};
    console.log('✅ [apiSettings] 已获取当前变量数据');
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
    };
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 [apiSettings] 第二API调用尝试 ${attempt + 1}/${maxRetries}`);

      // 构建完整提示词（包含变量数据+世界书内容+正文）
      const prompt = buildSecondaryApiPrompt(
        maintext,
        config.tasks,
        currentVariables,
        worldbookContents,
      );

      notifySecondaryApiStart({ attempt: attempt + 1 });

      // 调用第二API（酒馆插头走 generateRaw，不经 fetch 读密钥）
      const response = config.useTavernMainConnection
        ? await callSecondaryApiViaGenerateRaw(prompt, config)
        : await callSecondaryApi(prompt, config);

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

      if (attempt < maxRetries - 1) {
        // 等待后重试
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  // 所有重试都失败了
  throw new Error(`第二API调用失败 (${maxRetries}次重试): ${lastError?.message}`);
}

/**
 * 获取世界书内容供第二API使用
 * 读取变量更新规则、变量列表、变量输出格式
 * @returns 世界书条目内容
 */
async function getWorldbookContentsForSecondaryApi(): Promise<{
  variableUpdateRule: string;
  variableList: string;
  variableOutputFormat: string;
}> {
  const worldbookName = getCurrentCharWorldbookName();

  // 获取世界书条目
  const entries: WorldbookEntry[] = await getWorldbook(worldbookName);

  if (!entries || entries.length === 0) {
    throw new Error('世界书条目为空');
  }

  // 优先聚合 [mvu] / [mvu_update] 前缀条目（即使被禁用也能读取 content）
  return collectVariableWorldbookContentsFromEntries(entries);
}

/**
 * 构建第二API提示词
 * @param maintext 主API生成的正文
 * @param tasks 任务配置
 * @param currentVariables 当前变量数据
 * @param worldbookContents 世界书条目内容
 * @returns 完整提示词
 */
function buildSecondaryApiPrompt(
  maintext: string,
  tasks: SecondaryApiConfig['tasks'],
  currentVariables: Record<string, any>,
  worldbookContents: {
    variableUpdateRule: string;
    variableList: string;
    variableOutputFormat: string;
  },
): string {
  // 构建任务说明
  let tasksDescription = '';
  if (tasks.includeVariableUpdate) {
    tasksDescription += '- 根据正文内容和当前变量数据，按照变量更新规则输出 <UpdateVariable> 标签\n';
  }
  if (tasks.includeWorldTrend) {
    tasksDescription += '- 分析正文对世界大势的影响，更新相关数据\n';
  }
  if (tasks.includeResidentLife) {
    tasksDescription += '- 分析正文对居民生活的影响，更新NPC状态\n';
  }

  // 准备变量数据JSON（限制大小避免提示词过长）
  const variablesJson = JSON.stringify(currentVariables, null, 2);

  // 使用世界书中的格式要求，如果没有则使用默认格式
  const outputFormat = worldbookContents.variableOutputFormat || `[
  { "op": "replace", "path": "/路径", "value": 值 },
  { "op": "add", "path": "/路径", "value": 值 }
]`;

  return `你是一位专门负责游戏变量更新的AI助手。你的任务是根据提供的游戏正文和当前变量数据，生成变量更新指令。

## 当前变量数据（JSON格式）
\`\`\`json
${variablesJson}
\`\`\`

${worldbookContents.variableList ? `## 变量列表
${worldbookContents.variableList}

` : ''}${worldbookContents.variableUpdateRule ? `## 变量更新规则
${worldbookContents.variableUpdateRule}

` : ''}## 变量输出格式
请严格按照以下JSON Patch格式输出变量更新：
\`\`\`json
${outputFormat}
\`\`\`

## 正文内容（请据此分析变量变化）
<maintext>
${maintext}
</maintext>

## 你需要执行的任务
${tasksDescription || '- 根据正文内容分析变量变化，按照变量更新规则输出 <UpdateVariable> 标签'}

## 输出要求
1. 只输出 <UpdateVariable> 标签及其内容
2. 不要输出正文、解释或任何其他内容
3. 使用标准的 JSON Patch 格式（op: replace/add/remove）
4. 确保 JSON 格式正确无误
5. 基于"当前变量数据"中的现有值进行增量更新
6. 只更新被正文明确影响的变量，不要修改无关变量

## 输出示例
<UpdateVariable>
[
  { "op": "replace", "path": "/元信息/进度", "value": 5 },
  { "op": "replace", "path": "/角色档案/角色键/数值/好感度", "value": 10 }
]
</UpdateVariable>`;
}

/**
 * 通过酒馆助手 `generateRaw` 调用当前聊天补全连接（与主对话同一「插头」）
 */
async function callSecondaryApiViaGenerateRaw(
  prompt: string,
  config: SecondaryApiConfig,
): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用，无法使用酒馆相同 API');
  }
  const modelTrim = String(config.model || '').trim();
  const genConfig: Parameters<typeof generateRaw>[0] = {
    user_input: '',
    should_stream: false,
    should_silence: true,
    max_chat_history: 0,
    ordered_prompts: [
      { role: 'system', content: '你是一个专业的游戏变量更新助手。' },
      { role: 'user', content: prompt },
    ],
  };
  if (modelTrim) {
    genConfig.custom_api = { model: modelTrim };
  }
  const result = await generateRaw(genConfig);
  return String(result ?? '');
}

/**
 * 调用第二API（自定义 URL + fetch）
 * @param prompt 提示词
 * @param config API配置
 * @returns API响应文本
 */
async function callSecondaryApi(prompt: string, config: SecondaryApiConfig): Promise<string> {
  if (!String(config.url || '').trim()) {
    throw new Error('第二 API URL 未配置');
  }
  const normalized = normalizeOpenAiUrl(config.url);
  const response = await fetch(normalized.chatCompletionsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: '你是一个专业的游戏变量更新助手。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`API请求失败: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('API响应格式无效');
  }

  return data.choices[0].message.content;
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
function getCurrentCharWorldbookName(): string {
  try {
    // 从酒馆接口获取当前角色卡的世界书
    const charInfo = SillyTavern.getCharacterInfo?.();
    if (charInfo?.worldbook_name) {
      return charInfo.worldbook_name;
    }

    // 备选方案：从变量中读取
    const vars = getVariables({ type: 'character' });
    if (vars?.worldbook_name) {
      return vars.worldbook_name;
    }

    // 默认世界书名称
    return '规则系统';
  } catch (error) {
    console.warn('⚠️ [apiSettings] 获取世界书名称失败，使用默认值:', error);
    return '规则系统';
  }
}

// 导出常量供外部使用
export { WORLDBOOK_ENTRIES };
