/**
 * 群聊逻辑模块
 * 负责：
 * 1. 群聊会话管理
 * 2. 群聊消息生成
 * 3. 多成员回复协调
 * 4. 多群聊支持、自定义群名、成员邀请
 */

import type { WeChatStoredMessage } from './weChatStorage';
import { splitMessageIntoSegments } from './chatCompletions';

/**
 * 获取当前用户名称（从酒馆全局对象或回退到默认值）
 */
function getUserName(): string {
  try {
    // @ts-ignore - SillyTavern is global
    const st = (window as any).SillyTavern;
    if (st?.name1) {
      return String(st.name1).trim();
    }
    // 尝试从 user 对象获取
    if (st?.user?.name) {
      return String(st.user.name).trim();
    }
  } catch {
    // ignore
  }
  // 回退：检查上下文中是否有用户名称
  return '房东';
}
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
import { TavernPhoneWeChatContact } from './tavernPhoneBridge';
import {
  idbLoadGroupChatList,
  idbSaveGroupChatList,
} from './groupChatIndexedDb';

// ==================== 类型定义 ====================

export interface GroupChatSession {
  id: string;
  name: string;
  members: GroupMember[];
  createdAt: number;
  lastActivity: number;
  /** 群主ID（创建者），默认是用户 */
  ownerId?: string;
  /** 群聊头像（可选） */
  avatarUrl?: string;
}

export interface GroupChatMessage extends WeChatStoredMessage {
  senderId: string;
  senderName: string;
}

/** 群聊列表存储结构 */
export interface GroupChatListData {
  version: number;
  sessions: GroupChatSession[];
  currentSessionId: string | null;
}

/** 创建群聊参数 */
export interface CreateGroupChatParams {
  name: string;
  members: GroupMember[];
  avatarUrl?: string;
}

/** 可用联系人（从通讯录导入） */
export interface AvailableContact extends TavernPhoneWeChatContact {
  /** 是否已加入当前群聊 */
  isInGroup?: boolean;
}

// ==================== 配置 ====================

const GROUP_CHAT_CONFIG = {
  /** 默认群名称 */
  defaultGroupName: '新建群聊',
  /** 单次生成最多回复几个成员 */
  maxRepliesPerTurn: 3,
  /** 每位成员单次 API 回复最多拆成几个气泡（一两句即可） */
  maxSegmentsPerMemberTurn: 2,
  /** 回复之间的时间间隔（毫秒）模拟真实感 */
  replyDelay: 1500,
  /** 是否启用多成员回复 */
  multiReply: true,
  /** 群聊列表存储键 */
  storageKey: 'tavern_phone_group_chat_list',
  /** 数据版本号 */
  dataVersion: 1,
};

// ==================== 群聊列表持久化存储 (IndexedDB) ====================

/**
 * 从 IndexedDB 加载群聊列表
 */
async function loadGroupChatListFromStorage(chatScopeId: string): Promise<GroupChatListData> {
  try {
    return await idbLoadGroupChatList(chatScopeId);
  } catch (e) {
    console.error('[GroupChat] 加载群聊列表失败:', e);
    return {
      version: GROUP_CHAT_CONFIG.dataVersion,
      sessions: [],
      currentSessionId: null,
    };
  }
}

/**
 * 保存群聊列表到 IndexedDB
 */
async function saveGroupChatListToStorage(
  chatScopeId: string,
  data: GroupChatListData,
): Promise<void> {
  try {
    await idbSaveGroupChatList(chatScopeId, data);
  } catch (e) {
    console.error('[GroupChat] 保存群聊列表失败:', e);
  }
}

/**
 * 将所有可用联系人转换为 GroupMember
 */
export function convertContactsToMembers(contacts: TavernPhoneWeChatContact[]): GroupMember[] {
  return contacts.map(contact => ({
    id: contact.id,
    displayName: contact.displayName,
    personality: contact.personality,
    thought: contact.thought,
    avatarUrl: contact.avatarUrl,
  }));
}

// ==================== 群聊状态 ====================

class GroupChatState {
  private sessions: Map<string, GroupChatSession> = new Map();
  private currentSession: string | null = null;
  private chatScopeId: string = 'local-offline';
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化群聊状态（从存储加载）
   */
  async initialize(chatScopeId: string): Promise<void> {
    if (this.initialized && this.chatScopeId === chatScopeId) return;

    // 防止并发初始化，同时处理不同 scope 的情况
    if (this.initPromise) {
      await this.initPromise;
      // 等待完成后，检查是否已初始化为目标 scope
      if (this.initialized && this.chatScopeId === chatScopeId) return;
      // 如果初始化的是其他 scope，需要重新初始化当前 scope
    }

    this.initPromise = this.doInitialize(chatScopeId);
    await this.initPromise;
    this.initPromise = null;
  }

