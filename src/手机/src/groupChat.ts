/**
 * 群聊逻辑模块
 * 负责：
 * 1. 群聊会话管理
 * 2. 群聊消息生成
 * 3. 多成员回复协调
 */

import type { WeChatStoredMessage } from './weChatStorage';
import {
  completeGroupChatReply,
  parseGroupChatReply,
  type GroupMember,
  type GroupChatContext,
} from './chatCompletions';
import {
  emitMessageSent,
  emitMessageReceived,
} from './phoneEvents';
import { saveWeChatThreadForScope, loadWeChatThreadForScope } from './weChatStorage';

// ==================== 类型定义 ====================

export interface GroupChatSession {
  id: string;
  name: string;
  members: GroupMember[];
  createdAt: number;
  lastActivity: number;
}

export interface GroupChatMessage extends WeChatStoredMessage {
  senderId: string;
  senderName: string;
}

// ==================== 配置 ====================

const GROUP_CHAT_CONFIG = {
  /** 默认群名称 */
  defaultGroupName: '公寓业主群',
  /** 单次生成最多回复几个成员 */
  maxRepliesPerTurn: 3,
  /** 回复之间的时间间隔（毫秒）模拟真实感 */
  replyDelay: 1500,
  /** 是否启用多成员回复 */
  multiReply: true,
};

// ==================== 群聊状态 ====================

class GroupChatState {
  private sessions: Map<string, GroupChatSession> = new Map();
  private currentSession: string | null = null;

  getSession(id: string): GroupChatSession | undefined {
    return this.sessions.get(id);
  }

  setSession(session: GroupChatSession): void {
    this.sessions.set(session.id, session);
  }

  getCurrentSession(): GroupChatSession | null {
    if (!this.currentSession) return null;
    return this.sessions.get(this.currentSession) ?? null;
  }

  setCurrentSession(id: string | null): void {
    this.currentSession = id;
  }

  getAllSessions(): GroupChatSession[] {
    return Array.from(this.sessions.values());
  }

  updateLastActivity(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivity = Date.now();
      this.sessions.set(id, session);
    }
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
    if (this.currentSession === id) {
      this.currentSession = null;
    }
  }
}

export const groupChatState = new GroupChatState();

// ==================== 群聊管理 ====================

/**
 * 创建群聊会话
 */
export function createGroupChatSession(
  id: string,
  name: string,
  members: GroupMember[],
): GroupChatSession {
  const session: GroupChatSession = {
    id,
    name,
    members,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  groupChatState.setSession(session);
  return session;
}

/**
 * 获取或创建群聊会话
 */
export function getOrCreateGroupChatSession(
  chatScopeId: string,
  members: GroupMember[],
): GroupChatSession {
  const sessionId = `group:${chatScopeId}`;
  const existing = groupChatState.getSession(sessionId);
  if (existing) {
    // 更新成员列表
    existing.members = members;
    groupChatState.setSession(existing);
    return existing;
  }
  return createGroupChatSession(sessionId, GROUP_CHAT_CONFIG.defaultGroupName, members);
}

/**
 * 更新群聊成员
 */
export function updateGroupChatMembers(sessionId: string, members: GroupMember[]): void {
  const session = groupChatState.getSession(sessionId);
  if (session) {
    session.members = members;
    groupChatState.setSession(session);
  }
}

/**
 * 设置当前活跃的群聊会话
 */
export function setCurrentGroupChatSession(sessionId: string | null): void {
  groupChatState.setCurrentSession(sessionId);
}

// ==================== 群聊消息生成 ====================

/**
 * 生成群聊回复（多成员响应）
 */
export async function generateGroupChatReplies(
  ctx: GroupChatContext,
  userMessage: string,
  chatScopeId: string,
): Promise<GroupChatMessage[]> {
  const session = groupChatState.getCurrentSession();
  if (!session) {
    throw new Error('当前没有活跃的群聊会话');
  }

  // 获取历史消息
  const history = await loadWeChatThreadForScope(chatScopeId, session.id);
  const historyForApi = history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
    sender: (m as GroupChatMessage).senderName,
  }));

  // 构建带用户消息的历史
  const userMsg: GroupChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: userMessage,
    senderId: '<user>',
    senderName: '房东',
    time: Date.now(),
  };
  const fullHistory = [...history, userMsg];
  const fullHistoryForApi = [...historyForApi, { role: 'user' as const, content: userMessage, sender: '房东' }];

  // 保存用户消息
  await saveWeChatThreadForScope(chatScopeId, session.id, fullHistory);
  emitMessageSent(chatScopeId, session.id, userMessage);

  // 确定要回复的成员
  const responders = selectResponders(session.members, fullHistory.length);
  if (responders.length === 0) {
    return [userMsg];
  }

  // 为每个成员生成回复
  const replies: GroupChatMessage[] = [];
  let currentHistory = fullHistoryForApi;

  for (let i = 0; i < responders.length; i++) {
    const member = responders[i];
    const delay = i * GROUP_CHAT_CONFIG.replyDelay;

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const replyContent = await completeGroupChatReply(
        ctx,
        currentHistory,
        member,
        { regenerate: false },
      );

      // 解析回复（可能包含多个成员的消息）
      const parsedReplies = parseGroupChatReply(replyContent, session.members.map(m => m.displayName));

      for (const parsed of parsedReplies) {
        const senderMember = session.members.find(m => m.displayName === parsed.sender) || member;
        const msg: GroupChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: parsed.content,
          senderId: senderMember.id,
          senderName: parsed.sender,
          time: Date.now(),
        };

        replies.push(msg);
        currentHistory = [...currentHistory, { role: 'assistant' as const, content: parsed.content, sender: parsed.sender }];
      }
    } catch (e) {
      console.error(`[GroupChat] 生成 ${member.displayName} 回复失败:`, e);
    }
  }

  // 保存所有回复到历史
  if (replies.length > 0) {
    await saveWeChatThreadForScope(chatScopeId, session.id, [...fullHistory, ...replies]);
    for (const reply of replies) {
      emitMessageReceived(chatScopeId, session.id, reply.content, reply.senderName);
    }
  }

  return replies;
}

