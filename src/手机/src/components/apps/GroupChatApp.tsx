import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  RefreshCw,
  Send,
  Users,
  Plus,
  Check,
  Trash2,
  Edit3,
  MoreVertical,
} from 'lucide-react';

// ==================== 气泡样式系统 ====================
// 20+ 种独特气泡风格：圆角、光泽、毛玻璃、霓虹、科技感、羊皮纸、便签等

interface BubbleStyle {
  bg: string;
  text: string;
  name: string;
  extraClasses?: string;
  extraStyle?: React.CSSProperties;
}

const BUBBLE_STYLES: BubbleStyle[] = [
  // 1. 柔和粉蜡 - 基础柔和色
  { bg: 'bg-[#FFCDD2]', text: 'text-gray-900', name: '柔和粉' },
  { bg: 'bg-[#F8BBD0]', text: 'text-gray-900', name: '柔和玫瑰' },
  { bg: 'bg-[#E1BEE7]', text: 'text-gray-900', name: '柔和紫' },
  { bg: 'bg-[#D1C4E9]', text: 'text-gray-900', name: '柔和紫灰' },
  { bg: 'bg-[#C5CAE9]', text: 'text-gray-900', name: '柔和蓝紫' },
  { bg: 'bg-[#BBDEFB]', text: 'text-gray-900', name: '柔和天蓝' },
  { bg: 'bg-[#B3E5FC]', text: 'text-gray-900', name: '柔和冰蓝' },
  { bg: 'bg-[#B2EBF2]', text: 'text-gray-900', name: '柔和青' },
  { bg: 'bg-[#B2DFDB]', text: 'text-gray-900', name: '柔和薄荷' },
  { bg: 'bg-[#A5D6A7]', text: 'text-gray-900', name: '柔和绿' },

  // 2. 超圆角 - 像药丸一样圆
  { bg: 'bg-gradient-to-br from-pink-200 to-pink-300', text: 'text-gray-900', name: '圆角粉', extraClasses: 'rounded-[24px] shadow-md' },
  { bg: 'bg-gradient-to-br from-purple-200 to-purple-300', text: 'text-gray-900', name: '圆角紫', extraClasses: 'rounded-[24px] shadow-md' },
  { bg: 'bg-gradient-to-br from-blue-200 to-blue-300', text: 'text-gray-900', name: '圆角蓝', extraClasses: 'rounded-[24px] shadow-md' },
  { bg: 'bg-gradient-to-br from-green-200 to-green-300', text: 'text-gray-900', name: '圆角绿', extraClasses: 'rounded-[24px] shadow-md' },

  // 3. 光泽渐变 - 有高光效果
  { bg: 'bg-gradient-to-br from-rose-200 via-rose-100 to-rose-300', text: 'text-gray-900', name: '光泽玫瑰', extraClasses: 'shadow-md border border-rose-200/50' },
  { bg: 'bg-gradient-to-br from-violet-200 via-violet-100 to-violet-300', text: 'text-gray-900', name: '光泽紫', extraClasses: 'shadow-md border border-violet-200/50' },
  { bg: 'bg-gradient-to-br from-cyan-200 via-cyan-100 to-cyan-300', text: 'text-gray-900', name: '光泽青', extraClasses: 'shadow-md border border-cyan-200/50' },
  { bg: 'bg-gradient-to-br from-amber-200 via-amber-100 to-amber-300', text: 'text-gray-900', name: '光泽琥珀', extraClasses: 'shadow-md border border-amber-200/50' },

  // 4. 毛玻璃 - 半透明模糊
  { bg: 'bg-white/30', text: 'text-gray-900', name: '毛玻璃白', extraClasses: 'backdrop-blur-md border border-white/50 shadow-lg' },
  { bg: 'bg-pink-100/40', text: 'text-gray-900', name: '毛玻璃粉', extraClasses: 'backdrop-blur-md border border-pink-200/50 shadow-lg' },
  { bg: 'bg-blue-100/40', text: 'text-gray-900', name: '毛玻璃蓝', extraClasses: 'backdrop-blur-md border border-blue-200/50 shadow-lg' },
  { bg: 'bg-purple-100/40', text: 'text-gray-900', name: '毛玻璃紫', extraClasses: 'backdrop-blur-md border border-purple-200/50 shadow-lg' },

  // 5. 霓虹发光 - 发光效果
  { bg: 'bg-fuchsia-200', text: 'text-fuchsia-900', name: '霓虹粉', extraClasses: 'shadow-[0_0_15px_rgba(232,121,249,0.5)] border-2 border-fuchsia-300' },
  { bg: 'bg-cyan-200', text: 'text-cyan-900', name: '霓虹青', extraClasses: 'shadow-[0_0_15px_rgba(34,211,238,0.5)] border-2 border-cyan-300' },
  { bg: 'bg-lime-200', text: 'text-lime-900', name: '霓虹绿', extraClasses: 'shadow-[0_0_15px_rgba(163,230,53,0.5)] border-2 border-lime-300' },

  // 6. 科技感 - 深色赛博风
  { bg: 'bg-slate-800', text: 'text-cyan-400', name: '科技深蓝', extraClasses: 'border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]' },
  { bg: 'bg-gray-900', text: 'text-pink-400', name: '科技黑粉', extraClasses: 'border border-pink-500/50 shadow-[0_0_10px_rgba(232,121,249,0.3)]' },
  { bg: 'bg-zinc-800', text: 'text-emerald-400', name: '科技深绿', extraClasses: 'border border-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.3)]' },

  // 7. 羊皮纸/复古
  { bg: 'bg-[#F5E6D3]', text: 'text-amber-900', name: '羊皮纸', extraClasses: 'border border-amber-200/60 shadow-sm' },
  { bg: 'bg-[#E8DCC8]', text: 'text-amber-950', name: '复古棕', extraClasses: 'border border-amber-300/60 shadow-sm' },
  { bg: 'bg-[#F0EAD6]', text: 'text-stone-800', name: '旧纸张', extraClasses: 'border border-stone-300/60 shadow-sm' },

  // 8. 便签纸 - 像便利贴
  { bg: 'bg-yellow-200', text: 'text-yellow-900', name: '黄色便签', extraClasses: 'rounded-sm shadow-md rotate-[1deg] origin-bottom-left' },
  { bg: 'bg-pink-200', text: 'text-pink-900', name: '粉色便签', extraClasses: 'rounded-sm shadow-md rotate-[-1deg] origin-bottom-left' },
  { bg: 'bg-green-200', text: 'text-green-900', name: '绿色便签', extraClasses: 'rounded-sm shadow-md rotate-[0.5deg] origin-bottom-left' },
  { bg: 'bg-blue-200', text: 'text-blue-900', name: '蓝色便签', extraClasses: 'rounded-sm shadow-md rotate-[-0.5deg] origin-bottom-left' },

  // 9. 3D立体 - 有厚度感
  { bg: 'bg-gradient-to-b from-indigo-300 to-indigo-400', text: 'text-white', name: '3D靛蓝', extraClasses: 'rounded-xl shadow-[0_4px_0_rgb(79,70,229)] border-b-4 border-indigo-600' },
  { bg: 'bg-gradient-to-b from-rose-300 to-rose-400', text: 'text-white', name: '3D玫瑰', extraClasses: 'rounded-xl shadow-[0_4px_0_rgb(225,29,72)] border-b-4 border-rose-600' },
  { bg: 'bg-gradient-to-b from-teal-300 to-teal-400', text: 'text-white', name: '3D青绿', extraClasses: 'rounded-xl shadow-[0_4px_0_rgb(13,148,136)] border-b-4 border-teal-600' },

  // 10. 描边风格 - 线条感
  { bg: 'bg-white', text: 'text-gray-900', name: '白描边', extraClasses: 'border-2 border-gray-900 rounded-lg shadow-sm' },
  { bg: 'bg-orange-100', text: 'text-orange-900', name: '橙描边', extraClasses: 'border-2 border-orange-400 rounded-lg shadow-sm' },
  { bg: 'bg-sky-100', text: 'text-sky-900', name: '天蓝描边', extraClasses: 'border-2 border-sky-400 rounded-lg shadow-sm' },

  // 11. 金属质感
  { bg: 'bg-gradient-to-br from-gray-100 via-gray-300 to-gray-400', text: 'text-gray-800', name: '银金属', extraClasses: 'shadow-lg border border-gray-400' },
  { bg: 'bg-gradient-to-br from-amber-200 via-amber-300 to-yellow-400', text: 'text-amber-900', name: '金金属', extraClasses: 'shadow-lg border border-amber-400' },

  // 12. 水波纹 - 波浪形状
  { bg: 'bg-teal-200', text: 'text-teal-900', name: '水波青', extraClasses: 'rounded-[30%_70%_70%_30%/30%_30%_70%_70%] shadow-md' },
  { bg: 'bg-rose-200', text: 'text-rose-900', name: '水波粉', extraClasses: 'rounded-[70%_30%_30%_70%/70%_70%_30%_30%] shadow-md' },
];

