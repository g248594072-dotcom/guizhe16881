/**
 * 新闻自动生成调度器
 * 【现实世界记者新闻系统】监听游戏时间和剧情事件，自动生成新闻报道
 * 
 * 双触发机制：
 * 1. 时间触发：按游戏时间间隔（默认4小时）
 * 2. 事件触发：检测到重大剧情事件时立即生成
 */

import {
  generateNewsArticle,
  generateNewsFromEvent,
  batchGenerateNews,
  type GeneratedNewsContent,
} from './newsGenerator';
import {
  saveNewsArticle,
  saveNewsArticles,
  getNewsGlobalSettings,
  saveNewsGlobalSettings,
  getNewsArticleById,
} from './newsIndexedDb';
import {
  detectMajorEvent,
  extractStorySnippet,
  type EventDetectionResult,
  resetEventDetection,
} from './newsEventMonitor';
import { getTavernContextForAnalysis } from './chatContext';
import { subscribeGameDateChange } from './tavernPhoneBridge';
import { getTaskManager } from './components/BackgroundTaskManager';
import type { NewsArticle, NewsCategory, NewsTriggerSource, NewsEventType } from './types/news';

/** 当前游戏日期缓存 */
let currentGameDate: string | null = null;
let currentGameTime: string | null = null;

/** 定时生成检查间隔（毫秒） */
const TIME_CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次

/** 事件检测间隔（毫秒） */
const EVENT_CHECK_INTERVAL = 30 * 1000; // 30秒检查一次

/** 上次定时生成检查的游戏时间（小时） */
let lastCheckedGameHour: number = -1;

/** 上次事件检测的剧情快照 */
let lastStoryContextSnapshot: string = '';

/** 手动触发回调列表 */
const newsGeneratedCallbacks: Array<(articles: NewsArticle[]) => void> = [];

/**
 * 从 MVU 变量中获取当前游戏日期
 */
export async function fetchCurrentGameDate(): Promise<string | null> {
  try {
    const w = window as unknown as Record<string, unknown>;
    const dateFromWindow = w.__GAME_DATE__ || w.__CURRENT_GAME_DATE__;
    if (typeof dateFromWindow === 'string' && dateFromWindow) {
      return dateFromWindow;
    }

    // 尝试从上下文获取
    const ctx = await import('./tavernPhoneBridge').then(m => m.requestTavernPhoneContext());
    if (ctx?.recentStorySnippet) {
      const dateMatch = ctx.recentStorySnippet.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
      if (dateMatch) {
        return normalizeDate(dateMatch[1]);
      }
    }

    return formatDate(new Date());
  } catch (e) {
    console.warn('[newsScheduler] 获取游戏日期失败:', e);
    return formatDate(new Date());
  }
}

/**
 * 获取当前游戏时间（小时）
 */
