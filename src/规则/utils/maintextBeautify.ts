/**
 * 第二 API：正文 HTML 美化（generateRaw 短上下文），与变量更新并行或单独执行。
 */
import type { SecondaryApiConfig } from '../types';
import { MAIN_TEXT_BEAUTIFY_RULES } from './maintextBeautifyPrompt';
import { normalizeOpenAiUrl } from './openaiUrl';
import { traceWrappedGenerateRaw } from './generationTrace';

/** 与 apiSettings 中横幅事件名一致，便于 App.vue 统一监听 */
export const SECONDARY_API_BEAUTIFY_START_EVENT = 'rule-modifier-secondary-api-start' as const;

export const BEAUTIFY_SYSTEM_PROMPT =
  '你是正文展示层编辑：**以原文为主**，对少量字词做局部 span；是否插入 <htmlcontent> 以用户消息「## 本轮附属指令」为准，不得擅自增减；若生成 <htmlcontent>，块内**所有玩家可见文案须为简体中文**；不得改写事实、对白原句与顺序；不得删除或改写 <!-- … --> 注释；除 <BeautifiedMaintext> 外不要输出任何文字。';

/** 是否要求本回合生成 htmlcontent（每次美化调用独立 roll） */
export type BeautifyHtmlcontentDirective = 'include' | 'omit';

function clampHtmlcontentChancePercent(n: unknown): number {
  const x = Math.round(Number(n));
  if (Number.isNaN(x)) return 50;
  return Math.min(100, Math.max(0, x));
}

export function rollBeautifyHtmlcontentDirective(config: SecondaryApiConfig): BeautifyHtmlcontentDirective {
  const pct = clampHtmlcontentChancePercent(config.maintextBeautifyHtmlcontentChance);
  return Math.random() * 100 < pct ? 'include' : 'omit';
}

function buildSlotDirective(directive: BeautifyHtmlcontentDirective, chancePercent: number): string {
  if (directive === 'include') {
    return `## 本轮附属指令（设定几率 ${chancePercent}%：本轮抽中「生成小前端」，必须遵守）
- 本回合须输出**恰好一块** <htmlcontent>…</htmlcontent>，并**紧跟** <span class="th-ui-meta">（一句话 UI 氛围）</span>（meta 在 htmlcontent 标签外）。
- **小前端内全部玩家可见文字须为简体中文**（按钮、标题、说明等；禁止英文 UI 占位）。
- **插入位置**：夹在叙事**中间**某处（两段之间、关键句后、或前段与后段之间），由剧情节奏决定；**禁止**每回合机械地固定在全文最后一句之后。
- 块须全宽、浅字、可读；与当前段落弱相关或贴合描写，勿编造与正文矛盾的事实。`;
  }
  return `## 本轮附属指令（设定几率 ${chancePercent}%：本轮抽中「不生成小前端」，必须遵守）
- 本回合**禁止**输出任何 <htmlcontent> 或 </htmlcontent>；也**不要**单独输出仅用于 htmlcontent 配套的那类隐藏 meta span；仅允许叙事 <style> 与局部 span。`;
}

export function buildBeautifyUserPrompt(
  rawMaintext: string,
  htmlcontentDirective: BeautifyHtmlcontentDirective,
  chancePercent: number,
): string {
  const tail =
    htmlcontentDirective === 'include'
      ? '与（按指令）恰好一块载体界面（位置在正文中间或后段，勿固定总末尾）'
      : '（本轮无 htmlcontent 块）';
  return `${MAIN_TEXT_BEAUTIFY_RULES}

${buildSlotDirective(htmlcontentDirective, chancePercent)}

## 待美化正文
<OriginalMaintext>
${rawMaintext}
</OriginalMaintext>

只输出一对 <BeautifiedMaintext>...</BeautifiedMaintext>，不要其它说明。内层以**未改写的原文纯文本为骨架**，HTML 仅占少数点缀位${tail}。`;
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
  const result = await traceWrappedGenerateRaw(
    '第二API·正文美化·generateRaw（自定义URL）',
    genConfig as unknown as Record<string, unknown>,
    () => generateRaw(genConfig),
  );
  return String(result ?? '');
}

async function callBeautifyViaTavernPlug(userPrompt: string, _config: SecondaryApiConfig): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用，无法使用酒馆相同 API');
  }
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
  // 不设置 custom_api.model：与主插头当前模型一致
  const result = await traceWrappedGenerateRaw(
    '第二API·正文美化·generateRaw（酒馆插头）',
    genConfig as unknown as Record<string, unknown>,
    () => generateRaw(genConfig),
  );
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
  const chancePct = clampHtmlcontentChancePercent(config.maintextBeautifyHtmlcontentChance);
  const htmlDirective = rollBeautifyHtmlcontentDirective(config);
  console.info(`ℹ️ [maintextBeautify] 小前端几率 ${chancePct}% → 本轮: ${htmlDirective}`);
  const userPrompt = buildBeautifyUserPrompt(rawMaintext, htmlDirective, chancePct);
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
