/**
 * 游戏流程控制器
 * 处理完整的游戏回合：玩家输入 → AI生成 → 验证 → 显示
 */

import { extractLastSumContent, parseMaintext, parseOptions, type Option } from './messageParser';
import {
  getCurrentOutputMode,
  getSecondaryApiConfig,
  isSecondaryApiConfigured,
  processWithSecondaryApi,
} from './apiSettings';
import { processMaintextBeautification } from './maintextBeautify';

// 生成状态
let isGenerating = false;
let currentGenerationId: string | null = null;

// 自定义事件名称
export const GAME_TURN_COMPLETED = 'game_turn_completed';
export const GAME_GENERATION_STARTED = 'game_generation_started';
export const GAME_STREAM_RECEIVED = 'game_stream_received';

/**
 * 验证 AI 回复格式
 */
interface ValidationResult {
  valid: boolean;
  maintext: string;
  options: Option[];
  sum: string;
  error?: string;
}

/**
 * 游戏回合结果
 */
interface GameTurnResult {
  generationId: string;
  maintext: string;
  options: Option[];
  sum: string;
  raw: string;
}

/**
 * 构建完整提示词
 * @param playerInput 玩家输入或选项文本
 * @param isDualMode 是否为双API模式
 */
function buildPrompt(playerInput: string, isDualMode = false): string {
  // 添加格式要求到输入中
  let formatInstructions = `[系统提示：请严格按照以下格式回复]
<maintext>
（在此写入游戏的正文描述，包括场景、对话、动作等）
</maintext>

（选项二选一，整段须闭合）
<choice>
1. 选项类型标题 - 本回合具体行动描写
2. …
</choice>
或：
<option id="A">选项A描述</option>
<option id="B">选项B描述</option>
<option id="C">选项C描述</option>

<sum>
（在此写入本回合的简短摘要，用于存档）
</sum>`;

  // 单API模式需要输出变量更新
  if (!isDualMode) {
    formatInstructions += `

<UpdateVariable>
（在此写入变量更新指令，使用JSON Patch格式）
</UpdateVariable>`;
  } else {
    // 双API模式：主API不需要输出变量更新
    formatInstructions += `

[注意：双API模式下，你只需输出正文、选项和摘要。变量更新将由专门的处理程序处理，你不需要输出 <UpdateVariable> 标签。]`;
  }

  return `${playerInput}

${formatInstructions}`;
}

/**
 * 验证消息格式（轻量级验证，仅检查标签存在性）
 * 用于快速检查消息是否符合基本格式要求
 * @param text 消息文本
 * @param isDualMode 是否为双API模式（双API模式下 UpdateVariable 可选）
 */
function validateMessage(text: string, isDualMode = false): { valid: boolean; error?: string } {
  if (!text) {
    return { valid: false, error: '消息内容为空' };
  }

  // 移除 thinking 标签
  let cleaned = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '');

  // 与 parseMaintext 一致：存在可解析的最后一对 maintext 即视为有正文
  const hasMaintext = parseMaintext(cleaned).length > 0;
  const hasOption =
    /<option[\s\S]*?<\/option>/i.test(cleaned) || /<choice[\s\S]*?<\/choice>/i.test(cleaned);
  const hasSum = /<sum>[\s\S]*?<\/sum>/i.test(cleaned);

  // 单API模式下需要检查 UpdateVariable（可选但推荐）
  const hasUpdateVariable = /<UpdateVariable>[\s\S]*?<\/UpdateVariable>/i.test(cleaned);

  if (!hasMaintext) {
    return { valid: false, error: '缺少 <maintext> 标签' };
  }
  if (!hasOption) {
    return { valid: false, error: '缺少 <option> 或 <choice> 标签' };
  }
  if (!hasSum) {
    return { valid: false, error: '缺少 <sum> 标签' };
  }

  // 单API模式下提示缺少 UpdateVariable（但不算错误）
  if (!isDualMode && !hasUpdateVariable) {
    console.warn('⚠️ [gameFlow] 单API模式下响应缺少 <UpdateVariable> 标签');
  }

  return { valid: true };
}

/**
 * 验证 AI 回复格式（完整验证，提取并验证内容）
 * 用于完整验证消息并提取内容
 * @param text 消息文本
 * @param isDualMode 是否为双API模式（双API模式下 UpdateVariable 可选）
 */