/**
 * 选择应该回复的成员
 */
function selectResponders(
  members: GroupMember[],
  messageCount: number,
): GroupMember[] {
  if (!GROUP_CHAT_CONFIG.multiReply || members.length <= 1) {
    // 单成员回复
    return [members[0]];
  }

  // 根据消息数量决定回复人数
  let replyCount: number;
  if (messageCount <= 2) {
    replyCount = Math.min(1, members.length);
  } else if (messageCount <= 5) {
    replyCount = Math.min(2, members.length);
  } else {
    replyCount = Math.min(GROUP_CHAT_CONFIG.maxRepliesPerTurn, members.length);
  }

  // 随机选择成员（避免总是同一成员回复）
  const shuffled = [...members].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, replyCount);
}

/**
 * 重新生成某个成员的回复
 */
export async function regenerateMemberReply(
  ctx: GroupChatContext,
  chatScopeId: string,
  sessionId: string,
  targetMessageId: string,
): Promise<GroupChatMessage | null> {
  const session = groupChatState.getSession(sessionId);
  if (!session) {
    throw new Error('群聊会话不存在');
  }

  const history = await loadWeChatThreadForScope(chatScopeId, sessionId);
  const targetIndex = history.findIndex(
    (m) => (m as GroupChatMessage).id === targetMessageId,
  );

  if (targetIndex < 0) {
    throw new Error('目标消息不存在');
  }

  const targetMsg = history[targetIndex] as GroupChatMessage;
  if (targetMsg.role !== 'assistant') {
    throw new Error('只能重新生成助手回复');
  }

  // 获取目标成员
  const targetMember = session.members.find(m => m.id === targetMsg.senderId);
  if (!targetMember) {
    throw new Error('找不到对应的群成员');
  }

  // 只使用该消息之前的历史
  const historyBefore = history.slice(0, targetIndex);
  const historyForApi = historyBefore.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
    sender: (m as GroupChatMessage).senderName,
  }));

  try {
    const newContent = await completeGroupChatReply(
      ctx,
      historyForApi,
      targetMember,
      { regenerate: true },
    );

    // 更新消息
    const newMsg: GroupChatMessage = {
      ...targetMsg,
      content: newContent,
      time: Date.now(),
    };

    const newHistory = [...historyBefore, newMsg, ...history.slice(targetIndex + 1)];
    await saveWeChatThreadForScope(chatScopeId, sessionId, newHistory);

    return newMsg;
  } catch (e) {
    console.error('[GroupChat] 重新生成回复失败:', e);
    throw e;
  }
}

// ==================== 群聊视图渲染支持 ====================

/**
 * 获取群聊消息的展示信息
 */
export function getGroupChatDisplayInfo(session: GroupChatSession): {
  memberCount: number;
  memberNames: string;
  lastActivityTime: string;
} {
  const memberCount = session.members.length;
  const memberNames = session.members.map(m => m.displayName).join('、');
  const lastActivityTime = new Date(session.lastActivity).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return { memberCount, memberNames, lastActivityTime };
}

/**
 * 判断消息是否为当前用户发送
 */
export function isUserMessage(msg: WeChatStoredMessage): boolean {
  return msg.role === 'user';
}

/**
 * 获取消息发送者
 */
export function getMessageSender(msg: WeChatStoredMessage, session?: GroupChatSession): string {
  if (msg.role === 'user') {
    return '我';
  }
  if ((msg as GroupChatMessage).senderName) {
    return (msg as GroupChatMessage).senderName;
  }
  if (session) {
    const member = session.members.find(m => m.id === (msg as GroupChatMessage).senderId);
    return member?.displayName ?? '未知';
  }
  return '未知';
}
