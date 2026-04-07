/**
 * 随机规则生成器：会话级状态（关闭侧栏、切换 Tab 不丢失，直至整页刷新）
 */
import { ref } from 'vue';

export interface RandomRulesSessionRule {
  id: string;
  title: string;
  desc: string;
  target?: string;
  regionName?: string;
}

/** 已生成的规则列表（可多次追加） */
export const randomRulesSessionGenerated = ref<RandomRulesSessionRule[]>([]);

/** 已应用过的规则 id（与列表项 id 对应） */
export const randomRulesSessionAppliedIds = ref<string[]>([]);

/** 上次使用的主题（重新打开主题弹窗时预填） */
export const randomRulesSessionCurrentTheme = ref('');

export function randomRulesSessionMarkApplied(id: string): void {
  if (!randomRulesSessionAppliedIds.value.includes(id)) {
    randomRulesSessionAppliedIds.value = [...randomRulesSessionAppliedIds.value, id];
  }
}

export function randomRulesSessionIsApplied(id: string): boolean {
  return randomRulesSessionAppliedIds.value.includes(id);
}
