import type { EditCartModalForm } from '../types/editCart';

/** 招募弹窗 / 购物车编辑：拼成传给模型与 Patch 前缀的用户说明 */
export function buildAddCharacterCombinedBrief(form: EditCartModalForm): string {
  const nm = String(form.addCharacterName ?? '').trim();
  const rel = String(form.addCharacterRelationIdentity ?? '').trim();
  const req = String(form.addCharacterDescription ?? '').trim();
  const parts: string[] = [];
  if (nm) parts.push(`【名字】\n${nm}`);
  if (rel) parts.push(`【关系和身份】\n${rel}`);
  if (req) parts.push(`【角色简介】\n${req}`);
  return parts.join('\n\n');
}

/** 是否已填写必填项「角色简介」 */
export function hasAddCharacterBriefInput(form: EditCartModalForm): boolean {
  return String(form.addCharacterDescription ?? '').trim().length > 0;
}

/**
 * 生成 `[新增角色]` 正文的「简单描述」：去掉 `buildAddCharacterCombinedBrief` 的分段标题，多段压成一行。
 */
export function squashRecruitBriefForAddCharacterMessage(text: string): string {
  let t = String(text ?? '').trim();
  if (!t) return '';
  t = t.replace(/^【名字】\s*\r?\n?/m, '');
  t = t.replace(/^【关系和身份】\s*\r?\n?/m, '');
  t = t.replace(/^【角色简介】\s*\r?\n?/m, '');
  t = t.replace(/^【招募需求\s*\/\s*角色期望】\s*\r?\n?/m, '');
  t = t.replace(/^【招募需求】\s*\r?\n?/m, '');
  return t.replace(/\s*\n+\s*/g, ' ').replace(/ +/g, ' ').trim();
}
