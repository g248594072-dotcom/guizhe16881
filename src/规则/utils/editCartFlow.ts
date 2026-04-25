/**
 * 编辑购物车：开关判断、入队 vs 立即执行、构造条目
 */
import { klona } from 'klona';
import { useEditCartStore } from '../stores/editCart';
import type { EditCartCategory, EditCartItem, EditCartModalForm } from '../types/editCart';
import type { TacticalMapCommitPatchOp } from './tacticalMapCommitSendBox';
import { getOtherSettings } from './otherSettings';
import { buildAddCharacterCombinedBrief } from './recruitModalBrief';

export function isEditCartEnabled(): boolean {
  return getOtherSettings().enableEditStagingCart === true;
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function categoryForModalType(modalType: string): EditCartCategory {
  switch (modalType) {
    case 'add_world_rule':
    case 'edit_world_rule':
      return 'world';
    case 'add_region':
    case 'edit_region':
    case 'add_region_rule':
    case 'edit_region_rule':
      return 'region';
    case 'add_character':
    case 'edit_character_mind':
    case 'edit_character_fetish':
    case 'edit_identity_tags':
    case 'edit_character_appearance':
      return 'character';
    case 'add_personal_rule':
    case 'edit_personal_rule':
      return 'personal';
    case 'edit_avatar':
      return 'avatar';
    default:
      return 'character';
  }
}

export function buildModalCartItem(
  modalType: string,
  form: EditCartModalForm,
  payload: Record<string, unknown> | null,
  label: string,
  dedupeKey: string,
): EditCartItem {
  return {
    id: newId(),
    dedupeKey,
    label,
    category: categoryForModalType(modalType),
    action: {
      kind: 'modal_commit',
      modalType,
      form: klona(form) as EditCartModalForm,
      payload: payload ? (klona(payload) as Record<string, unknown>) : null,
    },
  };
}

export function buildArchiveWorldItem(title: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `archive_world:${title}`,
    label: `归档世界规则：${title}`,
    category: 'world',
    action: { kind: 'archive_world_rule', title },
  };
}

export function buildDeleteWorldItem(title: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `delete_world:${title}`,
    label: `删除世界规则：${title}`,
    category: 'world',
    action: { kind: 'delete_world_rule', title },
  };
}

export function buildArchiveRegionItem(name: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `archive_region:${name}`,
    label: `归档区域：${name}`,
    category: 'region',
    action: { kind: 'archive_region', name },
  };
}

export function buildDeleteRegionItem(name: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `delete_region:${name}`,
    label: `删除区域：${name}`,
    category: 'region',
    action: { kind: 'delete_region', name },
  };
}

export function buildArchiveRegionalRuleItem(
  regionName: string,
  ruleIdOrTitle: string,
  ruleSummary?: string,
): EditCartItem {
  const key = `archive_rr:${regionName}:${ruleIdOrTitle}`;
  return {
    id: newId(),
    dedupeKey: key,
    label: `归档区域规则：${regionName} / ${ruleSummary ?? ruleIdOrTitle}`,
    category: 'region',
    action: { kind: 'archive_regional_rule', regionName, ruleIdOrTitle, ruleSummary },
  };
}

export function buildDeleteRegionalRuleItem(
  regionName: string,
  ruleIdOrTitle: string,
  ruleSummary?: string,
): EditCartItem {
  const key = `delete_rr:${regionName}:${ruleIdOrTitle}`;
  return {
    id: newId(),
    dedupeKey: key,
    label: `删除区域规则：${regionName} / ${ruleSummary ?? ruleIdOrTitle}`,
    category: 'region',
    action: { kind: 'delete_regional_rule', regionName, ruleIdOrTitle, ruleSummary },
  };
}

