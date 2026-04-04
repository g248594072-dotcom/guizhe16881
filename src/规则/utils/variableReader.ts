/**
 * 变量读取工具
 * 从最新消息楼层读取游戏变量，支持 MVU 格式 [值, "描述"]
 */

import type { GameData, MvuData, CharacterData, RuleData, RegionData } from '../types';
import {
  normalizeFetishRecord,
  normalizeSensitivePartRecord,
  normalizeTagMap,
  normalize三围,
} from './tagMap';

// MVU 初始化状态
let mvuInitialized = false;
let mvuInitPromise: Promise<void> | null = null;

type Value = string | number | boolean | Record<string, any> | Array<any> | null | undefined;

/**
 * 从嵌套对象中提取值，支持 MVU 格式 [值, "描述"]
 */
function pick<T extends Value>(obj: any, path: string, fallback: T): T {
  if (!obj) return fallback;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return fallback;
    // 处理 MVU 格式 [值, "描述"]
    if (Array.isArray(cur) && cur.length > 0) {
      cur = cur[0];
    }
    cur = cur[p];
  }
  // 如果最终值是 MVU 格式，返回第一个元素（实际值）
  if (Array.isArray(cur) && cur.length > 0) return (cur[0] as T) ?? fallback;
  return (cur as T) ?? fallback;
}

/**
 * 确保 MVU 已初始化
 */
async function ensureMvuInitialized(): Promise<void> {
  if (mvuInitialized) {
    return;
  }

  if (mvuInitPromise) {
    return mvuInitPromise;
  }

  mvuInitPromise = (async () => {
    try {
      await waitGlobalInitialized('Mvu');
      mvuInitialized = true;
      console.log('✅ [variableReader] MVU 初始化完成');
    } catch (error) {
      console.warn('⚠️ [variableReader] 等待 MVU 初始化失败:', error);
      mvuInitialized = true;
    }
  })();

  return mvuInitPromise;
}

function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0;
}

/**
 * 检查 stat_data 是否有实际内容（不是空对象）
 */
function hasStatDataContent(stat_data: any): boolean {
  if (!stat_data || typeof stat_data !== 'object') {
    return false;
  }
  return Object.keys(stat_data).length > 0;
}

/**
 * 从最新消息楼层读取 MVU 数据
 * 读取优先级：
 * 1. 最新 assistant 消息的 MVU 数据（通过 replaceMvuData 写入）
 * 2. 最新 assistant 消息的 data 字段
 * 3. 最新楼层的 MVU 数据
 * 4. 最新楼层的变量数据（通过 getVariables）
 * 5. 0层的 MVU 数据（作为初始化数据）
 */
