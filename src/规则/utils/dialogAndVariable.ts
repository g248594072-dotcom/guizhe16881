/**
 * 将内容填入对话框并同步修改变量
 * 用于：新增/编辑角色、规则等操作
 * 
 * 注意：此版本已适配 ZOD MVU，使用 useDataStore 直接修改变量
 * 修改会自动同步到酒馆变量，无需手动调用 updateVariablesWith
 */

import type {
  BodyPartPhysicsZh,
  CharacterData,
  ClothingSlotZh,
  ClothingStateZh,
  RegionData,
  RuleData,
} from '../types';
import {
  useDataStore,
  bumpUpdateTime,
  tryRulesMvuWritable,
  isRulesMvuArchiveSnapshot,
} from '../store';
import {
  parseEditableTextToTagMap,
  parseEditableTextToFetishRecord,
  parseEditableTextToSensitiveRecord,
  type FetishEntryZh,
  type SensitiveEntryZh,
} from './tagMap';
import { generateWorldTrend } from './worldLifeGenerator';
import { markResidentLifePendingPersonalRule } from './residentLifePending';

/**
 * 将文本写入前端对话框输入区（不创建新楼层）
 */
export async function sendToDialog(message: string): Promise<void> {
  try {
    window.dispatchEvent(new CustomEvent('th:copy-to-input', { detail: { message } }));
    console.log('✅ [dialogAndVariable] 已写入前端对话框输入区:', message.substring(0, 80) + (message.length > 80 ? '...' : ''));
  } catch (e) {
    console.warn('⚠️ [dialogAndVariable] 写入前端对话框输入区失败:', e);
  }
}

/** 状态转换：active/inactive → 生效中/已归档 */
function enRuleStatusToZh(status: string | undefined, prev: string): string {
  if (status === 'active') return '生效中';
  if (status === 'inactive') return '已归档';
  return prev || '生效中';
}