export async function fetchCurrentGameTime(): Promise<string | null> {
  try {
    const w = window as unknown as Record<string, unknown>;
    const timeFromWindow = w.__GAME_TIME__ || w.__CURRENT_GAME_TIME__;
    if (typeof timeFromWindow === 'string' && timeFromWindow) {
      return timeFromWindow;
    }

    // 从上下文尝试获取
    const ctx = await import('./tavernPhoneBridge').then(m => m.requestTavernPhoneContext());
    if (ctx?.recentStorySnippet) {
      const timeMatch = ctx.recentStorySnippet.match(/(\d{1,2}:\d{2})/);
      if (timeMatch) {
        return timeMatch[1];
      }
    }

    return null;
  } catch (e) {
    console.warn('[newsScheduler] 获取游戏时间失败:', e);
    return null;
  }
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 规范化日期格式
 */
function normalizeDate(dateStr: string): string {
  const cleaned = dateStr.replace(/[年月日/-]/g, '-').replace(/-+/g, '-').trim();
  const parts = cleaned.split('-').filter(Boolean);
  if (parts.length >= 3) {
    const year = parts[0];
    const month = String(parseInt(parts[1], 10)).padStart(2, '0');
    const day = String(parseInt(parts[2], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return formatDate(new Date());
}

/**
 * 解析游戏时间为小时数
 */
function parseGameHour(timeStr: string | null): number {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

/**
 * 检查是否应该基于时间生成新闻
 */
async function shouldGenerateByTime(): Promise<boolean> {
  const settings = await getNewsGlobalSettings();

  if (!settings.autoGenerateEnabled) {
    return false;
  }

  const gameTime = await fetchCurrentGameTime();
  const currentHour = parseGameHour(gameTime);

  // 如果小时变化达到间隔，触发生成
  if (lastCheckedGameHour >= 0) {
    const hourDiff = currentHour - lastCheckedGameHour;
    if (hourDiff < 0) {
      // 跨天情况
      return (24 - lastCheckedGameHour + currentHour) >= settings.intervalHours;
    }
    return hourDiff >= settings.intervalHours;
  }

  // 首次检查
  lastCheckedGameHour = currentHour;
  return false;
}

/**
 * 时间触发的生成
 */
async function checkTimeBasedGeneration(): Promise<NewsArticle[]> {
  const settings = await getNewsGlobalSettings();

  if (!settings.autoGenerateEnabled) {
    return [];
  }

  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());
  const gameTime = await fetchCurrentGameTime();

  // 检查是否达到生成间隔
  const shouldGenerate = await shouldGenerateByTime();
  if (!shouldGenerate) {
    return [];
  }

  console.log('[newsScheduler] 触发时间生成检查');

  try {
    // 获取剧情上下文
    const storyContext = getTavernContextForAnalysis(5);
    const contextStr = storyContext.map(m => `${m.name}: ${m.content}`).join('\n\n');

    // 基于时间生成1-2条新闻
    const count = 1 + Math.floor(Math.random() * 2); // 1-2条
    const articles: NewsArticle[] = [];

    for (let i = 0; i < count; i++) {
      // 头条只生成一条
      const category: NewsCategory = i === 0 ? 'headline' : 'society';

      const generated = await generateNewsArticle({
        category,
        gameDate,
        gameTime: gameTime || undefined,
        storyContext: contextStr,
        allowNSFW: settings.allowNSFW,
      });

      if (generated) {
        const article = await saveNewsArticle({
          ...generated,
          gameDate,
          gameTime: gameTime || undefined,
          triggerSource: 'time_based',
        });
        articles.push(article);
      }
    }

    // 更新设置
    await saveNewsGlobalSettings({
      ...settings,
      lastGeneratedGameDate: gameDate,
    });

    // 更新检查时间
    lastCheckedGameHour = parseGameHour(gameTime);

    // 通知回调
    if (articles.length > 0) {
      newsGeneratedCallbacks.forEach(cb => cb(articles));
    }

    console.log(`[newsScheduler] 时间触发生成完成: ${articles.length}条新闻`);
    return articles;
  } catch (e) {
    console.error('[newsScheduler] 时间触发生成失败:', e);
    return [];
  }
}

/**
 * 事件触发的生成
 */
async function checkEventBasedGeneration(): Promise<NewsArticle[]> {
  const settings = await getNewsGlobalSettings();

  if (!settings.eventTriggerEnabled) {
    return [];
  }

  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());
  const gameTime = await fetchCurrentGameTime();

  // 获取当前剧情上下文
  const storyContext = getTavernContextForAnalysis(5);
  const contextStr = storyContext.map(m => `${m.name}: ${m.content}`).join('\n\n');

  // 检查是否有重大变化
  const currentSnapshot = extractStorySnippet(contextStr, 500);
  if (currentSnapshot === lastStoryContextSnapshot) {
    return []; // 无变化，不检测
  }

  // 检测事件
  const detection = detectMajorEvent(contextStr);

  if (!detection.hasEvent || !detection.eventType) {
    lastStoryContextSnapshot = currentSnapshot;
    return [];
  }

  console.log(`[newsScheduler] 检测到重大事件: ${detection.eventType}`);

  try {
    // 基于事件生成新闻
    const generated = await generateNewsFromEvent(
      detection.eventType,
      detection.description || '',
      gameDate,
      {
        allowNSFW: settings.allowNSFW,
        forcedTone: detection.severity === 'critical' || detection.severity === 'high'
          ? 'shocked'
          : 'critical',
      },
    );

    if (!generated) {
      return [];
    }

    // 保存新闻
    const article = await saveNewsArticle({
      ...generated,
      gameDate,
      gameTime: gameTime || undefined,
      triggerSource: 'event_based',
      relatedEvent: detection.description,
    });

    // 更新快照
    lastStoryContextSnapshot = currentSnapshot;

    // 通知回调
    newsGeneratedCallbacks.forEach(cb => cb([article]));

    console.log(`[newsScheduler] 事件触发生成完成: ${article.title}`);
    return [article];
  } catch (e) {
    console.error('[newsScheduler] 事件触发生成失败:', e);
    return [];
  }
}

/**
 * 手动生成新闻
 */
export async function manualGenerateNews(
  category: NewsCategory,
  options?: {
    storyContext?: string;
    forcedStyle?: import('./types/news').NewsStyle;
    forcedTone?: import('./types/news').NewsTone;
    extraPrompt?: string;
  },
): Promise<NewsArticle | null> {
  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());
  const gameTime = await fetchCurrentGameTime();
  const settings = await getNewsGlobalSettings();

  try {
    const context = options?.storyContext || getTavernContextForAnalysis(5).map(m => `${m.name}: ${m.content}`).join('\n\n');

    const generated = await generateNewsArticle({
      category,
      gameDate,
      gameTime: gameTime || undefined,
      storyContext: context,
      forcedStyle: options?.forcedStyle,
      forcedTone: options?.forcedTone,
      extraPrompt: options?.extraPrompt,
      allowNSFW: settings.allowNSFW,
    });

    if (!generated) {
      return null;
    }

    // 保存
    const article = await saveNewsArticle({
      ...generated,
      gameDate,
      gameTime: gameTime || undefined,
      triggerSource: 'manual',
    });

    console.log(`[newsScheduler] 手动生成新闻成功: ${article.title}`);
    return article;
  } catch (e) {
    console.error('[newsScheduler] 手动生成新闻失败:', e);
    throw e;
  }
}

/**
 * 批量生成新闻
 */
export async function manualBatchGenerateNews(
  count: number,
  categories?: NewsCategory[],
  onProgress?: (current: number, total: number) => void,
): Promise<NewsArticle[]> {
  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());
  const gameTime = await fetchCurrentGameTime();
  const settings = await getNewsGlobalSettings();

  const context = getTavernContextForAnalysis(5).map(m => `${m.name}: ${m.content}`).join('\n\n');

  const articles: NewsArticle[] = [];

  for (let i = 0; i < count; i++) {
    onProgress?.(i + 1, count);

    const availableCategories = categories || ['headline', 'society', 'column', 'entertainment'];
    let category: NewsCategory;
    if (i === 0 && availableCategories.includes('headline')) {
      category = 'headline';
    } else {
      const nonHeadline = availableCategories.filter(c => c !== 'headline');
      category = nonHeadline[Math.floor(Math.random() * nonHeadline.length)];
    }

    const generated = await generateNewsArticle({
      category,
      gameDate,
      gameTime: gameTime || undefined,
      storyContext: context,
      allowNSFW: settings.allowNSFW,
    });

    if (generated) {
      const article = await saveNewsArticle({
        ...generated,
        gameDate,
        gameTime: gameTime || undefined,
        triggerSource: 'manual',
      });
      articles.push(article);
    }

    // 避免过快请求
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return articles;
}

/**
 * 后台批量生成新闻
 * 使用BackgroundTaskManager在后台执行
 */
export async function backgroundBatchGenerateNews(
  options: {
    count: number;
    categories?: NewsCategory[];
  },
  onComplete?: (articles: NewsArticle[]) => void,
): Promise<string> {
  const taskManager = getTaskManager();
  const { count, categories = ['headline', 'society', 'column'] } = options;

  const taskId = taskManager.addTask({
    type: 'news_generation',
    name: `生成${count}条新闻报道`,
    progress: 0,
    current: 0,
    total: count,
  });

  // 后台执行
  setTimeout(async () => {
    taskManager.updateTask(taskId, { status: 'running' });
    const articles: NewsArticle[] = [];

    try {
      const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());
      const gameTime = await fetchCurrentGameTime();
      const settings = await getNewsGlobalSettings();
      const context = getTavernContextForAnalysis(5).map(m => `${m.name}: ${m.content}`).join('\n\n');

      for (let i = 0; i < count; i++) {
        taskManager.updateTask(taskId, {
          name: `生成新闻报道 ${i + 1}/${count}`,
          current: i,
          progress: (i / count) * 100,
        });

        let category: NewsCategory;
        if (i === 0 && categories.includes('headline')) {
          category = 'headline';
        } else {
          const nonHeadline = categories.filter(c => c !== 'headline');
          category = nonHeadline[Math.floor(Math.random() * nonHeadline.length)];
        }

        const generated = await generateNewsArticle({
          category,
          gameDate,
          gameTime: gameTime || undefined,
          storyContext: context,
          allowNSFW: settings.allowNSFW,
        });

        if (generated) {
          const article = await saveNewsArticle({
            ...generated,
            gameDate,
            gameTime: gameTime || undefined,
            triggerSource: 'manual',
          });
          articles.push(article);
        }

        // 更新进度
        taskManager.updateTask(taskId, {
          current: i + 1,
          progress: ((i + 1) / count) * 100,
        });

        // 避免过快请求
        if (i < count - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      taskManager.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        current: count,
      });

      onComplete?.(articles);
      newsGeneratedCallbacks.forEach(cb => cb(articles));

      console.log(`[newsScheduler] 后台批量生成完成: ${articles.length}条新闻`);
    } catch (e) {
      console.error('[newsScheduler] 后台批量生成失败:', e);
      taskManager.updateTask(taskId, {
        status: 'error',
        error: String(e),
      });
    }
  }, 100);

  return taskId;
}

/**
 * 订阅新闻生成事件
 */
export function onNewsGenerated(callback: (articles: NewsArticle[]) => void): () => void {
  newsGeneratedCallbacks.push(callback);
  return () => {
    const index = newsGeneratedCallbacks.indexOf(callback);
    if (index > -1) {
      newsGeneratedCallbacks.splice(index, 1);
    }
  };
}

/**
 * 获取当前日期
 */
export function getCurrentGameDate(): string | null {
  return currentGameDate;
}

/**
 * 强制设置当前日期（用于测试）
 */
export function setCurrentGameDate(date: string): void {
  currentGameDate = date;
}

/**
 * 重置调度器状态
 */
export function resetScheduler(): void {
  currentGameDate = null;
  lastCheckedGameHour = -1;
  lastStoryContextSnapshot = '';
  resetEventDetection();
}

/**
 * 初始化新闻调度器
 * 启动时间检测和事件检测
 */
export function initNewsScheduler(): () => void {
  console.log('[newsScheduler] 初始化新闻调度器');

  // 立即获取一次日期
  void fetchCurrentGameDate().then(date => {
    if (date) {
      currentGameDate = date;
    }
  });

  // 订阅壳脚本推送的游戏日期变化
  const unsubscribeGameDate = subscribeGameDateChange(newDate => {
    if (newDate && newDate !== currentGameDate) {
      console.log('[newsScheduler] 游戏日期变化:', currentGameDate, '->', newDate);
      currentGameDate = newDate;
    }
  });

  // 定时检查时间触发
  const timeCheckInterval = window.setInterval(async () => {
    const articles = await checkTimeBasedGeneration();
    if (articles.length > 0) {
      console.log(`[newsScheduler] 时间触发生成: ${articles.length}条新闻`);
    }
  }, TIME_CHECK_INTERVAL);

  // 定时检查事件触发
  const eventCheckInterval = window.setInterval(async () => {
    const articles = await checkEventBasedGeneration();
    if (articles.length > 0) {
      console.log(`[newsScheduler] 事件触发生成: ${articles.length}条新闻`);
    }
  }, EVENT_CHECK_INTERVAL);

  // 返回清理函数
  return () => {
    clearInterval(timeCheckInterval);
    clearInterval(eventCheckInterval);
    unsubscribeGameDate();
    console.log('[newsScheduler] 新闻调度器已停止');
  };
}
