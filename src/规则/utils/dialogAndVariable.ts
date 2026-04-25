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
  ClothingBodyGarmentEditRow,
  ClothingBodyGarmentZh,
  ClothingBodySlotKeyZh,
  ClothingStateZh,
  JewelryEditRow,
  JewelryItemZh,
  RegionData,
  RuleData,
} from '../types';
import {
  mergeBodySlotRecords,
  normalizeClothingBodySlotRecord,
  normalize服装状态Raw,
} from './clothingStateNormalize';
import { CLOTHING_BODY_SLOT_KEYS } from '../types';
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
import { allocateNextChrId } from './chrId';
import { getOtherSettings } from './otherSettings';
import { appendStagingSummaryForNextPendingUvBlock } from './pendingUpdateVariableQueue';

/**
 * 将文本写入前端输入区（经 `th:copy-to-input` → App `copyToInput`）。
 * 当「修改是否写入对话框」关闭时：不触发写入输入框，仅把说明并入待发 `<UpdateVariable>` 摘要（与发送时变量块合并）。
 * @param bypassCopyToInputGate 为 true 时忽略上述开关（例如恢复误删的用户发言，须仍填入输入框）。
 * @param opts.suppressSuccessToast 为 true 时由 `copyToInput` 不弹出「已复制」类成功 toastr（调用方自行提示）。
 */
export async function sendToDialog(
  message: string,
  bypassCopyToInputGate = false,
  opts?: { suppressSuccessToast?: boolean },
): Promise<void> {
  const msg = String(message ?? '').trim();
  if (!msg) return;

  if (!bypassCopyToInputGate && getOtherSettings().copyStagingChangeHintsToInput === false) {
    appendStagingSummaryForNextPendingUvBlock(msg);
    console.info(
      '✅ [dialogAndVariable] 修改说明未写入输入框，已并入待发变量块摘要:',
      msg.substring(0, 80) + (msg.length > 80 ? '...' : ''),
    );
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent('th:copy-to-input', {
        detail: {
          message: msg,
          bypassVariableHintGate: bypassCopyToInputGate,
          suppressSuccessToast: opts?.suppressSuccessToast === true,
        },
      }),
    );
    console.log('✅ [dialogAndVariable] 已写入前端对话框输入区:', msg.substring(0, 80) + (msg.length > 80 ? '...' : ''));
  } catch (e) {
    console.warn('⚠️ [dialogAndVariable] 写入前端对话框输入区失败:', e);
  }
}

function deliveryHintForToast(): string {
  return getOtherSettings().copyStagingChangeHintsToInput !== false
    ? '并写入对话框'
    : '；说明将在发送时并入变量块';
}

/**
 * 写入 MVU `元信息.世界类型` / `元信息.世界简介`（与 schema 截断规则一致）
 */
export function updateMetaWorldInfo(世界类型: string, 世界简介: string): void {
  if (!tryRulesMvuWritable()) return;
  const store = useDataStore();
  const t = String(世界类型 ?? '')
    .trim()
    .slice(0, 64);
  const wType = t || '现代';
  const intro = String(世界简介 ?? '').slice(0, 2000);
  const root = store.data as Record<string, unknown>;
  if (!root.元信息 || typeof root.元信息 !== 'object' || Array.isArray(root.元信息)) {
    root.元信息 = {};
  }
  const meta = root.元信息 as Record<string, unknown>;
  meta.世界类型 = wType;
  meta.世界简介 = intro;
  meta.最近更新时间 = Date.now();
  bumpUpdateTime();
}

