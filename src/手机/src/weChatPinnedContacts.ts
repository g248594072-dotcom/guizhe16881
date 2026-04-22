import type { TavernPhoneWeChatContact } from './tavernPhoneBridge';
import type { PhoneCharacterArchive } from './characterArchive/bridge';
import { resolveChatScopeId } from './weChatScope';

/** 与微信「从变量添加」一致：供其它模块在分析完成后钉选联系人 */
export const PHONE_WECHAT_PINNED_CHANGED = 'phone-wechat-pinned-changed';

function personalityRecordToString(p: Record<string, string>): string {
  return Object.entries(p)
    .filter(([, v]) => typeof v === 'string' && String(v).trim())
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join('\n');
}

/** 将档案列表项转为微信联系人（不含壳侧 stCharacterName，与手动添加时一致由上下文合并） */
export function phoneArchiveToWeChatContact(archive: PhoneCharacterArchive): TavernPhoneWeChatContact {
  return {
    id: archive.id,
    displayName: archive.name,
    avatarUrl: archive.avatarUrl?.trim() || undefined,
    personality: personalityRecordToString(archive.personality),
    thought: String(archive.currentThought ?? '').trim(),
  };
}

/**
 * 将尚未出现在钉选中的角色加入当前聊天的微信会话列表（不触发分析）。
 * @returns 新钉选人数
 */
export function pinArchivesToWeChatIfMissing(chatScopeId: string, archives: PhoneCharacterArchive[]): number {
  const scope = resolveChatScopeId(chatScopeId);
  const cur = loadPinnedContacts(scope);
  const existing = new Set(cur.map(c => c.id));
  let n = 0;
  for (const a of archives) {
    if (existing.has(a.id)) continue;
    addPinnedContact(scope, phoneArchiveToWeChatContact(a));
    existing.add(a.id);
    n++;
  }
  if (n > 0) {
    window.dispatchEvent(new CustomEvent(PHONE_WECHAT_PINNED_CHANGED, { detail: { scope } }));
  }
  return n;
}

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

/**
 * 会话列表以本地钉选为准；从头像角度不从壳上下文合并 URL（微信只认本机 tavern-phone:character-avatars）。
 * 仍会补全 stCharacterName 等便于壳侧其它逻辑。
 */
export function mergePinnedWithContextAvatars(
  pinned: TavernPhoneWeChatContact[],
  fromContext: TavernPhoneWeChatContact[],
): TavernPhoneWeChatContact[] {
  if (fromContext.length === 0) {
    return pinned;
  }
  const byId = new Map(fromContext.map(c => [c.id, c]));
  return pinned.map(p => {
    const s = byId.get(p.id);
    if (!s) {
      return p;
    }
    const next = { ...p };
    if (!next.stCharacterName?.trim() && s.stCharacterName?.trim()) {
      next.stCharacterName = s.stCharacterName;
    }
    return next;
  });
}
