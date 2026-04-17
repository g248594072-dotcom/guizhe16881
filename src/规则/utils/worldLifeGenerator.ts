/**
 * 世界大势和居民生活生成器
 * 在规则变更时调用第二API生成内容
 */

import type { SecondaryApiConfig } from '../types';
import {
  saveWorldTrendRecord,
  saveResidentLifeRecord,
  generateRecordId,
  type WorldTrendRecord,
  type ResidentLifeRecord,
} from './worldLifeStorage';
import { loadSecondaryApiConfig } from './localSettings';
import { buildDualWorldbookExcerptsForPrompt, getChatScopeWorldbookName } from './worldLifeWorldbookExcerpt';

declare function waitGlobalInitialized<T>(global: 'Mvu' | string): Promise<T>;
declare const Mvu: {
  getMvuData: (options: { type: 'message'; message_id: 'latest' | number }) => {
    stat_data?: Record<string, unknown>;
  } | null;
};

// ==================== Type Definitions ====================

interface WorldTrendPromptResult {
  affectedScope: string;
  dailyLifeChanges: string;
  randomNpcCase: {
    name: string;
    identity: string;
    lifeChange: string;
    psychological: string;
  };
}

interface ResidentLifePromptResult {
  otherCharacters: Array<{
    name: string;
    status: 'inactive' | 'retired';
    lifeDescription: string;
    abnormalChange: string;
  }>;
}

function formatTagMapBrief(v: unknown, maxKeys: number): string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return '（无）';
  const entries = Object.entries(v as Record<string, unknown>).slice(0, maxKeys);
  if (entries.length === 0) return '（无）';
  return entries.map(([k, val]) => `${k}：${String(val)}`).join('；');
}

function formatWorldbookSectionsMarkdown(charSection: string, chatSection: string): string {
  const scope = getChatScopeWorldbookName();
  const parts: string[] = [];
  if (charSection.trim()) {
    parts.push(`## 角色卡绑定世界书（节选，仅启用条目）\n${charSection.trim()}`);
  }
  if (chatSection.trim()) {
    parts.push(
      `## 当前聊天同名世界书（节选，chatScopeId：${scope || '（无）'}，仅启用条目）\n${chatSection.trim()}`,
    );
  }
  return parts.length ? `${parts.join('\n\n')}\n\n` : '';
}

function worldTrendCreativeConstraintsMarkdown(): string {
  return `## 创作约束（世界大势）
- 须严格遵守上文世界书节选与变量摘要中的身份、性格、生活方式与叙事语气，**拒绝 OOC**；与世界书冲突时以世界书为准。
- 可偏**日常**，允许**暧昧、轻度色情**的心理与身体感受，聚焦具体人物受到的影响；**避免**酷刑、公开羞辱、极端暴力、重度创伤或社会崩溃式描写。
- **随机 NPC 案例**优先选择**女性**（姓名、身份描写明确为女性），除非规则语境下男性更合理且不违背设定。
- 禁止主创说明、打破第四面墙、「作为 AI」等元话语。`;
}

function residentLifeCreativeConstraintsMarkdown(): string {
  return `## 创作约束（居民生活）
- 须严格遵守上文世界书节选与「角色档案摘录」中的姓名、性格、描写与生活细节，**拒绝 OOC**；档案与世界书冲突时以世界书为准。
- 可写**日常琐事、暧昧氛围、轻度色情**的心理或擦边感受，控制在成人向可读尺度；**避免**极端、猎奇与非自愿重度伤害。
- 主要描写背景列表中与档案摘录对应的人物，勿凭空替换或矛盾化已有角色人设。
- 禁止元话语、打破第四面墙。`;
}

async function tryGetLatestMvuRoleSnapshot(maxChars: number): Promise<string> {
  try {
    await waitGlobalInitialized('Mvu');
    const d = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    const raw = d?.stat_data?.['角色档案'];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
    const chars = raw as Record<string, Record<string, unknown>>;
    const lines: string[] = [];
    let used = 0;
    for (const [id, c] of Object.entries(chars)) {
      if (!c || typeof c !== 'object') continue;
      const name = String(c['姓名'] ?? id);
      const 状态 = String(c['状态'] ?? '');
      const 描写 = String(c['描写'] ?? '').slice(0, 180);
      const line = `- ${name}（${状态}）：${描写}`;
      if (used + line.length > maxChars) break;
      lines.push(line);
      used += line.length + 1;
    }
    return lines.length
      ? `## 当前变量中的角色档案摘要（随机案例与日常描写须与此一致）\n${lines.join('\n')}\n\n`
      : '';
  } catch {
    return '';
  }
}

