/**
 * 本地设置管理工具
 * 使用浏览器 localStorage 持久化存储设置
 */

import type { OutputMode, SecondaryApiConfig, InputActionMode, OtherSettings } from '../types';
import type { UiLayoutSettings } from './uiLayoutLimits';
import { DEFAULT_SECONDARY_API_CONFIG } from './secondaryApiDefaults';

function clampSecondaryRetriesLoaded(n: unknown): number {
  const x = Math.floor(Number(n));
  if (Number.isNaN(x)) return DEFAULT_SECONDARY_API_CONFIG.maxRetries;
  return Math.min(10, Math.max(0, x));
}

/** localStorage 键名 */
const STORAGE_KEYS = {
  outputMode: 'rule_modifier_output_mode',
  secondaryApi: 'rule_modifier_secondary_api',
  uiLayout: 'rule_modifier_ui_layout',
  otherSettings: 'rule_modifier_other_settings',
} as const;

/** 默认界面布局设置 */
const DEFAULT_UI_LAYOUT: UiLayoutSettings = {
  scale: 0.8,
  maxWidth: 900,
  maxHeight: 600,
  heightMode: 'fit',
};

/**
 * 保存输出模式到 localStorage
 */
export function saveOutputMode(mode: OutputMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.outputMode, mode);
  } catch (error) {
    console.warn('⚠️ [localSettings] 保存输出模式失败:', error);
  }
}

/**
 * 从 localStorage 加载输出模式
 */
export function loadOutputMode(): OutputMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.outputMode);
    if (saved === 'single' || saved === 'dual') {
      return saved;
    }
  } catch (error) {
    console.warn('⚠️ [localSettings] 加载输出模式失败:', error);
  }
  return 'dual';
}

/**
 * 保存第二API配置到 localStorage
 */
export function saveSecondaryApiConfig(config: SecondaryApiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.secondaryApi, JSON.stringify(config));
  } catch (error) {
    console.warn('⚠️ [localSettings] 保存第二API配置失败:', error);
  }
}

/**
 * 从 localStorage 加载第二API配置
 */
export function loadSecondaryApiConfig(): SecondaryApiConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.secondaryApi);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_SECONDARY_API_CONFIG,
        url: parsed.url ?? DEFAULT_SECONDARY_API_CONFIG.url,
        key: parsed.key ?? DEFAULT_SECONDARY_API_CONFIG.key,
        model: parsed.model ?? DEFAULT_SECONDARY_API_CONFIG.model,
        maxRetries: clampSecondaryRetriesLoaded(parsed.maxRetries ?? DEFAULT_SECONDARY_API_CONFIG.maxRetries),
        useTavernMainConnection: parsed.useTavernMainConnection ?? DEFAULT_SECONDARY_API_CONFIG.useTavernMainConnection,
        tasks: {
          includeVariableUpdate: parsed.tasks?.includeVariableUpdate ?? DEFAULT_SECONDARY_API_CONFIG.tasks.includeVariableUpdate,
          includeWorldTrend: parsed.tasks?.includeWorldTrend ?? DEFAULT_SECONDARY_API_CONFIG.tasks.includeWorldTrend,
          includeResidentLife: parsed.tasks?.includeResidentLife ?? DEFAULT_SECONDARY_API_CONFIG.tasks.includeResidentLife,
        },
      };
    }
  } catch (error) {
    console.warn('⚠️ [localSettings] 加载第二API配置失败:', error);
  }
  return { ...DEFAULT_SECONDARY_API_CONFIG };
}

/**
 * 保存界面布局设置到 localStorage
 */
export function saveUiLayout(layout: UiLayoutSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.uiLayout, JSON.stringify(layout));
  } catch (error) {
    console.warn('⚠️ [localSettings] 保存界面布局失败:', error);
  }
}

/**
 * 从 localStorage 加载界面布局设置
 */
export function loadUiLayout(): UiLayoutSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.uiLayout);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        scale: Number(parsed.scale) || DEFAULT_UI_LAYOUT.scale,
        maxWidth: Number(parsed.maxWidth) || DEFAULT_UI_LAYOUT.maxWidth,
        maxHeight: Number(parsed.maxHeight) || DEFAULT_UI_LAYOUT.maxHeight,
        heightMode: parsed.heightMode || DEFAULT_UI_LAYOUT.heightMode,
      };
    }
  } catch (error) {
    console.warn('⚠️ [localSettings] 加载界面布局失败:', error);
  }
  return { ...DEFAULT_UI_LAYOUT };
}

/**
 * 保存其他设置到 localStorage
 */
export function saveOtherSettingsLocal(settings: OtherSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.otherSettings, JSON.stringify(settings));
  } catch (error) {
    console.warn('⚠️ [localSettings] 保存其他设置失败:', error);
  }
}

/**
 * 从 localStorage 加载其他设置
 */
/** 与 `types.DEFAULT_OTHER_SETTINGS` 保持一致（此处不引用 types 默认值，避免与 apiSettings 的循环依赖） */
const DEFAULT_OTHER_LOCAL: OtherSettings = {
  inputActionMode: 'append',
  enableShujukuPlotAdvance: true,
  enableShujukuManualUpdateAfterConfirm: true,
  enableEditStagingCart: true,
};

export function loadOtherSettings(): OtherSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.otherSettings);
    if (saved) {
      const parsed = JSON.parse(saved);
      const plotAdvance =
        typeof parsed.enableShujukuPlotAdvance === 'boolean'
          ? parsed.enableShujukuPlotAdvance
          : typeof parsed.enableShujukuIntegration === 'boolean'
            ? parsed.enableShujukuIntegration
            : DEFAULT_OTHER_LOCAL.enableShujukuPlotAdvance;
      return {
        inputActionMode: (parsed.inputActionMode as InputActionMode) || DEFAULT_OTHER_LOCAL.inputActionMode,
        enableShujukuPlotAdvance: plotAdvance,
        enableShujukuManualUpdateAfterConfirm:
          typeof parsed.enableShujukuManualUpdateAfterConfirm === 'boolean'
            ? parsed.enableShujukuManualUpdateAfterConfirm
            : DEFAULT_OTHER_LOCAL.enableShujukuManualUpdateAfterConfirm,
        enableEditStagingCart:
          typeof parsed.enableEditStagingCart === 'boolean'
            ? parsed.enableEditStagingCart
            : DEFAULT_OTHER_LOCAL.enableEditStagingCart,
      };
    }
  } catch (error) {
    console.warn('⚠️ [localSettings] 加载其他设置失败:', error);
  }
  return { ...DEFAULT_OTHER_LOCAL };
}

/**
 * 清除所有本地设置
 */
export function clearAllLocalSettings(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    console.log('✅ [localSettings] 所有本地设置已清除');
  } catch (error) {
    console.warn('⚠️ [localSettings] 清除设置失败:', error);
  }
}

/** 导出常量供外部使用（DEFAULT_OTHER_LOCAL 与 types.DEFAULT_OTHER_SETTINGS 一致） */
export { DEFAULT_UI_LAYOUT, DEFAULT_OTHER_LOCAL as DEFAULT_OTHER_SETTINGS, STORAGE_KEYS };
