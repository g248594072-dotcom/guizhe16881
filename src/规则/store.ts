/**
 * MVU ZOD Store
 * 提供响应式的变量访问和修改
 */

import { defineMvuDataStore } from '@util/mvu';
import { Schema } from './schema';
import type { CharacterData, RuleData, RegionData } from './types';
import {
  getMergedSensitiveDevelopment,
  normalizeFetishRecord,
  normalizeTagMap,
} from './utils/tagMap';

/** 首次 `useDataStore()` 时写入：本 iframe 是否绑定 latest 并可写回（历史层为 false） */
let rulesMvuLiveHostAtInit: boolean | null = null;

/**
 * 主数据存储
 * 使用 defineMvuDataStore 自动与酒馆变量同步
 *
 * **分层读写（避免多 iframe 争用 latest）**
 * - iframe 挂在**当前聊天最后一条消息**（`getCurrentMessageId() === getLastMessageId()`）时：绑定 `message_id: -1` 并 **写回**，与「总状态在最后一层」一致。
 * - 挂在**历史楼层**时：绑定 `getCurrentMessageId()` 且 **writeBack: false**，只读该层快照，不向酒馆写入，避免旧层顶掉最新层变量。
 *
 * 见 `@types/function/variables.d.ts`：负数下标 `-1` 为最新楼层。
 */
export const useDataStore = defineMvuDataStore(
  Schema,
  () => {
    const mid = getCurrentMessageId();
    const last = getLastMessageId();
    const live = mid === last;
    rulesMvuLiveHostAtInit = live;
    return { type: 'message', message_id: live ? -1 : mid };
  },
  undefined,
  () => ({
    writeBack: rulesMvuLiveHostAtInit === true,
  }),
);

/** 须在首次 `useDataStore()` 之后调用；用于只读 UI 等与 store 绑定一致的判断 */
export function isRulesMvuLiveHostAtInit(): boolean {
  return rulesMvuLiveHostAtInit === true;
}

/** 历史楼层只读快照（无 toast，供底层 *ToVariables 快速短路） */
export function isRulesMvuArchiveSnapshot(): boolean {
  return rulesMvuLiveHostAtInit === false;
}

/**
 * 历史楼层快照（writeBack=false）时返回 false 并提示。
 * `rulesMvuLiveHostAtInit === null` 时视为未初始化，不拦截。
 */
export function tryRulesMvuWritable(): boolean {
  if (rulesMvuLiveHostAtInit === false) {
    toastr.warning('当前为历史楼层快照，仅可查看；请在最后一条消息上的面板中编辑。');
    return false;
  }
  return true;
}

/**
 * 获取角色列表（响应式）
 */
