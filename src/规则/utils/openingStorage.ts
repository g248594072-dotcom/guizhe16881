/**
 * 开局表单：条目库与完整预设（浏览器 localStorage）
 */

export const OPENING_STORAGE_KEY = 'rule_modifier_opening_storage_v1';

export interface RuleSnippet {
  id: string;
  name: string;
  desc: string;
}

export interface CharacterSnippet {
  id: string;
  name: string;
  gender: string;
  desc: string;
}

/** 自定义故事场景文案（对应表单「或创建自定义场景」） */
export type SceneSnippet = RuleSnippet;

/** 开局场景细化文案（对应「开局场景描述」） */
export type OpeningSceneSnippet = RuleSnippet;

export interface OpeningPresetPayload {
  sceneMode: 'preset' | 'custom';
  sceneId: string | null;
  customSceneDesc: string;
  selectedRules: string[];
  customRules: { name: string; desc: string }[];
  characters: { name: string; gender: string; desc: string }[];
  openingSceneDetail: string;
}

export interface OpeningPreset {
  id: string;
  name: string;
  createdAt: string;
  payload: OpeningPresetPayload;
}

export interface OpeningStorageV1 {
  version: 1;
  ruleSnippets: RuleSnippet[];
  characterSnippets: CharacterSnippet[];
  sceneSnippets: SceneSnippet[];
  openingSceneSnippets: OpeningSceneSnippet[];
  presets: OpeningPreset[];
}

export function createStorageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function defaultStorage(): OpeningStorageV1 {
  return {
    version: 1,
    ruleSnippets: [],
    characterSnippets: [],
    sceneSnippets: [],
    openingSceneSnippets: [],
    presets: [],
  };
}

function asRuleSnippet(x: unknown): RuleSnippet | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.name !== 'string' || typeof o.desc !== 'string') return null;
  const id = typeof o.id === 'string' ? o.id : createStorageId();
  return { id, name: o.name, desc: o.desc };
}

function asCharacterSnippet(x: unknown): CharacterSnippet | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.name !== 'string' || typeof o.desc !== 'string') return null;
  const id = typeof o.id === 'string' ? o.id : createStorageId();
  const gender = typeof o.gender === 'string' ? o.gender : 'female';
  return { id, name: o.name, gender, desc: o.desc };
}

function asPresetPayload(x: unknown): OpeningPresetPayload | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const sceneMode = o.sceneMode === 'custom' ? 'custom' : 'preset';
  const sceneId = o.sceneId === null || typeof o.sceneId === 'string' ? o.sceneId : null;
  const customSceneDesc = typeof o.customSceneDesc === 'string' ? o.customSceneDesc : '';
  const openingSceneDetail = typeof o.openingSceneDetail === 'string' ? o.openingSceneDetail : '';
  const selectedRules = Array.isArray(o.selectedRules)
    ? o.selectedRules.filter((id): id is string => typeof id === 'string')
    : [];
  const customRules = Array.isArray(o.customRules)
    ? o.customRules
        .map(r => {
          if (!r || typeof r !== 'object') return null;
          const u = r as Record<string, unknown>;
          if (typeof u.name !== 'string' || typeof u.desc !== 'string') return null;
          return { name: u.name, desc: u.desc };
        })
        .filter(Boolean) as { name: string; desc: string }[]
    : [];
  const characters = Array.isArray(o.characters)
    ? o.characters
        .map(c => {
          if (!c || typeof c !== 'object') return null;
          const u = c as Record<string, unknown>;
          if (typeof u.name !== 'string' || typeof u.desc !== 'string') return null;
          const gender = typeof u.gender === 'string' ? u.gender : 'female';
          return { name: u.name, gender, desc: u.desc };
        })
        .filter(Boolean) as { name: string; gender: string; desc: string }[]
    : [];
  return {
    sceneMode,
    sceneId,
    customSceneDesc,
    selectedRules,
    customRules,
    characters,
    openingSceneDetail,
  };
}

