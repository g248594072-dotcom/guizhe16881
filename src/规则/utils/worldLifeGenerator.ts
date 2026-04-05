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
import { getSecondaryApiConfig } from './apiSettings';

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

// ==================== World Trend Generation ====================

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
  const config = getSecondaryApiConfig();
  if (!config?.tasks?.includeWorldTrend) {
    console.log('[WorldTrend] 任务未启用，跳过生成');
    return false;
  }

  const prompt = buildWorldTrendPrompt(ruleName, ruleLevel, ruleDescription, affectedRegions);

  try {
    console.log(`[WorldTrend] 开始生成规则「${ruleName}」的世界大势说明...`);
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
  affectedRegions?: string[],
): string {
  return `你是一位专门负责描述世界变化对日常生活影响的AI。

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
   - 描述应该具体且有画面感

2. **影响范围** (一句话概括)
   - 这个规则主要影响了哪些地区/人群

3. **随机NPC生活案例**
   - 随机想象一个NPC（普通人或非主要角色），描述TA在这个变化下的生活
   - 包括：NPC姓名、身份、具体生活变化、心理反应

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
  const config = getSecondaryApiConfig();
  if (!config?.tasks?.includeResidentLife) {
    console.log('[ResidentLife] 任务未启用，跳过生成');
    return false;
  }

  // Skip if no inactive characters to describe
  if (inactiveCharacters.length === 0) {
    console.log('[ResidentLife] 没有未出场角色，跳过生成');
    return false;
  }

  const prompt = buildResidentLifePrompt(ruleName, targetCharacter, ruleDescription, inactiveCharacters);

  try {
    console.log(`[ResidentLife] 开始生成规则「${ruleName}」的居民生活说明...`);
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
 * 构建居民生活提示词
 */
function buildResidentLifePrompt(
  ruleName: string,
  targetCharacter: string,
  ruleDescription: string,
  inactiveCharacters: string[],
): string {
  return `你是一位专门负责描述角色背景生活的AI。

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
1. 该角色的日常生活变化
2. 是否有异常或特殊变化（因为个人规则只影响目标角色，其他角色可能觉得奇怪或不理解）
3. 角色的心理状态

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
      "abnormalChange": "异常变化（如果没有写\"无\"）..."
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
    ordered_prompts: [
      { role: 'system', content: WORLD_LIFE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  };

  // Use custom model if specified
  if (modelTrim) {
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
  const config = getSecondaryApiConfig();
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
