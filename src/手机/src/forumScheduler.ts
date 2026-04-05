/**
 * 论坛自动生成调度器
 * 【论坛】监听游戏时间变化，自动为角色和随机网友生成论坛帖子
 */

import {
  generateForumPost,
  generateRandomUserPost,
  type LanguageStyle,
} from './forumGenerator';
import {
  saveForumPost,
  addForumComment,
  getForumMeta,
  shouldAutoGenerateForumPost,
  updateLastGeneratedForumDate,
  getForumGlobalSettings,
  updateForumLastCheckedDate,
  type ForumPost,
  type ForumComment,
} from './forumIndexedDb';
import { loadCharacterArchive, type PhoneCharacterArchive } from './characterArchive/bridge';
import { subscribeGameDateChange } from './tavernPhoneBridge';
import type { ForumIdentityType } from './types/forum';
import { getTaskManager } from './components/BackgroundTaskManager';

/** 当前游戏日期缓存 */
let currentGameDate: string | null = null;

/** 正在生成的角色集合（防止重复生成） */
const generatingSet = new Set<string>();

/** 手动触发回调列表 */
const manualTriggerCallbacks: Array<(posts: ForumPost[]) => void> = [];

/**
 * 从 MVU 变量中获取当前游戏日期
 * 通过请求上下文或从 window 对象获取
 */
export async function fetchCurrentGameDate(): Promise<string | null> {
  try {
    // 尝试从 window 对象获取（壳脚本会注入）
    const w = window as unknown as Record<string, unknown>;
    const dateFromWindow = w.__GAME_DATE__ || w.__CURRENT_GAME_DATE__;
    if (typeof dateFromWindow === 'string' && dateFromWindow) {
      return dateFromWindow;
    }

    // 尝试从上下文获取
    const ctx = await import('./tavernPhoneBridge').then(m => m.requestTavernPhoneContext());
    if (ctx?.recentStorySnippet) {
      // 尝试从剧情摘要中解析日期
      const dateMatch = ctx.recentStorySnippet.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
      if (dateMatch) {
        return normalizeDate(dateMatch[1]);
      }
    }

    // 默认使用现实日期
    return formatDate(new Date());
  } catch (e) {
    console.warn('[forumScheduler] 获取游戏日期失败:', e);
    return formatDate(new Date());
  }
}

/**
 * 格式化日期为统一格式 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 规范化各种日期格式为 YYYY-MM-DD
 */
