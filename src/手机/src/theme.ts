/**
 * 小手机主题系统
 * 支持多套视觉风格，通过 CSS 变量动态切换
 */

export type PhoneTheme = 'modern' | 'elegant';

/** 主题显示名 */
export const THEME_LABELS: Record<PhoneTheme, string> = {
  modern: '现代简约',
  elegant: '优雅暗紫',
};

const STORAGE_KEY = 'tavern-phone-theme';

/** 现代简约主题（iOS 默认风格） */
export const modernThemeVars: Record<string, string> = {
  // 壁纸区域
  '--phone-bg-from': '#778899',
  '--phone-bg-via': '#2c3e50',
  '--phone-bg-to': '#1a252f',
  // 状态栏
  '--status-text': '#ffffff',
  '--status-shadow': '0 1px 2px rgba(0,0,0,0.85)',
  // App 图标
  '--app-icon-radius': '18px',
  '--app-icon-border': 'none',
  '--app-icon-shadow': '0 2px 4px rgba(0,0,0,0.15)',
  // Dock 栏
  '--dock-bg': 'rgba(255,255,255,0.25)',
  '--dock-border': 'rgba(255,255,255,0.1)',
  '--dock-shadow': '0 4px 20px rgba(0,0,0,0.2)',
  // 文字标签
  '--app-label-color': '#ffffff',
  '--app-label-shadow': '0 1px 3px rgba(0,0,0,0.8)',
  // App 内层背景
  '--app-content-bg': '#ffffff',
  // 主页指示条
  '--home-indicator': 'rgba(255,255,255,0.9)',
  // 动态岛
  '--dynamic-island-bg': '#000000',
  // 关闭按钮
  '--close-btn-bg': 'rgba(0,0,0,0.4)',
  '--close-btn-hover': 'rgba(0,0,0,0.55)',
  // 强调色
  '--accent': '#007AFF',
  '--accent-light': '#5AC8FA',
  // 设置页卡片
  '--card-bg': '#F2F2F7',
  '--card-border': 'rgba(0,0,0,0.06)',
  '--card-shadow': 'none',
  // 设置页文字
  '--settings-title': '#000000',
  '--settings-desc': '#8E8E93',
  // 输入框
  '--input-bg': '#F2F2F7',
  '--input-border': '#e5e5ea',
  '--input-text': '#000000',
  '--input-placeholder': '#c7c7cc',
  '--input-focus-ring': 'rgba(0,122,255,0.3)',
  // 主题切换卡片
  '--theme-card-bg': '#ffffff',
  '--theme-card-border': '#E5E5EA',
  '--theme-card-selected-border': '#6c5ce7',
  '--theme-card-selected-bg': '#6c5ce7',
};

/** 优雅暗紫主题（参考租客档案 APP 风格） */
export const elegantThemeVars: Record<string, string> = {
  // 壁纸区域 — 深色磨砂感
  '--phone-bg-from': '#2d1b69',
  '--phone-bg-via': '#1a1040',
  '--phone-bg-to': '#0f0a20',
  // 状态栏
  '--status-text': '#e8e4f0',
  '--status-shadow': '0 1px 2px rgba(0,0,0,0.9)',
  // App 图标 — 更大圆角，更多光泽
  '--app-icon-radius': '22px',
  '--app-icon-border': '1px solid rgba(255,255,255,0.15)',
  '--app-icon-shadow': '0 4px 12px rgba(108,92,231,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
  // Dock 栏 — 紫色半透明磨砂
  '--dock-bg': 'rgba(45,27,105,0.7)',
  '--dock-border': '1px solid rgba(255,255,255,0.12)',
  '--dock-shadow': '0 8px 32px rgba(108,92,231,0.3), 0 2px 8px rgba(0,0,0,0.3)',
  // 文字标签
  '--app-label-color': '#e0dcf5',
  '--app-label-shadow': '0 0 8px rgba(108,92,231,0.8), 0 1px 3px rgba(0,0,0,0.9)',
  // App 内层背景 — 深色
  '--app-content-bg': '#1a1530',
  // 主页指示条
  '--home-indicator': 'rgba(162,155,254,0.8)',
  // 动态岛
  '--dynamic-island-bg': '#1a1040',
  // 关闭按钮
  '--close-btn-bg': 'rgba(45,27,105,0.6)',
  '--close-btn-hover': 'rgba(108,92,231,0.7)',
  // 强调色
  '--accent': '#6c5ce7',
  '--accent-light': '#a29bfe',
  // 设置页卡片 — 深色卡片
  '--card-bg': 'rgba(30,23,60,0.8)',
  '--card-border': '1px solid rgba(108,92,231,0.25)',
  '--card-shadow': '0 4px 16px rgba(108,92,231,0.15)',
  // 设置页文字
  '--settings-title': '#e0dcf5',
  '--settings-desc': '#8E8E93',
  // 输入框
  '--input-bg': 'rgba(45,27,105,0.5)',
  '--input-border': 'rgba(108,92,231,0.4)',
  '--input-text': '#e0dcf5',
  '--input-placeholder': 'rgba(162,155,254,0.5)',
  '--input-focus-ring': 'rgba(108,92,231,0.4)',
  // 主题切换卡片
  '--theme-card-bg': 'rgba(45,27,105,0.6)',
  '--theme-card-border': 'rgba(108,92,231,0.3)',
  '--theme-card-selected-border': '#a29bfe',
  '--theme-card-selected-bg': 'rgba(108,92,231,0.3)',
};

/** 获取当前保存的主题，默认为 'modern' */
export function loadTheme(): PhoneTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'modern' || saved === 'elegant') return saved;
  } catch { /* ignore */ }
  return 'modern';
}

/** 保存主题到 localStorage */
export function saveTheme(theme: PhoneTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
}

/** 获取主题对应的 CSS 变量对象 */
export function getThemeVars(theme: PhoneTheme): Record<string, string> {
  return theme === 'elegant' ? elegantThemeVars : modernThemeVars;
}

/**
 * 动态注入 CSS 变量到 DOM 根节点
 * 如果 style 元素已存在则更新，否则创建
 */
export function injectThemeVars(vars: Record<string, string>): void {
  const styleId = 'phone-theme-vars';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  const css = `:root {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`;
  styleEl.textContent = css;
}
