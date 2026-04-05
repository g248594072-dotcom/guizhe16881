/**
 * 朋友圈自动生成调度器
 * 监听游戏时间变化和消息楼层，自动为角色生成朋友圈动态
 * 触发方式：
 * 1. 按消息楼层（随机5-10楼）
 * 2. 按游戏时间（2-4小时）
 */

import { generateMoment, generateCommentsForMoment, getRandomContentType, generateBatchMoments } from './momentsGenerator';
import {
  saveMoment,
  addComment,
  shouldAutoGenerateMoment,
  updateLastGeneratedDate,
  getMomentsGlobalSettings,
  initMomentMeta,
  type Moment,
  type MomentComment,
} from './momentsIndexedDb';
import { loadCharacterArchive, type PhoneCharacterArchive } from './characterArchive/bridge';
import { subscribeGameDateChange } from './tavernPhoneBridge';
import { getTaskManager } from './components/BackgroundTaskManager';
import type { MomentContentType, GeneratedMoment } from './types/moments';

/** 当前游戏日期缓存 */
let currentGameDate: string | null = null;

/** 消息楼层计数器 */
let messageCounter = 0;

/** 下次触发需要的消息数（动态从设置读取） */
let nextTriggerAt = 5 + Math.floor(Math.random() * 6);

/** 上次按游戏时间触发的日期时间记录（格式: 日期_小时） */
let lastGameTimeTrigger = '';

/** 正在生成的角色集合（防止重复生成） */
const generatingSet = new Set<string>();

/** 手动触发回调列表 */
const manualTriggerCallbacks: Array<(moments: Moment[]) => void> = [];

/**
 * 根据设置计算下次触发的消息数
 */
async function updateNextTriggerFromSettings(): Promise<void> {
  const settings = await getMomentsGlobalSettings();
  const { min, max } = settings.intervalMessages;
  nextTriggerAt = min + Math.floor(Math.random() * (max - min + 1));
  console.log(`[momentsScheduler] 下次消息触发阈值: ${nextTriggerAt} (范围 ${min}-${max})`);
}

/**
 * 从 MVU 变量中获取当前游戏日期
 */
