import { LEGACY_SCOPE, LOCAL_OFFLINE_SCOPE, makeConversationId, parseConversationId } from './weChatScope';

const DB_NAME = 'tavern-phone-wechat';
const DB_VERSION = 1;
const STORE_THREADS = 'threads';

/** localStorage 旧键前缀（与历史 weChatStorage 一致） */
const LS_THREAD_PREFIX = 'tavern-phone:wechat-thread:';

const LS_MIGRATION_FLAG = 'tavern-phone:idb-v1-ls-imported';

export type WeChatStoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: number;
};

export type ThreadRecord = {
  conversationId: string;
  messages: WeChatStoredMessage[];
  updatedAt: number;
};

export type WeChatThreadExport = {
  roleId: string;
  conversationId: string;
  messages: WeChatStoredMessage[];
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error('IndexedDB open failed'));
      };
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_THREADS)) {
          db.createObjectStore(STORE_THREADS, { keyPath: 'conversationId' });
        }
      };
    });
  }
  return dbPromise;
}

function isValidMessage(m: unknown): m is WeChatStoredMessage {
  return (
    m != null &&
    typeof m === 'object' &&
    typeof (m as WeChatStoredMessage).id === 'string' &&
    ((m as WeChatStoredMessage).role === 'user' || (m as WeChatStoredMessage).role === 'assistant') &&
    typeof (m as WeChatStoredMessage).content === 'string' &&
    typeof (m as WeChatStoredMessage).time === 'number'
  );
}

export async function idbGetThread(conversationId: string): Promise<WeChatStoredMessage[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_THREADS, 'readonly');
      const req = tx.objectStore(STORE_THREADS).get(conversationId);
      req.onsuccess = () => {
        const row = req.result as ThreadRecord | undefined;
        const raw = row?.messages;
        if (!Array.isArray(raw)) {
          resolve([]);
          return;
        }
        resolve(raw.filter(isValidMessage));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** 列出当前聊天 scope 下（conversationId 前缀匹配）的全部微信线程 */
export async function idbExportThreadsForScope(chatScopeId: string): Promise<WeChatThreadExport[]> {
  const scope = (chatScopeId.trim() || LOCAL_OFFLINE_SCOPE).replace(/::/g, '_');
  const prefix = `${scope}::`;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: WeChatThreadExport[] = [];
    const tx = db.transaction(STORE_THREADS, 'readonly');
    const store = tx.objectStore(STORE_THREADS);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      const row = cursor.value as ThreadRecord;
      const cid = row?.conversationId;
      if (typeof cid === 'string' && cid.startsWith(prefix)) {
        const parsed = parseConversationId(cid);
        if (parsed) {
          const raw = row.messages;
          const messages = Array.isArray(raw) ? raw.filter(isValidMessage) : [];
          out.push({
            roleId: parsed.roleId,
            conversationId: cid,
            messages,
          });
        }
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutThread(conversationId: string, messages: WeChatStoredMessage[]): Promise<void> {
  const db = await openDb();
  const record: ThreadRecord = {
    conversationId,
    messages,
    updatedAt: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_THREADS, 'readwrite');
    tx.objectStore(STORE_THREADS).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 一次性：将旧版 localStorage 线程迁入 legacy::<roleId>，并清除对应 LS 键。
 */
export async function migrateLocalStorageThreadsOnce(): Promise<void> {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    if (localStorage.getItem(LS_MIGRATION_FLAG) === '1') {
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_THREAD_PREFIX)) {
        keys.push(k);
      }
    }
    for (const key of keys) {
      const suffix = key.slice(LS_THREAD_PREFIX.length);
      let contactId: string;
      try {
        contactId = decodeURIComponent(suffix);
      } catch {
        contactId = suffix;
      }
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) {
        continue;
      }
      const messages = parsed.filter(isValidMessage);
      const conv = makeConversationId(LEGACY_SCOPE, contactId);
      const existing = await idbGetThread(conv);
      if (existing.length === 0 && messages.length > 0) {
        await idbPutThread(conv, messages);
      }
      try {
        localStorage.removeItem(key);
      } catch {
        /* */
      }
    }
    try {
      localStorage.setItem(LS_MIGRATION_FLAG, '1');
    } catch {
      /* */
    }
  } catch {
    /* 迁移失败不阻塞；仍可用空线程 */
  }
}

/**
 * 若当前 scope 下尚无记录，则从 legacy::roleId 复制一份（便于从单机预览迁到真实聊天）
 */
export async function copyLegacyThreadIfTargetEmpty(
  chatScopeId: string,
  roleId: string,
): Promise<WeChatStoredMessage[]> {
  const target = makeConversationId(chatScopeId, roleId);
  const cur = await idbGetThread(target);
  if (cur.length > 0) {
    return cur;
  }
  const legacy = makeConversationId(LEGACY_SCOPE, roleId);
  const leg = await idbGetThread(legacy);
  if (leg.length === 0) {
    return [];
  }
  await idbPutThread(target, leg);
  return leg;
}