  private async doInitialize(chatScopeId: string): Promise<void> {
    this.chatScopeId = chatScopeId;
    const data = await loadGroupChatListFromStorage(chatScopeId);

    this.sessions.clear();
    for (const session of data.sessions) {
      this.sessions.set(session.id, session);
    }
    this.currentSession = data.currentSessionId;
    this.initialized = true;

    console.log('[GroupChat] 初始化完成，加载了', data.sessions.length, '个群聊');
  }

  /**
   * 等待初始化完成（用于需要确保已初始化的场景）
   */
  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * 持久化当前状态
   */
  private async persist(): Promise<void> {
    if (!this.initialized) return;

    const data: GroupChatListData = {
      version: GROUP_CHAT_CONFIG.dataVersion,
      sessions: this.getAllSessions(),
      currentSessionId: this.currentSession,
    };
    await saveGroupChatListToStorage(this.chatScopeId, data);
  }

  getSession(id: string): GroupChatSession | undefined {
    return this.sessions.get(id);
  }

  async setSession(session: GroupChatSession): Promise<void> {
    this.sessions.set(session.id, session);
    await this.persist();
  }

  getCurrentSession(): GroupChatSession | null {
    if (!this.currentSession) return null;
    return this.sessions.get(this.currentSession) ?? null;
  }

  async setCurrentSession(id: string | null): Promise<void> {
    this.currentSession = id;
    await this.persist();
  }

  getAllSessions(): GroupChatSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.lastActivity - a.lastActivity);
  }

  async updateLastActivity(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivity = Date.now();
      this.sessions.set(id, session);
      await this.persist();
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    const existed = this.sessions.delete(id);
    if (existed) {
      if (this.currentSession === id) {
        this.currentSession = null;
      }
      await this.persist();
    }
    return existed;
  }

  /**
   * 检查群聊名称是否已存在
   */
  isGroupNameExists(name: string, excludeId?: string): boolean {
    const normalizedName = name.trim();
    for (const session of this.sessions.values()) {
      if (session.name.trim() === normalizedName && session.id !== excludeId) {
        return true;
      }
    }
    return false;
  }
}

export const groupChatState = new GroupChatState();

// ==================== 群聊管理 ====================

/**
 * 初始化群聊系统
 */
export async function initializeGroupChatSystem(chatScopeId: string): Promise<void> {
  await groupChatState.initialize(chatScopeId);
}

/**
 * 创建群聊会话（新版，支持自定义名称和选择成员）
 */
export async function createGroupChat(
  chatScopeId: string,
  params: CreateGroupChatParams,
): Promise<GroupChatSession> {
  // 确保已初始化
  await groupChatState.initialize(chatScopeId);

  const id = `group:${chatScopeId}:${crypto.randomUUID()}`;
  const session: GroupChatSession = {
    id,
    name: params.name.trim() || GROUP_CHAT_CONFIG.defaultGroupName,
    members: params.members,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ownerId: '<user>',
    avatarUrl: params.avatarUrl,
  };
  await groupChatState.setSession(session);
  console.log('[GroupChat] 创建群聊:', session.name, '成员数:', session.members.length);
  return session;
}

/**
 * 更新群聊信息
 */
export async function updateGroupChat(
  sessionId: string,
  updates: Partial<Pick<GroupChatSession, 'name' | 'members' | 'avatarUrl'>>,
): Promise<GroupChatSession | null> {
  const session = groupChatState.getSession(sessionId);
  if (!session) return null;

  if (updates.name !== undefined) {
    session.name = updates.name.trim() || session.name;
  }
  if (updates.members !== undefined) {
    session.members = updates.members;
  }
  if (updates.avatarUrl !== undefined) {
    session.avatarUrl = updates.avatarUrl;
  }

  await groupChatState.setSession(session);
  return session;
}

/**
 * 删除群聊
 */
export async function deleteGroupChat(sessionId: string): Promise<boolean> {
  return await groupChatState.deleteSession(sessionId);
}

/**
 * 获取所有群聊列表
 */
export async function getAllGroupChats(chatScopeId: string): Promise<GroupChatSession[]> {
  await groupChatState.initialize(chatScopeId);
  return groupChatState.getAllSessions();
}

/**
 * 获取单个群聊详情
 */
export function getGroupChat(sessionId: string): GroupChatSession | undefined {
  return groupChatState.getSession(sessionId);
}

/**
 * 设置当前活跃的群聊会话
 */
export async function setCurrentGroupChatSession(sessionId: string | null): Promise<void> {
  await groupChatState.setCurrentSession(sessionId);
}

/**
 * 获取当前活跃的群聊会话
 */