export function buildArchivePersonalItem(
  idOrTitle: string,
  characterName?: string,
  ruleSummary?: string,
  label?: string,
): EditCartItem {
  const key = `archive_personal:${idOrTitle}:${characterName ?? ''}`;
  return {
    id: newId(),
    dedupeKey: key,
    label: label ?? `归档个人规则：${characterName ?? idOrTitle}`,
    category: 'personal',
    action: { kind: 'archive_personal_rule', idOrTitle, characterName, ruleSummary },
  };
}

export function buildCharacterBasicItem(
  characterId: string,
  data: Record<string, string | number | undefined>,
  displayName: string,
): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `character_basic:${characterId}`,
    label: `编辑角色基础信息：${displayName || characterId}`,
    category: 'character',
    action: { kind: 'character_basic', characterId, data },
  };
}

export function buildDeleteCharacterItem(characterId: string, characterName: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `delete_character:${characterId}`,
    label: `删除角色：${characterName}`,
    category: 'character',
    action: { kind: 'delete_character', characterId, characterName },
  };
}

export function buildArchivePersonalFromPayload(payload: Record<string, unknown>): EditCartItem {
  const id = String(payload.id ?? payload.title ?? payload.character ?? '');
  const character = payload.character != null ? String(payload.character) : undefined;
  const title = payload.title != null ? String(payload.title) : undefined;
  const ruleSummary = title !== character ? title : undefined;
  return buildArchivePersonalItem(id, character, ruleSummary);
}

export function buildDeletePersonalFromPayload(payload: Record<string, unknown>): EditCartItem {
  const id = String(payload.id ?? payload.title ?? payload.character ?? '');
  const character = payload.character != null ? String(payload.character) : undefined;
  const title = payload.title != null ? String(payload.title) : undefined;
  const ruleSummary = title !== character ? title : undefined;
  const key = `delete_personal:${id}:${character ?? ''}`;
  return {
    id: newId(),
    dedupeKey: key,
    label: `删除个人规则：${character ?? id}`,
    category: 'personal',
    action: { kind: 'delete_personal_rule', idOrTitle: id, characterName: character, ruleSummary },
  };
}

export function buildArchivePersonalRulesGroupItem(groupName: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `archive_personal_group:${groupName}`,
    label: `归档个人规则（本对象）：${groupName}`,
    category: 'personal',
    action: { kind: 'archive_personal_rules_group', groupName },
  };
}

export function buildDeletePersonalRulesGroupItem(groupName: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `delete_personal_group:${groupName}`,
    label: `删除个人规则（本对象）：${groupName}`,
    category: 'personal',
    action: { kind: 'delete_personal_rules_group', groupName },
  };
}

export function buildRandomWorldItem(title: string, desc: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `random_world:${title}`,
    label: `随机规则 → 世界：${title}`,
    category: 'world',
    action: { kind: 'random_add_world', title, desc },
  };
}

export function buildRandomRegionalItem(
  regionId: string,
  regionName: string,
  title: string,
  desc: string,
): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `random_regional:${regionId}:${title}`,
    label: `随机规则 → 区域「${regionName}」：${title}`,
    category: 'region',
    action: { kind: 'random_add_regional', regionId, regionName, title, desc },
  };
}

export function buildRandomPersonalItem(target: string, ruleName: string, detail: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: `random_personal:${target}:${ruleName}:${detail.slice(0, 40)}`,
    label: `随机规则 → 个人：${target}（${ruleName}）`,
    category: 'personal',
    action: { kind: 'random_add_personal', target, ruleName, detail },
  };
}

export function stageItem(item: EditCartItem): void {
  const cart = useEditCartStore();
  cart.addOrReplaceItem(item);
  toastr.info(`已加入暂存（共 ${cart.pendingCount} 项），请打开购物车统一提交`);
}

/** 战术地图「确认应用」在开启购物车时入队；dedupeKey 固定以便多次确认覆盖为最新一批 Patch */
export function buildTacticalMapCartItem(patches: TacticalMapCommitPatchOp[], label: string): EditCartItem {
  return {
    id: newId(),
    dedupeKey: 'tactical_map_commit:latest',
    label: label.trim() || '战术地图变量',
    category: 'world',
    action: { kind: 'tactical_map_commit', patches, label: label.trim() || '战术地图变量' },
  };
}

