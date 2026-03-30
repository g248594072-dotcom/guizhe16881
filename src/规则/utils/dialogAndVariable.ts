/**
 * 将内容填入对话框并同步修改变量
 * 用于：新增/编辑角色、规则等操作
 * 
 * 注意：此版本已适配 ZOD MVU，使用 useDataStore 直接修改变量
 * 修改会自动同步到酒馆变量，无需手动调用 updateVariablesWith
 */

import type { RuleData, CharacterData, RegionData } from '../types';
import { useDataStore, bumpUpdateTime } from '../store';
import { parseEditableTextToTagMap } from './tagMap';

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
  const store = useDataStore();
  const id = `CHR-${Date.now()}`;
  const n = name.trim() || '未命名';
  const desc = description.trim();

  store.data.角色档案[id] = {
    姓名: n,
    状态: '出场中',
    描写: desc,
    当前内心想法: '',
    性格: {},
    性癖: {},
    敏感部位: {},
    隐藏性癖: '',
    身体信息: {
      年龄: 17,
      身高: 160,
      体重: 48,
      三围: '未知',
      体质特征: '普通',
    },
    数值: {
      好感度: 0,
      发情值: 0,
      性癖开发值: 0,
    },
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
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  if (updates.name != null) char.姓名 = updates.name;
  if (updates.description != null) char.描写 = updates.description;
  if (updates.avatar != null) {
    const u = String(updates.avatar).trim();
    (char as Record<string, unknown>).头像链接 = u;
    (char as Record<string, unknown>).avatar = u;
  }

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

/** 编辑角色头像（写入角色档案中的头像链接，供界面扩展使用；支持 http(s) 与本地 Data URL） */
export async function submitEditCharacterAvatar(characterId: string, avatarUrl: string): Promise<string> {
  const u = String(avatarUrl ?? '').trim();
  const linkSummary =
    !u
      ? '（清空）'
      : u.startsWith('data:image/')
        ? '（本地图片，已压缩编码并写入变量）'
        : u;
  const message = `[编辑角色头像]\n角色ID：${characterId}\n头像：${linkSummary}`;
  updateCharacterInVariables(characterId, { avatar: u });
  return message;
}

// ---------- 编辑角色心理/性癖/敏感部位 ----------

function formatTagMapLine(label: string, rec: Record<string, string> | undefined): string | null {
  if (rec == null || Object.keys(rec).length === 0) return null;
  const s = Object.entries(rec)
    .map(([k, v]) => (String(v).trim() ? `${k}：${v}` : k))
    .join('、');
  return `${label}：${s}`;
}

export function formatEditCharacterPsychMessage(payload: {
  characterId: string;
  当前内心想法?: string;
  性格?: Record<string, string>;
  性癖?: Record<string, string>;
  敏感部位?: Record<string, string>;
  隐藏性癖?: string;
}): string {
  const lines = ['[编辑角色心理与性癖]', `角色ID：${payload.characterId}`];
  if (payload.当前内心想法 != null) lines.push(`当前内心想法：${String(payload.当前内心想法)}`);
  const t1 = formatTagMapLine('性格', payload.性格);
  if (t1) lines.push(t1);
  const t2 = formatTagMapLine('性癖', payload.性癖);
  if (t2) lines.push(t2);
  const t3 = formatTagMapLine('敏感部位', payload.敏感部位);
  if (t3) lines.push(t3);
  if (payload.隐藏性癖 != null) lines.push(`隐藏性癖：${String(payload.隐藏性癖)}`);
  return lines.join('\n');
}

export function updateCharacterPsychInChineseVariables(
  characterId: string,
  updates: {
    当前内心想法?: string;
    性格?: Record<string, string>;
    性癖?: Record<string, string>;
    敏感部位?: Record<string, string>;
    隐藏性癖?: string;
  },
): void {
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  if (updates.当前内心想法 != null) char.当前内心想法 = updates.当前内心想法;
  if (updates.性格 != null) char.性格 = updates.性格;
  if (updates.性癖 != null) char.性癖 = updates.性癖;
  if (updates.敏感部位 != null) char.敏感部位 = updates.敏感部位;
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
  const updates: {
    当前内心想法?: string;
    性格?: Record<string, string>;
    性癖?: Record<string, string>;
    敏感部位?: Record<string, string>;
    隐藏性癖?: string;
  } = {};

  if (payload.thought !== undefined) updates.当前内心想法 = String(payload.thought ?? '');
  if (payload.traitsText !== undefined) updates.性格 = parseEditableTextToTagMap(payload.traitsText ?? '');
  if (payload.fetishesText !== undefined) updates.性癖 = parseEditableTextToTagMap(payload.fetishesText ?? '');
  if (payload.sensitivePartsText !== undefined) updates.敏感部位 = parseEditableTextToTagMap(payload.sensitivePartsText ?? '');
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
 * 更新角色的敏感部位详情
 */
export function updateCharacterSensitivePartDetails(
  characterId: string,
  updates: SensitivePartDetailUpdate[],
): void {
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  // 确保敏感部位对象存在
  if (!char.敏感部位) char.敏感部位 = {};

  for (const update of updates) {
    const existing = char.敏感部位[update.name];
    char.敏感部位[update.name] = {
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
  const store = useDataStore();
  const char = store.data.角色档案[characterId];
  if (!char) return;

  char.身份标签 = { ...tags };

  bumpUpdateTime();
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
 * 格式化敏感部位详情更新消息
 */
export function formatSensitivePartDetailMessage(characterId: string, updates: SensitivePartDetailUpdate[]): string {
  const lines = ['[编辑敏感部位详情]', `角色ID：${characterId}`];
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
  const message = formatWorldRuleMessage('add', n, detail.trim());
  addWorldRuleToVariables(n, detail.trim());
  return message;
}

export async function submitEditWorldRule(idOrTitle: string, name: string, detail: string): Promise<string> {
  const n = name.trim();
  if (!n) {
    toastr.warning('请输入规则名称');
    return '';
  }
  const message = formatWorldRuleMessage('edit', n, detail.trim());
  updateWorldRuleInVariables(idOrTitle, { title: n, desc: detail.trim() });
  return message;
}

export async function submitArchiveWorldRule(name: string): Promise<void> {
  const message = formatWorldRuleMessage('archive', name);
  await sendToDialog(message);
  archiveWorldRuleInVariables(name);
  toastr.success(`已归档世界规则「${name}」并写入对话框`);
}

export async function submitRestoreWorldRule(name: string): Promise<void> {
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
  const ruleTitle = (firstRuleName ?? '').trim();
  const message = formatRegionRuleMessage('add', n, detail.trim(), ruleTitle || undefined);
  addRegionToVariables(n, detail.trim(), ruleTitle || undefined);
  return message;
}

export async function submitAddRegionalRule(regionIdOrName: string, regionName: string, ruleName: string, ruleDetail: string): Promise<string> {
  const n = ruleName.trim();
  if (!n) {
    toastr.warning('请输入规则名称');
    return '';
  }
  const detail = ruleDetail.trim();
  const message = `[新增区域规则]\n区域：${regionName}\n规则：${n}\n细节：${detail}`;
  addRegionalRuleToVariables(regionIdOrName, n, detail);
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
  const detail = ruleDetail.trim();
  const message = `[编辑区域规则]\n区域：${regionName}\n规则：${n}\n细节：${detail}`;
  updateRegionalRuleInVariables(regionIdOrName, ruleIdOrTitle, { title: n, desc: detail });
  return message;
}

export async function submitEditRegion(idOrName: string, name: string, detail: string): Promise<string> {
  const n = name.trim();
  if (!n) {
    toastr.warning('请输入区域名称');
    return '';
  }
  const message = formatRegionRuleMessage('edit', n, detail.trim());
  updateRegionInVariables(idOrName, { name: n, description: detail.trim() });
  return message;
}

export async function submitArchiveRegion(name: string): Promise<void> {
  const message = formatRegionRuleMessage('archive', name);
  await sendToDialog(message);
  archiveRegionInVariables(name);
  toastr.success(`已归档区域「${name}」并写入对话框`);
}

export async function submitRestoreRegion(name: string): Promise<void> {
  const message = formatRegionRuleMessage('restore', name);
  await sendToDialog(message);
  restoreRegionInVariables(name);
  toastr.success(`已复原区域「${name}」并写入对话框`);
}

export async function submitArchiveRegionalRule(regionName: string, ruleIdOrTitle: string, ruleSummary?: string): Promise<void> {
  const message = formatRegionRuleMessage('archive', regionName, ruleSummary ?? ruleIdOrTitle);
  await sendToDialog(message);
  archiveRegionalRuleInVariables(regionName, ruleIdOrTitle);
  toastr.success(`已归档「${regionName}」下规则${ruleSummary ? `「${ruleSummary}」` : ''}并写入对话框`);
}

export async function submitRestoreRegionalRule(regionName: string, ruleIdOrTitle: string, ruleSummary?: string): Promise<void> {
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
  const message = formatPersonalRuleMessage('add', c, detail.trim());
  addPersonalRuleToVariables(c, detail.trim());
  return message;
}

export async function submitEditPersonalRule(idOrTitle: string, characterName: string, detail: string): Promise<string> {
  const c = characterName.trim();
  if (!c) {
    toastr.warning('请输入角色/对象名称');
    return '';
  }
  const message = formatPersonalRuleMessage('edit', c, detail.trim());
  updatePersonalRuleInVariables(idOrTitle, { title: c, desc: detail.trim() });
  return message;
}

export async function submitArchivePersonalRule(idOrTitle: string, characterName?: string, ruleSummary?: string): Promise<void> {
  const label = characterName ?? idOrTitle;
  const message = formatPersonalRuleMessage('archive', label, ruleSummary);
  await sendToDialog(message);
  archivePersonalRuleInVariables(idOrTitle);
  toastr.success(`已归档「${label}」${ruleSummary ? `（${ruleSummary}）` : ''}并写入对话框`);
}

export async function submitRestorePersonalRule(idOrTitle: string, characterName?: string, ruleSummary?: string): Promise<void> {
  const label = characterName ?? idOrTitle;
  const message = formatPersonalRuleMessage('restore', label, ruleSummary);
  await sendToDialog(message);
  restorePersonalRuleInVariables(idOrTitle);
  toastr.success(`已复原「${label}」${ruleSummary ? `（${ruleSummary}）` : ''}并写入对话框`);
}
