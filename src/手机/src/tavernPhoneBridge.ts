/**
 * 与酒馆脚本「小手机壳」约定的 postMessage 协议（与 src/小手机壳/index.ts 中 MSG 一致）
 */
export const TAVERN_PHONE_MSG = {
  REQUEST_CLOSE: 'tavern-phone:request-close',
  /** iframe → 父窗口：请求当前角色/变量上下文（供微信等联动） */
  REQUEST_CONTEXT: 'tavern-phone:request-context',
  /** 父窗口 → iframe：返回上下文 */
  CONTEXT: 'tavern-phone:context',
  /** 父窗口 → iframe：当前酒馆聊天文件变更时推送 chatScopeId（与 getCurrentChatId 对齐） */
  CHAT_SCOPE: 'tavern-phone:chat-scope',
  /** iframe → 父窗口：拉取变量中的角色档案（用于手动添加会话） */
  REQUEST_ROLE_ARCHIVE: 'tavern-phone:request-role-archive',
  /** 父窗口 → iframe：角色列表 */
  ROLE_ARCHIVE: 'tavern-phone:role-archive',
  REQUEST_WRITE_PHONE_MEMORY: 'tavern-phone:request-write-phone-memory',
  WRITE_PHONE_MEMORY_RESULT: 'tavern-phone:write-phone-memory-result',
  /** iframe → 父窗口：将文本追加到酒馆主界面发送框 */
  REQUEST_INJECT_TO_INPUT: 'tavern-phone:request-inject-to-input',
  INJECT_TO_INPUT_RESULT: 'tavern-phone:inject-to-input-result',
  OPENED: 'tavern-phone:opened',
  CLOSED: 'tavern-phone:closed',
  READY: 'tavern-phone:ready',
  /** 父 → iframe：拉取当前聊天 scope 下全部微信线程（用于主界面生成前写入世界书） */
  REQUEST_EXPORT_THREADS_FOR_WB: 'tavern-phone:request-export-threads-for-wb',
  /** iframe → 父：线程导出结果 */
  EXPORT_THREADS_FOR_WB_RESULT: 'tavern-phone:export-threads-for-wb-result',
} as const;

/** 微信会话列表中的联系人（可与人物属性编辑器等数据源对齐） */
export interface TavernPhoneWeChatContact {
  id: string;
  displayName: string;
  avatarUrl?: string;
  /** 若单条联系人提供，则优先于全局性格 */
  personality?: string;
  /** 若单条联系人提供，则优先于全局心理 */
  thought?: string;
  /**
   * 与酒馆「角色管理」中书卡名的对应（头像同步用）：可在变量档案里写 `酒馆角色名` / `stCharacterName`。
   * 壳脚本还会用 `phone_wechat_st_character_map` 或角色卡 json 里的 `手机微信角色ID` 按 id 匹配。
   */
  stCharacterName?: string;
}

/** 壳脚本可选下发的 OpenAI 兼容默认值（仅填补手机本地未填的项） */
export type TavernPhoneOpenAiDefaults = {
  apiBaseUrl: string | null;
  apiKey?: string | null;
  model: string | null;
};

/** 父窗口通过壳脚本注入的角色上下文（与规则/变量联动） */
export interface TavernPhoneContextPayload {
  /** 当前酒馆聊天文件 id（用于 IndexedDB 会话隔离；无则前端用 local-offline） */
  chatScopeId: string | null;
  /** 当前角色卡名（酒馆） */
  characterName: string | null;
  /** 聊天窗口展示名（优先变量映射，否则角色卡名） */
  displayName: string;
  /** 性格等人设摘要 */
  personality: string;
  /** 当前心理/内心想法等（来自角色或最新楼层变量） */
  thought: string;
  /** 会话列表（来自脚本 phone_wechat_contacts 或路径；否则为当前角色一条） */
  contacts: TavernPhoneWeChatContact[];
  /** 主界面最近若干楼节选（壳脚本用 getChatMessages 拼接） */
  recentStorySnippet: string;
  /** 角色档案中的剧情摘要，键为联系人 id（如 CHR-001） */
  roleStorySummaries: Record<string, string>;
  /** mergeContactContext 填入：当前会话联系人的剧情摘要 */
  roleStorySummary?: string;
  /** 脚本变量 phone_openai_api_base / phone_openai_model（见小手机壳说明） */
  openAiDefaults: TavernPhoneOpenAiDefaults;
  /** 未在超时内收到壳脚本响应（如单独打开 Vite 预览） */
  offline?: boolean;
  /** 当前酒馆聊天中最后一条消息的 last_id（用于判断开场白）；开场白为 1 */
  lastChatMessageId?: number;
}

