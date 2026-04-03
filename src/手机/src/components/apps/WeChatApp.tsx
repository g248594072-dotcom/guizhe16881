import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bug,
  ChevronLeft,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  User,
  Send,
  Plus,
} from 'lucide-react';
import {
  requestTavernPhoneContext,
  requestRoleArchiveList,
  requestWritePhoneMemory,
  subscribeChatScopeChange,
  TAVERN_PHONE_MSG,
  type TavernPhoneContextPayload,
  type TavernPhoneWeChatContact,
  initExportThreadsListener,
} from '../../tavernPhoneBridge';
import { buildWeChatMessages, completeWeChatReply, summarizePhoneExchangeForMemory } from '../../chatCompletions';
import { getTavernPhoneApiConfig } from '../../tavernPhoneApiConfig';
import {
  initWeChatStorage,
  loadWeChatThreadForScope,
  saveWeChatThreadForScope,
  type WeChatStoredMessage,
} from '../../weChatStorage';
import { triggerInstantSync } from '../../chatSync';
import { LOCAL_OFFLINE_SCOPE, resolveChatScopeId } from '../../weChatScope';
import {
  loadWeChatMe,
  resolveMeAvatarDisplay,
  saveWeChatMe,
  type WeChatMeProfile,
} from '../../weChatMeProfile';
import {
  addPinnedContact,
  loadPinnedContacts,
  mergePinnedWithContextAvatars,
} from '../../weChatPinnedContacts';
import { fileToAvatarDataUrl } from '../../weChatAvatarFile';
import { getAnalysisScheduler } from '../../characterArchive/analysisScheduler';
import { loadCharacterArchiveById } from '../../characterArchive/bridge';
import {
  PHONE_WECHAT_ME_AVATAR_ID,
  resolveCharacterAvatarFromBrowserOnly,
  setCharacterAvatarOverride,
  usePhoneCharacterAvatarOverrides,
} from '../../phoneCharacterAvatars';

type AvatarPickTarget = { kind: 'me' } | { kind: 'contact'; contact: TavernPhoneWeChatContact };

/** 无自定义链接时：微信经典灰色默认头像（剪影） */
function MeWeChatDefaultAvatar({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 rounded-md bg-[#D3D3D3] text-[#A8A8A8] ${className}`}
      viewBox="0 0 96 96"
      aria-hidden
    >
      <rect width="96" height="96" rx="12" fill="#D3D3D3" />
      <circle cx="48" cy="38" r="18" fill="#A8A8A8" />
      <ellipse cx="48" cy="78" rx="28" ry="22" fill="#A8A8A8" />
    </svg>
  );
}

function MeAvatarBubble({ avatarUrl, onPickClick }: { avatarUrl: string; onPickClick?: () => void }) {
  const inner =
    avatarUrl ? (
      <img src={avatarUrl} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-md bg-gray-200 object-cover" />
    ) : (
      <MeWeChatDefaultAvatar className="mt-0.5 h-9 w-9" />
    );
  if (!onPickClick) {
    return inner;
  }
  return (
    <button
      type="button"
      title="点击上传「我」的头像"
      onClick={onPickClick}
      className="shrink-0 rounded-md p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07C160]/60"
    >
      {inner}
    </button>
  );
}

function MeAvatarLarge({ avatarUrl, onPickClick }: { avatarUrl: string; onPickClick?: () => void }) {
  const inner =
    avatarUrl ? (
      <img
        src={avatarUrl}
        alt=""
        className="h-24 w-24 rounded-2xl bg-gray-200 object-cover"
      />
    ) : (
      <MeWeChatDefaultAvatar className="h-24 w-24 rounded-2xl" />
    );
  if (!onPickClick) {
    return inner;
  }
  return (
    <button
      type="button"
      title="点击上传「我」的头像"
      onClick={onPickClick}
      className="rounded-2xl p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07C160]/60"
    >
      {inner}
    </button>
  );
}

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
  avatarSrc,
  className = '',
  size,
  onPickClick,
}: {
  contact: TavernPhoneWeChatContact;
  /** 已合并「浏览器统一头像缓存」后的展示用 URL */
  avatarSrc: string;
  className?: string;
  /** 列表大头像 / 气泡小头像 / 添加弹层 */
  size: 'list' | 'bubble' | 'picker';
  /** 点击上传角色头像（与角色档案一致，本机缓存） */
  onPickClick?: () => void;
}) {
  let inner: React.ReactNode;
  const url = avatarSrc.trim();
  /** 与占位块同尺寸，避免竖图撑破布局（微信会话列表约 48px，气泡约 36px） */
  const imgBoxCls =
    size === 'bubble'
      ? 'h-9 w-9 rounded-md'
      : size === 'picker'
        ? 'h-11 w-11 rounded-lg'
        : 'h-12 w-12 rounded-lg';
  if (url) {
    inner = (
      <img
        src={url}
        alt=""
        className={`${imgBoxCls} shrink-0 object-cover bg-[#E5E5EA] ${className}`.trim()}
      />
    );
  } else {
    const initial = contactInitial(contact.displayName);
    const sizeCls =
      size === 'bubble'
        ? 'h-9 w-9 text-[13px] rounded-md'
        : size === 'picker'
          ? 'h-11 w-11 text-[15px] rounded-lg'
          : 'h-12 w-12 text-[17px] rounded-lg';
    inner = (
      <div
        className={`flex shrink-0 items-center justify-center bg-[#E5E5EA] font-semibold text-[#1c1c1e] ${sizeCls} ${className}`}
        aria-hidden
      >
        {initial}
      </div>
    );
  }
  if (!onPickClick) {
    return inner;
  }
  const rounded =
    size === 'bubble' ? 'rounded-md' : size === 'picker' ? 'rounded-lg' : 'rounded-lg';
  return (
    <button
      type="button"
      title="点击上传角色头像（与档案一致）"
      onClick={e => {
        e.stopPropagation();
        onPickClick();
      }}
      className={`relative shrink-0 p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07C160]/60 ${rounded}`}
    >
      {inner}
      <span
        className={`pointer-events-none absolute flex items-center justify-center rounded-full bg-black/50 text-white ${
          size === 'bubble' ? 'bottom-0 right-0 h-3.5 w-3.5' : 'bottom-0.5 right-0.5 h-4 w-4'
        }`}
        aria-hidden
      >
        <Pencil size={size === 'bubble' ? 7 : 9} strokeWidth={2.5} />
      </span>
    </button>
  );
}

