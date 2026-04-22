/**
 * 小手机「AI 请求调试」：由 chatCompletions 在每次直连完成后派发，由界面层弹窗展示。
 */

export const PHONE_AI_DEBUG_TRAFFIC_EVENT = 'phone-ai-debug-traffic';

/** 单次 chat/completions 的调试快照（不含 API Key） */
export type PhoneAiDebugTrafficDetail = {
  at: number;
  requestUrl: string;
  /** 与发往接口的 JSON body 一致（messages / model / temperature / max_tokens 等） */
  requestPayload: Record<string, unknown>;
  /** 接口返回的原始文本（可能为 JSON 或错误 HTML） */
  rawResponseText: string;
  /** 从 choices[0].message.content 解析出的正文 */
  assistantContent: string;
  httpOk: boolean;
  httpStatus: number;
  errorMessage?: string;
};

export function emitPhoneAiDebugTraffic(detail: PhoneAiDebugTrafficDetail): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(PHONE_AI_DEBUG_TRAFFIC_EVENT, { detail }));
}
