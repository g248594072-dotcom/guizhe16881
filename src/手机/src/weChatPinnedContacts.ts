import type { TavernPhoneWeChatContact } from './tavernPhoneBridge';
import { resolveChatScopeId } from './weChatScope';

/** 升级前：全局钉选（无聊天隔离）；首次按作用域读取时迁入当前 scope 并删除旧键 */
const LEGACY_PINNED_KEY = 'tavern-phone:wechat-pinned-contacts';

function storageKey(chatScopeId: string): string {
  const scope = resolveChatScopeId(chatScopeId);
  return `tavern-phone:wechat-pinned:${encodeURIComponent(scope)}`;
}

function parseStored(raw: string | null): TavernPhoneWeChatContact[] {
  if (!raw) {
    return [];
  }
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) {
      return [];
    }
    return arr.filter(
      (x): x is TavernPhoneWeChatContact =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as TavernPhoneWeChatContact).id === 'string' &&
        typeof (x as TavernPhoneWeChatContact).displayName === 'string',
    );
  } catch {
    return [];
  }
}

export function loadPinnedContacts(chatScopeId: string): TavernPhoneWeChatContact[] {
  try {
    const scoped = parseStored(localStorage.getItem(storageKey(chatScopeId)));
    if (scoped.length > 0) {
      return scoped;
    }
    const legacy = parseStored(localStorage.getItem(LEGACY_PINNED_KEY));
    if (legacy.length === 0) {
      return [];
    }
    savePinnedContacts(chatScopeId, legacy);
    try {
      localStorage.removeItem(LEGACY_PINNED_KEY);
    } catch {
      /* */
    }
    return legacy;
  } catch {
    return [];
  }
}

export function savePinnedContacts(chatScopeId: string, list: TavernPhoneWeChatContact[]): void {
  try {
    localStorage.setItem(storageKey(chatScopeId), JSON.stringify(list));
  } catch {
    /* */
  }
}

export function addPinnedContact(chatScopeId: string, contact: TavernPhoneWeChatContact): void {
  const cur = loadPinnedContacts(chatScopeId);
  const next = [...cur.filter(c => c.id !== contact.id), contact];
  savePinnedContacts(chatScopeId, next);
}

/** 会话列表：先应用壳返回的，再被手动添加的覆盖同 id */
export function mergeContactLists(
  fromServer: TavernPhoneWeChatContact[],
  pinned: TavernPhoneWeChatContact[],
): TavernPhoneWeChatContact[] {
  const m = new Map<string, TavernPhoneWeChatContact>();
  for (const c of fromServer) {
    m.set(c.id, c);
  }
  for (const c of pinned) {
    m.set(c.id, c);
  }
  return Array.from(m.values());
}