/** 元信息.世界类型 / 世界简介；同键覆盖为最新一次编辑 */
export function buildMetaWorldInfoCartItem(世界类型: string, 世界简介: string): EditCartItem {
  const t = String(世界类型 ?? '')
    .trim()
    .slice(0, 64) || '现代';
  const intro = String(世界简介 ?? '').slice(0, 2000);
  return {
    id: newId(),
    dedupeKey: 'meta:world_info',
    label: `世界元信息：${t.length > 20 ? `${t.slice(0, 20)}…` : t}`,
    category: 'world',
    action: { kind: 'meta_world_info', 世界类型: t, 世界简介: intro },
  };
}

/**
 * 根据 action 内容重算 label / dedupeKey / category（编辑暂存项保存时调用，保留 item.id）
 */
export function refreshEditCartItem(item: EditCartItem): EditCartItem {
  const a = item.action;
  switch (a.kind) {
    case 'archive_world_rule':
      return {
        ...item,
        dedupeKey: `archive_world:${a.title}`,
        label: `归档世界规则：${a.title}`,
        category: 'world',
        action: { kind: 'archive_world_rule', title: a.title },
      };
    case 'delete_world_rule':
      return {
        ...item,
        dedupeKey: `delete_world:${a.title}`,
        label: `删除世界规则：${a.title}`,
        category: 'world',
        action: { kind: 'delete_world_rule', title: a.title },
      };
    case 'archive_region':
      return {
        ...item,
        dedupeKey: `archive_region:${a.name}`,
        label: `归档区域：${a.name}`,
        category: 'region',
        action: { kind: 'archive_region', name: a.name },
      };
    case 'delete_region':
      return {
        ...item,
        dedupeKey: `delete_region:${a.name}`,
        label: `删除区域：${a.name}`,
        category: 'region',
        action: { kind: 'delete_region', name: a.name },
      };
    case 'archive_regional_rule':
      return {
        ...item,
        dedupeKey: `archive_rr:${a.regionName}:${a.ruleIdOrTitle}`,
        label: `归档区域规则：${a.regionName} / ${a.ruleSummary ?? a.ruleIdOrTitle}`,
        category: 'region',
        action: { ...a },
      };
    case 'delete_regional_rule':
      return {
        ...item,
        dedupeKey: `delete_rr:${a.regionName}:${a.ruleIdOrTitle}`,
        label: `删除区域规则：${a.regionName} / ${a.ruleSummary ?? a.ruleIdOrTitle}`,
        category: 'region',
        action: { ...a },
      };
    case 'archive_personal_rule': {
      const key = `archive_personal:${a.idOrTitle}:${a.characterName ?? ''}`;
      return {
        ...item,
        dedupeKey: key,
        label: `归档个人规则：${a.characterName ?? a.idOrTitle}`,
        category: 'personal',
        action: { ...a },
      };
    }
    case 'delete_personal_rule': {
      const key = `delete_personal:${a.idOrTitle}:${a.characterName ?? ''}`;
      return {
        ...item,
        dedupeKey: key,
        label: `删除个人规则：${a.characterName ?? a.idOrTitle}`,
        category: 'personal',
        action: { ...a },
      };
    }
    case 'archive_personal_rules_group':
      return {
        ...item,
        dedupeKey: `archive_personal_group:${a.groupName}`,
        label: `归档个人规则（本对象）：${a.groupName}`,
        category: 'personal',
        action: { kind: 'archive_personal_rules_group', groupName: a.groupName },
      };
    case 'delete_personal_rules_group':
      return {
        ...item,
        dedupeKey: `delete_personal_group:${a.groupName}`,
        label: `删除个人规则（本对象）：${a.groupName}`,
        category: 'personal',
        action: { kind: 'delete_personal_rules_group', groupName: a.groupName },
      };
    case 'character_basic': {
      const dn = String(a.data.name ?? '').trim() || item.label;
      return {
        ...item,
        dedupeKey: `character_basic:${a.characterId}`,
        label: `编辑角色基础信息：${dn || a.characterId}`,
        category: 'character',
        action: { kind: 'character_basic', characterId: a.characterId, data: { ...a.data } },
      };
    }
    case 'delete_character':
      return {
        ...item,
        dedupeKey: `delete_character:${a.characterId}`,
        label: `删除角色：${a.characterName}`,
        category: 'character',
        action: { kind: 'delete_character', characterId: a.characterId, characterName: a.characterName },
      };
    case 'random_add_world':
      return {
        ...item,
        dedupeKey: `random_world:${a.title}`,
        label: `随机规则 → 世界：${a.title}`,
        category: 'world',
        action: { ...a },
      };
    case 'random_add_regional':
      return {
        ...item,
        dedupeKey: `random_regional:${a.regionId}:${a.title}`,
        label: `随机规则 → 区域「${a.regionName}」：${a.title}`,
        category: 'region',
        action: { ...a },
      };
    case 'random_add_personal':
      return {
        ...item,
        dedupeKey: `random_personal:${a.target}:${a.ruleName}:${a.detail.slice(0, 40)}`,
        label: `随机规则 → 个人：${a.target}（${a.ruleName}）`,
        category: 'personal',
        action: { ...a },
      };
    case 'modal_commit': {
      const built = buildCartItemFromModal(a.modalType, a.form, a.payload);
      if (!built) {
        return item;
      }
      return {
        ...item,
        label: built.label,
        dedupeKey: built.dedupeKey,
        category: built.category,
        action: {
          kind: 'modal_commit',
          modalType: a.modalType,
          form: a.form,
          payload: a.payload,
        },
      };
    }
    case 'tactical_map_commit':
      return {
        ...item,
        dedupeKey: 'tactical_map_commit:latest',
        label: a.label,
        category: 'world',
        action: { kind: 'tactical_map_commit', patches: [...a.patches], label: a.label },
      };
    case 'meta_world_info': {
      const t = String(a.世界类型 ?? '')
        .trim()
        .slice(0, 64) || '现代';
      const intro = String(a.世界简介 ?? '').slice(0, 2000);
      return {
        ...item,
        dedupeKey: 'meta:world_info',
        label: `世界元信息：${t.length > 20 ? `${t.slice(0, 20)}…` : t}`,
        category: 'world',
        action: { kind: 'meta_world_info', 世界类型: t, 世界简介: intro },
      };
    }
    default:
      return item;
  }
}

