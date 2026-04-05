/**
 * 新闻存储模块
 * 【现实世界记者新闻系统】的 IndexedDB 存储管理
 * 
 * 简化设计：只存储文章和全局设置（新闻无需评论功能）
 */

import type {
  NewsArticle,
  NewsGlobalSettings,
  NewsMeta,
  NewsCategory,
} from './types/news';

const DB_NAME = 'tavern-phone-news';
const DB_VERSION = 1;
const STORE_ARTICLES = 'articles';
const STORE_SETTINGS = 'settings';
const STORE_META = 'meta';

/** 全局设置键名 */
const GLOBAL_SETTINGS_KEY = 'global';
const META_KEY = 'meta';

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

        // 文章表
        if (!db.objectStoreNames.contains(STORE_ARTICLES)) {
          const store = db.createObjectStore(STORE_ARTICLES, { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('gameDate', 'gameDate', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('isRead', 'isRead', { unique: false });
          store.createIndex('triggerSource', 'triggerSource', { unique: false });
        }

        // 全局设置表
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }

        // 元数据表
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
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

// ==================== 文章操作 ====================

/**
 * 保存新闻文章
 */
export async function saveNewsArticle(
  article: Omit<NewsArticle, 'id' | 'createdAt' | 'views' | 'isRead'>,
): Promise<NewsArticle> {
  const db = await openDb();
  const fullArticle: NewsArticle = {
    ...article,
    id: generateId(),
    createdAt: Date.now(),
    views: 0,
    isRead: false,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readwrite');
    tx.objectStore(STORE_ARTICLES).put(fullArticle);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 更新元数据
  await updateMetaAfterAdd();

  return fullArticle;
}

/**
 * 批量保存新闻文章
 */
export async function saveNewsArticles(
  articles: Array<Omit<NewsArticle, 'id' | 'createdAt' | 'views' | 'isRead'>>,
): Promise<NewsArticle[]> {
  const db = await openDb();
  const fullArticles: NewsArticle[] = articles.map(article => ({
    ...article,
    id: generateId(),
    createdAt: Date.now(),
    views: 0,
    isRead: false,
  }));

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readwrite');
    const store = tx.objectStore(STORE_ARTICLES);
    fullArticles.forEach(article => store.put(article));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 更新元数据
  await updateMetaAfterAdd();

  return fullArticles;
}

/**
 * 获取所有新闻文章
 */
export async function getAllNewsArticles(
  limit?: number,
  category?: NewsCategory,
): Promise<NewsArticle[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readonly');
    const store = tx.objectStore(STORE_ARTICLES);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev');

    const results: NewsArticle[] = [];

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (!cursor) {
        resolve(results);
        return;
      }

      const article = cursor.value as NewsArticle;

      // 分类过滤
      if (category && article.category !== category) {
        cursor.continue();
        return;
      }

      results.push(article);

      if (limit && results.length >= limit) {
        resolve(results);
        return;
      }

      cursor.continue();
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * 获取单条新闻
 */
export async function getNewsArticleById(id: string): Promise<NewsArticle | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readonly');
    const request = tx.objectStore(STORE_ARTICLES).get(id);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 获取最新头条新闻
 */
export async function getLatestHeadline(): Promise<NewsArticle | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readonly');
    const store = tx.objectStore(STORE_ARTICLES);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev');

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (!cursor) {
        resolve(null);
        return;
      }

      const article = cursor.value as NewsArticle;
      if (article.category === 'headline') {
        resolve(article);
      } else {
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * 标记新闻为已读
 */
export async function markNewsAsRead(id: string): Promise<void> {
  const db = await openDb();

  const article = await getNewsArticleById(id);
  if (!article) return;

  article.isRead = true;
  article.views += 1;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readwrite');
    tx.objectStore(STORE_ARTICLES).put(article);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 更新元数据
  await updateMetaAfterRead();
}

/**
 * 获取未读数量
 */
export async function getUnreadNewsCount(): Promise<number> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readonly');
    const store = tx.objectStore(STORE_ARTICLES);
    const index = store.index('isRead');
    const request = index.openCursor(false);

    let count = 0;

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        count++;
        cursor.continue();
      } else {
        resolve(count);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * 获取分类文章数量
 */
export async function getNewsCountByCategory(category: NewsCategory): Promise<number> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readonly');
    const store = tx.objectStore(STORE_ARTICLES);
    const index = store.index('category');
    const request = index.openCursor(category);

    let count = 0;

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        count++;
        cursor.continue();
      } else {
        resolve(count);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * 删除新闻文章
 */
export async function deleteNewsArticle(id: string): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readwrite');
    tx.objectStore(STORE_ARTICLES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 更新元数据
  await updateMetaAfterDelete();
}

/**
 * 清空所有新闻
 */
export async function clearAllNews(): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readwrite');
    tx.objectStore(STORE_ARTICLES).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 重置元数据
  await resetMeta();
}

// ==================== 全局设置操作 ====================

/**
 * 获取全局设置
 */
export async function getNewsGlobalSettings(): Promise<NewsGlobalSettings> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const request = tx.objectStore(STORE_SETTINGS).get(GLOBAL_SETTINGS_KEY);

    request.onsuccess = () => {
      const settings = request.result as NewsGlobalSettings | undefined;
      resolve(
        settings ?? {
          key: 'global',
          autoGenerateEnabled: true,
          intervalHours: 4,
          eventTriggerEnabled: true,
          lastGeneratedGameDate: '',
          lastCheckedGameDate: '',
          updatedAt: Date.now(),
          preferredStyles: ['serious', 'satire'],
          allowNSFW: true,
        },
      );
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 保存全局设置
 */
export async function saveNewsGlobalSettings(
  settings: Omit<NewsGlobalSettings, 'key'>,
): Promise<void> {
  const db = await openDb();

  const fullSettings: NewsGlobalSettings = {
    ...settings,
    key: 'global',
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put(fullSettings);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== 元数据操作 ====================

/**
 * 获取元数据
 */
export async function getNewsMeta(): Promise<NewsMeta> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const request = tx.objectStore(STORE_META).get(META_KEY);

    request.onsuccess = () => {
      const meta = request.result as NewsMeta | undefined;
      resolve(
        meta ?? {
          key: 'meta',
          totalArticles: 0,
          unreadCount: 0,
          lastUpdated: Date.now(),
        },
      );
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 更新元数据（添加文章后）
 */
async function updateMetaAfterAdd(): Promise<void> {
  const db = await openDb();
  const currentMeta = await getNewsMeta();

  const updatedMeta: NewsMeta = {
    ...currentMeta,
    totalArticles: currentMeta.totalArticles + 1,
    unreadCount: currentMeta.unreadCount + 1,
    lastUpdated: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(updatedMeta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 更新元数据（阅读后）
 */
async function updateMetaAfterRead(): Promise<void> {
  const db = await openDb();
  const currentMeta = await getNewsMeta();

  const updatedMeta: NewsMeta = {
    ...currentMeta,
    unreadCount: Math.max(0, currentMeta.unreadCount - 1),
    lastUpdated: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(updatedMeta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 更新元数据（删除后）
 */
async function updateMetaAfterDelete(): Promise<void> {
  const db = await openDb();
  const currentMeta = await getNewsMeta();
  const unreadCount = await getUnreadNewsCount();
  const totalArticles = await getTotalArticleCount();

  const updatedMeta: NewsMeta = {
    ...currentMeta,
    totalArticles,
    unreadCount,
    lastUpdated: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(updatedMeta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取文章总数
 */
async function getTotalArticleCount(): Promise<number> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ARTICLES, 'readonly');
    const request = tx.objectStore(STORE_ARTICLES).count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 重置元数据
 */
async function resetMeta(): Promise<void> {
  const db = await openDb();

  const meta: NewsMeta = {
    key: 'meta',
    totalArticles: 0,
    unreadCount: 0,
    lastUpdated: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