async function getGameMvuData(): Promise<MvuData> {
  // 确保 MVU 已初始化
  await ensureMvuInitialized();

  // 优先从最新的 assistant 消息读取
  try {
    const assistantMessages = getChatMessages(-1, { role: 'assistant' });
    if (assistantMessages && assistantMessages.length > 0) {
      const latestAssistant = assistantMessages[assistantMessages.length - 1];
      const messageId = latestAssistant.message_id;

      console.log(`🔍 [variableReader] 尝试从最新 assistant 消息（ID: ${messageId}）读取变量数据`);

      // 优先尝试从该 assistant 消息读取 MVU 数据
      try {
        const mvuData = Mvu.getMvuData({ type: 'message', message_id: messageId });
        if (mvuData && mvuData.stat_data && hasStatDataContent(mvuData.stat_data)) {
          console.log(`✅ [variableReader] 从最新 assistant 消息（ID: ${messageId}）读取 MVU 数据成功`);
          return mvuData;
        } else {
          console.log(`⚠️ [variableReader] 从消息 ${messageId} 读取的 MVU 数据为空或无效`);
        }
      } catch (err) {
        console.warn(`⚠️ [variableReader] 从 assistant 消息 ${messageId} 读取 MVU 数据失败:`, err);
      }

      // 尝试从该 assistant 消息的 data 字段读取（备用方案）
      if (latestAssistant.data && hasStatDataContent(latestAssistant.data)) {
        // 检查是否已经是 MVU 格式（有 stat_data 等字段）
        if (latestAssistant.data.stat_data && typeof latestAssistant.data.stat_data === 'object') {
          // 已经是 MVU 格式，直接返回整个 data
          console.log(`✅ [variableReader] 从最新 assistant 消息（ID: ${messageId}）读取 MVU 格式数据`);
          return {
            stat_data: latestAssistant.data.stat_data || {},
            display_data: latestAssistant.data?.display_data || {},
            delta_data: latestAssistant.data?.delta_data || {},
          };
        }
        // 如果不是 MVU 格式，尝试直接使用 data 作为 stat_data
        console.log(`✅ [variableReader] 从最新 assistant 消息（ID: ${messageId}）读取原始数据，包装为 MVU 格式`);
        return {
          stat_data: latestAssistant.data || {},
          display_data: {},
          delta_data: {},
        };
      } else {
        console.log(`⚠️ [variableReader] 消息 ${messageId} 的 data 字段为空或无效`);
      }
    }
  } catch (err) {
    console.warn('⚠️ [variableReader] 获取最新 assistant 消息失败，尝试其他方式', err);
  }

  // 退化：使用 Mvu.getMvuData 读取最新楼层变量
  try {
    const mvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    if (mvuData && mvuData.stat_data && hasStatDataContent(mvuData.stat_data)) {
      console.log('✅ [variableReader] 从最新楼层读取 MVU 数据');
      return mvuData;
    }
  } catch (err) {
    console.warn('⚠️ [variableReader] Mvu.getMvuData(latest) 失败，尝试从 getVariables 读取', err);
  }

  // 退化：使用 getVariables 读取最新楼层变量
  try {
    const variables = getVariables({ type: 'message', message_id: 'latest' });
    if (variables && variables.stat_data && hasStatDataContent(variables.stat_data)) {
      console.log('✅ [variableReader] 从最新楼层读取变量数据（通过 getVariables）');
      return {
        stat_data: variables.stat_data || {},
        display_data: variables?.display_data || {},
        delta_data: variables?.delta_data || {},
      };
    }
  } catch (err) {
    console.warn('⚠️ [variableReader] 无法获取最新楼层变量，尝试读取0层', err);
  }

  // 如果最新楼层没有数据，尝试读取0层（用于初始化数据）
  try {
    const mvuData = Mvu.getMvuData({ type: 'message', message_id: 0 });
    if (mvuData && mvuData.stat_data && hasStatDataContent(mvuData.stat_data)) {
      console.log('✅ [variableReader] 从0层读取 MVU 数据（最新楼层无数据）');
      return mvuData;
    }
  } catch (err) {
    console.warn('⚠️ [variableReader] Mvu.getMvuData(0) 失败', err);
  }

  try {
    const variables = getVariables({ type: 'message', message_id: 0 });
    if (variables && variables.stat_data && hasStatDataContent(variables.stat_data)) {
      console.log('✅ [variableReader] 从0层读取变量数据（通过 getVariables）');
      return {
        stat_data: variables.stat_data || {},
        display_data: variables?.display_data || {},
        delta_data: variables?.delta_data || {},
      };
    }
  } catch (err) {
    console.warn('⚠️ [variableReader] 无法获取0层变量，返回空对象', err);
  }

  console.warn('⚠️ [variableReader] 无法获取任何楼层的数据，返回空对象');
  return { stat_data: {}, display_data: {}, delta_data: {} };
}

/**
 * 将规则「状态」映射为前端 active/inactive（兼容模型常用同义词「激活」「启用」）
 */
function ruleStatusToUi(状态: unknown): 'active' | 'inactive' {
  const s = String(状态 ?? '').trim();
  if (s === '生效中' || s === '激活' || s === '启用') return 'active';
  if (s === '已归档') return 'inactive';
  return 'inactive';
}

/** 规则条目正文：优先「效果描述」，空则回退「描述」（兼容错写字段名） */
function pickRuleEffectDesc(value: Record<string, any> | undefined | null): string {
  if (!value || typeof value !== 'object') return '';
  const main = value['效果描述'];
  if (typeof main === 'string' && main.trim() !== '') return main;
  const alt = value['描述'];
  return typeof alt === 'string' ? alt : '';
}

/**
 * 从中文结构「世界规则」映射到 RuleData[]，支持英文字段回退
 */