/**
 * 由当前弹窗类型构造购物车条目；无法识别时返回 null。
 */
export function buildCartItemFromModal(
  modalType: string,
  form: EditCartModalForm,
  payload: Record<string, unknown> | null,
): EditCartItem | null {
  const p = payload;

  /** 新增角色：`AI生成` 候选人仍不入队；「正文输出角色」走购物车（与 `onModalComplete` 一致）。 */
  if (modalType === 'add_character') {
    const intro = String(form.addCharacterDescription ?? '').trim();
    if (!intro) return null;
    const brief = buildAddCharacterCombinedBrief(form).trim();
    const snippet = brief.replace(/\s+/g, ' ');
    const short = snippet.length > 28 ? `${snippet.slice(0, 28)}…` : snippet;
    return buildModalCartItem(
      modalType,
      form,
      p,
      `新增角色（正文）：${short || '（待定）'}`,
      'add_character:body-output:latest',
    );
  }
  if (modalType === 'add_world_rule') {
    return buildModalCartItem(
      modalType,
      form,
      p,
      `新增世界规则：${form.worldRuleName || '（未命名）'}`,
      `add_world:${form.worldRuleName}`,
    );
  }
  if (modalType === 'edit_world_rule' && (p?.id ?? p?.title)) {
    const id = String(p.id ?? p.title);
    return buildModalCartItem(modalType, form, p, `编辑世界规则：${form.worldRuleName || id}`, `edit_world:${id}`);
  }
  if (modalType === 'add_region') {
    return buildModalCartItem(
      modalType,
      form,
      p,
      `新增区域：${form.regionName || '（未命名）'}`,
      `add_region:${form.regionName}`,
    );
  }
  if (modalType === 'edit_region' && (p?.id ?? p?.name)) {
    const id = String(p.id ?? p.name);
    return buildModalCartItem(modalType, form, p, `编辑区域：${form.regionName || id}`, `edit_region:${id}`);
  }
  if (modalType === 'add_region_rule' && (p?.id ?? p?.name ?? p?.regionId ?? p?.regionName)) {
    const regionId = String(p.id ?? p.name ?? p.regionId ?? p.regionName);
    return buildModalCartItem(
      modalType,
      form,
      p,
      `新增区域规则：${form.regionRuleName || '（未命名）'}`,
      `add_rr:${regionId}:${form.regionRuleName}`,
    );
  }
  if (
    modalType === 'edit_region_rule' &&
    (p?.regionId ?? p?.regionName) &&
    (p as { rule?: { id?: string; title?: string } })?.rule &&
    ((p as { rule: { id?: string; title?: string } }).rule.id ??
      (p as { rule: { id?: string; title?: string } }).rule.title)
  ) {
    const rule = (p as { rule: { id?: string; title?: string } }).rule;
    const rid = String(rule.id ?? rule.title);
    const regionId = String(p.regionId ?? p.regionName);
    return buildModalCartItem(
      modalType,
      form,
      p,
      `编辑区域规则：${form.regionRuleName || rid}`,
      `edit_rr:${regionId}:${rid}`,
    );
  }
  if (modalType === 'add_personal_rule') {
    return buildModalCartItem(
      modalType,
      form,
      p,
      `新增个人规则：${form.personalRuleName || '（未命名）'} → ${form.personalRuleCharacter || '（角色）'}`,
      `add_personal:${form.personalRuleCharacter}:${form.personalRuleName}`,
    );
  }
  if (modalType === 'edit_personal_rule' && (p?.id ?? p?.title ?? p?.character)) {
    const id = String(p.id ?? p.title ?? p.character);
    return buildModalCartItem(
      modalType,
      form,
      p,
      `编辑个人规则：${form.personalRuleName || '（未命名）'} → ${form.personalRuleCharacter || id}`,
      `edit_personal:${id}`,
    );
  }
  if (modalType === 'edit_character_mind' && p?.characterId) {
    const cid = String(p.characterId);
    return buildModalCartItem(modalType, form, p, `编辑角色心理：${cid}`, `mind:${cid}`);
  }
  if (modalType === 'edit_character_fetish' && p?.characterId) {
    const cid = String(p.characterId);
    return buildModalCartItem(modalType, form, p, `编辑性癖/敏感：${cid}`, `fetish:${cid}`);
  }
  if (modalType === 'edit_identity_tags' && p?.characterId) {
    const cid = String(p.characterId);
    return buildModalCartItem(modalType, form, p, `编辑身份标签：${cid}`, `identity:${cid}`);
  }
  if (modalType === 'edit_character_appearance' && p?.characterId) {
    const cid = String(p.characterId);
    return buildModalCartItem(modalType, form, p, `编辑外观与身体状态：${cid}`, `appearance:${cid}`);
  }
  if (modalType === 'edit_avatar' && p?.characterId) {
    const cid = String(p.characterId);
    return buildModalCartItem(modalType, form, p, `头像（本机）：${cid}`, `avatar:${cid}`);
  }

  return null;
}
