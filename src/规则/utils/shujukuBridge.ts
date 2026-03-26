/**
 * 神·数据库（AutoCardUpdater / shujuku）可选联动：未安装插件时全部静默跳过。
 */
import { getOtherSettings } from './otherSettings';

type AcuApi = { manualUpdate: () => Promise<boolean> };

/**
 * 在父窗口 / top / 当前窗口查找 `window.AutoCardUpdaterAPI`（酒馆扩展注入位置因环境而异）。
 */
export function resolveAutoCardUpdaterApi(): AcuApi | null {
  const candidates: Window[] = [];
  try {
    candidates.push(window.parent);
  } catch {
    /* cross-origin */
  }
  try {
    if (window.top !== window) {
      candidates.push(window.top);
    }
  } catch {
    /* cross-origin */
  }
  candidates.push(window);

  for (const w of candidates) {
    try {
      const api = (w as unknown as { AutoCardUpdaterAPI?: unknown }).AutoCardUpdaterAPI;
      if (api && typeof (api as AcuApi).manualUpdate === 'function') {
        return api as AcuApi;
      }
    } catch {
      /* cross-origin */
    }
  }
  return null;
}

/**
 * 标签验证确认且 AI 楼层已写入后：若设置开启且插件存在，则调用「立即手动更新」。
 */
export async function runShujukuManualUpdateAfterAssistantSaved(): Promise<void> {
  if (!getOtherSettings().enableShujukuManualUpdateAfterConfirm) {
    return;
  }
  const api = resolveAutoCardUpdaterApi();
  if (!api) {
    console.info('[规则] 已开启神·数据库联动，但未检测到 AutoCardUpdaterAPI，已跳过');
    return;
  }
  try {
    await api.manualUpdate();
  } catch (e) {
    console.warn('[规则] AutoCardUpdaterAPI.manualUpdate 失败:', e);
  }
}