function asPreset(x: unknown): OpeningPreset | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.name !== 'string') return null;
  const payload = asPresetPayload(o.payload);
  if (!payload) return null;
  const id = typeof o.id === 'string' ? o.id : createStorageId();
  const createdAt = typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString();
  return { id, name: o.name, createdAt, payload };
}

export function normalizeOpeningStorage(parsed: unknown): OpeningStorageV1 {
  if (!parsed || typeof parsed !== 'object') return defaultStorage();
  const o = parsed as Record<string, unknown>;
  if (o.version !== 1) return defaultStorage();

  const ruleSnippets = Array.isArray(o.ruleSnippets)
    ? o.ruleSnippets.map(asRuleSnippet).filter(Boolean) as RuleSnippet[]
    : [];
  const characterSnippets = Array.isArray(o.characterSnippets)
    ? o.characterSnippets.map(asCharacterSnippet).filter(Boolean) as CharacterSnippet[]
    : [];
  const presets = Array.isArray(o.presets) ? o.presets.map(asPreset).filter(Boolean) as OpeningPreset[] : [];
  const sceneSnippets = Array.isArray(o.sceneSnippets)
    ? o.sceneSnippets.map(asRuleSnippet).filter(Boolean) as SceneSnippet[]
    : [];
  const openingSceneSnippets = Array.isArray(o.openingSceneSnippets)
    ? o.openingSceneSnippets.map(asRuleSnippet).filter(Boolean) as OpeningSceneSnippet[]
    : [];

  return { version: 1, ruleSnippets, characterSnippets, sceneSnippets, openingSceneSnippets, presets };
}

export function loadOpeningStorage(): OpeningStorageV1 {
  try {
    const raw = localStorage.getItem(OPENING_STORAGE_KEY);
    if (!raw) return defaultStorage();
    const parsed = JSON.parse(raw) as unknown;
    return normalizeOpeningStorage(parsed);
  } catch (e) {
    console.warn('[openingStorage] load failed', e);
    return defaultStorage();
  }
}

export function saveOpeningStorage(data: OpeningStorageV1): void {
  try {
    localStorage.setItem(OPENING_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[openingStorage] save failed', e);
  }
}

export function serializeOpeningStorage(data: OpeningStorageV1): string {
  return JSON.stringify(data, null, 2);
}

export function parseOpeningStorageJson(text: string): OpeningStorageV1 | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    const n = normalizeOpeningStorage(parsed);
    if (n.version !== 1) return null;
    return n;
  } catch {
    return null;
  }
}