function normalizeDate(dateStr: string): string {
  // 去除多余字符
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
 * 解析日期字符串为 Date 对象
 */
function parseGameDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * 计算两个游戏日期之间的天数差
 */
function getDaysBetween(date1: string, date2: string): number {
  const d1 = parseGameDate(date1);
  const d2 = parseGameDate(date2);
  if (!d1 || !d2) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((d2.getTime() - d1.getTime()) / msPerDay);
}

/**
 * 检查并自动生成帖子
 * 支持按天数间隔自动生成（角色 + 随机网友）
 */
export async function checkAndAutoGenerateForumPosts(newGameDate: string): Promise<ForumPost[]> {
  // 更新当前游戏日期
  currentGameDate = newGameDate;

  // 获取全局设置
  const settings = await getForumGlobalSettings();

  // 如果自动更新未启用，直接返回
  if (!settings.autoUpdateEnabled) {
    return [];
  }

  const generatedPosts: ForumPost[] = [];

  try {
    // 计算距离上次检查过去了多少天
    const daysSinceLastCheck = settings.lastCheckedGameDate
      ? getDaysBetween(settings.lastCheckedGameDate, newGameDate)
      : Infinity; // 首次启用时立即生成

    // 如果未达到间隔天数，不生成
    if (daysSinceLastCheck < settings.intervalDays) {
      console.log(
        `[forumScheduler] 距离上次生成还有 ${settings.intervalDays - daysSinceLastCheck} 天`,
      );
      return [];
    }

    // 获取所有角色
    const characters = await loadCharacterArchive();
    const activeCharacters = characters.filter(c => c.status === '出场中');

    console.log(
      `[forumScheduler] 间隔 ${settings.intervalDays} 天触发，${activeCharacters.length} 个角色 + 随机网友`,
    );

    // 生成角色帖子
    for (const character of activeCharacters) {
      const shouldGenerate = await shouldAutoGenerateForumPost(character.id, newGameDate);
      if (!shouldGenerate) {
        continue;
      }

      // 防止重复生成
      if (generatingSet.has(character.id)) {
        continue;
      }
      generatingSet.add(character.id);

      try {
        // 生成帖子（附带评论）
        const generated = await generateForumPost({
          characterId: character.id,
          characterName: character.name,
          gameDate: newGameDate,
        });

        if (generated) {
          // 保存帖子到数据库
          const post = await saveForumPost({
            characterId: character.id,
            characterName: character.name,
            identityType: generated.post.identityType,
            authorName: generated.post.authorName,
            title: generated.post.title,
            content: generated.post.content,
            gameDate: newGameDate,
            postType: generated.post.postType,
            tags: generated.post.tags,
            generationMode: 'auto',
          });

          // 保存评论
          for (const commentData of generated.comments) {
            try {
              await addForumComment({
                ...commentData,
                postId: post.id,
              });
            } catch (e) {
              console.warn('[forumScheduler] 保存评论失败:', e);
            }
          }

          // 更新帖子评论数
          post.comments = generated.comments.length;
          generatedPosts.push(post);
          console.log(`[forumScheduler] ✅ 已为 ${character.name} 生成帖子: ${generated.post.title} (+${generated.comments.length}评论)`);

          // 更新元数据
          await updateLastGeneratedForumDate(character.id, newGameDate);
        }
      } catch (e) {
        console.error(`[forumScheduler] 为 ${character.name} 生成帖子失败:`, e);
      } finally {
        generatingSet.delete(character.id);
      }
    }

    // 生成随机网友帖子（每个间隔生成2-3个随机帖子）
    const randomPostCount = 2 + Math.floor(Math.random() * 2); // 2-3个
    for (let i = 0; i < randomPostCount; i++) {
      try {
        const generated = await generateRandomUserPost(newGameDate);
        if (generated) {
          // 保存帖子
          const post = await saveForumPost({
            characterId: `random-auto-${Date.now()}-${i}`,
            characterName: generated.post.authorName,
            identityType: generated.post.identityType,
            authorName: generated.post.authorName,
            title: generated.post.title,
            content: generated.post.content,
            gameDate: newGameDate,
            postType: generated.post.postType,
            tags: generated.post.tags,
            generationMode: 'auto',
          });

          // 保存评论
          for (const commentData of generated.comments) {
            try {
              await addForumComment({
                ...commentData,
                postId: post.id,
              });
            } catch (e) {
              console.warn('[forumScheduler] 保存随机网友评论失败:', e);
            }
          }

          // 更新帖子评论数
          post.comments = generated.comments.length;
          generatedPosts.push(post);
          console.log(`[forumScheduler] ✅ 已生成随机网友帖子: ${generated.post.title} (+${generated.comments.length}评论)`);
        }
      } catch (e) {
        console.error('[forumScheduler] 生成随机网友帖子失败:', e);
      }
    }

    // 更新最后检查日期
    await updateForumLastCheckedDate(newGameDate);

    // 通知回调
    if (generatedPosts.length > 0) {
      manualTriggerCallbacks.forEach(cb => cb(generatedPosts));
    }

    return generatedPosts;
  } catch (e) {
    console.error('[forumScheduler] 自动检查帖子生成失败:', e);
    return [];
  }
}

/**
 * 手动为指定角色生成帖子（立即生成）
 * 支持指定语言风格，附带评论
 */
export async function manualGenerateForumPost(
  characterId: string,
  characterName: string,
  todayEvents?: string,
  forcedStyle?: LanguageStyle,
  forcedIdentityType?: ForumIdentityType,
  forcedPostType?: string,
): Promise<ForumPost | null> {
  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());

  try {
    const generated = await generateForumPost(
      {
        characterId,
        characterName,
        gameDate,
        todayEvents,
        forcedIdentityType,
        forcedPostType: forcedPostType as
          | 'seeking_validation'
          | 'venting'
          | 'contrast'
          | 'help'
          | 'gossip'
          | 'rant',
      },
      forcedStyle,
    );

    if (!generated) {
      return null;
    }

    // 保存帖子到数据库
    const post = await saveForumPost({
      characterId,
      characterName,
      identityType: generated.post.identityType,
      authorName: generated.post.authorName,
      title: generated.post.title,
      content: generated.post.content,
      gameDate,
      postType: generated.post.postType,
      tags: generated.post.tags,
      generationMode: 'manual',
      todayEvents,
    });

    // 保存评论
    for (const commentData of generated.comments) {
      try {
        await addForumComment({
          ...commentData,
          postId: post.id,
        });
      } catch (e) {
        console.warn('[forumScheduler] 保存评论失败:', e);
      }
    }

    // 更新帖子评论数
    post.comments = generated.comments.length;

    // 更新元数据
    await updateLastGeneratedForumDate(characterId, gameDate);

    console.log(`[forumScheduler] ✅ 手动生成帖子成功: ${post.title} (+${generated.comments.length}评论)`);
    return post;
  } catch (e) {
    console.error('[forumScheduler] 手动生成帖子失败:', e);
    return null;
  }
}