/** 解析身体数值 */
function parseBodyNumber(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = parseInt(String(raw).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** 解析标签文本 */
function parseTagLines(text: string): string[] {
  const raw = String(text ?? '');
  return raw
    .split(/\r?\n|，|,/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------- 角色 ----------

export function formatAddCharacterMessage(name: string, description: string): string {
  const n = name.trim();
  const d = description.trim();
  const lines = ['[新增角色]', `姓名：${n}`];
  if (d) lines.push(`简单描述：${d}`);
  return lines.join('\n');
}

export function addCharacterToVariables(name: string, description: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const id = `CHR-${Date.now()}`;
  const n = name.trim() || '未命名';
  const desc = description.trim();

  const slot = () => ({ 名称: '', 状态: '正常', 描述: '' });
  store.data.角色档案[id] = {
    姓名: n,
    状态: '出场中',
    描写: desc,
    当前内心想法: '',
    性格: {},
    性癖: {},
    敏感点开发: {},
    隐藏性癖: '',
    身体信息: {
      年龄: 17,
      身高: 160,
      体重: 48,
      三围: '未知',
      体质特征: '普通',
    },
    服装状态: {
      上装: slot(),
      下装: slot(),
      内衣: slot(),
      足部: slot(),
      饰品: {},
    },
    身体部位物理状态: {},
    数值: {
      好感度: 0,
      发情值: 0,
      性癖开发值: 0,
    },
    身份标签: {},
    当前综合生理描述: '',
  };
  
  bumpUpdateTime();
}

export async function submitAddCharacter(name: string, description: string): Promise<string> {
  const n = name.trim();
  if (!n) {
    toastr.warning('请输入角色名字');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const message = formatAddCharacterMessage(n, description);
  addCharacterToVariables(n, description);
  return message;
}

// ---------- 编辑角色基础信息 ----------

export function formatEditCharacterBasicMessage(payload: {
  characterId: string;
  name?: string;
  age?: string;
  height?: string;
  weight?: string;
  physique?: string;
  affection?: number;
  lust?: number;
  fetish?: number;
  [key: string]: any;
}): string {
  const lines = ['[编辑角色基础信息]', `角色ID：${payload.characterId}`];
  if (payload.name != null) lines.push(`姓名：${payload.name}`);
  if (payload.age != null) lines.push(`年龄：${payload.age}`);
  if (payload.height != null) lines.push(`身高：${payload.height}`);
  if (payload.weight != null) lines.push(`体重：${payload.weight}`);
  if (payload.threeSize != null) lines.push(`三围：${payload.threeSize}`);
  if (payload.physique != null) lines.push(`体质：${payload.physique}`);
  if (payload.affection != null) lines.push(`好感度：${payload.affection}`);
  if (payload.lust != null) lines.push(`发情值：${payload.lust}`);
  if (payload.fetish != null) lines.push(`性癖开发值：${payload.fetish}`);
  return lines.join('\n');
}

export function updateCharacterInVariables(characterId: string, updates: Partial<CharacterData>): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  if (updates.name != null) char.姓名 = updates.name;
  if (updates.description != null) char.描写 = updates.description;

  if (updates.basic) {
    const b = updates.basic;
    if (b.age != null) char.身体信息.年龄 = parseBodyNumber(b.age, char.身体信息.年龄);
    if (b.height != null) char.身体信息.身高 = parseBodyNumber(b.height, char.身体信息.身高);
    if (b.weight != null) char.身体信息.体重 = parseBodyNumber(b.weight, char.身体信息.体重);
    if (b.threeSize != null) char.身体信息.三围 = String(b.threeSize);
    if (b.physique != null) char.身体信息.体质特征 = String(b.physique);
  }

  if (updates.stats) {
    if (typeof updates.stats.affection === 'number') char.数值.好感度 = updates.stats.affection;
    if (typeof updates.stats.lust === 'number') char.数值.发情值 = updates.stats.lust;
    if (typeof updates.stats.fetish === 'number') char.数值.性癖开发值 = updates.stats.fetish;
  }

  bumpUpdateTime();
}

export async function submitEditCharacterBasic(
  characterId: string,
  payload: Record<string, string | number | undefined>,
): Promise<string> {
  if (!tryRulesMvuWritable()) return '';
  const message = formatEditCharacterBasicMessage({ characterId, ...payload });

  const stats: Record<string, number> = {};
  if (typeof payload.affection === 'number') stats.affection = payload.affection;
  if (typeof payload.lust === 'number') stats.lust = payload.lust;
  if (typeof payload.fetish === 'number') stats.fetish = payload.fetish;

  const basic: CharacterData['basic'] = {
    age: payload.age as string | undefined,
    height: payload.height as string | undefined,
    weight: payload.weight as string | undefined,
    threeSize: payload.threeSize as string | undefined,
    physique: payload.physique as string | undefined,
  };

  updateCharacterInVariables(
    characterId,
    {
      name: (payload.name as string | undefined) ?? undefined,
      basic,
      stats: Object.keys(stats).length ? (stats as Record<string, number>) : undefined,
    } as Partial<CharacterData>,
  );
  return message;
}

/** 编辑角色头像：独立子系统，仅写浏览器 localStorage + 父窗口转发；不读、不写 MVU 中的头像字段；不生成对话框文案 */
export async function submitEditCharacterAvatar(
  characterId: string,
  avatarUrl: string,
  displayName?: string | null,
): Promise<string> {
  const { setCharacterAvatarOverride } = await import('../../shared/phoneCharacterAvatarStorage');
  const u = String(avatarUrl ?? '').trim();
  const dn = String(displayName ?? '').trim();
  setCharacterAvatarOverride(characterId, u, dn ? { displayName: dn } : undefined);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (globalThis as any).toastr;
    if (t?.success) {
      t.success(!u ? '已清除本机头像覆盖' : '头像已保存（本机并与小手机同步）');
    }
  } catch {
    /* */
  }
  return '';
}

// ---------- 编辑角色心理/性癖/敏感点开发 ----------

function formatTagMapLine(label: string, rec: Record<string, string> | undefined): string | null {
  if (rec == null || Object.keys(rec).length === 0) return null;
  const s = Object.entries(rec)
    .map(([k, v]) => (String(v).trim() ? `${k}：${v}` : k))
    .join('、');
  return `${label}：${s}`;
}

function formatFetishPsychLine(rec: Record<string, FetishEntryZh> | undefined): string | null {
  if (rec == null || Object.keys(rec).length === 0) return null;
  const s = Object.entries(rec)
    .map(([k, o]) => {
      const d = o.细节描述.trim();
      return d ? `${k}：Lv.${o.等级} ${d}` : `${k}：Lv.${o.等级}`;
    })
    .join('、');
  return `性癖：${s}`;
}

function formatSensitivePsychLine(rec: Record<string, SensitiveEntryZh> | undefined): string | null {
  if (rec == null || Object.keys(rec).length === 0) return null;
  const s = Object.entries(rec)
    .map(([k, o]) => {
      const r = o.生理反应.trim();
      return r ? `${k}：Lv.${o.敏感等级} ${r}` : `${k}：Lv.${o.敏感等级}`;
    })
    .join('、');
  return `敏感点开发：${s}`;
}

export function formatEditCharacterPsychMessage(payload: {
  characterId: string;
  当前内心想法?: string;
  性格?: Record<string, string>;
  性癖?: Record<string, FetishEntryZh>;
  敏感点开发?: Record<string, SensitiveEntryZh>;
  隐藏性癖?: string;
}): string {
  const lines = ['[编辑角色心理与性癖]', `角色ID：${payload.characterId}`];
  if (payload.当前内心想法 != null) lines.push(`当前内心想法：${String(payload.当前内心想法)}`);
  const t1 = formatTagMapLine('性格', payload.性格);
  if (t1) lines.push(t1);
  const t2 = formatFetishPsychLine(payload.性癖);
  if (t2) lines.push(t2);
  const t3 = formatSensitivePsychLine(payload.敏感点开发);
  if (t3) lines.push(t3);
  if (payload.隐藏性癖 != null) lines.push(`隐藏性癖：${String(payload.隐藏性癖)}`);
  return lines.join('\n');
}

export function updateCharacterPsychInChineseVariables(
  characterId: string,
  updates: {
    当前内心想法?: string;
    性格?: Record<string, string>;
    性癖?: Record<string, FetishEntryZh>;
    敏感点开发?: Record<string, SensitiveEntryZh>;
    隐藏性癖?: string;
  },
): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  if (updates.当前内心想法 != null) char.当前内心想法 = updates.当前内心想法;
  if (updates.性格 != null) char.性格 = updates.性格;
  if (updates.性癖 != null) char.性癖 = updates.性癖;
  if (updates.敏感点开发 != null) char.敏感点开发 = updates.敏感点开发;
  if (updates.隐藏性癖 != null) char.隐藏性癖 = updates.隐藏性癖;

  bumpUpdateTime();
}

export async function submitEditCharacterPsych(
  characterId: string,
  payload: {
    thought?: string;
    traitsText?: string;
    fetishesText?: string;
    sensitivePartsText?: string;
    hiddenFetish?: string;
  },
): Promise<string> {
  if (!tryRulesMvuWritable()) return '';
  const updates: {
    当前内心想法?: string;
    性格?: Record<string, string>;
    性癖?: Record<string, FetishEntryZh>;
    敏感点开发?: Record<string, SensitiveEntryZh>;
    隐藏性癖?: string;
  } = {};

  if (payload.thought !== undefined) updates.当前内心想法 = String(payload.thought ?? '');
  if (payload.traitsText !== undefined) updates.性格 = parseEditableTextToTagMap(payload.traitsText ?? '');
  if (payload.fetishesText !== undefined) updates.性癖 = parseEditableTextToFetishRecord(payload.fetishesText ?? '');
  if (payload.sensitivePartsText !== undefined) {
    updates.敏感点开发 = parseEditableTextToSensitiveRecord(payload.sensitivePartsText ?? '');
  }
  if (payload.hiddenFetish !== undefined) updates.隐藏性癖 = String(payload.hiddenFetish ?? '');

  const message = formatEditCharacterPsychMessage({ characterId, ...updates });
  updateCharacterPsychInChineseVariables(characterId, updates);
  return message;
}

// ---------- 编辑角色性癖详情 ----------

export interface FetishDetailUpdate {
  /** 性癖名称 */
  name: string;
  /** 等级（1-10） */
  level?: number;
  /** 细节描述 */
  description?: string;
  /** 自我合理化 */
  justification?: string;
}

export interface SensitivePartDetailUpdate {
  /** 部位名称 */
  name: string;
  /** 敏感等级（1-10） */
  level?: number;
  /** 生理反应 */
  reaction?: string;
  /** 开发细节 */
  devDetails?: string;
}

/**
 * 更新角色的性癖详情
 */
export function updateCharacterFetishDetails(
  characterId: string,
  updates: FetishDetailUpdate[],
): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  // 确保性癖对象存在
  if (!char.性癖) char.性癖 = {};
  if (!char.性癖) char.性癖 = {};

  for (const update of updates) {
    const existing = char.性癖[update.name];
    char.性癖[update.name] = {
      等级: update.level ?? (existing?.等级 ?? existing?.level ?? 1),
      细节描述: update.description ?? (existing?.细节描述 ?? existing?.description ?? ''),
      自我合理化: update.justification ?? (existing?.自我合理化 ?? existing?.justification ?? ''),
    };
  }

  bumpUpdateTime();
}

/**
 * 更新角色的敏感点开发详情（MVU 键名「敏感点开发」；读侧仍合并旧键「敏感部位」）
 */
export function updateCharacterSensitivePartDetails(
  characterId: string,
  updates: SensitivePartDetailUpdate[],
): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  if (!char.敏感点开发) char.敏感点开发 = {};

  for (const update of updates) {
    const existing = char.敏感点开发[update.name];
    char.敏感点开发[update.name] = {
      敏感等级: update.level ?? (existing?.敏感等级 ?? existing?.level ?? 1),
      生理反应: update.reaction ?? (existing?.生理反应 ?? existing?.reaction ?? ''),
      开发细节: update.devDetails ?? (existing?.开发细节 ?? existing?.devDetails ?? ''),
    };
  }

  bumpUpdateTime();
}