export function getCurrentGroupChatSession(): GroupChatSession | null {
  return groupChatState.getCurrentSession();
}

/**
 * 检查群聊名称是否可用
 */
export function isGroupNameAvailable(name: string, excludeId?: string): boolean {
  return !groupChatState.isGroupNameExists(name, excludeId);
}

/**
 * 向群聊添加成员
 */
export async function addMembersToGroupChat(
  sessionId: string,
  newMembers: GroupMember[],
): Promise<GroupChatSession | null> {
  const session = groupChatState.getSession(sessionId);
  if (!session) return null;

  // 去重添加
  const existingIds = new Set(session.members.map(m => m.id));
  const membersToAdd = newMembers.filter(m => !existingIds.has(m.id));

  if (membersToAdd.length > 0) {
    session.members = [...session.members, ...membersToAdd];
    await groupChatState.setSession(session);
    console.log('[GroupChat] 添加成员到群聊:', session.name, '新增:', membersToAdd.length);
  }

  return session;
}

/**
 * 从群聊移除成员
 */
export async function removeMembersFromGroupChat(
  sessionId: string,
  memberIds: string[],
): Promise<GroupChatSession | null> {
  const session = groupChatState.getSession(sessionId);
  if (!session) return null;

  session.members = session.members.filter(m => !memberIds.includes(m.id));
  await groupChatState.setSession(session);
  console.log('[GroupChat] 从群聊移除成员:', session.name, '移除:', memberIds.length);
  return session;
}

// ==================== 旧版兼容函数 ====================

/**
 * 创建群聊会话（旧版，保持兼容）
 */