/**
 * 批量手动生成帖子（混合角色 + 随机网友）
 * 支持指定语言风格
 */
export async function batchManualGenerateForumPosts(
  todayEvents?: string,
  forcedStyle?: LanguageStyle,
  randomUserCount: number = 3,
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<{ characterId: string | null; characterName: string | null; post: ForumPost | null }[]> {
  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());
  const results: { characterId: string | null; characterName: string | null; post: ForumPost | null }[] = [];

  try {
    const characters = await loadCharacterArchive();
    const activeCharacters = characters.filter(c => c.status === '出场中');

    const totalCount = activeCharacters.length + randomUserCount;
    let currentCount = 0;

    // 生成角色帖子
    for (const character of activeCharacters) {
      onProgress?.(++currentCount, totalCount, character.name);

      const post = await manualGenerateForumPost(
        character.id,
        character.name,
        todayEvents,
        forcedStyle,
      );

      results.push({
        characterId: character.id,
        characterName: character.name,
        post,
      });
    }

    // 生成随机网友帖子
    for (let i = 0; i < randomUserCount; i++) {
      onProgress?.(++currentCount, totalCount, `随机网友${i + 1}`);

      try {
        const generated = await generateRandomUserPost(gameDate, todayEvents, forcedStyle);
        if (generated) {
          // 保存帖子
          const post = await saveForumPost({
            characterId: `random-${Date.now()}-${i}`,
            characterName: generated.post.authorName,
            identityType: generated.post.identityType,
            authorName: generated.post.authorName,
            title: generated.post.title,
            content: generated.post.content,
            gameDate,
            postType: generated.post.postType,
            tags: generated.post.tags,
            generationMode: 'manual',
            todayEvents,
          });

          // 保存评论
          for (const commentData of generated.comments) {
            try {
              await addForumComment({
                ...commentData,
                postId: post.id,
              });
            } catch (e) {
              console.warn('[forumScheduler] 保存随机网友评论失败:', e);
            }
          }

          // 更新帖子评论数
          post.comments = generated.comments.length;

          results.push({
            characterId: null,
            characterName: null,
            post,
          });
          console.log(`[forumScheduler] ✅ 随机网友帖子生成成功: ${post.title} (+${generated.comments.length}评论)`);
        }
      } catch (e) {
        console.error(`[forumScheduler] 生成随机网友帖子失败:`, e);
      }
    }

    return results;
  } catch (e) {
    console.error('[forumScheduler] 批量生成帖子失败:', e);
    return [];
  }
}

/**
 * 设置当前游戏日期（通常由壳脚本或外部调用）
 */
export function setCurrentForumGameDate(date: string): void {
  currentGameDate = date;
  console.log('[forumScheduler] 游戏日期更新为:', date);
}

/**
 * 获取当前游戏日期
 */
export function getCurrentForumGameDate(): string | null {
  return currentGameDate;
}

/**
 * 订阅新帖子生成事件
 */
export function onNewForumPostsGenerated(callback: (posts: ForumPost[]) => void): () => void {
  manualTriggerCallbacks.push(callback);
  return () => {
    const idx = manualTriggerCallbacks.indexOf(callback);
    if (idx > -1) manualTriggerCallbacks.splice(idx, 1);
  };
}

/**
 * 初始化调度器
 * 启动定时检查（每30秒检查一次日期变化）并订阅游戏日期推送
 */
export function initForumScheduler(): () => void {
  // 初始获取日期
  fetchCurrentGameDate().then(date => {
    if (date) {
      currentGameDate = date;
    }
  });

  // 订阅壳脚本推送的游戏日期变化
  const unsubscribeGameDate = subscribeGameDateChange(newDate => {
    if (newDate && newDate !== currentGameDate) {
      console.log('[forumScheduler] 壳脚本推送日期变化:', currentGameDate, '->', newDate);
      void checkAndAutoGenerateForumPosts(newDate);
    }
  });

  // 定期检查日期变化（作为备用机制）
  const intervalId = window.setInterval(async () => {
    const newDate = await fetchCurrentGameDate();
    if (newDate && newDate !== currentGameDate) {
      console.log('[forumScheduler] 检测到日期变化:', currentGameDate, '->', newDate);
      await checkAndAutoGenerateForumPosts(newDate);
    }
  }, 30000); // 每30秒检查一次

  return () => {
    clearInterval(intervalId);
    unsubscribeGameDate();
  };
}

/**
 * 后台批量生成论坛帖子
 * 使用任务管理器在后台执行，支持进度追踪
 */
