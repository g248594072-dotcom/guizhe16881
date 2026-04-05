/**
 * 朋友圈存储模块
 * 【角色朋友圈】的 IndexedDB 存储管理
 */

import type {
  Moment,
  MomentComment,
  MomentCharacterMeta,
  MomentsGlobalSettings,
} from './types/moments';

const DB_NAME = 'tavern-phone-moments';
const DB_VERSION = 1;
const STORE_MOMENTS = 'moments';
const STORE_COMMENTS = 'comments';
const STORE_META = 'meta';
const STORE_SETTINGS = 'settings';

/** 全局设置键名 */
const GLOBAL_SETTINGS_KEY = 'global';

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

        // 动态表
        if (!db.objectStoreNames.contains(STORE_MOMENTS)) {
          const store = db.createObjectStore(STORE_MOMENTS, { keyPath: 'id' });
          store.createIndex('characterId', 'characterId', { unique: false });
          store.createIndex('gameDate', 'gameDate', { unique: false });
          store.createIndex('contentType', 'contentType', { unique: false });
          store.createIndex('visibility', 'visibility', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 评论表
        if (!db.objectStoreNames.contains(STORE_COMMENTS)) {
          const store = db.createObjectStore(STORE_COMMENTS, { keyPath: 'id' });
          store.createIndex('momentId', 'momentId', { unique: false });
          store.createIndex('authorId', 'authorId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 元数据表
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'characterId' });
        }

        // 全局设置表
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

// ==================== 动态操作 ====================

/**
 * 保存动态
 */
export async function saveMoment(moment: Moment): Promise<Moment> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MOMENTS, 'readwrite');
    const store = tx.objectStore(STORE_MOMENTS);
    const req = store.put(moment);
    req.onsuccess = () => resolve(moment);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取所有动态（按时间倒序）
 * 注意：这只是原始查询，可见性过滤需要在业务层处理
 */
export async function getAllMoments(limit = 50): Promise<Moment[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MOMENTS, 'readonly');
    const store = tx.objectStore(STORE_MOMENTS);
    const index = store.index('createdAt');
    const req = index.openCursor(null, 'prev');
    const results: Moment[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || results.length >= limit) {
        resolve(results);
        return;
      }
      results.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取指定角色的所有动态
 */
export async function getMomentsByCharacter(characterId: string): Promise<Moment[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MOMENTS, 'readonly');
    const store = tx.objectStore(STORE_MOMENTS);
    const index = store.index('characterId');
    const req = index.getAll(characterId);
    req.onsuccess = () => {
      const results = req.result as Moment[];
      // 按时间倒序
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 根据ID获取动态
 */
export async function getMomentById(id: string): Promise<Moment | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MOMENTS, 'readonly');
    const store = tx.objectStore(STORE_MOMENTS);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 删除动态
 */