export async function createGroupChatSession(
  id: string,
  name: string,
  members: GroupMember[],
): Promise<GroupChatSession> {
  const session: GroupChatSession = {
    id,
    name,
    members,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  await groupChatState.setSession(session);
  return session;
}

/**
 * 获取或创建群聊会话（旧版，自动创建默认群聊）
 * 如果没有群聊，会自动创建一个包含所有联系人的默认群聊
 */
export async function getOrCreateGroupChatSession(
  chatScopeId: string,
  members: GroupMember[],
): Promise<GroupChatSession> {
  await groupChatState.initialize(chatScopeId);

  // 检查是否已有群聊
  const allSessions = groupChatState.getAllSessions();
  if (allSessions.length > 0) {
    // 更新第一个群聊的成员
    const firstSession = allSessions[0];
    firstSession.members = members;
    await groupChatState.setSession(firstSession);
    return firstSession;
  }

  // 创建默认群聊
  const sessionId = `group:${chatScopeId}:default`;
  const memberNames = members.map(m => m.displayName).join('、');
  return await createGroupChatSession(sessionId, memberNames || GROUP_CHAT_CONFIG.defaultGroupName, members);
}

/**
 * 更新群聊成员（旧版，保持兼容）
 */
export async function updateGroupChatMembers(sessionId: string, members: GroupMember[]): Promise<void> {
  const session = groupChatState.getSession(sessionId);
  if (session) {
    session.members = members;
    await groupChatState.setSession(session);
  }
}

// ==================== 群聊消息生成 ====================

/**
 * 生成群聊回复（多成员响应）
 * 每次随机选择1-3个成员回复，避免总是同一成员回复
 */
export async function generateGroupChatReplies(
  ctx: GroupChatContext,
  userMessage: string,
  chatScopeId: string,
  targetSessionId?: string,
  existingUserMsg?: GroupChatMessage,
): Promise<GroupChatMessage[]> {
  // 确保群聊系统已初始化
  await groupChatState.initialize(chatScopeId);

  const session = targetSessionId
    ? groupChatState.getSession(targetSessionId)
    : groupChatState.getCurrentSession();

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

  // 获取当前用户名称
  const userName = ctx.userName || getUserName();

  // 构建带用户消息的历史（使用传入的 existingUserMsg 或创建新的）
  const userMsg: GroupChatMessage = existingUserMsg || {
    id: crypto.randomUUID(),
    role: 'user',
    content: userMessage,
    senderId: '<user>',
    senderName: userName,
    time: Date.now(),
  };
  const fullHistory = [...history, userMsg];
  const fullHistoryForApi = [...historyForApi, { role: 'user' as const, content: userMessage, sender: userName }];

  // 保存用户消息（仅在未传入 existingUserMsg 时，即需要内部管理历史时）
  if (!existingUserMsg) {
    await saveWeChatThreadForScope(chatScopeId, session.id, fullHistory);
  }
  emitMessageSent(chatScopeId, session.id, userMessage);

  // 确定要回复的成员（随机选择）
  const responders = selectResponders(session.members, fullHistory.length);
  if (responders.length === 0) {
    return [userMsg];
  }

  console.log('[GroupChat] 选定回复成员:', responders.map(m => m.displayName).join(', '));

  // 为每个成员生成回复
  const replies: GroupChatMessage[] = [];
  let currentHistory = fullHistoryForApi;
  /** 本轮内已产生的助手正文（给后续成员作「禁止照搬」提示） */
  const sameTurnPeerTexts: string[] = [];

  for (let i = 0; i < responders.length; i++) {
    const member = responders[i];
    const delay = i * GROUP_CHAT_CONFIG.replyDelay;

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const replyContent = await completeGroupChatReply(
        ctx,
        currentHistory,
        member,
        { regenerate: false, sameTurnPeerTexts: [...sameTurnPeerTexts] },
      );

      // 解析回复（传入预期发送者以修正可能的身份混淆）
      const parsedReplies = parseGroupChatReply(
        replyContent,
        session.members.map(m => m.displayName),
        member.displayName, // 预期发送者
      );

      // 单次 API 返回的多行合并后再分段，避免模型连刷多句却都挂在同一人名下；发送者固定为当前成员
      const mergedRaw = parsedReplies
        .map(p => p.content.trim())
        .filter(Boolean)
        .join('\n');
      if (!mergedRaw) {
        continue;
      }

      const segments = splitMessageIntoSegments(mergedRaw).slice(
        0,
        GROUP_CHAT_CONFIG.maxSegmentsPerMemberTurn,
      );
      const baseTime = Date.now();
      sameTurnPeerTexts.push(mergedRaw);

      for (let si = 0; si < segments.length; si++) {
        const msg: GroupChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: segments[si],
          senderId: member.id,
          senderName: member.displayName,
          time: baseTime + si * 500,
        };

        replies.push(msg);
        currentHistory = [
          ...currentHistory,
          { role: 'assistant' as const, content: segments[si], sender: member.displayName },
        ];
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

  // 更新最后活动时间
  await groupChatState.updateLastActivity(session.id);

  return replies;
}

/**
 * 根据群聊总人数动态计算最大回复人数
 * 人数越多，可同时回复的人数上限越高
 */
function getMaxReplyCountByMemberCount(memberCount: number): number {
  if (memberCount <= 2) return 1;      // 2人：1人回复
  if (memberCount <= 3) return 2;      // 3人：1-2人回复
  if (memberCount <= 5) return 3;      // 4-5人：1-3人回复
  if (memberCount <= 8) return 4;      // 6-8人：1-4人回复
  return 5;                             // 9人以上：最多5人回复
}

/**
 * 选择应该回复的成员
 * 根据群聊总人数和消息数量动态决定回复人数，随机选择避免总是同一成员回复
 */
function selectResponders(
  members: GroupMember[],
  messageCount: number,
): GroupMember[] {
  if (members.length === 0) {
    return [];
  }

  if (!GROUP_CHAT_CONFIG.multiReply || members.length === 1) {
    return [members[0]];
  }

  // 根据群聊总人数动态计算本次最大回复人数
  const maxReplyByMembers = getMaxReplyCountByMemberCount(members.length);

  // 根据消息数量决定实际回复人数（从1到maxReplyByMembers之间随机）
  let replyCount: number;
  if (messageCount <= 3) {
    // 前期消息较少，1到maxReplyByMembers之间随机
    replyCount = Math.min(Math.floor(Math.random() * maxReplyByMembers) + 1, members.length);
  } else if (messageCount <= 8) {
    // 中期，2到maxReplyByMembers之间随机（稍微活跃些）
    const minReply = Math.min(2, maxReplyByMembers);
    replyCount = Math.min(Math.floor(Math.random() * (maxReplyByMembers - minReply + 1)) + minReply, members.length);
  } else {
    // 后期活跃，较多人回复
    const minReply = Math.min(2, maxReplyByMembers);
    replyCount = Math.min(Math.floor(Math.random() * (maxReplyByMembers - minReply + 1)) + minReply, members.length);
  }

  // 确保至少1人，不超过成员总数
  replyCount = Math.max(1, Math.min(replyCount, members.length));

  console.log(`[GroupChat] 群聊人数: ${members.length}, 本次回复人数: ${replyCount}`);

  // 随机打乱并选择
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

    // 清理括号动作和星号动作
    let cleanedContent = newContent.replace(/[（\(][^）\)]*[）\)]\s*/g, '');
    cleanedContent = cleanedContent.replace(/\*[^*]+\*\s*/g, '');
    cleanedContent = cleanedContent.trim();

    // 分割成多个小气泡
    const segments = splitMessageIntoSegments(cleanedContent);

    // 取第一个段作为重新生成的消息（像私聊一样）
    const newMsg: GroupChatMessage = {
      ...targetMsg,
      content: segments[0] || cleanedContent,
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