export function downloadOpeningStorageJson(data: OpeningStorageV1): void {
  const blob = new Blob([serializeOpeningStorage(data)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `opening-storage-${new Date().toISOString().slice(0, 10)}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== 创意工坊合并助手 =====

function isDuplicate<T extends { id: string }>(items: T[], newItem: T, compareFn?: (a: T, b: T) => boolean): boolean {
  if (compareFn) {
    return items.some(item => compareFn(item, newItem));
  }
  // Default: check by content similarity (name + desc for snippets)
  const newItemAny = newItem as any;
  if (newItemAny.name && newItemAny.desc) {
    return items.some(item => {
      const itemAny = item as any;
      return itemAny.name === newItemAny.name && itemAny.desc === newItemAny.desc;
    });
  }
  // Fallback: check by id
  return items.some(item => item.id === newItem.id);
}

/**
 * 合并规则片段到本地存储
 * @returns true 如果添加成功，false 如果是重复项
 */
export function mergeRuleSnippet(storage: OpeningStorageV1, snippet: RuleSnippet): boolean {
  if (isDuplicate(storage.ruleSnippets, snippet, (a, b) => a.name === b.name && a.desc === b.desc)) {
    return false;
  }
  storage.ruleSnippets.push(snippet);
  return true;
}

/**
 * 合并角色片段到本地存储
 * @returns true 如果添加成功，false 如果是重复项
 */
export function mergeCharacterSnippet(storage: OpeningStorageV1, snippet: CharacterSnippet): boolean {
  if (isDuplicate(storage.characterSnippets, snippet, (a, b) => 
    a.name === b.name && a.gender === b.gender && a.desc === b.desc
  )) {
    return false;
  }
  storage.characterSnippets.push(snippet);
  return true;
}

/**
 * 合并场景片段到本地存储
 * @returns true 如果添加成功，false 如果是重复项
 */
export function mergeSceneSnippet(storage: OpeningStorageV1, snippet: SceneSnippet): boolean {
  if (isDuplicate(storage.sceneSnippets, snippet, (a, b) => a.name === b.name && a.desc === b.desc)) {
    return false;
  }
  storage.sceneSnippets.push(snippet);
  return true;
}

/**
 * 合并开局场景片段到本地存储
 * @returns true 如果添加成功，false 如果是重复项
 */
export function mergeOpeningSceneSnippet(storage: OpeningStorageV1, snippet: OpeningSceneSnippet): boolean {
  if (isDuplicate(storage.openingSceneSnippets, snippet, (a, b) => a.name === b.name && a.desc === b.desc)) {
    return false;
  }
  storage.openingSceneSnippets.push(snippet);
  return true;
}

/**
 * 合并完整预设到本地存储
 * @returns true 如果添加成功，false 如果是重复项
 */
export function mergePreset(storage: OpeningStorageV1, preset: OpeningPreset): boolean {
  // For presets, compare by name and payload similarity
  const isDup = storage.presets.some(p => {
    if (p.name !== preset.name) return false;
    // Compare payload by stringifying
    return JSON.stringify(p.payload) === JSON.stringify(preset.payload);
  });
  
  if (isDup) {
    return false;
  }
  storage.presets.push(preset);
  return true;
}

/**
 * 合并创意工坊下载的内容到本地存储（通用接口）
 * @param storage 当前存储
 * @param type 内容类型
 * @param content 内容数据
 * @returns { merged: boolean, message: string } 合并结果
 */
export function mergeWorkshopContent(
  storage: OpeningStorageV1,
  type: 'rule' | 'character' | 'scene' | 'openingScene' | 'preset',
  content: RuleSnippet | CharacterSnippet | SceneSnippet | OpeningSceneSnippet | OpeningPreset
): { merged: boolean; message: string } {
  switch (type) {
    case 'rule': {
      const added = mergeRuleSnippet(storage, content as RuleSnippet);
      return {
        merged: added,
        message: added 
          ? `规则 "${(content as RuleSnippet).name}" 已添加到本地规则库`
          : '该规则已存在于本地规则库'
      };
    }
    case 'character': {
      const added = mergeCharacterSnippet(storage, content as CharacterSnippet);
      return {
        merged: added,
        message: added
          ? `角色 "${(content as CharacterSnippet).name}" 已添加到本地角色库`
          : '该角色已存在于本地角色库'
      };
    }
    case 'scene': {
      const added = mergeSceneSnippet(storage, content as SceneSnippet);
      return {
        merged: added,
        message: added
          ? `场景 "${(content as SceneSnippet).name}" 已添加到本地场景库`
          : '该场景已存在于本地场景库'
      };
    }
    case 'openingScene': {
      const added = mergeOpeningSceneSnippet(storage, content as OpeningSceneSnippet);
      return {
        merged: added,
        message: added
          ? `开局场景 "${(content as OpeningSceneSnippet).name}" 已添加到本地开局场景库`
          : '该开局场景已存在于本地开局场景库'
      };
    }
    case 'preset': {
      const added = mergePreset(storage, content as OpeningPreset);
      return {
        merged: added,
        message: added
          ? `预设 "${(content as OpeningPreset).name}" 已添加到本地预设库`
          : '该预设已存在于本地预设库'
      };
    }
    default:
      return { merged: false, message: '未知的内容类型' };
  }
}