function mapWorldRulesFromChinese(stat: Record<string, any>): RuleData[] {
  const raw = stat['世界规则'];
  if (!raw || typeof raw !== 'object') return [];

  return Object.entries(raw).map(([title, value]: [string, any]) => {
    // 优先中文字段，回退英文字段
    let 状态 = value?.['状态'];
    if (!状态 && (value?.['active'] === true || value?.['enabled'] === true)) {
      状态 = '生效中';
    } else if (!状态 && (value?.['active'] === false || value?.['enabled'] === false)) {
      状态 = '已归档';
    }
    状态 = 状态 ?? '生效中';

    // 优先效果描述，回退 desc/description
    let desc = pickRuleEffectDesc(value);
    if (!desc) {
      desc = value?.['desc'] ?? value?.['description'] ?? '';
    }

    const 标记 = value?.['标记'] ?? value?.['tag'] ?? '';
    const status: 'active' | 'inactive' | 'pending' = ruleStatusToUi(状态);

    // 使用中文名称或英文 name 字段作为标题
    let displayTitle = title;
    if (value?.['name'] && typeof value['name'] === 'string') {
      displayTitle = value['name'];
    }

    return {
      id: `world-${title}`,
      title: displayTitle,
      desc,
      status,
      category: 'world',
      tag: 标记,
    } as RuleData;
  });
}

/**
 * 从中文结构「区域规则」映射到 RegionData[]
 */
function mapRegionalRulesFromChinese(stat: Record<string, any>): RegionData[] {
  const raw = stat['区域规则'];
  if (!raw || typeof raw !== 'object') return [];

  return Object.entries(raw).map(([name, value]: [string, any]) => {
    const desc = pickRuleEffectDesc(value);
    const 状态 = value?.['状态'] ?? '生效中';
    const status: 'active' | 'inactive' = ruleStatusToUi(状态);

    const 子规则Raw = value?.['细分规则'] ?? {};
    const rules: RuleData[] =
      子规则Raw && typeof 子规则Raw === 'object'
        ? Object.entries(子规则Raw).map(([title, r]: [string, any]) => {
            const 状态2 = r?.['状态'] ?? '生效中';
            const desc2 = pickRuleEffectDesc(r);
            return {
              id: `regional-${name}-${title}`,
              title,
              desc: desc2,
              status: ruleStatusToUi(状态2),
              category: 'regional',
            } as RuleData;
          })
        : [];

    return {
      id: `region-${name}`,
      name,
      description: desc,
      rules,
      status,
    } as RegionData;
  });
}

/**
 * 从中文结构「个人规则」映射到 RuleData[]
 */
function mapPersonalRulesFromChinese(stat: Record<string, any>): RuleData[] {
  const raw = stat['个人规则'];
  if (!raw || typeof raw !== 'object') return [];

  return Object.entries(raw).map(([title, value]: [string, any]) => {
    const desc = pickRuleEffectDesc(value);
    const 状态 = value?.['状态'] ?? '生效中';
    const 标记 = value?.['标记'];
    const 适用对象 = value?.['适用对象'];
    const status: 'active' | 'inactive' | 'pending' = ruleStatusToUi(状态);

    const displayTitle = (() => {
      const n = value?.['名称'];
      if (typeof n === 'string' && n.trim() !== '') return n;
      const t = value?.['适用对象'];
      if (typeof t === 'string' && t.trim() !== '') return t;
      return title;
    })();

    return {
      id: `personal-${title}`,
      title: displayTitle,
      desc,
      status,
      category: 'personal',
      target: 适用对象,
      tag: 标记,
    } as RuleData;
  });
}

/**
 * 从中文结构「角色档案」映射到 CharacterData[]
 */