/**
 * 更新角色的身份标签
 */
export function updateCharacterIdentityTags(
  characterId: string,
  tags: Record<string, string>,
): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  char.身份标签 = { ...tags };

  bumpUpdateTime();
}

/** 新建角色 / 弹窗重置用：完整默认「服装状态」 */
export function defaultEmptyClothingState(): ClothingStateZh {
  const s: ClothingSlotZh = { 名称: '', 状态: '正常', 描述: '' };
  return {
    上装: { ...s },
    下装: { ...s },
    内衣: { ...s },
    足部: { ...s },
    饰品: {},
  };
}

function mergeClothingState(incoming: ClothingStateZh): ClothingStateZh {
  const base = defaultEmptyClothingState();
  const slot = (a: ClothingSlotZh, b?: ClothingSlotZh): ClothingSlotZh => ({
    名称: String(b?.名称 ?? a.名称 ?? ''),
    状态: String(b?.状态 ?? a.状态 ?? '正常'),
    描述: String(b?.描述 ?? a.描述 ?? ''),
  });
  const jewelry = { ...base.饰品, ...(incoming.饰品 && typeof incoming.饰品 === 'object' ? incoming.饰品 : {}) };
  return {
    上装: slot(base.上装!, incoming.上装),
    下装: slot(base.下装!, incoming.下装),
    内衣: slot(base.内衣!, incoming.内衣),
    足部: slot(base.足部!, incoming.足部),
    饰品: jewelry,
  };
}

export function updateCharacterAppearanceInVariables(
  characterId: string,
  patch: { 服装状态?: ClothingStateZh; 身体部位物理状态?: Record<string, BodyPartPhysicsZh> },
): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  if (patch.服装状态 != null) {
    char.服装状态 = mergeClothingState(patch.服装状态);
  }
  if (patch.身体部位物理状态 != null) {
    const out: Record<string, BodyPartPhysicsZh> = {};
    for (const [k, v] of Object.entries(patch.身体部位物理状态)) {
      const key = String(k).trim();
      if (!key) continue;
      out[key] = {
        外观描述: String(v?.外观描述 ?? ''),
        当前状态: String(v?.当前状态 ?? ''),
      };
    }
    char.身体部位物理状态 = out;
  }

  bumpUpdateTime();
}

export function formatEditCharacterAppearanceMessage(
  characterId: string,
  服装状态: ClothingStateZh,
  身体部位物理状态: Record<string, BodyPartPhysicsZh>,
): string {
  const lines = ['[编辑角色外观与身体状态]', `角色ID：${characterId}`];
  const keys = ['上装', '下装', '内衣', '足部'] as const;
  for (const k of keys) {
    const x = 服装状态[k];
    if (x && (String(x.名称 || '').trim() || String(x.状态 || '').trim() || String(x.描述 || '').trim())) {
      lines.push(`${k}：${x.名称 || '—'} / ${x.状态 || '—'} / ${x.描述 || ''}`.trim());
    }
  }
  const acc = 服装状态.饰品;
  if (acc && typeof acc === 'object') {
    const entries = Object.entries(acc).filter(([n]) => String(n).trim());
    if (entries.length > 0) {
      lines.push(
        `饰品：${entries.map(([n, o]) => `${n}（${o?.状态 ?? ''}）`).join('；')}`,
      );
    }
  }
  for (const [part, o] of Object.entries(身体部位物理状态)) {
    const p = String(part).trim();
    if (!p) continue;
    if (String(o?.外观描述 || '').trim() || String(o?.当前状态 || '').trim()) {
      lines.push(`部位「${p}」：外观 ${o?.外观描述 ?? ''}；状态 ${o?.当前状态 ?? ''}`);
    }
  }
  return lines.join('\n');
}