function buildInactiveCharacterArchiveExcerpt(
  statData: Record<string, unknown>,
  inactiveDisplayNames: string[],
  maxTotal: number,
): string {
  const chars = statData['角色档案'] as Record<string, Record<string, unknown>> | undefined;
  if (!chars || typeof chars !== 'object') return '';
  const blocks: string[] = [];
  let used = 0;
  const seen = new Set<string>();

  for (const displayName of inactiveDisplayNames) {
    if (seen.has(displayName)) continue;
    for (const [id, c] of Object.entries(chars)) {
      if (!c || typeof c !== 'object') continue;
      const name = String(c['姓名'] ?? id);
      if (name !== displayName && id !== displayName) continue;
      const 状态 = String(c['状态'] ?? '');
      const 描写 = String(c['描写'] ?? '').slice(0, 320);
      const 性格 = formatTagMapBrief(c['性格'], 10);
      const 内心 = String(c['当前内心想法'] ?? '').slice(0, 220);
      const block = `### ${name}（键：${id}，状态：${状态}）\n- 描写摘录：${描写}\n- 性格：${性格}\n- 当前内心想法摘录：${内心}`;
      if (used + block.length > maxTotal) {
        blocks.push('…（档案摘录已达长度上限，余下角色从略）');
        return blocks.join('\n\n');
      }
      blocks.push(block);
      used += block.length + 2;
      seen.add(displayName);
      break;
    }
  }

  return blocks.join('\n\n');
}

async function tryLoadStatDataForResidentArchive(): Promise<Record<string, unknown> | null> {
  try {
    await waitGlobalInitialized('Mvu');
    const d = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    const sd = d?.stat_data;
    if (sd && typeof sd === 'object' && !Array.isArray(sd)) {
      return sd as Record<string, unknown>;
    }
  } catch {
    /* 静默 */
  }
  return null;
}

// ==================== World Trend Generation ====================

function isWorldTrendServiceUnavailableMessage(message: string): boolean {
  return /\b503\b/i.test(message) || /service unavailable/i.test(message);
}

function formatWorldTrendFailureToast(error: unknown): string {
  const msg = (error instanceof Error ? error.message : String(error)).trim() || '未知错误';
  if (isWorldTrendServiceUnavailableMessage(msg)) {
    return '世界演化错误 503（服务不可用）';
  }
  const max = 120;
  const short = msg.length > max ? `${msg.slice(0, max)}…` : msg;
  return `世界演化失败：${short}`;
}

/** 仅在此处提示，避免与调用方重复弹窗 */
async function notifyWorldTrendFailure(error: unknown): Promise<void> {
  try {
    const { default: toastr } = await import('toastr');
    toastr.error(formatWorldTrendFailureToast(error));
  } catch {
    // toastr 加载失败时仅依赖 console
  }
}

/**
 * 生成世界大势说明
 * @param ruleName 规则名称
 * @param ruleLevel 规则级别（世界或区域）
 * @param ruleDescription 规则效果描述
 * @param affectedRegions 影响的区域列表（可选）
 * @returns 是否成功生成
 */
export async function generateWorldTrend(
  ruleName: string,
  ruleLevel: 'world' | 'regional',
  ruleDescription: string,
  affectedRegions?: string[],
): Promise<boolean> {
  const config = loadSecondaryApiConfig();
  if (!config?.tasks?.includeWorldChanges) {
    console.log('[WorldTrend] NPC生活任务未启用，跳过生成');
    return false;
  }

  try {
    const { charSection, chatSection } = await buildDualWorldbookExcerptsForPrompt();
    const mvuSnapshot = await tryGetLatestMvuRoleSnapshot(900);
    const prompt = buildWorldTrendPrompt(ruleName, ruleLevel, ruleDescription, affectedRegions, {
      worldbookMarkdown: formatWorldbookSectionsMarkdown(charSection, chatSection),
      mvuRoleSnapshot: mvuSnapshot,
    });

    console.log(`[WorldTrend] 开始生成规则「${ruleName}」的世界大势说明… promptLen=${prompt.length}`);
    const result = await callSecondaryApiForWorldLife(prompt, config);
    const parsed = parseWorldTrendResult(result);

    if (parsed) {
      const record: Omit<WorldTrendRecord, 'id'> = {
        timestamp: Date.now(),
        triggerRule: ruleName,
        ruleLevel,
        affectedScope: parsed.affectedScope,
        dailyLifeChanges: parsed.dailyLifeChanges,
        randomNpcCase: parsed.randomNpcCase,
        isRead: false,
      };
      saveWorldTrendRecord({
        ...record,
        id: generateRecordId('wt'),
      });
      console.log(`[WorldTrend] 已成功保存规则「${ruleName}」的世界大势记录`);
      return true;
    }
  } catch (error) {
    console.error('[WorldTrend] 生成失败:', error);
    await notifyWorldTrendFailure(error);
  }
  return false;
}