export function useCharacters() {
  const store = useDataStore();
  return computed((): CharacterData[] => {
    const chars = store.data.角色档案 || {};
    return Object.entries(chars).map(([id, char]) => {
      const name = (char.姓名 && char.姓名 !== '未知' && char.姓名.trim() !== '')
        ? char.姓名
        : (char.name || id);
      const description = char.描写 || char.description || char.desc || '';
      const status = char.状态 === '出场中' ? 'active' : 'inactive';

      const currentThought = char.当前内心想法 || char.currentThought || '';
      const traits = normalizeTagMap(char.性格 ?? char.traits);
      // 性癖和敏感点开发（旧键「敏感部位」）是复杂对象结构，不走 normalizeTagMap
      // 它们在下面的 fetishDetails / sensitivePartDetails 中正确解析
      const hiddenFetish = char.隐藏性癖 || char.hiddenFetish || '';

      const body = char.身体信息 || {};
      const stats = char.数值 || {};

      // 性癖详情（含等级、细节描述、自我合理化）
      const fetishDetails: Record<string, { level: number; description: string; justification: string }> = {};
      const rawFetishes = normalizeFetishRecord(char.性癖 || char.fetishes || {});
      if (rawFetishes && typeof rawFetishes === 'object') {
        for (const [key, val] of Object.entries(rawFetishes)) {
          fetishDetails[key] = {
            level: val.等级 ?? 1,
            description: val.细节描述 ?? '',
            justification: val.自我合理化 ?? '',
          };
        }
      }

      // 敏感点开发详情（含敏感等级、生理反应、开发细节）；合并旧键「敏感部位」
      const sensitivePartDetails: Record<string, { level: number; reaction: string; devDetails: string }> = {};
      const rawSensitiveParts = getMergedSensitiveDevelopment(char);
      if (rawSensitiveParts && typeof rawSensitiveParts === 'object') {
        for (const [key, val] of Object.entries(rawSensitiveParts)) {
          sensitivePartDetails[key] = {
            level: val.敏感等级 ?? 1,
            reaction: val.生理反应 ?? '',
            devDetails: val.开发细节 ?? '',
          };
        }
      }

      // 身份标签
      const identityTags = char.身份标签 || char.identityTags || {};

      const 服装状态 =
        char.服装状态 != null && typeof char.服装状态 === 'object' && !Array.isArray(char.服装状态)
          ? (char.服装状态 as CharacterData['服装状态'])
          : undefined;
      const 身体部位物理状态 =
        char.身体部位物理状态 != null &&
        typeof char.身体部位物理状态 === 'object' &&
        !Array.isArray(char.身体部位物理状态)
          ? (char.身体部位物理状态 as CharacterData['身体部位物理状态'])
          : undefined;

      return {
        id,
        name,
        description,
        status,
        basic: {
          age: String(body.年龄 || body.age || ''),
          height: String(body.身高 || body.height || ''),
          weight: String(body.体重 || body.weight || ''),
          threeSize: body.三围 || body.threeSize || '',
          physique: body.体质特征 || body.physique || '',
        },
        stats: {
          affection: stats.好感度 || stats.affection || char.affection || 0,
          fetish: stats.性癖开发值 || stats.fetish || char.fetish_dev || char.fetish || 0,
          lust: stats.发情值 || stats.lust || char.estrus || char.lust || 0,
        },
        currentThought,
        traits,
        // 性癖和敏感点开发：从复杂对象生成可读的字符串格式供UI展示
        fetishes: Object.fromEntries(
          Object.entries(fetishDetails).map(([k, v]) => [
            k,
            v.description || `${k}（等级${v.level}）`,
          ]),
        ),
        sensitiveParts: Object.fromEntries(
          Object.entries(sensitivePartDetails).map(([k, v]) => [
            k,
            v.reaction || `${k}（敏感等级${v.level}）`,
          ]),
        ),
        hiddenFetish,
        currentPhysiologicalDesc: char.当前综合生理描述 || char.currentPhysiologicalDesc || '',
        fetishDetails,
        sensitivePartDetails,
        identityTags,
        服装状态,
        身体部位物理状态,
      };
    });
  });
}

/**
 * 获取世界规则列表（响应式）
 */
export function useWorldRules() {
  const store = useDataStore();
  return computed((): RuleData[] => {
    const rules = store.data.世界规则 || {};
    const ruleEntries = Object.entries(rules);

    // 如果有世界规则数据，解析并返回
    if (ruleEntries.length > 0) {
      return ruleEntries.map(([title, rule]) => {
        // 支持中文字段和英文字段回退
        const displayTitle = rule.名称 || rule.name || title;
        const desc = rule.效果描述 || rule.desc || rule.description || '';
        const status = rule.状态 === '生效中' || rule.active === true ? 'active' : 'inactive';
        const tag = rule.标记 || rule.tag;

        return {
          id: `world-${title}`,
          title: displayTitle,
          desc,
          status,
          category: 'world' as const,
          tag,
        };
      });
    }

    // 如果世界规则为空，从 openingConfig.selectedRules 构建
    const selectedRules = store.data.openingConfig?.selectedRules;
    if (selectedRules && Array.isArray(selectedRules) && selectedRules.length > 0) {
      return selectedRules.map((r: any) => ({
        id: `world-${r.name}`,
        title: r.name,
        desc: r.desc || '',
        status: 'active' as const,
        category: 'world' as const,
      }));
    }

    return [];
  });
}