/** 请求关闭整个小手机浮层（由壳脚本处理） */
export function postRequestCloseTavernPhone(): void {
  window.parent.postMessage({ type: TAVERN_PHONE_MSG.REQUEST_CLOSE }, '*');
}

type Pending = {
  resolve: (v: TavernPhoneContextPayload) => void;
  /** 浏览器环境下为 number，与 clearTimeout 一致 */
  timeout: number;
};

const pendingContext = new Map<string, Pending>();

type PendingRoleArchive = {
  resolve: (v: TavernPhoneWeChatContact[]) => void;
  timeout: number;
};

const pendingRoleArchive = new Map<string, PendingRoleArchive>();

type PendingWriteMemory = {
  resolve: (v: { ok: boolean; error?: string }) => void;
  timeout: number;
};

const pendingWriteMemory = new Map<string, PendingWriteMemory>();

type PendingInjectInput = {
  resolve: (v: { ok: boolean; error?: string }) => void;
  timeout: number;
};

const pendingInjectInput = new Map<string, PendingInjectInput>();

function ensureContextListener(): void {
  const w = window as Window & { __tavernPhoneContextListener?: boolean };
  if (w.__tavernPhoneContextListener) {
    return;
  }
  w.__tavernPhoneContextListener = true;
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as {
      type?: string;
      requestId?: string;
      payload?: TavernPhoneContextPayload;
      contacts?: TavernPhoneWeChatContact[];
      error?: string;
    };
    if (d?.type === TAVERN_PHONE_MSG.CONTEXT && typeof d.requestId === 'string') {
      const p = pendingContext.get(d.requestId);
      if (!p) {
        return;
      }
      clearTimeout(p.timeout);
      pendingContext.delete(d.requestId);
      if (d.error) {
        p.resolve({
          chatScopeId: null,
          characterName: null,
          displayName: '角色',
          personality: '',
          thought: '',
          contacts: [{ id: 'default', displayName: '角色' }],
          recentStorySnippet: '',
          roleStorySummaries: {},
          openAiDefaults: { apiBaseUrl: null, model: null },
          offline: true,
        });
        return;
      }
      if (d.payload && typeof d.payload === 'object') {
        const raw = d.payload as TavernPhoneContextPayload;
        p.resolve({
          ...raw,
          recentStorySnippet: raw.recentStorySnippet ?? '',
          roleStorySummaries: raw.roleStorySummaries ?? {},
          openAiDefaults: raw.openAiDefaults ?? { apiBaseUrl: null, model: null },
        });
      } else {
        p.resolve({
          chatScopeId: null,
          characterName: null,
          displayName: '角色',
          personality: '',
          thought: '',
          contacts: [{ id: 'default', displayName: '角色' }],
          recentStorySnippet: '',
          roleStorySummaries: {},
          openAiDefaults: { apiBaseUrl: null, model: null },
          offline: true,
        });
      }
      return;
    }
    if (d?.type === TAVERN_PHONE_MSG.ROLE_ARCHIVE && typeof d.requestId === 'string') {
      const p = pendingRoleArchive.get(d.requestId);
      if (!p) {
        return;
      }
      clearTimeout(p.timeout);
      pendingRoleArchive.delete(d.requestId);
      const list = Array.isArray(d.contacts) ? d.contacts : [];
      p.resolve(list);
      return;
    }
    if (d?.type === TAVERN_PHONE_MSG.WRITE_PHONE_MEMORY_RESULT && typeof d.requestId === 'string') {
      const p = pendingWriteMemory.get(d.requestId);
      if (!p) {
        return;
      }
      clearTimeout(p.timeout);
      pendingWriteMemory.delete(d.requestId);
      const ok = Boolean((d as { ok?: boolean }).ok);
      const err = (d as { error?: string }).error;
      p.resolve({ ok, error: typeof err === 'string' ? err : undefined });
      return;
    }
    if (d?.type === TAVERN_PHONE_MSG.INJECT_TO_INPUT_RESULT && typeof d.requestId === 'string') {
      const p = pendingInjectInput.get(d.requestId);
      if (!p) {
        return;
      }
      clearTimeout(p.timeout);
      pendingInjectInput.delete(d.requestId);
      const ok = Boolean((d as { ok?: boolean }).ok);
      const err = (d as { error?: string }).error;
      p.resolve({ ok, error: typeof err === 'string' ? err : undefined });
    }
  });
}

const CONTEXT_TIMEOUT_MS = 4000;

/**
 * 向壳脚本请求当前角色与变量上下文（性格、心理想法等）。
 * 若不在酒馆内嵌或超时，返回 offline 占位，仍可本地试 UI。
 */
