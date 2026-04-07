/**
 * 其他设置管理工具
 * 管理输入行为模式等杂项设置
 */

import type { OtherSettings, InputActionMode } from '../types';
import { DEFAULT_OTHER_SETTINGS } from '../types';
import { useDataStore } from '../store';
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
    };
  } catch (error) {
    console.warn('⚠️ [otherSettings] 获取其他设置失败，使用默认值:', error);
    return local ?? { ...DEFAULT_OTHER_SETTINGS };
  }
}

/**
 * 保存其他设置（同时写入 MVU 与 localStorage，供 `getInputActionMode` 与界面一致）
 * 传入部分字段时会与当前设置合并，避免覆盖未传入的项。
 */
export function saveOtherSettings(partial: Partial<OtherSettings>): boolean {
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