function validateResponse(text: string, isDualMode = false): ValidationResult {
  if (!text) {
    return { valid: false, maintext: '', options: [], sum: '', error: '消息内容为空' };
  }

  // 先进行轻量级验证
  const messageCheck = validateMessage(text, isDualMode);
  if (!messageCheck.valid) {
    return { valid: false, maintext: '', options: [], sum: '', error: messageCheck.error };
  }

  // 移除 thinking 标签
  let cleaned = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '');

  // 提取 maintext
  const maintext = parseMaintext(cleaned);

  // 提取 options
  const options = parseOptions(cleaned);

  const sum = extractLastSumContent(cleaned);

  // 验证必需内容（标签存在但内容可能为空）
  if (!maintext) {
    return { valid: false, maintext: '', options: [], sum: '', error: '<maintext> 标签内容为空' };
  }
  if (options.length === 0) {
    return {
      valid: false,
      maintext: '',
      options: [],
      sum: '',
      error: '<option> / <choice> 区块内容为空或无法解析为选项',
    };
  }
  if (!sum) {
    return { valid: false, maintext: '', options: [], sum: '', error: '<sum> 标签内容为空' };
  }

  return { valid: true, maintext, options, sum };
}

// 导出 validateMessage 供外部使用
export { validateMessage };

/**
 * 触发自定义事件
 */
function triggerCustomEvent(eventName: string, data: any): void {
  window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
}

/**
 * 执行游戏回合
 * @param prompt 玩家输入或选项文本
 * @param useDualApi 是否使用双API模式（可选，默认自动检测）
 * @returns 是否成功
 */
export async function playTurn(prompt: string, useDualApi?: boolean): Promise<boolean> {
  if (isGenerating) {
    console.warn('⚠️ [gameFlow] 已有生成任务在进行中');
    return false;
  }

  try {
    isGenerating = true;
    const generationId = `game_${Date.now()}`;
    currentGenerationId = generationId;

    // 检测输出模式
    let isDualMode = useDualApi;
    if (isDualMode === undefined) {
      isDualMode = getCurrentOutputMode() === 'dual';
    }

    console.log(`🎮 [gameFlow] 输出模式: ${isDualMode ? '双API' : '单API'}`);

    // 1. 构建完整的提示词
    const fullPrompt = buildPrompt(prompt, isDualMode);
    console.log('🎮 [gameFlow] 开始回合:', generationId, '提示词:', prompt);

    // 触发开始事件
    triggerCustomEvent(GAME_GENERATION_STARTED, { generationId, prompt, isDualMode });

    let result: string;

    if (isDualMode) {
      // 双API模式流程
      result = await executeDualApiFlow(fullPrompt, generationId);
    } else {
      // 单API模式流程
      result = await generate({
        user_input: fullPrompt,
        should_stream: false,
        should_silence: true,
        generation_id: generationId,
      });
    }

    console.log('📝 [gameFlow] 生成完成，验证格式...');

    // 3. 验证生成的内容
    const validation = validateResponse(result, isDualMode);
    if (!validation.valid) {
      console.error('❌ [gameFlow] 格式验证失败:', validation.error);
      console.log('原始响应:', result);
      triggerCustomEvent(GAME_TURN_COMPLETED, {
        generationId,
        maintext: validation.maintext || '（格式错误，请检查AI回复）\n\n原始回复：\n' + result,
        options: validation.options.length > 0 ? validation.options : [{ id: 'A', text: '继续' }],
        sum: validation.sum || '格式错误',
        raw: result,
        error: validation.error,
      });
      return false;
    }

    console.log('✅ [gameFlow] 格式验证通过:', {
      maintext: validation.maintext.substring(0, 50) + '...',
      options: validation.options.length,
      sum: validation.sum.substring(0, 30) + '...',
    });

    // 4. 触发自定义事件通知前端刷新
    const turnResult: GameTurnResult = {
      generationId,
      maintext: validation.maintext,
      options: validation.options,
      sum: validation.sum,
      raw: result,
    };

    triggerCustomEvent(GAME_TURN_COMPLETED, turnResult);

    console.log('✅ [gameFlow] 回合完成:', generationId);
    return true;

  } catch (error) {
    console.error('❌ [gameFlow] 回合失败:', error);
    triggerCustomEvent(GAME_TURN_COMPLETED, {
      generationId: currentGenerationId,
      maintext: '（生成失败，请重试）',
      options: [{ id: 'A', text: '重试' }],
      sum: '生成失败',
      raw: '',
      error: String(error),
    });
    return false;
  } finally {
    isGenerating = false;
    currentGenerationId = null;
  }
}

/**
 * 执行双API流程
 * @param prompt 提示词
 * @param generationId 生成ID
 * @returns 合并后的完整响应
 */
