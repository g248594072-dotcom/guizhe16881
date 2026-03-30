import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpFromLine,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react';
import {
  requestTavernPhoneContext,
  subscribeChatScopeChange,
  type TavernPhoneContextPayload,
} from '../../tavernPhoneBridge';
import {
  initWeChatStorage,
  loadWeChatThreadForScope,
} from '../../weChatStorage';
import { LOCAL_OFFLINE_SCOPE, resolveChatScopeId } from '../../weChatScope';
import {
  getOrCreateGroupChatSession,
  getGroupChatDisplayInfo,
  generateGroupChatReplies,
  regenerateMemberReply,
  setCurrentGroupChatSession,
  type GroupChatMessage,
} from '../../groupChat';
import {
  type GroupMember,
  type GroupChatContext,
} from '../../chatCompletions';

// ==================== 类型定义 ====================

type GroupChatView = 'list' | 'chat';

interface GroupSessionInfo {
  id: string;
  name: string;
  memberCount: number;
  lastActivity: string;
  lastPreview: string;
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
  size = 'bubble',
  className = '',
}: {
  member: GroupMember;
  size?: 'bubble' | 'list' | 'header';
  className?: string;
}) {
  const sizeClasses = {
    bubble: 'h-8 w-8 text-xs rounded-md',
    list: 'h-11 w-11 text-sm rounded-lg',
    header: 'h-9 w-9 text-sm rounded-md',
  };

  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
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
  const [injectBusy, setInjectBusy] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [listTick, setListTick] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const contextFetchGenRef = useRef(0);

  // 初始化
  useEffect(() => {
    void initWeChatStorage();
  }, []);

  // 加载上下文
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
        });

        // 构建群聊成员
        const members: GroupMember[] = c.contacts.map(contact => ({
          id: contact.id,
          displayName: contact.displayName,
          personality: contact.personality,
          thought: contact.thought,
        }));
        setGroupMembers(members);
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

  // 加载会话信息
  useEffect(() => {
    if (!ctx || groupMembers.length === 0) return;
    let cancelled = false;

    (async () => {
      const session = getOrCreateGroupChatSession(chatScopeId, groupMembers);
      const displayInfo = getGroupChatDisplayInfo(session);

      const msgs = await loadWeChatThreadForScope(chatScopeId, session.id);
      const msgsAsGroup = msgs as GroupChatMessage[];
      const lastMsg = msgsAsGroup[msgsAsGroup.length - 1];
      const preview = lastMsg
        ? `${(lastMsg as GroupChatMessage).senderName || '我'}: ${lastMsg.content.substring(0, 20)}...`
        : '群聊暂无消息';

      if (!cancelled) {
        setSessionInfo({
          id: session.id,
          name: displayInfo.memberNames,
          memberCount: displayInfo.memberCount,
          lastActivity: displayInfo.lastActivityTime,
          lastPreview: preview,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [ctx, chatScopeId, groupMembers, listTick]);

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

    try {
      setInput('');

      // 构建群聊上下文
      const groupCtx: GroupChatContext = {
        ...ctx,
        members: groupMembers,
        groupName: sessionInfo.name,
      };

      // 调用 groupChat 模块生成回复（会自动保存消息）
      await generateGroupChatReplies(groupCtx, text, chatScopeId);

      // 重新加载消息列表
      const allMessages = await loadWeChatThreadForScope(chatScopeId, sessionInfo.id);
      setMessages(allMessages as GroupChatMessage[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }, [ctx, sessionInfo, groupMembers, input, sending, chatScopeId]);

  // 打开群聊
  const openGroupChat = () => {
    if (!sessionInfo) return;
    setCurrentGroupChatSession(sessionInfo.id);
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

  // 填入主界面
  const handleInjectToMain = async () => {
    if (!lastMsg || injectBusy) return;
    setInjectBusy(true);
    try {
      const { requestInjectToInput } = await import('../../tavernPhoneBridge');
      await requestInjectToInput(lastMsg.content);
    } finally {
      setInjectBusy(false);
    }
  };

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
              onClick={() => setShowMemberList(!showMemberList)}
              className="p-1 -mr-1 text-gray-900"
              title="查看成员"
            >
              <Users size={24} />
            </button>
          </div>
        </div>

        {/* 群聊入口 */}
        <div className="flex-1 overflow-hidden bg-white">
          {sessionInfo ? (
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
          ) : (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              加载群聊信息...
            </div>
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
                      <GroupMemberAvatar member={member} size="list" />
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
        {lastMsg && !ctx?.offline && (
          <button
            type="button"
            onClick={handleInjectToMain}
            disabled={injectBusy}
            className="shrink-0 flex items-center gap-0.5 rounded-lg px-2 py-1 text-[13px] text-[#576b95] disabled:opacity-40 active:bg-black/5"
          >
            {injectBusy ? <Loader2 className="animate-spin" size={16} /> : <ArrowUpFromLine size={16} />}
            填入
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0 bg-[#EDEDED]">
        <div className="space-y-3">
          {messages.map(m => {
            const isUser = m.role === 'user';
            const senderName = (m as GroupChatMessage).senderName;
            const isLastOne = lastMsg?.id === m.id;

            return (
              <div
                key={m.id}
                className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <GroupMemberAvatar
                    member={groupMembers.find(gm => gm.id === (m as GroupChatMessage).senderId) || {
                      id: (m as GroupChatMessage).senderId || 'unknown',
                      displayName: senderName || '未知',
                    }}
                    size="bubble"
                    className="mt-0.5 shrink-0"
                  />
                )}
                <div className={`max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {!isUser && senderName && (
                    <span className="text-[10px] text-gray-400 mb-0.5 ml-1">{senderName}</span>
                  )}
                  <div
                    className={`px-3 py-2 text-[15px] leading-relaxed ${
                      isUser
                        ? 'bg-[#95EC69] text-gray-900 rounded-lg'
                        : 'bg-white text-gray-900 rounded-lg'
                    }`}
                  >
                    <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                    <p className="text-[10px] mt-1 text-gray-400">{formatMsgTime(m.time)}</p>
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
                    <GroupMemberAvatar member={member} size="list" />
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