function mergeContactContext(
  base: TavernPhoneContextPayload,
  contact: TavernPhoneWeChatContact,
): TavernPhoneContextPayload {
  const roleStorySummary = base.roleStorySummaries?.[contact.id]?.trim() ?? '';
  return {
    ...base,
    displayName: contact.displayName,
    personality: contact.personality ?? base.personality,
    thought: contact.thought ?? base.thought,
    roleStorySummary,
  };
}

function formatMsgTime(t: number): string {
  const d = new Date(t);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

/** 优先取最后一条对方回复，否则取最后一条用户消息（用于填入主界面输入框） */
function lastAssistantOrUserText(msgs: WeChatStoredMessage[]): string {
  const fromEnd = [...msgs].reverse();
  const lastA = fromEnd.find(m => m.role === 'assistant');
  if (lastA) {
    return lastA.content;
  }
  const lastU = fromEnd.find(m => m.role === 'user');
  return lastU?.content ?? '';
}

/**
 * 按句子分割消息，用于分段发送（模拟真实微信聊天）
 * 简化版分割规则：
 * 1. 优先按强标点（。！？…~）分割，每个带标点的句子独立成段
 * 2. 逗号、分号作为次要分割点
 * 3. 空格、换行作为第三级分割点（用于处理多段话有空格的情况）
 * 4. 无标点的长文本按 100 字强制分割
 * 5. 每个句子最多 150 字，超长则继续分割
 */
function splitMessageIntoSegments(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  // 非常短的消息（<=30字）直接返回
  if (trimmed.length <= 30) {
    return [trimmed];
  }

  const MAX_SEGMENT_LENGTH = 150;
  const TARGET_SEGMENT_LENGTH = 100; // 目标段落长度，让气泡更紧凑

  // 第一步：按强标点分割句子（。！？…~）
  const rawSentences: string[] = [];
  // 使用 match + split 的组合，保留标点
  const strongPunctuation = /[。！？…~]+/;
  let remaining = trimmed;

  while (remaining.length > 0) {
    const match = remaining.match(strongPunctuation);
    if (!match) {
      // 没有更多标点了，处理剩余文本
      if (remaining.trim()) {
        rawSentences.push(remaining.trim());
      }
      break;
    }

    const idx = match.index!;
    const sentence = remaining.slice(0, idx + match[0].length).trim();
    if (sentence) {
      rawSentences.push(sentence);
    }
    remaining = remaining.slice(idx + match[0].length);
  }

  // 第二步：对每个句子按空格/换行进行二次分割
  // 这样 "你是说我这瓶草莓牛奶吗？ 好啦好啦..." 会变成两段
  const sentences: string[] = [];
  for (const raw of rawSentences) {
    // 按换行或2个以上空格分割
    const parts = raw.split(/\n+|\s{2,}/).filter(s => s.trim().length > 0);
    if (parts.length > 1) {
      // 有空格/换行分隔，分割成多个句子
      sentences.push(...parts.map(s => s.trim()));
    } else {
      sentences.push(raw);
    }
  }

  // 第三步：处理每个句子，如果过长则用逗号/分号分割
  const segments: string[] = [];

  for (const sentence of sentences) {
    // 如果句子在目标长度内，直接添加
    if (sentence.length <= TARGET_SEGMENT_LENGTH) {
      segments.push(sentence);
      continue;
    }

    // 如果句子较长（>100字），尝试用逗号、分号分割
    if (sentence.length > TARGET_SEGMENT_LENGTH) {
      const weakPunctuation = /[，,；;]/;
      let temp = '';
      let remainingSentence = sentence;

      while (remainingSentence.length > 0) {
        const match = remainingSentence.match(weakPunctuation);

        if (!match) {
          // 没有更多弱标点了
          temp += remainingSentence;
          break;
        }

        const idx = match.index!;
        const part = remainingSentence.slice(0, idx + 1); // 包含标点

        if ((temp + part).length <= TARGET_SEGMENT_LENGTH) {
          temp += part;
        } else {
          if (temp.trim()) {
            segments.push(temp.trim());
          }
          temp = part;
        }

        remainingSentence = remainingSentence.slice(idx + 1);
      }

      if (temp.trim()) {
        // 检查最后一段是否过长
        if (temp.length > MAX_SEGMENT_LENGTH) {
          // 按长度强制分割
          for (let i = 0; i < temp.length; i += MAX_SEGMENT_LENGTH) {
            segments.push(temp.slice(i, i + MAX_SEGMENT_LENGTH));
          }
        } else {
          segments.push(temp.trim());
        }
      }
    }
  }

  // 最后检查：如果只有一个段落且长度适中，尝试再细分
  if (segments.length === 1 && segments[0].length > 60) {
    const single = segments[0];
    const mid = Math.floor(single.length / 2);
    // 在中点附近找最近的标点
    let splitIdx = mid;
    for (let i = 0; i < 20 && mid + i < single.length; i++) {
      if (/[，,；;]/.test(single[mid + i])) {
        splitIdx = mid + i + 1;
        break;
      }
      if (mid - i > 0 && /[，,；;]/.test(single[mid - i])) {
        splitIdx = mid - i + 1;
        break;
      }
    }
    if (splitIdx !== mid || single.length > 100) {
      return [single.slice(0, splitIdx).trim(), single.slice(splitIdx).trim()];
    }
  }

  // 最多返回12段
  return segments.slice(0, 12);
}

/**
 * 按字符长度分割文本，优先在句末标点处分割
 */
function splitByLength(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    // 向前寻找最近的句末标点
    let cutIndex = maxLength;
    const searchRange = remaining.slice(0, maxLength + 50);
    const lastPunctuation = Math.max(
      searchRange.lastIndexOf('。'),
      searchRange.lastIndexOf('！'),
      searchRange.lastIndexOf('？'),
      searchRange.lastIndexOf('…'),
    );

    if (lastPunctuation > maxLength * 0.6) {
      cutIndex = lastPunctuation + 1;
    }

    segments.push(remaining.slice(0, cutIndex).trim());
    remaining = remaining.slice(cutIndex).trim();
  }

  if (remaining) {
    segments.push(remaining);
  }

  return segments.slice(0, 3);
}

