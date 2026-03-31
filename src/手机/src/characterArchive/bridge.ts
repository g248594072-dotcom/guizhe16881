/**
 * 角色档案数据桥接层
 * 通过小手机壳的 postMessage 协议，从规则 App 的 MVU 变量中获取角色档案数据
 */

/** 小手机 postMessage 协议类型 */
const MSG = {
  REQUEST_CHARACTER_ARCHIVE: 'tavern-phone:request-character-archive',
  CHARACTER_ARCHIVE_RESPONSE: 'tavern-phone:character-archive-response',
  REQUEST_WRITE_CHARACTER_ANALYSIS: 'tavern-phone:request-write-character-analysis',
  WRITE_CHARACTER_ANALYSIS_RESULT: 'tavern-phone:write-character-analysis-result',
} as const;

/** 监听器是否已初始化 */
let archiveListenerInitialized = false;
let writeAnalysisListenerInitialized = false;

/** 挂起的请求 */
type PendingArchive = {
  resolve: (v: Record<string, unknown>) => void;
  timeout: number;
};

const pendingArchive = new Map<string, PendingArchive>();

type PendingWriteAnalysis = {
  resolve: (v: { ok: boolean; error?: string }) => void;
  timeout: number;
};

const pendingWriteAnalysis = new Map<string, PendingWriteAnalysis>();

/**
 * 初始化角色档案读取监听器
 */
function ensureArchiveListener(): void {
  if (archiveListenerInitialized) return;
  archiveListenerInitialized = true;

  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as {
      type?: string;
      requestId?: string;
      payload?: Record<string, unknown>;
      error?: string;
    };
    if (d?.type === MSG.CHARACTER_ARCHIVE_RESPONSE && typeof d.requestId === 'string') {
      const p = pendingArchive.get(d.requestId);
      if (!p) return;
      clearTimeout(p.timeout);
      pendingArchive.delete(d.requestId);
      p.resolve((d.payload as Record<string, unknown>) || {});
    }
  });
}

/**
 * 初始化写回结果监听器
 */
function ensureWriteAnalysisListener(): void {
  if (writeAnalysisListenerInitialized) return;
  writeAnalysisListenerInitialized = true;

  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as {
      type?: string;
      requestId?: string;
      ok?: boolean;
      error?: string;
    };
    if (d?.type === MSG.WRITE_CHARACTER_ANALYSIS_RESULT && typeof d.requestId === 'string') {
      const p = pendingWriteAnalysis.get(d.requestId);
      if (!p) return;
      clearTimeout(p.timeout);
      pendingWriteAnalysis.delete(d.requestId);
      p.resolve({
        ok: Boolean(d.ok),
        error: typeof d.error === 'string' ? d.error : undefined,
      });
    }
  });
}

/**
 * 向壳脚本请求从规则 App MVU 变量中读取「角色档案」
 * 导出给 characterAnalyzer 使用
 */
export function requestCharacterArchiveFromShell(): Promise<Record<string, unknown>> {
  ensureArchiveListener();
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => {
      pendingArchive.delete(requestId);
      resolve({});
    }, 6000);
    pendingArchive.set(requestId, { resolve, timeout });
    try {
      window.parent.postMessage({ type: MSG.REQUEST_CHARACTER_ARCHIVE, requestId }, '*');
    } catch {
      clearTimeout(timeout);
      pendingArchive.delete(requestId);
      resolve({});
    }
  });
}

/** 小手机 UI 展示用的角色档案（从 MVU CharacterData 映射而来） */
export interface PhoneCharacterArchive {
  id: string;
  name: string;
  status: '出场中' | '暂时退场';
  description: string;
  avatarUrl?: string;
  body: {
    age: number;
    height: number;
    weight: number;
    threeSize: string;
    physique: string;
  };
  stats: {
    affection: number;   // 好感度 0-100
    lust: number;        // 发情值 0-100
    fetish: number;      // 性癖开发值 0-100
  };
  currentThought: string;
  personality: Record<string, string>;
  fetishes: Record<string, { level: number; description: string; justification: string }>;
  sensitiveParts: Record<string, { level: number; reaction: string; devDetails: string }>;
  identityTags: Record<string, string>;
  currentPhysiologicalDescription: string;
}

/** 原始 MVU 角色档案结构（来自规则 App 的 schema.ts） */
interface MvuCharacterData {
  姓名: string;
  状态?: '出场中' | '暂时退场';
  描写?: string;
  头像链接?: string;
  头像?: string;
  当前内心想法?: string;
  性格?: Record<string, string>;
  性癖?: Record<string, { 等级?: number; level?: number; 细节描述?: string; description?: string; 自我合理化?: string; justification?: string }>;
  敏感部位?: Record<string, { 敏感等级?: number; level?: number; 生理反应?: string; reaction?: string; 开发细节?: string; devDetails?: string }>;
  身体信息?: {
    年龄?: number;
    身高?: number;
    体重?: number;
    三围?: string;
    体质特征?: string;
  };
  数值?: {
    好感度?: number;
    发情值?: number;
    性癖开发值?: number;
  };
  身份标签?: Record<string, string>;
  当前综合生理描述?: string;
}

