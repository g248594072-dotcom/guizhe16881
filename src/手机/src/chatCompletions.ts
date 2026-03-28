import { normalizeApiBaseUrl } from './apiUrl';
import { getTavernPhoneApiConfig } from './tavernPhoneApiConfig';
import type { TavernPhoneContextPayload } from './tavernPhoneBridge';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function buildWeChatSystemPrompt(ctx: TavernPhoneContextPayload): string {
  const parts = [
    `你是「${ctx.displayName}」。用户正在通过微信与你进行简短文字聊天。`,
    `请用第一人称回复，语气自然、像真人发微信，每条消息简短（一两句为宜），不要长篇大论或Markdown。`,
  ];
  if (ctx.personality.trim()) {
    parts.push(`【性格 / 人设】${ctx.personality}`);
  }
  if (ctx.thought.trim()) {
    parts.push(`【当前内心 / 心理活动】${ctx.thought}`);
  }
  if (ctx.offline) {
    parts.push('（当前未连接到酒馆变量上下文，仅按人设即兴回复。）');
  }
  return parts.join('\n');
}

export function buildWeChatMessages(
  ctx: TavernPhoneContextPayload,
  history: { role: 'user' | 'assistant'; content: string }[],
): ChatMessage[] {
  const system = buildWeChatSystemPrompt(ctx);
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
): Promise<string> {
  const cfg = getTavernPhoneApiConfig();
  if (!cfg.apiBaseUrl.trim() || !cfg.apiKey.trim() || !cfg.model.trim()) {
    throw new Error('请先在「设置」中填写 API URL、API Key 与模型');
  }
  const messages = buildWeChatMessages(ctx, historyForApi);
  const body = {
    model: cfg.model,
    messages,
    temperature: 0.85,
    max_tokens: 512,
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
