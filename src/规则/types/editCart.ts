/**
 * 编辑暂存购物车：条目类型（与 App 弹窗表单、归档、角色详情、随机规则对齐）
 */

import type { ClothingBodyGarmentEditRow, ClothingStateZh, JewelryEditRow } from '../types';
import type { TacticalMapCommitPatchOp } from '../utils/tacticalMapCommitSendBox';

export interface EditCartModalForm {
  /** 保留字段；招募弹窗主要用关系/身份与角色简介 */
  addCharacterName: string;
  /** 与主角或他人的关系、身份定位（单行） */
  addCharacterRelationIdentity: string;
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
  /** 编辑背景与档案（角色简介、描写、代表性发言、爱好） */
  backgroundCharacterIntro: string;
  backgroundDescription: string;
  backgroundSpeechRows: Array<{ context: string; line: string }>;
  backgroundHobbyRows: Array<{ name: string; level: number; reason: string }>;
  avatarUrl: string;
  /** 编辑服装状态 + 身体部位物理状态（身体槽用多行；饰品仍用 appearanceJewelryRows） */
  appearanceClothing: ClothingStateZh;
  /** 身体槽「上装/下装…」多件：服装名为行内 name，写入 MVU 时为对应槽的 object 键 */
  appearanceBodyGarmentRows: ClothingBodyGarmentEditRow[];
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
  | { kind: 'random_add_personal'; target: string; ruleName: string; detail: string }
  /** 战术地图确认：仅含最小 JSON Patch，由购物车统一 apply */
  | { kind: 'tactical_map_commit'; patches: TacticalMapCommitPatchOp[]; label: string }
  /** MVU「元信息.世界类型 / 世界简介」；dedupeKey 固定 meta:world_info 覆盖 */
  | { kind: 'meta_world_info'; 世界类型: string; 世界简介: string };

export interface EditCartItem {
  id: string;
  /** 同一键重复入队时覆盖上一条 */
  dedupeKey: string;
  label: string;
  category: EditCartCategory;
  action: EditCartAction;
}
