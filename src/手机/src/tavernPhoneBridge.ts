/**
 * 与酒馆脚本「小手机壳」约定的 postMessage 协议（与 src/小手机壳/index.ts 中 MSG 一致）
 */
export const TAVERN_PHONE_MSG = {
  REQUEST_CLOSE: 'tavern-phone:request-close',
  /** iframe → 父窗口：请求当前角色/变量上下文（供微信等联动） */
  REQUEST_CONTEXT: 'tavern-phone:request-context',
  /** 父窗口 → iframe：返回上下文 */
  CONTEXT: 'tavern-phone:context',
  /** iframe → 父窗口：拉取变量中的角色档案（用于手动添加会话） */
  REQUEST_ROLE_ARCHIVE: 'tavern-phone:request-role-archive',
  /** 父窗口 → iframe：角色列表 */
  ROLE_ARCHIVE: 'tavern-phone:role-archive',
  OPENED: 'tavern-phone:opened',
  CLOSED: 'tavern-phone:closed',
  READY: 'tavern-phone:ready',
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
}

/** 父窗口通过壳脚本注入的角色上下文（与规则/变量联动） */
export interface TavernPhoneContextPayload {
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
  /** 未在超时内收到壳脚本响应（如单独打开 Vite 预览） */
  offline?: boolean;
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
          characterName: null,
          displayName: '角色',
          personality: '',
          thought: '',
          contacts: [{ id: 'default', displayName: '角色' }],
          offline: true,
        });
        return;
      }
      if (d.payload && typeof d.payload === 'object') {
        p.resolve(d.payload as TavernPhoneContextPayload);
      } else {
        p.resolve({
          characterName: null,
          displayName: '角色',
          personality: '',
          thought: '',
          contacts: [{ id: 'default', displayName: '角色' }],
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
        characterName: null,
        displayName: '本地预览',
        personality: '',
        thought: '',
        contacts: [{ id: 'default', displayName: '本地预览' }],
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
        characterName: null,
        displayName: '本地预览',
        personality: '',
        thought: '',
        contacts: [{ id: 'default', displayName: '本地预览' }],
        offline: true,
      });
    }
  });
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
