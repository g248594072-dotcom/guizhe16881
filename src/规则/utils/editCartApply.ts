/**
 * 执行购物车单条操作（与 App onModalComplete / 归档 / 角色详情 行为一致）
 */
import { tryRulesMvuWritable, useDataStore } from '../store';
import type { EditCartAction, EditCartModalForm } from '../types/editCart';

export async function runModalCommit(
  type: string,
  form: EditCartModalForm,
  payload: Record<string, unknown> | null,
): Promise<string> {
  if (!tryRulesMvuWritable()) return '';
  const p = payload ?? undefined;
  let messageText = '';

  if (type === 'add_character') {
    // 与主弹窗 onModalComplete 一致：只生成消息，由发送后 AI/第二 API 写入变量
    const { submitAddCharacter } = await import('./dialogAndVariable');
    messageText = await submitAddCharacter(form.addCharacterName, form.addCharacterDescription);
  } else if (type === 'add_world_rule') {
    const { submitAddWorldRule } = await import('./dialogAndVariable');
    messageText = await submitAddWorldRule(form.worldRuleName, form.worldRuleDetail);
  } else if (type === 'edit_world_rule' && (p?.id ?? p?.title)) {
    const { submitEditWorldRule } = await import('./dialogAndVariable');
    messageText = await submitEditWorldRule(
      String(p.id ?? p.title),
      form.worldRuleName,
      form.worldRuleDetail,
    );
  } else if (type === 'add_region') {
    const { submitAddRegion } = await import('./dialogAndVariable');
    messageText = await submitAddRegion(form.regionName, form.regionDetail, form.regionFirstRuleName);
  } else if (type === 'edit_region' && (p?.id ?? p?.name)) {
    const { submitEditRegion } = await import('./dialogAndVariable');
    messageText = await submitEditRegion(String(p.id ?? p.name), form.regionName, form.regionDetail);
  } else if (type === 'add_region_rule' && (p?.id ?? p?.name ?? p?.regionId ?? p?.regionName)) {
    const { submitAddRegionalRule } = await import('./dialogAndVariable');
    const regionId = String(p.id ?? p.name ?? p.regionId ?? p.regionName);
    const regionName = String(p.name ?? p.regionName ?? form.regionName);
    messageText = await submitAddRegionalRule(regionId, regionName, form.regionRuleName, form.regionRuleDetail);
  } else if (
    type === 'edit_region_rule' &&
    (p?.regionId ?? p?.regionName) &&
    (p as { rule?: { id?: string; title?: string } })?.rule &&
    ((p as { rule: { id?: string; title?: string } }).rule.id ??
      (p as { rule: { id?: string; title?: string } }).rule.title)
  ) {
    const { submitEditRegionalRule } = await import('./dialogAndVariable');
    const rule = (p as { rule: { id?: string; title?: string }; regionId?: string; regionName?: string }).rule;
    messageText = await submitEditRegionalRule(
      String(p.regionId ?? p.regionName),
      String(p.regionName),
      String(rule.id ?? rule.title),
      form.regionRuleName,
      form.regionRuleDetail,
    );
  } else if (type === 'add_personal_rule') {
    const { submitAddPersonalRule } = await import('./dialogAndVariable');
    messageText = await submitAddPersonalRule(form.personalRuleCharacter, form.personalRuleDetail);
  } else if (type === 'edit_personal_rule' && (p?.id ?? p?.title ?? p?.character)) {
    const { submitEditPersonalRule } = await import('./dialogAndVariable');
    messageText = await submitEditPersonalRule(
      String(p.id ?? p.title ?? p.character),
      form.personalRuleCharacter,
      form.personalRuleDetail,
    );
  } else if (type === 'edit_character_mind' && p?.characterId) {
    const { submitEditCharacterPsych } = await import('./dialogAndVariable');
    messageText = await submitEditCharacterPsych(String(p.characterId), {
      thought: form.characterPsychThought,
      traitsText: form.characterPsychTraits,
    });
  } else if (type === 'edit_character_fetish' && p?.characterId) {
    const {
      submitEditCharacterPsych,
      updateCharacterFetishDetails,
      updateCharacterSensitivePartDetails,
      formatFetishDetailMessage,
      formatSensitivePartDetailMessage,
    } = await import('./dialogAndVariable');
    const characterId = String(p.characterId);
    messageText = await submitEditCharacterPsych(characterId, {
      fetishesText: form.characterPsychFetishes,
      sensitivePartsText: form.characterPsychSensitiveParts,
      hiddenFetish: form.characterPsychHiddenFetish,
    });

    const validFetishDetails = form.fetishDetails?.filter(f => f.name?.trim()) ?? [];
    if (validFetishDetails.length > 0) {
      const mapped = validFetishDetails.map(f => ({
        name: f.name.trim(),
        level: f.level ?? 1,
        description: f.description ?? '',
        justification: f.justification ?? '',
      }));
      updateCharacterFetishDetails(characterId, mapped);
      messageText += '\n\n' + formatFetishDetailMessage(characterId, mapped);
    }

    const validSensitivePartDetails = form.sensitivePartDetails?.filter(x => x.name?.trim()) ?? [];
    if (validSensitivePartDetails.length > 0) {
      const mapped = validSensitivePartDetails.map(x => ({
        name: x.name.trim(),
        level: x.level ?? 1,
        reaction: x.reaction ?? '',
        devDetails: x.devDetails ?? '',
      }));
      updateCharacterSensitivePartDetails(characterId, mapped);
      messageText += '\n\n' + formatSensitivePartDetailMessage(characterId, mapped);
    }
  } else if (type === 'edit_identity_tags' && p?.characterId) {
    const { updateCharacterIdentityTags, formatIdentityTagsMessage } = await import('./dialogAndVariable');
    const validTags = form.identityTags?.filter(t => t.category?.trim() && t.value?.trim()) ?? [];
    const tagsObj: Record<string, string> = {};
    for (const t of validTags) {
      tagsObj[t.category.trim()] = t.value.trim();
    }
    const characterId = String(p.characterId);
    updateCharacterIdentityTags(characterId, tagsObj);
    messageText = formatIdentityTagsMessage(characterId, tagsObj);
  } else if (type === 'edit_character_appearance' && p?.characterId) {
    const {
      submitEditCharacterAppearance,
      defaultEmptyClothingState,
      applyJewelryRowsToClothing,
      normalizeJewelryEditRow,
    } = await import('./dialogAndVariable');
    const characterId = String(p.characterId);
    const base = form.appearanceClothing ?? defaultEmptyClothingState();
    const jewelryRows = (form.appearanceJewelryRows ?? []).map(normalizeJewelryEditRow);
    const clothing = applyJewelryRowsToClothing(base, jewelryRows);
    const body: Record<string, { 外观描述: string; 当前状态: string }> = {};
    for (const row of form.appearanceBodyPartRows ?? []) {
      const k = String(row.key ?? '').trim();
      if (!k) continue;
      body[k] = {
        外观描述: String(row.外观描述 ?? ''),
        当前状态: String(row.当前状态 ?? ''),
      };
    }
    messageText = await submitEditCharacterAppearance(characterId, {
      服装状态: clothing,
      身体部位物理状态: body,
    });
  } else if (type === 'edit_avatar' && p?.characterId) {
    const { submitEditCharacterAvatar } = await import('./dialogAndVariable');
    const store = useDataStore();
    const raw = store.data.角色档案?.[String(p.characterId)] as Record<string, unknown> | undefined;
    const displayName = String(raw?.姓名 ?? raw?.name ?? '').trim();
    await submitEditCharacterAvatar(String(p.characterId), form.avatarUrl, displayName || null);
    return '';
  } else {
    throw new Error(`未知的弹窗类型或缺少数据: ${type}`);
  }

  return messageText;
}