export async function submitEditCharacterAppearance(
  characterId: string,
  payload: { 服装状态: ClothingStateZh; 身体部位物理状态: Record<string, BodyPartPhysicsZh> },
): Promise<string> {
  if (!tryRulesMvuWritable()) return '';
  const message = formatEditCharacterAppearanceMessage(
    characterId,
    payload.服装状态,
    payload.身体部位物理状态,
  );
  updateCharacterAppearanceInVariables(characterId, payload);
  return message;
}

/** 从 MVU 原始「服装状态」填弹窗（缺项补默认） */
export function clothingStateFromMvuRaw(raw: unknown): ClothingStateZh {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    return mergeClothingState(raw as ClothingStateZh);
  }
  return defaultEmptyClothingState();
}

/** 从 MVU「身体部位物理状态」生成弹窗行列表 */
export function bodyPartRowsFromMvuRaw(raw: unknown): Array<{ key: string; 外观描述: string; 当前状态: string }> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .map(([key, v]) => {
      const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
      return {
        key: String(key),
        外观描述: String(o.外观描述 ?? ''),
        当前状态: String(o.当前状态 ?? ''),
      };
    })
    .filter(r => String(r.key).trim().length > 0);
}

export function jewelryRowsFromClothingState(c: ClothingStateZh): Array<{ name: string; 状态: string; 描述: string }> {
  const acc = c.饰品;
  if (acc == null || typeof acc !== 'object') return [];
  return Object.entries(acc).map(([name, o]) => {
    const row = o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    return {
      name: String(name),
      状态: String(row.状态 ?? '正常'),
      描述: String(row.描述 ?? ''),
    };
  });
}

/** 将饰品行写回「服装状态.饰品」 */
export function applyJewelryRowsToClothing(
  clothing: ClothingStateZh,
  rows: Array<{ name: string; 状态: string; 描述: string }>,
): ClothingStateZh {
  const jewelry: Record<string, { 状态: string; 描述: string }> = {};
  for (const row of rows) {
    const n = String(row.name ?? '').trim();
    if (!n) continue;
    jewelry[n] = {
      状态: String(row.状态 ?? '正常'),
      描述: String(row.描述 ?? ''),
    };
  }
  return {
    ...clothing,
    饰品: jewelry,
  };
}

/**
 * 格式化性癖详情更新消息
 */
export function formatFetishDetailMessage(characterId: string, updates: FetishDetailUpdate[]): string {
  const lines = ['[编辑性癖详情]', `角色ID：${characterId}`];
  for (const u of updates) {
    const parts = [u.name];
    if (u.level != null) parts.push(`等级${u.level}`);
    if (u.description) parts.push(`「${u.description}」`);
    if (u.justification) parts.push(`（自我合理化：${u.justification}）`);
    lines.push(`- ${parts.join('：')}`);
  }
  return lines.join('\n');
}

/**
 * 格式化敏感点开发详情更新消息
 */
export function formatSensitivePartDetailMessage(characterId: string, updates: SensitivePartDetailUpdate[]): string {
  const lines = ['[编辑敏感点开发详情]', `角色ID：${characterId}`];
  for (const u of updates) {
    const parts = [u.name];
    if (u.level != null) parts.push(`敏感等级${u.level}`);
    if (u.reaction) parts.push(`反应：${u.reaction}`);
    if (u.devDetails) parts.push(`开发：${u.devDetails}`);
    lines.push(`- ${parts.join('：')}`);
  }
  return lines.join('\n');
}

/**
 * 格式化身份标签更新消息
 */
export function formatIdentityTagsMessage(characterId: string, tags: Record<string, string>): string {
  const lines = ['[编辑身份标签]', `角色ID：${characterId}`];
  for (const [category, value] of Object.entries(tags)) {
    lines.push(`${category}：${value}`);
  }
  return lines.join('\n');
}

// ---------- 世界规则 ----------

export function formatWorldRuleMessage(type: 'add' | 'edit' | 'archive' | 'restore', name: string, detail?: string): string {
  if (type === 'archive') return `[归档世界规则]\n名称：${name}`;
  if (type === 'restore') return `[复原世界规则]\n名称：${name}`;
  const prefix = type === 'add' ? '[新增世界规则]' : '[编辑世界规则]';
  return `${prefix}\n名称：${name}\n细节：${detail ?? ''}`;
}

export function addWorldRuleToVariables(title: string, desc: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  store.data.世界规则[title] = {
    名称: title,
    效果描述: desc,
    状态: '生效中',
    细分规则: {},
    适用对象: '',
    标记: '世界级',
  };
  bumpUpdateTime();
}

export function updateWorldRuleInVariables(idOrTitle: string, updates: Partial<RuleData>): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const rules = store.data.世界规则;
  
  // 查找规则键
  let key = idOrTitle;
  if (!rules[idOrTitle] && idOrTitle.startsWith('world-')) {
    const t = idOrTitle.slice('world-'.length);
    if (rules[t]) key = t;
  }
  
  if (!rules[key]) return;

  const cur = rules[key];
  const newTitle = updates.title?.trim();
  
  // 如果需要重命名
  if (newTitle && newTitle !== key) {
    delete rules[key];
    rules[newTitle] = {
      ...cur,
      名称: newTitle,
      效果描述: updates.desc ?? cur.效果描述,
      状态: enRuleStatusToZh(updates.status, cur.状态),
    };
  } else {
    cur.效果描述 = updates.desc ?? cur.效果描述;
    cur.状态 = enRuleStatusToZh(updates.status, cur.状态);
  }

  bumpUpdateTime();
}

