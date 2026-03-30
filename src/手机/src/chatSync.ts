/**
 * 正文联动模块
 * 负责：
 * 1. 将聊天记录同步到世界书
 * 2. 生成和更新剧情摘要
 * 3. 与酒馆变量联动
 * 4. 租客状态变化检测
 */

import {
  emitMessageSent,
  emitMessageReceived,
  emitChatChanged,
  emitWorldbookSynced,
  emitMemoryUpdated,
  emitContextRefreshed,
  phoneEvents,
} from './phoneEvents';
import {
  requestWritePhoneMemory,
  requestTavernPhoneContext,
  subscribeChatScopeChange,
  type TavernPhoneContextPayload,
} from './tavernPhoneBridge';
import type { WeChatStoredMessage } from './weChatStorage';
import {
  loadWeChatThreadForScope,
  saveWeChatThreadForScope,
} from './weChatStorage';
import { summarizePhoneExchangeForMemory, summarizeGroupChatForMemory } from './chatCompletions';
import { LOCAL_OFFLINE_SCOPE } from './weChatScope';

// ==================== 配置 ====================

export interface ChatSyncConfig {
  /** 是否启用即时同步（每条消息后立即同步记忆） */
  instantSyncEnabled: boolean;
  /** 即时同步防抖延迟（毫秒） */
  syncDebounceMs: number;
  /** 同步到世界书的间隔（毫秒），0 表示不自动同步 */
  worldbookSyncInterval: number;
  /** 每次同步的最大消息数 */
  maxSyncMessages: number;
}

const DEFAULT_CONFIG: ChatSyncConfig = {
  instantSyncEnabled: true,
  syncDebounceMs: 2000,
  worldbookSyncInterval: 0, // 默认关闭，由 shell 脚本控制
  maxSyncMessages: 50,
};

// ==================== 状态 ====================

class ChatSyncState {
  private config: ChatSyncConfig = { ...DEFAULT_CONFIG };
  private syncDebounceTimers: Map<string, number> = new Map();
  private syncInProgress: Set<string> = new Set();
  private lastSyncedMessageIds: Map<string, string> = new Map();

  getConfig(): ChatSyncConfig {
    return { ...this.config };
  }

  setConfig(cfg: Partial<ChatSyncConfig>): void {
    this.config = { ...this.config, ...cfg };
  }

  setSyncDebounceTimer(key: string, timerId: number): void {
    this.clearSyncDebounceTimer(key);
    this.syncDebounceTimers.set(key, timerId);
  }

  clearSyncDebounceTimer(key: string): void {
    const existing = this.syncDebounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.syncDebounceTimers.delete(key);
    }
  }

  isSyncing(key: string): boolean {
    return this.syncInProgress.has(key);
  }

  setSyncing(key: string, value: boolean): void {
    if (value) {
      this.syncInProgress.add(key);
    } else {
      this.syncInProgress.delete(key);
    }
  }

  getLastSyncedMessageId(key: string): string | undefined {
    return this.lastSyncedMessageIds.get(key);
  }

  setLastSyncedMessageId(key: string, id: string): void {
    this.lastSyncedMessageIds.set(key, id);
  }

  clearAll(): void {
    for (const timerId of this.syncDebounceTimers.values()) {
      clearTimeout(timerId);
    }
    this.syncDebounceTimers.clear();
    this.syncInProgress.clear();
  }
}

export const chatSyncState = new ChatSyncState();

// ==================== 消息同步 ====================

/**
 * 生成对话摘要并写入酒馆变量
 */
async function syncMessageToMemory(
  chatScopeId: string,
  contactId: string,
  messages: WeChatStoredMessage[],
): Promise<boolean> {
  try {
    const summary = await summarizePhoneExchangeForMemory(
      messages.map(m => ({ role: m.role, content: m.content })),
    );

    const result = await requestWritePhoneMemory({
      contactId,
      chatScopeId,
      summary,
    });

    if (result.ok) {
      emitMemoryUpdated(contactId, summary);
      return true;
    } else {
      console.warn('[ChatSync] 写入记忆失败:', result.error);
      return false;
    }
  } catch (e) {
    console.error('[ChatSync] 同步记忆失败:', e);
    return false;
  }
}

/**
 * 触发即时同步（带防抖）
 */
export function triggerInstantSync(
  chatScopeId: string,
  contactId: string,
): void {
  const cfg = chatSyncState.getConfig();
  if (!cfg.instantSyncEnabled) return;

  const key = `${chatScopeId}:${contactId}`;

  chatSyncState.clearSyncDebounceTimer(key);

  const timerId = window.setTimeout(async () => {
    chatSyncState.clearSyncDebounceTimer(key);
    await performSync(chatScopeId, contactId);
  }, cfg.syncDebounceMs);

  chatSyncState.setSyncDebounceTimer(key, timerId);
}

