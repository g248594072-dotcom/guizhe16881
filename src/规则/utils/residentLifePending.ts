/**
 * 居民生活 / NPC 侧说明：在个人规则变更或跨游戏日后标记待刷新，
 * 在变量已提交到楼层后统一尝试一次第二 API（与 generateResidentLifeAggregated 合并生成）。
 */

import { loadSecondaryApiConfig } from './localSettings';

declare const SillyTavern: { getCurrentChatId?: () => string };

function chatId(): string {
  return SillyTavern.getCurrentChatId?.() || 'default';
}

const key = () => `th_resident_life_flush_${chatId()}`;

interface FlushState {
  /** 个人规则在界面或补丁中变更后置 true */
  pendingPersonalRule: boolean;
  /** 上次成功生成居民生活时的游戏内日期键，如 "2026-4-8" */
  lastFlushedGameDayKey: string | null;
}

function loadState(): FlushState {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) {
      return { pendingPersonalRule: false, lastFlushedGameDayKey: null };
    }
    const p = JSON.parse(raw) as Partial<FlushState>;
    return {
      pendingPersonalRule: Boolean(p.pendingPersonalRule),
      lastFlushedGameDayKey:
        typeof p.lastFlushedGameDayKey === 'string' ? p.lastFlushedGameDayKey : null,
    };
  } catch {
    return { pendingPersonalRule: false, lastFlushedGameDayKey: null };
  }
}

function saveState(s: FlushState): void {
  try {
    localStorage.setItem(key(), JSON.stringify(s));
  } catch (e) {
    console.warn('[ResidentLifePending] 保存状态失败:', e);
  }
}

function gameDayKeyFromStat(statData: Record<string, unknown>): string | null {
  const gt = statData['游戏时间'] as Record<string, number> | undefined;
  if (!gt || typeof gt !== 'object') return null;
  const 年 = Number(gt['年']);
  const 月 = Number(gt['月']);
  const 日 = Number(gt['日']);
  if (!Number.isFinite(年) || !Number.isFinite(月) || !Number.isFinite(日)) return null;
  return `${年}-${月}-${日}`;
}

function countInactiveCharacters(statData: Record<string, unknown>): number {
  const chars = statData['角色档案'] as Record<string, { 状态?: string }> | undefined;
  if (!chars || typeof chars !== 'object') return 0;
  return Object.values(chars).filter((c) => c && typeof c === 'object' && c.状态 !== '出场中').length;
}

/** 个人规则在界面新增/编辑后调用（不再立即请求第二 API） */
export function markResidentLifePendingPersonalRule(): void {
  const s = loadState();
  s.pendingPersonalRule = true;
  saveState(s);
  console.log('[ResidentLifePending] 已标记：待下次变量提交后刷新居民生活');
}

/** JSON Patch 触及个人规则路径时调用 */
export function markPendingIfPersonalRulePatches(
  patches: Array<{ path?: string; from?: string }> | null | undefined,
): void {
  if (!patches?.length) return;
  for (const p of patches) {
    const paths = [p.path, (p as { from?: string }).from].filter(Boolean) as string[];
    for (const raw of paths) {
      const segs = raw.replace(/^\//, '').split('/').filter(Boolean);
      if (segs[0] === '个人规则' && segs[1]) {
        markResidentLifePendingPersonalRule();
        return;
      }
    }
  }
}

/**
 * 在 stat_data 已提交到当前聊天后调用：若个人规则待刷新或已进入新的游戏日，则聚合调用一次居民生活生成。
 */
export async function tryFlushPendingResidentLife(statData: Record<string, unknown>): Promise<void> {
  const config = loadSecondaryApiConfig();
  if (!config?.tasks?.includeResidentLife) {
    return;
  }

  const { generateResidentLifeAggregated } = await import('./worldLifeGenerator');

  const curKey = gameDayKeyFromStat(statData);
  const state = loadState();

  const dayAdvanced =
    curKey != null &&
    state.lastFlushedGameDayKey != null &&
    curKey !== state.lastFlushedGameDayKey;

  const shouldFlush = state.pendingPersonalRule || dayAdvanced;

  if (!shouldFlush) {
    return;
  }

  if (countInactiveCharacters(statData) === 0) {
    const next = loadState();
    next.pendingPersonalRule = false;
    if (curKey != null) {
      next.lastFlushedGameDayKey = curKey;
    }
    saveState(next);
    console.log('[ResidentLifePending] 无退场/未出场角色，跳过第二 API，已清除待刷新标记');
    return;
  }

  const ok = await generateResidentLifeAggregated(statData);
  if (ok) {
    const next = loadState();
    next.pendingPersonalRule = false;
    if (curKey != null) {
      next.lastFlushedGameDayKey = curKey;
    }
    saveState(next);
    try {
      const { default: toastr } = await import('toastr');
      toastr.success('已更新居民生活 / NPC 状态说明（第二 API）');
    } catch {
      // ignore
    }
  }
}
