const PREFIX = 'tavern-phone:wechat-thread:';

export type WeChatStoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: number;
};

export function threadStorageKey(contactId: string): string {
  return `${PREFIX}${encodeURIComponent(contactId)}`;
}

export function loadWeChatThreadByContactId(contactId: string): WeChatStoredMessage[] {
  try {
    const raw = localStorage.getItem(threadStorageKey(contactId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (m): m is WeChatStoredMessage =>
        m != null &&
        typeof m === 'object' &&
        typeof (m as WeChatStoredMessage).id === 'string' &&
        ((m as WeChatStoredMessage).role === 'user' || (m as WeChatStoredMessage).role === 'assistant') &&
        typeof (m as WeChatStoredMessage).content === 'string' &&
        typeof (m as WeChatStoredMessage).time === 'number',
    );
  } catch {
    return [];
  }
}

export function saveWeChatThreadByContactId(contactId: string, messages: WeChatStoredMessage[]): void {
  try {
    localStorage.setItem(threadStorageKey(contactId), JSON.stringify(messages));
  } catch {
    /* 存储满或禁用 */
  }
}
