/**
 * 群聊列表 IndexedDB 存储
 * 将群聊会话列表从 localStorage 迁移到 IndexedDB，确保按 chatScopeId 正确隔离和持久化
 */

import { LOCAL_OFFLINE_SCOPE } from './weChatScope';
import type { GroupChatSession, GroupChatListData } from './groupChat';

const DB_NAME = 'tavern-phone-groupchat';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_LIST_META = 'listMeta';

/** 群聊列表元数据存储类型 */
type GroupChatListRecord = {
  chatScopeId: string;
  data: GroupChatListData;
  updatedAt: number;
};

/** localStorage 旧键前缀 */
const LS_LEGACY_PREFIX = 'tavern_phone_group_chat_list:';

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
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_LIST_META)) {
          db.createObjectStore(STORE_LIST_META, { keyPath: 'chatScopeId' });
        }
      };
    });
  }
  return dbPromise;
}

/**
 * 从 localStorage 迁移旧数据到 IndexedDB
 */
async function migrateFromLocalStorage(): Promise<void> {
  try {
    const db = await openDb();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_LEGACY_PREFIX)) {
        const chatScopeId = key.slice(LS_LEGACY_PREFIX.length);
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data) as GroupChatListData;
            // 迁移到 IndexedDB
            await idbSaveGroupChatList(chatScopeId, parsed);
            keysToRemove.push(key);
          } catch {
            // ignore parse error
          }
        }
      }
    }

    // 清除已迁移的旧数据
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    if (keysToRemove.length > 0) {
      console.info('[GroupChatIndexedDB] 已从 localStorage 迁移', keysToRemove.length, '个群聊列表');
    }
  } catch (e) {
    console.warn('[GroupChatIndexedDB] 迁移失败:', e);
  }
}

/**
 * 加载指定 chatScopeId 下的群聊列表
 */
export async function idbLoadGroupChatList(chatScopeId: string): Promise<GroupChatListData> {
  await migrateFromLocalStorage();

  const scopeId = (chatScopeId.trim() || LOCAL_OFFLINE_SCOPE).replace(/::/g, '_');

  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LIST_META, 'readonly');
      const req = tx.objectStore(STORE_LIST_META).get(scopeId);
      req.onsuccess = () => {
        const record = req.result as GroupChatListRecord | undefined;
        if (record?.data && typeof record.data === 'object') {
          resolve({
            version: record.data.version || 1,
            sessions: Array.isArray(record.data.sessions) ? record.data.sessions : [],
            currentSessionId: record.data.currentSessionId ?? null,
          });
        } else {
          resolve({
            version: 1,
            sessions: [],
            currentSessionId: null,
          });
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('[GroupChatIndexedDB] 加载失败:', e);
    return {
      version: 1,
      sessions: [],
      currentSessionId: null,
    };
  }
}

/**
 * 保存指定 chatScopeId 下的群聊列表
 */
export async function idbSaveGroupChatList(
  chatScopeId: string,
  data: GroupChatListData,
): Promise<void> {
  const scopeId = (chatScopeId.trim() || LOCAL_OFFLINE_SCOPE).replace(/::/g, '_');

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LIST_META, 'readwrite');
      const record: GroupChatListRecord = {
        chatScopeId: scopeId,
        data,
        updatedAt: Date.now(),
      };
      const req = tx.objectStore(STORE_LIST_META).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('[GroupChatIndexedDB] 保存失败:', e);
  }
}

/**
 * 导出所有群聊会话（用于世界书同步）
 */
export async function idbExportAllGroupChatSessions(
  chatScopeId: string,
): Promise<GroupChatSession[]> {
  const data = await idbLoadGroupChatList(chatScopeId);
  return data.sessions || [];
}

/**
 * 删除指定 chatScopeId 下的群聊列表
 */
export async function idbDeleteGroupChatList(chatScopeId: string): Promise<void> {
  const scopeId = (chatScopeId.trim() || LOCAL_OFFLINE_SCOPE).replace(/::/g, '_');

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LIST_META, 'readwrite');
      const req = tx.objectStore(STORE_LIST_META).delete(scopeId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('[GroupChatIndexedDB] 删除失败:', e);
  }
}