/**
 * 构建世界大势提示词
 */
function buildWorldTrendPrompt(
  ruleName: string,
  ruleLevel: 'world' | 'regional',
  ruleDescription: string,
  affectedRegions: string[] | undefined,
  extras: { worldbookMarkdown: string; mvuRoleSnapshot: string },
): string {
  const prefix = `${extras.worldbookMarkdown}${extras.mvuRoleSnapshot}${worldTrendCreativeConstraintsMarkdown()}

`;
  return `${prefix}你是一位专门负责描述世界变化对日常生活影响的AI。

## 生效的规则信息
规则名称：${ruleName}
规则级别：${ruleLevel === 'world' ? '世界级' : '区域级'}
规则效果：${ruleDescription}
${affectedRegions && affectedRegions.length > 0 ? `影响区域：${affectedRegions.join('、')}` : ''}

## 生成任务
请生成以下内容：

1. **日常生活变化描述** (200-400字)
   - 描述这个规则生效后，普通人的日常生活发生了哪些变化
   - 包括工作、社交、出行、消费等方面的变化
   - 描述应该具体且有画面感，并与世界书语气一致

2. **影响范围** (一句话概括)
   - 这个规则主要影响了哪些地区/人群

3. **随机NPC生活案例**
   - 随机想象一个NPC（普通人或非主要角色），**优先女性**，描述TA在这个变化下的生活
   - 包括：NPC姓名、身份、具体生活变化、心理反应；须符合人设与世界书，拒绝OOC

## 输出格式
请严格按照以下JSON格式输出，不要包含任何其他内容：

\`\`\`json
{
  "affectedScope": "影响范围描述",
  "dailyLifeChanges": "日常生活变化详细描述...",
  "randomNpcCase": {
    "name": "NPC姓名",
    "identity": "身份/职业",
    "lifeChange": "具体生活变化描述...",
    "psychological": "心理反应和感受..."
  }
}
\`\`\`

只输出JSON，不要其他解释。`;
}

/**
 * 解析世界大势生成结果
 */
function parseWorldTrendResult(content: string): WorldTrendPromptResult | null {
  try {
    // Extract JSON from markdown code block if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/```\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    const data = JSON.parse(jsonStr);

    // Validate structure
    if (!data.affectedScope || !data.dailyLifeChanges || !data.randomNpcCase) {
      console.warn('[WorldTrend] 解析结果缺少必要字段:', data);
      return null;
    }

    return {
      affectedScope: String(data.affectedScope),
      dailyLifeChanges: String(data.dailyLifeChanges),
      randomNpcCase: {
        name: String(data.randomNpcCase.name || '未知NPC'),
        identity: String(data.randomNpcCase.identity || '普通居民'),
        lifeChange: String(data.randomNpcCase.lifeChange || '暂无变化'),
        psychological: String(data.randomNpcCase.psychological || '无明显反应'),
      },
    };
  } catch (error) {
    console.error('[WorldTrend] 解析JSON失败:', error);
    return null;
  }
}

// ==================== Resident Life Generation ====================

/**
 * 生成居民生活说明
 * @param ruleName 规则名称
 * @param targetCharacter 规则目标角色
 * @param ruleDescription 规则效果描述
 * @param inactiveCharacters 未出场角色列表
 * @returns 是否成功生成
 */
