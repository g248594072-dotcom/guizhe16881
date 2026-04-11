/**
 * 第二 API：正文 HTML 美化（generateRaw 短上下文），与变量更新并行或单独执行。
 */
import type { SecondaryApiConfig } from '../types';
import { MAIN_TEXT_BEAUTIFY_RULES } from './maintextBeautifyPrompt';
import { normalizeOpenAiUrl } from './openAiUrl';

/** 与 apiSettings 中横幅事件名一致，便于 App.vue 统一监听 */
export const SECONDARY_API_BEAUTIFY_START_EVENT = 'rule-modifier-secondary-api-start' as const;

export const BEAUTIFY_SYSTEM_PROMPT =
  '你是正文展示层编辑：**以原文为主**，对少量字词做局部 span 强调；**当前测试阶段**每轮须在正文后追加一块简短 <htmlcontent> 小前端；不得改写事实、对白原句与顺序；不得删除或改写 <!-- … --> 注释；除 <BeautifiedMaintext> 外不要输出任何文字。';

export function buildBeautifyUserPrompt(rawMaintext: string): string {
  return `${MAIN_TEXT_BEAUTIFY_RULES}

## 待美化正文
<OriginalMaintext>
${rawMaintext}
</OriginalMaintext>

只输出一对 <BeautifiedMaintext>...</BeautifiedMaintext>，不要其它说明。内层须以**未改写的原文纯文本为骨架**，HTML 仅占少数点缀位与（若有）一块载体界面。`;
}

export function extractBeautifiedMaintext(response: string): string | null {
  const m = String(response || '').match(/<BeautifiedMaintext>([\s\S]*?)<\/BeautifiedMaintext>/i);
  if (!m) return null;
  const inner = m[1].trim();
  return inner.length > 0 ? inner : null;
}

function clampRetries(n: unknown): number {
  const x = Math.floor(Number(n));
  if (Number.isNaN(x)) return 2;
  return Math.min(10, Math.max(0, x));
}

/** 已含载体块等则跳过二次美化，避免套层 */
export function shouldSkipMaintextBeautification(rawMaintext: string): boolean {
  const t = String(rawMaintext || '').trim();
  if (!t) return true;
  const l = t.toLowerCase();
  if (l.includes('<htmlcontent>')) return true;
  if (l.includes('<beautifiedmaintext>')) return true;
  return false;
}

async function callBeautifyGenerateRawCustom(
  userPrompt: string,
  config: SecondaryApiConfig,
): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用');
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
      { role: 'system', content: BEAUTIFY_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
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

async function callBeautifyViaTavernPlug(userPrompt: string, config: SecondaryApiConfig): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用，无法使用酒馆相同 API');
  }
  const modelTrim = String(config.model || '').trim();
  const genConfig: Parameters<typeof generateRaw>[0] = {
    user_input: '',
    should_stream: false,
    should_silence: true,
    max_chat_history: 0,
    automatic_trigger: true,
    ordered_prompts: [
      { role: 'system', content: BEAUTIFY_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  };
  if (modelTrim) {
    genConfig.custom_api = { model: modelTrim };
  }
  const result = await generateRaw(genConfig);
  return String(result ?? '');
}

/**
 * 调用第二路模型，将原始 maintext 转为 HTML 内层；失败返回 null（调用方使用原文）。
 */
export async function processMaintextBeautification(
  rawMaintext: string,
  config: SecondaryApiConfig,
): Promise<string | null> {
  if (!config.tasks?.includeMaintextBeautification) {
    return null;
  }
  if (shouldSkipMaintextBeautification(rawMaintext)) {
    console.info('ℹ️ [maintextBeautify] 跳过美化（正文已含 htmlcontent 等）');
    return null;
  }

  const retryCount = clampRetries(config.maxRetries);
  const maxAttempts = 1 + retryCount;
  const userPrompt = buildBeautifyUserPrompt(rawMaintext);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(SECONDARY_API_BEAUTIFY_START_EVENT, { detail: { attempt: attempt + 1, task: 'beautify' } }),
        );
      }

      const response = config.useTavernMainConnection
        ? await callBeautifyViaTavernPlug(userPrompt, config)
        : await callBeautifyGenerateRawCustom(userPrompt, config);

      const extracted = extractBeautifiedMaintext(response);
      if (extracted) {
        console.info('✅ [maintextBeautify] 已解析 BeautifiedMaintext');
        return extracted;
      }
      throw new Error('响应中未找到 <BeautifiedMaintext> 标签');
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ [maintextBeautify] 调用失败 (尝试 ${attempt + 1}/${maxAttempts}):`, error);
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  console.error('❌ [maintextBeautify] 美化失败，使用原文:', lastError?.message);
  return null;
}
