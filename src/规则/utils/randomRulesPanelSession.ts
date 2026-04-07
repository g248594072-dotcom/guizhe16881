/**
 * 随机规则生成器状态：按「当前角色卡 + 当前聊天文件」持久化到 localStorage。
 * 聊天标识通常与酒馆界面一致，例如：规则模拟器V0.9 - 2026-04-07@18h57m58s359ms（即 SillyTavern.getCurrentChatId()）。
 * 同一键下关闭侧栏、刷新 iframe 后仍可恢复；换聊天或换角色卡后自动切换为对应缓存。
 */
import { ref, watch } from 'vue';

const STORAGE_VERSION = 'v2';

export interface RandomRulesSessionRule {
  id: string;
  title: string;
  desc: string;
  target?: string;
  regionName?: string;
}

interface PersistedPayload {
  v: number;
  generated: RandomRulesSessionRule[];
  appliedIds: string[];
  currentTheme: string;
}

/** 已生成的规则列表（可多次追加） */
export const randomRulesSessionGenerated = ref<RandomRulesSessionRule[]>([]);

/** 已应用过的规则 id */
export const randomRulesSessionAppliedIds = ref<string[]>([]);

/** 上次使用的主题 */
export const randomRulesSessionCurrentTheme = ref('');

/**
 * 生成 localStorage 键：角色卡 id + 聊天文件 id（名称），与当前会话绑定。
 */
export function getRandomRulesStorageKey(): string {
  let charId = '';
  let chatId = '';
  try {
    if (typeof SillyTavern !== 'undefined') {
      charId = String(SillyTavern.characterId ?? '').trim();
      if (typeof SillyTavern.getCurrentChatId === 'function') {
        chatId = String(SillyTavern.getCurrentChatId()).trim();
      }
    }
  } catch {
    /* ignore */
  }
  const scope = `${charId}||${chatId}`;
  const safe = scope === '||' ? 'default' : encodeURIComponent(scope);
  return `th_rule_sim_random_${STORAGE_VERSION}_${safe}`;
}

function loadPersisted(): PersistedPayload {
  const key = getRandomRulesStorageKey();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { v: 1, generated: [], appliedIds: [], currentTheme: '' };
    }
    const p = JSON.parse(raw) as Partial<PersistedPayload>;
    return {
      v: 1,
      generated: Array.isArray(p.generated) ? p.generated : [],
      appliedIds: Array.isArray(p.appliedIds) ? p.appliedIds : [],
      currentTheme: typeof p.currentTheme === 'string' ? p.currentTheme : '',
    };
  } catch {
    return { v: 1, generated: [], appliedIds: [], currentTheme: '' };
  }
}

function savePersisted(): void {
  const key = getRandomRulesStorageKey();
  try {
    const payload: PersistedPayload = {
      v: 1,
      generated: randomRulesSessionGenerated.value,
      appliedIds: randomRulesSessionAppliedIds.value,
      currentTheme: randomRulesSessionCurrentTheme.value,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('[randomRulesPanelSession] 写入 localStorage 失败:', e);
  }
}

let saveFlushScheduled = false;
function scheduleSavePersisted(): void {
  if (saveFlushScheduled) return;
  saveFlushScheduled = true;
  queueMicrotask(() => {
    saveFlushScheduled = false;
    savePersisted();
  });
}

watch(
  [randomRulesSessionGenerated, randomRulesSessionAppliedIds, randomRulesSessionCurrentTheme],
  scheduleSavePersisted,
  { deep: true },
);

/** 从当前聊天对应的 localStorage 键加载到内存（打开面板、切换聊天时调用） */
export function reloadRandomRulesSessionFromStorage(): void {
  const data = loadPersisted();
  randomRulesSessionGenerated.value = data.generated;
  randomRulesSessionAppliedIds.value = data.appliedIds;
  randomRulesSessionCurrentTheme.value = data.currentTheme;
  console.info(
    '[randomRulesPanelSession] 已加载缓存',
    getRandomRulesStorageKey(),
    `规则 ${data.generated.length} 条`,
  );
}

export function randomRulesSessionMarkApplied(id: string): void {
  if (!randomRulesSessionAppliedIds.value.includes(id)) {
    randomRulesSessionAppliedIds.value = [...randomRulesSessionAppliedIds.value, id];
  }
}

export function randomRulesSessionIsApplied(id: string): boolean {
  return randomRulesSessionAppliedIds.value.includes(id);
}