export async function generateResidentLife(
  ruleName: string,
  targetCharacter: string,
  ruleDescription: string,
  inactiveCharacters: string[],
): Promise<boolean> {
  const config = loadSecondaryApiConfig();
  if (!config?.tasks?.includeWorldChanges) {
    console.log('[ResidentLife] NPC生活任务未启用，跳过生成');
    return false;
  }

  // Skip if no inactive characters to describe
  if (inactiveCharacters.length === 0) {
    console.log('[ResidentLife] 没有未出场角色，跳过生成');
    return false;
  }

  const { charSection, chatSection } = await buildDualWorldbookExcerptsForPrompt();
  const stat = await tryLoadStatDataForResidentArchive();
  const archiveExcerpt = stat ? buildInactiveCharacterArchiveExcerpt(stat, inactiveCharacters, 3600) : '';
  const prompt = buildResidentLifePrompt(ruleName, targetCharacter, ruleDescription, inactiveCharacters, {
    worldbookMarkdown: formatWorldbookSectionsMarkdown(charSection, chatSection),
    archiveExcerpt,
  });

  try {
    console.log(`[ResidentLife] 开始生成规则「${ruleName}」的居民生活说明… promptLen=${prompt.length}`);
    const result = await callSecondaryApiForWorldLife(prompt, config);
    const parsed = parseResidentLifeResult(result);

    if (parsed && parsed.otherCharacters.length > 0) {
      const record: Omit<ResidentLifeRecord, 'id'> = {
        timestamp: Date.now(),
        triggerRule: ruleName,
        targetCharacter,
        otherCharacters: parsed.otherCharacters,
        isRead: false,
      };
      saveResidentLifeRecord({
        ...record,
        id: generateRecordId('rl'),
      });
      console.log(`[ResidentLife] 已成功保存规则「${ruleName}」的居民生活记录`);
      return true;
    }
  } catch (error) {
    console.error('[ResidentLife] 生成失败:', error);
  }
  return false;
}

/**
 * 聚合当前「生效中」个人规则与背景角色，一次第二 API 生成居民生活记录（变量已提交后调用）。
 */
export async function generateResidentLifeAggregated(statData: Record<string, unknown>): Promise<boolean> {
  const config = loadSecondaryApiConfig();
  if (!config?.tasks?.includeWorldChanges) {
    console.log('[ResidentLife] NPC生活任务未启用，跳过聚合生成');
    return false;
  }

  const 角色档案 = statData['角色档案'] as Record<string, { 姓名?: string; 状态?: string }> | undefined;
  const inactiveChars: string[] = [];
  if (角色档案 && typeof 角色档案 === 'object') {
    for (const [id, c] of Object.entries(角色档案)) {
      if (!c || typeof c !== 'object') continue;
      if (c.状态 !== '出场中') {
        inactiveChars.push(String(c.姓名 || id));
      }
    }
  }

  if (inactiveChars.length === 0) {
    console.log('[ResidentLife] 聚合：无未出场/退场角色，跳过');
    return false;
  }

  const personalRules = statData['个人规则'] as Record<string, Record<string, unknown>> | undefined;
  const rulesLines: string[] = [];
  if (personalRules && typeof personalRules === 'object') {
    for (const [k, pr] of Object.entries(personalRules)) {
      if (!pr || typeof pr !== 'object') continue;
      const st = String(pr['状态'] ?? '生效中');
      if (st !== '生效中') continue;
      const name = String(pr['名称'] ?? k);
      const target = String(pr['适用对象'] ?? pr['名称'] ?? k).trim();
      const desc = String(pr['效果描述'] ?? '').trim();
      rulesLines.push(`- 【${name}】适用对象：${target}；效果：${desc || '（无描述）'}`);
    }
  }

  const rulesBlock =
    rulesLines.length > 0 ? rulesLines.join('\n') : '（当前无「生效中」个人规则；请主要依据游戏日与背景角色推演日常变化。）';

  const gt = statData['游戏时间'];
  const { charSection, chatSection } = await buildDualWorldbookExcerptsForPrompt();
  const archiveExcerpt = buildInactiveCharacterArchiveExcerpt(statData, inactiveChars, 3600);
  const prompt = buildResidentLifeAggregatedPrompt(rulesBlock, inactiveChars, gt, {
    worldbookMarkdown: formatWorldbookSectionsMarkdown(charSection, chatSection),
    archiveExcerpt,
  });

  try {
    console.log(`[ResidentLife] 开始聚合生成居民生活说明… promptLen=${prompt.length}`);
    const result = await callSecondaryApiForWorldLife(prompt, config);
    const parsed = parseResidentLifeResult(result);

    if (parsed && parsed.otherCharacters.length > 0) {
      const triggerRule =
        rulesLines.length > 0 ? `个人规则汇总（${rulesLines.length}条）` : '游戏日推进 / 背景角色';
      const record: Omit<ResidentLifeRecord, 'id'> = {
        timestamp: Date.now(),
        triggerRule,
        targetCharacter: '（汇总）',
        otherCharacters: parsed.otherCharacters,
        isRead: false,
      };
      saveResidentLifeRecord({
        ...record,
        id: generateRecordId('rl'),
      });
      console.log('[ResidentLife] 聚合居民生活记录已保存');
      return true;
    }
  } catch (error) {
    console.error('[ResidentLife] 聚合生成失败:', error);
  }
  return false;
}