function mapCharactersFromChinese(stat: Record<string, any>): CharacterData[] {
  const raw = stat['角色档案'];
  if (!raw || typeof raw !== 'object') return [];

  return Object.entries(raw).map(([id, value]: [string, any]) => {
    // 优先使用姓名字段
    let name = value?.['姓名'];
    // 如果姓名为空、"未知"或空白，尝试使用英文 name 字段
    if (!name || name === '未知' || name.trim() === '') {
      name = value?.['name'];
    }
    // 如果还是空，使用 ID 作为名字
    if (!name || name.trim() === '' || name === '未知') {
      name = id;
    }

    const 描写 = value?.['描写'] ?? value?.['description'] ?? '';
    const 状态 = value?.['状态'] ?? '出场中';

    const 当前内心想法 = value?.['当前内心想法'] ?? value?.['currentThought'] ?? '';
    const 性格 = normalizeTagMap(value?.['性格'] ?? value?.['traits']);
    const fetishNorm = normalizeFetishRecord(value?.['性癖'] ?? value?.['fetishes']);
    const sensitiveNorm = normalizeSensitivePartRecord(value?.['敏感部位'] ?? value?.['sensitiveParts']);
    const 隐藏性癖 = value?.['隐藏性癖'] ?? value?.['hiddenFetish'] ?? '';

    const 身体 = value?.['身体信息'] ?? {};
    const 数值 = value?.['数值'] ?? {};

    const basic = {
      age: 身体['年龄'] != null ? String(身体['年龄']) :
           value?.['age'] != null ? String(value['age']) : undefined,
      height: 身体['身高'] != null ? String(身体['身高']) :
              value?.['height'] != null ? String(value['height']) : undefined,
      weight: 身体['体重'] != null ? String(身体['体重']) :
              value?.['weight'] != null ? String(value['weight']) : undefined,
      threeSize: normalize三围(身体['三围'] ?? value?.['threeSize']),
      physique: 身体['体质特征'] ?? value?.['physique'],
    };

    const stats: Record<string, number> = {};
    // 优先读取中文数值字段
    if (typeof 数值['好感度'] === 'number') stats.affection = 数值['好感度'];
    if (typeof 数值['发情值'] === 'number') stats.lust = 数值['发情值'];
    const fetishVal = 数值['性癖开发值'] ?? 数值['性癖开发度'];
    if (typeof fetishVal === 'number') stats.fetish = fetishVal;

    // 如果中文字段为0或未定义，回退到英文字段
    if (!stats.affection && typeof value?.['affection'] === 'number') {
      stats.affection = value['affection'];
    }
    if (!stats.lust) {
      if (typeof value?.['estrus'] === 'number') stats.lust = value['estrus'];
      else if (typeof value?.['lust'] === 'number') stats.lust = value['lust'];
    }
    if (!stats.fetish) {
      if (typeof value?.['fetish_dev'] === 'number') stats.fetish = value['fetish_dev'];
      else if (typeof value?.['fetish'] === 'number') stats.fetish = value['fetish'];
    }
    // 处理嵌套的 state 对象
    if (value?.['state'] && typeof value['state'] === 'object') {
      const state = value['state'];
      if (!stats.affection && typeof state['Affection'] === 'number') {
        stats.affection = state['Affection'];
      }
      if (!stats.lust && typeof state['Estrus'] === 'number') {
        stats.lust = state['Estrus'];
      }
      if (!stats.fetish && typeof state['Fetish_Dev'] === 'number') {
        stats.fetish = state['Fetish_Dev'];
      }
    }

    const 生理描述 = value?.['当前综合生理描述'] ?? value?.['currentPhysiologicalDesc'] ?? '';

    const fetishDetails: Record<string, { level: number; description: string; justification: string }> = {};
    for (const [key, o] of Object.entries(fetishNorm)) {
      fetishDetails[key] = {
        level: o.等级,
        description: o.细节描述,
        justification: o.自我合理化,
      };
    }
    const 性癖 = Object.fromEntries(
      Object.entries(fetishDetails).map(([k, v]) => [
        k,
        v.description.trim() ? v.description : `${k}（等级${v.level}）`,
      ]),
    );

    const sensitivePartDetails: Record<string, { level: number; reaction: string; devDetails: string }> = {};
    for (const [key, o] of Object.entries(sensitiveNorm)) {
      sensitivePartDetails[key] = {
        level: o.敏感等级,
        reaction: o.生理反应,
        devDetails: o.开发细节,
      };
    }
    const 敏感部位 = Object.fromEntries(
      Object.entries(sensitivePartDetails).map(([k, v]) => [
        k,
        v.reaction.trim() ? v.reaction : `${k}（敏感等级${v.level}）`,
      ]),
    );

    // 身份标签
    const identityTags = value?.['身份标签'] ?? value?.['identityTags'] ?? {};

    return {
      id,
      name,
      description: 描写,
      status: 状态 === '出场中' ? 'active' : 'inactive',
      basic,
      stats,
      currentThought: 当前内心想法,
      traits: 性格,
      fetishes: 性癖,
      sensitiveParts: 敏感部位,
      hiddenFetish: 隐藏性癖,
      currentPhysiologicalDesc: typeof 生理描述 === 'string' ? 生理描述 : '',
      fetishDetails,
      sensitivePartDetails,
      identityTags,
    } as CharacterData;
  });
}

/**
 * 从最新消息楼层读取游戏数据（用于界面展示）
 * 使用 pick 函数支持 MVU 格式 [值, "描述"]
 */
