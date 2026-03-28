import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Loader2, MessageCircle, User, Send, Plus } from 'lucide-react';
import {
  requestTavernPhoneContext,
  requestRoleArchiveList,
  type TavernPhoneContextPayload,
  type TavernPhoneWeChatContact,
} from '../../tavernPhoneBridge';
import { completeWeChatReply } from '../../chatCompletions';
import { loadWeChatThreadByContactId, saveWeChatThreadByContactId, type WeChatStoredMessage } from '../../weChatStorage';
import {
  loadWeChatMe,
  resolveMeAvatarDisplay,
  saveWeChatMe,
  type WeChatMeProfile,
} from '../../weChatMeProfile';
import {
  addPinnedContact,
  loadPinnedContacts,
  mergeContactLists,
} from '../../weChatPinnedContacts';

/** 无自定义头像时取姓名首字（如「白梦梦」→「白」） */
function contactInitial(displayName: string): string {
  const t = displayName.trim();
  if (!t) {
    return '?';
  }
  const chars = Array.from(t);
  return chars[0] ?? '?';
}

function ContactAvatar({
  contact,
  className = '',
  size,
}: {
  contact: TavernPhoneWeChatContact;
  className?: string;
  /** 列表大头像 / 气泡小头像 / 添加弹层 */
  size: 'list' | 'bubble' | 'picker';
}) {
  if (contact.avatarUrl) {
    return <img src={contact.avatarUrl} alt="" className={className} />;
  }
  const initial = contactInitial(contact.displayName);
  const sizeCls =
    size === 'bubble'
      ? 'h-9 w-9 text-[13px] rounded-md'
      : size === 'picker'
        ? 'h-11 w-11 text-[15px] rounded-lg'
        : 'h-12 w-12 text-[17px] rounded-lg';
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-[#E5E5EA] font-semibold text-[#1c1c1e] ${sizeCls} ${className}`}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function mergeContactContext(
  base: TavernPhoneContextPayload,
  contact: TavernPhoneWeChatContact,
): TavernPhoneContextPayload {
  return {
    ...base,
    displayName: contact.displayName,
    personality: contact.personality ?? base.personality,
    thought: contact.thought ?? base.thought,
  };
}

function formatMsgTime(t: number): string {
  const d = new Date(t);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function lastPreviewForContact(contactId: string): { text: string; time: string } {
  const thread = loadWeChatThreadByContactId(contactId);
  const last = thread[thread.length - 1];
  if (!last) {
    return { text: '开始聊天…', time: '' };
  }
  return { text: last.content, time: formatMsgTime(last.time) };
}

export default function WeChatApp({ onClose }: { onClose: () => void }) {
  const [ctx, setCtx] = useState<TavernPhoneContextPayload | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [mainTab, setMainTab] = useState<'chats' | 'me'>('chats');
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [selectedContact, setSelectedContact] = useState<TavernPhoneWeChatContact | null>(null);
  const [messages, setMessages] = useState<WeChatStoredMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [meProfile, setMeProfile] = useState<WeChatMeProfile>(() => loadWeChatMe());
  const [meDraft, setMeDraft] = useState<WeChatMeProfile>(() => loadWeChatMe());
  const [meSavedHint, setMeSavedHint] = useState(false);
  /** 从聊天返回时递增，以刷新列表中的最后一条预览 */
  const [listTick, setListTick] = useState(0);
  const [pinnedRev, setPinnedRev] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveCandidates, setArchiveCandidates] = useState<TavernPhoneWeChatContact[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainTab === 'me') {
      setMeDraft(loadWeChatMe());
    }
  }, [mainTab]);

  useEffect(() => {
    if (!addModalOpen) {
      return;
    }
    let cancelled = false;
    (async () => {
      setArchiveLoading(true);
      setArchiveCandidates([]);
      const list = await requestRoleArchiveList();
      if (!cancelled) {
        setArchiveCandidates(list);
        setArchiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addModalOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCtxLoading(true);
      const c = await requestTavernPhoneContext();
      if (cancelled) {
        return;
      }
      setCtx(c);
      setCtxLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedContact) {
      setMessages(loadWeChatThreadByContactId(selectedContact.id));
    } else {
      setMessages([]);
    }
  }, [selectedContact]);

  useEffect(() => {
    if (selectedContact) {
      saveWeChatThreadByContactId(selectedContact.id, messages);
    }
  }, [selectedContact, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, view]);

  const chatCtx = useMemo(() => {
    if (!ctx || !selectedContact) {
      return null;
    }
    return mergeContactContext(ctx, selectedContact);
  }, [ctx, selectedContact]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !ctx || !selectedContact || !chatCtx || sending) {
      return;
    }
    setSendError('');
    const userMsg: WeChatStoredMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      time: Date.now(),
    };
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    const historyForApi = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    try {
      const reply = await completeWeChatReply(chatCtx, historyForApi);
      const assistantMsg: WeChatStoredMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        time: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }, [ctx, selectedContact, chatCtx, input, messages, sending]);

  const openChat = (c: TavernPhoneWeChatContact) => {
    setSelectedContact(c);
    setView('chat');
  };

  const backToList = () => {
    setView('list');
    setSelectedContact(null);
    setSendError('');
    setListTick(t => t + 1);
  };

  const saveMe = () => {
    saveWeChatMe(meDraft);
    setMeProfile(loadWeChatMe());
    setMeSavedHint(true);
    window.setTimeout(() => setMeSavedHint(false), 2000);
  };

  const serverContacts = useMemo(() => {
    const raw = ctx?.contacts;
    if (raw && raw.length > 0) {
      return raw;
    }
    if (ctx) {
      return [{ id: 'default', displayName: ctx.displayName }];
    }
    return [];
  }, [ctx]);

  const pinnedContacts = useMemo(() => loadPinnedContacts(), [pinnedRev]);

  const contacts = useMemo(
    () => mergeContactLists(serverContacts, pinnedContacts),
    [serverContacts, pinnedContacts],
  );

  const addedIds = useMemo(() => new Set(contacts.map(c => c.id)), [contacts]);

  const handleAddContact = (c: TavernPhoneWeChatContact) => {
    addPinnedContact(c);
    setPinnedRev(r => r + 1);
    setListTick(t => t + 1);
    setAddModalOpen(false);
  };
  const showOffline = ctx?.offline;
  const meAvatar = resolveMeAvatarDisplay(meProfile);

  const headerTitle = mainTab === 'me' ? '我' : '微信';

  return (
    <div className="relative flex flex-col h-full bg-[#EDEDED]">
      {view === 'chat' && selectedContact && chatCtx ? (
        <>
          <div className="bg-[#EDEDED] pt-12 pb-3 px-2 flex items-center gap-1 shrink-0 border-b border-gray-200/80">
            <button type="button" onClick={backToList} className="p-1 text-gray-900">
              <ChevronLeft size={28} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[17px] font-semibold text-gray-900 truncate">{selectedContact.displayName}</h1>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#EDEDED] px-3 py-2 min-h-0">
            {chatCtx.thought ? (
              <div className="mb-3 rounded-lg bg-white/90 px-3 py-2 text-[12px] text-gray-600 leading-snug shadow-sm">
                <span className="text-gray-400">内心 · </span>
                {chatCtx.thought}
              </div>
            ) : null}
            <div className="space-y-3">
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' ? (
                    <ContactAvatar contact={selectedContact} size="bubble" className="mt-0.5" />
                  ) : null}
                  <div
                    className={`max-w-[72%] rounded-lg px-3 py-2 text-[15px] leading-relaxed ${
                      m.role === 'user' ? 'bg-[#95EC69] text-black' : 'bg-white text-gray-900 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-gray-600' : 'text-gray-400'}`}>
                      {formatMsgTime(m.time)}
                    </p>
                  </div>
                  {m.role === 'user' ? (
                    <img
                      src={meAvatar}
                      alt=""
                      className="mt-0.5 h-9 w-9 shrink-0 rounded-md bg-gray-200"
                    />
                  ) : null}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {sendError ? (
            <div className="px-3 py-1 text-[12px] text-red-600 bg-red-50 shrink-0">{sendError}</div>
          ) : null}

          <div className="shrink-0 border-t border-gray-200 bg-[#F7F7F7] px-2 py-2 pb-6 flex items-end gap-2">
            <textarea
              rows={1}
              className="flex-1 max-h-24 min-h-[40px] rounded-lg bg-white border border-gray-200 px-3 py-2 text-[15px] text-gray-900 outline-none resize-none"
              placeholder="发送消息…"
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
              aria-label="发送"
            >
              {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-[#EDEDED] pt-12 pb-3 px-4 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-2 w-1/3">
              <button type="button" onClick={onClose} className="p-1 -ml-1 text-gray-900">
                <ChevronLeft size={28} />
              </button>
            </div>
            <div className="w-1/3 text-center">
              <h1 className="text-[17px] font-semibold text-gray-900">{headerTitle}</h1>
            </div>
            <div className="w-1/3 flex justify-end">
              {mainTab === 'chats' ? (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="p-1 -mr-1 text-gray-900"
                  aria-label="从可能认识的人添加"
                  title="从可能认识的人添加"
                >
                  <Plus size={26} strokeWidth={2.25} />
                </button>
              ) : (
                <span className="inline-block w-[26px]" aria-hidden />
              )}
            </div>
          </div>

          {mainTab === 'chats' ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-white min-h-0">
              {showOffline && !ctxLoading ? (
                <div className="shrink-0 mx-3 mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  未连接酒馆变量（本地预览）
                </div>
              ) : null}
              <div className="flex-1 overflow-y-auto min-h-0">
                {ctxLoading ? (
                  <div className="flex items-center justify-center py-20 text-gray-400 text-[15px]">
                    <Loader2 className="animate-spin mr-2" size={20} />
                    加载会话…
                  </div>
                ) : (
                  contacts.map(c => {
                    void listTick;
                    const { text, time } = lastPreviewForContact(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openChat(c)}
                        className="w-full flex items-center px-4 py-3 active:bg-gray-100 transition-colors text-left"
                      >
                        <div className="relative shrink-0">
                          <ContactAvatar contact={c} size="list" />
                        </div>
                        <div className="ml-3 flex-1 border-b border-gray-100 pb-3 pt-1">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="text-[16px] font-medium text-gray-900">{c.displayName}</h3>
                            <span className="text-xs text-gray-400">{time}</span>
                          </div>
                          <p className="text-[14px] text-gray-500 truncate pr-4">{text}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto bg-[#EDEDED] px-4 py-4 min-h-0">
              <div className="rounded-[12px] bg-white p-4 shadow-sm">
                <div className="flex flex-col items-center gap-3 border-b border-gray-100 pb-4">
                  <img
                    src={resolveMeAvatarDisplay(meDraft)}
                    alt=""
                    className="h-24 w-24 rounded-2xl bg-gray-200 object-cover"
                  />
                  <p className="text-[13px] text-gray-400">头像使用下方链接（留空则用默认卡通头像）</p>
                </div>
                <label className="mt-4 block">
                  <span className="text-[13px] text-gray-500">昵称</span>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F7F7F7] px-3 py-2 text-[16px] text-gray-900 outline-none"
                    value={meDraft.nickname}
                    onChange={e => setMeDraft(prev => ({ ...prev, nickname: e.target.value }))}
                    placeholder="主角昵称"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-[13px] text-gray-500">头像链接</span>
                  <input
                    type="url"
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F7F7F7] px-3 py-2 text-[14px] text-gray-900 outline-none"
                    value={meDraft.avatarUrl}
                    onChange={e => setMeDraft(prev => ({ ...prev, avatarUrl: e.target.value }))}
                    placeholder="https://…"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveMe}
                  className="mt-5 w-full rounded-xl bg-[#07C160] py-3 text-[16px] font-semibold text-white active:opacity-90"
                >
                  保存
                </button>
                {meSavedHint ? (
                  <p className="mt-2 text-center text-[13px] text-[#07C160]">已保存</p>
                ) : null}
              </div>
            </div>
          )}

          <div className="bg-[#F7F7F7] border-t border-gray-200 flex justify-around items-center h-[83px] pb-5 pt-1 shrink-0">
            <button
              type="button"
              onClick={() => setMainTab('chats')}
              className={`flex flex-col items-center gap-0.5 ${mainTab === 'chats' ? 'text-[#07C160]' : 'text-gray-400'}`}
            >
              <MessageCircle size={26} className={mainTab === 'chats' ? 'fill-current' : ''} />
              <span className="text-[10px] font-medium">信息</span>
            </button>
            <button
              type="button"
              onClick={() => setMainTab('me')}
              className={`flex flex-col items-center gap-0.5 ${mainTab === 'me' ? 'text-[#07C160]' : 'text-gray-400'}`}
            >
              <User size={26} />
              <span className="text-[10px] font-medium">我</span>
            </button>
          </div>

          {addModalOpen ? (
            <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/45">
              <button
                type="button"
                className="min-h-0 flex-1 w-full cursor-default border-0 bg-transparent p-0"
                aria-label="关闭"
                onClick={() => setAddModalOpen(false)}
              />
              <div className="max-h-[72%] rounded-t-2xl bg-white shadow-xl flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0">
                  <span className="text-[16px] font-semibold text-gray-900">从可能认识的人添加</span>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="text-[15px] text-[#576b95]"
                  >
                    关闭
                  </button>
                </div>
                <div className="overflow-y-auto px-2 pb-6 pt-1 min-h-0">
                  {archiveLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400 text-[14px]">
                      <Loader2 className="animate-spin mr-2" size={18} />
                      读取变量…
                    </div>
                  ) : archiveCandidates.length === 0 ? (
                    <p className="px-3 py-6 text-[13px] text-gray-500 leading-relaxed">
                      未在变量中找到角色列表。若数据在规则 JSON 的{' '}
                      <code className="rounded bg-gray-100 px-1">stat_data.角色档案</code> 下，请更新小手机壳脚本后重试；也可在脚本变量中设置{' '}
                      <code className="rounded bg-gray-100 px-1">phone_wechat_contacts_path</code>{' '}
                      （例如 stat_data.角色档案）。
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {archiveCandidates.map(c => {
                        const already = addedIds.has(c.id);
                        return (
                          <li key={c.id} className="flex items-center gap-3 px-2 py-3">
                            <ContactAvatar contact={c} size="picker" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-medium text-gray-900 truncate">{c.displayName}</p>
                              <p className="text-[11px] text-gray-400 truncate">{c.id}</p>
                            </div>
                            <button
                              type="button"
                              disabled={already}
                              onClick={() => handleAddContact(c)}
                              className="shrink-0 rounded-lg bg-[#07C160] px-3 py-1.5 text-[13px] font-medium text-white disabled:bg-gray-300 disabled:text-white"
                            >
                              {already ? '已在列表' : '添加'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