export function requestTavernPhoneContext(): Promise<TavernPhoneContextPayload> {
  ensureContextListener();
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => {
      pendingContext.delete(requestId);
      resolve({
        chatScopeId: null,
        characterName: null,
        displayName: '本地预览',
        personality: '',
        thought: '',
        contacts: [{ id: 'default', displayName: '本地预览' }],
        recentStorySnippet: '',
        roleStorySummaries: {},
        openAiDefaults: { apiBaseUrl: null, model: null },
        offline: true,
      });
    }, CONTEXT_TIMEOUT_MS);
    pendingContext.set(requestId, { resolve, timeout });
    try {
      window.parent.postMessage({ type: TAVERN_PHONE_MSG.REQUEST_CONTEXT, requestId }, '*');
    } catch {
      clearTimeout(timeout);
      pendingContext.delete(requestId);
      resolve({
        chatScopeId: null,
        characterName: null,
        displayName: '本地预览',
        personality: '',
        thought: '',
        contacts: [{ id: 'default', displayName: '本地预览' }],
        recentStorySnippet: '',
        roleStorySummaries: {},
        openAiDefaults: { apiBaseUrl: null, model: null },
        offline: true,
      });
    }
  });
}

const WRITE_MEMORY_TIMEOUT_MS = 8000;
const INJECT_INPUT_TIMEOUT_MS = 6000;

/**
 * 请求壳脚本将文本追加到酒馆主界面发送框（#send_textarea）
 */
export function requestInjectToInput(text: string): Promise<{ ok: boolean; error?: string }> {
  ensureContextListener();
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => {
      pendingInjectInput.delete(requestId);
      resolve({ ok: false, error: '填入超时' });
    }, INJECT_INPUT_TIMEOUT_MS);
    pendingInjectInput.set(requestId, { resolve, timeout });
    try {
      window.parent.postMessage(
        { type: TAVERN_PHONE_MSG.REQUEST_INJECT_TO_INPUT, requestId, text },
        '*',
      );
    } catch {
      clearTimeout(timeout);
      pendingInjectInput.delete(requestId);
      resolve({ ok: false, error: 'postMessage 失败' });
    }
  });
}

/**
 * 请求壳脚本将摘要写入聊天变量（见 phone_wechat_memory_path）
 */
export function requestWritePhoneMemory(payload: {
  contactId: string;
  chatScopeId: string;
  summary: string;
}): Promise<{ ok: boolean; error?: string }> {
  ensureContextListener();
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => {
      pendingWriteMemory.delete(requestId);
      resolve({ ok: false, error: '写入超时' });
    }, WRITE_MEMORY_TIMEOUT_MS);
    pendingWriteMemory.set(requestId, { resolve, timeout });
    try {
      window.parent.postMessage(
        {
          type: TAVERN_PHONE_MSG.REQUEST_WRITE_PHONE_MEMORY,
          requestId,
          contactId: payload.contactId,
          chatScopeId: payload.chatScopeId,
          summary: payload.summary,
        },
        '*',
      );
    } catch {
      clearTimeout(timeout);
      pendingWriteMemory.delete(requestId);
      resolve({ ok: false, error: 'postMessage 失败' });
    }
  });
}

/**
 * 监听父窗口推送的聊天文件切换（与 CONTEXT 中 chatScopeId 语义一致）
 */
export function subscribeChatScopeChange(handler: (chatScopeId: string | null) => void): () => void {
  const fn = (e: MessageEvent) => {
    const d = e.data as { type?: string; chatScopeId?: string | null };
    if (d?.type === TAVERN_PHONE_MSG.CHAT_SCOPE) {
      handler(d.chatScopeId ?? null);
    }
  };
  window.addEventListener('message', fn);
  return () => window.removeEventListener('message', fn);
}

const ROLE_ARCHIVE_TIMEOUT_MS = 5000;

/**
 * 向壳脚本请求从变量中解析出的全部「角色档案」条目（合并多路径、多变量源），用于手动添加到会话列表。
 */
export function requestRoleArchiveList(): Promise<TavernPhoneWeChatContact[]> {
  ensureContextListener();
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => {
      pendingRoleArchive.delete(requestId);
      resolve([]);
    }, ROLE_ARCHIVE_TIMEOUT_MS);
    pendingRoleArchive.set(requestId, { resolve, timeout });
    try {
      window.parent.postMessage({ type: TAVERN_PHONE_MSG.REQUEST_ROLE_ARCHIVE, requestId }, '*');
    } catch {
      clearTimeout(timeout);
      pendingRoleArchive.delete(requestId);
      resolve([]);
    }
  });
}