export function archiveWorldRuleInVariables(idOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const rules = store.data.世界规则;
  
  let key = idOrTitle;
  if (!rules[idOrTitle] && idOrTitle.startsWith('world-')) {
    const t = idOrTitle.slice('world-'.length);
    if (rules[t]) key = t;
  }
  
  if (rules[key]) {
    rules[key].状态 = '已归档';
    bumpUpdateTime();
  }
}

export function restoreWorldRuleInVariables(idOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const rules = store.data.世界规则;
  
  let key = idOrTitle;
  if (!rules[idOrTitle] && idOrTitle.startsWith('world-')) {
    const t = idOrTitle.slice('world-'.length);
    if (rules[t]) key = t;
  }
  
  if (rules[key]) {
    rules[key].状态 = '生效中';
    bumpUpdateTime();
  }
}

export async function submitAddWorldRule(name: string, detail: string): Promise<string> {
  const n = name.trim();
  if (!n) {
    toastr.warning('请输入规则名称');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const message = formatWorldRuleMessage('add', n, detail.trim());
  addWorldRuleToVariables(n, detail.trim());

  // 异步触发世界大势生成（不阻塞主流程）
  setTimeout(() => {
    generateWorldTrend(n, 'world', detail.trim()).then((success) => {
      if (success) {
        toastr.success(`已生成世界大势说明：${n}`);
      }
    }).catch(console.error);
  }, 100);

  return message;
}

export async function submitEditWorldRule(idOrTitle: string, name: string, detail: string): Promise<string> {
  const n = name.trim();
  if (!n) {
    toastr.warning('请输入规则名称');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const message = formatWorldRuleMessage('edit', n, detail.trim());
  updateWorldRuleInVariables(idOrTitle, { title: n, desc: detail.trim() });

  // 异步触发世界大势生成（不阻塞主流程）
  setTimeout(() => {
    generateWorldTrend(n, 'world', detail.trim()).catch(console.error);
  }, 100);

  return message;
}

export async function submitArchiveWorldRule(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatWorldRuleMessage('archive', name);
  await sendToDialog(message);
  archiveWorldRuleInVariables(name);
  toastr.success(`已归档世界规则「${name}」并写入对话框`);
}

export async function submitRestoreWorldRule(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatWorldRuleMessage('restore', name);
  await sendToDialog(message);
  restoreWorldRuleInVariables(name);
  toastr.success(`已复原世界规则「${name}」并写入对话框`);
}

// ---------- 区域规则 ----------

export function formatRegionRuleMessage(
  type: 'add' | 'edit' | 'archive' | 'restore',
  regionName: string,
  detail?: string,
  /** 新增区域时可选：首条细分规则的名称（写入对话框摘要用） */
  ruleName?: string,
): string {
  if (type === 'archive') return `[归档区域规则]\n区域：${regionName}${detail ? `\n规则：${detail}` : ''}`;
  if (type === 'restore') return `[复原区域规则]\n区域：${regionName}${detail ? `\n规则：${detail}` : ''}`;
  const prefix = type === 'add' ? '[新增区域]' : '[编辑区域]';
  const rn = ruleName?.trim();
  if (rn) {
    return `${prefix}\n区域名称：${regionName}\n规则名字：${rn}\n规则细节：${detail ?? ''}`;
  }
  return `${prefix}\n区域名称：${regionName}\n规则细节：${detail ?? ''}`;
}

export function addRegionToVariables(name: string, detail: string, firstRuleTitle?: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  // 使用浅拷贝 + 替换整个对象的方式，确保响应式系统正确追踪
  const regions = { ...store.data.区域规则 };
  const trimmedTitle = firstRuleTitle?.trim() ?? '';
  const 细分规则 = trimmedTitle
    ? { [trimmedTitle]: { 描述: detail, 状态: '生效中' as const } }
    : {};
  regions[name] = {
    名称: name,
    效果描述: detail,
    状态: '生效中',
    细分规则,
    适用对象: '',
    标记: '',
  };
  store.data.区域规则 = regions;
  bumpUpdateTime();
}

export function updateRegionInVariables(idOrName: string, updates: Partial<RegionData>): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  // 使用浅拷贝 + 替换整个对象的方式，确保响应式系统正确追踪
  const regions = { ...store.data.区域规则 };
  
  let key = idOrName;
  if (!regions[idOrName] && idOrName.startsWith('region-')) {
    const n = idOrName.slice('region-'.length);
    if (regions[n]) key = n;
  }
  
  if (!regions[key]) return;

  const cur = regions[key];
  const newName = updates.name?.trim();
  
  if (newName && newName !== key) {
    delete regions[key];
    regions[newName] = {
      ...cur,
      名称: newName,
      效果描述: updates.description ?? cur.效果描述,
      状态: enRuleStatusToZh(updates.status, cur.状态),
    };
  } else {
    regions[key] = {
      ...cur,
      效果描述: updates.description ?? cur.效果描述,
      状态: enRuleStatusToZh(updates.status, cur.状态),
    };
  }
  
  store.data.区域规则 = regions;
  bumpUpdateTime();
}

export function archiveRegionInVariables(idOrName: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  // 使用浅拷贝 + 替换整个对象的方式，确保响应式系统正确追踪
  const regions = { ...store.data.区域规则 };
  
  let key = idOrName;
  if (!regions[idOrName] && idOrName.startsWith('region-')) {
    const n = idOrName.slice('region-'.length);
    if (regions[n]) key = n;
  }
  
  if (regions[key]) {
    regions[key] = { ...regions[key], 状态: '已归档' };
    store.data.区域规则 = regions;
    bumpUpdateTime();
  }
}

export function restoreRegionInVariables(idOrName: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  // 使用浅拷贝 + 替换整个对象的方式，确保响应式系统正确追踪
  const regions = { ...store.data.区域规则 };
  
  let key = idOrName;
  if (!regions[idOrName] && idOrName.startsWith('region-')) {
    const n = idOrName.slice('region-'.length);
    if (regions[n]) key = n;
  }
  
  if (regions[key]) {
    regions[key] = { ...regions[key], 状态: '生效中' };
    store.data.区域规则 = regions;
    bumpUpdateTime();
  }
}

export function addRegionalRuleToVariables(regionIdOrName: string, title: string, desc: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  // 使用浅拷贝 + 替换整个对象的方式，确保响应式系统正确追踪
  const regions = { ...store.data.区域规则 };
  
  let key = regionIdOrName;
  if (!regions[regionIdOrName] && regionIdOrName.startsWith('region-')) {
    const n = regionIdOrName.slice('region-'.length);
    if (regions[n]) key = n;
  }
  
  if (!regions[key]) return;

  // 更新区域及其细分规则
  const curRegion = regions[key];
  regions[key] = {
    ...curRegion,
    细分规则: {
      ...curRegion.细分规则,
      [title]: {
        描述: desc,
        状态: '生效中',
      },
    },
  };
  
  store.data.区域规则 = regions;
  bumpUpdateTime();
}

export function updateRegionalRuleInVariables(regionIdOrName: string, ruleIdOrTitle: string, updates: Partial<RuleData>): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  // 使用浅拷贝 + 替换整个对象的方式，确保响应式系统正确追踪
  const regions = { ...store.data.区域规则 };
  
  let regionKey = regionIdOrName;
  if (!regions[regionIdOrName] && regionIdOrName.startsWith('region-')) {
    const n = regionIdOrName.slice('region-'.length);
    if (regions[n]) regionKey = n;
  }
  
  if (!regions[regionKey]) return;
  
  const region = { ...regions[regionKey] };
  const subRules = { ...region.细分规则 };
  
  // 查找子规则键
  let subKey = ruleIdOrTitle;
  const prefix = `regional-${regionKey}-`;
  if (!subRules[ruleIdOrTitle]) {
    if (ruleIdOrTitle.startsWith(prefix)) {
      const k = ruleIdOrTitle.slice(prefix.length);
      if (subRules[k]) subKey = k;
    }
  }
  
  if (!subRules[subKey]) return;

  const cur = subRules[subKey];
  
  if (updates.title && updates.title !== subKey) {
    delete subRules[subKey];
    subRules[updates.title] = {
      ...cur,
      描述: updates.desc ?? cur.描述,
      状态: enRuleStatusToZh(updates.status, cur.状态),
    };
  } else {
    subRules[subKey] = {
      ...cur,
      描述: updates.desc ?? cur.描述,
      状态: enRuleStatusToZh(updates.status, cur.状态),
    };
  }
  
  // 替换区域及其细分规则
  regions[regionKey] = {
    ...region,
    细分规则: subRules,
  };
  store.data.区域规则 = regions;
  bumpUpdateTime();
}

