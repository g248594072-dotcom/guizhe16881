/**
 * 购物车确认后写入玩家楼 / 输入框的「本回合变更」紧凑中文摘要（一句一事，以。结尾，多条直连无分隔）。
 */
import type { EditCartAction, EditCartItem, EditCartModalForm } from '../types/editCart';

function t(s: unknown): string {
  return String(s ?? '').trim();
}

function hintModalCommit(modalType: string, form: EditCartModalForm, p: Record<string, unknown> | null): string {
  const pl = p ?? undefined;
  switch (modalType) {
    case 'add_character':
      // `[新增角色]` 正文由购物车 apply 时 `runModalCommit` 返回并写入输入框，此处不再生成摘要以免重复。
      return '';
    case 'add_world_rule':
      return `玩家添加世界规则：${t(form.worldRuleName)}。效果：${t(form.worldRuleDetail)}。`;
    case 'edit_world_rule': {
      const id = t((pl as { id?: unknown; title?: unknown })?.id ?? (pl as { title?: unknown })?.title);
      return `玩家编辑世界规则（${id || '？'}）：${t(form.worldRuleName)}。效果：${t(form.worldRuleDetail)}。`;
    }
    case 'add_region':
      return `玩家新增区域：${t(form.regionName)}。说明：${t(form.regionDetail)}。首条规则：${t(form.regionFirstRuleName)}。`;
    case 'edit_region': {
      const id = t((pl as { id?: unknown; name?: unknown })?.id ?? (pl as { name?: unknown })?.name);
      return `玩家编辑区域（${id || '？'}）：${t(form.regionName)}。说明：${t(form.regionDetail)}。`;
    }
    case 'add_region_rule': {
      const rn = t(form.regionName);
      return `玩家为区域「${rn || '？'}」新增规则：${t(form.regionRuleName)}。效果：${t(form.regionRuleDetail)}。`;
    }
    case 'edit_region_rule': {
      const rn = t((pl as { regionName?: unknown })?.regionName);
      const rid = t((pl as { rule?: { id?: unknown; title?: unknown } })?.rule?.id ?? (pl as { rule?: { title?: unknown } })?.rule?.title);
      return `玩家编辑区域「${rn || '？'}」规则（${rid || '？'}）：${t(form.regionRuleName)}。效果：${t(form.regionRuleDetail)}。`;
    }
    case 'add_personal_rule':
      return `玩家添加个人规则：适用「${t(form.personalRuleCharacter)}」，${t(form.personalRuleName)}。效果：${t(form.personalRuleDetail)}。`;
    case 'edit_personal_rule': {
      const id = t((pl as { id?: unknown; title?: unknown; character?: unknown })?.id ?? (pl as { title?: unknown })?.title ?? (pl as { character?: unknown })?.character);
      return `玩家编辑个人规则（${id || '？'}）：适用「${t(form.personalRuleCharacter)}」，${t(form.personalRuleName)}。效果：${t(form.personalRuleDetail)}。`;
    }
    case 'edit_character_mind': {
      const cid = t((pl as { characterId?: unknown })?.characterId);
      return `玩家编辑角色心理（${cid}）：内心「${t(form.characterPsychThought)}」；性格标签「${t(form.characterPsychTraits)}」。`;
    }
    case 'edit_character_fetish': {
      const cid = t((pl as { characterId?: unknown })?.characterId);
      return `玩家编辑角色性癖与敏感点（${cid}）：已更新性癖/敏感点/隐藏性癖等字段。`;
    }
    case 'edit_character_appearance': {
      const cid = t((pl as { characterId?: unknown })?.characterId);
      return `玩家更新角色外观与服装（${cid}）。`;
    }
    case 'edit_identity_tags': {
      const cid = t((pl as { characterId?: unknown })?.characterId);
      return `玩家编辑身份标签（${cid}）。`;
    }
    case 'edit_avatar':
      return '';
    default:
      return `玩家通过弹窗提交：${modalType}。`;
  }
}

export function buildStagingHintFromEditCartItem(item: EditCartItem): string {
  const a: EditCartAction = item.action;
  switch (a.kind) {
    case 'modal_commit':
      return hintModalCommit(a.modalType, a.form, a.payload);
    case 'archive_world_rule':
      return `玩家归档世界规则：${t(a.title)}。`;
    case 'delete_world_rule':
      return `玩家删除世界规则：${t(a.title)}。`;
    case 'archive_region':
      return `玩家归档区域：${t(a.name)}。`;
    case 'delete_region':
      return `玩家删除区域：${t(a.name)}。`;
    case 'archive_regional_rule':
      return `玩家归档区域规则：区域「${t(a.regionName)}」，规则「${t(a.ruleSummary ?? a.ruleIdOrTitle)}」。`;
    case 'delete_regional_rule':
      return `玩家删除区域规则：区域「${t(a.regionName)}」，规则「${t(a.ruleSummary ?? a.ruleIdOrTitle)}」。`;
    case 'archive_personal_rule':
      return `玩家归档个人规则：${t(a.idOrTitle)}${a.characterName ? `（${t(a.characterName)}）` : ''}。`;
    case 'delete_personal_rule':
      return `玩家删除个人规则：${t(a.idOrTitle)}${a.characterName ? `（${t(a.characterName)}）` : ''}。`;
    case 'archive_personal_rules_group':
      return `玩家归档个人规则分组：${t(a.groupName)}。`;
    case 'delete_personal_rules_group':
      return `玩家删除个人规则分组：${t(a.groupName)}。`;
    case 'character_basic': {
      const nm = t(a.data.name);
      return `玩家编辑角色基础信息（${t(a.characterId)}）${nm ? `：姓名「${nm}」` : ''}。`;
    }
    case 'delete_character':
      return `玩家删除角色：${t(a.characterName)}（${t(a.characterId)}）。`;
    case 'random_add_world':
      return `玩家添加世界规则：${t(a.title)}。效果：${t(a.desc)}。`;
    case 'random_add_regional':
      return `玩家为区域「${t(a.regionName)}」添加规则：${t(a.title)}。效果：${t(a.desc)}。`;
    case 'random_add_personal':
      return `玩家添加个人规则：适用「${t(a.target)}」，${t(a.ruleName)}。效果：${t(a.detail)}。`;
    case 'tactical_map_commit':
      return `玩家确认战术地图变更：${t(a.label) || '战术地图'}。`;
    case 'meta_world_info':
      return `玩家更新世界元信息：世界类型「${t(a.世界类型)}」；世界简介已同步。`;
    default:
      return '';
  }
}

/** 与购物车 `sortedItems()` 顺序一致传入时，输出为一条连续摘要串。 */
export function buildStagingHintsFromCartItems(items: EditCartItem[]): string {
  return items.map(buildStagingHintFromEditCartItem).filter(Boolean).join('');
}