// 用户自己的气泡样式（微信经典绿色）
const USER_BUBBLE_STYLE: BubbleStyle = {
  bg: 'bg-[#95EC69]',
  text: 'text-gray-900',
  name: '微信绿',
  extraClasses: '',
  extraStyle: {},
};

/**
 * 根据字符串生成一致的样式索引
 * 用于给每个成员分配固定样式
 */
function getStyleIndexForMember(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % BUBBLE_STYLES.length;
}

/**
 * 获取成员的气泡样式
 * @param memberId 成员ID
 * @param memberName 成员名称
 * @param isUser 是否为用户自己
 */
function getMemberBubbleStyle(memberId: string, memberName: string, isUser?: boolean): BubbleStyle {
  if (isUser) {
    return USER_BUBBLE_STYLE;
  }
  const index = getStyleIndexForMember(memberId || memberName);
  return BUBBLE_STYLES[index];
}
import {
  requestTavernPhoneContext,
  subscribeChatScopeChange,
  TAVERN_PHONE_MSG,
  type TavernPhoneContextPayload,
  type TavernPhoneWeChatContact,
} from '../../tavernPhoneBridge';
import {
  initWeChatStorage,
  loadWeChatThreadForScope,
  saveWeChatThreadForScope,
} from '../../weChatStorage';
import { LOCAL_OFFLINE_SCOPE, resolveChatScopeId } from '../../weChatScope';
import {
  resolveRoleAvatarDisplay,
  usePhoneCharacterAvatarOverrides,
} from '../../phoneCharacterAvatars';
import {
  getOrCreateGroupChatSession,
  getGroupChatDisplayInfo,
  generateGroupChatReplies,
  regenerateMemberReply,
  setCurrentGroupChatSession,
  createGroupChat,
  updateGroupChat,
  deleteGroupChat,
  getAllGroupChats,
  getGroupChat,
  addMembersToGroupChat,
  removeMembersFromGroupChat,
  convertContactsToMembers,
  type GroupChatMessage,
  type GroupChatSession,
} from '../../groupChat';
import {
  type GroupMember,
  type GroupChatContext,
} from '../../chatCompletions';

