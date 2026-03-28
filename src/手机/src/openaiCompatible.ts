import { normalizeApiBaseUrl } from './apiUrl';

/**
 * OpenAI 兼容：GET /v1/models
 * @see https://platform.openai.com/docs/api-reference/models/list
 */
export async function fetchOpenAiCompatibleModelIds(apiBaseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${normalizeApiBaseUrl(apiBaseUrl)}/models`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text ? `${res.status}: ${text.slice(0, 200)}` : `HTTP ${res.status}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text) as { data?: Array<{ id?: string }> };
  } catch {
    throw new Error('响应不是合法 JSON');
  }
  const list = data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : null;
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((m: { id?: string }) => (typeof m?.id === 'string' ? m.id : ''))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

/** 用 /v1/models 探测连通性与鉴权 */
export async function testOpenAiCompatibleConnection(
  apiBaseUrl: string,
  apiKey: string,
): Promise<ConnectionTestResult> {
  if (!apiBaseUrl.trim()) {
    return { ok: false, message: '请先填写 API URL' };
  }
  if (!apiKey.trim()) {
    return { ok: false, message: '请先填写 API Key' };
  }
  try {
    const models = await fetchOpenAiCompatibleModelIds(apiBaseUrl, apiKey);
    return {
      ok: true,
      message: `连接成功，已获取 ${models.length} 个模型`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return {
        ok: false,
        message: '网络失败（可能是 CORS：仅允许浏览器直连已配置跨域的 API）',
      };
    }
    return { ok: false, message: msg };
  }
}
