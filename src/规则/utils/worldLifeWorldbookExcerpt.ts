/**
 * 为世界大势 / 居民生活第二 API 拉取「角色卡绑定世界书」与「chatScopeId 同名世界书」节选。
 */

import type { WorldbookEntry } from '../types';
import { getCharBoundWorldbookName } from './charBoundWorldbookName';

declare const SillyTavern: { getCurrentChatId?: () => string };

/** 单侧世界书正文聚合上限（字符） */
const MAX_SIDE_CHARS = 5200;

export function getChatScopeWorldbookName(): string {
  return String(SillyTavern.getCurrentChatId?.() ?? '').trim();
}

function aggregateEnabledEntries(entries: WorldbookEntry[]): string {
  const parts: string[] = [];
  for (const e of entries) {
    if (e.enabled === false) continue;
    const c = String(e.content ?? '').trim();
    if (!c) continue;
    const title = String(e.name ?? '条目').trim() || '条目';
    parts.push(`### ${title}\n${c}`);
  }
  return parts.join('\n\n---\n\n');
}

function clampText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n…（已截断，以下为部分内容）`;
}

async function fetchWorldbookExcerpt(worldbookName: string): Promise<string> {
  if (!worldbookName.trim()) return '';
  try {
    const entries = await getWorldbook(worldbookName.trim());
    const raw = aggregateEnabledEntries(entries);
    return clampText(raw, MAX_SIDE_CHARS);
  } catch (e) {
    console.warn('[WorldLifeWB] 读取世界书失败:', worldbookName, e);
    return '';
  }
}

export async function buildDualWorldbookExcerptsForPrompt(): Promise<{
  charSection: string;
  chatSection: string;
  combinedForLog: string;
}> {
  const charName = getCharBoundWorldbookName().trim();
  const chatName = getChatScopeWorldbookName();

  let charSection = '';
  let chatSection = '';
  const logBits: string[] = [];

  if (!charName) {
    console.info('[WorldLifeWB] 角色卡绑定世界书名为空，跳过');
  } else {
    charSection = await fetchWorldbookExcerpt(charName);
    logBits.push(`char:${charName}(${charSection.length})`);
  }

  if (!chatName) {
    console.info('[WorldLifeWB] chatScopeId 为空，跳过聊天同名世界书');
  } else if (chatName === charName) {
    console.info('[WorldLifeWB] 聊天同名世界书与角色绑定书名相同，去重仅保留角色卡绑定一节');
  } else {
    let names: string[] = [];
    try {
      names = getWorldbookNames();
    } catch {
      names = [];
    }
    if (!names.includes(chatName)) {
      console.info('[WorldLifeWB] 不存在与 chatScopeId 同名的世界书，跳过:', chatName);
    } else {
      chatSection = await fetchWorldbookExcerpt(chatName);
      logBits.push(`chat:${chatName}(${chatSection.length})`);
    }
  }

  const combinedForLog = logBits.join(' ');
  if (combinedForLog) {
    console.info('[WorldLifeWB] 世界书节选已构建:', combinedForLog);
  }

  return { charSection, chatSection, combinedForLog };
}