/** 从 MVU 原始数据映射到 PhoneCharacterArchive */
function mapMvuCharacter(id: string, raw: MvuCharacterData): PhoneCharacterArchive {
  return {
    id,
    name: raw.姓名 || '未知角色',
    status: raw.状态 || '出场中',
    description: raw.描写 || '',
    avatarUrl: raw.头像链接 || raw.头像,
    body: {
      age: raw.身体信息?.年龄 ?? 0,
      height: raw.身体信息?.身高 ?? 0,
      weight: raw.身体信息?.体重 ?? 0,
      threeSize: raw.身体信息?.三围 || '未知',
      physique: raw.身体信息?.体质特征 || '普通',
    },
    stats: {
      affection: raw.数值?.好感度 ?? 0,
      lust: raw.数值?.发情值 ?? 0,
      fetish: raw.数值?.性癖开发值 ?? 0,
    },
    currentThought: raw.当前内心想法 || '',
    personality: raw.性格 || {},
    fetishes: raw.性癖 ? Object.fromEntries(
      Object.entries(raw.性癖).map(([k, v]) => [k, {
        level: v?.等级 ?? v?.level ?? 1,
        description: v?.细节描述 || v?.description || '',
        justification: v?.自我合理化 || v?.justification || '',
      }])
    ) : {},
    sensitiveParts: raw.敏感部位 ? Object.fromEntries(
      Object.entries(raw.敏感部位).map(([k, v]) => [k, {
        level: v?.敏感等级 ?? v?.level ?? 1,
        reaction: v?.生理反应 || v?.reaction || '',
        devDetails: v?.开发细节 || v?.devDetails || '',
      }])
    ) : {},
    identityTags: raw.身份标签 || {},
    currentPhysiologicalDescription: raw.当前综合生理描述 || '',
  };
}

/**
 * 从规则 App 加载角色档案数据
 * 通过壳脚本获取 MVU 角色档案原始数据
 */
export async function loadCharacterArchive(): Promise<PhoneCharacterArchive[]> {
  try {
    const rawData = await requestCharacterArchiveFromShell();
    const 角色档案 = rawData['角色档案'] as Record<string, MvuCharacterData> | undefined;
    if (!角色档案 || typeof 角色档案 !== 'object') {
      return [];
    }
    const entries = Object.entries(角色档案) as [string, MvuCharacterData][];
    return entries.map(([id, data]) => mapMvuCharacter(id, data));
  } catch (e) {
    console.warn('[bridge] 加载角色档案失败:', e);
    return [];
  }
}

/** 获取单个角色档案 */
export async function loadCharacterArchiveById(id: string): Promise<PhoneCharacterArchive | null> {
  const all = await loadCharacterArchive();
  return all.find(c => c.id === id) ?? null;
}

/**
 * 写回角色分析结果到 MVU 变量
 * 通过壳脚本调用 Mvu.setMvuData 更新最新楼层的角色档案
 */
export async function writeCharacterAnalysisResult(
  characterId: string,
  updates: {
    当前内心想法?: string;
    性格?: Record<string, string>;
    性癖?: Record<string, { 等级: number; 细节描述: string; 自我合理化: string }>;
    敏感部位?: Record<string, { 敏感等级: number; 生理反应: string; 开发细节: string }>;
    数值?: { 好感度?: number; 发情值?: number; 性癖开发值?: number };
    身份标签?: Record<string, string>;
    当前综合生理描述?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  ensureWriteAnalysisListener();
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => {
      pendingWriteAnalysis.delete(requestId);
      resolve({ ok: false, error: '写回超时' });
    }, 8000);
    pendingWriteAnalysis.set(requestId, { resolve, timeout });
    try {
      window.parent.postMessage(
        {
          type: MSG.REQUEST_WRITE_CHARACTER_ANALYSIS,
          requestId,
          characterId,
          updates,
        },
        '*',
      );
    } catch {
      clearTimeout(timeout);
      pendingWriteAnalysis.delete(requestId);
      resolve({ ok: false, error: 'postMessage 失败' });
    }
  });
}

/** 同步角色分析结果到世界书 */
export async function syncCharacterAnalysisToWorldbook(
  characterId: string,
  updates: {
    姓名?: string;
    当前内心想法?: string;
    性格?: Record<string, string>;
    性癖?: Record<string, { 等级?: number; 细节描述?: string }>;
    敏感部位?: Record<string, { 敏感等级?: number; 生理反应?: string }>;
    数值?: Record<string, number>;
    身份标签?: Record<string, string>;
    当前综合生理描述?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => {
      resolve({ ok: false, error: '同步超时' });
    }, 10000);
    const handler = (e: MessageEvent) => {
      const d = e.data as { type?: string; requestId?: string; ok?: boolean; error?: string };
      if (d?.type !== MSG.SYNC_CHARACTER_TO_WORLDBOOK_RESULT || d.requestId !== requestId) {
        return;
      }
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      resolve({ ok: Boolean(d.ok), error: typeof d.error === 'string' ? d.error : undefined });
    };
    window.addEventListener('message', handler);
    try {
      window.parent.postMessage(
        {
          type: MSG.REQUEST_SYNC_CHARACTER_TO_WORLDBOOK,
          requestId,
          characterId,
          updates,
        },
        '*',
      );
    } catch {
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      resolve({ ok: false, error: 'postMessage 失败' });
    }
  });
}
