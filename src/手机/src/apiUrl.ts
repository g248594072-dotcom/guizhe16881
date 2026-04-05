/**
 * 规范化 OpenAI 兼容 Base URL：补全协议、去掉末尾斜杠、若无 /v1 则追加。
 */
export function normalizeApiBaseUrl(raw: string | undefined | null): string {
  let u = String(raw || '').trim();
  if (!u) {
    return '';
  }
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  u = u.replace(/\/+$/, '');
  if (!/\/v1$/i.test(u)) {
    u = `${u}/v1`;
  }
  return u;
}