export async function readGameData(): Promise<GameData> {
  const m = await getGameMvuData();
  const stat = m?.stat_data || {};

  console.log('🔍 [variableReader] stat_data 内容:', stat);

  // 读取游戏状态
  const gameStatus = pick(stat, 'gameStatus', {
    phase: 'playing',
    turn: 0,
    lastUpdated: new Date().toISOString(),
  });

  // 读取玩家信息
  const player = pick(stat, 'player', {
    name: '玩家',
    settings: {},
  });

  // 读取规则与角色：统一使用中文 MVU 格式（支持英文字段回退）
  let worldRules = mapWorldRulesFromChinese(stat);
  const regionalRules = mapRegionalRulesFromChinese(stat);
  const personalRules = mapPersonalRulesFromChinese(stat);
  const characters = mapCharactersFromChinese(stat);

  // 如果世界规则为空，从 openingConfig.selectedRules 构建
  if (worldRules.length === 0 && stat['openingConfig']?.selectedRules) {
    worldRules = stat['openingConfig'].selectedRules.map((r: any) => ({
      id: `world-${r.name}`,
      title: r.name,
      desc: r.desc || '',
      status: 'active' as const,
      category: 'world' as const,
    }));
  }

  // 读取元数据（浅拷贝，避免改写 stat_data 内联对象）
  const meta = {
    ...pick(stat, 'meta', {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    }),
  };

  const 元信息 = stat['元信息'];
  if (元信息 && typeof 元信息 === 'object') {
    const ts = (元信息 as any)['最近更新时间'];
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      meta.updatedAt = new Date(ts).toISOString();
    }
  }

  const playerNameFromMeta =
    元信息 && typeof 元信息 === 'object' && typeof (元信息 as any)['玩家名称'] === 'string'
      ? String((元信息 as any)['玩家名称']).trim()
      : '';
  const playerOut = {
    ...player,
    ...(playerNameFromMeta ? { name: playerNameFromMeta } : {}),
  };

  const result: GameData = {
    gameStatus,
    worldRules,
    regionalRules,
    personalRules,
    characters,
    player: playerOut,
    meta,
  };

  console.log('✅ [variableReader] 解析结果:', {
    gameStatus,
    worldRulesCount: worldRules.length,
    charactersCount: characters.length,
  });

  return result;
}

/**
 * 读取特定类型的数据
 */
export async function readCharacters(): Promise<CharacterData[]> {
  const data = await readGameData();
  return data.characters || [];
}

export async function readWorldRules(): Promise<RuleData[]> {
  const data = await readGameData();
  return data.worldRules || [];
}

export async function readRegionalRules(): Promise<RegionData[]> {
  const data = await readGameData();
  return data.regionalRules || [];
}

export async function readPersonalRules(): Promise<RuleData[]> {
  const data = await readGameData();
  return data.personalRules || [];
}

/** 个人规则按对象（人）分组，并区分启用/归档，用于折叠列表与顶部归档区 */
export function groupPersonalRulesByCharacter(rules: RuleData[]): { groupName: string; active: RuleData[]; archived: RuleData[] }[] {
  const map = new Map<string, { active: RuleData[]; archived: RuleData[] }>();
  for (const r of rules) {
    const key = (r as any).target ?? r.title ?? '未命名';
    if (!map.has(key)) map.set(key, { active: [], archived: [] });
    const bucket = map.get(key)!;
    if (r.status === 'active') bucket.active.push(r);
    else bucket.archived.push(r);
  }
  return Array.from(map.entries()).map(([groupName, { active, archived }]) => ({ groupName, active, archived }));
}

/** 区域规则中按区域汇总归档规则，用于顶部归档区 */
export function getRegionalArchivedGrouped(regions: RegionData[]): { regionName: string; archived: RuleData[] }[] {
  return regions
    .map((r) => ({
      regionName: r.name,
      archived: (r.rules || []).filter((rule) => rule.status !== 'active'),
    }))
    .filter((x) => x.archived.length > 0);
}

/**
 * 获取原始 MVU 数据（用于调试）
 */
export async function getRawMvuData(): Promise<MvuData> {
  return await getGameMvuData();
}

/**
 * 检查数据是否存在
 */
export async function hasGameData(): Promise<boolean> {
  try {
    const data = await getGameMvuData();
    return hasStatDataContent(data.stat_data);
  } catch (error) {
    return false;
  }
}

// 导出 pick 函数供其他模块使用
export { pick };