export async function deleteMoment(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MOMENTS, 'readwrite');
    const store = tx.objectStore(STORE_MOMENTS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 标记动态为已读（更新isLiked状态为false表示已查看）
 * 实际上朋友圈没有"已读"概念，这里用 isRead 字段
 */
export async function markMomentAsRead(id: string): Promise<void> {
  const moment = await getMomentById(id);
  if (!moment) return;
  // 朋友圈没有已读状态，这里只是占位
  // 实际可以添加一个 viewedBy 数组来追踪谁看过
}

// ==================== 评论操作 ====================

/**
 * 添加评论
 */
export async function addComment(comment: MomentComment): Promise<MomentComment> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_COMMENTS, STORE_MOMENTS], 'readwrite');
    const commentStore = tx.objectStore(STORE_COMMENTS);
    const momentStore = tx.objectStore(STORE_MOMENTS);

    // 保存评论
    const req = commentStore.put(comment);
    req.onsuccess = () => {
      // 更新动态的评论数
      const momentReq = momentStore.get(comment.momentId);
      momentReq.onsuccess = () => {
        const moment = momentReq.result as Moment;
        if (moment) {
          moment.comments = moment.comments || [];
          moment.comments.push(comment);
          momentStore.put(moment);
        }
      };
      resolve(comment);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取动态的所有评论
 */
export async function getCommentsByMoment(momentId: string): Promise<MomentComment[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COMMENTS, 'readonly');
    const store = tx.objectStore(STORE_COMMENTS);
    const index = store.index('momentId');
    const req = index.getAll(momentId);
    req.onsuccess = () => {
      const results = req.result as MomentComment[];
      // 按时间正序（旧的在前面）
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 删除评论
 */
export async function deleteComment(commentId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COMMENTS, 'readwrite');
    const store = tx.objectStore(STORE_COMMENTS);
    const req = store.delete(commentId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ==================== 点赞操作 ====================

/**
 * 切换点赞状态
 */
export async function toggleLike(
  momentId: string,
  characterId: string,
  characterName: string
): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MOMENTS, 'readwrite');
    const store = tx.objectStore(STORE_MOMENTS);
    const req = store.get(momentId);
    req.onsuccess = () => {
      const moment = req.result as Moment;
      if (!moment) {
        reject(new Error('Moment not found'));
        return;
      }

      moment.likes = moment.likes || [];
      const existingIndex = moment.likes.findIndex(l => l.characterId === characterId);

      if (existingIndex >= 0) {
        // 取消点赞
        moment.likes.splice(existingIndex, 1);
      } else {
        // 添加点赞
        moment.likes.push({
          characterId,
          characterName,
          timestamp: Date.now(),
        });
      }

      const putReq = store.put(moment);
      putReq.onsuccess = () => resolve(existingIndex < 0);
      putReq.onerror = () => reject(putReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

// ==================== 元数据操作 ====================

/**
 * 获取角色元数据
 */
export async function getMomentMeta(characterId: string): Promise<MomentCharacterMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.get(characterId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 更新角色元数据
 */
export async function updateMomentMeta(meta: MomentCharacterMeta): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const req = store.put(meta);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 初始化角色元数据（如果不存在）
 */
export async function initMomentMeta(characterId: string): Promise<MomentCharacterMeta> {
  const existing = await getMomentMeta(characterId);
  if (existing) return existing;

  const newMeta: MomentCharacterMeta = {
    characterId,
    autoGenerateEnabled: true,
    lastGeneratedAt: 0,
    lastGeneratedGameDate: '',
    defaultVisibility: 'friends_only',
    triggerIntervalMessages: 5 + Math.floor(Math.random() * 6), // 5-10
    triggerIntervalMinutes: 120 + Math.floor(Math.random() * 121), // 2-4小时
  };

  await updateMomentMeta(newMeta);
  return newMeta;
}

/**
 * 更新最后生成日期
 */
export async function updateLastGeneratedDate(characterId: string, gameDate: string): Promise<void> {
  const meta = await getMomentMeta(characterId) || await initMomentMeta(characterId);
  meta.lastGeneratedAt = Date.now();
  meta.lastGeneratedGameDate = gameDate;
  await updateMomentMeta(meta);
}

/**
 * 切换自动生成设置
 */
export async function toggleAutoGenerate(characterId: string, enabled: boolean): Promise<void> {
  const meta = await getMomentMeta(characterId) || await initMomentMeta(characterId);
  meta.autoGenerateEnabled = enabled;
  await updateMomentMeta(meta);
}

// ==================== 全局设置操作 ====================

/** 默认全局设置 */
const defaultGlobalSettings: MomentsGlobalSettings = {
  autoGenerateEnabled: true,
  defaultContentTypes: ['daily_life', 'venting', 'dark_thought'],
  intervalMessages: { min: 5, max: 10 },      // 5-10条消息
  intervalGameMinutes: { min: 120, max: 240 }, // 2-4小时（120-240分钟）
  enableMessageTrigger: true,
  enableGameTimeTrigger: true,
};

/**
 * 获取全局设置
 */
export async function getMomentsGlobalSettings(): Promise<MomentsGlobalSettings> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);
    const req = store.get(GLOBAL_SETTINGS_KEY);
    req.onsuccess = () => {
      const settings = req.result as MomentsGlobalSettings | undefined;
      if (settings) {
        // 合并默认设置，确保新字段存在
        resolve({ ...defaultGlobalSettings, ...settings });
      } else {
        resolve({ ...defaultGlobalSettings });
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 保存全局设置
 */
export async function saveMomentsGlobalSettings(settings: MomentsGlobalSettings): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    const req = store.put({ ...settings, key: GLOBAL_SETTINGS_KEY });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ==================== 统计查询 ====================

/**
 * 获取未读动态计数
 * 这里简单返回所有动态数（因为朋友圈没有已读状态）
 */
export async function getUnreadMomentCount(): Promise<number> {
  const moments = await getAllMoments(1000);
  return moments.length;
}

/**
 * 检查是否应该自动生成动态
 */
export async function shouldAutoGenerateMoment(
  characterId: string,
  currentGameDate: string
): Promise<boolean> {
  const meta = await getMomentMeta(characterId);
  if (!meta || !meta.autoGenerateEnabled) return false;

  // 检查是否已生成过今天的动态
  if (meta.lastGeneratedGameDate === currentGameDate) {
    return false;
  }

  return true;
}

/**
 * 获取最新的动态
 */
export async function getLatestMoment(): Promise<Moment | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MOMENTS, 'readonly');
    const store = tx.objectStore(STORE_MOMENTS);
    const index = store.index('createdAt');
    const req = index.openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        resolve(cursor.value);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