/** 与「其他规则」一致：可追加进输入框或待发变量块摘要的说明 */
export function formatMetaWorldInfoMessage(世界类型: string, 世界简介: string): string {
  const t = String(世界类型 ?? '').trim().slice(0, 64) || '现代';
  const i = String(世界简介 ?? '').slice(0, 2000);
  return `【元信息】\n世界类型：${t}\n世界简介：${i}`;
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

/** `[新增角色]` 正文：姓名（空则随机生成）、身份和关系（空则无）、简单描述（角色简介）分行输出 */
export function formatAddCharacterMessage(
  name: string,
  relationIdentity: string,
  characterIntro: string,
): string {
  const n = String(name ?? '').trim();
  const rel = String(relationIdentity ?? '').trim();
  const intro = String(characterIntro ?? '').trim();
  const lines = [
    '[新增角色]',
    `姓名：${n || '随机生成'}`,
    `身份和关系： ${rel || '无'}`,
  ];
  if (intro) lines.push(`简单描述：${intro}`);
  return lines.join('\n');
}

const emptyClothingSlot = () => ({}) as Record<string, { 状态: string; 描述: string }>;

/**
 * 新建一条「角色档案」条目的默认骨架（与 `addCharacterToVariables` 写入形状一致），供招募解析或本地拼装后 `Schema.safeParse` 再写入。
 */
export function createEmptyCharacterRecord(姓名: string, 描写: string): Record<string, unknown> {
  const n = String(姓名 ?? '').trim() || '未命名';
  const desc = String(描写 ?? '').trim();
  return {
    姓名: n,
    状态: '出场中',
    描写: desc,
    当前内心想法: '',
    当前位置: {
      区域ID: '',
      建筑ID: '',
      活动ID: '',
      当前行为描述: '待命',
    },
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
      ...Object.fromEntries(CLOTHING_BODY_SLOT_KEYS.map(k => [k, emptyClothingSlot()])),
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
    参与活动记录: {},
  };
}

/** 直接向 MVU 写入新角色档案（一般不要用；新增角色应走 `submitAddCharacter` 由 AI/变量管线写入，避免重复条目） */
export function addCharacterToVariables(name: string, description: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const id = allocateNextChrId(store.data.角色档案 as Record<string, unknown>);
  if (!id) {
    toastr.error('角色档案已达 CHR-999 上限，无法新增');
    return;
  }
  store.data.角色档案[id] = createEmptyCharacterRecord(name, description) as (typeof store.data.角色档案)[string];

  bumpUpdateTime();
}

/** 仅生成并返回 `[新增角色]` 消息文本；不写入 `角色档案`，避免与 AI 输出变量重复。 */
export async function submitAddCharacter(
  name: string,
  relationIdentity: string,
  characterIntro: string,
): Promise<string> {
  const introRaw = String(characterIntro ?? '').trim();
  if (!introRaw) {
    toastr.warning('请先填写角色简介（必填）');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const { squashRecruitBriefForAddCharacterMessage } = await import('./recruitModalBrief');
  const intro = squashRecruitBriefForAddCharacterMessage(introRaw) || introRaw;
  const n = String(name ?? '').trim();
  const rel = String(relationIdentity ?? '').trim();
  return formatAddCharacterMessage(n, rel, intro);
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
  return {
    ...Object.fromEntries(CLOTHING_BODY_SLOT_KEYS.map(k => [k, {}])),
    饰品: {},
  } as ClothingStateZh;
}

function mergeClothingState(incoming: ClothingStateZh | Record<string, unknown>): ClothingStateZh {
  const base = defaultEmptyClothingState();
  const raw =
    incoming != null && typeof incoming === 'object' && !Array.isArray(incoming)
      ? (normalize服装状态Raw(incoming) as Record<string, unknown>)
      : {};
  const jewelry = {
    ...base.饰品,
    ...(raw.饰品 && typeof raw.饰品 === 'object' && !Array.isArray(raw.饰品) ? raw.饰品 : {}),
  } as NonNullable<ClothingStateZh['饰品']>;
  const out: ClothingStateZh = { 饰品: jewelry };
  for (const k of CLOTHING_BODY_SLOT_KEYS) {
    const slotKey = k;
    const a = normalizeClothingBodySlotRecord(base[slotKey]);
    const b = normalizeClothingBodySlotRecord(raw[slotKey]);
    out[slotKey] = mergeBodySlotRecords(a, b);
  }
  return out;
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

/** 仅更新「服装状态.<槽位>.<服装名>」，其余键不变 */
export function patchCharacterClothingBodyGarment(
  characterId: string,
  slotKey: ClothingBodySlotKeyZh,
  garmentName: string,
  garment: ClothingBodyGarmentZh,
): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;
  const nm = String(garmentName ?? '').trim();
  if (!nm) return;
  const cur = clothingStateFromMvuRaw(char.服装状态);
  const slot = { ...(cur[slotKey] ?? {}) };
  slot[nm] = {
    状态: String(garment.状态 ?? '正常').trim() || '正常',
    描述: String(garment.描述 ?? ''),
  };
  cur[slotKey] = slot;
  char.服装状态 = cur;
  bumpUpdateTime();
}

/** 移除「服装状态.<槽位>」下某一服装名 */
export function removeCharacterClothingBodyGarment(
  characterId: string,
  slotKey: ClothingBodySlotKeyZh,
  garmentName: string,
): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;
  const nm = String(garmentName ?? '').trim();
  if (!nm) return;
  const cur = clothingStateFromMvuRaw(char.服装状态);
  const slot = { ...(cur[slotKey] ?? {}) };
  delete slot[nm];
  cur[slotKey] = slot;
  char.服装状态 = cur;
  bumpUpdateTime();
}

/** 仅更新「服装状态.饰品」下某一键（如 手镯），其余饰品与身体槽位不变 */
export function patchCharacterJewelryItem(
  characterId: string,
  itemName: string,
  item: JewelryItemZh,
): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;
  const nm = String(itemName ?? '').trim();
  if (!nm) return;
  const cur = clothingStateFromMvuRaw(char.服装状态);
  cur.饰品 = {
    ...(cur.饰品 ?? {}),
    [nm]: {
      部位: String(item.部位 ?? ''),
      状态: String(item.状态 ?? '正常').trim() || '正常',
      描述: String(item.描述 ?? ''),
    },
  };
  char.服装状态 = cur;
  bumpUpdateTime();
}

