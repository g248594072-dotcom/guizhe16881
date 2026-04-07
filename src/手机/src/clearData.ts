/**
 * 统一数据清理模块
 * 用于清理小手机中的所有数据（论坛、朋友圈、新闻、微信聊天记录、日记）
 */

import { clearAllForumData } from './forumIndexedDb';
import { clearAllMoments } from './momentsIndexedDb';
import { clearAllNews } from './newsIndexedDb';
import { clearAllWeChatData } from './weChatIndexedDb';
import { clearAllDiaries } from './diaryIndexedDb';

/** localStorage 键名列表 */
const LOCALSTORAGE_KEYS = [
  'tavern-phone-theme',
  'tavern-phone-wechat-me',
  'tavern-phone:character-avatars',
];

/**
 * 清理所有 IndexedDB 数据
 * @returns 清理结果报告
 */
export async function clearAllIndexedDBData(): Promise<{
  forum: boolean;
  moments: boolean;
  news: boolean;
  wechat: boolean;
  diary: boolean;
}> {
  const results = {
    forum: false,
    moments: false,
    news: false,
    wechat: false,
    diary: false,
  };

  try {
    await clearAllForumData();
    results.forum = true;
  } catch (e) {
    console.error('[ClearData] 清理论坛数据失败:', e);
  }

  try {
    await clearAllMoments();
    results.moments = true;
  } catch (e) {
    console.error('[ClearData] 清理朋友圈数据失败:', e);
  }

  try {
    await clearAllNews();
    results.news = true;
  } catch (e) {
    console.error('[ClearData] 清理新闻数据失败:', e);
  }

  try {
    await clearAllWeChatData();
    results.wechat = true;
  } catch (e) {
    console.error('[ClearData] 清理微信数据失败:', e);
  }

  try {
    await clearAllDiaries();
    results.diary = true;
  } catch (e) {
    console.error('[ClearData] 清理日记数据失败:', e);
  }

  return results;
}

/**
 * 清理所有 localStorage 数据
 * @returns 清理的键名列表
 */
export function clearAllLocalStorageData(): string[] {
  const clearedKeys: string[] = [];

  for (const key of LOCALSTORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
      clearedKeys.push(key);
    } catch (e) {
      console.error(`[ClearData] 清理 localStorage 键 ${key} 失败:`, e);
    }
  }

  return clearedKeys;
}

/**
 * 清理小手机所有数据
 * 包括 IndexedDB 和 localStorage
 * @returns 清理结果
 */
export async function clearAllPhoneData(): Promise<{
  indexedDB: {
    forum: boolean;
    moments: boolean;
    news: boolean;
    wechat: boolean;
    diary: boolean;
  };
  localStorage: string[];
  success: boolean;
}> {
  console.info('[ClearData] 开始清理所有小手机数据...');

  const indexedDBResults = await clearAllIndexedDBData();
  const localStorageResults = clearAllLocalStorageData();

  const allSuccess =
    indexedDBResults.forum &&
    indexedDBResults.moments &&
    indexedDBResults.news &&
    indexedDBResults.wechat &&
    indexedDBResults.diary;

  console.info('[ClearData] 清理完成:', {
    indexedDB: indexedDBResults,
    localStorage: localStorageResults,
    success: allSuccess,
  });

  return {
    indexedDB: indexedDBResults,
    localStorage: localStorageResults,
    success: allSuccess,
  };
}

/**
 * 获取数据清理的统计信息
 * 用于显示清理确认对话框
 */
export function getClearDataSummary(): {
  title: string;
  message: string;
  dataTypes: string[];
} {
  return {
    title: '清理所有数据',
    message: '这将清除以下所有数据，此操作不可恢复：',
    dataTypes: [
      '论坛帖子与评论',
      '朋友圈动态与评论',
      '新闻文章',
      '微信聊天记录',
      '日记条目',
      '主题设置',
      '个人资料',
      '角色头像缓存',
    ],
  };
}
