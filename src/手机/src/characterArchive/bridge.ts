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
  REQUEST_SYNC_CHARACTER_TO_WORLDBOOK: 'tavern-phone:request-sync-character-to-worldbook',
  SYNC_CHARACTER_TO_WORLDBOOK_RESULT: 'tavern-phone:sync-character-to-worldbook-result',
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

/** 小手机 UI 展示用的角色档案（从 MVU CharacterData 映射而来；头像见本机缓存，不读 MVU 头像字段） */
export interface PhoneCharacterArchive {
  id: string;
  name: string;
  status: '出场中' | '暂时退场';
  description: string;
  /** 不从 MVU 注入；仅在同会话内上传头像后由界面临时写入 */
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
  /** MVU 新键名；旧档可能仅有「敏感部位」 */
  敏感点开发?: Record<string, { 敏感等级?: number; level?: number; 生理反应?: string; reaction?: string; 开发细节?: string; devDetails?: string }>;
  敏感部位?: Record<string, { 敏感等级?: number; level?: number; 生理反应?: string; reaction?: string; 开发细节?: string; devDetails?: string }>;
  服装状态?: Record<string, unknown>;
  身体部位物理状态?: Record<string, { 外观描述?: string; 当前状态?: string }>;
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

/**
 * 规则脚本若把对象误存为 "[object Object]" 或 JSON 字符串，读变量时尽量还原为 Record。
 */
function coerceTopLevelRecord(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) {
    return {};
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s || s === '[object Object]') {
      return {};
    }
    try {
      const p = JSON.parse(s) as unknown;
      if (typeof p === 'object' && p !== null && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      /* 非 JSON */
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function coerceNestedRow(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) {
    return {};
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || s === '[object Object]') {
      return {};
    }
    try {
      const p = JSON.parse(s) as unknown;
      if (typeof p === 'object' && p !== null && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function normalizeStringRecordField(raw: unknown): Record<string, string> {
  const src = coerceTopLevelRecord(raw);
  return Object.fromEntries(
    Object.entries(src).map(([k, val]) => {
      if (typeof val === 'string') {
        return [k, val];
      }
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        return [k, JSON.stringify(val as Record<string, unknown>)];
      }
      return [k, String(val ?? '')];
    }),
  );
}

function mapFetishesFromRaw(raw: unknown): PhoneCharacterArchive['fetishes'] {
  const src = coerceTopLevelRecord(raw);
  return Object.fromEntries(
    Object.entries(src).map(([k, v]) => {
      const row = coerceNestedRow(v);
      return [
        k,
        {
          level: Number(row['等级'] ?? row['level'] ?? 1) || 1,
          description: String(row['细节描述'] ?? row['description'] ?? ''),
          justification: String(row['自我合理化'] ?? row['justification'] ?? ''),
        },
      ];
    }),
  );
}

function mapSensitiveFromRaw(raw: unknown): PhoneCharacterArchive['sensitiveParts'] {
  const src = coerceTopLevelRecord(raw);
  return Object.fromEntries(
    Object.entries(src).map(([k, v]) => {
      const row = coerceNestedRow(v);
      return [
        k,
        {
          level: Number(row['敏感等级'] ?? row['level'] ?? 1) || 1,
          reaction: String(row['生理反应'] ?? row['reaction'] ?? ''),
          devDetails: String(row['开发细节'] ?? row['devDetails'] ?? ''),
        },
      ];
    }),
  );
}

/** 从 MVU 原始数据映射到 PhoneCharacterArchive（头像走本机 phoneCharacterAvatarStorage，不读变量里的头像字段） */
function mapMvuCharacter(id: string, raw: MvuCharacterData): PhoneCharacterArchive {
  return {
    id,
    name: raw.姓名 || '未知角色',
    status: raw.状态 || '出场中',
    description: raw.描写 || '',
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
    personality: normalizeStringRecordField(raw.性格 as unknown),
    fetishes: mapFetishesFromRaw(raw.性癖 as unknown),
    sensitiveParts: mapSensitiveFromRaw(raw.敏感部位 as unknown),
    identityTags: normalizeStringRecordField(raw.身份标签 as unknown),
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
  options?: {
    position?: string;
    priority?: number;
    keywords?: string;
    preventRecursion?: boolean;
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
          options: options || {},
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