/**
 * 执行同步
 */
async function performSync(chatScopeId: string, contactId: string): Promise<boolean> {
  const key = `${chatScopeId}:${contactId}`;

  if (chatSyncState.isSyncing(key)) {
    console.warn('[ChatSync] 同步正在进行中，跳过');
    return false;
  }

  chatSyncState.setSyncing(key, true);

  try {
    const messages = await loadWeChatThreadForScope(chatScopeId, contactId);
    if (messages.length === 0) {
      return true;
    }

    // 只同步最近的 N 条
    const recentMessages = messages.slice(-chatSyncState.getConfig().maxSyncMessages);
    return await syncMessageToMemory(chatScopeId, contactId, recentMessages);
  } finally {
    chatSyncState.setSyncing(key, false);
  }
}

/**
 * 强制立即同步（跳过防抖）
 */
export async function forceSyncNow(
  chatScopeId: string,
  contactId: string,
): Promise<boolean> {
  const key = `${chatScopeId}:${contactId}`;
  chatSyncState.clearSyncDebounceTimer(key);
  chatSyncState.setSyncing(key, false);
  return await performSync(chatScopeId, contactId);
}

// ==================== 世界书同步 ====================

/**
 * 世界书同步配置
 */
export interface WorldbookSyncConfig {
  enabled: boolean;
  worldbookName: string;
  entryPrefix: string;
  strategy: 'constant' | 'selective';
  keys: string[];
}

let worldbookSyncConfig: WorldbookSyncConfig | null = null;

export function setWorldbookSyncConfig(cfg: WorldbookSyncConfig): void {
  worldbookSyncConfig = cfg;
}

export function getWorldbookSyncConfig(): WorldbookSyncConfig | null {
  return worldbookSyncConfig;
}

/**
 * 导出线程用于世界书同步（供 shell 脚本调用）
 */
export async function exportThreadsForWorldbookSync(
  chatScopeId: string,
  contactIds: string[],
): Promise<Array<{ roleId: string; conversationId: string; messages: WeChatStoredMessage[] }>> {
  const result: Array<{ roleId: string; conversationId: string; messages: WeChatStoredMessage[] }> = [];

  for (const contactId of contactIds) {
    const messages = await loadWeChatThreadForScope(chatScopeId, contactId);
    const lastSyncedId = chatSyncState.getLastSyncedMessageId(`${chatScopeId}:${contactId}`);

    // 只返回增量消息
    let newMessages = messages;
    if (lastSyncedId) {
      const idx = messages.findIndex(m => m.id === lastSyncedId);
      if (idx >= 0) {
        newMessages = messages.slice(idx + 1);
      }
    }

    if (newMessages.length > 0) {
      result.push({
        roleId: contactId,
        conversationId: `${chatScopeId}:${contactId}`,
        messages: newMessages,
      });
      // 更新同步指针
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        chatSyncState.setLastSyncedMessageId(`${chatScopeId}:${contactId}`, lastMsg.id);
      }
    }
  }

  return result;
}

// ==================== 事件监听 ====================

let initialized = false;

/**
 * 初始化聊天同步系统
 */
export function initChatSync(): void {
  if (initialized) return;
  initialized = true;

  // 监听聊天切换
  subscribeChatScopeChange((scope) => {
    const chatScopeId = scope ?? LOCAL_OFFLINE_SCOPE;
    emitChatChanged(chatScopeId);
  });

  console.log('[ChatSync] 已初始化');
}

// ==================== 工具函数 ====================

/**
 * 格式化消息为可读文本
 */
export function formatMessagesForExport(
  messages: WeChatStoredMessage[],
  options?: { maxLength?: number },
): string {
  const maxLength = options?.maxLength ?? 2000;
  const lines = messages.map(m => {
    const who = m.role === 'user' ? '我' : '对方';
    const time = new Date(m.time).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `[${time}] ${who}：${m.content}`;
  });

  let result = lines.join('\n');
  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + '\n...（内容已截断）';
  }

  return result;
}

/**
 * 生成世界书条目内容
 */
export function buildWorldbookEntryContent(
  displayName: string,
  messages: WeChatStoredMessage[],
  timestamp?: number,
): string {
  const timeStr = timestamp
    ? new Date(timestamp).toLocaleString('zh-CN')
    : new Date().toLocaleString('zh-CN');

  const header = `--- [微信聊天 · ${displayName} · ${timeStr}] ---\n`;
  const content = formatMessagesForExport(messages);
  return header + content;
}

/**
 * 清理旧的世界书同步指针
 */
export function clearSyncPointers(): void {
  chatSyncState.clearAll();
  console.log('[ChatSync] 同步指针已清除');
}

// ==================== 导出 ====================

export {
  triggerInstantSync,
  forceSyncNow,
  initChatSync,
};
