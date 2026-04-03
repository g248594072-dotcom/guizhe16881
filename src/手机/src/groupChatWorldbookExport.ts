/**
 * 群聊世界书导出模块
 * 负责导出群聊会话和消息，用于同步到世界书
 */

import { loadWeChatThreadForScope } from './weChatStorage';
import type { WeChatStoredMessage } from './weChatStorage';
import type { GroupChatSession, GroupChatMessage } from './groupChat';

/** 群聊线程导出结构 */
export type GroupChatThreadExport = {
  /** 群聊会话信息 */
  session: GroupChatSession;
  /** 群聊消息列表 */
  messages: GroupChatMessage[];
  /** 最后更新时间 */
  lastActivity: number;
};

const GROUP_CHAT_STORAGE_KEY = 'tavern_phone_group_chat_list';

/**
 * 获取群聊列表存储键（按 chatScopeId 隔离）
 */
function getGroupChatStorageKey(chatScopeId: string): string {
  return `${GROUP_CHAT_STORAGE_KEY}:${chatScopeId}`;
}

/**
 * 从 localStorage 加载群聊列表
 */
function loadGroupChatListFromStorage(chatScopeId: string): { version: number; sessions: GroupChatSession[]; currentSessionId: string | null } {
  const key = getGroupChatStorageKey(chatScopeId);
  try {
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data) as { version: number; sessions: GroupChatSession[]; currentSessionId: string | null };
      if (parsed.version === 1) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[GroupChatExport] 加载群聊列表失败:', e);
  }
  return {
    version: 1,
    sessions: [],
    currentSessionId: null,
  };
}

/**
 * 导出指定 scope 下的所有群聊线程
 */
export async function exportGroupChatThreadsForScope(chatScopeId: string): Promise<GroupChatThreadExport[]> {
  const listData = loadGroupChatListFromStorage(chatScopeId);
  if (listData.sessions.length === 0) {
    return [];
  }

  const exports: GroupChatThreadExport[] = [];

  for (const session of listData.sessions) {
    try {
      // 群聊消息使用 session.id 作为 roleId 存储
      const messages = await loadWeChatThreadForScope(chatScopeId, session.id) as GroupChatMessage[];
      if (messages.length > 0) {
        exports.push({
          session,
          messages,
          lastActivity: session.lastActivity,
        });
      }
    } catch (e) {
      console.error(`[GroupChatExport] 导出群聊 ${session.name} 失败:`, e);
    }
  }

  // 按最后活动时间排序（最新的在前）
  exports.sort((a, b) => b.lastActivity - a.lastActivity);

  return exports;
}

/**
 * 格式化群聊消息为世界书条目内容
 */
export function formatGroupChatWorldbookBlock(
  groupName: string,
  members: { id: string; displayName: string }[],
  messages: GroupChatMessage[],
): string {
  if (messages.length === 0) {
    return '';
  }

  const memberNames = members.map(m => m.displayName).join('、');
  let block = `\n\n===== ${groupName} 群聊记录 =====\n`;
  block += `群成员：${memberNames}\n`;
  block += `消息数：${messages.length}\n`;
  block += `===================\n\n`;

  for (const msg of messages) {
    const time = new Date(msg.time).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const sender = msg.senderName || (msg.role === 'user' ? '我' : 'AI');

    // 跳过系统撤回提示消息
    if (msg.role === 'system' && msg.systemType === 'retract') {
      block += `[${time}] ${sender}: 撤回了一条消息\n`;
      continue;
    }

    block += `[${time}] ${sender}: ${msg.content}\n`;
  }

  block += `\n===== 群聊记录结束 =====\n\n`;

  return block;
}

/**
 * 获取群聊同步状态（最后同步的消息ID/时间）
 */
export function getGroupChatWbSyncLastId(
  chatVars: Record<string, unknown>,
  statePath: string,
  scopeKey: string,
  sessionId: string,
): number {
  try {
    const path = `${statePath}.${scopeKey}.group.${sessionId}.lastId`;
    const parts = path.split('.');
    let cur: unknown = chatVars;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return -1;
      cur = (cur as Record<string, unknown>)[p];
    }
    if (typeof cur === 'number') return cur;
    if (typeof cur === 'string') {
      const n = Number(cur);
      return Number.isFinite(n) ? n : -1;
    }
  } catch {
    // ignore
  }
  return -1;
}

/**
 * 设置群聊同步状态
 */
export function setGroupChatWbSyncLastId(
  chatVars: Record<string, unknown>,
  statePath: string,
  scopeKey: string,
  sessionId: string,
  lastId: number,
): Record<string, unknown> {
  const path = `${statePath}.${scopeKey}.group.${sessionId}.lastId`;
  const parts = path.split('.');
  const root = { ...chatVars };
  let cur: Record<string, unknown> = root;

  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const existing = cur[p];
    cur[p] =
      existing != null && typeof existing === 'object'
        ? { ...(existing as Record<string, unknown>) }
        : {};
    cur = cur[p] as Record<string, unknown>;
  }

  cur[parts[parts.length - 1]] = lastId;
  return root;
}

/**
 * 筛选新的群聊消息（基于消息ID）
 */
export function sliceNewGroupChatMessages(
  messages: GroupChatMessage[],
  lastSyncId: number,
): GroupChatMessage[] {
  if (lastSyncId < 0 || messages.length === 0) {
    return messages;
  }

  // 找到 lastSyncId 对应的消息索引
  const lastIndex = messages.findIndex(m => {
    if (typeof m.lastId === 'number') {
      return m.lastId === lastSyncId;
    }
    return false;
  });

  if (lastIndex >= 0) {
    return messages.slice(lastIndex + 1);
  }

  // 如果找不到（可能是新会话或ID不连续），返回全部消息
  return messages;
}