/** 获取当前用户名称（从酒馆全局对象或回退到默认值） */
function getUserName(): string {
  try {
    // @ts-ignore - SillyTavern is global
    const st = (window as any).SillyTavern;
    if (st?.name1) {
      return String(st.name1).trim();
    }
    if (st?.user?.name) {
      return String(st.user.name).trim();
    }
  } catch {
    // ignore
  }
  return '房东';
}

// ==================== 类型定义 ====================

type GroupChatView = 'list' | 'chat' | 'create' | 'edit' | 'manage-members';

interface GroupSessionInfo {
  id: string;
  name: string;
  memberCount: number;
  lastActivity: string;
  lastPreview: string;
  members: GroupMember[];
}

interface AvailableContact extends TavernPhoneWeChatContact {
  selected: boolean;
}

// ==================== 工具函数 ====================

function formatMsgTime(t: number): string {
  const d = new Date(t);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function contactInitial(displayName: string): string {
  const t = displayName.trim();
  if (!t) return '?';
  return Array.from(t)[0] ?? '?';
}

// ==================== 头像组件 ====================

function GroupMemberAvatar({
  member,
  avatarSrc,
  size = 'bubble',
  className = '',
}: {
  member: GroupMember;
  avatarSrc: string;
  size?: 'bubble' | 'list' | 'header';
  className?: string;
}) {
  const sizeClasses = {
    bubble: 'h-8 w-8 text-xs rounded-md',
    list: 'h-11 w-11 text-sm rounded-lg',
    header: 'h-9 w-9 text-sm rounded-md',
  };

  const url = avatarSrc.trim();
  if (url) {
    return (
      <img
        src={url}
        alt={member.displayName}
        className={`object-cover ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-[#E5E5EA] font-semibold text-[#1c1c1e] ${sizeClasses[size]} ${className}`}
    >
      {contactInitial(member.displayName)}
    </div>
  );
}

// ==================== 主组件 ====================

export default function GroupChatApp({ onClose }: { onClose: () => void }) {
  const avatarOverrides = usePhoneCharacterAvatarOverrides();
  const [ctx, setCtx] = useState<TavernPhoneContextPayload | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [chatScopeId, setChatScopeId] = useState<string>(LOCAL_OFFLINE_SCOPE);
  const [view, setView] = useState<GroupChatView>('list');
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sessionInfo, setSessionInfo] = useState<GroupSessionInfo | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [threadReady, setThreadReady] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [listTick, setListTick] = useState(0);

  // 多群聊管理状态
  const [allGroupChats, setAllGroupChats] = useState<GroupChatSession[]>([]);
  const [availableContacts, setAvailableContacts] = useState<AvailableContact[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState<GroupChatSession | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [showGroupOptions, setShowGroupOptions] = useState<string | null>(null);

  // 长按菜单状态
  const [longPressMenu, setLongPressMenu] = useState<{
    visible: boolean;
    messageId: string | null;
    messageContent: string;
    messageRole: 'user' | 'assistant' | null;
    position: { x: number; y: number };
  }>({
    visible: false,
    messageId: null,
    messageContent: '',
    messageRole: null,
    position: { x: 0, y: 0 },
  });
  const longPressTimerRef = useRef<number | null>(null);
  const [retractingIds, setRetractingIds] = useState<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);
  const contextFetchGenRef = useRef(0);

  // 初始化
  useEffect(() => {
    void initWeChatStorage();
  }, []);

  // 加载上下文和所有群聊
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCtxLoading(true);
      const gen = ++contextFetchGenRef.current;
      try {
        const c = await requestTavernPhoneContext();
        if (cancelled || gen !== contextFetchGenRef.current) return;

        setCtx({
          ...c,
          recentStorySnippet: c.recentStorySnippet ?? '',
          roleStorySummaries: c.roleStorySummaries ?? {},
          openAiDefaults: c.openAiDefaults ?? { apiBaseUrl: null, model: null },
          userName: c.userName ?? getUserName(),
        });

        // 构建所有可用联系人（用于邀请）
        const contacts: AvailableContact[] = c.contacts.map(contact => ({
          ...contact,
          selected: false,
        }));
        setAvailableContacts(contacts);

        // 加载所有群聊
        const scopeId = resolveChatScopeId(c.chatScopeId);
        setChatScopeId(scopeId); // 同步 React state，确保后续操作使用正确的 scope
        const groups = await getAllGroupChats(scopeId);
        setAllGroupChats(groups);

        // 如果没有群聊，使用默认逻辑创建
        if (groups.length === 0) {
          const members: GroupMember[] = c.contacts.map(contact => ({
            id: contact.id,
            displayName: contact.displayName,
            personality: contact.personality,
            thought: contact.thought,
            avatarUrl: contact.avatarUrl,
          }));
          setGroupMembers(members);
        }
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 监听聊天切换
  useEffect(() => {
    return subscribeChatScopeChange(scope => {
      setChatScopeId(resolveChatScopeId(scope));
      setView('list');
      setListTick(t => t + 1);
    });
  }, []);

  // 加载所有群聊列表信息（仅刷新列表，不更新当前会话）
  const refreshGroupChatList = useCallback(async () => {
    if (!ctx) return;
    const scopeId = resolveChatScopeId(ctx.chatScopeId);
    const groups = await getAllGroupChats(scopeId);
    setAllGroupChats(groups);
  }, [ctx]);

  // 初始加载群聊列表
  useEffect(() => {
    void refreshGroupChatList();
  }, [refreshGroupChatList]);

  // listTick 变化时刷新列表（从聊天界面返回列表时）
  useEffect(() => {
    if (listTick > 0) {
      refreshGroupChatList();
    }
  }, [listTick]);

  // 兼容旧逻辑：如果没有群聊，创建一个默认群聊（只执行一次）
  useEffect(() => {
    if (!ctx || groupMembers.length === 0) return;

    // 使用 ref 确保只执行一次，避免循环依赖
    const checkAndCreateDefault = async () => {
      const groups = await getAllGroupChats(chatScopeId);
      if (groups.length > 0) return; // 已有群聊，不创建

      const session = await getOrCreateGroupChatSession(chatScopeId, groupMembers);
      const displayInfo = getGroupChatDisplayInfo(session);

      // 加载预览消息
      const msgs = await loadWeChatThreadForScope(chatScopeId, session.id);
      const msgsAsGroup = msgs as GroupChatMessage[];
      const lastMsg = msgsAsGroup[msgsAsGroup.length - 1];
      const preview = lastMsg
        ? `${(lastMsg as GroupChatMessage).senderName || '我'}: ${lastMsg.content.substring(0, 20)}...`
        : '群聊暂无消息';

      setSessionInfo({
        id: session.id,
        name: session.name,
        memberCount: displayInfo.memberCount,
        lastActivity: displayInfo.lastActivityTime,
        lastPreview: preview,
        members: session.members,
      });

      // 刷新列表
      const updatedGroups = await getAllGroupChats(chatScopeId);
      setAllGroupChats(updatedGroups);
    };

    void checkAndCreateDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, chatScopeId, groupMembers.length]); // 使用 groupMembers.length 而不是 groupMembers 对象

  // 加载消息
  useEffect(() => {
    if (view !== 'chat' || !sessionInfo) {
      setMessages([]);
      setThreadReady(false);
      return;
    }

    let cancelled = false;
    setThreadReady(false);

    (async () => {
      const msgs = await loadWeChatThreadForScope(chatScopeId, sessionInfo.id);
      const groupMsgs = msgs as GroupChatMessage[];
      if (!cancelled) {
        setMessages(groupMsgs);
        setThreadReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [view, sessionInfo, chatScopeId]);

  // 保存消息
  useEffect(() => {
    if (!sessionInfo || !threadReady || messages.length === 0) return;
    void saveWeChatThreadForScope(chatScopeId, sessionInfo.id, messages);
  }, [sessionInfo, chatScopeId, messages, threadReady]);

  // 滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, view]);

  // 发送消息
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !ctx || !sessionInfo || sending) return;

    setSendError('');
    setSending(true);
    setInput('');

    // 创建用户消息并立即添加到 UI
    const userName = ctx.userName || getUserName();
    const userMsg: GroupChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      senderId: '<user>',
      senderName: userName,
      time: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // 异步生成 AI 回复
    void (async () => {
      try {
        // 先保存用户消息到存储（避免 generateGroupChatReplies 再保存一遍）
        const currentHistory = await loadWeChatThreadForScope(chatScopeId, sessionInfo.id);
        await saveWeChatThreadForScope(chatScopeId, sessionInfo.id, [...currentHistory, userMsg]);

        // 构建群聊上下文（使用从壳脚本传来的 userName）
        const groupCtx: GroupChatContext = {
          ...ctx,
          members: groupMembers,
          groupName: sessionInfo.name,
          userName: userName,
        };

        // 调用 groupChat 模块生成回复（传入已保存的用户消息，避免重复保存）
        await generateGroupChatReplies(groupCtx, text, chatScopeId, sessionInfo.id, userMsg);

        // 重新加载消息列表（包含 AI 回复）
        const allMessages = await loadWeChatThreadForScope(chatScopeId, sessionInfo.id);
        setMessages(allMessages as GroupChatMessage[]);

        // 发群聊消息时主动触发世界书同步（立即通知壳脚本）
        window.parent.postMessage({ type: TAVERN_PHONE_MSG.REQUEST_TRIGGER_WB_SYNC }, '*');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSendError(msg);
      } finally {
        setSending(false);
      }
    })();
  }, [ctx, sessionInfo, groupMembers, input, sending, chatScopeId]);

  // 打开群聊
  const openGroupChat = async () => {
    if (!sessionInfo) return;
    await setCurrentGroupChatSession(sessionInfo.id);
    setView('chat');
  };

  // 返回列表
  const backToList = () => {
    setView('list');
    setListTick(t => t + 1);
  };

  // 重新生成回复
  const regenerateReply = useCallback(async (msgId: string) => {
    if (!ctx || !sessionInfo || sending) return;

    setRegeneratingId(msgId);
    setSendError('');

    try {
      const groupCtx: GroupChatContext = {
        ...ctx,
        members: groupMembers,
        groupName: sessionInfo.name,
        userName: ctx.userName || getUserName(),
      };

      const newMsg = await regenerateMemberReply(groupCtx, chatScopeId, sessionInfo.id, msgId);

      if (newMsg) {
        // 重新加载消息列表
        const allMessages = await loadWeChatThreadForScope(chatScopeId, sessionInfo.id);
        setMessages(allMessages as GroupChatMessage[]);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegeneratingId(null);
    }
  }, [ctx, sessionInfo, groupMembers, sending, chatScopeId]);

  // 最后一条消息
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

  // ==================== 长按菜单功能 ====================

  // 关闭长按菜单
  const closeLongPressMenu = useCallback(() => {
    setLongPressMenu(prev => ({ ...prev, visible: false }));
    window.setTimeout(() => {
      setLongPressMenu({ visible: false, messageId: null, messageContent: '', messageRole: null, position: { x: 0, y: 0 } });
    }, 200);
  }, []);

  // 长按检测处理
  const handleMessageTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent, message: GroupChatMessage) => {
    // 清除之前的定时器
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }

    // 获取坐标
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    longPressTimerRef.current = window.setTimeout(() => {
      setLongPressMenu({
        visible: true,
        messageId: message.id,
        messageContent: message.content,
        messageRole: message.role,
        position: { x: clientX, y: clientY },
      });
    }, 600); // 600ms 长按阈值
  }, []);

  const handleMessageTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 撤回消息
  const handleRetractMessage = useCallback(async () => {
    const messageId = longPressMenu.messageId;
    const messageRole = longPressMenu.messageRole;
    if (!messageId || !sessionInfo) return;

    closeLongPressMenu();
    setRetractingIds(prev => new Set(prev).add(messageId));

    try {
      setMessages(prev => {
        // 找到被撤回消息的索引
        const idx = prev.findIndex(m => m.id === messageId);
        if (idx < 0) return prev;

        // 移除被撤回的消息
        const next = prev.filter(m => m.id !== messageId);

        // 添加系统提示消息
        const senderName = prev[idx].senderName || '对方';
        const systemMsg: GroupChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: messageRole === 'user' ? '你撤回了一条消息' : `${senderName}撤回了一条消息`,
          senderId: '<system>',
          senderName: '系统',
          time: Date.now(),
        };

        // 在原消息位置插入系统提示
        next.splice(idx, 0, systemMsg);

        // 保存到存储
        void saveWeChatThreadForScope(chatScopeId, sessionInfo.id, next);

        // 触发世界书同步
        window.parent.postMessage({ type: TAVERN_PHONE_MSG.REQUEST_TRIGGER_WB_SYNC }, '*');
        return next;
      });

      console.info('[GroupChat] 消息已撤回:', messageId);
    } finally {
      setRetractingIds(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, [longPressMenu.messageId, longPressMenu.messageRole, sessionInfo, chatScopeId, closeLongPressMenu]);

  // 重发消息（重新生成该成员的回复）
  const handleResendMessage = useCallback(async () => {
    const messageId = longPressMenu.messageId;
    if (!messageId || !sessionInfo || !ctx) return;

    closeLongPressMenu();

    // 找到要重发的消息
    const targetMsg = messages.find(m => m.id === messageId);
    if (!targetMsg || targetMsg.role !== 'assistant') return;

    setRegeneratingId(messageId);
    setSendError('');

    try {
      const groupCtx: GroupChatContext = {
        ...ctx,
        members: groupMembers,
        groupName: sessionInfo.name,
        userName: ctx.userName || getUserName(),
      };

      const newMsg = await regenerateMemberReply(groupCtx, chatScopeId, sessionInfo.id, messageId);

      if (newMsg) {
        // 重新加载消息列表
        const allMessages = await loadWeChatThreadForScope(chatScopeId, sessionInfo.id);
        setMessages(allMessages as GroupChatMessage[]);
      }

      console.info('[GroupChat] 消息已重发:', messageId);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegeneratingId(null);
    }
  }, [longPressMenu.messageId, sessionInfo, ctx, groupMembers, messages, chatScopeId, closeLongPressMenu]);

  // ==================== 群聊管理功能 ====================

  // 创建新群聊
  const handleCreateGroup = useCallback(async () => {
    const selectedContacts = availableContacts.filter(c => c.selected);
    if (selectedContacts.length === 0) {
      setSendError('请至少选择一个成员');
      return;
    }

    const name = newGroupName.trim() || `${selectedContacts[0].displayName}的群聊`;
    const members = convertContactsToMembers(selectedContacts);

    const newGroup = await createGroupChat(chatScopeId, { name, members });

    // 重置状态
    setNewGroupName('');
    setAvailableContacts(prev => prev.map(c => ({ ...c, selected: false })));
    setView('list');

    // 刷新列表并进入新群聊
    const groups = await getAllGroupChats(chatScopeId);
    setAllGroupChats(groups);
    setSessionInfo({
      id: newGroup.id,
      name: newGroup.name,
      memberCount: newGroup.members.length,
      lastActivity: '刚刚',
      lastPreview: '群聊创建成功',
      members: newGroup.members,
    });
    setGroupMembers(newGroup.members);
    await setCurrentGroupChatSession(newGroup.id);
    setView('chat');
  }, [availableContacts, newGroupName, chatScopeId]);

  // 更新群聊名称
  const handleUpdateGroupName = useCallback(async () => {
    if (!editingGroup) return;

    const name = editGroupName.trim();
    if (!name) {
      setSendError('群聊名称不能为空');
      return;
    }

    const updated = await updateGroupChat(editingGroup.id, { name });
    if (updated) {
      // 刷新列表
      const groups = await getAllGroupChats(chatScopeId);
      setAllGroupChats(groups);

      // 如果正在编辑当前会话，更新显示
      if (sessionInfo?.id === editingGroup.id) {
        setSessionInfo({ ...sessionInfo, name });
      }
    }

    setEditingGroup(null);
    setEditGroupName('');
    setView('list');
  }, [editingGroup, editGroupName, chatScopeId, sessionInfo]);

  // 删除群聊
  const handleDeleteGroup = useCallback(async (groupId: string) => {
    if (confirm('确定要删除这个群聊吗？聊天记录将无法恢复。')) {
      await deleteGroupChat(groupId);

      // 刷新列表
      const groups = await getAllGroupChats(chatScopeId);
      setAllGroupChats(groups);

      // 如果删除的是当前会话，清空当前会话
      if (sessionInfo?.id === groupId) {
        setSessionInfo(null);
        setMessages([]);
        setGroupMembers([]);
        await setCurrentGroupChatSession(null);
      }

      setShowGroupOptions(null);
    }
  }, [chatScopeId, sessionInfo]);

  // 切换联系人选择状态
  const toggleContactSelection = useCallback((contactId: string) => {
    setAvailableContacts(prev =>
      prev.map(c => c.id === contactId ? { ...c, selected: !c.selected } : c)
    );
  }, []);

  // 打开群聊进入聊天界面
  const openGroupChatById = useCallback((groupId: string) => {
    const group = getGroupChat(groupId);
    if (!group) return;

    setCurrentGroupChatSession(groupId);
    setSessionInfo({
      id: group.id,
      name: group.name,
      memberCount: group.members.length,
      lastActivity: new Date(group.lastActivity).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      lastPreview: '进入群聊...',
      members: group.members,
    });
    setGroupMembers(group.members);
    setView('chat');
  }, []);

  // 编辑群聊
  const startEditGroup = useCallback((group: GroupChatSession) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setView('edit');
    setShowGroupOptions(null);
  }, []);

  // ==================== 渲染 ====================

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#EDEDED]">
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  // 群聊列表视图
  if (view === 'list') {
    return (
      <div className="relative flex flex-col h-full bg-[#EDEDED]">
        {/* 头部 */}
        <div className="bg-[#EDEDED] pt-12 pb-3 px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2 w-1/3">
            <button type="button" onClick={onClose} className="p-1 -ml-1 text-gray-900">
              <ChevronLeft size={28} />
            </button>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-[17px] font-semibold text-gray-900">群聊</h1>
          </div>
          <div className="w-1/3 flex justify-end">
            <button
              type="button"
              onClick={() => setView('create')}
              className="p-1 -mr-1 text-gray-900"
              title="创建新群聊"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>

        {/* 群聊列表 */}
        <div className="flex-1 overflow-y-auto bg-white">
          {allGroupChats.length === 0 && sessionInfo ? (
            // 兼容旧版本：显示默认群聊
            <div
              role="button"
              tabIndex={0}
              onClick={openGroupChat}
              onKeyDown={e => { if (e.key === 'Enter') openGroupChat(); }}
              className="w-full flex items-center px-4 py-4 active:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="shrink-0 mr-3">
                <div className="h-12 w-12 rounded-lg bg-[#07C160] flex items-center justify-center">
                  <Users size={24} color="white" />
                </div>
              </div>
              <div className="flex-1 border-b border-gray-100 pb-4 pt-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-[16px] font-medium text-gray-900">{sessionInfo.name}</h3>
                  <span className="text-xs text-gray-400">{sessionInfo.lastActivity}</span>
                </div>
                <p className="text-[14px] text-gray-500 truncate pr-4">{sessionInfo.lastPreview}</p>
              </div>
            </div>
          ) : allGroupChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users size={48} className="mb-4 opacity-30" />
              <p className="text-sm mb-4">还没有群聊</p>
              <button
                type="button"
                onClick={() => setView('create')}
                className="px-4 py-2 bg-[#07C160] text-white rounded-lg text-sm"
              >
                创建群聊
              </button>
            </div>
          ) : (
            allGroupChats.map((group, index) => (
              <div
                key={group.id}
                role="button"
                tabIndex={0}
                onClick={() => openGroupChatById(group.id)}
                onKeyDown={e => { if (e.key === 'Enter') openGroupChatById(group.id); }}
                className={`w-full flex items-center px-4 py-4 active:bg-gray-100 transition-colors cursor-pointer ${index !== allGroupChats.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="shrink-0 mr-3">
                  <div className="h-12 w-12 rounded-lg bg-[#07C160] flex items-center justify-center">
                    <Users size={24} color="white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-[16px] font-medium text-gray-900 truncate">{group.name}</h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                      {new Date(group.lastActivity).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[14px] text-gray-500 truncate pr-4">{group.members.length} 位成员</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowGroupOptions(showGroupOptions === group.id ? null : group.id);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>

                {/* 群聊选项菜单 */}
                {showGroupOptions === group.id && (
                  <div className="absolute right-4 mt-16 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditGroup(group);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit3 size={14} />
                      修改名称
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      删除群聊
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          {/* 点击空白处关闭菜单 */}
          {showGroupOptions && (
            <button
              type="button"
              className="fixed inset-0 z-10 bg-transparent"
              onClick={() => setShowGroupOptions(null)}
            />
          )}
        </div>

        {/* 成员列表弹窗 */}
        {showMemberList && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/45">
            <button
              type="button"
              className="min-h-0 flex-1 w-full cursor-default border-0 bg-transparent p-0"
              onClick={() => setShowMemberList(false)}
            />
            <div className="max-h-[60%] rounded-t-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-[16px] font-semibold text-gray-900">群成员 ({groupMembers.length})</span>
                <button
                  type="button"
                  onClick={() => setShowMemberList(false)}
                  className="text-[15px] text-[#576b95]"
                >
                  关闭
                </button>
              </div>
              <div className="overflow-y-auto px-2 pb-6 pt-1 max-h-[300px]">
                <ul className="divide-y divide-gray-100">
                  {groupMembers.map(member => (
                    <li key={member.id} className="flex items-center gap-3 px-2 py-3">
                      <GroupMemberAvatar
                        member={member}
                        avatarSrc={resolveRoleAvatarDisplay(
                          member.id,
                          member.avatarUrl,
                          avatarOverrides,
                          member.displayName,
                        )}
                        size="list"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-gray-900 truncate">{member.displayName}</p>
                        {member.personality && (
                          <p className="text-[11px] text-gray-400 truncate">{member.personality}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 创建群聊视图
  if (view === 'create') {
    const selectedCount = availableContacts.filter(c => c.selected).length;

    return (
      <div className="relative flex flex-col h-full bg-[#EDEDED]">
        {/* 头部 */}
        <div className="bg-[#EDEDED] pt-12 pb-3 px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2 w-1/3">
            <button type="button" onClick={() => setView('list')} className="p-1 -ml-1 text-gray-900">
              <ChevronLeft size={28} />
            </button>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-[17px] font-semibold text-gray-900">新建群聊</h1>
          </div>
          <div className="w-1/3 flex justify-end">
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={selectedCount === 0}
              className="px-3 py-1 bg-[#07C160] text-white rounded-lg text-sm disabled:opacity-40"
            >
              创建 ({selectedCount})
            </button>
          </div>
        </div>

        {/* 群聊名称输入 */}
        <div className="bg-white px-4 py-3 border-b border-gray-200">
          <label className="block text-sm text-gray-500 mb-2">群聊名称</label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-gray-50 rounded-lg text-[15px] text-gray-900 outline-none border border-gray-200 focus:border-[#07C160]"
            placeholder="输入群聊名称（可选）"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
          />
        </div>

        {/* 选择成员 */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm text-gray-500">选择成员加入群聊</p>
          </div>
          {availableContacts.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              暂无可用联系人
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {availableContacts.map(contact => (
                <li
                  key={contact.id}
                  className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer"
                  onClick={() => toggleContactSelection(contact.id)}
                >
                  <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${contact.selected ? 'border-[#07C160] bg-[#07C160]' : 'border-gray-300'}`}>
                    {contact.selected && <Check size={14} color="white" />}
                  </div>
                  <GroupMemberAvatar
                    member={{
                      id: contact.id,
                      displayName: contact.displayName,
                      personality: contact.personality,
                      thought: contact.thought,
                      avatarUrl: contact.avatarUrl,
                    }}
                    avatarSrc={resolveRoleAvatarDisplay(
                      contact.id,
                      contact.avatarUrl,
                      avatarOverrides,
                      contact.displayName,
                    )}
                    size="list"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-gray-900 truncate">{contact.displayName}</p>
                    {contact.personality && (
                      <p className="text-[11px] text-gray-400 truncate">{contact.personality}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 错误提示 */}
        {sendError && (
          <div className="px-4 py-2 text-[12px] text-red-600 bg-red-50">{sendError}</div>
        )}
      </div>
    );
  }

  // 编辑群聊名称视图
  if (view === 'edit' && editingGroup) {
    return (
      <div className="relative flex flex-col h-full bg-[#EDEDED]">
        {/* 头部 */}
        <div className="bg-[#EDEDED] pt-12 pb-3 px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2 w-1/3">
            <button type="button" onClick={() => setView('list')} className="p-1 -ml-1 text-gray-900">
              <ChevronLeft size={28} />
            </button>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-[17px] font-semibold text-gray-900">修改群名</h1>
          </div>
          <div className="w-1/3 flex justify-end">
            <button
              type="button"
              onClick={handleUpdateGroupName}
              disabled={!editGroupName.trim()}
              className="px-3 py-1 bg-[#07C160] text-white rounded-lg text-sm disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>

        {/* 群聊名称输入 */}
        <div className="bg-white px-4 py-3 mt-2">
          <label className="block text-sm text-gray-500 mb-2">群聊名称</label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-gray-50 rounded-lg text-[15px] text-gray-900 outline-none border border-gray-200 focus:border-[#07C160]"
            placeholder="输入群聊名称"
            value={editGroupName}
            onChange={e => setEditGroupName(e.target.value)}
          />
        </div>

        {/* 错误提示 */}
        {sendError && (
          <div className="px-4 py-2 text-[12px] text-red-600 bg-red-50">{sendError}</div>
        )}
      </div>
    );
  }

  // 群聊消息视图
  return (
    <div className="relative flex flex-col h-full bg-[#EDEDED]">
      {/* 头部 */}
      <div className="bg-[#EDEDED] pt-12 pb-3 px-2 flex items-center gap-1 shrink-0 border-b border-gray-200/80">
        <button type="button" onClick={backToList} className="p-1 text-gray-900">
          <ChevronLeft size={28} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <h1 className="text-[17px] font-semibold text-gray-900 truncate">
            {sessionInfo?.name || '群聊'}
          </h1>
          <p className="text-[11px] text-gray-500">{groupMembers.length} 位成员</p>
        </div>
        <button
          type="button"
          onClick={() => setShowMemberList(true)}
          className="shrink-0 p-2 text-gray-900"
          title="查看成员"
        >
          <Users size={20} />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0 bg-[#EDEDED]">
        <div className="space-y-3">
          {messages.map(m => {
            const isUser = m.role === 'user';
            const isSystem = m.role === 'system';
            const msg = m as GroupChatMessage;
            const senderName = msg.senderName;
            const isLastOne = lastMsg?.id === m.id;

            // 系统消息（如撤回提示）居中显示
            if (isSystem) {
              return (
                <div key={m.id} className="flex justify-center py-1">
                  <span className="text-[12px] text-gray-400 bg-gray-100/80 px-3 py-1 rounded-full">
                    {m.content}
                  </span>
                </div>
              );
            }

            // 获取成员信息
            const gm = groupMembers.find(g => g.id === msg.senderId) || {
              id: msg.senderId || 'unknown',
              displayName: senderName || '未知',
            };
            // 获取成员气泡样式
            const bubbleStyle = getMemberBubbleStyle(gm.id, gm.displayName, isUser);

            return (
              <div
                key={m.id}
                className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                onTouchStart={(e) => handleMessageTouchStart(e, msg)}
                onTouchEnd={handleMessageTouchEnd}
                onMouseDown={(e) => handleMessageTouchStart(e, msg)}
                onMouseUp={handleMessageTouchEnd}
                onMouseLeave={handleMessageTouchEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleMessageTouchStart(e, msg);
                }}
              >
                {!isUser && (
                  <GroupMemberAvatar
                    member={gm}
                    avatarSrc={resolveRoleAvatarDisplay(
                      gm.id,
                      gm.avatarUrl,
                      avatarOverrides,
                      gm.displayName,
                    )}
                    size="bubble"
                    className="mt-0.5 shrink-0"
                  />
                )}
                <div className={`max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {!isUser && senderName && (
                    <span className="text-[10px] text-gray-400 mb-0.5 ml-1">{senderName}</span>
                  )}
                  <div
                    className={`px-3 py-2 text-[15px] leading-relaxed select-none ${bubbleStyle.bg} ${bubbleStyle.text} ${bubbleStyle.extraClasses || 'rounded-lg'}`}
                    style={bubbleStyle.extraStyle}
                  >
                    <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                    <p className="text-[10px] mt-1 opacity-60">{formatMsgTime(m.time)}</p>
                  </div>
                  {!isUser && isLastOne && (
                    <button
                      type="button"
                      onClick={() => regenerateReply(m.id)}
                      disabled={Boolean(regeneratingId) || sending}
                      className="mt-1 p-1 text-[#576b95] hover:bg-black/5 rounded disabled:opacity-40"
                      title="重新生成"
                    >
                      {regeneratingId === m.id ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                    </button>
                  )}
                </div>
                {isUser && (
                  <div className="mt-0.5 h-8 w-8 shrink-0 rounded-md bg-[#D3D3D3] flex items-center justify-center text-xs text-gray-500">
                    我
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 错误提示 */}
      {sendError && (
        <div className="px-3 py-1 text-[12px] text-red-600 bg-red-50 shrink-0">{sendError}</div>
      )}

      {/* 输入框 */}
      <div className="shrink-0 border-t border-gray-200 bg-[#F7F7F7] px-2 py-2 pb-6 flex items-end gap-2">
        <textarea
          rows={1}
          className="flex-1 max-h-24 min-h-[40px] rounded-lg bg-white border border-gray-200 px-3 py-2 text-[15px] text-gray-900 outline-none resize-none"
          placeholder="发送群聊消息..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button
          type="button"
          disabled={sending || !input.trim()}
          onClick={() => void sendMessage()}
          className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-[#07C160] text-white disabled:opacity-40"
        >
          {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
        </button>
      </div>

      {/* 长按菜单 - 微信风格 Action Sheet */}
      {longPressMenu.visible && (
        <div
          className="fixed inset-0 z-100 bg-black/30"
          onClick={closeLongPressMenu}
          onTouchStart={closeLongPressMenu}
        >
          <div
            className="absolute bg-white rounded-xl shadow-2xl overflow-hidden min-w-[180px]"
            style={{
              left: Math.min(Math.max(longPressMenu.position.x - 90, 16), window.innerWidth - 196),
              top: Math.min(Math.max(longPressMenu.position.y - 80, 16), window.innerHeight - 150),
            }}
          >
            <div className="flex flex-col">
              <button
                type="button"
                onClick={handleRetractMessage}
                disabled={retractingIds.has(longPressMenu.messageId || '')}
                className={`px-5 py-4 text-[17px] text-center text-red-500 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 ${longPressMenu.messageRole === 'assistant' ? 'border-b border-gray-100' : ''}`}
              >
                {retractingIds.has(longPressMenu.messageId || '') ? '撤回中…' : '撤回'}
              </button>
              {/* 只有对方消息显示重发选项 */}
              {longPressMenu.messageRole === 'assistant' && (
                <button
                  type="button"
                  onClick={handleResendMessage}
                  disabled={regeneratingId === longPressMenu.messageId}
                  className="px-5 py-4 text-[17px] text-center text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {regeneratingId === longPressMenu.messageId ? '重发中…' : '重发'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 成员列表弹窗 */}
      {showMemberList && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/45">
          <button
            type="button"
            className="min-h-0 flex-1 w-full cursor-default border-0 bg-transparent p-0"
            onClick={() => setShowMemberList(false)}
          />
          <div className="max-h-[60%] rounded-t-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-[16px] font-semibold text-gray-900">群成员 ({groupMembers.length})</span>
              <button
                type="button"
                onClick={() => setShowMemberList(false)}
                className="text-[15px] text-[#576b95]"
              >
                关闭
              </button>
            </div>
            <div className="overflow-y-auto px-2 pb-6 pt-1 max-h-[300px]">
              <ul className="divide-y divide-gray-100">
                {groupMembers.map(member => (
                  <li key={member.id} className="flex items-center gap-3 px-2 py-3">
                    <GroupMemberAvatar
                      member={member}
                      avatarSrc={resolveRoleAvatarDisplay(
                        member.id,
                        member.avatarUrl,
                        avatarOverrides,
                        member.displayName,
                      )}
                      size="list"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-gray-900 truncate">{member.displayName}</p>
                      {member.personality && (
                        <p className="text-[11px] text-gray-400 truncate">{member.personality}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