export async function applyEditCartAction(action: EditCartAction): Promise<string> {
  if (!tryRulesMvuWritable()) return '';
  const m = await import('./dialogAndVariable');

  switch (action.kind) {
    case 'archive_world_rule':
      await m.submitArchiveWorldRule(action.title);
      return '';
    case 'delete_world_rule':
      await m.submitDeleteWorldRule(action.title);
      return '';
    case 'archive_region':
      await m.submitArchiveRegion(action.name);
      return '';
    case 'delete_region':
      await m.submitDeleteRegion(action.name);
      return '';
    case 'archive_regional_rule':
      await m.submitArchiveRegionalRule(
        action.regionName,
        action.ruleIdOrTitle,
        action.ruleSummary,
      );
      return '';
    case 'delete_regional_rule':
      await m.submitDeleteRegionalRule(
        action.regionName,
        action.ruleIdOrTitle,
        action.ruleSummary,
      );
      return '';
    case 'archive_personal_rule':
      await m.submitArchivePersonalRule(action.idOrTitle, action.characterName, action.ruleSummary);
      return '';
    case 'delete_personal_rule':
      await m.submitDeletePersonalRule(action.idOrTitle, action.characterName, action.ruleSummary);
      return '';
    case 'archive_personal_rules_group':
      await m.submitArchivePersonalRulesForGroup(action.groupName);
      return '';
    case 'delete_personal_rules_group':
      await m.submitDeletePersonalRulesForGroup(action.groupName);
      return '';
    case 'character_basic':
      return await m.submitEditCharacterBasic(action.characterId, action.data);
    case 'delete_character':
      return await m.submitDeleteCharacter(action.characterId, action.characterName);
    case 'random_add_world':
      return await m.submitAddWorldRule(action.title, action.desc);
    case 'random_add_regional':
      return await m.submitAddRegionalRule(
        action.regionId,
        action.regionName,
        action.title,
        action.desc,
      );
    case 'random_add_personal':
      return await m.submitAddPersonalRule(action.target, action.detail);
    case 'modal_commit':
      return await runModalCommit(action.modalType, action.form, action.payload);
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return '';
    }
  }
}
