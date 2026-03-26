/** 与 App / SettingsPanel 共用的界面布局结构（存于 player.settings.uiLayout） */
export type UiLayoutSettings = {
  scale: number;
  maxWidth: number;
  heightMode: 'fit' | 'custom';
  maxHeight: number;
};

/** 主游戏界面高度（非全屏）可配置范围，与 iframe 兜底最小高度一致 */
export const UI_MAIN_HEIGHT_MIN_PX = 600;
export const UI_MAIN_HEIGHT_MAX_PX = 1000;
export const UI_MAIN_HEIGHT_DEFAULT_PX = 600;

/** 主界面最大宽度可配置范围（适配窄屏如 300×800，最大边 300） */
export const UI_MAIN_WIDTH_MIN_PX = 300;
export const UI_MAIN_WIDTH_MAX_PX = 2400;
export const UI_MAIN_WIDTH_DEFAULT_PX = 900;

export function clampMainUiHeightPx(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return UI_MAIN_HEIGHT_DEFAULT_PX;
  return Math.min(UI_MAIN_HEIGHT_MAX_PX, Math.max(UI_MAIN_HEIGHT_MIN_PX, v));
}

export function clampMainUiWidthPx(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return UI_MAIN_WIDTH_DEFAULT_PX;
  return Math.min(UI_MAIN_WIDTH_MAX_PX, Math.max(UI_MAIN_WIDTH_MIN_PX, v));
}
