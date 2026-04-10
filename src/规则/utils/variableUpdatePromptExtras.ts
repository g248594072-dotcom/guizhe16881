/**
 * 变量更新提示词片段：与本项目 applyJsonPatch(target=stat_data) 行为一致。
 * 供第二 API、单独重 roll 变量等路径注入，避免与世界书内容漂移。
 */

/**
 * 从当前 stat_data 提取个人规则对象键名，提示模型 replace 同路径而非重复 add。
 */
export function formatPersonalRuleKeysSection(statData: Record<string, unknown> | null | undefined): string {
  const raw = statData?.['个人规则'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return '';
  }
  const keys = Object.keys(raw as object);
  if (keys.length === 0) {
    return '';
  }
  const lines = keys.map((k) => `- \`${k}\``).join('\n');
  return (
    `## 当前「个人规则」对象已有键名\n` +
    `更新既有个人规则时，必须 **replace** 路径 \`/个人规则/<键>\`；**禁止**为同一角色/同一语义再 **add** 新键（除非业务确需并存）。\n` +
    `${lines}\n\n`
  );
}

/** 注入第二 API / 变量重 roll：RFC 6902 子集 + path 根 + 反重复 */
export const VARIABLE_JSON_PATCH_RUNTIME_RULES = [
  '## JSON Patch 与本界面合并约定（强制执行）',
  '- **path 根**：path 均相对于 **stat_data** 根（**禁止** `/stat_data/...` 前缀）。',
  '- **允许的 op**：仅 **replace**、**add**、**remove**、**move**。本界面 **不支持** `delta`、`copy`、`merge` 等扩展；改数字必须用 **replace** 写入**计算后的绝对值**。',
  '- **避免冗余**：「当前变量数据」里已在正确路径且正文未要求修改的规则，**不要**再整段 replace；不要为同一语义造第二条路径。',
  '- **路径示例**（键名随当回合实际 id 替换）：',
  '  - 世界：`/世界规则/<规则键>`',
  '  - 区域子规则：`/区域规则/<区域名>/细分规则/<子规则名>`（**禁止** `/区域规则/<子规则名>` 把规则名误当区域名）',
  '  - 个人：`/个人规则/<已有键名或 PR-时间戳>`',
  '  - 数值：`/角色档案/<角色键>/数值/发情值`（**禁止** `/角色档案/<id>/发情值`）',
  '',
].join('\n');