function buildResidentLifeAggregatedPrompt(
  rulesBlock: string,
  inactiveCharacters: unknown[],
  游戏时间: unknown,
  extras: { worldbookMarkdown: string; archiveExcerpt: string },
): string {
  const archiveBlock = extras.archiveExcerpt.trim()
    ? `## 角色档案摘录（须严格遵守，与下列姓名对应）\n${extras.archiveExcerpt.trim()}\n\n`
    : '';
  return `${extras.worldbookMarkdown}${archiveBlock}${residentLifeCreativeConstraintsMarkdown()}

你是一位专门负责描述角色背景生活的AI。

## 当前游戏时间（变量）
${JSON.stringify(游戏时间 ?? {}, null, 2)}

## 生效中的个人规则（可能多条，需综合考虑叠加影响）
${rulesBlock}

## 背景角色列表
以下角色当前未出场或已暂时退场：
${inactiveCharacters.map((c) => `- ${String(c)}`).join('\n')}

## 生成任务
请综合上述**所有**个人规则（若有）对背景角色的影响，并结合当前游戏日推演日常生活变化：

对于每个可能受影响的角色，描述：
1. 该角色的日常生活变化（日常化、可含暧昧与轻度色情心理/擦边感受，勿极端）
2. 是否有异常或特殊变化（个人规则往往只影响特定对象，其他角色可能觉得奇怪或不理解）
3. 角色的心理状态（须符合档案与世界书，拒绝OOC）

注意：
- 若有多条个人规则，请考虑其对不同目标角色的叠加或交叉影响
- 不需要描述所有背景角色，选择 2-4 个最相关的角色描述即可

## 输出格式
请严格按照以下JSON格式输出，不要包含任何其他内容：

\`\`\`json
{
  "otherCharacters": [
    {
      "name": "角色名",
      "status": "inactive/retired",
      "lifeDescription": "生活变化描述...",
      "abnormalChange": "异常变化（若无则填：无）..."
    }
  ]
}
\`\`\`

只输出JSON，不要其他解释。`;
}

/**
 * 构建居民生活提示词
 */
function buildResidentLifePrompt(
  ruleName: string,
  targetCharacter: string,
  ruleDescription: string,
  inactiveCharacters: string[],
  extras: { worldbookMarkdown: string; archiveExcerpt: string },
): string {
  const archiveBlock = extras.archiveExcerpt.trim()
    ? `## 角色档案摘录（须严格遵守）\n${extras.archiveExcerpt.trim()}\n\n`
    : '';
  return `${extras.worldbookMarkdown}${archiveBlock}${residentLifeCreativeConstraintsMarkdown()}

你是一位专门负责描述角色背景生活的AI。

## 生效的规则信息
规则名称：${ruleName}
规则目标角色：${targetCharacter}
规则效果：${ruleDescription}

## 背景角色列表
以下角色当前未出场或已暂时退场：
${inactiveCharacters.map((c) => `- ${c}`).join('\n')}

## 生成任务
请分析上述个人规则对这些背景角色的影响：

对于每个可能受影响的角色，描述：
1. 该角色的日常生活变化（可日常、暧昧、轻度色情向，勿极端）
2. 是否有异常或特殊变化（因为个人规则只影响目标角色，其他角色可能觉得奇怪或不理解）
3. 角色的心理状态（须符合档案与世界书，拒绝OOC）

注意：
- 目标角色是「${targetCharacter}」，个人规则只影响TA
- 其他角色可能会观察到异常，或者生活间接受到影响
- 不需要描述所有角色，选择2-4个最相关的角色描述即可

## 输出格式
请严格按照以下JSON格式输出，不要包含任何其他内容：

\`\`\`json
{
  "otherCharacters": [
    {
      "name": "角色名",
      "status": "inactive/retired",
      "lifeDescription": "生活变化描述...",
      "abnormalChange": "异常变化（若无则填：无）..."
    }
  ]
}
\`\`\`

只输出JSON，不要其他解释。`;
}

