/**
 * 日记存储模块
 * 用于存储和管理角色的私密日记条目
 */

const DB_NAME = 'tavern-phone-diary';
const DB_VERSION = 2; // 升级到v2添加全局设置表
const STORE_DIARIES = 'diaries';
const STORE_META = 'meta';
const STORE_SETTINGS = 'settings';

/** 本地离线 scope */
const LOCAL_OFFLINE_SCOPE = 'local-offline';

/** 全局设置键名 */
const GLOBAL_SETTINGS_KEY = 'global';

export interface DiaryEntry {
  id: string;
  characterId: string;
  characterName: string;
  /** 日记日期（游戏内日期） */
  gameDate: string;
  /** 实际创建时间戳 */
  createdAt: number;
  /** 日记标题 */
  title: string;
  /** 日记内容（最私密的心理活动） */
  content: string;
  /** 情绪标签 */
  moodTags: string[];
  /** 是否已读 */
  isRead: boolean;
}

/** 元数据：记录每个角色上次生成日记的游戏日期 */
interface DiaryMeta {
  characterId: string;
  lastGeneratedGameDate: string;
  lastGeneratedAt: number;
  autoGenerateEnabled: boolean;
}

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
        if (!db.objectStoreNames.contains(STORE_DIARIES)) {
          const store = db.createObjectStore(STORE_DIARIES, { keyPath: 'id' });
          store.createIndex('characterId', 'characterId', { unique: false });
          store.createIndex('gameDate', 'gameDate', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'characterId' });
        }
        // v2: 添加全局设置表
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
    });
  }
  return dbPromise;
}

/** 生成唯一ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 保存日记条目
 */
