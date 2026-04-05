/**
 * 论坛存储模块
 * 【面具下的树洞】论坛的 IndexedDB 存储管理
 */

import type {
  ForumPost,
  ForumComment,
  ForumMeta,
  ForumGlobalSettings,
  ForumTag,
  ForumIdentityType,
} from './types/forum';

const DB_NAME = 'tavern-phone-forum';
const DB_VERSION = 1;
const STORE_POSTS = 'posts';
const STORE_COMMENTS = 'comments';
const STORE_META = 'meta';
const STORE_SETTINGS = 'settings';

/** 本地离线 scope */
const LOCAL_OFFLINE_SCOPE = 'local-offline';

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

        // 帖子表
        if (!db.objectStoreNames.contains(STORE_POSTS)) {
          const store = db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
          store.createIndex('characterId', 'characterId', { unique: false });
          store.createIndex('gameDate', 'gameDate', { unique: false });
          store.createIndex('postType', 'postType', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 评论表
        if (!db.objectStoreNames.contains(STORE_COMMENTS)) {
          const store = db.createObjectStore(STORE_COMMENTS, { keyPath: 'id' });
          store.createIndex('postId', 'postId', { unique: false });
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

// ==================== 帖子操作 ====================

/**
 * 保存帖子
 */
export async function saveForumPost(
  post: Omit<ForumPost, 'id' | 'createdAt' | 'views' | 'likes' | 'comments' | 'isRead' | 'isLiked'>,
): Promise<ForumPost> {
  const db = await openDb();
  const fullPost: ForumPost = {
    ...post,
    id: generateId(),
    createdAt: Date.now(),
    views: 0,
    likes: 0,
    comments: 0,
    isRead: false,
    isLiked: false,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readwrite');
    tx.objectStore(STORE_POSTS).put(fullPost);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return fullPost;
}

/**
 * 获取所有帖子(按时间倒序)
 */
export async function getAllForumPosts(): Promise<ForumPost[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: ForumPost[] = [];
    const tx = db.transaction(STORE_POSTS, 'readonly');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.openCursor(null, 'prev');

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push(cursor.value as ForumPost);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取角色的所有帖子
 */
export async function getForumPostsByCharacter(characterId: string): Promise<ForumPost[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: ForumPost[] = [];
    const tx = db.transaction(STORE_POSTS, 'readonly');
    const store = tx.objectStore(STORE_POSTS);
    const index = store.index('characterId');
    const range = IDBKeyRange.only(characterId);
    const req = index.openCursor(range, 'prev');

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push(cursor.value as ForumPost);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 根据ID获取帖子
 */
export async function getForumPostById(postId: string): Promise<ForumPost | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readonly');
    const req = tx.objectStore(STORE_POSTS).get(postId);
    req.onsuccess = () => resolve((req.result as ForumPost) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 标记帖子为已读
 */
export async function markPostAsRead(postId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.get(postId);

    req.onsuccess = () => {
      const post = req.result as ForumPost | undefined;
      if (post) {
        post.isRead = true;
        store.put(post);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 切换点赞状态
 */
export async function togglePostLike(postId: string): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.get(postId);

    req.onsuccess = () => {
      const post = req.result as ForumPost | undefined;
      if (post) {
        post.isLiked = !post.isLiked;
        post.likes += post.isLiked ? 1 : -1;
        store.put(post);
        resolve(post.isLiked);
      } else {
        resolve(false);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 增加浏览数
 */
export async function incrementPostViews(postId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POSTS, 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.get(postId);

    req.onsuccess = () => {
      const post = req.result as ForumPost | undefined;
      if (post) {
        post.views = (post.views || 0) + 1;
        store.put(post);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 删除帖子(同时删除相关评论)
 */
export async function deleteForumPost(postId: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_POSTS, STORE_COMMENTS], 'readwrite');

    // 删除帖子
    tx.objectStore(STORE_POSTS).delete(postId);

    // 删除相关评论
    const commentStore = tx.objectStore(STORE_COMMENTS);
    const index = commentStore.index('postId');
    const range = IDBKeyRange.only(postId);
    const req = index.openCursor(range);

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        commentStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== 评论操作 ====================

/**
 * 添加评论
 */
export async function addForumComment(
  comment: Omit<ForumComment, 'id' | 'createdAt' | 'likes' | 'isLiked'>,
): Promise<ForumComment> {
  const db = await openDb();
  const fullComment: ForumComment = {
    ...comment,
    id: generateId(),
    createdAt: Date.now(),
    likes: 0,
    isLiked: false,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_COMMENTS, STORE_POSTS], 'readwrite');

    // 保存评论
    tx.objectStore(STORE_COMMENTS).put(fullComment);

    // 更新帖子评论数
    const postStore = tx.objectStore(STORE_POSTS);
    const req = postStore.get(comment.postId);
    req.onsuccess = () => {
      const post = req.result as ForumPost | undefined;
      if (post) {
        post.comments = (post.comments || 0) + 1;
        postStore.put(post);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return fullComment;
}

/**
 * 获取帖子的所有评论
 */
export async function getCommentsByPostId(postId: string): Promise<ForumComment[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: ForumComment[] = [];
    const tx = db.transaction(STORE_COMMENTS, 'readonly');
    const store = tx.objectStore(STORE_COMMENTS);
    const index = store.index('postId');
    const range = IDBKeyRange.only(postId);
    const req = index.openCursor(range, 'next');

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push(cursor.value as ForumComment);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 切换评论点赞
 */
export async function toggleCommentLike(commentId: string): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COMMENTS, 'readwrite');
    const store = tx.objectStore(STORE_COMMENTS);
    const req = store.get(commentId);

    req.onsuccess = () => {
      const comment = req.result as ForumComment | undefined;
      if (comment) {
        comment.isLiked = !comment.isLiked;
        comment.likes += comment.isLiked ? 1 : -1;
        store.put(comment);
        resolve(comment.isLiked);
      } else {
        resolve(false);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 删除评论
 */
export async function deleteForumComment(commentId: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_COMMENTS, 'readwrite');
    tx.objectStore(STORE_COMMENTS).delete(commentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== 元数据操作 ====================

/**
 * 获取角色的论坛元数据
 */
export async function getForumMeta(characterId: string): Promise<ForumMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(characterId);
    req.onsuccess = () => {
      const result = req.result as ForumMeta | undefined;
      resolve(result ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 保存角色的论坛元数据
 */
export async function saveForumMeta(meta: ForumMeta): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 切换自动生成功能
 */
export async function toggleForumAutoGenerate(characterId: string, enabled: boolean): Promise<void> {
  const meta = await getForumMeta(characterId);
  const newMeta: ForumMeta = {
    characterId,
    lastGeneratedGameDate: meta?.lastGeneratedGameDate ?? '',
    lastGeneratedAt: meta?.lastGeneratedAt ?? 0,
    autoGenerateEnabled: enabled,
    defaultUsernames: meta?.defaultUsernames ?? {
      anonymous: `匿名网友${Math.floor(1000 + Math.random() * 9000)}`,
      username: '',
      real_name: '',
      role_title: '',
    },
  };
  await saveForumMeta(newMeta);
}

/**
 * 更新默认网名
 */
export async function updateDefaultUsername(
  characterId: string,
  identityType: ForumIdentityType,
  username: string,
): Promise<void> {
  const meta = await getForumMeta(characterId);
  const newMeta: ForumMeta = {
    characterId,
    lastGeneratedGameDate: meta?.lastGeneratedGameDate ?? '',
    lastGeneratedAt: meta?.lastGeneratedAt ?? 0,
    autoGenerateEnabled: meta?.autoGenerateEnabled ?? true,
    defaultUsernames: {
      ...meta?.defaultUsernames,
      [identityType]: username,
    },
  };
  await saveForumMeta(newMeta);
}

/**
 * 检查今天是否需要自动生成帖子
 */
export async function shouldAutoGenerateForumPost(
  characterId: string,
  currentGameDate: string,
): Promise<boolean> {
  const meta = await getForumMeta(characterId);
  if (!meta?.autoGenerateEnabled) {
    return false;
  }
  return meta.lastGeneratedGameDate !== currentGameDate;
}

/**
 * 更新上次生成日期
 */
export async function updateLastGeneratedForumDate(
  characterId: string,
  gameDate: string,
): Promise<void> {
  const meta = await getForumMeta(characterId);
  const newMeta: ForumMeta = {
    characterId,
    lastGeneratedGameDate: gameDate,
    lastGeneratedAt: Date.now(),
    autoGenerateEnabled: meta?.autoGenerateEnabled ?? true,
    defaultUsernames: meta?.defaultUsernames ?? {
      anonymous: `匿名网友${Math.floor(1000 + Math.random() * 9000)}`,
      username: '',
      real_name: '',
      role_title: '',
    },
  };
  await saveForumMeta(newMeta);
}

// ==================== 全局设置操作 ====================

/**
 * 获取全局设置
 */
export async function getForumGlobalSettings(): Promise<ForumGlobalSettings> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).get(GLOBAL_SETTINGS_KEY);
    req.onsuccess = () => {
      const result = req.result as ForumGlobalSettings | undefined;
      resolve(
        result ?? {
          key: 'global',
          autoUpdateEnabled: false,
          intervalDays: 1,
          lastCheckedGameDate: '',
          updatedAt: 0,
        },
      );
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 保存全局设置
 */
export async function saveForumGlobalSettings(
  settings: Omit<ForumGlobalSettings, 'key' | 'updatedAt'>,
): Promise<void> {
  const db = await openDb();
  const fullSettings: ForumGlobalSettings = {
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
export async function toggleForumAutoUpdate(enabled: boolean): Promise<void> {
  const settings = await getForumGlobalSettings();
  await saveForumGlobalSettings({
    ...settings,
    autoUpdateEnabled: enabled,
  });
}

/**
 * 设置更新间隔天数
 */
export async function setForumAutoUpdateIntervalDays(days: number): Promise<void> {
  const settings = await getForumGlobalSettings();
  await saveForumGlobalSettings({
    ...settings,
    intervalDays: Math.max(1, Math.min(30, days)),
  });
}

/**
 * 更新最后检查日期
 */
export async function updateForumLastCheckedDate(gameDate: string): Promise<void> {
  const settings = await getForumGlobalSettings();
  await saveForumGlobalSettings({
    ...settings,
    lastCheckedGameDate: gameDate,
  });
}

// ==================== 统计与查询 ====================

/**
 * 获取未读帖子数量
 */
export async function getUnreadForumPostCount(): Promise<number> {
  const all = await getAllForumPosts();
  return all.filter(p => !p.isRead).length;
}

/**
 * 按标签筛选帖子
 */
export async function getForumPostsByTag(tag: ForumTag): Promise<ForumPost[]> {
  if (tag === '全部') {
    return getAllForumPosts();
  }
  const all = await getAllForumPosts();
  return all.filter(p => p.tags.includes(tag));
}

/**
 * 搜索帖子
 */
export async function searchForumPosts(query: string): Promise<ForumPost[]> {
  const all = await getAllForumPosts();
  const lowerQuery = query.toLowerCase();
  return all.filter(
    p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.content.toLowerCase().includes(lowerQuery) ||
      p.authorName.toLowerCase().includes(lowerQuery),
  );
}

/**
 * 清空所有论坛数据(用于重置)
 */
export async function clearAllForumData(): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_POSTS, STORE_COMMENTS, STORE_META], 'readwrite');
    tx.objectStore(STORE_POSTS).clear();
    tx.objectStore(STORE_COMMENTS).clear();
    tx.objectStore(STORE_META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