export function archiveRegionalRuleInVariables(regionIdOrName: string, ruleIdOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  // 使用浅拷贝 + 替换整个对象的方式，确保响应式系统正确追踪
  const regions = { ...store.data.区域规则 };
  
  let regionKey = regionIdOrName;
  if (!regions[regionIdOrName] && regionIdOrName.startsWith('region-')) {
    const n = regionIdOrName.slice('region-'.length);
    if (regions[n]) regionKey = n;
  }
  
  if (!regions[regionKey]) return;
  
  const region = { ...regions[regionKey] };
  const subRules = { ...region.细分规则 };
  
  let subKey = ruleIdOrTitle;
  const prefix = `regional-${regionKey}-`;
  if (!subRules[ruleIdOrTitle]) {
    if (ruleIdOrTitle.startsWith(prefix)) {
      const k = ruleIdOrTitle.slice(prefix.length);
      if (subRules[k]) subKey = k;
    }
  }
  
  if (subRules[subKey]) {
    subRules[subKey] = { ...subRules[subKey], 状态: '已归档' };
    regions[regionKey] = {
      ...region,
      细分规则: subRules,
    };
    store.data.区域规则 = regions;
    bumpUpdateTime();
  }
}

export function restoreRegionalRuleInVariables(regionIdOrName: string, ruleIdOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  // 使用浅拷贝 + 替换整个对象的方式，确保响应式系统正确追踪
  const regions = { ...store.data.区域规则 };
  
  let regionKey = regionIdOrName;
  if (!regions[regionIdOrName] && regionIdOrName.startsWith('region-')) {
    const n = regionIdOrName.slice('region-'.length);
    if (regions[n]) regionKey = n;
  }
  
  if (!regions[regionKey]) return;
  
  const region = { ...regions[regionKey] };
  const subRules = { ...region.细分规则 };
  
  let subKey = ruleIdOrTitle;
  const prefix = `regional-${regionKey}-`;
  if (!subRules[ruleIdOrTitle]) {
    if (ruleIdOrTitle.startsWith(prefix)) {
      const k = ruleIdOrTitle.slice(prefix.length);
      if (subRules[k]) subKey = k;
    }
  }
  
  if (subRules[subKey]) {
    subRules[subKey] = { ...subRules[subKey], 状态: '生效中' };
    regions[regionKey] = {
      ...region,
      细分规则: subRules,
    };
    store.data.区域规则 = regions;
    bumpUpdateTime();
  }
}

