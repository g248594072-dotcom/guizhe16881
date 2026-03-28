import type { TavernPhoneWeChatContact } from './tavernPhoneBridge';

const KEY = 'tavern-phone:wechat-pinned-contacts';

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

export function loadPinnedContacts(): TavernPhoneWeChatContact[] {
  try {
    return parseStored(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export function savePinnedContacts(list: TavernPhoneWeChatContact[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* */
  }
}

export function addPinnedContact(contact: TavernPhoneWeChatContact): void {
  const cur = loadPinnedContacts();
  const next = [...cur.filter(c => c.id !== contact.id), contact];
  savePinnedContacts(next);
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