export async function fetchCurrentGameDate(): Promise<string | null> {
  try {
    // 尝试从 window 对象获取（壳脚本会注入）
    const w = window as unknown as Record<string, unknown>;
    const dateFromWindow = w.__GAME_DATE__ || w.__CURRENT_GAME_DATE__;
    if (typeof dateFromWindow === 'string' && dateFromWindow) {
      return normalizeDate(dateFromWindow);
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
    console.warn('[momentsScheduler] 获取游戏日期失败:', e);
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
    const month = String(parseInt(parts[1]!, 10)).padStart(2, '0');
    const day = String(parseInt(parts[2]!, 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return formatDate(new Date());
}

/**
 * 检查并自动为需要生成的角色生成朋友圈动态
 * 基于游戏日期变化触发
 */
export async function checkAndAutoGenerateMoments(newGameDate: string): Promise<Moment[]> {
  currentGameDate = newGameDate;

  const settings = await getMomentsGlobalSettings();
  if (!settings.autoGenerateEnabled) {
    return [];
  }

  try {
    const characters = await loadCharacterArchive();
    const activeCharacters = characters.filter(c => c.status === '出场中');

    if (!activeCharacters.length) {
      console.log('[momentsScheduler] 没有出场中的角色可生成朋友圈');
      return [];
    }

    const generatedMoments: Moment[] = [];

    for (const character of activeCharacters) {
      // 检查是否应该生成（避免重复生成同一天）
      const shouldGenerate = await shouldAutoGenerateMoment(character.id, newGameDate);
      if (!shouldGenerate) continue;

      // 随机选择内容类型
      const contentType = getRandomContentType();

      const generated = await generateMoment({
        characterId: character.id,
        characterName: character.name,
        contentType,
        gameDate: newGameDate,
      });

      if (generated) {
        // 保存动态
        const moment = await saveMoment({
          id: crypto.randomUUID(),
          characterId: character.id,
          characterName: character.name,
          characterAvatar: character.avatarUrl,
          content: generated.content,
          contentType: generated.contentType,
          visibility: generated.visibility,
          gameDate: newGameDate,
          gameTime: formatGameTime(new Date()),
          createdAt: Date.now(),
          likes: [],
          comments: [],
          generationMode: 'auto',
          location: generated.location,
          selfJustification: generated.selfJustification,
        });

        // 更新最后生成日期
        await updateLastGeneratedDate(character.id, newGameDate);

        // 生成评论
        const comments = await generateCommentsForMoment(moment, characters, 5);
        for (const commentData of comments) {
          const comment: MomentComment = {
            id: crypto.randomUUID(),
            ...commentData,
            timestamp: Date.now(),
            likes: [],
          };
          await addComment(comment);
        }

        generatedMoments.push(moment);
        console.log(`[momentsScheduler] ✅ 自动生成朋友圈成功: ${character.name} - ${generated.contentType}`);
      }

      // 延迟避免请求过快
      await new Promise(r => setTimeout(r, 300));
    }

    // 通知回调
    if (generatedMoments.length > 0) {
      manualTriggerCallbacks.forEach(cb => cb(generatedMoments));
    }

    return generatedMoments;

  } catch (e) {
    console.error('[momentsScheduler] 自动检查朋友圈生成失败:', e);
    return [];
  }
}

/**
 * 基于消息楼层触发朋友圈生成
 * 每5-10条消息触发一次
 */
export async function triggerMomentByMessageCount(): Promise<Moment[]> {
  messageCounter++;

  if (messageCounter < nextTriggerAt) {
    return [];
  }

  // 重置计数器和下次触发阈值
  messageCounter = 0;
  nextTriggerAt = 5 + Math.floor(Math.random() * 6); // 5-10随机

  console.log(`[momentsScheduler] 消息楼层达到阈值，触发朋友圈生成`);

  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());
  return checkAndAutoGenerateMoments(gameDate);
}

/**
 * 手动为指定角色生成朋友圈（立即生成）
 */
export async function manualGenerateMoment(
  characterId: string,
  characterName: string,
  contentType?: MomentContentType,
  todayEvents?: string,
): Promise<Moment | null> {
  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());

  // 防止重复生成
  if (generatingSet.has(characterId)) {
    console.log(`[momentsScheduler] ${characterName} 正在生成中，跳过`);
    return null;
  }

  generatingSet.add(characterId);

  try {
    const contentTypeToUse = contentType || getRandomContentType();

    const generated = await generateMoment({
      characterId,
      characterName,
      contentType: contentTypeToUse,
      gameDate,
      todayEvents,
    });

    if (!generated) {
      return null;
    }

    // 加载角色档案获取头像
    const characters = await loadCharacterArchive();
    const character = characters.find(c => c.id === characterId);

    // 保存动态
    const moment = await saveMoment({
      id: crypto.randomUUID(),
      characterId,
      characterName,
      characterAvatar: character?.avatarUrl,
      content: generated.content,
      contentType: generated.contentType,
      visibility: generated.visibility,
      gameDate,
      gameTime: formatGameTime(new Date()),
      createdAt: Date.now(),
      likes: [],
      comments: [],
      generationMode: 'manual',
      location: generated.location,
      selfJustification: generated.selfJustification,
    });

    // 更新元数据
    await updateLastGeneratedDate(characterId, gameDate);

    // 生成评论
    const comments = await generateCommentsForMoment(moment, characters, 5);
    for (const commentData of comments) {
      const comment: MomentComment = {
        id: crypto.randomUUID(),
        ...commentData,
        timestamp: Date.now(),
        likes: [],
      };
      await addComment(comment);
    }

    console.log(`[momentsScheduler] ✅ 手动生成朋友圈成功: ${moment.characterName}`);

    // 触发回调
    manualTriggerCallbacks.forEach(cb => cb([moment]));

    return moment;

  } catch (e) {
    console.error('[momentsScheduler] 手动生成朋友圈失败:', e);
    return null;
  } finally {
    generatingSet.delete(characterId);
  }
}

/**
 * 批量手动生成朋友圈（为所有出场中的角色）
 */
export async function batchManualGenerateMoments(
  todayEvents?: string,
  onProgress?: (current: number, total: number, name: string, success: boolean) => void,
): Promise<Moment[]> {
  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());
  const moments: Moment[] = [];

  try {
    const characters = await loadCharacterArchive();
    const activeCharacters = characters.filter(c => c.status === '出场中');

    if (!activeCharacters.length) {
      console.log('[momentsScheduler] 没有出场中的角色可生成朋友圈');
      return [];
    }

    for (let i = 0; i < activeCharacters.length; i++) {
      const character = activeCharacters[i]!;

      const moment = await manualGenerateMoment(
        character.id,
        character.name,
        undefined,
        todayEvents,
      );

      const success = !!moment;
      if (moment) {
        moments.push(moment);
      }

      onProgress?.(i + 1, activeCharacters.length, character.name, success);

      // 延迟避免请求过快
      await new Promise(r => setTimeout(r, 500));
    }

    return moments;

  } catch (e) {
    console.error('[momentsScheduler] 批量生成朋友圈失败:', e);
    return [];
  }
}

/**
 * 后台批量生成朋友圈
 * 使用任务管理器在后台执行
 */
export async function backgroundBatchGenerateMoments(
  options: {
    characterIds?: string[];
    todayEvents?: string;
  },
  onComplete?: (moments: Moment[]) => void,
): Promise<string> {
  const taskManager = getTaskManager();
  const gameDate = currentGameDate || (await fetchCurrentGameDate()) || formatDate(new Date());

  const { characterIds = [], todayEvents } = options;

  // 如果没有指定角色，获取所有出场中的角色
  let targetChars: PhoneCharacterArchive[] = [];
  if (characterIds.length > 0) {
    const allChars = await loadCharacterArchive();
    targetChars = allChars.filter(c => characterIds.includes(c.id) && c.status === '出场中');
  } else {
    const allChars = await loadCharacterArchive();
    targetChars = allChars.filter(c => c.status === '出场中');
  }

  if (targetChars.length === 0) {
    throw new Error('没有可生成朋友圈的角色');
  }

  // 添加任务
  const taskId = taskManager.addTask({
    type: 'moment_generation',
    name: `生成${targetChars.length}个角色的朋友圈`,
    progress: 0,
    current: 0,
    total: targetChars.length,
  });

  // 在后台执行
  setTimeout(async () => {
    taskManager.updateTask(taskId, { status: 'running' });
    const newMoments: Moment[] = [];
    const allCharacters = await loadCharacterArchive();

    for (let i = 0; i < targetChars.length; i++) {
      const character = targetChars[i]!;

      try {
        taskManager.updateTask(taskId, {
          name: `生成朋友圈: ${character.name}`,
        });

        const contentType = getRandomContentType();

        const generated = await generateMoment({
          characterId: character.id,
          characterName: character.name,
          contentType,
          gameDate,
          todayEvents,
        });

        if (generated) {
          // 保存动态
          const moment = await saveMoment({
            id: crypto.randomUUID(),
            characterId: character.id,
            characterName: character.name,
            characterAvatar: character.avatarUrl,
            content: generated.content,
            contentType: generated.contentType,
            visibility: generated.visibility,
            gameDate,
            gameTime: formatGameTime(new Date()),
            createdAt: Date.now(),
            likes: [],
            comments: [],
            generationMode: 'auto',
            location: generated.location,
            selfJustification: generated.selfJustification,
          });

          // 更新元数据
          await updateLastGeneratedDate(character.id, gameDate);

          // 生成评论
          const comments = await generateCommentsForMoment(moment, allCharacters, 5);
          for (const commentData of comments) {
            const comment: MomentComment = {
              id: crypto.randomUUID(),
              ...commentData,
              timestamp: Date.now(),
              likes: [],
            };
            await addComment(comment);
          }

          newMoments.push(moment);
          console.log(`[backgroundMoments] ✅ 朋友圈生成成功: ${moment.characterName}`);
        }
      } catch (e) {
        console.error(`[backgroundMoments] 生成朋友圈失败:`, e);
      }

      taskManager.setTaskProgress(taskId, i + 1, targetChars.length);

      // 延迟避免请求过快
      await new Promise(r => setTimeout(r, 500));
    }

    if (newMoments.length > 0) {
      taskManager.completeTask(taskId);
      onComplete?.(newMoments);
      // 注意：手动生成的回调通过 onComplete 传递，不要触发 manualTriggerCallbacks
      // 避免 UI 层重复添加相同数据
    } else {
      taskManager.errorTask(taskId, '没有成功生成任何朋友圈');
    }
  }, 0);

  return taskId;
}

/**
 * 格式化游戏时间 HH:MM
 */
function formatGameTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 设置当前游戏日期
 */
export function setCurrentGameDate(date: string): void {
  currentGameDate = date;
}

/**
 * 注册手动触发的回调
 */
export function onNewMomentsGenerated(callback: (moments: Moment[]) => void): () => void {
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
export function initMomentsScheduler(): () => void {
  // 初始获取日期
  fetchCurrentGameDate().then(date => {
    if (date) {
      currentGameDate = date;
    }
  });

  // 订阅壳脚本推送的游戏日期变化
  const unsubscribeGameDate = subscribeGameDateChange(newDate => {
    if (newDate && newDate !== currentGameDate) {
      console.log('[momentsScheduler] 壳脚本推送日期变化:', currentGameDate, '->', newDate);
      void checkAndAutoGenerateMoments(newDate);
    }
  });

  // 定期检查日期变化（作为备用机制）
  const intervalId = window.setInterval(async () => {
    const newDate = await fetchCurrentGameDate();
    if (newDate && newDate !== currentGameDate) {
      console.log('[momentsScheduler] 检测到日期变化:', currentGameDate, '->', newDate);
      await checkAndAutoGenerateMoments(newDate);
    }
  }, 30000); // 每30秒检查一次

  // 监听新消息事件（通过酒馆助手接口）
  const messageCheckInterval = window.setInterval(() => {
    // 这里可以通过某种方式检测新消息
    // 暂时由外部调用 triggerMomentByMessageCount 来触发
  }, 10000); // 每10秒检查一次

  return () => {
    clearInterval(intervalId);
    clearInterval(messageCheckInterval);
    unsubscribeGameDate();
  };
}

/**
 * 更新设置并重新初始化触发阈值
 * 当用户修改设置后调用，重新计算下次触发阈值
 */
export async function updateSettingsAndReinit(): Promise<void> {
  await updateNextTriggerFromSettings();
  console.log('[momentsScheduler] 设置已更新，重新初始化触发阈值');
}
