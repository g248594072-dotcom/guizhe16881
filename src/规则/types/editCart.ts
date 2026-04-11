/**
 * 编辑暂存购物车：条目类型（与 App 弹窗表单、归档、角色详情、随机规则对齐）
 */

import type { ClothingStateZh, JewelryEditRow } from '../types';

export interface EditCartModalForm {
  addCharacterName: string;
  addCharacterDescription: string;
  worldRuleName: string;
  worldRuleDetail: string;
  regionName: string;
  regionDetail: string;
  regionFirstRuleName: string;
  regionRuleName: string;
  regionRuleDetail: string;
  personalRuleCharacter: string;
  /** MVU「名称」，与世界/区域弹窗「规则名称」对应 */
  personalRuleName: string;
  personalRuleDetail: string;
  characterPsychThought: string;
  characterPsychTraits: string;
  characterPsychFetishes: string;
  characterPsychSensitiveParts: string;
  characterPsychHiddenFetish: string;
  showFetishDetails: boolean;
  fetishDetails: Array<{ name: string; level: number; description: string; justification: string }>;
  showSensitivePartDetails: boolean;
  sensitivePartDetails: Array<{ name: string; level: number; reaction: string; devDetails: string }>;
  identityTags: Array<{ category: string; value: string }>;
  avatarUrl: string;
  /** 编辑服装状态 + 身体部位物理状态 */
  appearanceClothing: ClothingStateZh;
  appearanceJewelryRows: JewelryEditRow[];
  appearanceBodyPartRows: Array<{ key: string; 外观描述: string; 当前状态: string }>;
}

/** 与 apply 顺序分区一致：world → region → character → personal → avatar */
export type EditCartCategory = 'world' | 'region' | 'character' | 'personal' | 'avatar';

export type EditCartAction =
  | { kind: 'modal_commit'; modalType: string; form: EditCartModalForm; payload: Record<string, unknown> | null }
  | { kind: 'archive_world_rule'; title: string }
  | { kind: 'delete_world_rule'; title: string }
  | { kind: 'archive_region'; name: string }
  | { kind: 'delete_region'; name: string }
  | {
      kind: 'archive_regional_rule';
      regionName: string;
      ruleIdOrTitle: string;
      ruleSummary?: string;
    }
  | {
      kind: 'delete_regional_rule';
      regionName: string;
      ruleIdOrTitle: string;
      ruleSummary?: string;
    }
  | {
      kind: 'archive_personal_rule';
      idOrTitle: string;
      characterName?: string;
      ruleSummary?: string;
    }
  | {
      kind: 'delete_personal_rule';
      idOrTitle: string;
      characterName?: string;
      ruleSummary?: string;
    }
  | { kind: 'archive_personal_rules_group'; groupName: string }
  | { kind: 'delete_personal_rules_group'; groupName: string }
  | {
      kind: 'character_basic';
      characterId: string;
      data: Record<string, string | number | undefined>;
    }
  | { kind: 'delete_character'; characterId: string; characterName: string }
  | { kind: 'random_add_world'; title: string; desc: string }
  | { kind: 'random_add_regional'; regionId: string; regionName: string; title: string; desc: string }
  | { kind: 'random_add_personal'; target: string; ruleName: string; detail: string };

export interface EditCartItem {
  id: string;
  /** 同一键重复入队时覆盖上一条 */
  dedupeKey: string;
  label: string;
  category: EditCartCategory;
  action: EditCartAction;
}