export async function saveDiary(entry: Omit<DiaryEntry, 'id' | 'createdAt'>): Promise<DiaryEntry> {
  const db = await openDb();
  const fullEntry: DiaryEntry = {
    ...entry,
    id: generateId(),
    createdAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_DIARIES, 'readwrite');
    tx.objectStore(STORE_DIARIES).put(fullEntry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return fullEntry;
}

/**
 * 获取角色的所有日记（按时间倒序）
 */
export async function getDiariesByCharacter(characterId: string): Promise<DiaryEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: DiaryEntry[] = [];
    const tx = db.transaction(STORE_DIARIES, 'readonly');
    const store = tx.objectStore(STORE_DIARIES);
    const index = store.index('characterId');
    const range = IDBKeyRange.only(characterId);
    const req = index.openCursor(range, 'prev');

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push(cursor.value as DiaryEntry);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取所有日记（按时间倒序）
 */
export async function getAllDiaries(): Promise<DiaryEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: DiaryEntry[] = [];
    const tx = db.transaction(STORE_DIARIES, 'readonly');
    const store = tx.objectStore(STORE_DIARIES);
    const req = store.openCursor(null, 'prev');

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push(cursor.value as DiaryEntry);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 标记日记为已读
 */
export async function markDiaryAsRead(diaryId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DIARIES, 'readwrite');
    const store = tx.objectStore(STORE_DIARIES);
    const req = store.get(diaryId);

    req.onsuccess = () => {
      const entry = req.result as DiaryEntry | undefined;
      if (entry) {
        entry.isRead = true;
        store.put(entry);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 删除日记
 */
export async function deleteDiary(diaryId: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_DIARIES, 'readwrite');
    tx.objectStore(STORE_DIARIES).delete(diaryId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取角色的元数据
 */
export async function getDiaryMeta(characterId: string): Promise<DiaryMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(characterId);
    req.onsuccess = () => {
      const result = req.result as DiaryMeta | undefined;
      resolve(result ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 保存角色的元数据
 */
export async function saveDiaryMeta(meta: DiaryMeta): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 检查今天是否需要自动生成日记
 * @param characterId 角色ID
 * @param currentGameDate 当前游戏日期
 * @returns 是否需要生成
 */
export async function shouldAutoGenerateDiary(
  characterId: string,
  currentGameDate: string,
): Promise<boolean> {
  const meta = await getDiaryMeta(characterId);
  if (!meta?.autoGenerateEnabled) {
    return false;
  }
  return meta.lastGeneratedGameDate !== currentGameDate;
}

/**
 * 更新上次生成日期
 */
export async function updateLastGeneratedDate(
  characterId: string,
  gameDate: string,
): Promise<void> {
  const meta = await getDiaryMeta(characterId);
  const newMeta: DiaryMeta = {
    characterId,
    lastGeneratedGameDate: gameDate,
    lastGeneratedAt: Date.now(),
    autoGenerateEnabled: meta?.autoGenerateEnabled ?? true,
  };
  await saveDiaryMeta(newMeta);
}

/**
 * 切换自动生成功能
 */
export async function toggleAutoGenerate(characterId: string, enabled: boolean): Promise<void> {
  const meta = await getDiaryMeta(characterId);
  const newMeta: DiaryMeta = {
    characterId,
    lastGeneratedGameDate: meta?.lastGeneratedGameDate ?? '',
    lastGeneratedAt: meta?.lastGeneratedAt ?? 0,
    autoGenerateEnabled: enabled,
  };
  await saveDiaryMeta(newMeta);
}

/**
 * 获取未读日记数量
 */
export async function getUnreadDiaryCount(): Promise<number> {
  const all = await getAllDiaries();
  return all.filter(d => !d.isRead).length;
}

// ==================== 全局自动更新设置 ====================

/** 全局自动更新设置 */
export interface DiaryGlobalSettings {
  key: 'global';
  /** 自动更新是否启用 */
  autoUpdateEnabled: boolean;
  /** 间隔天数（1-30天） */
  intervalDays: number;
  /** 上次检查的游戏日期 */
  lastCheckedGameDate: string;
  /** 最后更新时间戳 */
  updatedAt: number;
}

/**
 * 获取全局设置
 */
export async function getDiaryGlobalSettings(): Promise<DiaryGlobalSettings> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).get(GLOBAL_SETTINGS_KEY);
    req.onsuccess = () => {
      const result = req.result as DiaryGlobalSettings | undefined;
      resolve(result ?? {
        key: 'global',
        autoUpdateEnabled: false,
        intervalDays: 1,
        lastCheckedGameDate: '',
        updatedAt: 0,
      });
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 保存全局设置
 */
export async function saveDiaryGlobalSettings(settings: Omit<DiaryGlobalSettings, 'key' | 'updatedAt'>): Promise<void> {
  const db = await openDb();
  const fullSettings: DiaryGlobalSettings = {
    ...settings,
    key: 'global',
    updatedAt: Date.now(),
  };
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put(fullSettings);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 切换自动更新功能
 */
export async function toggleAutoUpdate(enabled: boolean): Promise<void> {
  const settings = await getDiaryGlobalSettings();
  await saveDiaryGlobalSettings({
    ...settings,
    autoUpdateEnabled: enabled,
  });
}

/**
 * 设置更新间隔天数
 */
export async function setAutoUpdateIntervalDays(days: number): Promise<void> {
  const settings = await getDiaryGlobalSettings();
  await saveDiaryGlobalSettings({
    ...settings,
    intervalDays: Math.max(1, Math.min(30, days)),
  });
}

/**
 * 更新最后检查日期
 */
export async function updateLastCheckedDate(gameDate: string): Promise<void> {
  const settings = await getDiaryGlobalSettings();
  await saveDiaryGlobalSettings({
    ...settings,
    lastCheckedGameDate: gameDate,
  });
}

/**
 * 清空所有日记数据（用于重置）
 */
export async function clearAllDiaries(): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_DIARIES, STORE_META], 'readwrite');
    tx.objectStore(STORE_DIARIES).clear();
    tx.objectStore(STORE_META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
