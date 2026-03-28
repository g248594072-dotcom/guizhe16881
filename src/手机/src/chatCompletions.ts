import { normalizeApiBaseUrl } from './apiUrl';
import { getTavernPhoneApiConfig } from './tavernPhoneApiConfig';
import type { TavernPhoneContextPayload } from './tavernPhoneBridge';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function buildWeChatSystemPrompt(ctx: TavernPhoneContextPayload, options?: { regenerate?: boolean }): string {
  const cfg = getTavernPhoneApiConfig();
  const parts = [
    `你是「${ctx.displayName}」。用户正在通过微信与你进行简短文字聊天。`,
    `请用第一人称回复，语气自然、像真人发微信，每条消息简短（一两句为宜），不要长篇大论或Markdown。`,
    `【重要】你与酒馆主界面的「剧情扮演」是不同通道：即使下方出现主剧情节选，也仅供了解背景。回复时禁止模仿主界面的格式与元内容——不要输出 A/B/C 选项、不要输出 <patch> / JSONPatch / 任何 JSON 变量补丁、不要写第三人称小说旁白或规则说明；只发角色本人会打的微信文字。`,
  ];
  if (options?.regenerate) {
    parts.push('（本条为重新生成：请写完整、自然收尾，避免在句子中间结束。）');
  }
  if (ctx.personality.trim()) {
    parts.push(`【性格 / 人设】${ctx.personality}`);
  }
  if (ctx.thought.trim()) {
    parts.push(`【当前内心 / 心理活动】${ctx.thought}`);
  }
  if (cfg.injectMainStory !== false) {
    if (ctx.recentStorySnippet?.trim()) {
      parts.push(`【主剧情近况（节选）】\n${ctx.recentStorySnippet.trim()}`);
    }
    if (ctx.roleStorySummary?.trim()) {
      parts.push(`【档案中该角色的剧情摘要】\n${ctx.roleStorySummary.trim()}`);
    }
  }
  if (ctx.offline) {
    parts.push('（当前未连接到酒馆变量上下文，仅按人设即兴回复。）');
  }
  return parts.join('\n');
}

export function buildWeChatMessages(
  ctx: TavernPhoneContextPayload,
  history: { role: 'user' | 'assistant'; content: string }[],
  options?: { regenerate?: boolean },
): ChatMessage[] {
  const system = buildWeChatSystemPrompt(ctx, options);
  const out: ChatMessage[] = [{ role: 'system', content: system }];
  for (const m of history) {
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

async function fetchChatOnce(
  body: Record<string, unknown>,
  apiBaseUrl: string,
  apiKey: string,
): Promise<string> {
  const url = `${normalizeApiBaseUrl(apiBaseUrl)}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text ? `${res.status}: ${text.slice(0, 400)}` : `HTTP ${res.status}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
  } catch {
    throw new Error('响应不是合法 JSON');
  }
  const content = data && typeof data === 'object' && 'choices' in data ? data.choices?.[0]?.message?.content : undefined;
  if (typeof content !== 'string') {
    throw new Error('响应中无 assistant 正文');
  }
  return content.trim();
}

/**
 * 使用设置中的 OpenAI 兼容 API 发送一轮对话（含 system 人设）。
 */
export async function completeWeChatReply(
  ctx: TavernPhoneContextPayload,
  historyForApi: { role: 'user' | 'assistant'; content: string }[],
  options?: { regenerate?: boolean },
): Promise<string> {
  const cfg = getTavernPhoneApiConfig();
  if (!cfg.apiBaseUrl.trim() || !cfg.apiKey.trim() || !cfg.model.trim()) {
    throw new Error('请先在「设置」中填写 API URL、API Key 与模型');
  }
  const messages = buildWeChatMessages(ctx, historyForApi, options);
  const body = {
    model: cfg.model,
    messages,
    temperature: 0.85,
    /** 略增大以降低「说到一半被截断」的概率；重新生成时略再放宽 */
    max_tokens: options?.regenerate ? 896 : 768,
  };
  let lastErr: Error = new Error('未知错误');
  const tries = Math.max(1, cfg.maxRetries + 1);
  for (let i = 0; i < tries; i++) {
    try {
      return await fetchChatOnce(body, cfg.apiBaseUrl, cfg.apiKey);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr;
}

/**
 * 为写入聊天变量生成简短摘要（与 completeWeChatReply 共用同一套 API 配置）
 */
export async function summarizePhoneExchangeForMemory(
  lines: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const cfg = getTavernPhoneApiConfig();
  if (!cfg.apiBaseUrl.trim() || !cfg.apiKey.trim() || !cfg.model.trim()) {
    throw new Error('请先在「设置」中填写 API URL、API Key 与模型');
  }
  const tail = lines.slice(-16);
  const text = tail
    .map(m => `${m.role === 'user' ? '用户' : '对方'}: ${m.content}`)
    .join('\n');
  const body = {
    model: cfg.model,
    messages: [
      {
        role: 'system' as const,
        content:
          '你是剧情摘要助手。将以下微信风格对话压缩为 2～6 句中文，用于写入剧情记忆；客观叙述当前关系与事件，不要复述「用户/对方」前缀，不要加引号。',
      },
      { role: 'user' as const, content: text },
    ],
    temperature: 0.35,
    max_tokens: 400,
  };
  let lastErr: Error = new Error('未知错误');
  const tries = Math.max(1, cfg.maxRetries + 1);
  for (let i = 0; i < tries; i++) {
    try {
      return await fetchChatOnce(body, cfg.apiBaseUrl, cfg.apiKey);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr;
}