/**
 * 获取区域规则（响应式）
 */
export function useRegionalRules() {
  const store = useDataStore();
  return computed((): RegionData[] => {
    const regions = store.data.区域规则 || {};
    return Object.entries(regions).map(([name, region]) => ({
      id: `region-${name}`,
      name: region.名称 || name,
      description: region.效果描述,
      status: region.状态 === '生效中' ? 'active' : 'inactive',
      rules: Object.entries(region.细分规则 || {}).map(([subName, sub]) => ({
        id: `regional-${name}-${subName}`,
        title: subName,
        desc: sub.描述,
        status: sub.状态 === '生效中' ? 'active' : 'inactive',
        category: 'regional',
      })),
    }));
  });
}

/**
 * 获取个人规则（响应式）
 */
export function usePersonalRules() {
  const store = useDataStore();
  return computed((): RuleData[] => {
    const rules = store.data.个人规则 || {};
    return Object.entries(rules).map(([id, rule]) => ({
      id: `personal-${id}`,
      title: rule.名称 || rule.适用对象 || id,
      desc: rule.效果描述,
      status: rule.状态 === '生效中' ? 'active' : 'inactive',
      category: 'personal',
      target: rule.适用对象,
      tag: rule.标记,
    }));
  });
}

/**
 * 按角色分组的个人规则
 */
export function usePersonalRulesByCharacter() {
  const rules = usePersonalRules();
  return computed(() => {
    const map = new Map<string, { active: RuleData[]; archived: RuleData[] }>();
    for (const r of rules.value) {
      const key = r.target || r.title || '未命名';
      if (!map.has(key)) map.set(key, { active: [], archived: [] });
      const bucket = map.get(key)!;
      if (r.status === 'active') bucket.active.push(r);
      else bucket.archived.push(r);
    }
    return Array.from(map.entries()).map(([groupName, { active, archived }]) => ({
      groupName,
      active,
      archived,
    }));
  });
}

/**
 * 区域规则中按区域汇总归档规则，用于顶部归档区
 */
export function useRegionalArchivedGrouped() {
  const regions = useRegionalRules();
  return computed(() => {
    return regions.value
      .map((r) => ({
        regionName: r.name,
        archived: (r.rules || []).filter((rule) => rule.status !== 'active'),
      }))
      .filter((x) => x.archived.length > 0);
  });
}

/**
 * 获取元信息
 */
export function useMetaInfo() {
  const store = useDataStore();
  return computed(() => store.data.元信息);
}

/**
 * 更新元信息中的最近更新时间
 */
export function bumpUpdateTime() {
  if (isRulesMvuArchiveSnapshot()) return;
  const store = useDataStore();
  store.data.元信息.最近更新时间 = Date.now();
}

/**
 * 推进游戏内时间（修改变量）
 * 推进指定分钟数，触发 schema 的 transform 处理进位
 */
export function advanceGameTime(minutes: number) {
  if (!tryRulesMvuWritable()) return;
  const store = useDataStore();
  const gameTime = store.data.游戏时间;
  if (gameTime) {
    gameTime.分 += Math.round(minutes);
    console.log(`[Store] 游戏内时间推进 ${minutes} 分钟`, gameTime);
  }
}

/**
 * 设置游戏时间到指定值
 */
export function setGameTime(time: { 年?: number; 月?: number; 日?: number; 时?: number; 分?: number }) {
  if (!tryRulesMvuWritable()) return;
  const store = useDataStore();
  const gameTime = store.data.游戏时间;
  if (gameTime) {
    if (time.年 !== undefined) gameTime.年 = time.年;
    if (time.月 !== undefined) gameTime.月 = time.月;
    if (time.日 !== undefined) gameTime.日 = time.日;
    if (time.时 !== undefined) gameTime.时 = time.时;
    if (time.分 !== undefined) gameTime.分 = time.分;
    console.log(`[Store] 游戏时间已设置`, gameTime);
  }
}