export function formatEditCharacterAppearanceMessage(
  characterId: string,
  服装状态: ClothingStateZh,
  身体部位物理状态: Record<string, BodyPartPhysicsZh>,
): string {
  const lines = ['[编辑角色外观与身体状态]', `角色ID：${characterId}`];
  for (const k of CLOTHING_BODY_SLOT_KEYS) {
    const rec = 服装状态[k];
    if (!rec || typeof rec !== 'object') continue;
    const entries = Object.entries(rec).filter(([n]) => String(n).trim());
    if (entries.length === 0) continue;
    lines.push(
      `${k}：${entries
        .map(([n, o]) => {
          const st = String((o as ClothingBodyGarmentZh)?.状态 ?? '').trim() || '正常';
          const d = String((o as ClothingBodyGarmentZh)?.描述 ?? '').trim();
          return d ? `${n} / ${st} / ${d}` : `${n} / ${st}`;
        })
        .join('；')}`,
    );
  }
  const acc = 服装状态.饰品;
  if (acc && typeof acc === 'object') {
    const entries = Object.entries(acc).filter(([n]) => String(n).trim());
    if (entries.length > 0) {
      lines.push(
        `饰品：${entries
          .map(([n, o]) => {
            const part = String(o?.部位 ?? o?.状态 ?? '').trim();
            const desc = String(o?.描述 ?? '').trim();
            const head = part ? `${n}（${part}）` : n;
            return desc ? `${head}：${desc}` : head;
          })
          .join('；')}`,
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

/** 从 MVU 原始「服装状态」填弹窗（缺项补默认，兼容旧单槽结构） */
export function clothingStateFromMvuRaw(raw: unknown): ClothingStateZh {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    return mergeClothingState(raw as Record<string, unknown>);
  }
  return defaultEmptyClothingState();
}

/** 将身体槽 record 展开为弹窗/购物车多行 */
export function bodyGarmentRowsFromClothingState(c: ClothingStateZh): ClothingBodyGarmentEditRow[] {
  const rows: ClothingBodyGarmentEditRow[] = [];
  for (const slot of CLOTHING_BODY_SLOT_KEYS) {
    const rec = c[slot];
    if (!rec || typeof rec !== 'object') continue;
    for (const [name, v] of Object.entries(rec)) {
      const nm = String(name).trim();
      if (!nm) continue;
      const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
      rows.push({
        slot,
        name: nm,
        状态: String(o.状态 ?? '正常').trim() || '正常',
        描述: String(o.描述 ?? ''),
      });
    }
  }
  rows.sort((a, b) => `${a.slot}/${a.name}`.localeCompare(`${b.slot}/${b.name}`, 'zh-Hans-CN'));
  return rows;
}

/** 由身体行 + 饰品行拼出完整「服装状态」 */
export function mergeClothingAppearanceSubmit(
  bodyRows: ClothingBodyGarmentEditRow[],
  jewelryRows: JewelryEditRow[],
): ClothingStateZh {
  const base = defaultEmptyClothingState();
  for (const row of bodyRows) {
    const nm = String(row.name ?? '').trim();
    if (!nm) continue;
    const sk = row.slot;
    if (!(CLOTHING_BODY_SLOT_KEYS as readonly string[]).includes(sk)) continue;
    const slot = { ...(base[sk] ?? {}) };
    slot[nm] = {
      状态: String(row.状态 ?? '正常').trim() || '正常',
      描述: String(row.描述 ?? ''),
    };
    base[sk] = slot;
  }
  return applyJewelryRowsToClothing(base, jewelryRows);
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

/** 购物车/弹窗里一行饰品（兼容旧键「状态」→「部位」） */
export function normalizeJewelryEditRow(row: unknown): JewelryEditRow {
  const o = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
  const 部位 = String(o.部位 ?? '').trim();
  const legacy = String(o.状态 ?? '').trim();
  return {
    name: String(o.name ?? ''),
    部位: 部位 || legacy,
    描述: String(o.描述 ?? ''),
  };
}

export function jewelryRowsFromClothingState(c: ClothingStateZh): JewelryEditRow[] {
  const acc = c.饰品;
  if (acc == null || typeof acc !== 'object') return [];
  return Object.entries(acc).map(([name, o]) => {
    const row = o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    return normalizeJewelryEditRow({ name, ...row });
  });
}

/** 将饰品行写回「服装状态.饰品」 */
export function applyJewelryRowsToClothing(clothing: ClothingStateZh, rows: JewelryEditRow[]): ClothingStateZh {
  const jewelry: NonNullable<ClothingStateZh['饰品']> = {};
  for (const row of rows) {
    const n = String(row.name ?? '').trim();
    if (!n) continue;
    jewelry[n] = {
      部位: String(row.部位 ?? ''),
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

export function formatWorldRuleMessage(
  type: 'add' | 'edit' | 'archive' | 'restore' | 'delete',
  name: string,
  detail?: string,
): string {
  if (type === 'archive') return `[归档世界规则]\n名称：${name}`;
  if (type === 'restore') return `[复原世界规则]\n名称：${name}`;
  if (type === 'delete') return `[删除世界规则]\n名称：${name}`;
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

export function deleteWorldRuleInVariables(idOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const rules = store.data.世界规则;

  let key = idOrTitle;
  if (!rules[idOrTitle] && idOrTitle.startsWith('world-')) {
    const t = idOrTitle.slice('world-'.length);
    if (rules[t]) key = t;
  }

  if (rules[key]) {
    delete rules[key];
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
    void generateWorldTrend(n, 'world', detail.trim()).then((success) => {
      if (success) {
        toastr.success(`已生成世界大势说明：${n}`);
      }
    });
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
    void generateWorldTrend(n, 'world', detail.trim());
  }, 100);

  return message;
}

export async function submitArchiveWorldRule(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatWorldRuleMessage('archive', name);
  await sendToDialog(message);
  archiveWorldRuleInVariables(name);
  toastr.success(`已归档世界规则「${name}」${deliveryHintForToast()}`);
}

export async function submitRestoreWorldRule(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatWorldRuleMessage('restore', name);
  await sendToDialog(message);
  restoreWorldRuleInVariables(name);
  toastr.success(`已复原世界规则「${name}」${deliveryHintForToast()}`);
}

export async function submitDeleteWorldRule(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatWorldRuleMessage('delete', name);
  await sendToDialog(message);
  deleteWorldRuleInVariables(name);
  toastr.success(`已删除世界规则「${name}」${deliveryHintForToast()}`);
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

/** 从变量中移除整个区域（含细分规则） */
export function formatDeleteRegionMessage(regionName: string): string {
  return `[删除区域]\n区域：${regionName}`;
}

/** 删除区域下的某条细分规则（变量中移除子键） */
export function formatDeleteRegionalSubRuleMessage(regionName: string, ruleSummary: string): string {
  return `[删除区域规则]\n区域：${regionName}\n规则：${ruleSummary}`;
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

export function deleteRegionFromVariables(idOrName: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const regions = { ...store.data.区域规则 };

  let key = idOrName;
  if (!regions[idOrName] && idOrName.startsWith('region-')) {
    const n = idOrName.slice('region-'.length);
    if (regions[n]) key = n;
  }

  if (regions[key]) {
    delete regions[key];
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

export function deleteRegionalRuleFromVariables(regionIdOrName: string, ruleIdOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
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

  if (!subRules[subKey]) return;

  delete subRules[subKey];
  regions[regionKey] = {
    ...region,
    细分规则: subRules,
  };
  store.data.区域规则 = regions;
  bumpUpdateTime();
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
    void generateWorldTrend(n, 'regional', detail.trim(), [n]).then((success) => {
      if (success) {
        toastr.success(`已生成世界大势说明：${n}`);
      }
    });
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
    void generateWorldTrend(n, 'regional', detail, [regionName]).then((success) => {
      if (success) {
        toastr.success(`已生成世界大势说明：${n}`);
      }
    });
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
    void generateWorldTrend(n, 'regional', detail, [regionName]);
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
    void generateWorldTrend(n, 'regional', detail.trim(), [n]);
  }, 100);

  return message;
}

export async function submitArchiveRegion(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatRegionRuleMessage('archive', name);
  await sendToDialog(message);
  archiveRegionInVariables(name);
  toastr.success(`已归档区域「${name}」${deliveryHintForToast()}`);
}

export async function submitRestoreRegion(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatRegionRuleMessage('restore', name);
  await sendToDialog(message);
  restoreRegionInVariables(name);
  toastr.success(`已复原区域「${name}」${deliveryHintForToast()}`);
}

export async function submitArchiveRegionalRule(regionName: string, ruleIdOrTitle: string, ruleSummary?: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatRegionRuleMessage('archive', regionName, ruleSummary ?? ruleIdOrTitle);
  await sendToDialog(message);
  archiveRegionalRuleInVariables(regionName, ruleIdOrTitle);
  toastr.success(`已归档「${regionName}」下规则${ruleSummary ? `「${ruleSummary}」` : ''}${deliveryHintForToast()}`);
}

export async function submitRestoreRegionalRule(regionName: string, ruleIdOrTitle: string, ruleSummary?: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatRegionRuleMessage('restore', regionName, ruleSummary ?? ruleIdOrTitle);
  await sendToDialog(message);
  restoreRegionalRuleInVariables(regionName, ruleIdOrTitle);
  toastr.success(`已复原「${regionName}」下规则${ruleSummary ? `「${ruleSummary}」` : ''}${deliveryHintForToast()}`);
}

export async function submitDeleteRegion(name: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const message = formatDeleteRegionMessage(name);
  await sendToDialog(message);
  deleteRegionFromVariables(name);
  toastr.success(`已删除区域「${name}」${deliveryHintForToast()}`);
}

export async function submitDeleteRegionalRule(regionName: string, ruleIdOrTitle: string, ruleSummary?: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const summary = ruleSummary ?? ruleIdOrTitle;
  const message = formatDeleteRegionalSubRuleMessage(regionName, summary);
  await sendToDialog(message);
  deleteRegionalRuleFromVariables(regionName, ruleIdOrTitle);
  toastr.success(`已删除「${regionName}」下规则${ruleSummary ? `「${ruleSummary}」` : ''}${deliveryHintForToast()}`);
}

// ---------- 个人规则 ----------

export function formatPersonalRuleMessage(
  type: 'add' | 'edit' | 'archive' | 'restore' | 'delete',
  characterName: string,
  detail?: string,
  ruleName?: string,
): string {
  if (type === 'archive') return `[归档个人规则]\n对象：${characterName}${detail ? `\n规则：${detail}` : ''}`;
  if (type === 'restore') return `[复原个人规则]\n对象：${characterName}${detail ? `\n规则：${detail}` : ''}`;
  if (type === 'delete') return `[删除个人规则]\n对象：${characterName}${detail ? `\n规则：${detail}` : ''}`;
  const prefix = type === 'add' ? '[新增个人规则]' : '[编辑个人规则]';
  const nameLine = ruleName != null && String(ruleName).trim() !== '' ? `\n规则名字：${String(ruleName).trim()}` : '';
  return `${prefix}\n对象：${characterName}${nameLine}\n规则细节：${detail ?? ''}`;
}

/** 与 usePersonalRulesByCharacter 分组键一致 */
export function personalRuleEntryGroupKey(
  id: string,
  rule: { 名称?: string; 适用对象?: string },
): string {
  const target = String(rule?.适用对象 ?? '').trim();
  const title = String(rule?.名称 ?? '').trim() || String(rule?.适用对象 ?? '').trim() || id;
  return target || title || '未命名';
}

export function listPersonalRuleStoreKeysForGroup(groupName: string): string[] {
  const store = useDataStore();
  const rules = store.data.个人规则 || {};
  const keys: string[] = [];
  for (const id of Object.keys(rules)) {
    if (personalRuleEntryGroupKey(id, rules[id]!) === groupName) keys.push(id);
  }
  return keys;
}

export function addPersonalRuleToVariables(characterName: string, ruleName: string, detail: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const key = `PR-${Date.now()}`;
  const c = characterName.trim();
  const rn = ruleName.trim();
  store.data.个人规则[key] = {
    名称: rn,
    适用对象: c,
    效果描述: detail.trim(),
    状态: '生效中',
    细分规则: {},
    标记: '个人级',
  };
  bumpUpdateTime();
}

export function updatePersonalRuleInVariables(
  idOrTitle: string,
  updates: Partial<RuleData> & { applicableTarget?: string; ruleDisplayName?: string },
): void {
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
  
  if (updates.applicableTarget !== undefined) {
    cur.适用对象 = String(updates.applicableTarget).trim();
  }
  if (updates.ruleDisplayName !== undefined) {
    cur.名称 = String(updates.ruleDisplayName).trim();
  }
  if (updates.desc !== undefined) cur.效果描述 = updates.desc;
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

export function deletePersonalRuleInVariables(idOrTitle: string): void {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  const rules = store.data.个人规则;

  let key = idOrTitle;
  if (!rules[idOrTitle] && idOrTitle.startsWith('personal-')) {
    const k = idOrTitle.slice('personal-'.length);
    if (rules[k]) key = k;
  }

  if (rules[key]) {
    delete rules[key];
    bumpUpdateTime();
  }
}

export async function submitAddPersonalRule(
  characterName: string,
  ruleName: string,
  detail: string,
): Promise<string> {
  const c = String(characterName ?? '').trim();
  const rn = String(ruleName ?? '').trim();
  if (!c) {
    toastr.warning('请输入角色/对象名称');
    return '';
  }
  if (!rn) {
    toastr.warning('请输入规则名字');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const message = formatPersonalRuleMessage('add', c, detail.trim(), rn);
  addPersonalRuleToVariables(c, rn, detail.trim());
  markResidentLifePendingPersonalRule();

  return message;
}

export async function submitEditPersonalRule(
  idOrTitle: string,
  characterName: string,
  ruleName: string,
  detail: string,
): Promise<string> {
  const c = String(characterName ?? '').trim();
  const rn = String(ruleName ?? '').trim();
  if (!c) {
    toastr.warning('请输入角色/对象名称');
    return '';
  }
  if (!rn) {
    toastr.warning('请输入规则名字');
    return '';
  }
  if (!tryRulesMvuWritable()) return '';
  const message = formatPersonalRuleMessage('edit', c, detail.trim(), rn);
  updatePersonalRuleInVariables(idOrTitle, {
    applicableTarget: c,
    ruleDisplayName: rn,
    desc: detail.trim(),
  });
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
  toastr.success(`已归档「${label}」${ruleSummary ? `（${ruleSummary}）` : ''}${deliveryHintForToast()}`);
}

export async function submitRestorePersonalRule(idOrTitle: string, characterName?: string, ruleSummary?: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const label = characterName ?? idOrTitle;
  const message = formatPersonalRuleMessage('restore', label, ruleSummary);
  await sendToDialog(message);
  restorePersonalRuleInVariables(idOrTitle);
  markResidentLifePendingPersonalRule();
  toastr.success(`已复原「${label}」${ruleSummary ? `（${ruleSummary}）` : ''}${deliveryHintForToast()}`);
}

export async function submitDeletePersonalRule(
  idOrTitle: string,
  characterName?: string,
  ruleSummary?: string,
): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const label = characterName ?? idOrTitle;
  const message = formatPersonalRuleMessage('delete', label, ruleSummary);
  await sendToDialog(message);
  deletePersonalRuleInVariables(idOrTitle);
  markResidentLifePendingPersonalRule();
  toastr.success(`已删除「${label}」${ruleSummary ? `（${ruleSummary}）` : ''}${deliveryHintForToast()}`);
}

export async function submitArchivePersonalRulesForGroup(groupName: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const keys = listPersonalRuleStoreKeysForGroup(groupName);
  if (keys.length === 0) {
    toastr.warning('未找到该对象下的个人规则');
    return;
  }
  const lines = [
    `[归档个人规则（本对象所有条目）]`,
    `对象：${groupName}`,
    `条数：${keys.length}`,
    ...keys.map((k) => `- ${k}`),
  ];
  await sendToDialog(lines.join('\n'));
  for (const k of keys) {
    archivePersonalRuleInVariables(k);
  }
  markResidentLifePendingPersonalRule();
  toastr.success(`已归档对象「${groupName}」下 ${keys.length} 条个人规则${deliveryHintForToast()}`);
}

export async function submitDeletePersonalRulesForGroup(groupName: string): Promise<void> {
  if (!tryRulesMvuWritable()) return;
  const keys = listPersonalRuleStoreKeysForGroup(groupName);
  if (keys.length === 0) {
    toastr.warning('未找到该对象下的个人规则');
    return;
  }
  const lines = [
    `[删除个人规则（本对象所有条目）]`,
    `对象：${groupName}`,
    `条数：${keys.length}`,
    ...keys.map((k) => `- ${k}`),
  ];
  await sendToDialog(lines.join('\n'));
  for (const k of keys) {
    deletePersonalRuleInVariables(k);
  }
  markResidentLifePendingPersonalRule();
  toastr.success(`已删除对象「${groupName}」下 ${keys.length} 条个人规则${deliveryHintForToast()}`);
}

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