/**
 * 解析居民生活生成结果
 */
function parseResidentLifeResult(content: string): ResidentLifePromptResult | null {
  try {
    // Extract JSON from markdown code block if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/```\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    const data = JSON.parse(jsonStr);

    // Validate structure
    if (!Array.isArray(data.otherCharacters)) {
      console.warn('[ResidentLife] 解析结果缺少otherCharacters数组:', data);
      return null;
    }

    const characters = data.otherCharacters
      .filter((char: any) => char.name && char.lifeDescription)
      .map((char: any) => ({
        name: String(char.name),
        status: (char.status === 'retired' ? 'retired' : 'inactive') as 'inactive' | 'retired',
        lifeDescription: String(char.lifeDescription),
        abnormalChange: String(char.abnormalChange || '无'),
      }));

    return {
      otherCharacters: characters,
    };
  } catch (error) {
    console.error('[ResidentLife] 解析JSON失败:', error);
    return null;
  }
}

// ==================== API Call Helper ====================

const WORLD_LIFE_SYSTEM_PROMPT = '你是一个专门描述游戏世界变化的AI助手，擅长分析规则对日常生活的影响。';

/**
 * 调用第二API生成世界/居民生活内容
 * 复用 apiSettings.ts 中的 API 调用逻辑
 */
async function callSecondaryApiForWorldLife(
  prompt: string,
  config: SecondaryApiConfig,
): Promise<string> {
  const modelTrim = String(config.model || '').trim();

  // Check for generateRaw availability
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用，无法调用第二API');
  }

  // Build generation config
  const genConfig: Parameters<typeof generateRaw>[0] = {
    user_input: '',
    should_stream: false,
    should_silence: true,
    max_chat_history: 0,
    automatic_trigger: true, // 与 apiSettings 第二路一致，避免扩展误处理酒馆同连接请求
    ordered_prompts: [
      { role: 'system', content: WORLD_LIFE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  };

  // 仅自定义第二 API 时允许用配置里的模型；使用酒馆插头时与主对话模型一致
  if (modelTrim && !config.useTavernMainConnection) {
    genConfig.custom_api = { model: modelTrim };
  }

  // Use custom endpoint if not using tavern main connection
  if (!config.useTavernMainConnection) {
    const url = String(config.url || '').trim();
    const key = String(config.key || '').trim();

    if (!url) {
      throw new Error('第二 API URL 未配置');
    }
    if (!key) {
      throw new Error('第二 API Key 未配置');
    }

    genConfig.custom_api = {
      ...genConfig.custom_api,
      url: normalizeOpenAiUrl(url),
      key,
    };
  }

  // Call API
  const result = await generateRaw(genConfig);
  return String(result ?? '');
}

/**
 * 规范化OpenAI URL
 */
function normalizeOpenAiUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized) return '';

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Ensure /v1/chat/completions suffix
  if (!normalized.endsWith('/v1/chat/completions')) {
    // If it ends with /v1, append /chat/completions
    if (normalized.endsWith('/v1')) {
      normalized += '/chat/completions';
    } else {
      // Otherwise append full path
      normalized += '/v1/chat/completions';
    }
  }

  return normalized;
}

/**
 * 执行带重试的API调用
 */
export async function callSecondaryApiWithRetry(
  prompt: string,
  maxRetries: number = 2,
): Promise<string> {
  const config = loadSecondaryApiConfig();
  const maxAttempts = 1 + Math.max(0, Math.min(10, maxRetries));
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`[WorldLife] API调用尝试 ${attempt + 1}/${maxAttempts}`);
      const result = await callSecondaryApiForWorldLife(prompt, config);

      // Check if result contains valid content
      if (result && result.trim().length > 0) {
        return result;
      }

      throw new Error('API返回空内容');
    } catch (error) {
      lastError = error as Error;
      console.warn(`[WorldLife] API调用失败 (尝试 ${attempt + 1}):`, error);

      if (attempt < maxAttempts - 1) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`API调用失败（${maxAttempts} 次尝试均失败）: ${lastError?.message}`);
}
