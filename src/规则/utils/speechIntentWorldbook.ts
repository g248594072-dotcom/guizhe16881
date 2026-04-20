/**
 * 抢话 / 防抢话：在当前角色绑定世界书中，对四条互斥条目按设置只启用其一。
 */

import type { SpeechIntentWorldbookMode } from '../types';
import {
  SPEECH_INTENT_WORLDBOOK_NAME_VARIANTS,
  SPEECH_INTENT_WORLD_MODES,
} from '../types';
import { getCurrentCharWorldbookName } from './apiSettings';

function compactName(s: string): string {
  return String(s || '').replace(/\s+/g, '').trim();
}

/** 判断世界书条目名称属于哪一种抢话/防抢话模式 */
export function classifySpeechIntentWorldbookEntry(entryName: string): SpeechIntentWorldbookMode | null {
  const t = String(entryName || '').trim();
  const c = compactName(t);
  for (const mode of SPEECH_INTENT_WORLD_MODES) {
    for (const variant of SPEECH_INTENT_WORLDBOOK_NAME_VARIANTS[mode]) {
      const vc = compactName(variant);
      if (t === variant || c === vc) return mode;
    }
  }
  return null;
}

export type ApplySpeechIntentResult = {
  ok: boolean;
  message?: string;
  intentEntryCount?: number;
};

/**
 * 在当前角色卡绑定的世界书中，仅启用 `mode` 对应条目，其余三条同名族条目关闭。
 */
export async function applySpeechIntentWorldbookMode(
  mode: SpeechIntentWorldbookMode,
): Promise<ApplySpeechIntentResult> {
  try {
    const worldbookName = getCurrentCharWorldbookName()?.trim();
    if (!worldbookName) {
      return { ok: false, message: '当前角色卡未绑定世界书，无法切换抢话/防抢话条目' };
    }
    const entries = await getWorldbook(worldbookName);
    if (!entries?.length) {
      return { ok: false, message: '世界书为空或无法读取' };
    }

    let intentEntryCount = 0;
    const updated = entries.map((e) => {
      const classified = classifySpeechIntentWorldbookEntry(e.name || '');
      if (!classified) return e;
      intentEntryCount += 1;
      return { ...e, enabled: classified === mode };
    });

    if (intentEntryCount === 0) {
      return {
        ok: false,
        message:
          '未找到四条抢话/防抢话条目。请确认世界书条目名称与「【防抢话】一般防抢话！」等完全一致（或仅多一处 】后空格）。',
        intentEntryCount: 0,
      };
    }

    await replaceWorldbook(worldbookName, updated, { render: 'debounced' });
    console.info('✅ [speechIntentWorldbook] 已同步抢话意向世界书条目:', { mode, intentEntryCount });
    return { ok: true, intentEntryCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('❌ [speechIntentWorldbook] 应用失败:', e);
    return { ok: false, message: msg };
  }
}