async function executeDualApiFlow(prompt: string, generationId: string): Promise<string> {
  // 1. 调用主API生成正文
  console.log('🎯 [gameFlow] 调用主API生成正文...');
  const mainResult = await generate({
    user_input: prompt,
    should_stream: false,
    should_silence: true,
    generation_id: generationId,
  });

  // 2. 提取 maintext、option、sum 标签
  const maintext = extractMaintext(mainResult);
  const options = extractOptions(mainResult);
  const sum = extractSum(mainResult);

  if (!maintext) {
    throw new Error('主API响应中未找到 maintext 标签');
  }

  console.log('📝 [gameFlow] 主API生成完成，准备调用第二API（变量 / 正文美化）...');

  // 3. 获取第二API配置
  const secondaryConfig = getSecondaryApiConfig();
  if (!isSecondaryApiConfigured(secondaryConfig)) {
    console.warn('⚠️ [gameFlow] 第二API未配置，仅使用主API结果');
    return mainResult;
  }

  const wantVar = secondaryConfig.tasks?.includeVariableUpdate !== false;
  const wantBeautify = secondaryConfig.tasks?.includeMaintextBeautification === true;
  if (!wantVar && !wantBeautify) {
    console.warn('⚠️ [gameFlow] 第二API已配置但未启用变量与正文美化，跳过第二路');
    return mainResult;
  }

  // 4. 并行：变量（原始 maintext）与正文美化（原始 maintext）
  try {
    const varPromise = wantVar ? processWithSecondaryApi(maintext, secondaryConfig) : Promise.resolve('');
    const beautifyPromise = wantBeautify ? processMaintextBeautification(maintext, secondaryConfig) : Promise.resolve(null);
    const [variableUpdate, beautifiedInner] = await Promise.all([varPromise, beautifyPromise]);

    console.log('✅ [gameFlow] 第二API 分支完成（变量 / 美化）');

    const mergedMaintext =
      beautifiedInner != null && String(beautifiedInner).trim().length > 0
        ? String(beautifiedInner).trim()
        : maintext;

    return buildMergedResponse(mergedMaintext, options, sum, variableUpdate || '');
  } catch (error) {
    console.error('❌ [gameFlow] 第二API处理失败，使用主API结果:', error);
    // 第二API失败时，返回主API结果（可能不包含变量更新）
    return mainResult;
  }
}

/**
 * 提取 maintext 标签内容
 */
function extractMaintext(text: string): string {
  return parseMaintext(text);
}

/**
 * 提取所有 option 标签内容
 */
function extractOptions(text: string): string {
  const opt = text.match(/<option[^>]*>[\s\S]*?<\/option>/gi) ?? [];
  const ch = text.match(/<choice[^>]*>[\s\S]*?<\/choice>/gi) ?? [];
  const merged = [...opt, ...ch];
  return merged.length ? merged.join('\n') : '';
}

/**
 * 提取 sum 标签内容
 */
function extractSum(text: string): string {
  return extractLastSumContent(text);
}

/**
 * 构建合并后的响应
 */
function buildMergedResponse(
  maintext: string,
  options: string,
  sum: string,
  variableUpdate: string,
): string {
  let result = `<maintext>${maintext}</maintext>\n\n`;

  if (options) {
    result += `${options}\n\n`;
  }

  if (sum) {
    result += `<sum>${sum}</sum>\n\n`;
  }

  if (variableUpdate) {
    result += `<UpdateVariable>${variableUpdate}</UpdateVariable>`;
  }

  return result.trim();
}

/**
 * 检查是否正在生成
 */
export function isGameGenerating(): boolean {
  return isGenerating;
}

/**
 * 获取当前生成ID
 */
export function getCurrentGenerationId(): string | null {
  return currentGenerationId;
}

/**
 * 解析变量命令（示例：/setvar name=value）
 * @param text 包含变量命令的文本
 */
export function parseVariableCommands(text: string): Array<{ name: string; value: string }> {
  const vars: Array<{ name: string; value: string }> = [];
  const regex = /\/setvar\s+(\w+)=(.+?)(?=\/setvar|$)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    vars.push({ name: match[1].trim(), value: match[2].trim() });
  }

  return vars;
}

/**
 * 执行变量命令
 * @param commands 变量命令数组
 */
export async function executeVariableCommands(commands: Array<{ name: string; value: string }>): Promise<void> {
  for (const cmd of commands) {
    try {
      // 尝试解析值为数字或布尔值
      let parsedValue: string | number | boolean = cmd.value;
      if (/^\d+$/.test(cmd.value)) {
        parsedValue = parseInt(cmd.value, 10);
      } else if (/^\d+\.\d+$/.test(cmd.value)) {
        parsedValue = parseFloat(cmd.value);
      } else if (cmd.value.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (cmd.value.toLowerCase() === 'false') {
        parsedValue = false;
      }

      if (typeof updateVariablesWith === 'function') {
        updateVariablesWith(vars => {
          if (!vars) vars = {};
          vars[cmd.name] = parsedValue;
          return vars;
        }, { type: 'chat' });
        console.log(`📊 [gameFlow] 设置变量: ${cmd.name} = ${parsedValue}`);
      }
    } catch (error) {
      console.error(`❌ [gameFlow] 设置变量失败: ${cmd.name}`, error);
    }
  }
}

// 导出类型
export type { ValidationResult, GameTurnResult, Option };