export default function WeChatApp({ onClose }: { onClose: () => void }) {
  const avatarOverrides = usePhoneCharacterAvatarOverrides();
  const [ctx, setCtx] = useState<TavernPhoneContextPayload | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  /** 与酒馆当前聊天文件对齐；切换聊天由父窗口推送或首次 CONTEXT 写入 */
  const [chatScopeId, setChatScopeId] = useState<string>(LOCAL_OFFLINE_SCOPE);
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
  const [previewById, setPreviewById] = useState<Record<string, { text: string; time: string }>>({});
  const [threadReady, setThreadReady] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveCandidates, setArchiveCandidates] = useState<TavernPhoneWeChatContact[]>([]);
  const [regeneratingAssistantId, setRegeneratingAssistantId] = useState<string | null>(null);
  const [debugCtxBusy, setDebugCtxBusy] = useState(false);
  /** 仅最后一次 context 请求生效，避免与初次加载 / chat_scope 推送竞态导致看起来「刷新无效」 */
  const contextFetchGenRef = useRef(0);
  /** 长按菜单状态 */
  const [longPressMenu, setLongPressMenu] = useState<{
    visible: boolean;
    messageId: string | null;
    messageContent: string;
    messageRole: 'user' | 'assistant' | null;
    position: { x: number; y: number };
  }>({ visible: false, messageId: null, messageContent: '', messageRole: null, position: { x: 0, y: 0 } });
  const longPressTimerRef = useRef<number | null>(null);
  const [retractingIds, setRetractingIds] = useState<Set<string>>(new Set());
  const [contextPulledAt, setContextPulledAt] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const phoneMemoryTimerRef = useRef<number | null>(null);
  const avatarPickTargetRef = useRef<AvatarPickTarget | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  /** 记录上一次的 chatScopeId，避免重复重置视图 */
  const lastChatScopeIdRef = useRef<string>(LOCAL_OFFLINE_SCOPE);

  useEffect(() => {
    return () => {
      if (phoneMemoryTimerRef.current != null) {
        window.clearTimeout(phoneMemoryTimerRef.current);
      }
    };
  }, []);

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
    void initWeChatStorage();
  }, []);

  // 初始化微信线程导出监听（供壳脚本世界书同步使用）
  useEffect(() => {
    const unsubscribe = initExportThreadsListener();
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCtxLoading(true);
      const gen = ++contextFetchGenRef.current;
      try {
        const c = await requestTavernPhoneContext();
        if (cancelled) {
          return;
        }
        if (gen !== contextFetchGenRef.current) {
          return;
        }
        setCtx({
          ...c,
          recentStorySnippet: c.recentStorySnippet ?? '',
          roleStorySummaries: c.roleStorySummaries ?? {},
          openAiDefaults: c.openAiDefaults ?? { apiBaseUrl: null, model: null },
        });
        setContextPulledAt(Date.now());
        setChatScopeId(resolveChatScopeId(c.chatScopeId));
      } finally {
        if (!cancelled) {
          setCtxLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeChatScopeChange(scope => {
      const newScopeId = resolveChatScopeId(scope);
      // 只有当 chatScopeId 真正改变时才重置视图
      // 避免 iframe 重新加载或世界书同步时重复发送 CHAT_SCOPE 导致界面重置
      if (newScopeId !== lastChatScopeIdRef.current) {
        lastChatScopeIdRef.current = newScopeId;
        setChatScopeId(newScopeId);
        setView('list');
        setSelectedContact(null);
        setSendError('');
        setListTick(t => t + 1);
      }
      // 无论是否改变视图，都刷新上下文
      void (async () => {
        const gen = ++contextFetchGenRef.current;
        try {
          const c = await requestTavernPhoneContext();
          if (gen !== contextFetchGenRef.current) {
            return;
          }
          setCtx({
            ...c,
            recentStorySnippet: c.recentStorySnippet ?? '',
            roleStorySummaries: c.roleStorySummaries ?? {},
            openAiDefaults: c.openAiDefaults ?? { apiBaseUrl: null, model: null },
          });
          setContextPulledAt(Date.now());
        } catch {
          /* 忽略：仍保留上一帧 ctx */
        }
      })();
    });
  }, []);

  useEffect(() => {
    if (!selectedContact) {
      setMessages([]);
      setThreadReady(false);
      return;
    }
    let cancelled = false;
    setThreadReady(false);
    (async () => {
      await initWeChatStorage();
      const msgs = await loadWeChatThreadForScope(chatScopeId, selectedContact.id);
      if (!cancelled) {
        setMessages(msgs);
        setThreadReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedContact, chatScopeId]);

  useEffect(() => {
    if (!selectedContact || !threadReady) {
      return;
    }
    void saveWeChatThreadForScope(chatScopeId, selectedContact.id, messages);
  }, [selectedContact, chatScopeId, messages, threadReady]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, view]);

  const chatCtx = useMemo(() => {
    if (!ctx || !selectedContact) {
      return null;
    }
    return mergeContactContext(ctx, selectedContact);
  }, [ctx, selectedContact]);

  const schedulePhoneMemoryPersist = useCallback(
    (thread: WeChatStoredMessage[], contactId: string, scope: string) => {
      const cfg = getTavernPhoneApiConfig();
      if (!cfg.phoneMemoryWrite || ctx?.offline) {
        return;
      }
      if (phoneMemoryTimerRef.current != null) {
        window.clearTimeout(phoneMemoryTimerRef.current);
      }
      phoneMemoryTimerRef.current = window.setTimeout(() => {
        phoneMemoryTimerRef.current = null;
        void (async () => {
          try {
            const summary = await summarizePhoneExchangeForMemory(
              thread.map(m => ({ role: m.role, content: m.content })),
            );
            const r = await requestWritePhoneMemory({ contactId, chatScopeId: scope, summary });
            if (!r.ok && r.error) {
              console.warn('[phone memory]', r.error);
            }
          } catch (e) {
            console.warn('[phone memory]', e);
          }
        })();
      }, 2000);
    },
    [ctx?.offline],
  );

  const regenerateAssistantMessage = useCallback(
    async (assistantMsgId: string) => {
      if (!ctx || !selectedContact || !chatCtx || sending) {
        return;
      }
      const idx = messages.findIndex(m => m.id === assistantMsgId);
      if (idx < 0 || messages[idx].role !== 'assistant') {
        return;
      }
      // 只保留被重新生成消息之前的上下文，重新生成后不留旧回复
      const historyForApi = messages.slice(0, idx).map(m => ({ role: m.role, content: m.content }));
      if (historyForApi.length === 0) {
        return;
      }
      setRegeneratingAssistantId(assistantMsgId);
      setSendError('');
      const originalLastId = messages[idx].lastId;
      try {
        const reply = await completeWeChatReply(chatCtx, historyForApi, { regenerate: true });

        // 将回复分割成多个气泡
        const segments = splitMessageIntoSegments(reply);
        const baseTime = Date.now();

        setMessages(prev => {
          const next = prev.slice(0, idx);
          const newMessages: WeChatStoredMessage[] = segments.map((segment, index) => ({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: segment,
            time: baseTime + index * 500,
            lastId: index === 0 ? originalLastId : undefined,
          }));
          const final = [...next, ...newMessages];
          schedulePhoneMemoryPersist(final, selectedContact.id, chatScopeId);
          return final;
        });
      } catch (e) {
        setSendError(e instanceof Error ? e.message : String(e));
      } finally {
        setRegeneratingAssistantId(null);
      }
    },
    [ctx, selectedContact, chatCtx, messages, sending, chatScopeId, schedulePhoneMemoryPersist],
  );

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

      // 将回复分割成多个气泡
      const segments = splitMessageIntoSegments(reply);
      const baseTime = Date.now();

      const assistantMessages: WeChatStoredMessage[] = segments.map((segment, index) => ({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: segment,
        time: baseTime + index * 500, // 每个气泡间隔500ms
        lastId: index === 0
          ? (ctx?.lastChatMessageId != null ? ctx.lastChatMessageId + 1 : undefined)
          : undefined,
      }));

      const fullThread = [...messages, userMsg, ...assistantMessages];
      setMessages(prev => [...prev, ...assistantMessages]);

      // 显式保存到 IndexedDB 并等待完成，确保世界书同步时能读取到数据
      await saveWeChatThreadForScope(chatScopeId, selectedContact.id, fullThread);
      schedulePhoneMemoryPersist(fullThread, selectedContact.id, chatScopeId);

      // 发微信时主动触发世界书同步（在 IndexedDB 保存完成后通知壳脚本）
      window.parent.postMessage({ type: TAVERN_PHONE_MSG.REQUEST_TRIGGER_WB_SYNC }, '*');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }, [ctx, selectedContact, chatCtx, input, messages, sending, chatScopeId, schedulePhoneMemoryPersist]);

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

  /** 长按检测处理 */
  const handleMessageTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent, message: WeChatStoredMessage) => {
    // 清除之前的定时器
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }

    // 获取点击位置
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

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

  const closeLongPressMenu = useCallback(() => {
    setLongPressMenu(prev => ({ ...prev, visible: false }));
    // 延迟清除 messageId，避免菜单消失动画突兀
    window.setTimeout(() => {
      setLongPressMenu({ visible: false, messageId: null, messageContent: '', messageRole: null, position: { x: 0, y: 0 } });
    }, 200);
  }, []);

  /** 撤回消息 */
  const handleRetractMessage = useCallback(async () => {
    const messageId = longPressMenu.messageId;
    const messageRole = longPressMenu.messageRole;
    if (!messageId || !selectedContact) return;

    closeLongPressMenu();
    setRetractingIds(prev => new Set(prev).add(messageId));

    try {
      setMessages(prev => {
        // 找到被撤回消息的索引
        const idx = prev.findIndex(m => m.id === messageId);
        if (idx < 0) return prev;

        // 移除被撤回的消息
        const next = prev.filter(m => m.id !== messageId);

        // 添加系统提示消息（像微信那样显示"你撤回了一条消息"或"对方撤回了一条消息"）
        const systemMsg: WeChatStoredMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: messageRole === 'user' ? '你撤回了一条消息' : `${selectedContact.displayName}撤回了一条消息`,
          time: Date.now(),
          systemType: 'retract',
        };

        // 在原消息位置插入系统提示
        next.splice(idx, 0, systemMsg);

        // 保存到 IndexedDB
        void saveWeChatThreadForScope(chatScopeId, selectedContact.id, next);
        // 触发世界书同步
        window.parent.postMessage({ type: TAVERN_PHONE_MSG.REQUEST_TRIGGER_WB_SYNC }, '*');
        return next;
      });

      console.info('[WeChatApp] 消息已撤回:', messageId);
    } finally {
      setRetractingIds(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, [longPressMenu.messageId, longPressMenu.messageRole, selectedContact, chatScopeId, closeLongPressMenu]);

  /** 重发消息 */
  const handleResendMessage = useCallback(async () => {
    const messageId = longPressMenu.messageId;
    const messageContent = longPressMenu.messageContent;
    if (!messageId || !selectedContact || !chatCtx) return;

    closeLongPressMenu();

    // 找到消息索引
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx < 0 || messages[idx].role !== 'assistant') return;

    setRegeneratingAssistantId(messageId);
    setSendError('');

    try {
      // 只保留被重新生成消息之前的上下文
      const historyForApi = messages.slice(0, idx).map(m => ({ role: m.role, content: m.content }));
      if (historyForApi.length === 0) return;

      // 调用 API 重新生成
      const reply = await completeWeChatReply(chatCtx, historyForApi, { regenerate: true });

      // 将回复分割成多个气泡
      const segments = splitMessageIntoSegments(reply);
      const baseTime = Date.now();
      const originalLastId = messages[idx].lastId;

      setMessages(prev => {
        // 移除原消息，插入新消息
        const next = prev.slice(0, idx);
        const newMessages: WeChatStoredMessage[] = segments.map((segment, index) => ({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: segment,
          time: baseTime + index * 500,
          lastId: index === 0 ? originalLastId : undefined,
        }));
        const final = [...next, ...newMessages];

        // 保存到 IndexedDB 并触发世界书同步
        void saveWeChatThreadForScope(chatScopeId, selectedContact.id, final);
        schedulePhoneMemoryPersist(final, selectedContact.id, chatScopeId);
        window.parent.postMessage({ type: TAVERN_PHONE_MSG.REQUEST_TRIGGER_WB_SYNC }, '*');

        return final;
      });

      console.info('[WeChatApp] 消息已重发:', messageId);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegeneratingAssistantId(null);
    }
  }, [longPressMenu.messageId, longPressMenu.messageContent, selectedContact, chatCtx, messages, chatScopeId, schedulePhoneMemoryPersist, closeLongPressMenu]);

  const saveMe = () => {
    saveWeChatMe(meDraft);
    const a = typeof meDraft.avatarUrl === 'string' ? meDraft.avatarUrl.trim() : '';
    setCharacterAvatarOverride(PHONE_WECHAT_ME_AVATAR_ID, a);
    setMeProfile(loadWeChatMe());
    setMeSavedHint(true);
    window.setTimeout(() => setMeSavedHint(false), 2000);
  };

  const refreshPhoneContext = useCallback(async () => {
    const gen = ++contextFetchGenRef.current;
    setDebugCtxBusy(true);
    try {
      const c = await requestTavernPhoneContext();
      if (gen !== contextFetchGenRef.current) {
        return;
      }
      setCtx({
        ...c,
        recentStorySnippet: c.recentStorySnippet ?? '',
        roleStorySummaries: c.roleStorySummaries ?? {},
        openAiDefaults: c.openAiDefaults ?? { apiBaseUrl: null, model: null },
      });
      setContextPulledAt(Date.now());
      setChatScopeId(resolveChatScopeId(c.chatScopeId));
    } catch {
      /* 保留上一帧 */
    } finally {
      if (gen === contextFetchGenRef.current) {
        setDebugCtxBusy(false);
      }
    }
  }, []);

  /** 会话列表仅显示用户通过「+」手动添加的联系人，变量中的角色只在加号面板里可选 */
  const pinnedContacts = useMemo(() => loadPinnedContacts(chatScopeId), [chatScopeId, pinnedRev]);

  const contacts = useMemo(
    () => mergePinnedWithContextAvatars(pinnedContacts, ctx?.contacts ?? []),
    [pinnedContacts, ctx?.contacts],
  );

  /** 「我」：优先统一本机缓存键，否则用微信「我」页本地存的链接（仍属浏览器，非酒馆变量） */
  const meAvatarUrl = useMemo(() => {
    const fromUnified = resolveCharacterAvatarFromBrowserOnly(PHONE_WECHAT_ME_AVATAR_ID, avatarOverrides);
    if (fromUnified) {
      return fromUnified;
    }
    return resolveMeAvatarDisplay(meProfile).trim();
  }, [avatarOverrides, meProfile]);

  const meAvatarLargeDisplay = useMemo(() => {
    const fromUnified = resolveCharacterAvatarFromBrowserOnly(PHONE_WECHAT_ME_AVATAR_ID, avatarOverrides);
    if (fromUnified) {
      return fromUnified;
    }
    return resolveMeAvatarDisplay(meDraft).trim();
  }, [avatarOverrides, meDraft]);

  const debugSystemPromptPreview = useMemo(() => {
    if (!ctx || !meDraft.showInjectDebug) {
      return '';
    }
    const c = selectedContact ?? contacts[0];
    if (!c) {
      return '';
    }
    const merged = mergeContactContext(ctx, c);
    const msgs = buildWeChatMessages(merged, []);
    const sys = msgs.find(m => m.role === 'system');
    return sys?.content ?? '';
  }, [ctx, meDraft.showInjectDebug, selectedContact, contacts]);

  useEffect(() => {
    if (ctxLoading || !ctx) {
      return;
    }
    let cancelled = false;
    (async () => {
      await initWeChatStorage();
      const next: Record<string, { text: string; time: string }> = {};
      for (const c of contacts) {
        const thread = await loadWeChatThreadForScope(chatScopeId, c.id);
        const last = thread[thread.length - 1];
        if (last) {
          next[c.id] = { text: last.content, time: formatMsgTime(last.time) };
        } else {
          next[c.id] = { text: '开始聊天…', time: '' };
        }
      }
      if (!cancelled) {
        setPreviewById(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contacts, chatScopeId, listTick, ctx, ctxLoading]);

  const addedIds = useMemo(() => new Set(contacts.map(c => c.id)), [contacts]);

  // 只有在用户手动添加新联系人时才触发分析（不在组件加载或弹窗打开时触发）
  const handleAddContact = (c: TavernPhoneWeChatContact) => {
    addPinnedContact(chatScopeId, c);
    setPinnedRev(r => r + 1);
    setListTick(t => t + 1);
    setAddModalOpen(false);

    // 为用户新添加的联系人触发分析
    void (async () => {
      try {
        const archive = await loadCharacterArchiveById(c.id);
        if (archive) {
          const scheduler = getAnalysisScheduler();
          scheduler.addTask({
            type: 'ANALYZE_CHARACTER',
            priority: 'NORMAL',
            characterId: c.id,
            characterName: c.displayName,
          });
          console.log('[WeChatApp] 为新添加的联系人触发分析:', c.displayName);
        }
      } catch (e) {
        console.warn('[WeChatApp] 新联系人分析失败:', e);
      }
    })();
  };
  const showOffline = ctx?.offline;

  const headerTitle = mainTab === 'me' ? '我' : '微信';

  const startAvatarPick = useCallback((target: AvatarPickTarget) => {
    avatarPickTargetRef.current = target;
    avatarFileInputRef.current?.click();
  }, []);

  const onAvatarFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) {
      return;
    }
    const target = avatarPickTargetRef.current;
    avatarPickTargetRef.current = null;
    if (!target) {
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      if (target.kind === 'me') {
        setCharacterAvatarOverride(PHONE_WECHAT_ME_AVATAR_ID, dataUrl);
        setMeDraft(prev => {
          const next = { ...prev, avatarUrl: dataUrl };
          saveWeChatMe(next);
          setMeProfile(next);
          return next;
        });
        return;
      }
      setCharacterAvatarOverride(target.contact.id, dataUrl, {
        displayName: target.contact.displayName,
      });
      addPinnedContact(chatScopeId, { ...target.contact, avatarUrl: dataUrl });
      setPinnedRev(r => r + 1);
      setSelectedContact(prev =>
        prev?.id === target.contact.id ? { ...prev, avatarUrl: dataUrl } : prev,
      );
    } catch (err) {
      console.warn('[wechat avatar]', err);
    }
  }, [chatScopeId]);

  return (
    <div className="relative flex flex-col h-full bg-[#EDEDED]">
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={onAvatarFileInputChange}
      />
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
              {messages.map(m => {
                const isAssistant = m.role === 'assistant';
                const isSystem = m.role === 'system';

                // 系统消息（如撤回提示）居中显示，无头像
                if (isSystem) {
                  return (
                    <div key={m.id} className="flex justify-center py-1">
                      <span className="text-[12px] text-gray-400 bg-gray-100/80 px-3 py-1 rounded-full">
                        {m.content}
                      </span>
                    </div>
                  );
                }

                return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' ? (
                    <ContactAvatar
                      contact={selectedContact}
                      avatarSrc={resolveCharacterAvatarFromBrowserOnly(
                        selectedContact.id,
                        avatarOverrides,
                        selectedContact.displayName,
                      )}
                      size="bubble"
                      className="mt-0.5"
                      onPickClick={() => startAvatarPick({ kind: 'contact', contact: selectedContact })}
                    />
                  ) : null}
                  {m.role === 'assistant' ? (
                    <div className="flex items-start gap-1 max-w-[78%] min-w-0">
                      <div
                        className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-[15px] leading-relaxed bg-white text-gray-900 shadow-sm select-none ${regeneratingAssistantId === m.id ? 'opacity-60' : ''} ${retractingIds.has(m.id) ? 'opacity-40' : ''}`}
                        onTouchStart={(e) => handleMessageTouchStart(e, m)}
                        onTouchEnd={handleMessageTouchEnd}
                        onMouseDown={(e) => handleMessageTouchStart(e, m)}
                        onMouseUp={handleMessageTouchEnd}
                        onMouseLeave={handleMessageTouchEnd}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleMessageTouchStart(e, m);
                          window.setTimeout(() => handleMessageTouchEnd(), 100);
                        }}
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                      >
                        <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                        <p className="text-[10px] mt-1 text-gray-400">{formatMsgTime(m.time)}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`max-w-[72%] rounded-lg px-3 py-2 text-[15px] leading-relaxed bg-[#95EC69] text-black select-none ${retractingIds.has(m.id) ? 'opacity-40' : ''}`}
                        onTouchStart={(e) => handleMessageTouchStart(e, m)}
                        onTouchEnd={handleMessageTouchEnd}
                        onMouseDown={(e) => handleMessageTouchStart(e, m)}
                        onMouseUp={handleMessageTouchEnd}
                        onMouseLeave={handleMessageTouchEnd}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleMessageTouchStart(e, m);
                          window.setTimeout(() => handleMessageTouchEnd(), 100);
                        }}
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                      >
                        <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                        <p className="text-[10px] mt-1 text-gray-600">{formatMsgTime(m.time)}</p>
                      </div>
                      <MeAvatarBubble
                        avatarUrl={meAvatarUrl}
                        onPickClick={() => startAvatarPick({ kind: 'me' })}
                      />
                    </>
                  )}
                </div>
                );
              })}
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
                  aria-label="从变量中添加"
                  title="从变量中添加"
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
                ) : contacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-gray-400 text-[14px]">
                    <p>暂无会话</p>
                    <p className="mt-2 text-[13px] leading-relaxed">
                      点击右上角「+」从变量中选择并添加到微信
                    </p>
                  </div>
                ) : (
                  contacts.map(c => {
                    void listTick;
                    const { text, time } = previewById[c.id] ?? { text: '开始聊天…', time: '' };
                    return (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openChat(c)}
                        onKeyDown={ev => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            openChat(c);
                          }
                        }}
                        className="w-full flex items-center px-4 py-3 active:bg-gray-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="relative shrink-0">
                          <ContactAvatar
                            contact={c}
                            avatarSrc={resolveCharacterAvatarFromBrowserOnly(c.id, avatarOverrides, c.displayName)}
                            size="list"
                            onPickClick={() => startAvatarPick({ kind: 'contact', contact: c })}
                          />
                        </div>
                        <div className="ml-3 flex-1 border-b border-gray-100 pb-3 pt-1">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="text-[16px] font-medium text-gray-900">{c.displayName}</h3>
                            <span className="text-xs text-gray-400">{time}</span>
                          </div>
                          <p className="text-[14px] text-gray-500 truncate pr-4">{text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto bg-[#EDEDED] px-4 py-4 min-h-0">
              <div className="rounded-[12px] bg-white p-4 shadow-sm">
                <div className="flex flex-col items-center gap-3 border-b border-gray-100 pb-4">
                  <MeAvatarLarge
                    avatarUrl={meAvatarLargeDisplay}
                    onPickClick={() => startAvatarPick({ kind: 'me' })}
                  />
                  <p className="text-[13px] text-gray-400 text-center">
                    头像只认本机：统一缓存（与各角色 id / 同名键）或本页填写的链接；不使用酒馆变量、书卡或壳下发的头像 URL。未设置时显示默认剪影。
                  </p>
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

              <div className="mt-4 rounded-[12px] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-gray-900">
                  <Bug size={18} className="text-amber-700 shrink-0" aria-hidden />
                  注入上下文调试
                </div>
                <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">
                  查看壳脚本下发的「主剧情节选」「档案剧情摘要」及实际拼进 API 的 system 全文（与设置里是否注入一致）。
                </p>
                <label className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[15px] text-gray-900">显示调试内容</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#07C160]"
                    checked={meDraft.showInjectDebug ?? false}
                    onChange={e => {
                      const next = { ...meDraft, showInjectDebug: e.target.checked };
                      setMeDraft(next);
                      saveWeChatMe(next);
                    }}
                  />
                </label>
                {meDraft.showInjectDebug ? (
                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void refreshPhoneContext()}
                        disabled={debugCtxBusy || ctxLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#576b95] px-3 py-1.5 text-[13px] font-medium text-white active:opacity-90 disabled:opacity-50"
                      >
                        {debugCtxBusy || ctxLoading ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        刷新上下文
                      </button>
                      <span className="text-[11px] text-gray-400">从酒馆壳脚本重新拉取</span>
                    </div>
                    {contextPulledAt != null ? (
                      <p className="text-[11px] text-gray-500">
                        上次拉取：{new Date(contextPulledAt).toLocaleString('zh-CN')}
                      </p>
                    ) : null}
                    {(() => {
                      const api = getTavernPhoneApiConfig();
                      return (
                        <ul className="text-[12px] text-gray-700 space-y-1">
                          <li>
                            <span className="text-gray-500">设置 · 注入主剧情与档案摘要：</span>
                            {api.injectMainStory !== false ? '开' : '关'}
                          </li>
                          <li>
                            <span className="text-gray-500">设置 · 回合摘要写入聊天变量：</span>
                            {api.phoneMemoryWrite ? '开' : '关'}
                          </li>
                        </ul>
                      );
                    })()}
                    {!ctx && !ctxLoading ? (
                      <p className="text-[12px] text-amber-800">暂无上下文（请确认小手机壳已加载）。</p>
                    ) : null}
                    {ctx ? (
                      <>
                        <div className="text-[12px] text-gray-700 space-y-1">
                          <p>
                            <span className="text-gray-500">chatScopeId：</span>
                            {ctx.chatScopeId ?? '（无）'}
                          </p>
                          <p>
                            <span className="text-gray-500">连接：</span>
                            {ctx.offline ? '离线 / 未连上壳' : '已连接'}
                          </p>
                          <p>
                            <span className="text-gray-500">展示名 / 人设节选：</span>
                            {ctx.displayName || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-gray-600 mb-1">主剧情节选（recentStorySnippet）</p>
                          <pre
                            key={`snippet-${contextPulledAt ?? 0}`}
                            className="max-h-40 overflow-auto rounded-lg bg-[#F7F7F7] p-2 text-[11px] text-gray-800 whitespace-pre-wrap wrap-break-word"
                          >
                            {ctx.recentStorySnippet?.trim() ? ctx.recentStorySnippet : '（空）'}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-gray-600 mb-1">
                            档案剧情摘要（roleStorySummaries，按联系人 id）
                          </p>
                          <pre
                            key={`rolesum-${contextPulledAt ?? 0}`}
                            className="max-h-36 overflow-auto rounded-lg bg-[#F7F7F7] p-2 text-[11px] text-gray-800 whitespace-pre-wrap wrap-break-word"
                          >
                            {Object.keys(ctx.roleStorySummaries ?? {}).length > 0
                              ? JSON.stringify(ctx.roleStorySummaries, null, 2)
                              : '（空对象）'}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-gray-600 mb-1">
                            实际发往 API 的 system（当前会话联系人优先，否则列表第一项）
                          </p>
                          <pre
                            key={`sys-${contextPulledAt ?? 0}`}
                            className="max-h-48 overflow-auto rounded-lg bg-[#f0f7ff] p-2 text-[11px] text-gray-800 whitespace-pre-wrap wrap-break-word border border-[#d0e3ff]"
                          >
                            {debugSystemPromptPreview || '（无联系人，无法预览）'}
                          </pre>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          「回合摘要」是聊完后另一次模型调用生成并写入聊天变量的，成功写入后请在酒馆{' '}
                          <code className="rounded bg-gray-100 px-0.5">phone_wechat_memory_path</code>（默认{' '}
                          <code className="rounded bg-gray-100 px-0.5">stat_data.手机微信记忆</code>
                          ）下查看；此处不展示历史摘要文本。
                        </p>
                      </>
                    ) : null}
                  </div>
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
                  <span className="text-[16px] font-semibold text-gray-900">从变量中添加</span>
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
                    <p className="px-3 py-6 text-[13px] text-gray-500 leading-relaxed text-center">
                      暂无联系人，请从变量中添加。
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {archiveCandidates.map(c => {
                        const already = addedIds.has(c.id);
                        return (
                          <li key={c.id} className="flex items-center gap-3 px-2 py-3">
                            <ContactAvatar
                              contact={c}
                              avatarSrc={resolveCharacterAvatarFromBrowserOnly(c.id, avatarOverrides, c.displayName)}
                              size="picker"
                              onPickClick={() => startAvatarPick({ kind: 'contact', contact: c })}
                            />
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

      {/* 长按菜单 - 微信风格 Action Sheet */}
      {longPressMenu.visible && (
        <div
          className="fixed inset-0 z-100 bg-black/30"
          onClick={closeLongPressMenu}
          onTouchStart={closeLongPressMenu}
        >
          <div
            className="absolute bg-white rounded-2xl shadow-xl overflow-hidden min-w-[180px] max-w-[240px]"
            style={{
              left: Math.min(Math.max(longPressMenu.position.x - 90, 16), window.innerWidth - 200),
              top: longPressMenu.position.y > window.innerHeight / 2
                ? Math.max(longPressMenu.position.y - 120, 100)
                : Math.min(longPressMenu.position.y + 20, window.innerHeight - 150),
            }}
            onClick={(e) => e.stopPropagation()}
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
                  disabled={regeneratingAssistantId === longPressMenu.messageId}
                  className="px-5 py-4 text-[17px] text-center text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {regeneratingAssistantId === longPressMenu.messageId ? '重发中…' : '重发'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}