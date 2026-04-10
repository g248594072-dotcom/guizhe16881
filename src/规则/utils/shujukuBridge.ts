/**
 * 数据库（AutoCardUpdater / shujuku）可选联动：未安装插件时全部静默跳过。
 */
import { getOtherSettings } from './otherSettings';

type AcuApi = {
  manualUpdate: () => Promise<boolean>;
};

type AcuTemplateInjectResult = { success?: boolean; message?: string };

type AcuTemplateApi = {
  importTemplateFromData?: (data: unknown) => Promise<AcuTemplateInjectResult>;
  initGameSession?: (
    session: Record<string, unknown>,
    options: { injectTemplate: boolean; loadPreset: boolean; templateData: unknown },
  ) => Promise<AcuTemplateInjectResult>;
};

function pickTemplateApi(raw: unknown): AcuTemplateApi | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const api = raw as AcuTemplateApi;
  if (typeof api.importTemplateFromData === 'function' || typeof api.initGameSession === 'function') {
    return api;
  }
  return null;
}

/**
 * 查找可提供模板导入的 `AutoCardUpdaterAPI`（支持 `importTemplateFromData` 或 `initGameSession`）。
 * 顺序：当前 window → parent → top。
 */
export function resolveAutoCardUpdaterTemplateApi(): AcuTemplateApi | null {
  try {
    const api = pickTemplateApi((window as unknown as { AutoCardUpdaterAPI?: unknown }).AutoCardUpdaterAPI);
    if (api) {
      return api;
    }
  } catch {
    /* ignore */
  }

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

  for (const w of candidates) {
    try {
      const api = pickTemplateApi((w as unknown as { AutoCardUpdaterAPI?: unknown }).AutoCardUpdaterAPI);
      if (api) {
        return api;
      }
    } catch {
      /* cross-origin */
    }
  }
  return null;
}

/**
 * 将内置 JSON 模板注入数据库扩展（与扩展「导入模板」或正则示例中 initGameSession 等效）。
 */
export async function injectBundledTavernDbTemplate(
  template: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const api = resolveAutoCardUpdaterTemplateApi();
  if (!api) {
    return {
      ok: false,
      message: '未检测到 AutoCardUpdaterAPI，请安装数据库扩展并在酒馆中打开本界面。',
    };
  }

  try {
    if (typeof api.importTemplateFromData === 'function') {
      const result = await api.importTemplateFromData(template);
      return {
        ok: Boolean(result?.success),
        message: result?.message,
      };
    }
    if (typeof api.initGameSession === 'function') {
      const result = await api.initGameSession(
        {},
        { injectTemplate: true, loadPreset: false, templateData: template },
      );
      return {
        ok: Boolean(result?.success),
        message: result?.message,
      };
    }
    return {
      ok: false,
      message: '当前扩展版本不支持 importTemplateFromData 或 initGameSession。',
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[规则] injectBundledTavernDbTemplate 失败:', e);
    return { ok: false, message };
  }
}

/**
 * 在父窗口 / top / 当前窗口查找 `window.AutoCardUpdaterAPI`（酒馆扩展注入位置因环境而异）。
 * 注意：优先检查当前 window，因为数据库可能已直接注入到前端 iframe 中。
 */
export function resolveAutoCardUpdaterApi(): AcuApi | null {
  // 优先检查当前 window（数据库 API 可能已直接注入到前端 iframe）
  try {
    const api = (window as unknown as { AutoCardUpdaterAPI?: unknown }).AutoCardUpdaterAPI;
    if (api && typeof (api as AcuApi).manualUpdate === 'function') {
      return api as AcuApi;
    }
  } catch {
    /* ignore */
  }

  // 然后尝试访问父窗口 / top 窗口
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
    console.info('[规则] 已开启数据库联动，但未检测到 AutoCardUpdaterAPI，已跳过');
    return;
  }
  try {
    await api.manualUpdate();
  } catch (e) {
    console.warn('[规则] AutoCardUpdaterAPI.manualUpdate 失败:', e);
  }
}

/**
 * 通知数据库用户发送意图，触发剧情推进机制。
 *
 * 数据库通过 capture 阶段的 pointerup 监听器监听 #send_but 按钮，
 * 当用户点击发送时调用 markUserSendIntent_ACU() 设置时间戳。
 * 后续 generate() 调用会触发 GENERATION_AFTER_COMMANDS 事件，
 * 数据库检查 shouldProcessPlotForGeneration_ACU() 发现发送意图后，
 * 自动运行内部的剧情推进流程。
 *
 * 使用 pointerup（非 click）可避免意外触发 SillyTavern 的发送逻辑。
 */
export function notifyShujukuUserSendIntent(): boolean {
  if (!getOtherSettings().enableShujukuPlotAdvance) {
    console.log('[shujukuBridge] ⚠️ 剧情推进已关闭，跳过 notifyShujukuUserSendIntent');
    return false;
  }
  try {
    const parentDoc = (window.parent || window).document;
    const sendBtn = parentDoc.getElementById('send_but');
    if (sendBtn) {
      // 使用 pointerup 事件（数据库监听器注册的是 click/pointerup/touchend）
      // bubbles: false 避免向上传播
      sendBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: false }));
      console.log('[shujukuBridge] ✅ markUserSendIntent triggered via pointerup on #send_but');
      return true;
    }
    console.warn('[shujukuBridge] ⚠️ #send_but not found in parent document');
    return false;
  } catch (e) {
    console.warn('[shujukuBridge] ❌ notifyShujukuUserSendIntent failed:', e);
    return false;
  }
}