export async function backgroundBatchGenerateForumPosts(
  options: {
    characterIds?: string[];
    randomUserCount?: number;
    todayEvents?: string;
    forcedStyle?: LanguageStyle;
    generateMode?: 'character' | 'random' | 'mixed';
  },
  onComplete?: (posts: ForumPost[]) => void,
): Promise<string> {
  const taskManager = getTaskManager();
  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || new Date().toISOString().split('T')[0];

  const { characterIds = [], randomUserCount = 3, todayEvents, forcedStyle, generateMode = 'mixed' } = options;

  // 计算总任务数
  let totalCount = 0;
  if (generateMode === 'character' || generateMode === 'mixed') {
    totalCount += characterIds.length;
  }
  if (generateMode === 'random' || generateMode === 'mixed') {
    totalCount += randomUserCount;
  }

  // 添加任务
  const taskId = taskManager.addTask({
    type: 'forum_generation',
    name: generateMode === 'character'
      ? `生成${characterIds.length}个角色帖子`
      : generateMode === 'random'
      ? `生成${randomUserCount}个网友帖子`
      : `生成${characterIds.length}角色+${randomUserCount}网友帖子`,
    progress: 0,
    current: 0,
    total: totalCount,
  });

  // 在后台执行
  setTimeout(async () => {
    taskManager.updateTask(taskId, { status: 'running' });
    const newPosts: ForumPost[] = [];
    let currentCount = 0;

    try {
      // 生成角色帖子
      if ((generateMode === 'character' || generateMode === 'mixed') && characterIds.length > 0) {
        for (const characterId of characterIds) {
          try {
            const character = await loadCharacterArchive().then(chars => chars.find(c => c.id === characterId));
            if (!character) continue;

            taskManager.updateTask(taskId, {
              name: `生成帖子: ${character.name}`,
            });

            const generated = await generateForumPost(
              {
                characterId,
                characterName: character.name,
                gameDate,
                todayEvents,
              },
              forcedStyle,
            );

            if (generated) {
              // 保存帖子
              const post = await saveForumPost({
                characterId,
                characterName: character.name,
                identityType: generated.post.identityType,
                authorName: generated.post.authorName,
                title: generated.post.title,
                content: generated.post.content,
                gameDate,
                postType: generated.post.postType,
                tags: generated.post.tags,
                generationMode: 'manual',
                todayEvents,
              });

              // 保存评论
              for (const commentData of generated.comments) {
                try {
                  await addForumComment({
                    ...commentData,
                    postId: post.id,
                  });
                } catch (e) {
                  console.warn('[backgroundForum] 保存评论失败:', e);
                }
              }

              post.comments = generated.comments.length;
              newPosts.push(post);
              console.log(`[backgroundForum] ✅ 角色帖子生成成功: ${post.title}`);
            }
          } catch (e) {
            console.error(`[backgroundForum] 生成角色帖子失败:`, e);
          }

          currentCount++;
          taskManager.setTaskProgress(taskId, currentCount, totalCount);
        }
      }

      // 生成随机网友帖子
      if (generateMode === 'random' || generateMode === 'mixed') {
        const count = generateMode === 'random' ? randomUserCount : (randomUserCount - (characterIds.length > 0 ? 0 : 0));
        for (let i = 0; i < count; i++) {
          try {
            taskManager.updateTask(taskId, {
              name: `生成网友帖子 ${i + 1}/${count}`,
            });

            const generated = await generateRandomUserPost(gameDate, todayEvents, forcedStyle);
            if (generated) {
              // 保存帖子
              const post = await saveForumPost({
                characterId: `random-${Date.now()}-${i}`,
                characterName: generated.post.authorName,
                identityType: generated.post.identityType,
                authorName: generated.post.authorName,
                title: generated.post.title,
                content: generated.post.content,
                gameDate,
                postType: generated.post.postType,
                tags: generated.post.tags,
                generationMode: 'manual',
                todayEvents,
              });

              // 保存评论
              for (const commentData of generated.comments) {
                try {
                  await addForumComment({
                    ...commentData,
                    postId: post.id,
                  });
                } catch (e) {
                  console.warn('[backgroundForum] 保存随机网友评论失败:', e);
                }
              }

              post.comments = generated.comments.length;
              newPosts.push(post);
              console.log(`[backgroundForum] ✅ 网友帖子生成成功: ${post.title}`);
            }
          } catch (e) {
            console.error(`[backgroundForum] 生成网友帖子失败:`, e);
          }

          currentCount++;
          taskManager.setTaskProgress(taskId, currentCount, totalCount);
        }
      }

      taskManager.completeTask(taskId);
      onComplete?.(newPosts);

      // 触发回调通知UI刷新
      manualTriggerCallbacks.forEach(cb => cb(newPosts));
    } catch (e) {
      console.error('[backgroundForum] 批量生成失败:', e);
      taskManager.errorTask(taskId, e instanceof Error ? e.message : '生成失败');
    }
  }, 0);

  return taskId;
}