export async function submitAddRegion(name: string, detail: string, firstRuleName?: string): Promise<string> {
  const n = name.trim();
  if (!n) {
    toastr.warning('请输入区域名称');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const ruleTitle = (firstRuleName ?? '').trim();
  const message = formatRegionRuleMessage('add', n, detail.trim(), ruleTitle || undefined);
  addRegionToVariables(n, detail.trim(), ruleTitle || undefined);

  // 异步触发世界大势生成（区域级别）
  setTimeout(() => {
    generateWorldTrend(n, 'regional', detail.trim(), [n]).then((success) => {
      if (success) {
        toastr.success(`已生成世界大势说明：${n}`);
      }
    }).catch(console.error);
  }, 100);

  return message;
}

export async function submitAddRegionalRule(regionIdOrName: string, regionName: string, ruleName: string, ruleDetail: string): Promise<string> {
  const n = ruleName.trim();
  if (!n) {
    toastr.warning('请输入规则名称');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const detail = ruleDetail.trim();
  const message = `[新增区域规则]\n区域：${regionName}\n规则：${n}\n细节：${detail}`;
  addRegionalRuleToVariables(regionIdOrName, n, detail);

  // 异步触发世界大势生成（区域级别）
  setTimeout(() => {
    generateWorldTrend(n, 'regional', detail, [regionName]).then((success) => {
      if (success) {
        toastr.success(`已生成世界大势说明：${n}`);
      }
    }).catch(console.error);
  }, 100);

  return message;
}

export async function submitEditRegionalRule(
  regionIdOrName: string,
  regionName: string,
  ruleIdOrTitle: string,
  ruleName: string,
  ruleDetail: string,
): Promise<string> {
  const n = ruleName.trim();
  if (!n) {
    toastr.warning('请输入规则名称');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const detail = ruleDetail.trim();
  const message = `[编辑区域规则]\n区域：${regionName}\n规则：${n}\n细节：${detail}`;
  updateRegionalRuleInVariables(regionIdOrName, ruleIdOrTitle, { title: n, desc: detail });

  // 异步触发世界大势生成（区域级别）
  setTimeout(() => {
    generateWorldTrend(n, 'regional', detail, [regionName]).catch(console.error);
  }, 100);

  return message;
}

export async function submitEditRegion(idOrName: string, name: string, detail: string): Promise<string> {
  const n = name.trim();
  if (!n) {
    toastr.warning('请输入区域名称');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const message = formatRegionRuleMessage('edit', n, detail.trim());
  updateRegionInVariables(idOrName, { name: n, description: detail.trim() });

  // 异步触发世界大势生成（区域级别）
  setTimeout(() => {
    generateWorldTrend(n, 'regional', detail.trim(), [n]).catch(console.error);
  }, 100);

  return message;
}

export async function submitArchiveRegion(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatRegionRuleMessage('archive', name);
  await sendToDialog(message);
  archiveRegionInVariables(name);
  toastr.success(`已归档区域「${name}」并写入对话框`);
}

export async function submitRestoreRegion(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatRegionRuleMessage('restore', name);
  await sendToDialog(message);
  restoreRegionInVariables(name);
  toastr.success(`已复原区域「${name}」并写入对话框`);
}

export async function submitArchiveRegionalRule(regionName: string, ruleIdOrTitle: string, ruleSummary?: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatRegionRuleMessage('archive', regionName, ruleSummary ?? ruleIdOrTitle);
  await sendToDialog(message);
  archiveRegionalRuleInVariables(regionName, ruleIdOrTitle);
  toastr.success(`已归档「${regionName}」下规则${ruleSummary ? `「${ruleSummary}」` : ''}并写入对话框`);
}

export async function submitRestoreRegionalRule(regionName: string, ruleIdOrTitle: string, ruleSummary?: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatRegionRuleMessage('restore', regionName, ruleSummary ?? ruleIdOrTitle);
  await sendToDialog(message);
  restoreRegionalRuleInVariables(regionName, ruleIdOrTitle);
  toastr.success(`已复原「${regionName}」下规则${ruleSummary ? `「${ruleSummary}」` : ''}并写入对话框`);
}

// ---------- 个人规则 ----------

export function formatPersonalRuleMessage(type: 'add' | 'edit' | 'archive' | 'restore', characterName: string, detail?: string): string {
  if (type === 'archive') return `[归档个人规则]\n对象：${characterName}${detail ? `\n规则：${detail}` : ''}`;
  if (type === 'restore') return `[复原个人规则]\n对象：${characterName}${detail ? `\n规则：${detail}` : ''}`;
  const prefix = type === 'add' ? '[新增个人规则]' : '[编辑个人规则]';
  return `${prefix}\n对象：${characterName}\n规则细节：${detail ?? ''}`;
}

export function addPersonalRuleToVariables(characterName: string, detail: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const key = `PR-${Date.now()}`;
  const c = characterName.trim();
  store.data.个人规则[key] = {
    名称: c,
    适用对象: c,
    效果描述: detail.trim(),
    状态: '生效中',
    细分规则: {},
    标记: '个人级',
  };
  bumpUpdateTime();
}

export function updatePersonalRuleInVariables(idOrTitle: string, updates: Partial<RuleData>): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const rules = store.data.个人规则;
  
  let key = idOrTitle;
  if (!rules[idOrTitle] && idOrTitle.startsWith('personal-')) {
    const k = idOrTitle.slice('personal-'.length);
    if (rules[k]) key = k;
  }
  
  if (!rules[key]) return;

  const cur = rules[key];
  
  if (updates.title) {
    cur.名称 = updates.title;
    cur.适用对象 = updates.title;
  }
  if (updates.desc) cur.效果描述 = updates.desc;
  cur.状态 = enRuleStatusToZh(updates.status, cur.状态);

  bumpUpdateTime();
}

export function archivePersonalRuleInVariables(idOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const rules = store.data.个人规则;
  
  let key = idOrTitle;
  if (!rules[idOrTitle] && idOrTitle.startsWith('personal-')) {
    const k = idOrTitle.slice('personal-'.length);
    if (rules[k]) key = k;
  }
  
  if (rules[key]) {
    rules[key].状态 = '已归档';
    bumpUpdateTime();
  }
}

export function restorePersonalRuleInVariables(idOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const rules = store.data.个人规则;
  
  let key = idOrTitle;
  if (!rules[idOrTitle] && idOrTitle.startsWith('personal-')) {
    const k = idOrTitle.slice('personal-'.length);
    if (rules[k]) key = k;
  }
  
  if (rules[key]) {
    rules[key].状态 = '生效中';
    bumpUpdateTime();
  }
}

export async function submitAddPersonalRule(characterName: string, detail: string): Promise<string> {
  const c = characterName.trim();
  if (!c) {
    toastr.warning('请输入角色/对象名称');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const message = formatPersonalRuleMessage('add', c, detail.trim());
  addPersonalRuleToVariables(c, detail.trim());
  markResidentLifePendingPersonalRule();

  return message;
}

export async function submitEditPersonalRule(idOrTitle: string, characterName: string, detail: string): Promise<string> {
  const c = characterName.trim();
  if (!c) {
    toastr.warning('请输入角色/对象名称');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const message = formatPersonalRuleMessage('edit', c, detail.trim());
  updatePersonalRuleInVariables(idOrTitle, { title: c, desc: detail.trim() });
  markResidentLifePendingPersonalRule();

  return message;
}

export async function submitArchivePersonalRule(idOrTitle: string, characterName?: string, ruleSummary?: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const label = characterName ?? idOrTitle;
  const message = formatPersonalRuleMessage('archive', label, ruleSummary);
  await sendToDialog(message);
  archivePersonalRuleInVariables(idOrTitle);
  markResidentLifePendingPersonalRule();
  toastr.success(`已归档「${label}」${ruleSummary ? `（${ruleSummary}）` : ''}并写入对话框`);
}

export async function submitRestorePersonalRule(idOrTitle: string, characterName?: string, ruleSummary?: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const label = characterName ?? idOrTitle;
  const message = formatPersonalRuleMessage('restore', label, ruleSummary);
  await sendToDialog(message);
  restorePersonalRuleInVariables(idOrTitle);
  markResidentLifePendingPersonalRule();
  toastr.success(`已复原「${label}」${ruleSummary ? `（${ruleSummary}）` : ''}并写入对话框`);
}

// ---------- 世界书同步 ----------

/**
 * 将当前回合的剧情摘要同步到世界书「编年史」条目
 * 由 App.vue 发送消息后调用，也由小手机壳的 REQUEST_TRIGGER_WB_SYNC 消息路由触发
 *
 * 流程：
 * 1. 从最新消息楼层读取 <sum> 标签内容（编年史Updater 已封装此逻辑）
 * 2. 读取 <maintext> 最近正文片段（用于生成更丰富的摘要）
 * 3. 调用编年史更新函数写入世界书
 */
export async function syncGameStoryToWorldbook(): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  try {
    const { checkAndUpdateChronicle } = await import('./chronicleUpdater');
    const success = await checkAndUpdateChronicle();
    if (success) {
      console.log('✅ [dialogAndVariable] 剧情摘要已同步到世界书「编年史」');
    } else {
      console.warn('⚠️ [dialogAndVariable] 剧情摘要同步失败（可能没有 <sum> 内容）');
    }
  } catch (e) {
    console.warn('⚠️ [dialogAndVariable] 同步剧情到世界书失败:', e);
  }
}

// ---------- 删除角色 ----------

/**
 * 格式化删除角色消息
 */
export function formatDeleteCharacterMessage(characterId: string, characterName: string): string {
  return `[删除角色]\n角色ID：${characterId}\n姓名：${characterName}`;
}

/**
 * 从变量中删除角色
 * 同时删除与该角色相关的个人规则和头像缓存
 */
export function deleteCharacterFromVariables(characterId: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();

  // 获取角色名称（用于匹配个人规则）
  const char = store.data.角色档案[characterId];
  if (!char) return;

  const characterName = char.姓名 || characterId;

  // 1. 删除角色档案
  delete store.data.角色档案[characterId];

  // 2. 删除与该角色相关的个人规则（通过适用对象匹配）
  const personalRules = store.data.个人规则 || {};
  const rulesToDelete: string[] = [];

  for (const [ruleId, rule] of Object.entries(personalRules)) {
    if (rule.适用对象 === characterId || rule.适用对象 === characterName) {
      rulesToDelete.push(ruleId);
    }
  }

  for (const ruleId of rulesToDelete) {
    delete personalRules[ruleId];
  }

  // 3. 删除头像缓存
  const { setCharacterAvatarOverride } = require('../../shared/phoneCharacterAvatarStorage');
  setCharacterAvatarOverride(characterId, '');
  // 同时清除同名键的头像缓存
  if (characterName && characterName !== characterId) {
    const { normalizeCharacterNameForAvatar } = require('../../shared/phoneCharacterAvatarStorage');
    const nameKey = `__byname__:${normalizeCharacterNameForAvatar(characterName)}`;
    setCharacterAvatarOverride(nameKey, '');
  }

  bumpUpdateTime();
}

/**
 * 提交删除角色（包含消息格式化）
 */
export async function submitDeleteCharacter(characterId: string, characterName: string): Promise<string> {
  if (!tryRulesMvuWritable()) return '';
  const message = formatDeleteCharacterMessage(characterId, characterName);
  deleteCharacterFromVariables(characterId);
  toastr.success(`已删除角色「${characterName}」及相关个人规则`);
  return message;
}
