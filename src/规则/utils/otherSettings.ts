/**
 * 其他设置管理工具
 * 管理输入行为模式等杂项设置
 */

import type { OtherSettings, InputActionMode } from '../types';
import { DEFAULT_OTHER_SETTINGS, parseSpeechIntentWorldbookMode } from '../types';
import { tryRulesMvuWritable, useDataStore } from '../store';
import { loadOtherSettings, saveOtherSettingsLocal } from './localSettings';

function readOtherFromLocalStorage(): OtherSettings | null {
  try {
    return loadOtherSettings();
  } catch {
    return null;
  }
}

/**
 * 获取其他设置（MVU `player.settings.other` 优先，否则回退 localStorage）
 */
export function getOtherSettings(): OtherSettings {
  const local = readOtherFromLocalStorage();
  try {
    const store = useDataStore();
    const player = (store.data as any).player;
    const settings = player?.settings?.other;

    return {
      inputActionMode:
        settings?.inputActionMode ??
        local?.inputActionMode ??
        DEFAULT_OTHER_SETTINGS.inputActionMode,
      enableShujukuPlotAdvance:
        typeof settings?.enableShujukuPlotAdvance === 'boolean'
          ? settings.enableShujukuPlotAdvance
          : typeof (settings as { enableShujukuIntegration?: boolean })?.enableShujukuIntegration === 'boolean'
            ? (settings as { enableShujukuIntegration: boolean }).enableShujukuIntegration
            : typeof local?.enableShujukuPlotAdvance === 'boolean'
              ? local.enableShujukuPlotAdvance
              : DEFAULT_OTHER_SETTINGS.enableShujukuPlotAdvance,
      enableShujukuManualUpdateAfterConfirm:
        typeof settings?.enableShujukuManualUpdateAfterConfirm === 'boolean'
          ? settings.enableShujukuManualUpdateAfterConfirm
          : typeof local?.enableShujukuManualUpdateAfterConfirm === 'boolean'
            ? local.enableShujukuManualUpdateAfterConfirm
            : DEFAULT_OTHER_SETTINGS.enableShujukuManualUpdateAfterConfirm,
      enableEditStagingCart:
        typeof settings?.enableEditStagingCart === 'boolean'
          ? settings.enableEditStagingCart
          : typeof local?.enableEditStagingCart === 'boolean'
            ? local.enableEditStagingCart
            : DEFAULT_OTHER_SETTINGS.enableEditStagingCart,
      copyStagingChangeHintsToInput:
        typeof settings?.copyStagingChangeHintsToInput === 'boolean'
          ? settings.copyStagingChangeHintsToInput
          : typeof local?.copyStagingChangeHintsToInput === 'boolean'
            ? local.copyStagingChangeHintsToInput
            : DEFAULT_OTHER_SETTINGS.copyStagingChangeHintsToInput,
      showGameTimeHud:
        typeof settings?.showGameTimeHud === 'boolean'
          ? settings.showGameTimeHud
          : typeof local?.showGameTimeHud === 'boolean'
            ? local.showGameTimeHud
            : DEFAULT_OTHER_SETTINGS.showGameTimeHud,
      speechIntentWorldbookMode: parseSpeechIntentWorldbookMode(
        settings?.speechIntentWorldbookMode ?? local?.speechIntentWorldbookMode,
      ),
      recruitVariableCopyPrefix:
        typeof settings?.recruitVariableCopyPrefix === 'string'
          ? settings.recruitVariableCopyPrefix
          : typeof local?.recruitVariableCopyPrefix === 'string'
            ? local.recruitVariableCopyPrefix
            : DEFAULT_OTHER_SETTINGS.recruitVariableCopyPrefix,
      recruitVariableCopySuffixTemplate:
        typeof settings?.recruitVariableCopySuffixTemplate === 'string'
          ? settings.recruitVariableCopySuffixTemplate
          : typeof local?.recruitVariableCopySuffixTemplate === 'string'
            ? local.recruitVariableCopySuffixTemplate
            : DEFAULT_OTHER_SETTINGS.recruitVariableCopySuffixTemplate,
    };
  } catch (error) {
    console.warn('⚠️ [otherSettings] 获取其他设置失败，使用默认值:', error);
    return { ...DEFAULT_OTHER_SETTINGS, ...(local ?? {}) };
  }
}

/**
 * 保存其他设置（同时写入 MVU 与 localStorage，供 `getInputActionMode` 与界面一致）
 * 传入部分字段时会与当前设置合并，避免覆盖未传入的项。
 */
export function saveOtherSettings(partial: Partial<OtherSettings>): boolean {
  if (!tryRulesMvuWritable()) return false;
  const settings: OtherSettings = {
    ...getOtherSettings(),
    ...partial,
  };
  try {
    saveOtherSettingsLocal(settings);

    const store = useDataStore();

    if (!(store.data as any).player) {
      (store.data as any).player = { name: '玩家', settings: {} };
    }
    if (!(store.data as any).player.settings) {
      (store.data as any).player.settings = {};
    }
    (store.data as any).player.settings.other = settings;

    console.log('✅ [otherSettings] 设置已保存:', settings);
    return true;
  } catch (error) {
    console.error('❌ [otherSettings] 保存设置失败:', error);
    return false;
  }
}

/**
 * 设置输入行为模式
 * @param mode 模式：'send' 直接发送，'append' 追加到输入框
 * @returns 是否成功
 */
export function setInputActionMode(mode: InputActionMode): boolean {
  return saveOtherSettings({ inputActionMode: mode });
}

/** 是否启用数据库剧情推进（发送前标记意图） */
export function getEnableShujukuPlotAdvance(): boolean {
  return getOtherSettings().enableShujukuPlotAdvance;
}

/** 是否在本界面确认标签并写入 AI 楼层后调用数据库「立即手动更新」 */
export function getEnableShujukuManualUpdateAfterConfirm(): boolean {
  return getOtherSettings().enableShujukuManualUpdateAfterConfirm;
}

/**
 * 获取当前输入行为模式
 * @returns 当前模式
 */
export function getInputActionMode(): InputActionMode {
  const settings = getOtherSettings();
  return settings.inputActionMode;
}

/**
 * 切换输入行为模式
 * @returns 切换后的模式
 */
export function toggleInputActionMode(): InputActionMode {
  const current = getInputActionMode();
  const next = current === 'send' ? 'append' : 'send';
  setInputActionMode(next);
  return next;
}
