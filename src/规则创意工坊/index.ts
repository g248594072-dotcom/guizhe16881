/**
 * 规则创意工坊 — 酒馆脚本（对接 Cloudflare Worker API）
 * 浏览 / 搜索 / 详情 / 登录上传 / 插入输入框
 */
import { debounce } from 'lodash';
import { klona } from 'klona';
import { z } from 'zod';
import type { ContentMetadata, WorkshopContentType } from './types';
import { ALL_WORKSHOP_TYPES, WORKSHOP_TYPE_LABELS } from './types';

const SCRIPT_PANEL_ID = 'th-rule-workshop-panel';
const SCRIPT_TOGGLE_ID = 'th-rule-workshop-toggle';
/** 挂到 html 下与 body 同级，避免 body 侧 transform 导致子树内 fixed 相对错误包含块（窄屏下悬浮钮跑出视口） */
const SCRIPT_ROOT_ID = 'th-rule-workshop-root';
const ROOT_NS = 'th-rw';
const RW_MSG_OVERLAY_ID = 'th-rw-msg-overlay';
/** 消息遮罩显示态（flex 居中） */
const MSG_VISIBLE_CLASS = `${ROOT_NS}-msg-visible`;
/** fixed 被宿主 html transform/perspective 污染时用 translate 补偿回可视区 */
const TOGGLE_FALLBACK_CLASS = `${ROOT_NS}-toggle-fallback`;
const PANEL_FALLBACK_CLASS = `${ROOT_NS}-panel-fallback`;

/** 卸载视觉视口/ resize 监听器（pagehide 调用） */
let teardownToggleViewportSync: (() => void) | undefined;
let rwMsgAutoCloseTimer: ReturnType<typeof setTimeout> | undefined;

/** 脚本跑在无界面 iframe 中时 document 是 iframe 的；挂载 UI 必须用父页面 document（与 $('body') 一致） */
function getMountDocument(): Document {
  try {
    if (typeof window !== 'undefined' && window.parent !== window && window.parent.document) {
      return window.parent.document;
    }
  } catch {
    /* 跨域等 */
  }
  return document;
}

/** 与 CSS 中桌面/小屏 bottom、right 大体一致，用于计算补偿目标位置 */
function getToggleMargins(isMobile: boolean): { right: number; bottom: number } {
  return isMobile ? { right: 12, bottom: 80 } : { right: 16, bottom: 100 };
}

/**
 * 宿主可能对 documentElement 使用 transform/perspective，导致子元素 position:fixed 相对错误包含块（如 html 几何高度为 0）。
 * 通过清除临时补偿后测量 rect，再用 translate 将按钮移回 visualViewport 内的目标锚点。
 */
function syncFloatingTogglePosition(): void {
  const mountDoc = getMountDocument();
  const el = mountDoc.getElementById(SCRIPT_TOGGLE_ID) as HTMLElement | null;
  if (!el) return;

  el.classList.remove(TOGGLE_FALLBACK_CLASS);
  el.style.removeProperty('--th-rw-toggle-dx');
  el.style.removeProperty('--th-rw-toggle-dy');

  const hostWin = mountDoc.defaultView ?? window;
  const vv = hostWin.visualViewport;
  const vw = vv?.width ?? hostWin.innerWidth;
  const vh = vv?.height ?? hostWin.innerHeight;
  const voTop = vv?.offsetTop ?? 0;
  const voLeft = vv?.offsetLeft ?? 0;

  const isMobile =
    hostWin.matchMedia?.('(max-width: 640px)')?.matches ?? hostWin.innerWidth <= 640;
  const { right: marginRight, bottom: marginBottom } = getToggleMargins(isMobile);

  const r = el.getBoundingClientRect();

  const desiredLeft = voLeft + vw - marginRight - r.width;
  const desiredTop = voTop + vh - marginBottom - r.height;
  const deltaX = desiredLeft - r.left;
  const deltaY = desiredTop - r.top;

  const broken =
    !Number.isFinite(r.top) ||
    r.bottom <= 1 ||
    r.top < -Math.max(6, r.height * 0.25) ||
    r.right < voLeft + 2 ||
    r.left > voLeft + vw - 2;

  const softMisalignedMobile =
    isMobile && (Math.abs(deltaX) > 12 || Math.abs(deltaY) > 12);

  if (broken || softMisalignedMobile) {
    el.classList.add(TOGGLE_FALLBACK_CLASS);
    el.style.setProperty('--th-rw-toggle-dx', `${deltaX}px`);
    el.style.setProperty('--th-rw-toggle-dy', `${deltaY}px`);
  }
}

/**
 * 主面板同样受错误 fixed 包含块影响（尤其手机全屏时整块在视口上方）。打开时用 visualViewport 对齐。
 */
function syncFloatingPanelPosition(): void {
  const mountDoc = getMountDocument();
  const panel = mountDoc.getElementById(SCRIPT_PANEL_ID) as HTMLElement | null;
  if (!panel) return;

  panel.classList.remove(PANEL_FALLBACK_CLASS);
  panel.style.removeProperty('--th-rw-panel-dx');
  panel.style.removeProperty('--th-rw-panel-dy');

  if (!panel.classList.contains(`${ROOT_NS}-open`)) return;

  const hostWin = mountDoc.defaultView ?? window;
  const vv = hostWin.visualViewport;
  const voLeft = vv?.offsetLeft ?? 0;
  const voTop = vv?.offsetTop ?? 0;
  const vw = vv?.width ?? hostWin.innerWidth;
  const vh = vv?.height ?? hostWin.innerHeight;

  const isMobile =
    hostWin.matchMedia?.('(max-width: 640px)')?.matches ?? hostWin.innerWidth <= 640;

  const r = panel.getBoundingClientRect();

  let deltaX = 0;
  let deltaY = 0;

  if (isMobile) {
    const desiredLeft = voLeft;
    const desiredTop = voTop;
    deltaX = desiredLeft - r.left;
    deltaY = desiredTop - r.top;
  } else {
    const marginRight = 12;
    const marginBottom = 156;
    const desiredRight = voLeft + vw - marginRight;
    const desiredBottom = voTop + vh - marginBottom;
    const desiredLeft = desiredRight - r.width;
    const desiredTop = desiredBottom - r.height;
    deltaX = desiredLeft - r.left;
    deltaY = desiredTop - r.top;
  }

  const broken =
    !Number.isFinite(r.top) ||
    r.bottom <= voTop + 8 ||
    r.top < voTop - 8 ||
    r.right < voLeft + 16 ||
    r.left > voLeft + vw - 16;

  const misaligned = Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4;

  if (broken || misaligned) {
    panel.classList.add(PANEL_FALLBACK_CLASS);
    panel.style.setProperty('--th-rw-panel-dx', `${deltaX}px`);
    panel.style.setProperty('--th-rw-panel-dy', `${deltaY}px`);
  }
}

function syncToggleViewportPosition(): void {
  syncFloatingTogglePosition();
  syncFloatingPanelPosition();
  syncRwMessageOverlayCenter();
}

function bindToggleViewportRecalc(): void {
  teardownToggleViewportSync?.();

  const mountDoc = getMountDocument();
  const hostWin = mountDoc.defaultView ?? window;
  const debouncedSync = debounce(() => syncToggleViewportPosition(), 80);

  const onVv = (): void => debouncedSync();
  $(hostWin).on('resize.thrw-togglevp orientationchange.thrw-togglevp', debouncedSync);
  hostWin.visualViewport?.addEventListener('resize', onVv);
  hostWin.visualViewport?.addEventListener('scroll', onVv);

  teardownToggleViewportSync = (): void => {
    debouncedSync.cancel();
    $(hostWin).off('resize.thrw-togglevp orientationchange.thrw-togglevp');
    hostWin.visualViewport?.removeEventListener('resize', onVv);
    hostWin.visualViewport?.removeEventListener('scroll', onVv);
  };
}

/** 规则工坊内统一消息弹窗（替代酒馆全局 toastr，风格与面板一致） */
type RwToastKind = 'info' | 'success' | 'warning' | 'error';

/** 消息层已在面板内 flex 居中；仅清除遗留 transform（旧版整页补偿） */
function syncRwMessageOverlayCenter(): void {
  const mountDoc = getMountDocument();
  const overlay = mountDoc.getElementById(RW_MSG_OVERLAY_ID) as HTMLElement | null;
  if (!overlay?.classList.contains(MSG_VISIBLE_CLASS)) return;

  const dialog = overlay.querySelector(`.${ROOT_NS}-msg-dialog`) as HTMLElement | null;
  dialog?.style.removeProperty('transform');
}

function closeRwMessage(): void {
  if (rwMsgAutoCloseTimer !== undefined) {
    clearTimeout(rwMsgAutoCloseTimer);
    rwMsgAutoCloseTimer = undefined;
  }
  const mountDoc = getMountDocument();
  const el = mountDoc.getElementById(RW_MSG_OVERLAY_ID) as HTMLElement | null;
  if (el) {
    el.classList.remove(MSG_VISIBLE_CLASS);
    el.setAttribute('aria-hidden', 'true');
    el.classList.remove(
      `${ROOT_NS}-msg--info`,
      `${ROOT_NS}-msg--success`,
      `${ROOT_NS}-msg--warning`,
      `${ROOT_NS}-msg--error`,
    );
    const dlg = el.querySelector(`.${ROOT_NS}-msg-dialog`) as HTMLElement | null;
    dlg?.style.removeProperty('transform');
  }
}

function showRwMessage(message: string, kind: RwToastKind = 'info', opts?: { autoCloseMs?: number }): void {
  closeRwMessage();

  const mountDoc = getMountDocument();
  const overlay = mountDoc.getElementById(RW_MSG_OVERLAY_ID) as HTMLElement | null;
  if (!overlay) return;

  const textEl = overlay.querySelector(`[data-${ROOT_NS}=msg-text]`) as HTMLElement | null;
  const iconEl = overlay.querySelector(`[data-${ROOT_NS}=msg-icon]`) as HTMLElement | null;
  if (textEl) textEl.textContent = message;

  const icons: Record<RwToastKind, string> = {
    info: '◆',
    success: '✓',
    warning: '!',
    error: '✕',
  };
  if (iconEl) iconEl.textContent = icons[kind];

  overlay.classList.remove(
    `${ROOT_NS}-msg--info`,
    `${ROOT_NS}-msg--success`,
    `${ROOT_NS}-msg--warning`,
    `${ROOT_NS}-msg--error`,
  );
  overlay.classList.add(`${ROOT_NS}-msg--${kind}`);

  overlay.classList.add(MSG_VISIBLE_CLASS);
  overlay.setAttribute('aria-hidden', 'false');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncRwMessageOverlayCenter());
  });

  let auto = opts?.autoCloseMs;
  if (auto === undefined) {
    auto = kind === 'success' || kind === 'info' ? 3400 : 0;
  }
  if (auto > 0) {
    rwMsgAutoCloseTimer = window.setTimeout(() => closeRwMessage(), auto);
  }
}

const rwToast = {
  info: (m: string, o?: { autoCloseMs?: number }) => showRwMessage(m, 'info', o),
  success: (m: string, o?: { autoCloseMs?: number }) => showRwMessage(m, 'success', o),
  warning: (m: string, o?: { autoCloseMs?: number }) => showRwMessage(m, 'warning', o),
  error: (m: string, o?: { autoCloseMs?: number }) => showRwMessage(m, 'error', o),
  close: closeRwMessage,
};

function bindRwMessageOverlay(): void {
  const mountDoc = getMountDocument();
  $(mountDoc).off('click.thrwmsg');
  $(mountDoc).on('click.thrwmsg', `#${RW_MSG_OVERLAY_ID}`, function (this: HTMLElement, e: JQuery.ClickEvent) {
    if (e.target === this) closeRwMessage();
  });
  $(mountDoc).on('click.thrwmsg', `[data-${ROOT_NS}=msg-ok]`, () => closeRwMessage());
}

const DEFAULT_API = 'https://raspy-fire-7d20.g248594072.workers.dev';

/** 与 Zod 4 / 酒馆脚本变量兼容：缺省、空串、仅空白均回落默认 Worker */
const WorkshopVars = z.object({
  api_base_url: z
    .union([z.string(), z.undefined()])
    .transform(v => (typeof v === 'string' && v.trim() ? v.trim() : DEFAULT_API)),
  access_token: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform(v => (typeof v === 'string' && v.trim() ? v.trim() : undefined)),
});

type WorkshopVarsOut = z.infer<typeof WorkshopVars>;

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '');
}

function loadVars(): WorkshopVarsOut {
  const raw = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
  return WorkshopVars.parse({
    api_base_url: raw.api_base_url,
    access_token: raw.access_token,
  });
}

function saveVars(v: WorkshopVarsOut): void {
  replaceVariables(klona(v), { type: 'script', script_id: getScriptId() });
}

// ============ 本地内容存储 ============
const LOCAL_CONTENT_KEY = 'th_rule_workshop_local_content';

interface LocalContent {
  id: string;
  type: WorkshopContentType;
  name: string;
  description: string;
  author: string;
  data: unknown;
  tags: string[];
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  updatedAt: string;
  likes: number;
  downloads: number;
}

/** 保存内容到本地存储 */
function saveLocalContent(content: LocalContent): void {
  const existing = getLocalContents();
  const index = existing.findIndex(c => c.id === content.id);
  if (index >= 0) {
    existing[index] = content;
  } else {
    existing.push(content);
  }
  localStorage.setItem(LOCAL_CONTENT_KEY, JSON.stringify(existing));
  console.log('[规则工坊] 保存到本地:', content.id);
}

/** 获取所有本地内容 */
function getLocalContents(): LocalContent[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONTENT_KEY);
    return raw ? JSON.parse(raw) as LocalContent[] : [];
  } catch {
    return [];
  }
}

/** 根据ID和类型获取本地内容 */
function getLocalContent(id: string, type: WorkshopContentType): LocalContent | null {
  const contents = getLocalContents();
  return contents.find(c => c.id === id && c.type === type) || null;
}

/** 删除本地内容 */
function deleteLocalContent(id: string): void {
  const existing = getLocalContents();
  const filtered = existing.filter(c => c.id !== id);
  localStorage.setItem(LOCAL_CONTENT_KEY, JSON.stringify(filtered));
}

function contentExistsLocally(id: string): boolean {
  return getLocalContents().some(c => c.id === id);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function randomSessionKey(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

async function apiJson<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const base = normalizeBase(loadVars().api_base_url);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data as T;
}

function injectSendBox(text: string): void {
  const t = text.trim();
  if (!t) return;
  const $ta = $('#send_textarea, textarea#send_textarea, #message_input').first();
  if (!$ta.length) {
    rwToast.warning('未找到发送框，已复制到剪贴板');
    void navigator.clipboard.writeText(t);
    return;
  }
  const el = $ta[0] as HTMLTextAreaElement;
  const cur = el.value.trim();
  el.value = cur ? `${cur}\n\n${t}` : t;
  $ta.trigger('input');
  rwToast.success('已追加到发送框');
}

function injectStyles(): void {
  const mountDoc = getMountDocument();
  if (mountDoc.getElementById(`${ROOT_NS}-style`)) return;
  const css = `
/* ===== 赛博朋克风格 - 规则创意工坊 ===== */
:root {
  --th-cyber-black: #05080a;
  --th-cyber-panel: #0a1016;
  --th-cyber-sidebar: #0d1418;
  --th-cyber-gray: #1a2332;
  --th-cyber-border: #1e293b;
  --th-cyber-cyan: #00f3ff;
  --th-cyber-pink: #ff00ff;
  --th-cyber-yellow: #f0f800;
  --th-cyber-purple: #a855f7;
  --th-cyber-text: #e8f4f8;
  --th-cyber-muted: #6b7c8e;
  /* 须高于酒馆移动端侧栏/遮罩（常见 z-index 很高） */
  --th-rw-z-modal: 2147483600;
  --th-rw-z-panel: 2147483400;
  --th-rw-z-toggle: 2147483500;
}

#${SCRIPT_ROOT_ID} {
  position: static;
}

/* 悬浮按钮（须在主面板之上，便于关闭） */
html > body #${SCRIPT_TOGGLE_ID},
html #${SCRIPT_TOGGLE_ID} {
  position: fixed !important;
  right: 16px; bottom: 100px;
  left: auto; top: auto;
  z-index: var(--th-rw-z-toggle) !important;
  display: inline-flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  padding: 12px 18px; border-radius: 8px; cursor: pointer;
  font: 600 13px/1.2 ui-monospace, SFMono-Regular, monospace;
  background: linear-gradient(135deg, rgba(0,243,255,0.2) 0%, rgba(255,0,255,0.2) 100%);
  border: 1px solid rgba(0,243,255,0.6);
  color: var(--th-cyber-cyan);
  text-shadow: 0 0 10px rgba(0,243,255,0.5);
  box-shadow: 0 0 30px rgba(0,243,255,0.3), inset 0 0 20px rgba(0,243,255,0.05);
  transition: all 0.2s ease;
  pointer-events: auto !important;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
#${SCRIPT_TOGGLE_ID}:hover {
  filter: brightness(1.15);
  box-shadow: 0 0 40px rgba(0,243,255,0.5), inset 0 0 30px rgba(0,243,255,0.1);
  transform: translateY(-1px);
}

/* 宿主 html 变换导致 fixed 失准时，用 CSS 变量做 translate 补偿（见 syncToggleViewportPosition） */
html #${SCRIPT_TOGGLE_ID}.${ROOT_NS}-toggle-fallback {
  transform: translate(var(--th-rw-toggle-dx, 0px), var(--th-rw-toggle-dy, 0px)) !important;
}
html #${SCRIPT_TOGGLE_ID}.${ROOT_NS}-toggle-fallback:hover {
  filter: brightness(1.15);
  box-shadow: 0 0 40px rgba(0,243,255,0.5), inset 0 0 30px rgba(0,243,255,0.1);
  transform: translate(var(--th-rw-toggle-dx, 0px), calc(var(--th-rw-toggle-dy, 0px) - 1px)) !important;
}

/* 主面板 - OS 窗口风格 */
html > body #${SCRIPT_PANEL_ID},
html #${SCRIPT_PANEL_ID} {
  position: fixed !important;
  right: 12px; bottom: 156px; left: auto; top: auto;
  z-index: var(--th-rw-z-panel) !important;
  width: min(900px, 95vw); height: min(600px, 80vh);
  display: none; flex-direction: column;
  background: var(--th-cyber-black);
  border: 2px solid rgba(0,243,255,0.35);
  border-radius: 10px;
  color: var(--th-cyber-text);
  font: 13px/1.45 ui-monospace, SFMono-Regular, monospace;
  box-shadow: 0 0 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,243,255,0.15);
  overflow: hidden;
}
html > body #${SCRIPT_PANEL_ID}.${ROOT_NS}-open,
html #${SCRIPT_PANEL_ID}.${ROOT_NS}-open {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

/* 与悬浮钮相同：宿主 html 变换时 fixed 失准，全屏/窗口面板用 translate 拉回 visualViewport */
html #${SCRIPT_PANEL_ID}.${ROOT_NS}-panel-fallback {
  transform: translate(var(--th-rw-panel-dx, 0px), var(--th-rw-panel-dy, 0px)) !important;
}

/* 窗口标题栏 */
.${ROOT_NS}-titlebar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; background: var(--th-cyber-panel);
  border-bottom: 1px solid rgba(0,243,255,0.3);
  flex-shrink: 0;
}
.${ROOT_NS}-title-left {
  display: flex; align-items: center; gap: 10px;
}
.${ROOT_NS}-title-dot {
  width: 10px; height: 10px; border-radius: 2px;
  background: var(--th-cyber-pink);
  box-shadow: 0 0 12px var(--th-cyber-pink);
}
.${ROOT_NS}-title-text {
  font-size: 11px; font-weight: 700; letter-spacing: 0.15em;
  color: var(--th-cyber-cyan); text-transform: uppercase;
  text-shadow: 0 0 10px rgba(0,243,255,0.5);
}
.${ROOT_NS}-title-right {
  display: flex; align-items: center; gap: 8px;
  color: var(--th-cyber-muted); font-size: 14px;
}

/* 工具栏 */
.${ROOT_NS}-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: rgba(26,35,50,0.6);
  border-bottom: 1px solid rgba(0,243,255,0.2);
  flex-shrink: 0; gap: 12px;
}
.${ROOT_NS}-search-wrap {
  flex: 1; max-width: 400px; position: relative;
}
.${ROOT_NS}-search-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--th-cyber-cyan); font-size: 14px;
}
.${ROOT_NS}-search-input {
  width: 100%; padding: 8px 12px 8px 36px;
  background: var(--th-cyber-black);
  border: 1px solid rgba(0,243,255,0.3);
  border-radius: 4px; color: var(--th-cyber-cyan);
  font: 12px/1.4 ui-monospace, monospace;
  outline: none; transition: all 0.2s;
}
.${ROOT_NS}-search-input:focus {
  border-color: var(--th-cyber-cyan);
  box-shadow: 0 0 15px rgba(0,243,255,0.2);
}
.${ROOT_NS}-toolbar-btns {
  display: flex; align-items: center; gap: 8px;
}

/* 主内容区 */
.${ROOT_NS}-main {
  display: flex; flex: 1; overflow: hidden;
}

/* 侧边栏 */
.${ROOT_NS}-sidebar {
  width: 180px; flex-shrink: 0;
  background: var(--th-cyber-sidebar);
  border-right: 1px solid rgba(0,243,255,0.2);
  padding: 16px 12px;
  overflow-y: auto;
}
.${ROOT_NS}-sidebar-hdr {
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
  color: var(--th-cyber-muted); text-transform: uppercase;
  border-bottom: 1px solid rgba(107,124,142,0.3);
  padding-bottom: 8px; margin-bottom: 12px;
}
.${ROOT_NS}-sidebar-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; margin-bottom: 4px;
  border-radius: 4px; cursor: pointer;
  color: var(--th-cyber-muted); font-size: 12px;
  border-left: 2px solid transparent;
  transition: all 0.15s;
}
.${ROOT_NS}-sidebar-item:hover {
  background: rgba(0,243,255,0.08);
  color: var(--th-cyber-text);
}
.${ROOT_NS}-sidebar-item.active {
  background: rgba(0,243,255,0.12);
  color: var(--th-cyber-cyan);
  border-left-color: var(--th-cyber-cyan);
}
.${ROOT_NS}-sidebar-icon {
  width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
}

/* 内容区 */
.${ROOT_NS}-content {
  flex: 1; overflow-y: auto; padding: 16px;
  background: var(--th-cyber-black);
}

/* 区块标题 */
.${ROOT_NS}-section-hdr {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  color: var(--th-cyber-purple); text-transform: uppercase;
  margin-bottom: 12px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(168,85,247,0.3);
}
.${ROOT_NS}-section-hdr::before {
  content: ''; width: 4px; height: 14px; background: var(--th-cyber-purple);
}

/* 内容卡片网格 */
.${ROOT_NS}-card-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px; margin-bottom: 16px;
  justify-items: stretch;
  align-items: stretch;
}
.${ROOT_NS}-card-grid > .${ROOT_NS}-card {
  min-width: 0;
}
.${ROOT_NS}-card {
  background: var(--th-cyber-panel);
  border: 1px solid rgba(0,243,255,0.2);
  border-radius: 6px; overflow: hidden;
  position: relative; cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.${ROOT_NS}-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, var(--th-cyber-cyan), transparent);
  opacity: 0.3; transition: opacity 0.2s;
}
.${ROOT_NS}-card:hover {
  border-color: rgba(0,243,255,0.5);
  box-shadow: 0 0 20px rgba(0,243,255,0.15);
  transform: translateY(-2px);
}
.${ROOT_NS}-card:hover::before {
  opacity: 1;
}
.${ROOT_NS}-card-body {
  padding: 12px;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}
.${ROOT_NS}-card-tag {
  display: inline-block; padding: 2px 6px; font-size: 9px;
  background: rgba(0,0,0,0.5); border: 1px solid;
  border-radius: 2px;
}
.${ROOT_NS}-card-hdr-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 8px; margin-bottom: 8px;
}
.${ROOT_NS}-card-hdr-row .${ROOT_NS}-card-tag { margin-bottom: 0; flex-shrink: 0; }
.${ROOT_NS}-card-hdr-right {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  align-items: flex-end; gap: 4px; text-align: right;
}
.${ROOT_NS}-card-author {
  font-size: 12px; font-weight: 600; color: rgba(0,243,255,0.9);
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.3;
}
.${ROOT_NS}-card-status-pill {
  font-size: 8px; padding: 2px 6px; border-radius: 2px; letter-spacing: 0.02em;
}
.${ROOT_NS}-card-desc {
  font-size: 11px; color: var(--th-cyber-muted); line-height: 1.45;
  margin-bottom: 8px;
  /* line-clamp 的 -webkit-box 在短文下会按内容收缩宽度，看起来「歪」向一侧；强制占满一行 */
  width: 100%;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
  overflow: hidden; word-break: break-word;
  text-align: center;
}
.${ROOT_NS}-card-tag.cyan { color: var(--th-cyber-cyan); border-color: rgba(0,243,255,0.5); }
.${ROOT_NS}-card-tag.pink { color: var(--th-cyber-pink); border-color: rgba(255,0,255,0.5); }
.${ROOT_NS}-card-tag.yellow { color: var(--th-cyber-yellow); border-color: rgba(240,248,0,0.5); }
.${ROOT_NS}-card-title {
  font-size: 13px; font-weight: 600; color: var(--th-cyber-text);
  margin-bottom: 6px; line-height: 1.4;
  text-align: center;
}
.${ROOT_NS}-card-title:hover {
  color: var(--th-cyber-cyan);
}
.${ROOT_NS}-card-meta {
  font-size: 10px; color: var(--th-cyber-muted);
  font-family: ui-monospace, monospace;
  margin-bottom: 8px;
}
.${ROOT_NS}-card-stats {
  display: flex; align-items: center; justify-content: center;
  gap: 12px;
  padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 10px;
  color: #6b7c8e;
}
.${ROOT_NS}-card-stars {
  font-size: 10px; color: var(--th-cyber-yellow); letter-spacing: 2px;
}
.${ROOT_NS}-card-dl {
  font-size: 9px; color: var(--th-cyber-muted);
}
.${ROOT_NS}-card-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 8px 12px; border-top: 1px solid rgba(255,255,255,0.06);
}
/* 与「删本地」并排时再用横排；单按钮时勿用 row，否则 width:100% 在 flex 行内易裁成贴左一条 */
.${ROOT_NS}-card-footer.${ROOT_NS}-card-footer--row {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: stretch;
}
.${ROOT_NS}-card-btn {
  width: 100%; padding: 6px; font-size: 10px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  background: transparent; border: 1px solid rgba(0,243,255,0.4);
  color: var(--th-cyber-cyan); cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
  flex: 0 0 auto;
}
.${ROOT_NS}-card-footer--row .${ROOT_NS}-card-btn {
  width: auto;
  flex: 1 1 0;
  min-width: 0;
}
.${ROOT_NS}-card-btn:hover {
  background: rgba(0,243,255,0.15);
}

/* 按钮基础样式 */
.${ROOT_NS}-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; font-size: 11px; font-weight: 600;
  letter-spacing: 0.05em; cursor: pointer;
  background: var(--th-cyber-gray); border: 1px solid rgba(0,243,255,0.3);
  border-radius: 4px; color: var(--th-cyber-cyan);
  transition: all 0.2s;
}
.${ROOT_NS}-btn:hover {
  background: rgba(0,243,255,0.15);
  border-color: rgba(0,243,255,0.5);
}
.${ROOT_NS}-btn.primary {
  background: rgba(255,0,255,0.15); border-color: rgba(255,0,255,0.5);
  color: var(--th-cyber-pink);
}
.${ROOT_NS}-btn.primary:hover {
  background: rgba(255,0,255,0.25);
  box-shadow: 0 0 15px rgba(255,0,255,0.3);
}
.${ROOT_NS}-btn.small {
  padding: 4px 8px; font-size: 10px;
}

/* 表单元素 */
.${ROOT_NS}-input, .${ROOT_NS}-select, .${ROOT_NS}-textarea {
  width: 100%; padding: 8px 12px;
  background: var(--th-cyber-black);
  border: 1px solid rgba(0,243,255,0.25);
  border-radius: 4px; color: var(--th-cyber-text);
  font: 12px/1.4 ui-monospace, monospace;
  outline: none; transition: all 0.2s;
}
.${ROOT_NS}-input:focus, .${ROOT_NS}-select:focus, .${ROOT_NS}-textarea:focus {
  border-color: var(--th-cyber-cyan);
  box-shadow: 0 0 15px rgba(0,243,255,0.15);
}
.${ROOT_NS}-form-row {
  margin-bottom: 12px;
}
.${ROOT_NS}-form-label {
  display: block; font-size: 10px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--th-cyber-muted); margin-bottom: 6px;
}
.${ROOT_NS}-form-label span {
  color: var(--th-cyber-cyan);
}

/* 分页 */
.${ROOT_NS}-pager {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding-top: 12px;
}

/* 列表元信息 */
.${ROOT_NS}-list-meta {
  font-size: 11px; color: var(--th-cyber-muted); margin-bottom: 12px;
}
.${ROOT_NS}-list-meta span {
  color: var(--th-cyber-cyan);
}

/* 统一消息弹窗（替代 toastr；位于 #${SCRIPT_PANEL_ID} 内，相对面板铺满并居中） */
#${RW_MSG_OVERLAY_ID} {
  position: absolute !important;
  inset: 0 !important;
  left: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  z-index: 50 !important;
  display: none;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: center !important;
  padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  background: rgba(5, 8, 10, 0.78);
  backdrop-filter: blur(8px);
  pointer-events: auto !important;
}
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg-visible {
  display: flex !important;
}
.${ROOT_NS}-msg-dialog {
  width: min(420px, calc(100% - 24px));
  max-height: min(480px, 72%);
  overflow: auto;
  padding: 20px 22px 16px;
  background: var(--th-cyber-panel);
  border: 2px solid rgba(0, 243, 255, 0.45);
  border-radius: 10px;
  box-shadow: 0 0 48px rgba(0, 243, 255, 0.18), 0 16px 56px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
}
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg--info .${ROOT_NS}-msg-dialog { border-color: rgba(0, 243, 255, 0.55); }
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg--success .${ROOT_NS}-msg-dialog { border-color: rgba(0, 255, 136, 0.5); }
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg--warning .${ROOT_NS}-msg-dialog { border-color: rgba(240, 248, 0, 0.55); }
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg--error .${ROOT_NS}-msg-dialog { border-color: rgba(255, 102, 102, 0.55); }
.${ROOT_NS}-msg-icon {
  font-size: 26px;
  font-weight: 700;
  text-align: center;
  line-height: 1.15;
  font-family: ui-monospace, monospace;
}
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg--info .${ROOT_NS}-msg-icon { color: var(--th-cyber-cyan); text-shadow: 0 0 14px rgba(0, 243, 255, 0.45); }
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg--success .${ROOT_NS}-msg-icon { color: #00ff88; text-shadow: 0 0 14px rgba(0, 255, 136, 0.35); }
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg--warning .${ROOT_NS}-msg-icon { color: var(--th-cyber-yellow); text-shadow: 0 0 14px rgba(240, 248, 0, 0.35); }
#${RW_MSG_OVERLAY_ID}.${ROOT_NS}-msg--error .${ROOT_NS}-msg-icon { color: #ff8888; text-shadow: 0 0 14px rgba(255, 68, 68, 0.35); }
.${ROOT_NS}-msg-text {
  font-size: 13px;
  line-height: 1.55;
  color: var(--th-cyber-text);
  white-space: pre-wrap;
  word-break: break-word;
  text-align: center;
}
.${ROOT_NS}-msg-ok {
  align-self: center;
  margin-top: 4px;
  min-width: 128px;
}

/* 详情 / 审核 / 后台弹窗（相对 #${SCRIPT_PANEL_ID} 铺满并居中，非整页） */
.${ROOT_NS}-modal-bg {
  position: absolute !important;
  inset: 0 !important;
  left: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  background: rgba(5,8,10,0.85);
  backdrop-filter: blur(4px);
  display: none;
  align-items: center;
  justify-content: center;
  padding: max(8px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px)) max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
}
.${ROOT_NS}-modal-bg[data-${ROOT_NS}="detail-bg"] { z-index: 40 !important; }
.${ROOT_NS}-modal-bg[data-${ROOT_NS}="review-bg"] { z-index: 41 !important; }
.${ROOT_NS}-modal-bg[data-${ROOT_NS}="dashboard-bg"] { z-index: 42 !important; }
.${ROOT_NS}-modal-bg.show { display: flex; }
.${ROOT_NS}-modal {
  width: min(600px, calc(100% - 24px));
  max-height: min(85%, 85vh);
  overflow: auto;
  background: var(--th-cyber-panel);
  border: 2px solid rgba(0,243,255,0.4);
  border-radius: 10px; padding: 0;
  box-shadow: 0 0 60px rgba(0,243,255,0.2);
}
.${ROOT_NS}-modal-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: rgba(0,243,255,0.08);
  border-bottom: 1px solid rgba(0,243,255,0.2);
}
.${ROOT_NS}-modal-body {
  padding: 16px;
}
.${ROOT_NS}-modal-meta {
  font-size: 11px; color: var(--th-cyber-muted);
  margin-bottom: 12px; font-family: ui-monospace, monospace;
}
.${ROOT_NS}-pre {
  background: var(--th-cyber-black);
  border: 1px solid rgba(0,243,255,0.2);
  border-radius: 6px; padding: 12px;
  font: 11px/1.5 ui-monospace, monospace;
  color: var(--th-cyber-text);
  white-space: pre-wrap; word-break: break-word;
  max-height: 400px; overflow: auto;
}
.${ROOT_NS}-modal-actions {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

/* 状态栏 */
.${ROOT_NS}-status-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 16px; background: var(--th-cyber-panel);
  border-top: 1px solid rgba(0,243,255,0.2);
  font-size: 9px; font-family: ui-monospace, monospace;
  color: var(--th-cyber-muted);
  flex-shrink: 0;
}
.${ROOT_NS}-status-bar .green { color: #00ff88; }
.${ROOT_NS}-status-bar .pink { color: var(--th-cyber-pink); }

/* 空状态 */
.${ROOT_NS}-empty {
  text-align: center; padding: 40px 20px;
  color: var(--th-cyber-muted); font-size: 12px;
}

/* 用户标签 */
.${ROOT_NS}-user-label {
  font-size: 10px; color: var(--th-cyber-muted);
}
.${ROOT_NS}-user-label.logged-in {
  color: var(--th-cyber-cyan);
}

/* ========== 移动端 / 小屏适配 ========== */
@media screen and (max-width: 640px) {
  html #${SCRIPT_PANEL_ID} {
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    top: auto !important;
    width: 100% !important;
    max-width: 100% !important;
    height: min(100dvh, 100vh) !important;
    max-height: min(100dvh, 100vh) !important;
    border-radius: 12px 12px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  html #${SCRIPT_TOGGLE_ID} {
    right: max(10px, env(safe-area-inset-right, 0px)) !important;
    bottom: max(80px, calc(env(safe-area-inset-bottom, 0px) + 64px)) !important;
    padding: 12px 16px !important;
    font-size: 13px;
    z-index: var(--th-rw-z-toggle) !important;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  /* 打开时必须盖住酒馆移动端 UI */
  html #${SCRIPT_PANEL_ID}.${ROOT_NS}-open {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: var(--th-rw-z-panel) !important;
    pointer-events: auto !important;
  }

  .${ROOT_NS}-titlebar {
    padding: 10px 12px;
    align-items: center;
    gap: 8px;
  }
  .${ROOT_NS}-title-left {
    min-width: 0;
    flex: 1;
  }
  .${ROOT_NS}-title-text {
    font-size: 9px;
    letter-spacing: 0.06em;
    line-height: 1.35;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 56vw;
  }
  .${ROOT_NS}-title-right {
    flex-shrink: 0;
    gap: 6px;
  }

  .${ROOT_NS}-toolbar {
    flex-direction: column;
    align-items: stretch;
    padding: 10px 12px;
    gap: 10px;
  }
  .${ROOT_NS}-search-wrap {
    max-width: none;
  }
  .${ROOT_NS}-search-wrap .${ROOT_NS}-search-input {
    min-height: 44px;
    font-size: 16px;
  }
  .${ROOT_NS}-toolbar-btns {
    flex-wrap: wrap;
    justify-content: stretch;
    gap: 8px;
  }
  .${ROOT_NS}-toolbar-btns > .${ROOT_NS}-btn {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
    min-height: 42px;
    justify-content: center;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .${ROOT_NS}-main {
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* 分类改为横向滑动条 */
  .${ROOT_NS}-sidebar {
    width: 100%;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid rgba(0,243,255,0.2);
    padding: 8px 10px 10px;
    overflow-x: auto;
    overflow-y: hidden;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: stretch;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .${ROOT_NS}-sidebar-hdr {
    display: none;
  }
  .${ROOT_NS}-sidebar-item {
    flex: 0 0 auto;
    margin-bottom: 0;
    padding: 10px 12px;
    border-left: none;
    border-bottom: 2px solid transparent;
    border-radius: 8px;
    font-size: 11px;
    min-height: 44px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .${ROOT_NS}-sidebar-item.active {
    border-left-color: transparent;
    border-bottom-color: var(--th-cyber-cyan);
    background: rgba(0,243,255,0.14);
  }

  .${ROOT_NS}-content {
    padding: 12px;
    flex: 1;
    min-height: 0;
  }

  .${ROOT_NS}-card-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .${ROOT_NS}-btn {
    min-height: 40px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .${ROOT_NS}-btn.small {
    min-height: 38px;
    padding: 6px 10px;
  }

  .${ROOT_NS}-ws-tab-row {
    flex-wrap: wrap;
    gap: 8px !important;
  }
  .${ROOT_NS}-ws-tab-row > .${ROOT_NS}-btn {
    flex: 1;
    min-width: calc(50% - 4px);
    min-height: 44px;
    justify-content: center;
  }

  /* 弹窗：底部抽屉式，占满宽度（覆盖内联 width） */
  .${ROOT_NS}-modal-bg {
    align-items: flex-end;
    justify-content: center;
    padding-top: env(safe-area-inset-top, 0px);
  }
  .${ROOT_NS}-modal-bg .${ROOT_NS}-modal {
    width: 100% !important;
    max-width: 100% !important;
    max-height: min(92%, min(92dvh, 92vh));
    border-radius: 12px 12px 0 0;
    margin: 0;
  }
  .${ROOT_NS}-modal-hdr {
    padding: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .${ROOT_NS}-modal-body {
    padding: 12px;
  }
  .${ROOT_NS}-modal-actions {
    flex-direction: column;
    padding: 12px;
    gap: 10px;
  }
  .${ROOT_NS}-modal-actions .${ROOT_NS}-btn {
    width: 100%;
    min-height: 46px;
    justify-content: center;
  }
  .${ROOT_NS}-pre {
    max-height: min(48vh, 280px) !important;
  }

  .${ROOT_NS}-status-bar {
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
    font-size: 8px;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    text-align: center;
  }
}

@media screen and (max-width: 640px) and (hover: none) {
  .${ROOT_NS}-card:hover {
    transform: none;
    box-shadow: none;
  }
  .${ROOT_NS}-card:active {
    border-color: rgba(0,243,255,0.45);
    background: rgba(0,243,255,0.05);
  }
}
`;
  $(`<style id="${ROOT_NS}-style">${css}</style>`).appendTo(mountDoc.head);
}

// 分类图标映射（Emoji 代替 lucide-react）
const TYPE_ICONS: Record<WorkshopContentType, string> = {
  'world-rule': '⬡',      // Hexagon
  'regional-rule': '◎',   // Map/target
  'personal-rule': '🛡',   // Shield
  'region': '□',          // Box
  'building': '🏢',        // Building
  'character': '👤',       // User
};

function buildPanelHtml(): string {
  const sidebarItems = [
    { id: '__recommended__', label: '推荐', icon: '★' },
    { id: '__all__', label: '全部', icon: '▦' },
    ...ALL_WORKSHOP_TYPES.map(t => ({ id: t, label: WORKSHOP_TYPE_LABELS[t], icon: TYPE_ICONS[t] })),
  ].map(item => `
    <div class="${ROOT_NS}-sidebar-item" data-category="${item.id}">
      <span class="${ROOT_NS}-sidebar-icon">${item.icon}</span>
      <span>${escapeHtml(item.label)}</span>
    </div>
  `).join('');

  return `
<div id="${SCRIPT_PANEL_ID}">
  <!-- 窗口标题栏 -->
  <div class="${ROOT_NS}-titlebar">
    <div class="${ROOT_NS}-title-left">
      <div class="${ROOT_NS}-title-dot"></div>
      <span class="${ROOT_NS}-title-text">SYS_CORE // 规则创意工坊_v1.1.3</span>
    </div>
    <div class="${ROOT_NS}-title-right">
      <!-- 用户区域 - 动态切换 -->
      <div data-${ROOT_NS}="header-user-area" style="display:flex;align-items:center;gap:8px">
        <span class="${ROOT_NS}-user-label" data-${ROOT_NS}="user-label">未登录</span>
        <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="header-login" style="padding:4px 10px;font-size:10px">[ LOGIN // 接入 ]</button>
      </div>
      <button type="button" data-${ROOT_NS}="panel-close" style="background:none;border:none;color:#ff00ff;font-size:16px;cursor:pointer;padding:4px 8px;margin-left:8px;line-height:1">[×]</button>
    </div>
  </div>

  <!-- 工具栏 -->
  <div class="${ROOT_NS}-toolbar">
    <div class="${ROOT_NS}-search-wrap">
      <span class="${ROOT_NS}-search-icon">🔍</span>
      <input type="text" class="${ROOT_NS}-search-input" data-${ROOT_NS}="search-q" placeholder="搜索规则 / 区域 / 建筑 / 角色..." />
    </div>
    <div class="${ROOT_NS}-toolbar-btns">
      <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="search-run">搜索</button>
      <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="sync-cloud" style="border-color:#00f3ff;color:#00f3ff;background:rgba(0,243,255,0.1)">☁️ 同步云端</button>
      <button type="button" class="${ROOT_NS}-btn primary" data-${ROOT_NS}="view-workspace">我的工作站</button>
    </div>
  </div>

  <!-- 主内容区 -->
  <div class="${ROOT_NS}-main">
    <!-- 侧边栏 -->
    <div class="${ROOT_NS}-sidebar">
      <div class="${ROOT_NS}-sidebar-hdr">Categories</div>
      ${sidebarItems}
    </div>

    <!-- 内容区 -->
    <div class="${ROOT_NS}-content" data-${ROOT_NS}="main-content">
      <!-- 探索视图 -->
      <div data-${ROOT_NS}="explore-view">
        <div class="${ROOT_NS}-section-hdr" data-${ROOT_NS}="explore-title">★ 推荐作品 / RECOMMENDED</div>
        <div class="${ROOT_NS}-list-meta" data-${ROOT_NS}="list-meta">加载中...</div>
        <div class="${ROOT_NS}-card-grid" data-${ROOT_NS}="list"></div>
        <div class="${ROOT_NS}-pager" data-${ROOT_NS}="pager"></div>
      </div>

      <!-- 工作站视图（默认隐藏） -->
      <div data-${ROOT_NS}="workspace-view" style="display:none">
        <!-- 工作站标签页切换 -->
        <div class="${ROOT_NS}-ws-tab-row" style="display:flex;align-items:center;gap:8px;margin-bottom:16px;border-bottom:1px solid rgba(0,243,255,0.2);padding-bottom:12px">
          <button type="button" class="${ROOT_NS}-btn ${ROOT_NS}-ws-tab" data-${ROOT_NS}="ws-tab-my" style="background:rgba(255,0,255,0.15);border-color:rgba(255,0,255,0.5)">📁 我的作品</button>
          <button type="button" class="${ROOT_NS}-btn ${ROOT_NS}-ws-tab" data-${ROOT_NS}="ws-tab-upload">⬆ 上传新作品</button>
        </div>

        <!-- Tab A: 我的作品 -->
        <div data-${ROOT_NS}="ws-view-my">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <span style="font-size:16px">📁</span>
            <h2 style="margin:0;font-size:14px;font-weight:600">我的作品库 // MY_LIBRARY</h2>
            <span style="font-size:10px;color:#6b7c8e;margin-left:auto">管理你创建的所有内容</span>
          </div>
          <div class="${ROOT_NS}-list-meta" data-${ROOT_NS}="my-list-meta">加载中...</div>
          <div class="${ROOT_NS}-card-grid" data-${ROOT_NS}="my-list"></div>
          <div data-${ROOT_NS}="my-empty" style="display:none" class="${ROOT_NS}-empty">
            暂无作品，点击上方「上传新作品」创建
          </div>
        </div>

        <!-- Tab B: 上传新作品 -->
        <div data-${ROOT_NS}="ws-view-upload" style="display:none">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <span style="font-size:18px">📤</span>
            <h2 style="margin:0;font-size:14px;font-weight:600">数据上传链路 // UPLOAD_LINK</h2>
          </div>

          <div style="background:rgba(10,16,22,0.8);border:1px solid rgba(0,243,255,0.2);border-radius:6px;padding:16px">
            <!-- 登录区 -->
            <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.06)">
              <div style="font-size:10px;color:#6b7c8e;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">[ 0 ] 连接状态 / CONNECTION</div>
              <div style="display:flex;gap:8px">
                <button type="button" class="${ROOT_NS}-btn primary" data-${ROOT_NS}="login">Discord 登录</button>
                <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="logout">退出</button>
                <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="refresh-me">刷新状态</button>
              </div>
            </div>

            <!-- 管理员区域（仅管理员可见） -->
            <div data-${ROOT_NS}="admin-section" style="display:none;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.06)">
              <div style="font-size:10px;color:#ff00ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">[ ADMIN ] 系统管理</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="admin-seed" style="border-color:rgba(255,0,255,0.5);color:#ff00ff">🌱 灌入官方示例</button>
                <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="admin-review" style="border-color:rgba(255,0,255,0.5);color:#ff00ff">🔍 审核内容</button>
                <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="admin-dashboard" style="border-color:rgba(255,0,255,0.5);color:#ff00ff">⚙️ 管理后台</button>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 10px;background:rgba(255,0,255,0.1);border:1px solid rgba(255,0,255,0.3);border-radius:4px;color:#ff00ff;font-size:12px">
                  <input type="checkbox" data-${ROOT_NS}="admin-auto-approve" style="accent-color:#ff00ff" />
                  自动审核模式
                </label>
              </div>
            </div>

            <!-- 类别选择 -->
            <div style="margin-bottom:20px">
              <div style="font-size:10px;color:#6b7c8e;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em">[ 1 ] 选择类别 / SELECT TAG</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${ALL_WORKSHOP_TYPES.map(t => `
                  <button type="button" class="${ROOT_NS}-btn ${ROOT_NS}-type-select" data-type="${t}" style="min-width:80px;justify-content:center">
                    ${TYPE_ICONS[t]} ${escapeHtml(WORKSHOP_TYPE_LABELS[t])}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 表单 -->
            <div style="opacity:0.6" data-${ROOT_NS}="upload-form">
              <div style="font-size:10px;color:#6b7c8e;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em">[ 2 ] 核心数据录入 / DATA PREPARATION</div>

              <!-- 通用信息：世界规则、区域规则、个人规则、建筑、角色使用 -->
              <div data-${ROOT_NS}="common-fields">
                <div class="${ROOT_NS}-form-row">
                  <label class="${ROOT_NS}-form-label" data-${ROOT_NS}="name-label">项目代号 <span>_TITLE</span></label>
                  <input type="text" class="${ROOT_NS}-input" data-${ROOT_NS}="up-name" placeholder="输入规则名称或标题..." />
                </div>

                <div class="${ROOT_NS}-form-row">
                  <label class="${ROOT_NS}-form-label">简介 <span>_DESC</span></label>
                  <textarea class="${ROOT_NS}-textarea" data-${ROOT_NS}="up-desc" rows="2" placeholder="输入简介（可选）..."></textarea>
                </div>
              </div>

              <!-- 建筑智能表单：只有建筑类型显示 -->
              <div class="${ROOT_NS}-form-row" data-${ROOT_NS}="building-form-container" style="display:none">
                <div style="font-size:10px;color:#6b7c8e;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em">[ 3 ] 建筑详情 / BUILDING DATA</div>

                <!-- 房间列表 -->
                <div style="margin-bottom:16px;padding:12px;background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.2);border-radius:6px;">
                  <div style="font-size:11px;color:#00c8ff;margin-bottom:12px;font-weight:600">房间</div>
                  <div data-${ROOT_NS}="building-rooms-list"></div>
                  <button type="button" data-${ROOT_NS}="add-room-btn-main" style="padding:6px 12px;background:rgba(0,200,255,0.15);border:1px solid rgba(0,200,255,0.4);border-radius:4px;color:#00c8ff;font-size:12px;cursor:pointer;">+ 添加房间</button>
                </div>

                <!-- 活动列表 -->
                <div style="padding:12px;background:rgba(255,165,0,0.05);border:1px solid rgba(255,165,0,0.2);border-radius:6px;">
                  <div style="font-size:11px;color:#ffaa00;margin-bottom:12px;font-weight:600">活动</div>
                  <div data-${ROOT_NS}="building-activities-list"></div>
                  <button type="button" data-${ROOT_NS}="add-activity-btn-main" style="padding:6px 12px;background:rgba(255,165,0,0.15);border:1px solid rgba(255,165,0,0.4);border-radius:4px;color:#ffaa00;font-size:12px;cursor:pointer;">+ 添加活动</button>
                </div>
              </div>

              <!-- 角色数据载荷：只有角色类型需要手动输入 -->
              <div class="${ROOT_NS}-form-row" data-${ROOT_NS}="up-data-container" style="display:none">
                <label class="${ROOT_NS}-form-label">数据载荷 <span>_CONTENT</span></label>
                <textarea class="${ROOT_NS}-textarea" data-${ROOT_NS}="up-data" rows="5" placeholder='输入详细内容或 JSON...
普通文本将被存储为 {"text":"..."}'></textarea>
              </div>

              <!-- 区域智能表单：只有区域类型显示 -->
              <div class="${ROOT_NS}-form-row" data-${ROOT_NS}="region-form-container" style="display:none">
                <div style="font-size:10px;color:#6b7c8e;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em">[ 3 ] 区域详情 / REGION DATA</div>

                <!-- 区域基本信息 -->
                <div style="margin-bottom:16px;padding:12px;background:rgba(255,193,7,0.05);border:1px solid rgba(255,193,7,0.2);border-radius:6px;">
                  <div style="font-size:11px;color:#ffc107;margin-bottom:8px;font-weight:600">区域基本信息</div>
                  <input type="text" data-${ROOT_NS}="region-name" placeholder="区域名称 *必填" style="width:100%;padding:8px;margin-bottom:8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,193,7,0.3);border-radius:4px;color:#e0f0f0;font-size:14px;outline:none;" />
                  <textarea data-${ROOT_NS}="region-desc" placeholder="区域描述 *必填" rows="2" style="width:100%;padding:8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,193,7,0.3);border-radius:4px;color:#e0f0f0;font-size:13px;outline:none;resize:vertical;"></textarea>
                </div>

                <!-- 建筑列表 -->
                <div data-${ROOT_NS}="region-buildings-container">
                  <div style="font-size:11px;color:#00c8ff;margin-bottom:12px;font-weight:600">包含建筑</div>
                  <div data-${ROOT_NS}="region-buildings-list"></div>
                  <button type="button" data-${ROOT_NS}="add-building-btn" style="padding:8px 16px;background:rgba(0,200,255,0.15);border:1px solid rgba(0,200,255,0.4);border-radius:4px;color:#00c8ff;font-size:12px;cursor:pointer;">+ 添加建筑</button>
                </div>
              </div>

              <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">
                <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="cancel-upload" style="color:#6b7c8e;border-color:#1e293b">ABORT // 取消</button>
                <button type="button" class="${ROOT_NS}-btn primary" data-${ROOT_NS}="upload" style="box-shadow:0 0 15px rgba(255,0,255,0.4)">TRANSMIT // 开始同步</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 底部状态栏 -->
  <div class="${ROOT_NS}-status-bar">
    <span data-${ROOT_NS}="status-text">SYSTEM STATUS: <span class="green">OPTIMAL</span></span>
    <span>BANDWIDTH: 1.4 GB/S</span>
    <span>LATENCY: 14MS</span>
    <span class="pink">SECURED_LINE_0142</span>
  </div>

  <!-- 详情弹窗 -->
  <div class="${ROOT_NS}-modal-bg" data-${ROOT_NS}="detail-bg">
    <div class="${ROOT_NS}-modal">
      <div class="${ROOT_NS}-modal-hdr">
        <strong data-${ROOT_NS}="detail-title">详情</strong>
        <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="detail-close">关闭 [×]</button>
      </div>
      <div class="${ROOT_NS}-modal-body">
        <div class="${ROOT_NS}-modal-meta" data-${ROOT_NS}="detail-meta"></div>
        <div class="${ROOT_NS}-pre" data-${ROOT_NS}="detail-pre" style="max-height:400px;overflow:auto;padding:16px;background:var(--th-cyber-black);border:1px solid rgba(0,243,255,0.2);border-radius:6px;"></div>
      </div>
      <div class="${ROOT_NS}-modal-actions" style="justify-content:center;gap:12px;">
        <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="detail-send" style="padding:10px 20px;">📝 插入输入框</button>
        <button type="button" class="${ROOT_NS}-btn" data-${ROOT_NS}="detail-like" style="padding:10px 24px;background:rgba(255,0,0,0.2);border-color:#ff4444;color:#ff4444;font-weight:bold;text-shadow:0 0 8px rgba(255,0,0,0.5);box-shadow:0 0 15px rgba(255,0,0,0.3);">♥ 点赞</button>
      </div>
    </div>
  </div>

  <!-- 审核界面弹窗 -->
  <div class="${ROOT_NS}-modal-bg" data-${ROOT_NS}="review-bg">
    <div class="${ROOT_NS}-modal" style="width:min(700px,calc(100% - 24px))">
      <div class="${ROOT_NS}-modal-hdr" style="background:rgba(255,0,255,0.08)">
        <strong>🔍 内容审核 // CONTENT REVIEW</strong>
        <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="review-close">关闭 [×]</button>
      </div>
      <div class="${ROOT_NS}-modal-body">
        <!-- 批量操作栏 -->
        <div style="display:flex;gap:8px;margin-bottom:12px;padding:10px 12px;background:rgba(255,165,0,0.1);border:1px solid rgba(255,165,0,0.2);border-radius:6px;flex-wrap:wrap;align-items:center">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#ffc107;font-size:12px;margin-right:8px">
            <input type="checkbox" data-${ROOT_NS}="review-select-all" style="accent-color:#ffc107;width:16px;height:16px" />
            <span>全选</span>
          </label>
          <span style="font-size:11px;color:#6b7c8e;margin-right:auto" data-${ROOT_NS}="review-selected-count">已选择 0 项</span>
          <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="review-batch-approve" style="border-color:#00ff88;color:#00ff88;background:rgba(0,255,136,0.1)">✓ 批量通过</button>
          <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="review-batch-reject" style="border-color:#ff4444;color:#ff4444;background:rgba(255,68,68,0.1)">✗ 批量拒绝</button>
        </div>
        <div data-${ROOT_NS}="review-list" style="max-height:min(55vh,55%);overflow:auto;">
          <div class="${ROOT_NS}-empty">加载待审核内容...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 管理后台弹窗 -->
  <div class="${ROOT_NS}-modal-bg" data-${ROOT_NS}="dashboard-bg">
    <div class="${ROOT_NS}-modal" style="width:min(900px,calc(100% - 24px))">
      <div class="${ROOT_NS}-modal-hdr" style="background:rgba(255,0,255,0.08)">
        <strong>⚙️ 管理后台 // ADMIN DASHBOARD</strong>
        <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="dashboard-close">关闭 [×]</button>
      </div>
      <div class="${ROOT_NS}-modal-body">
        <!-- 批量操作栏 -->
        <div style="display:flex;gap:8px;margin-bottom:12px;padding:10px 12px;background:rgba(255,0,255,0.1);border:1px solid rgba(255,0,255,0.2);border-radius:6px;flex-wrap:wrap;align-items:center">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#ff00ff;font-size:12px;margin-right:8px">
            <input type="checkbox" data-${ROOT_NS}="dash-select-all" style="accent-color:#ff00ff;width:16px;height:16px" />
            <span>全选</span>
          </label>
          <span style="font-size:11px;color:#6b7c8e;margin-right:auto" data-${ROOT_NS}="dash-selected-count">已选择 0 项</span>
          <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="dash-batch-download" style="border-color:#00f3ff;color:#00f3ff;background:rgba(0,243,255,0.1)">⬇ 下载到本地</button>
          <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="dash-batch-delete" style="border-color:#ff4444;color:#ff4444;background:rgba(255,68,68,0.1)">🗑 批量删除</button>
        </div>
        <!-- 筛选栏 -->
        <div style="display:flex;gap:8px;margin-bottom:16px;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px;flex-wrap:wrap">
          <select data-${ROOT_NS}="dash-filter-type" style="padding:6px 10px;background:rgba(0,0,0,0.5);border:1px solid rgba(0,243,255,0.3);border-radius:4px;color:#e0f0f0;font-size:12px">
            <option value="">全部类型</option>
            <option value="world-rule">世界规则</option>
            <option value="regional-rule">区域规则</option>
            <option value="personal-rule">个人规则</option>
            <option value="region">区域</option>
            <option value="building">建筑</option>
            <option value="character">角色</option>
          </select>
          <select data-${ROOT_NS}="dash-filter-status" style="padding:6px 10px;background:rgba(0,0,0,0.5);border:1px solid rgba(0,243,255,0.3);border-radius:4px;color:#e0f0f0;font-size:12px">
            <option value="">全部状态</option>
            <option value="approved">已通过</option>
            <option value="pending">待审核</option>
            <option value="rejected">已拒绝</option>
          </select>
          <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="dash-refresh">刷新</button>
          <span style="font-size:11px;color:#6b7c8e;margin-left:auto" data-${ROOT_NS}="dash-total">共 0 条</span>
        </div>
        <!-- 内容列表 -->
        <div data-${ROOT_NS}="dashboard-list" style="max-height:min(50vh,50%);overflow:auto;">
          <div class="${ROOT_NS}-empty">加载中...</div>
        </div>
        <!-- 分页 -->
        <div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1)">
          <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="dash-page-prev">← 上一页</button>
          <span data-${ROOT_NS}="dash-page-info" style="font-size:12px;color:#6b7c8e">第 1 页</span>
          <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="dash-page-next">下一页 →</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 统一消息弹窗（铺满面板内部居中，非整页） -->
  <div id="${RW_MSG_OVERLAY_ID}" class="${ROOT_NS}-msg-layer" aria-hidden="true">
    <div class="${ROOT_NS}-msg-dialog" role="alertdialog" aria-modal="true">
      <div class="${ROOT_NS}-msg-icon" data-${ROOT_NS}=msg-icon aria-hidden="true"></div>
      <div class="${ROOT_NS}-msg-text" data-${ROOT_NS}=msg-text></div>
      <button type="button" class="${ROOT_NS}-btn primary ${ROOT_NS}-msg-ok" data-${ROOT_NS}=msg-ok>确定</button>
    </div>
  </div>
</div>

<!-- 悬浮按钮 -->
<button type="button" id="${SCRIPT_TOGGLE_ID}" title="规则创意工坊">规则工坊</button>
`;
}

type ListState = {
  items: ContentMetadata[];
  page: number;
  totalPages: number;
  mode: 'list' | 'search' | 'my' | 'recommended';
};

type UserState = {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
  inGuild: boolean;
  isAdmin: boolean;
} | null;

const state: {
  list: ListState;
  my: { items: ContentMetadata[] };
  detail: {
    meta: ContentMetadata | null;
    data: unknown;
    jsonText: string;
    availableRegions?: Array<{key: string; name: string}>;
    availableCharacters?: Array<{key: string; name: string}>;
  };
  user: UserState;
  likedIds: Set<string>;
  dashboard: { items: ContentMetadata[]; page: number; totalPages: number; loading: boolean; selectedIds: Set<string> };
  review: { items: ContentMetadata[]; loading: boolean; selectedIds: Set<string> };
} = {
  list: { items: [], page: 1, totalPages: 1, mode: 'list' },
  my: { items: [] },
  detail: { meta: null, data: null, jsonText: '', availableRegions: [], availableCharacters: [] },
  user: null,
  likedIds: new Set(),
  dashboard: { items: [], page: 1, totalPages: 1, loading: false, selectedIds: new Set() },
  review: { items: [], loading: false, selectedIds: new Set() },
};

function getPanel(): JQuery {
  return $(`#${SCRIPT_PANEL_ID}`);
}

function renderHeaderUser(): void {
  const v = loadVars();
  const $area = getPanel().find(`[data-${ROOT_NS}=header-user-area]`);

  if (!v.access_token || !state.user) {
    // 未登录状态: 仅渲染HTML, 事件由 bindPanelEvents 统一委托处理
    $area.html(`
      <span class="${ROOT_NS}-user-label" data-${ROOT_NS}="user-label">未登录</span>
      <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="header-login" style="padding:4px 10px;font-size:10px">[ LOGIN // 接入 ]</button>
    `);
    return;
  }

  // 已登录状态: 仅渲染HTML, 事件由 bindPanelEvents 统一委托处理
  const displayName = state.user.displayName ?? state.user.username;
  $area.html(`
    <span class="${ROOT_NS}-user-label logged-in" data-${ROOT_NS}="user-label" style="display:flex;align-items:center;gap:6px">
      ${state.user.avatar ? `<img src="${escapeHtml(state.user.avatar)}" style="width:16px;height:16px;border-radius:2px">` : '👤'}
      ${escapeHtml(displayName)}
      ${state.user.inGuild ? '<span style="color:#00ff88;font-size:9px">[IN_GUILD]</span>' : ''}
    </span>
    <div style="position:relative" data-${ROOT_NS}="user-menu-container">
      <button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="user-menu-toggle" style="padding:4px 8px;font-size:10px">▼</button>
      <div data-${ROOT_NS}="user-menu" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:var(--th-cyber-panel);border:1px solid rgba(0,243,255,0.3);border-radius:4px;min-width:130px;z-index:100">
        <div style="padding:6px 10px;font-size:10px;color:#6b7c8e;border-bottom:1px solid rgba(255,255,255,0.06)">${escapeHtml(displayName)}</div>
        <button type="button" data-${ROOT_NS}="menu-my" style="display:block;width:100%;padding:8px 10px;text-align:left;font-size:11px;background:transparent;border:none;color:var(--th-cyber-cyan);cursor:pointer">📁 我的作品</button>
        <button type="button" data-${ROOT_NS}="menu-refresh" style="display:block;width:100%;padding:8px 10px;text-align:left;font-size:11px;background:transparent;border:none;color:var(--th-cyber-cyan);cursor:pointer">🔄 刷新状态</button>
        <button type="button" data-${ROOT_NS}="menu-logout" style="display:block;width:100%;padding:8px 10px;text-align:left;font-size:11px;background:transparent;border:none;color:#ff6666;cursor:pointer">🚪 退出</button>
      </div>
    </div>
  `);
}

/** 从服务端同步「自动审核」开关（管理员） */
async function loadAutoApproveSetting(): Promise<void> {
  const v = loadVars();
  if (!v.access_token) return;
  const $cb = $(`[data-${ROOT_NS}=admin-auto-approve]`);
  if (!$cb.length) return;
  try {
    const j = await apiJson<{ enabled: boolean }>('/api/admin/settings/auto-approve', {
      token: v.access_token,
    });
    ($cb[0] as HTMLInputElement).checked = Boolean(j.enabled);
  } catch {
    // 忽略：非管理员或接口失败时不改勾选状态
  }
}

async function refreshMe(): Promise<void> {
  const v = loadVars();
  if (!v.access_token) {
    rwToast.info('未登录');
    state.user = null;
    renderHeaderUser();
    return;
  }
  try {
    const j = await apiJson<{ user: UserState }>(
      '/api/user/me',
      { token: v.access_token },
    );
    state.user = j.user;
    renderHeaderUser();
    rwToast.success('登录态有效');
    // 如果是管理员，显示管理员区域
    if (j.user.isAdmin) {
      $(`[data-${ROOT_NS}=admin-section]`).show();
      void loadAutoApproveSetting();
    } else {
      $(`[data-${ROOT_NS}=admin-section]`).hide();
    }
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : String(e));
    const nv = loadVars();
    nv.access_token = undefined;
    saveVars(nv);
    state.user = null;
    renderHeaderUser();
  }
}

async function loadList(category?: string): Promise<void> {
  const cat = category || (getPanel().data('current-category') as string) || '__recommended__';
  getPanel().data('current-category', cat);

  const v = loadVars();
  const $list = getPanel().find(`[data-${ROOT_NS}=list]`);
  const $meta = getPanel().find(`[data-${ROOT_NS}=list-meta]`);
  const $pager = getPanel().find(`[data-${ROOT_NS}=pager]`);
  const $title = getPanel().find(`[data-${ROOT_NS}=explore-title]`);

  // Update title based on category
  if (cat === '__recommended__') {
    $title.text('★ 推荐作品 / RECOMMENDED');
  } else if (cat === '__all__') {
    $title.text('📦 全部作品 / ALL WORKS');
  } else {
    $title.text(`${TYPE_ICONS[cat as WorkshopContentType]} ${WORKSHOP_TYPE_LABELS[cat as WorkshopContentType]} / ${(cat as string).toUpperCase().replace('-', '_')}`);
  }

  $list.html(`<div class="${ROOT_NS}-empty">⏳ 正在连接数据链路...</div>`);
  state.list.mode = cat === '__recommended__' ? 'recommended' : 'list';

  try {
    // Recommended view - uses /api/content/recommended
    if (cat === '__recommended__') {
      const j = await apiJson<{ items: ContentMetadata[]; total: number }>(
        `/api/content/recommended?limit=6`,
      );
      state.list.items = j.items;
      state.list.totalPages = 1; // Recommended is single page
      $meta.html(
        `推荐 · <span>${j.items.length}</span> 条 · 按喜欢+下载热度 · 最多 6 条`,
      );
      renderCards($list);
      $pager.empty();

      // 推荐页面后端无数据时显示空状态，不显示DEMO
      if (j.items.length === 0) {
        $list.html(`<div class="${ROOT_NS}-empty" style="padding:60px 20px;text-align:center;">
          <div style="font-size:24px;margin-bottom:16px">📭</div>
          <div style="color:var(--th-cyber-muted);margin-bottom:8px">暂无推荐内容</div>
          <div style="font-size:11px;color:#6b7c8e;">去其他分类发现更多作品</div>
        </div>`);
        $meta.html(`推荐 · <span style="color:#ffaa00">0</span> 条 · 等待优质内容`);
      }
      return;
    }

    // All view - merge all types
    if (cat === '__all__') {
      const results = await Promise.all(
        ALL_WORKSHOP_TYPES.map(t =>
          apiJson<{ items: ContentMetadata[]; pagination: { total: number } }>(
            `/api/content/list?type=${encodeURIComponent(t)}&page=1&pageSize=30&status=approved&sort=newest`,
          ),
        ),
      );
      const merged = results.flatMap(r => r.items);
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const page = state.list.page;
      const pageSize = 20;
      const start = (page - 1) * pageSize;
      const slice = merged.slice(start, start + pageSize);
      state.list.items = slice;
      state.list.totalPages = Math.max(1, Math.ceil(merged.length / pageSize));
      $meta.html(`全部 · <span>${merged.length}</span> 条 · 第 ${page}/${state.list.totalPages} 页`);
      renderCards($list);
      $pager.html(renderPager());

      // 后端无数据时，显示所有DEMO示例
      if (merged.length === 0) {
        renderDemoFallback($list, '__all__');
        $meta.html(`全部 · <span style="color:#ffaa00">OFFLINE</span> · 显示示例数据`);
      }
      return;
    }

    // Single type view
    const type = cat as WorkshopContentType;
    const page = state.list.page;
    const j = await apiJson<{ items: ContentMetadata[]; pagination: { totalPages: number; total: number } }>(
      `/api/content/list?type=${encodeURIComponent(type)}&page=${page}&pageSize=20&status=approved&sort=newest`,
    );
    state.list.items = j.items;
    state.list.totalPages = j.pagination.totalPages;
    $meta.html(`${escapeHtml(WORKSHOP_TYPE_LABELS[type])} · <span>${j.pagination.total}</span> 条 · 第 ${page}/${state.list.totalPages} 页`);
    renderCards($list);
    $pager.html(renderPager());

    // 后端无数据时，显示该类型的DEMO示例
    if (j.items.length === 0) {
      const demo = DEMO_CONTENTS[type];
      if (demo) {
        const demoItem = {
          id: `demo-${type}`,
          type: type,
          name: demo.name,
          description: demo.description,
          author: demo.author,
          authorId: 'demo',
          authorAvatar: null,
          tags: ['官方示例'],
          status: 'approved' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          downloads: 0,
          likes: 0,
          dataHash: '',
        };
        state.list.items = [demoItem];
        $meta.html(`${escapeHtml(WORKSHOP_TYPE_LABELS[type])} · <span style="color:#ffaa00">OFFLINE</span> · 显示示例数据`);
        renderCards($list);
        $pager.empty();
        rwToast.info(`${WORKSHOP_TYPE_LABELS[type]}暂无数据，显示官方示例`);
      } else {
        renderEmptyState($list, WORKSHOP_TYPE_LABELS[type], type);
      }
    }
  } catch (e) {
    // Fallback to demo data on error
    const catLabel = cat === '__recommended__' ? '推荐' : cat === '__all__' ? '全部' : WORKSHOP_TYPE_LABELS[cat as WorkshopContentType] || cat;
    rwToast.warning(`后端连接失败，显示${catLabel}示例数据`);
    getPanel().find(`[data-${ROOT_NS}=status-text]`).html('SYSTEM STATUS: <span style="color:#ffaa00">OFFLINE_MODE</span>');

    if (cat === '__recommended__') {
      // 推荐页面错误时显示空状态，不显示DEMO
      $list.html(`<div class="${ROOT_NS}-empty" style="padding:60px 20px;text-align:center;">
        <div style="font-size:24px;margin-bottom:16px">📭</div>
        <div style="color:var(--th-cyber-muted);margin-bottom:8px">暂无推荐内容</div>
        <div style="font-size:11px;color:#6b7c8e;">后端连接失败，请稍后重试</div>
      </div>`);
      $meta.html(`推荐 · <span style="color:#ffaa00">OFFLINE</span> · 暂无数据`);
    } else if (cat === '__all__') {
      // 全部页面错误时显示DEMO
      const demoItems = ALL_WORKSHOP_TYPES.map(t => {
        const d = DEMO_CONTENTS[t];
        return {
          id: `demo-${t}`,
          type: t,
          name: d.name,
          description: d.description,
          author: d.author,
          authorId: 'demo',
          authorAvatar: null,
          tags: ['官方示例'],
          status: 'approved' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          downloads: 0,
          likes: 0,
          dataHash: '',
        };
      });
      state.list.items = demoItems;
      $meta.html(`${catLabel} · <span style="color:#ffaa00">OFFLINE</span> · 显示示例数据`);
      renderCards($list);
      $pager.empty();
    } else {
      // Single type - show its demo
      const demo = DEMO_CONTENTS[cat as WorkshopContentType];
      if (demo) {
        const demoItem: ContentMetadata = {
          id: `demo-${cat}`,
          type: cat as WorkshopContentType,
          name: demo.name,
          description: demo.description,
          author: demo.author,
          authorId: 'demo',
          authorAvatar: null,
          tags: ['官方示例'],
          status: 'approved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          downloads: 0,
          likes: 0,
          dataHash: '',
        };
        state.list.items = [demoItem];
        $meta.html(`${catLabel} · <span style="color:#ffaa00">OFFLINE</span> · 显示示例数据`);
        renderCards($list);
        $pager.empty();
      } else {
        renderEmptyState($list, catLabel, cat as WorkshopContentType);
      }
    }
  }
}

// Empty state with call-to-action
function renderEmptyState($container: JQuery, label: string, type: string): void {
  const isAll = type === '__all__';
  const typeAttr = isAll ? '' : `data-type="${escapeHtml(type)}"`;
  $container.html(`
    <div class="${ROOT_NS}-empty" style="padding:60px 20px">
      <div style="font-size:24px;margin-bottom:16px">📭</div>
      <div style="color:var(--th-cyber-muted);margin-bottom:8px">该分类暂无作品</div>
      <div style="font-size:11px;color:#6b7c8e;margin-bottom:20px">成为首位贡献者，上传你的第一个作品</div>
      <button type="button" class="${ROOT_NS}-btn primary" data-${ROOT_NS}="empty-upload" ${typeAttr}>
        ⬆ 立即上传
      </button>
    </div>
  `);
}

// Demo fallback for recommended/all when backend is empty
function renderDemoFallback($container: JQuery, cat: string): void {
  const demoItems = ALL_WORKSHOP_TYPES.map(t => {
    const d = DEMO_CONTENTS[t];
    return {
      id: `demo-${t}`,
      type: t,
      name: d.name,
      description: d.description,
      author: d.author,
      authorId: 'demo',
      authorAvatar: null,
      tags: ['官方示例'],
      status: 'approved' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloads: 0,
      likes: 0,
      dataHash: '',
    };
  });
  state.list.items = demoItems;
  renderCards($container);
  rwToast.info('后端暂无数据，显示官方示例');
}

// 获取类型标签颜色
function getTypeColor(type: WorkshopContentType): string {
  const colors: Record<WorkshopContentType, string> = {
    'world-rule': 'cyan',
    'regional-rule': 'cyan',
    'personal-rule': 'pink',
    'region': 'yellow',
    'building': 'yellow',
    'character': 'pink',
  };
  return colors[type] || 'cyan';
}

// 星级显示
function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const empty = 5 - full;
  return '★'.repeat(full) + '☆'.repeat(empty);
}

// 卡片式渲染 - 显示 likes 和 downloads
function renderCards($container: JQuery, items?: ContentMetadata[], opts?: { myWorkspace?: boolean }): void {
  const displayItems = items ?? state.list.items;

  if (displayItems.length === 0) {
    $container.html(`<div class="${ROOT_NS}-empty">暂无数据</div>`);
    return;
  }

  const html = displayItems.map(m => {
    const color = getTypeColor(m.type);
    const icon = TYPE_ICONS[m.type];
    const downloads = m.downloads || 0;
    const dlText = downloads > 1000 ? (downloads/1000).toFixed(1) + 'k' : String(downloads);
    const likes = m.likes || 0;
    const isLiked = state.likedIds.has(m.id);
    const myWs = opts?.myWorkspace === true;
    const showLocalDelete = myWs && contentExistsLocally(m.id);
    const isOfficialDemo = myWs && m.authorId === 'demo';

    const descRaw = (m.description || '').trim();
    const descBlock =
      descRaw.length > 0
        ? `<div class="${ROOT_NS}-card-desc" title="${escapeHtml(descRaw)}">${escapeHtml(descRaw)}</div>`
        : '';

    const statusPill =
      m.status !== 'approved'
        ? `<span class="${ROOT_NS}-card-status-pill" style="background:${m.status === 'pending' ? 'rgba(240,248,0,0.15)' : 'rgba(255,0,0,0.15)'};color:${m.status === 'pending' ? '#f0f800' : '#ff6666'};border:1px solid ${m.status === 'pending' ? 'rgba(240,248,0,0.35)' : 'rgba(255,0,0,0.35)'}">${m.status === 'pending' ? '待审核' : m.status === 'rejected' ? '已拒绝' : escapeHtml(m.status)}</span>`
        : '';

    return `
      <div class="${ROOT_NS}-card" data-id="${escapeHtml(m.id)}" data-type="${escapeHtml(m.type)}" style="position:relative">
        <div class="${ROOT_NS}-card-body">
          <div class="${ROOT_NS}-card-hdr-row">
            <span class="${ROOT_NS}-card-tag ${color}">${icon} ${escapeHtml(WORKSHOP_TYPE_LABELS[m.type])}${isOfficialDemo ? '<span style="margin-left:6px;font-size:9px;color:#00ff88;font-weight:400">[官方示例]</span>' : ''}</span>
            <div class="${ROOT_NS}-card-hdr-right">
              <span class="${ROOT_NS}-card-author" title="${escapeHtml(m.author)}">${escapeHtml(m.author)}</span>
              ${statusPill}
            </div>
          </div>
          <div class="${ROOT_NS}-card-title">${escapeHtml(m.name)}</div>
          ${descBlock}
          <div class="${ROOT_NS}-card-stats">
            <span style="color:${isLiked ? '#ff00ff' : '#6b7c8e'}">♥ ${likes}</span>
            <span>⬇ ${dlText}</span>
          </div>
        </div>
        <div class="${ROOT_NS}-card-footer${showLocalDelete ? ` ${ROOT_NS}-card-footer--row` : ''}">
          ${showLocalDelete ? `<button type="button" class="${ROOT_NS}-btn small" data-${ROOT_NS}="my-delete-local" data-id="${escapeHtml(m.id)}" style="flex:1;min-width:72px;border-color:#ff4444;color:#ff8888;background:rgba(255,68,68,0.08);font-size:11px">🗑 删本地</button>` : ''}
          <button type="button" class="${ROOT_NS}-card-btn">VIEW // 查看</button>
        </div>
      </div>
    `;
  }).join('');

  $container.html(html);
}

function renderPager(): string {
  const p = state.list.page;
  const max = state.list.totalPages;
  if (max <= 1) return '';

  const prevClass = p <= 1 ? 'disabled' : '';
  const nextClass = p >= max ? 'disabled' : '';

  return `
    <button type="button" class="${ROOT_NS}-btn small ${prevClass}" data-${ROOT_NS}="page-prev" ${p <= 1 ? 'disabled' : ''}>◀ PREV</button>
    <span style="font-size:11px;color:#6b7c8e">${p} / ${max}</span>
    <button type="button" class="${ROOT_NS}-btn small ${nextClass}" data-${ROOT_NS}="page-next" ${p >= max ? 'disabled' : ''}>NEXT ▶</button>
  `;
}

async function runSearch(): Promise<void> {
  const q = String(getPanel().find(`[data-${ROOT_NS}=search-q]`).val() ?? '').trim();
  const cat = getPanel().data('current-category') as string || '__all__';

  if (!q) {
    rwToast.warning('请输入搜索关键词');
    return;
  }

  // 切换回探索视图
  $(`[data-${ROOT_NS}=explore-view]`).show();
  $(`[data-${ROOT_NS}=workspace-view]`).hide();

  const $list = getPanel().find(`[data-${ROOT_NS}=list]`);
  const $meta = getPanel().find(`[data-${ROOT_NS}=list-meta]`);
  const $pager = getPanel().find(`[data-${ROOT_NS}=pager]`);

  $list.html(`<div class="${ROOT_NS}-empty">搜索中...</div>`);
  state.list.mode = 'search';

  try {
    let path = `/api/content/search?q=${encodeURIComponent(q)}`;
    if (cat !== '__all__') {
      path += `&type=${encodeURIComponent(cat)}`;
    }
    const j = await apiJson<{ results: ContentMetadata[] }>(path);
    state.list.items = j.results;
    state.list.page = 1;
    state.list.totalPages = 1;
    $meta.html(`搜索「<span>${escapeHtml(q)}</span>」· ${j.results.length} 条`);
    renderCards($list);
    $pager.empty();

    // 高亮搜索结果状态
    $(`.${ROOT_NS}-sidebar-item`).removeClass('active');
  } catch (e) {
    $list.html(`<div class="${ROOT_NS}-empty">搜索失败</div>`);
    rwToast.error(e instanceof Error ? e.message : String(e));
  }
}

// 同步云端内容到本地存储
async function syncCloudContent(): Promise<void> {
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录后同步云端内容');
    return;
  }

  rwToast.info('正在同步云端内容...', { autoCloseMs: 0 });

  try {
    // 遍历所有类型获取内容（API需要type参数）
    const allCloudItems: ContentMetadata[] = [];
    for (const type of ALL_WORKSHOP_TYPES) {
      try {
        const j = await apiJson<{ items: ContentMetadata[]; pagination: { total: number } }>(
          `/api/content/list?type=${encodeURIComponent(type)}&status=approved&page=1&pageSize=100`,
          { token: v.access_token }
        );
        if (j.items && j.items.length > 0) {
          allCloudItems.push(...j.items);
        }
      } catch (e) {
        console.warn(`[规则工坊] 获取类型 ${type} 内容失败:`, e);
      }
    }

    if (allCloudItems.length === 0) {
      rwToast.info('云端暂无内容');
      return;
    }

    let success = 0;
    let skipped = 0;
    let failed = 0;

    // 逐个下载内容详情并保存到本地
    for (const item of allCloudItems) {
      try {
        // 检查本地是否已存在
        const existingLocal = getLocalContent(item.id, item.type);
        if (existingLocal) {
          // 本地已有，跳过
          skipped++;
          continue;
        }

        // 获取内容详情
        const detailJ = await apiJson<{ content: ContentMetadata & { data: unknown } }>(
          `/api/content/get/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`,
          { token: v.access_token }
        );
        const content = detailJ.content;

        // 保存到本地存储
        const localContent: LocalContent = {
          id: content.id,
          type: content.type,
          name: content.name,
          description: content.description,
          author: content.author,
          authorId: content.authorId || 'cloud',
          tags: content.tags || [],
          status: content.status,
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
          downloads: content.downloads || 0,
          likes: content.likes || 0,
          data: content.data,
          _storage: 'cloud',
        };
        saveLocalContent(localContent);
        success++;
      } catch (e) {
        failed++;
        console.error(`[规则工坊] 同步内容失败 (${item.id}):`, e);
      }
    }

    rwToast.success(`云端同步完成: 新下载 ${success} 条, 跳过 ${skipped} 条, 失败 ${failed} 条`);

    // 如果当前在本地视图，刷新列表
    const $workspaceView = $(`[data-${ROOT_NS}=workspace-view]`);
    if ($workspaceView.is(':visible')) {
      // 刷新我的工作台
      const currentTab = state.myWorksViewMode || 'local';
      if (currentTab === 'local') {
        loadMyContent('local');
      }
    }
  } catch (e) {
    console.error('[规则工坊] 同步云端内容失败:', e);
    rwToast.error(e instanceof Error ? e.message : '同步失败');
  }
}

/**
 * 从消息楼层变量中获取可用的区域列表、区域数据列表和角色列表
 * src/规则 项目使用 message 类型变量存储 stat_data
 */
async function fetchAvailableRegionsAndCharacters(): Promise<{
  regions: Array<{key: string; name: string}>;
  regionDataList: Array<{key: string; name: string}>; // 区域数据（建筑用）
  characters: Array<{key: string; name: string}>;
}> {
  let regionRulesData: Record<string, unknown> = {};
  let regionDataObj: Record<string, unknown> = {}; // 区域数据（stat_data.区域数据）
  let charactersData: Record<string, unknown> = {};

  // 尝试不同的变量类型，按 src/规则 实际使用顺序
  const tryGet = (opts: Parameters<typeof getVariables>[0]): Record<string, unknown> | null => {
    try {
      const vars = getVariables(opts) as Record<string, unknown>;
      console.log('[规则工坊] getVariables', opts, '结果:', vars);
      if (!vars) return null;
      // stat_data 可能在根级，也可能嵌套
      const sd = (vars.stat_data || vars) as Record<string, unknown>;
      return sd;
    } catch (e) {
      console.warn('[规则工坊] getVariables 失败:', opts, e);
      return null;
    }
  };

  let statData: Record<string, unknown> | null = null;

  // 1. 优先尝试最新消息楼层（src/规则 默认使用此）
  statData = tryGet({ type: 'message', message_id: 'latest' });

  // 2. 如果没有，尝试 chat 变量
  if (!statData) {
    statData = tryGet({ type: 'chat' });
  }

  // 3. 备用：character / global
  if (!statData) {
    statData = tryGet({ type: 'character' });
  }
  if (!statData) {
    statData = tryGet({ type: 'global' });
  }

  if (statData) {
    regionRulesData = (statData['区域规则'] || {}) as Record<string, unknown>;
    regionDataObj = (statData['区域数据'] || {}) as Record<string, unknown>;
    charactersData = (statData['角色档案'] || {}) as Record<string, unknown>;
  }

  console.log('[规则工坊] 区域规则数据:', regionRulesData);
  console.log('[规则工坊] 区域数据:', regionDataObj);
  console.log('[规则工坊] 角色档案数据:', charactersData);

  // 解析区域规则列表（regional-rule用）
  const regions: Array<{key: string; name: string}> = [];
  for (const [key, value] of Object.entries(regionRulesData)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const regionObj = value as Record<string, unknown>;
      const displayName = regionObj['名称'] as string | undefined;
      if (key) {
        regions.push({ key, name: displayName || key });
      }
    }
  }

  // 解析区域数据列表（building用）
  const regionDataList: Array<{key: string; name: string}> = [];
  for (const [key, value] of Object.entries(regionDataObj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const regionObj = value as Record<string, unknown>;
      const displayName = regionObj['名称'] as string | undefined;
      if (key) {
        regionDataList.push({ key, name: displayName || key });
      }
    }
  }

  // 解析角色列表
  const characters: Array<{key: string; name: string}> = [];
  for (const [key, value] of Object.entries(charactersData)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const charObj = value as Record<string, unknown>;
      const displayName = charObj['姓名'] as string | undefined;
      if (key) {
        characters.push({ key, name: displayName || key });
      }
    }
  }

  console.log('[规则工坊] 解析出的区域规则:', regions);
  console.log('[规则工坊] 解析出的区域数据:', regionDataList);
  console.log('[规则工坊] 解析出的角色:', characters);

  return {
    regions: regions.length > 0 ? regions : [{ key: '初始区域', name: '初始区域' }],
    regionDataList: regionDataList.length > 0 ? regionDataList : [{ key: 'AREA-001', name: '圣华女子学院' }],
    characters: characters.length > 0 ? characters : [{ key: 'CHR-001', name: '白梦梦' }]
  };
}

async function openDetail(id: string, type: WorkshopContentType): Promise<void> {
  // 优先从本地存储获取
  const localContent = getLocalContent(id, type);
  if (localContent) {
    console.log('[规则工坊] 从本地获取内容:', id);
    const c: ContentMetadata & { data: unknown } = {
      id: localContent.id,
      type: localContent.type,
      name: localContent.name,
      description: localContent.description,
      author: localContent.author,
      authorId: 'local',
      authorAvatar: null,
      tags: localContent.tags,
      status: localContent.status,
      createdAt: localContent.createdAt,
      updatedAt: localContent.updatedAt,
      downloads: localContent.downloads,
      likes: localContent.likes,
      data: localContent.data,
    };

    state.detail.meta = c;
    state.detail.data = c.data;
    state.detail.jsonText = JSON.stringify({ meta: c, data: c.data }, null, 2);

    // 构建更美观的详情展示
    const icon = TYPE_ICONS[c.type];
    const metaHtml = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">${icon}</span>
        <span style="color:#00f3ff;font-weight:600">${escapeHtml(WORKSHOP_TYPE_LABELS[c.type])}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#ff00ff">${escapeHtml(c.author)}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#f0f800">♥ ${c.likes || 0}</span>
        <span style="color:#6b7c8e">|</span>
        <span>⬇ ${c.downloads || 0}</span>
      </div>
      <div style="color:#6b7c8e;font-size:10px;font-family:ui-monospace,monospace">
        ID: ${escapeHtml(c.id)} · 更新: ${new Date(c.updatedAt).toLocaleDateString()}
      </div>
    `;

    // 如果是区域规则、个人规则或建筑，从消息楼层变量中读取 stat_data
    if (c.type === 'regional-rule' || c.type === 'personal-rule' || c.type === 'building') {
      const { regions, regionDataList, characters } = await fetchAvailableRegionsAndCharacters();
      state.detail.availableRegions = regions;
      state.detail.availableRegionDataList = regionDataList;
      state.detail.availableCharacters = characters;
    } else {
      state.detail.availableRegions = [];
      state.detail.availableRegionDataList = [];
      state.detail.availableCharacters = [];
    }

    // 构建格式化内容展示（替代JSON）
    const contentHtml = formatDetailContent(c.description, c.data, c.type, state.detail.availableRegions, state.detail.availableCharacters, state.detail.availableRegionDataList);

    $(`[data-${ROOT_NS}=detail-title]`).text(c.name);
    $(`[data-${ROOT_NS}=detail-meta]`).html(metaHtml);
    $(`[data-${ROOT_NS}=detail-pre]`).html(contentHtml);
    updateDetailLikeButton();
    $(`[data-${ROOT_NS}=detail-bg]`).addClass('show');
    return; // 本地获取成功，直接返回
  }

  // 内置示例卡片（DEMO_CONTENTS，不从 KV 拉取）
  if (id.startsWith('demo-')) {
    const demo = DEMO_CONTENTS[type];
    if (demo) {
      const c: ContentMetadata & { data: unknown } = {
        id,
        type,
        name: demo.name,
        description: demo.description,
        author: demo.author,
        authorId: 'demo',
        authorAvatar: null,
        tags: [],
        status: 'approved',
        createdAt: '',
        updatedAt: '',
        likes: 0,
        downloads: 0,
        data: demo.data,
      };

      state.detail.meta = c;
      state.detail.data = c.data;
      state.detail.jsonText = JSON.stringify({ meta: c, data: c.data }, null, 2);

      const icon = TYPE_ICONS[c.type];
      const metaHtml = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">${icon}</span>
        <span style="color:#00f3ff;font-weight:600">${escapeHtml(WORKSHOP_TYPE_LABELS[c.type])}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#ff00ff">${escapeHtml(c.author)}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#f0f800">♥ ${c.likes || 0}</span>
        <span style="color:#6b7c8e">|</span>
        <span>⬇ ${c.downloads || 0}</span>
      </div>
      <div style="color:#6b7c8e;font-size:10px;font-family:ui-monospace,monospace">
        ID: ${escapeHtml(c.id)} · 官方示例
      </div>
    `;

      if (c.type === 'regional-rule' || c.type === 'personal-rule' || c.type === 'building') {
        const { regions, regionDataList, characters } = await fetchAvailableRegionsAndCharacters();
        state.detail.availableRegions = regions;
        state.detail.availableRegionDataList = regionDataList;
        state.detail.availableCharacters = characters;
      } else {
        state.detail.availableRegions = [];
        state.detail.availableRegionDataList = [];
        state.detail.availableCharacters = [];
      }

      const contentHtml = formatDetailContent(
        c.description,
        c.data,
        c.type,
        state.detail.availableRegions,
        state.detail.availableCharacters,
        state.detail.availableRegionDataList,
      );

      $(`[data-${ROOT_NS}=detail-title]`).text(c.name);
      $(`[data-${ROOT_NS}=detail-meta]`).html(metaHtml);
      $(`[data-${ROOT_NS}=detail-pre]`).html(contentHtml);
      updateDetailLikeButton();
      $(`[data-${ROOT_NS}=detail-bg]`).addClass('show');
      return;
    }
  }

  // 本地没有，尝试从后端 API 获取
  try {
    const j = await apiJson<{ content: ContentMetadata & { data: unknown } }>(
      `/api/content/get/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
    );
    const c = j.content;
    state.detail.meta = c;
    state.detail.data = c.data;
    state.detail.jsonText = JSON.stringify({ meta: c, data: c.data }, null, 2);

    // 构建更美观的详情展示
    const icon = TYPE_ICONS[c.type];
    const metaHtml = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">${icon}</span>
        <span style="color:#00f3ff;font-weight:600">${escapeHtml(WORKSHOP_TYPE_LABELS[c.type])}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#ff00ff">${escapeHtml(c.author)}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#f0f800">♥ ${c.likes || 0}</span>
        <span style="color:#6b7c8e">|</span>
        <span>⬇ ${c.downloads || 0}</span>
      </div>
      <div style="color:#6b7c8e;font-size:10px;font-family:ui-monospace,monospace">
        ID: ${escapeHtml(c.id)} · 更新: ${new Date(c.updatedAt).toLocaleDateString()}
      </div>
    `;

    // 如果是区域规则、个人规则或建筑，从消息楼层变量中读取 stat_data
    if (c.type === 'regional-rule' || c.type === 'personal-rule' || c.type === 'building') {
      const { regions, regionDataList, characters } = await fetchAvailableRegionsAndCharacters();
      state.detail.availableRegions = regions;
      state.detail.availableRegionDataList = regionDataList;
      state.detail.availableCharacters = characters;
    } else {
      state.detail.availableRegions = [];
      state.detail.availableRegionDataList = [];
      state.detail.availableCharacters = [];
    }

    // 构建格式化内容展示（替代JSON）
    const contentHtml = formatDetailContent(c.description, c.data, c.type, state.detail.availableRegions, state.detail.availableCharacters, state.detail.availableRegionDataList);

    $(`[data-${ROOT_NS}=detail-title]`).text(c.name);
    $(`[data-${ROOT_NS}=detail-meta]`).html(metaHtml);
    $(`[data-${ROOT_NS}=detail-pre]`).html(contentHtml);
    updateDetailLikeButton();
    $(`[data-${ROOT_NS}=detail-bg]`).addClass('show');
  } catch (e) {
    console.error('[规则工坊] 从后端获取内容失败:', e);
    // API 失败且本地也没有，才显示错误
    rwToast.error('本地未找到此内容，且后端获取失败');
  }
}

// 格式化详情内容展示 - 针对规则类型只显示名称和效果描述
function formatDetailContent(
  description: string,
  data: unknown,
  type?: WorkshopContentType,
  availableRegions?: Array<{key: string; name: string}>,
  availableCharacters?: Array<{key: string; name: string}>,
  availableRegionDataList?: Array<{key: string; name: string}>
): string {
  let html = '<div style="line-height:1.6;">';

  // 区域规则特殊处理 - 使用"规则名"和"描述"字段
  if (type === 'regional-rule') {
    const ruleData = data as Record<string, unknown> | undefined;
    const 规则名 = ruleData?.['规则名'] as string || '';
    const 描述 = ruleData?.['描述'] as string || description || '';

    // 规则名部分 - 突出显示
    if (规则名) {
      html += `<div style="margin-bottom:16px;padding:16px;background:rgba(255,0,255,0.08);border:1px solid rgba(255,0,255,0.4);border-radius:6px;text-align:center;">
        <div style="font-size:10px;color:#ff00ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.15em">区域规则名 // RULE NAME</div>
        <div style="color:#ff00ff;font-size:18px;font-weight:bold;text-shadow:0 0 10px rgba(255,0,255,0.5);">${escapeHtml(规则名)}</div>
      </div>`;
    }

    // 描述部分
    html += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,243,255,0.05);border-left:4px solid #00f3ff;border-radius:0 6px 6px 0;">
      <div style="font-size:10px;color:#00f3ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">规则描述 // DESCRIPTION</div>
      <div style="color:#e8f4f8;font-size:14px;line-height:1.7;">${escapeHtml(描述)}</div>
    </div>`;

    // 区域选择下拉框 - value是键名(key)，显示文本是名称(name)
    let optionsHtml = '';
    if (availableRegions && availableRegions.length > 0) {
      if (typeof availableRegions[0] === 'object') {
        // 新格式：对象数组 {key, name}
        const regions = availableRegions as Array<{key: string; name: string}>;
        optionsHtml = regions.map(r => `<option value="${escapeHtml(r.key)}">${escapeHtml(r.name)}</option>`).join('');
      } else {
        // 旧格式：字符串数组（兼容）
        const regions = availableRegions as string[];
        optionsHtml = regions.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
      }
    } else {
      optionsHtml = `<option value="初始区域">初始区域</option>`;
    }

    html += `<div style="margin-top:16px;padding:14px;background:rgba(240,248,0,0.05);border:1px solid rgba(240,248,0,0.3);border-radius:6px;">
      <div style="font-size:10px;color:#f0f800;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">选择应用区域 // SELECT REGION</div>
      <select data-${ROOT_NS}="region-select" style="width:100%;padding:10px;background:var(--th-cyber-black);border:1px solid rgba(0,243,255,0.3);border-radius:4px;color:var(--th-cyber-cyan);font-size:13px;cursor:pointer;">
        ${optionsHtml}
      </select>
      <div style="font-size:9px;color:#6b7c8e;margin-top:6px;">选择要将此规则应用到哪个区域</div>
    </div>`;
  }
  // 世界规则 - 使用"名称"和"效果描述"字段
  else if (type === 'world-rule') {
    const ruleData = data as Record<string, unknown> | undefined;
    const 名称 = ruleData?.['名称'] as string || '';
    const 效果描述 = ruleData?.['效果描述'] as string || description || '';

    // 名称部分 - 突出显示
    if (名称) {
      html += `<div style="margin-bottom:16px;padding:16px;background:rgba(255,0,255,0.08);border:1px solid rgba(255,0,255,0.4);border-radius:6px;text-align:center;">
        <div style="font-size:10px;color:#ff00ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.15em">规则名称 // NAME</div>
        <div style="color:#ff00ff;font-size:18px;font-weight:bold;text-shadow:0 0 10px rgba(255,0,255,0.5);">${escapeHtml(名称)}</div>
      </div>`;
    }

    // 效果描述部分
    html += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,243,255,0.05);border-left:4px solid #00f3ff;border-radius:0 6px 6px 0;">
      <div style="font-size:10px;color:#00f3ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">效果描述 // EFFECT</div>
      <div style="color:#e8f4f8;font-size:14px;line-height:1.7;">${escapeHtml(效果描述)}</div>
    </div>`;

    // 其他元信息（可选展示）
    const 标记 = ruleData?.['标记'] as string || '';
    const 状态 = ruleData?.['状态'] as string || '';
    if (标记 || 状态) {
      html += `<div style="display:flex;gap:12px;margin-top:12px;">`;
      if (标记) {
        html += `<div style="flex:1;padding:10px;background:rgba(255,255,255,0.03);border-radius:4px;text-align:center;">
          <div style="font-size:9px;color:#6b7c8e;margin-bottom:4px;">标记</div>
          <div style="font-size:12px;color:#f0f800;">${escapeHtml(标记)}</div>
        </div>`;
      }
      if (状态) {
        html += `<div style="flex:1;padding:10px;background:rgba(255,255,255,0.03);border-radius:4px;text-align:center;">
          <div style="font-size:9px;color:#6b7c8e;margin-bottom:4px;">状态</div>
          <div style="font-size:12px;color:#00ff88;">${escapeHtml(状态)}</div>
        </div>`;
      }
      html += `</div>`;
    }
  }
  // 个人规则 - 使用"名称"和"效果描述"，并需要选择目标角色
  else if (type === 'personal-rule') {
    const ruleData = data as Record<string, unknown> | undefined;
    const 名称 = ruleData?.['名称'] as string || '';
    const 效果描述 = ruleData?.['效果描述'] as string || description || '';

    // 名称部分 - 突出显示
    if (名称) {
      html += `<div style="margin-bottom:16px;padding:16px;background:rgba(255,0,255,0.08);border:1px solid rgba(255,0,255,0.4);border-radius:6px;text-align:center;">
        <div style="font-size:10px;color:#ff00ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.15em">规则名称 // NAME</div>
        <div style="color:#ff00ff;font-size:18px;font-weight:bold;text-shadow:0 0 10px rgba(255,0,255,0.5);">${escapeHtml(名称)}</div>
      </div>`;
    }

    // 效果描述部分
    html += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,243,255,0.05);border-left:4px solid #00f3ff;border-radius:0 6px 6px 0;">
      <div style="font-size:10px;color:#00f3ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">效果描述 // EFFECT</div>
      <div style="color:#e8f4f8;font-size:14px;line-height:1.7;">${escapeHtml(效果描述)}</div>
    </div>`;

    // 角色选择部分
    html += `<div style="margin-bottom:16px;padding:14px;background:rgba(255,165,0,0.1);border:1px solid rgba(255,165,0,0.3);border-radius:6px;">
      <div style="font-size:10px;color:#ffaa00;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">目标角色 // TARGET CHARACTER</div>
      <select data-${ROOT_NS}=character-select style="width:100%;padding:8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.4);border-radius:4px;color:#e0f0f0;font-size:14px;outline:none;">
        <option value="" disabled selected>选择目标角色...</option>
        ${(availableCharacters || []).map(r => `<option value="${escapeHtml(r.key)}">${escapeHtml(r.name)}</option>`).join('')}
      </select>
      <div style="font-size:9px;color:#6b7c8e;margin-top:6px;">此规则将应用到选中的角色身上</div>
    </div>`;
  }
  // 区域数据 - 显示名称和描述
  else if (type === 'region') {
    const regionData = data as Record<string, unknown> | undefined;
    const 名称 = regionData?.['名称'] as string || '';
    const 描述 = regionData?.['描述'] as string || description || '';

    if (名称) {
      html += `<div style="margin-bottom:16px;padding:16px;background:rgba(255,193,7,0.08);border:1px solid rgba(255,193,7,0.4);border-radius:6px;text-align:center;">
        <div style="font-size:10px;color:#ffc107;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.15em">区域名称 // REGION NAME</div>
        <div style="color:#ffc107;font-size:18px;font-weight:bold;text-shadow:0 0 10px rgba(255,193,7,0.5);">${escapeHtml(名称)}</div>
      </div>`;
    }

    if (描述) {
      html += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,243,255,0.05);border-left:4px solid #00f3ff;border-radius:0 6px 6px 0;">
        <div style="font-size:10px;color:#00f3ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">区域描述 // DESCRIPTION</div>
        <div style="color:#e8f4f8;font-size:14px;line-height:1.7;">${escapeHtml(描述)}</div>
      </div>`;
    }
  }
  // 建筑数据 - 显示名称、描述，并需要选择所属区域和输入房间
  else if (type === 'building') {
    const buildingData = data as Record<string, unknown> | undefined;
    const 名称 = buildingData?.['名称'] as string || '';
    const 描述 = buildingData?.['描述'] as string || description || '';

    if (名称) {
      html += `<div style="margin-bottom:16px;padding:16px;background:rgba(255,193,7,0.08);border:1px solid rgba(255,193,7,0.4);border-radius:6px;text-align:center;">
        <div style="font-size:10px;color:#ffc107;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.15em">建筑名称 // BUILDING NAME</div>
        <div style="color:#ffc107;font-size:18px;font-weight:bold;text-shadow:0 0 10px rgba(255,193,7,0.5);">${escapeHtml(名称)}</div>
      </div>`;
    }

    if (描述) {
      html += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,243,255,0.05);border-left:4px solid #00f3ff;border-radius:0 6px 6px 0;">
        <div style="font-size:10px;color:#00f3ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">建筑描述 // DESCRIPTION</div>
        <div style="color:#e8f4f8;font-size:14px;line-height:1.7;">${escapeHtml(描述)}</div>
      </div>`;
    }

    // 所属区域选择下拉框
    // 如果 availableRegionDataList 为空，使用硬编码的默认值（从用户变量中提取）
    let effectiveRegionList = availableRegionDataList;
    if (!effectiveRegionList || effectiveRegionList.length === 0) {
      console.log('[规则工坊] 使用默认区域数据');
      effectiveRegionList = [
        { key: 'AREA-001', name: '圣华女子学院' },
        { key: 'REG-MODERN-01', name: '银座商业街' }
      ];
    }

    let regionOptionsHtml = effectiveRegionList.map(r => `<option value="${escapeHtml(r.key)}">${escapeHtml(r.name)}</option>`).join('');

    html += `<div style="margin-bottom:16px;padding:14px;background:rgba(255,165,0,0.1);border:1px solid rgba(255,165,0,0.3);border-radius:6px;">
      <div style="font-size:10px;color:#ffaa00;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">所属区域 // PARENT REGION</div>
      <select data-${ROOT_NS}=building-region-select style="width:100%;padding:8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.4);border-radius:4px;color:#e0f0f0;font-size:14px;outline:none;">
        <option value="" disabled selected>选择所属区域...</option>
        ${regionOptionsHtml}
      </select>
      <div style="font-size:9px;color:#6b7c8e;margin-top:6px;">此建筑将归属于选中的区域</div>
    </div>`;

    // 展示现有房间布局（只读，不输入）
    const 内部房间布局 = buildingData?.['内部房间布局'] as Record<string, { 描述?: string }> | undefined;
    if (内部房间布局 && Object.keys(内部房间布局).length > 0) {
      html += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.3);border-radius:6px;">
        <div style="font-size:10px;color:#00c8ff;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em">内部房间布局 // ROOMS</div>
        ${Object.entries(内部房间布局).map(([roomName, roomData]) => {
          const roomDesc = roomData?.描述 || '';
          return `<div style="margin-bottom:10px;padding:10px;background:rgba(0,0,0,0.2);border-radius:4px;">
            <div style="font-size:12px;color:#00c8ff;font-weight:bold;margin-bottom:4px;">${escapeHtml(roomName)}</div>
            ${roomDesc ? `<div style="font-size:11px;color:#a0b0c0;line-height:1.5;">${escapeHtml(roomDesc)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }
  }
  // 角色档案 - 显示姓名和简介
  else if (type === 'character') {
    const charData = data as Record<string, unknown> | undefined;
    const 姓名 = charData?.['姓名'] as string || charData?.['名称'] as string || '';
    const 简介 = charData?.['角色简介'] as string || charData?.['描述'] as string || description || '';

    if (姓名) {
      html += `<div style="margin-bottom:16px;padding:16px;background:rgba(255,105,180,0.08);border:1px solid rgba(255,105,180,0.4);border-radius:6px;text-align:center;">
        <div style="font-size:10px;color:#ff69b4;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.15em">角色姓名 // CHARACTER NAME</div>
        <div style="color:#ff69b4;font-size:18px;font-weight:bold;text-shadow:0 0 10px rgba(255,105,180,0.5);">${escapeHtml(姓名)}</div>
      </div>`;
    }

    if (简介) {
      html += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,243,255,0.05);border-left:4px solid #00f3ff;border-radius:0 6px 6px 0;">
        <div style="font-size:10px;color:#00f3ff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">角色简介 // INTRODUCTION</div>
        <div style="color:#e8f4f8;font-size:14px;line-height:1.7;">${escapeHtml(简介)}</div>
      </div>`;
    }
  }
  // 其他类型显示完整数据
  else {
    html += `<div style="margin-bottom:16px;padding:12px;background:rgba(0,243,255,0.05);border-left:3px solid #00f3ff;border-radius:0 4px 4px 0;">
      <div style="font-size:10px;color:#6b7c8e;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.1em">简介 // DESCRIPTION</div>
      <div style="color:#e8f4f8;font-size:13px;">${escapeHtml(description || '暂无简介')}</div>
    </div>`;

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const dataObj = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(dataObj)) {
        if (value === null || value === undefined) continue;

        html += `<div style="margin-bottom:12px;">`;
        html += `<div style="font-size:10px;color:#ff00ff;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">${escapeHtml(key)}</div>`;

        if (typeof value === 'string') {
          html += `<div style="color:#a0b0c0;font-size:12px;padding:8px;background:rgba(255,255,255,0.02);border-radius:4px;">${escapeHtml(value)}</div>`;
        } else {
          html += `<div style="color:#a0b0c0;font-size:12px;padding:8px;background:rgba(255,255,255,0.02);border-radius:4px;font-family:ui-monospace,monospace;">${escapeHtml(JSON.stringify(value, null, 2))}</div>`;
        }
        html += `</div>`;
      }
    }
  }

  html += '</div>';
  return html;
}

// Load my works from /api/user/my-content
async function loadMyContent(): Promise<void> {
  const v = loadVars();
  const $list = getPanel().find(`[data-${ROOT_NS}=my-list]`);
  const $meta = getPanel().find(`[data-${ROOT_NS}=my-list-meta]`);
  const $empty = getPanel().find(`[data-${ROOT_NS}=my-empty]`);

  $list.html(`<div class="${ROOT_NS}-empty">加载中...</div>`);
  $empty.hide();

  const appendOfficialDemos = (items: ContentMetadata[]): ContentMetadata[] => {
    const demos = buildOfficialDemoMetas();
    const ids = new Set(items.map(i => i.id));
    return [...items, ...demos.filter(d => !ids.has(d.id))];
  };

  // 优先从本地存储获取内容（不需要登录）
  const localContents = getLocalContents();
  const localItems: ContentMetadata[] = localContents.map(c => ({
    id: c.id,
    type: c.type,
    name: c.name,
    description: c.description,
    author: c.author,
    authorId: 'local',
    authorAvatar: null,
    tags: c.tags,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    downloads: c.downloads,
    likes: c.likes,
  }));

  const demoCount = ALL_WORKSHOP_TYPES.length;

  // 如果有登录，尝试从后端获取并合并
  if (v.access_token) {
    try {
      const j = await apiJson<{ items: ContentMetadata[] }>(
        '/api/user/my-content',
        { token: v.access_token },
      );
      const localIds = new Set(localItems.map(i => i.id));
      const mergedItems = [...localItems, ...j.items.filter(i => !localIds.has(i.id))];
      const displayItems = appendOfficialDemos(mergedItems);
      state.my.items = displayItems;
      $meta.html(
        `<span>${displayItems.length}</span> 个作品 · 本地 ${localItems.length} 个 · 云端 ${j.items.length} 个 · 官方示例 ${demoCount} 条`,
      );
      renderCards($list, displayItems, { myWorkspace: true });
      $empty.hide();
    } catch (e) {
      // 后端获取失败，只显示本地内容
      console.warn('[规则工坊] 从后端获取失败，仅显示本地内容:', e);
      const displayItems = appendOfficialDemos(localItems);
      state.my.items = displayItems;
      $meta.html(`<span>${displayItems.length}</span> 个作品 · 仅本地（云端同步失败） · 官方示例 ${demoCount} 条`);
      renderCards($list, displayItems, { myWorkspace: true });
      $empty.hide();
    }
  } else {
    // 未登录，只显示本地内容
    const displayItems = appendOfficialDemos(localItems);
    state.my.items = displayItems;
    $meta.html(`<span>${displayItems.length}</span> 个作品 · 仅本地 · 官方示例 ${demoCount} 条`);
    renderCards($list, displayItems, { myWorkspace: true });
    $empty.hide();
  }
}

// Switch workspace tab
function switchWsTab(tab: 'my' | 'upload'): void {
  const $my = $(`[data-${ROOT_NS}=ws-view-my]`);
  const $upload = $(`[data-${ROOT_NS}=ws-view-upload]`);
  const $tabMy = $(`[data-${ROOT_NS}=ws-tab-my]`);
  const $tabUpload = $(`[data-${ROOT_NS}=ws-tab-upload]`);

  if (tab === 'my') {
    $my.show();
    $upload.hide();
    $tabMy.css({ background: 'rgba(255,0,255,0.15)', borderColor: 'rgba(255,0,255,0.5)' });
    $tabUpload.css({ background: '', borderColor: '' });
    void loadMyContent();
  } else {
    $my.hide();
    $upload.show();
    $tabMy.css({ background: '', borderColor: '' });
    $tabUpload.css({ background: 'rgba(255,0,255,0.15)', borderColor: 'rgba(255,0,255,0.5)' });
  }
}

function closeDetail(): void {
  $(`[data-${ROOT_NS}=detail-bg]`).removeClass('show');
}

// ============ 管理后台和审核功能 ============

/** 更新管理后台已选择计数显示 */
function updateDashboardSelectedCount(): void {
  const count = state.dashboard.selectedIds.size;
  $(`[data-${ROOT_NS}=dash-selected-count]`).text(`已选择 ${count} 项`);
}

/** 获取选中的管理后台项目 */
function getSelectedDashboardItems(): ContentMetadata[] {
  return state.dashboard.items.filter(item => state.dashboard.selectedIds.has(item.id));
}

/** 更新审核界面已选择计数显示 */
function updateReviewSelectedCount(): void {
  const count = state.review.selectedIds.size;
  $(`[data-${ROOT_NS}=review-selected-count]`).text(`已选择 ${count} 项`);
}

/** 获取选中的审核项目 */
function getSelectedReviewItems(): ContentMetadata[] {
  return state.review.items.filter(item => state.review.selectedIds.has(item.id));
}

/** 删除单个内容 */
async function deleteContent(id: string, type: WorkshopContentType): Promise<void> {
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    return;
  }
  try {
    await apiJson(`/api/content/delete/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token: v.access_token,
    });
    // 同时删除本地存储
    deleteLocalContent(id);
    rwToast.success('删除成功');
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '删除失败');
  }
}

/** 批量删除内容 */
async function batchDeleteContent(): Promise<void> {
  const selected = getSelectedDashboardItems();
  if (selected.length === 0) {
    rwToast.warning('请先选择要删除的内容');
    return;
  }
  if (!confirm(`确定要删除选中的 ${selected.length} 项内容吗？此操作不可恢复。`)) {
    return;
  }
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    return;
  }
  try {
    let success = 0;
    let failed = 0;
    for (const item of selected) {
      try {
        await apiJson(`/api/admin/delete/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
          token: v.access_token,
        });
        deleteLocalContent(item.id);
        success++;
      } catch (e) {
        failed++;
        console.error(`[规则工坊] 批量删除失败 (${item.id}):`, e);
      }
    }
    rwToast.success(`批量删除完成: 成功 ${success} 条, 失败 ${failed} 条`);
    state.dashboard.selectedIds.clear();
    updateDashboardSelectedCount();
    void loadDashboard(state.dashboard.page);
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '批量删除失败');
  }
}

/** 批量下载到本地 */
async function batchDownloadToLocal(): Promise<void> {
  const selected = getSelectedDashboardItems();
  if (selected.length === 0) {
    rwToast.warning('请先选择要下载的内容');
    return;
  }
  const v = loadVars();
  let successCount = 0;
  for (const item of selected) {
    try {
      const j = await apiJson<{ content: ContentMetadata & { data: unknown } }>(
        `/api/content/get/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`,
        { token: v.access_token },
      );
      const localContent: LocalContent = {
        id: j.content.id,
        type: j.content.type,
        name: j.content.name,
        description: j.content.description,
        author: j.content.author,
        data: j.content.data,
        tags: j.content.tags,
        status: j.content.status,
        createdAt: j.content.createdAt,
        updatedAt: j.content.updatedAt,
        likes: j.content.likes,
        downloads: j.content.downloads,
      };
      saveLocalContent(localContent);
      successCount++;
    } catch (e) {
      console.error(`[规则工坊] 下载 ${item.id} 失败:`, e);
    }
  }
  rwToast.success(`成功下载 ${successCount}/${selected.length} 项内容到本地`);
}

/** 批量通过（管理后台用） */
async function batchApproveContent(): Promise<void> {
  const selected = getSelectedDashboardItems().filter(item => item.status === 'pending');
  if (selected.length === 0) {
    rwToast.warning('没有待审核的内容需要批准');
    return;
  }
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    return;
  }
  try {
    let success = 0;
    let failed = 0;
    for (const item of selected) {
      try {
        await apiJson(`/api/admin/review/${encodeURIComponent(item.id)}`, {
          method: 'POST',
          token: v.access_token,
          body: { action: 'approve' },
        });
        success++;
      } catch (e) {
        failed++;
      }
    }
    rwToast.success(`批量批准完成: 成功 ${success} 条, 失败 ${failed} 条`);
    state.dashboard.selectedIds.clear();
    updateDashboardSelectedCount();
    void loadDashboard(state.dashboard.page);
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '批量批准失败');
  }
}

/** 批量拒绝（管理后台用） */
async function batchRejectContent(): Promise<void> {
  const selected = getSelectedDashboardItems().filter(item => item.status === 'pending');
  if (selected.length === 0) {
    rwToast.warning('没有待审核的内容需要拒绝');
    return;
  }
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    return;
  }
  try {
    let success = 0;
    let failed = 0;
    for (const item of selected) {
      try {
        await apiJson(`/api/admin/review/${encodeURIComponent(item.id)}`, {
          method: 'POST',
          token: v.access_token,
          body: { action: 'reject' },
        });
        success++;
      } catch (e) {
        failed++;
      }
    }
    rwToast.success(`批量拒绝完成: 成功 ${success} 条, 失败 ${failed} 条`);
    state.dashboard.selectedIds.clear();
    updateDashboardSelectedCount();
    void loadDashboard(state.dashboard.page);
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '批量拒绝失败');
  }
}

/** 批量通过（审核界面用） */
async function batchReviewApprove(): Promise<void> {
  const selected = getSelectedReviewItems();
  if (selected.length === 0) {
    rwToast.warning('请先选择要批准的内容');
    return;
  }
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    return;
  }
  try {
    let success = 0;
    let failed = 0;
    for (const item of selected) {
      try {
        await apiJson(`/api/admin/review/${encodeURIComponent(item.id)}`, {
          method: 'POST',
          token: v.access_token,
          body: { action: 'approve' },
        });
        success++;
      } catch (e) {
        failed++;
      }
    }
    rwToast.success(`批量批准完成: 成功 ${success} 条, 失败 ${failed} 条`);
    state.review.selectedIds.clear();
    updateReviewSelectedCount();
    void loadPendingReview();
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '批量批准失败');
  }
}

/** 批量拒绝（审核界面用） */
async function batchReviewReject(): Promise<void> {
  const selected = getSelectedReviewItems();
  if (selected.length === 0) {
    rwToast.warning('请先选择要拒绝的内容');
    return;
  }
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    return;
  }
  try {
    let success = 0;
    let failed = 0;
    for (const item of selected) {
      try {
        await apiJson(`/api/admin/review/${encodeURIComponent(item.id)}`, {
          method: 'POST',
          token: v.access_token,
          body: { action: 'reject' },
        });
        success++;
      } catch (e) {
        failed++;
      }
    }
    rwToast.success(`批量拒绝完成: 成功 ${success} 条, 失败 ${failed} 条`);
    state.review.selectedIds.clear();
    updateReviewSelectedCount();
    void loadPendingReview();
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '批量拒绝失败');
  }
}

/** 加载待审核内容 */
async function loadPendingReview(): Promise<void> {
  state.review.loading = true;
  const $list = $(`[data-${ROOT_NS}=review-list]`);
  $list.html(`<div class="${ROOT_NS}-empty">加载待审核内容...</div>`);
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    state.review.loading = false;
    $list.html(`<div class="${ROOT_NS}-empty">请先登录</div>`);
    return;
  }
  try {
    const j = await apiJson<{ pending: ContentMetadata[] }>('/api/admin/pending', {
      token: v.access_token,
    });
    state.review.items = j.pending || [];
    state.review.selectedIds.clear();
    updateReviewSelectedCount();
    renderReviewList();
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '加载待审核内容失败');
    $list.html(`<div class="${ROOT_NS}-empty">加载失败</div>`);
  } finally {
    state.review.loading = false;
  }
}

/** 加载管理后台内容 */
async function loadDashboard(page = 1): Promise<void> {
  state.dashboard.loading = true;
  state.dashboard.page = page;
  const $list = $(`[data-${ROOT_NS}=dashboard-list]`);
  $list.html(`<div class="${ROOT_NS}-empty">加载中...</div>`);
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    state.dashboard.loading = false;
    $list.html(`<div class="${ROOT_NS}-empty">请先登录</div>`);
    return;
  }
  try {
    const filterStatus = $(`[data-${ROOT_NS}=dash-filter-status]`).val() as string || '';
    const filterType = $(`[data-${ROOT_NS}=dash-filter-type]`).val() as string || '';
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '20');
    if (filterStatus) params.set('status', filterStatus);
    if (filterType) params.set('type', filterType);
    const j = await apiJson<{ items: ContentMetadata[]; pagination: { page: number; totalPages: number; total: number } }>(`/api/admin/list-all?${params.toString()}`, {
      token: v.access_token,
    });
    state.dashboard.items = j.items || [];
    state.dashboard.totalPages = j.pagination?.totalPages || 1;
    state.dashboard.selectedIds.clear();
    updateDashboardSelectedCount();
    // 更新计数显示
    $(`[data-${ROOT_NS}=dash-total]`).text(`共 ${j.pagination?.total || 0} 条`);
    $(`[data-${ROOT_NS}=dash-page-info]`).text(`第 ${j.pagination?.page || 1} / ${j.pagination?.totalPages || 1} 页`);
    renderDashboardList();
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '加载管理后台内容失败');
    $list.html(`<div class="${ROOT_NS}-empty">加载失败</div>`);
  } finally {
    state.dashboard.loading = false;
  }
}

/** 审核单个内容 */
async function reviewContent(id: string, type: WorkshopContentType, action: 'approve' | 'reject'): Promise<void> {
  const v = loadVars();
  if (!v.access_token) {
    rwToast.warning('请先登录');
    return;
  }
  try {
    await apiJson(`/api/admin/review/${encodeURIComponent(id)}`, {
      method: 'POST',
      token: v.access_token,
      body: { action },
    });
    rwToast.success(action === 'approve' ? '已通过审核' : '已拒绝');
    // 从列表中移除已处理的项
    state.review.items = state.review.items.filter(item => item.id !== id);
    state.review.selectedIds.delete(id);
    updateReviewSelectedCount();
    renderReviewList();
  } catch (e) {
    rwToast.error(e instanceof Error ? e.message : '审核操作失败');
  }
}

/** 渲染审核列表 */
function renderReviewList(): void {
  const $list = $(`[data-${ROOT_NS}=review-list]`);
  if (state.review.items.length === 0) {
    $list.html('<div style="padding:40px;text-align:center;color:#6b7c8e;">暂无待审核内容</div>');
    return;
  }
  const html = state.review.items.map(item => {
    const icon = TYPE_ICONS[item.type];
    const isSelected = state.review.selectedIds.has(item.id);
    return `
      <div class="${ROOT_NS}-card ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" data-review-item style="cursor:pointer;position:relative;">
        <div style="position:absolute;top:8px;left:8px;">
          <input type="checkbox" data-${ROOT_NS}="review-checkbox" data-id="${escapeHtml(item.id)}" ${isSelected ? 'checked' : ''} style="cursor:pointer;">
        </div>
        <div style="margin-left:28px;">
          <div style="font-size:10px;color:#00f3ff;margin-bottom:4px;">${icon} ${escapeHtml(WORKSHOP_TYPE_LABELS[item.type])}</div>
          <div style="font-weight:600;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.name)}</div>
          <div style="font-size:11px;color:#6b7c8e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.description || '')}</div>
          <div style="font-size:10px;color:#ff00ff;margin-top:6px;">@${escapeHtml(item.author)}</div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button data-${ROOT_NS}="review-approve-one" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" style="padding:4px 12px;background:rgba(0,255,136,0.2);border:1px solid rgba(0,255,136,0.5);border-radius:3px;color:#00ff88;font-size:11px;cursor:pointer;">通过</button>
            <button data-${ROOT_NS}="review-reject-one" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" style="padding:4px 12px;background:rgba(255,102,102,0.2);border:1px solid rgba(255,102,102,0.5);border-radius:3px;color:#ff6666;font-size:11px;cursor:pointer;">拒绝</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  $list.html(html);
}

/** 渲染管理后台列表 */
function renderDashboardList(): void {
  const $list = $(`[data-${ROOT_NS}=dashboard-list]`);
  if (state.dashboard.items.length === 0) {
    $list.html('<div style="padding:40px;text-align:center;color:#6b7c8e;">暂无内容</div>');
    return;
  }
  const statusColors: Record<string, string> = {
    approved: '#00ff88',
    pending: '#ffaa00',
    rejected: '#ff6666',
  };
  const statusLabels: Record<string, string> = {
    approved: '已通过',
    pending: '待审核',
    rejected: '已拒绝',
  };
  const html = state.dashboard.items.map(item => {
    const icon = TYPE_ICONS[item.type];
    const isSelected = state.dashboard.selectedIds.has(item.id);
    const statusColor = statusColors[item.status] || '#6b7c8e';
    const statusLabel = statusLabels[item.status] || item.status;
    return `
      <div class="${ROOT_NS}-card ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" data-dashboard-item style="cursor:pointer;position:relative;">
        <div style="position:absolute;top:8px;left:8px;">
          <input type="checkbox" data-${ROOT_NS}="dashboard-checkbox" data-id="${escapeHtml(item.id)}" ${isSelected ? 'checked' : ''} style="cursor:pointer;">
        </div>
        <div style="margin-left:28px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:10px;color:#00f3ff;">${icon} ${escapeHtml(WORKSHOP_TYPE_LABELS[item.type])}</span>
            <span style="font-size:10px;color:${statusColor};">${statusLabel}</span>
          </div>
          <div style="font-weight:600;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.name)}</div>
          <div style="font-size:11px;color:#6b7c8e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.description || '')}</div>
          <div style="font-size:10px;color:#ff00ff;margin-top:6px;">@${escapeHtml(item.author)}</div>
          <div style="font-size:10px;color:#6b7c8e;margin-top:4px;">♥ ${item.likes || 0} | ⬇ ${item.downloads || 0}</div>
        </div>
      </div>
    `;
  }).join('');
  $list.html(html);
}

/** 更新管理后台分页 */
function updateDashboardPagination(): void {
  $(`[data-${ROOT_NS}=dash-page-info]`).text(`第 ${state.dashboard.page} / ${state.dashboard.totalPages} 页`);
  $(`[data-${ROOT_NS}=dash-page-prev]`).prop('disabled', state.dashboard.page <= 1);
  $(`[data-${ROOT_NS}=dash-page-next]`).prop('disabled', state.dashboard.page >= state.dashboard.totalPages);
}

/** 打开审核弹窗 */
function openReviewModal(): void {
  $(`[data-${ROOT_NS}=review-bg]`).addClass('show');
  state.review.selectedIds.clear();
  updateReviewSelectedCount();
  void loadPendingReview();
}

/** 关闭审核弹窗 */
function closeReviewModal(): void {
  $(`[data-${ROOT_NS}=review-bg]`).removeClass('show');
}

/** 打开管理后台弹窗 */
function openDashboardModal(): void {
  $(`[data-${ROOT_NS}=dashboard-bg]`).addClass('show');
  state.dashboard.selectedIds.clear();
  updateDashboardSelectedCount();
  void loadDashboard(1);
}

/** 关闭管理后台弹窗 */
function closeDashboardModal(): void {
  $(`[data-${ROOT_NS}=dashboard-bg]`).removeClass('show');
}

// Check if user has liked this content (local session cache)
function hasLiked(id: string): boolean {
  return state.likedIds.has(id);
}

function updateDetailLikeButton(): void {
  const id = state.detail.meta?.id;
  if (!id) return;
  const likes = state.detail.meta?.likes ?? 0;
  const isLiked = hasLiked(id);
  const $btn = $(`[data-${ROOT_NS}=detail-like]`);

  if (isLiked) {
    // 已点赞状态 - 更亮的红色
    $btn.html(`♥ 已点赞 (${likes})`).css({
      'color': '#ff0000',
      'background': 'rgba(255,0,0,0.35)',
      'border-color': '#ff0000',
      'box-shadow': '0 0 20px rgba(255,0,0,0.5), inset 0 0 10px rgba(255,0,0,0.2)',
      'text-shadow': '0 0 8px rgba(255,0,0,0.8)'
    });
  } else {
    // 未点赞状态 - 暗红色
    $btn.html(`♥ 点赞 (${likes})`).css({
      'color': '#ff4444',
      'background': 'rgba(255,0,0,0.15)',
      'border-color': '#ff4444',
      'box-shadow': '0 0 10px rgba(255,0,0,0.2)',
      'text-shadow': '0 0 4px rgba(255,0,0,0.4)'
    });
  }
}

function bindDetailActions(): void {
  // 直接绑定到弹窗元素上, 不通过 document 委托
  const $bg = $(`.${ROOT_NS}-modal-bg[data-${ROOT_NS}=detail-bg]`);

  $bg.find(`[data-${ROOT_NS}=detail-close]`).on('click', () => closeDetail());
  $bg.on('click', ev => {
    if (ev.target === ev.currentTarget) closeDetail();
  });

  // Insert to @src/规则 frontend's input box (#llm-input) with <UpdateVariable><JSONPatch> format
  $bg.find(`[data-${ROOT_NS}=detail-send]`).on('click', () => {
    const data = state.detail.data;
    const meta = state.detail.meta;
    if (!data || !meta) {
      rwToast.warning('暂无数据可插入');
      return;
    }

    // 获取数据对象
    const dataObj = (data && typeof data === 'object' && !Array.isArray(data)) ? data as Record<string, unknown> : {};

    let jsonPatchOp: { op: 'add' | 'replace'; path: string; value: unknown };

    // 区域规则特殊处理 - 从下拉框获取选中的区域名
    if (meta.type === 'regional-rule') {
      // 获取规则名和描述
      const 规则名 = (dataObj['规则名'] as string) || meta.name || '未命名';
      const 描述 = (dataObj['描述'] as string) || meta.description || '';

      // 从下拉框获取选中的区域名
      const selectedRegion = $(`[data-${ROOT_NS}=region-select]`).val() as string || '初始区域';

      // 构建区域规则的 JSONPatch
      // path: /区域规则/{区域名}/细分规则/{规则名}
      jsonPatchOp = {
        op: 'add',
        path: `/区域规则/${selectedRegion}/细分规则/${规则名}`,
        value: {
          描述: 描述,
          状态: '生效中'
        }
      };

      rwToast.info(`将插入到区域「${selectedRegion}」的细分规则中`);
    }
    // 个人规则特殊处理 - 生成随机ID并选择目标角色
    else if (meta.type === 'personal-rule') {
      const 名称 = (dataObj['名称'] as string) || meta.name || '未命名';
      const 效果描述 = (dataObj['效果描述'] as string) || meta.description || '';

      // 生成随机ID (PR-时间戳-随机数)
      const randomId = `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 从下拉框获取选中的角色key，然后从角色列表中找到姓名
      const selectedCharKey = $(`[data-${ROOT_NS}=character-select]`).val() as string || '';
      let selectedCharName = selectedCharKey;

      // 从 availableCharacters 中找到对应的名字
      if (state.detail.availableCharacters && selectedCharKey) {
        const char = state.detail.availableCharacters.find(c => c.key === selectedCharKey);
        if (char) selectedCharName = char.name;
      }

      // 如果用户没有选择角色，提示并默认使用第一个
      if (!selectedCharKey) {
        rwToast.warning('请先选择目标角色');
        return;
      }

      // 构建个人规则的 JSONPatch
      // path: /个人规则/{随机ID}
      jsonPatchOp = {
        op: 'add',
        path: `/个人规则/${randomId}`,
        value: {
          名称: 名称,
          适用对象: selectedCharName,
          效果描述: 效果描述,
          状态: '生效中',
          细分规则: {},
          标记: '个人级'
        }
      };

      rwToast.info(`将插入个人规则到角色「${selectedCharName}」身上`);
    }
    // 世界规则 - 直接使用 replace 操作符
    else if (meta.type === 'world-rule') {
      const typeKey = '世界规则';
      const ruleName = (dataObj['名称'] as string) || meta.name || '未命名';

      jsonPatchOp = {
        op: 'replace',
        path: `/${typeKey}/${ruleName}`,
        value: dataObj
      };
    }
    // 区域数据 - 生成随机ID，使用 add 操作符
    else if (meta.type === 'region') {
      const 名称 = (dataObj['名称'] as string) || meta.name || '未命名区域';
      const 描述 = (dataObj['描述'] as string) || meta.description || '';

      // 生成随机区域ID (REG-{时间戳}-{随机数})
      const randomId = `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      jsonPatchOp = {
        op: 'add',
        path: `/区域数据/${randomId}`,
        value: {
          名称: 名称,
          描述: 描述,
          包含建筑: {}
        }
      };

      rwToast.info(`将添加新区域「${名称}」`);
    }
    // 建筑数据 - 生成随机ID，使用 add 操作符，需要选择所属区域
    else if (meta.type === 'building') {
      const 名称 = (dataObj['名称'] as string) || meta.name || '未命名建筑';
      const 描述 = (dataObj['描述'] as string) || meta.description || '';

      // 从下拉框获取选中的区域ID
      const selectedRegionId = $(`[data-${ROOT_NS}=building-region-select]`).val() as string || '';
      if (!selectedRegionId) {
        rwToast.warning('请先选择所属区域');
        return;
      }

      // 从原始数据中获取房间布局（如果有的话）
      const 内部房间布局 = (dataObj['内部房间布局'] as Record<string, { 描述?: string }>) || {};

      // 生成随机建筑ID (BLD-{时间戳}-{随机数})
      const randomId = `BLD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      jsonPatchOp = {
        op: 'add',
        path: `/建筑数据/${randomId}`,
        value: {
          名称: 名称,
          描述: 描述,
          所属区域ID: selectedRegionId,
          内部房间布局: 内部房间布局,
          当前活动: {},
          当前角色: {}
        }
      };

      const roomCount = Object.keys(内部房间布局).length;
      rwToast.info(`将添加新建筑「${名称}」到区域「${selectedRegionId}」${roomCount > 0 ? `，包含 ${roomCount} 个房间` : ''}`);
    }
    // 角色档案 - 生成随机ID，使用 add 操作符，包含完整角色数据
    else if (meta.type === 'character') {
      const 姓名 = (dataObj['姓名'] as string) || (dataObj['名称'] as string) || meta.name || '';
      const 角色简介 = (dataObj['角色简介'] as string) || (dataObj['描述'] as string) || '';

      // 验证必填字段
      if (!姓名 || !姓名.trim()) {
        rwToast.warning('角色姓名不能为空');
        return;
      }
      if (!角色简介 || !角色简介.trim()) {
        rwToast.warning('角色简介不能为空');
        return;
      }

      // 生成随机角色ID (CHR-{时间戳}-{随机数})
      const randomId = `CHR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 构建完整的角色数据（其他字段可为空，由AI后续填写）
      jsonPatchOp = {
        op: 'add',
        path: `/角色档案/${randomId}`,
        value: {
          姓名: 姓名.trim(),
          状态: '未出场',
          角色简介: 角色简介.trim(),
          代表性发言: (dataObj['代表性发言'] as Record<string, string>) || {},
          爱好: (dataObj['爱好'] as Record<string, unknown>) || {},
          当前内心想法: (dataObj['当前内心想法'] as string) || '',
          当前位置: {
            区域ID: '',
            建筑ID: '',
            活动ID: '',
            当前行为描述: '待命'
          },
          性格: (dataObj['性格'] as Record<string, string>) || {},
          性癖: (dataObj['性癖'] as Record<string, unknown>) || {},
          隐藏性癖: (dataObj['隐藏性癖'] as string) || '',
          身体信息: (dataObj['身体信息'] as Record<string, unknown>) || {
            年龄: 0,
            身高: 0,
            体重: 0,
            三围: '',
            体质特征: ''
          },
          服装状态: (dataObj['服装状态'] as Record<string, unknown>) || {},
          身体部位物理状态: (dataObj['身体部位物理状态'] as Record<string, unknown>) || {},
          敏感点开发: (dataObj['敏感点开发'] as Record<string, unknown>) || {},
          数值: (dataObj['数值'] as Record<string, number>) || {
            好感度: 0,
            性癖开发值: 0,
            发情值: 0
          },
          身份标签: (dataObj['身份标签'] as Record<string, string>) || {},
          当前综合生理描述: (dataObj['当前综合生理描述'] as string) || '',
          参与活动记录: (dataObj['参与活动记录'] as Record<string, unknown>) || {}
        }
      };

      rwToast.info(`将添加新角色「${姓名}」`);
    }
    // 其他类型
    else {
      const typeKey = '自定义数据';
      const ruleName = (dataObj['名称'] as string) || meta.name || '未命名';

      jsonPatchOp = {
        op: 'replace',
        path: `/${typeKey}/${ruleName}`,
        value: dataObj
      };
    }

    // Format: <UpdateVariable>\n<JSONPatch>...</JSONPatch>\n</UpdateVariable>
    const jsonPatchContent = JSON.stringify([jsonPatchOp], null, 2);
    const fullContent = `<UpdateVariable>\n<JSONPatch>\n${jsonPatchContent}\n</JSONPatch>\n</UpdateVariable>`;

    // Try to find @src/规则 frontend iframe and its input box
    let inserted = false;

    // Method 1: Check all iframes for #llm-input directly (most reliable)
    $('iframe').each(function () {
      if (inserted) return;
      try {
        const iframeEl = this as HTMLIFrameElement;
        const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
        if (!iframeDoc) return;

        // Check if this iframe has the rule frontend's input box
        const $input = $(iframeDoc).find('#llm-input');
        if ($input.length) {
          const currentVal = String($input.val() ?? '');

          // Check if there's already an <UpdateVariable> block
          const updateVarMatch = currentVal.match(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/);

          let newValue: string;
          if (updateVarMatch) {
            // Replace existing UpdateVariable block
            newValue = currentVal.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/, fullContent);
          } else {
            // Append new UpdateVariable block
            const separator = currentVal && !currentVal.endsWith('\n') ? '\n\n' : '';
            newValue = currentVal + separator + fullContent;
          }

          $input.val(newValue).trigger('input');
          rwToast.success('已插入到规则前端输入框');
          inserted = true;
          closeDetail();
        }
      } catch (e) {
        // Cross-origin or not accessible, skip
      }
    });

    // Method 2: Try to find by iframe attributes containing rule-related keywords
    if (!inserted) {
      const keywords = ['规则', 'gui', 'frontend', 'app', 'panel', '界面'];
      $('iframe').each(function () {
        if (inserted) return;

        const $iframe = $(this);
        const src = ($iframe.attr('src') || '').toLowerCase();
        const title = ($iframe.attr('title') || '').toLowerCase();
        const id = ($iframe.attr('id') || '').toLowerCase();
        const name = ($iframe.attr('name') || '').toLowerCase();
        const combined = `${src} ${title} ${id} ${name}`;

        // Check if any keyword matches
        const hasMatch = keywords.some(kw => combined.includes(kw.toLowerCase()));

        if (hasMatch) {
          try {
            const iframeDoc = (this as HTMLIFrameElement).contentDocument;
            if (iframeDoc) {
              const $input = $(iframeDoc).find('textarea');
              if ($input.length) {
                const currentVal = String($input.val() ?? '');
                const updateVarMatch = currentVal.match(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/);

                let newValue: string;
                if (updateVarMatch) {
                  newValue = currentVal.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/, fullContent);
                } else {
                  const separator = currentVal && !currentVal.endsWith('\n') ? '\n\n' : '';
                  newValue = currentVal + separator + fullContent;
                }

                $input.val(newValue).trigger('input');
                rwToast.success('已插入到前端输入框');
                inserted = true;
                closeDetail();
              }
            }
          } catch {
            // ignore
          }
        }
      });
    }

    // Method 3: If still not found, show the content and let user copy manually
    if (!inserted) {
      rwToast.warning('未找到前端界面，请手动复制并粘贴到输入框');

      // Show a temporary textarea with the content
      const $modal = $(`[data-${ROOT_NS}=detail-bg]`);
      const $copyArea = $(`
        <div data-${ROOT_NS}="manual-copy-area" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--th-cyber-panel);border:2px solid #ff00ff;padding:20px;border-radius:8px;z-index:99999;max-width:500px;width:90%;">
          <div style="font-size:12px;color:#ff00ff;margin-bottom:10px;text-align:center;">请手动复制以下内容到输入框</div>
          <textarea data-${ROOT_NS}="manual-copy-text" readonly style="width:100%;height:150px;background:var(--th-cyber-black);border:1px solid rgba(0,243,255,0.3);border-radius:4px;color:var(--th-cyber-cyan);font:11px/1.4 ui-monospace,monospace;resize:none;padding:10px;">${fullContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
          <div style="display:flex;gap:10px;margin-top:15px;justify-content:center;">
            <button type="button" data-${ROOT_NS}="close-manual-copy" style="padding:8px 16px;background:rgba(255,0,255,0.2);border:1px solid #ff00ff;color:#ff00ff;border-radius:4px;cursor:pointer;font-size:11px;">关闭</button>
          </div>
        </div>
      `).appendTo('body');

      // Auto select text for easy copying
      const $textarea = $copyArea.find(`[data-${ROOT_NS}=manual-copy-text]`);
      $textarea[0]?.focus();
      ($textarea[0] as HTMLTextAreaElement)?.select();

      // Bind close button
      $copyArea.find(`[data-${ROOT_NS}=close-manual-copy]`).on('click', function() {
        $copyArea.remove();
      });
    }
  });

  // Like / Unlike - with visual feedback
  $bg.find(`[data-${ROOT_NS}=detail-like]`).on('click', async () => {
    const v = loadVars();
    if (!v.access_token) {
      rwToast.warning('请先登录后点赞');
      return;
    }
    const id = state.detail.meta?.id;
    if (!id) return;

    const isLiked = hasLiked(id);
    try {
      if (isLiked) {
        // Unlike
        const res = await apiJson<{ liked: boolean; likes: number }>(
          `/api/content/unlike/${encodeURIComponent(id)}`,
          { method: 'POST', token: v.access_token }
        );
        state.likedIds.delete(id);
        if (state.detail.meta) {
          state.detail.meta.likes = res.likes;
        }
        rwToast.info('已取消点赞');
      } else {
        // Like
        const res = await apiJson<{ liked: boolean; likes: number; already?: boolean }>(
          `/api/content/like/${encodeURIComponent(id)}`,
          { method: 'POST', token: v.access_token }
        );
        state.likedIds.add(id);
        if (state.detail.meta) {
          state.detail.meta.likes = res.likes;
        }
        if (res.already) {
          rwToast.info('已经点赞过了');
        } else {
          rwToast.success('点赞成功！');
        }
      }
      // Add visual pulse effect
      const $btn = $bg.find(`[data-${ROOT_NS}=detail-like]`);
      $btn.css({
        'background': isLiked ? 'rgba(255,0,0,0.2)' : 'rgba(255,0,0,0.4)',
        'transform': 'scale(1.1)',
        'transition': 'all 0.2s ease'
      });
      setTimeout(() => {
        $btn.css({
          'background': 'rgba(255,0,0,0.2)',
          'transform': 'scale(1)'
        });
      }, 200);

      updateDetailLikeButton();
    } catch (e) {
      rwToast.error(e instanceof Error ? e.message : String(e));
    }
  });

  // ============ 审核弹窗事件绑定 ============
  const $reviewBg = $(`.${ROOT_NS}-modal-bg[data-${ROOT_NS}=review-bg]`);

  // 关闭审核弹窗
  $reviewBg.find(`[data-${ROOT_NS}=review-close]`).on('click', () => closeReviewModal());
  $reviewBg.on('click', ev => {
    if (ev.target === ev.currentTarget) closeReviewModal();
  });

  // 批量操作按钮
  $reviewBg.find(`[data-${ROOT_NS}=review-batch-approve]`).on('click', () => void batchReviewApprove());
  $reviewBg.find(`[data-${ROOT_NS}=review-batch-reject]`).on('click', () => void batchReviewReject());

  // 全选
  $reviewBg.find(`[data-${ROOT_NS}=review-select-all]`).on('change', function() {
    const checked = (this as HTMLInputElement).checked;
    $reviewBg.find(`[data-${ROOT_NS}=review-checkbox]`).each(function() {
      (this as HTMLInputElement).checked = checked;
      const id = $(this).data('id') as string;
      if (checked) {
        state.review.selectedIds.add(id);
      } else {
        state.review.selectedIds.delete(id);
      }
    });
    updateReviewSelectedCount();
  });

  // 审核列表中的单个操作和选择（使用委托绑定）
  $reviewBg.on('click', `[data-${ROOT_NS}=review-approve-one]`, function() {
    const id = $(this).data('id') as string;
    const type = $(this).data('type') as WorkshopContentType;
    void reviewContent(id, type, 'approve');
  });

  $reviewBg.on('click', `[data-${ROOT_NS}=review-reject-one]`, function() {
    const id = $(this).data('id') as string;
    const type = $(this).data('type') as WorkshopContentType;
    void reviewContent(id, type, 'reject');
  });

  // 复选框选择
  $reviewBg.on('change', `[data-${ROOT_NS}=review-checkbox]`, function() {
    const id = $(this).data('id') as string;
    const checked = (this as HTMLInputElement).checked;
    if (checked) {
      state.review.selectedIds.add(id);
    } else {
      state.review.selectedIds.delete(id);
    }
    updateReviewSelectedCount();
    // 更新卡片样式
    const $card = $(this).closest(`[data-review-item]`);
    if (checked) {
      $card.addClass('selected');
    } else {
      $card.removeClass('selected');
    }
  });

  // 点击卡片切换选择（不包括按钮区域）
  $reviewBg.on('click', `[data-review-item]`, function(ev) {
    const $target = $(ev.target as HTMLElement);
    // 如果点击的是复选框或按钮，不处理
    if ($target.is(`[data-${ROOT_NS}=review-checkbox]`) ||
        $target.closest(`[data-${ROOT_NS}=review-approve-one]`).length ||
        $target.closest(`[data-${ROOT_NS}=review-reject-one]`).length) {
      return;
    }
    const $checkbox = $(this).find(`[data-${ROOT_NS}=review-checkbox]`);
    const id = $checkbox.data('id') as string;
    const checked = !$checkbox.prop('checked');
    $checkbox.prop('checked', checked);
    if (checked) {
      state.review.selectedIds.add(id);
      $(this).addClass('selected');
    } else {
      state.review.selectedIds.delete(id);
      $(this).removeClass('selected');
    }
    updateReviewSelectedCount();
  });

  // ============ 管理后台弹窗事件绑定 ============
  const $dashboardBg = $(`.${ROOT_NS}-modal-bg[data-${ROOT_NS}=dashboard-bg]`);

  // 关闭管理后台弹窗
  $dashboardBg.find(`[data-${ROOT_NS}=dashboard-close]`).on('click', () => closeDashboardModal());
  $dashboardBg.on('click', ev => {
    if (ev.target === ev.currentTarget) closeDashboardModal();
  });

  // 筛选器变更
  $dashboardBg.find(`[data-${ROOT_NS}=dash-filter-status], [data-${ROOT_NS}=dash-filter-type]`).on('change', () => {
    state.dashboard.page = 1;
    void loadDashboard(1);
  });

  // 刷新按钮
  $dashboardBg.find(`[data-${ROOT_NS}=dash-refresh]`).on('click', () => {
    void loadDashboard(state.dashboard.page);
  });

  // 分页按钮
  $dashboardBg.find(`[data-${ROOT_NS}=dash-page-prev]`).on('click', () => {
    if (state.dashboard.page > 1) {
      void loadDashboard(state.dashboard.page - 1);
    }
  });
  $dashboardBg.find(`[data-${ROOT_NS}=dash-page-next]`).on('click', () => {
    if (state.dashboard.page < state.dashboard.totalPages) {
      void loadDashboard(state.dashboard.page + 1);
    }
  });

  // 批量操作按钮
  $dashboardBg.find(`[data-${ROOT_NS}=dash-batch-delete]`).on('click', () => void batchDeleteContent());
  $dashboardBg.find(`[data-${ROOT_NS}=dash-batch-download]`).on('click', () => void batchDownloadToLocal());

  // 全选
  $dashboardBg.find(`[data-${ROOT_NS}=dash-select-all]`).on('change', function() {
    const checked = (this as HTMLInputElement).checked;
    $dashboardBg.find(`[data-${ROOT_NS}=dashboard-checkbox]`).each(function() {
      (this as HTMLInputElement).checked = checked;
      const id = $(this).data('id') as string;
      if (checked) {
        state.dashboard.selectedIds.add(id);
      } else {
        state.dashboard.selectedIds.delete(id);
      }
    });
    updateDashboardSelectedCount();
  });

  // 复选框选择
  $dashboardBg.on('change', `[data-${ROOT_NS}=dashboard-checkbox]`, function() {
    const id = $(this).data('id') as string;
    const checked = (this as HTMLInputElement).checked;
    if (checked) {
      state.dashboard.selectedIds.add(id);
    } else {
      state.dashboard.selectedIds.delete(id);
    }
    updateDashboardSelectedCount();
    // 更新卡片样式
    const $card = $(this).closest(`[data-dashboard-item]`);
    if (checked) {
      $card.addClass('selected');
    } else {
      $card.removeClass('selected');
    }
  });

  // 点击卡片切换选择（不包括复选框区域）
  $dashboardBg.on('click', `[data-dashboard-item]`, function(ev) {
    const $target = $(ev.target as HTMLElement);
    // 如果点击的是复选框，不处理
    if ($target.is(`[data-${ROOT_NS}=dashboard-checkbox]`)) {
      return;
    }
    const $checkbox = $(this).find(`[data-${ROOT_NS}=dashboard-checkbox]`);
    const id = $checkbox.data('id') as string;
    const checked = !$checkbox.prop('checked');
    $checkbox.prop('checked', checked);
    if (checked) {
      state.dashboard.selectedIds.add(id);
      $(this).addClass('selected');
    } else {
      state.dashboard.selectedIds.delete(id);
      $(this).removeClass('selected');
    }
    updateDashboardSelectedCount();
  });
}

function startDiscordLogin(): void {
  const base = normalizeBase(loadVars().api_base_url);
  const key = randomSessionKey();
  saveVars({ ...loadVars(), access_token: undefined });

  const pollMs = 1200;
  let timer: ReturnType<typeof setInterval> | undefined;
  const cleanup = () => {
    if (timer) clearInterval(timer);
    window.removeEventListener('message', onMsg);
  };

  const onMsg = (ev: MessageEvent) => {
    const d = ev.data as { type?: string; token?: string };
    if (!d || d.type !== 'workshop-auth' || !d.token) return;
    cleanup();
    const nv = loadVars();
    nv.access_token = d.token;
    saveVars(nv);
    rwToast.success('Discord 登录成功');
    renderHeaderUser();
    void refreshMe();
    void loadList();
    try {
      (ev.source as Window)?.close?.();
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('message', onMsg);

  const url = `${base}/api/auth/discord?redirect=${encodeURIComponent(key)}`;
  window.open(url, '_blank', 'width=520,height=720');

  timer = setInterval(() => {
    void (async () => {
      try {
        const baseUrl = normalizeBase(loadVars().api_base_url);
        const res = await fetch(`${baseUrl}/api/auth/poll?key=${encodeURIComponent(key)}`);
        const j = (await res.json()) as { token?: string };
        if (j.token) {
          cleanup();
          const nv = loadVars();
          nv.access_token = j.token;
          saveVars(nv);
          rwToast.success('Discord 登录成功');
          renderHeaderUser();
          void refreshMe();
          void loadList();
        }
      } catch {
        /* ignore */
      }
    })();
  }, pollMs);

  setTimeout(() => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    window.removeEventListener('message', onMsg);
  }, 600000);
}

/** 打开/关闭主面板（悬浮按钮与酒馆脚本栏「规则工坊」共用） */
function toggleWorkshopPanel(): void {
  $(`#${SCRIPT_PANEL_ID}`).toggleClass(`${ROOT_NS}-open`);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncToggleViewportPosition());
  });
}

function bindPanelEvents(): void {
  // 关键: 直接在面板与悬浮按钮上绑定, 而不是在 document 上委托.
  // 旧面板被 .remove() 时, jQuery 自动清理它身上的所有事件处理器, 不会污染 document.
  console.info('[规则工坊] 开始绑定事件处理器...');

  const $panel = getPanel();
  const $toggle = $(`#${SCRIPT_TOGGLE_ID}`);

  if (!$panel.length) {
    console.error('[规则工坊] 面板不存在! 无法绑定事件');
    return;
  }

  /** 移动端 touchend 后会再触发 click，需防抖避免连点两次 */
  let suppressToggleClick = false;
  $toggle.on('touchend', e => {
    e.preventDefault();
    suppressToggleClick = true;
    toggleWorkshopPanel();
    window.setTimeout(() => {
      suppressToggleClick = false;
    }, 450);
  });
  $toggle.on('click', e => {
    if (suppressToggleClick) {
      e.preventDefault();
      return;
    }
    toggleWorkshopPanel();
  });

  // 关闭按钮
  $panel.find(`[data-${ROOT_NS}=panel-close]`).on('click', () => {
    console.info('[规则工坊] 点击关闭按钮');
    $(`#${SCRIPT_PANEL_ID}`).removeClass(`${ROOT_NS}-open`);
  });

  // 侧边栏分类点击 (静态元素, 直接绑)
  $panel.find(`.${ROOT_NS}-sidebar-item`).on('click', function (this: HTMLElement) {
    const cat = $(this).data('category') as string;
    console.info('[规则工坊] 点击侧边栏:', cat);
    $panel.find(`.${ROOT_NS}-sidebar-item`).removeClass('active');
    $(this).addClass('active');
    state.list.page = 1;
    $panel.data('current-category', cat);
    $panel.find(`[data-${ROOT_NS}=explore-view]`).show();
    $panel.find(`[data-${ROOT_NS}=workspace-view]`).hide();
    void loadList(cat);
  });

  // 工具栏: 我的工作站
  $panel.find(`[data-${ROOT_NS}=view-workspace]`).on('click', () => {
    console.info('[规则工坊] 点击我的工作站');
    $panel.find(`[data-${ROOT_NS}=explore-view]`).hide();
    $panel.find(`[data-${ROOT_NS}=workspace-view]`).show();
    $panel.find(`.${ROOT_NS}-sidebar-item`).removeClass('active');
    switchWsTab('my');
  });

  // 工作站 Tab 切换
  $panel.find(`[data-${ROOT_NS}=ws-tab-my]`).on('click', () => {
    console.info('[规则工坊] 点击我的作品 tab');
    switchWsTab('my');
  });
  $panel.find(`[data-${ROOT_NS}=ws-tab-upload]`).on('click', () => {
    console.info('[规则工坊] 点击上传新作品 tab');
    switchWsTab('upload');
  });

  // 取消上传
  $panel.find(`[data-${ROOT_NS}=cancel-upload]`).on('click', () => {
    $panel.find(`[data-${ROOT_NS}=workspace-view]`).hide();
    $panel.find(`[data-${ROOT_NS}=explore-view]`).show();
    const cat = $panel.data('current-category') as string || '__recommended__';
    $panel.find(`.${ROOT_NS}-sidebar-item`).removeClass('active');
    $panel.find(`.${ROOT_NS}-sidebar-item[data-category="${cat}"]`).addClass('active');
  });

  // 工作站内类别选择
  $panel.find(`.${ROOT_NS}-type-select`).on('click', function (this: HTMLElement) {
    const type = $(this).data('type') as WorkshopContentType;
    $panel.find(`.${ROOT_NS}-type-select`).removeClass('primary').css({
      'background': 'rgba(0,243,255,0.15)',
      'border-color': 'rgba(0,243,255,0.3)',
      'color': '#00f3ff'
    });
    $(this).addClass('primary').css({
      'background': 'rgba(255,0,255,0.25)',
      'border-color': 'rgba(255,0,255,0.5)',
      'color': '#ff00ff',
      'box-shadow': '0 0 15px rgba(255,0,255,0.3)'
    });
    $panel.data('upload-type', type);
    $panel.find(`[data-${ROOT_NS}=upload-form]`).css('opacity', '1');

    // 根据类型显示/隐藏表单字段
    const $dataContainer = $panel.find(`[data-${ROOT_NS}=up-data-container]`);
    const $regionFormContainer = $panel.find(`[data-${ROOT_NS}=region-form-container]`);
    const $buildingFormContainer = $panel.find(`[data-${ROOT_NS}=building-form-container]`);
    const $commonFields = $panel.find(`[data-${ROOT_NS}=common-fields]`);
    const $nameLabel = $panel.find(`[data-${ROOT_NS}=name-label]`);

    if (type === 'world-rule' || type === 'regional-rule' || type === 'personal-rule') {
      // 规则类型：显示通用字段，隐藏数据载荷、区域智能表单、建筑智能表单
      $commonFields.show();
      $dataContainer.hide();
      $regionFormContainer.hide();
      $buildingFormContainer.hide();
      $nameLabel.html('项目代号 <span>_TITLE</span>');
    } else if (type === 'region') {
      // 区域类型：隐藏通用字段和数据载荷、建筑表单，显示区域智能表单
      $commonFields.hide();
      $dataContainer.hide();
      $regionFormContainer.show();
      $buildingFormContainer.hide();
      $nameLabel.html('区域名字 <span>_TITLE</span>');
      // 重置区域表单
      resetRegionForm($panel);
    } else if (type === 'building') {
      // 建筑类型：显示通用字段和建筑智能表单，隐藏数据载荷和区域表单
      $commonFields.show();
      $dataContainer.hide();
      $regionFormContainer.hide();
      $buildingFormContainer.show();
      $nameLabel.html('建筑名称 <span>_TITLE</span>');
      // 重置建筑表单
      resetBuildingForm($panel);
    } else {
      // 角色类型：显示通用字段和数据载荷，隐藏区域和建筑智能表单
      $commonFields.show();
      $dataContainer.show();
      $regionFormContainer.hide();
      $buildingFormContainer.hide();
      $nameLabel.html('角色姓名 <span>_TITLE</span>');
    }
  });

  // 重置区域表单
  function resetRegionForm($panel: JQuery) {
    $panel.find(`[data-${ROOT_NS}=region-name]`).val('');
    $panel.find(`[data-${ROOT_NS}=region-desc]`).val('');
    $panel.find(`[data-${ROOT_NS}=region-buildings-list]`).empty();
  }

  // 重置建筑表单（用于独立建筑上传）
  function resetBuildingForm($panel: JQuery) {
    $panel.find(`[data-${ROOT_NS}=building-rooms-list]`).empty();
    $panel.find(`[data-${ROOT_NS}=building-activities-list]`).empty();
  }

  // 添加建筑按钮（区域表单内）
  $panel.find(`[data-${ROOT_NS}=add-building-btn]`).on('click', () => {
    addBuildingItem($panel);
  });

  // 建筑独立表单的添加房间按钮
  $panel.find(`[data-${ROOT_NS}=add-room-btn-main]`).on('click', () => {
    const $roomsList = $panel.find(`[data-${ROOT_NS}=building-rooms-list]`);
    const $room = $(`
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
        <input type="text" data-${ROOT_NS}="room-name" placeholder="房间名称" style="flex:1;padding:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.3);border-radius:3px;color:#e0f0f0;font-size:12px;outline:none;" />
        <textarea data-${ROOT_NS}="room-desc" placeholder="房间描述" rows="1" style="flex:2;padding:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.3);border-radius:3px;color:#e0f0f0;font-size:12px;outline:none;resize:vertical;"></textarea>
        <button type="button" data-${ROOT_NS}="remove-room-btn" style="padding:4px 8px;background:rgba(255,0,0,0.15);border:1px solid rgba(255,0,0,0.4);border-radius:3px;color:#ff6666;font-size:10px;cursor:pointer;">×</button>
      </div>
    `);
    $room.find(`[data-${ROOT_NS}=remove-room-btn]`).on('click', function() {
      $room.remove();
    });
    $roomsList.append($room);
  });

  // 建筑独立表单的添加活动按钮
  $panel.find(`[data-${ROOT_NS}=add-activity-btn-main]`).on('click', () => {
    const $activitiesList = $panel.find(`[data-${ROOT_NS}=building-activities-list]`);
    const $activity = $(`
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
        <input type="text" data-${ROOT_NS}="activity-name" placeholder="活动名称" style="flex:1;padding:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.3);border-radius:3px;color:#e0f0f0;font-size:12px;outline:none;" />
        <textarea data-${ROOT_NS}="activity-desc" placeholder="活动描述" rows="1" style="flex:2;padding:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.3);border-radius:3px;color:#e0f0f0;font-size:12px;outline:none;resize:vertical;"></textarea>
        <button type="button" data-${ROOT_NS}="remove-activity-btn" style="padding:4px 8px;background:rgba(255,0,0,0.15);border:1px solid rgba(255,0,0,0.4);border-radius:3px;color:#ff6666;font-size:10px;cursor:pointer;">×</button>
      </div>
    `);
    $activity.find(`[data-${ROOT_NS}=remove-activity-btn]`).on('click', function() {
      $activity.remove();
    });
    $activitiesList.append($activity);
  });

  // 添加建筑项
  function addBuildingItem($panel: JQuery) {
    const buildingId = `building-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const $building = $(`
      <div data-${ROOT_NS}="building-item" data-building-id="${buildingId}" style="margin-bottom:16px;padding:12px;background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.2);border-radius:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:12px;color:#00c8ff;font-weight:600">建筑</span>
          <button type="button" data-${ROOT_NS}="remove-building-btn" style="padding:4px 8px;background:rgba(255,0,0,0.15);border:1px solid rgba(255,0,0,0.4);border-radius:3px;color:#ff6666;font-size:11px;cursor:pointer;">删除</button>
        </div>
        <input type="text" data-${ROOT_NS}="building-name" placeholder="建筑名称 *必填" style="width:100%;padding:8px;margin-bottom:8px;background:rgba(0,0,0,0.3);border:1px solid rgba(0,200,255,0.3);border-radius:4px;color:#e0f0f0;font-size:14px;outline:none;" />
        <textarea data-${ROOT_NS}="building-desc" placeholder="建筑描述 *必填" rows="2" style="width:100%;padding:8px;margin-bottom:12px;background:rgba(0,0,0,0.3);border:1px solid rgba(0,200,255,0.3);border-radius:4px;color:#e0f0f0;font-size:13px;outline:none;resize:vertical;"></textarea>

        <!-- 房间列表 -->
        <div style="margin-bottom:12px;padding:10px;background:rgba(0,0,0,0.2);border-radius:4px;">
          <div style="font-size:10px;color:#6b7c8e;margin-bottom:8px;">房间</div>
          <div data-${ROOT_NS}="building-rooms-list"></div>
          <button type="button" data-${ROOT_NS}="add-room-btn" style="padding:4px 10px;background:rgba(255,165,0,0.15);border:1px solid rgba(255,165,0,0.4);border-radius:3px;color:#ffaa00;font-size:11px;cursor:pointer;">+ 添加房间</button>
        </div>

        <!-- 活动列表 -->
        <div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:4px;">
          <div style="font-size:10px;color:#6b7c8e;margin-bottom:8px;">活动</div>
          <div data-${ROOT_NS}="building-activities-list"></div>
          <button type="button" data-${ROOT_NS}="add-activity-btn" style="padding:4px 10px;background:rgba(255,165,0,0.15);border:1px solid rgba(255,165,0,0.4);border-radius:3px;color:#ffaa00;font-size:11px;cursor:pointer;">+ 添加活动</button>
        </div>
      </div>
    `);

    // 删除建筑按钮
    $building.find(`[data-${ROOT_NS}=remove-building-btn]`).on('click', function() {
      $(this).closest(`[data-${ROOT_NS}=building-item]`).remove();
    });

    // 添加房间按钮
    $building.find(`[data-${ROOT_NS}=add-room-btn]`).on('click', () => {
      const $roomsList = $building.find(`[data-${ROOT_NS}=building-rooms-list]`);
      const $room = $(`
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
          <input type="text" data-${ROOT_NS}="room-name" placeholder="房间名称" style="flex:1;padding:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.3);border-radius:3px;color:#e0f0f0;font-size:12px;outline:none;" />
          <textarea data-${ROOT_NS}="room-desc" placeholder="房间描述" rows="1" style="flex:2;padding:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.3);border-radius:3px;color:#e0f0f0;font-size:12px;outline:none;resize:vertical;"></textarea>
          <button type="button" data-${ROOT_NS}="remove-room-btn" style="padding:4px 8px;background:rgba(255,0,0,0.15);border:1px solid rgba(255,0,0,0.4);border-radius:3px;color:#ff6666;font-size:10px;cursor:pointer;">×</button>
        </div>
      `);
      $room.find(`[data-${ROOT_NS}=remove-room-btn]`).on('click', function() {
        $room.remove();
      });
      $roomsList.append($room);
    });

    // 添加活动按钮
    $building.find(`[data-${ROOT_NS}=add-activity-btn]`).on('click', () => {
      const $activitiesList = $building.find(`[data-${ROOT_NS}=building-activities-list]`);
      const $activity = $(`
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
          <input type="text" data-${ROOT_NS}="activity-name" placeholder="活动名称" style="flex:1;padding:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.3);border-radius:3px;color:#e0f0f0;font-size:12px;outline:none;" />
          <textarea data-${ROOT_NS}="activity-desc" placeholder="活动描述" rows="1" style="flex:2;padding:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,165,0,0.3);border-radius:3px;color:#e0f0f0;font-size:12px;outline:none;resize:vertical;"></textarea>
          <button type="button" data-${ROOT_NS}="remove-activity-btn" style="padding:4px 8px;background:rgba(255,0,0,0.15);border:1px solid rgba(255,0,0,0.4);border-radius:3px;color:#ff6666;font-size:10px;cursor:pointer;">×</button>
        </div>
      `);
      $activity.find(`[data-${ROOT_NS}=remove-activity-btn]`).on('click', function() {
        $activity.remove();
      });
      $activitiesList.append($activity);
    });

    $panel.find(`[data-${ROOT_NS}=region-buildings-list]`).append($building);
  }

  // 用户区(标题栏) - 委托到 header-user-area, 因为内容会被 renderHeaderUser 重写
  const $userArea = $panel.find(`[data-${ROOT_NS}=header-user-area]`);

  $userArea.on('click', `[data-${ROOT_NS}=header-login]`, () => {
    console.info('[规则工坊] 点击标题栏登录');
    startDiscordLogin();
  });

  $userArea.on('click', `[data-${ROOT_NS}=user-menu-toggle]`, (e) => {
    e.stopPropagation();
    console.info('[规则工坊] 点击用户菜单切换');
    $userArea.find(`[data-${ROOT_NS}=user-menu]`).toggle();
  });

  $userArea.on('click', `[data-${ROOT_NS}=menu-my]`, () => {
    console.info('[规则工坊] 点击菜单-我的作品');
    $userArea.find(`[data-${ROOT_NS}=user-menu]`).hide();
    $panel.find(`[data-${ROOT_NS}=explore-view]`).hide();
    $panel.find(`[data-${ROOT_NS}=workspace-view]`).show();
    $panel.find(`.${ROOT_NS}-sidebar-item`).removeClass('active');
    switchWsTab('my');
  });

  $userArea.on('click', `[data-${ROOT_NS}=menu-refresh]`, () => {
    $userArea.find(`[data-${ROOT_NS}=user-menu]`).hide();
    void refreshMe();
  });

  $userArea.on('click', `[data-${ROOT_NS}=menu-logout]`, () => {
    $userArea.find(`[data-${ROOT_NS}=user-menu]`).hide();
    const nv = loadVars();
    nv.access_token = undefined;
    saveVars(nv);
    state.user = null;
    renderHeaderUser();
    $panel.find(`.${ROOT_NS}-type-select`).removeClass('primary');
    $panel.find(`[data-${ROOT_NS}=upload-form]`).css('opacity', '0.6');
    rwToast.info('已退出');
  });

  // 点击外部关闭用户菜单 (绑在 panel 上)
  $panel.on('click', (e) => {
    const $target = $(e.target as HTMLElement);
    if (!$target.closest(`[data-${ROOT_NS}=user-menu-container]`).length) {
      $userArea.find(`[data-${ROOT_NS}=user-menu]`).hide();
    }
  });

  // 工作站内的登录/登出按钮
  $panel.find(`[data-${ROOT_NS}=login]`).on('click', () => startDiscordLogin());
  $panel.find(`[data-${ROOT_NS}=logout]`).on('click', () => {
    const nv = loadVars();
    nv.access_token = undefined;
    saveVars(nv);
    state.user = null;
    renderHeaderUser();
    $panel.find(`.${ROOT_NS}-type-select`).removeClass('primary');
    $panel.find(`[data-${ROOT_NS}=upload-form]`).css('opacity', '0.6');
    rwToast.info('已退出');
  });
  $panel.find(`[data-${ROOT_NS}=refresh-me]`).on('click', () => void refreshMe());

  // 管理员灌入官方示例
  $panel.find(`[data-${ROOT_NS}=admin-seed]`).on('click', async () => {
    console.info('[规则工坊] 点击管理员灌入示例');
    const v = loadVars();
    if (!v.access_token) {
      rwToast.warning('请先登录');
      return;
    }
    try {
      const res = await apiJson<{ results?: unknown[] }>('/api/admin/seed', { method: 'POST', token: v.access_token });
      rwToast.success(`成功灌入 ${res.results?.length || 0} 条官方示例`);
      void loadList();
    } catch (e) {
      rwToast.error(e instanceof Error ? e.message : '灌入失败');
    }
  });

  // 管理员审核内容按钮（打开审核弹窗）
  $panel.find(`[data-${ROOT_NS}=admin-review]`).on('click', () => {
    console.info('[规则工坊] 点击管理员审核内容');
    openReviewModal();
  });

  // 管理员管理后台按钮（打开管理后台弹窗）
  $panel.find(`[data-${ROOT_NS}=admin-dashboard]`).on('click', () => {
    console.info('[规则工坊] 点击管理员管理后台');
    openDashboardModal();
  });

  // 自动审核模式开关（与后端 /api/admin/settings/auto-approve 一致）
  $panel.find(`[data-${ROOT_NS}=admin-auto-approve]`).on('change', async function(this: HTMLInputElement) {
    const enabled = this.checked;
    console.info('[规则工坊] 自动审核模式:', enabled ? '开启' : '关闭');
    const v = loadVars();
    if (!v.access_token) {
      rwToast.warning('请先登录');
      this.checked = !enabled;
      return;
    }
    try {
      await apiJson('/api/admin/settings/auto-approve', {
        method: 'POST',
        token: v.access_token,
        body: { enabled },
      });
      rwToast.success(enabled ? '已开启自动审核模式' : '已关闭自动审核模式');
    } catch (e) {
      rwToast.error(e instanceof Error ? e.message : '设置失败');
      this.checked = !enabled;
    }
  });

  // 搜索
  $panel.find(`[data-${ROOT_NS}=search-run]`).on('click', () => {
    console.info('[规则工坊] 点击搜索');
    void runSearch();
  });
  $panel.find(`[data-${ROOT_NS}=search-q]`).on('keypress', (e) => {
    if (e.which === 13) void runSearch();
  });

  // 同步云端按钮
  $panel.find(`[data-${ROOT_NS}=sync-cloud]`).on('click', () => {
    console.info('[规则工坊] 点击同步云端');
    void syncCloudContent();
  });

  // 动态生成的元素 - 用面板内委托
  // 分页
  $panel.on('click', `[data-${ROOT_NS}=page-prev]`, () => {
    if (state.list.page > 1) {
      state.list.page--;
      void loadList($panel.data('current-category') as string);
    }
  });
  $panel.on('click', `[data-${ROOT_NS}=page-next]`, () => {
    if (state.list.page < state.list.totalPages) {
      state.list.page++;
      void loadList($panel.data('current-category') as string);
    }
  });

  // 我的作品：删除本地副本（不影响云端）
  $panel.on('click', `[data-${ROOT_NS}=my-delete-local]`, function (this: HTMLElement, e: JQuery.Event) {
    e.preventDefault();
    e.stopPropagation();
    const id = $(this).data('id') as string;
    if (!contentExistsLocally(id)) {
      rwToast.warning('本地已无此作品');
      void loadMyContent();
      return;
    }
    if (!confirm('确定删除本设备上的该作品副本？若已上传云端，云端记录不会被删除。')) {
      return;
    }
    deleteLocalContent(id);
    rwToast.success('已删除本地副本');
    void loadMyContent();
  });

  // 卡片点击 (动态生成)
  $panel.on('click', `.${ROOT_NS}-card`, function (this: HTMLElement) {
    const id = $(this).data('id') as string;
    const type = $(this).data('type') as WorkshopContentType;
    console.info('[规则工坊] 点击卡片:', id);
    void openDetail(id, type);
  });

  // 空状态的立即上传按钮 (动态生成)
  $panel.on('click', `[data-${ROOT_NS}=empty-upload]`, function (this: HTMLElement) {
    const type = $(this).data('type') as string;
    $panel.find(`[data-${ROOT_NS}=explore-view]`).hide();
    $panel.find(`[data-${ROOT_NS}=workspace-view]`).show();
    $panel.find(`.${ROOT_NS}-sidebar-item`).removeClass('active');
    switchWsTab('upload');
    if (type && type !== '__all__') {
      const $btn = $panel.find(`.${ROOT_NS}-type-select[data-type="${type}"]`);
      if ($btn.length) {
        $btn.trigger('click');
      }
    }
  });

  // 上传提交
  $panel.find(`[data-${ROOT_NS}=upload]`).on('click', async () => {
    console.info('[规则工坊] 点击提交上传');
    const v = loadVars();
    if (!v.access_token) {
      rwToast.warning('请先登录');
      return;
    }
    const type = $panel.data('upload-type') as WorkshopContentType;
    if (!type) {
      rwToast.warning('请先选择类别');
      return;
    }
    let name = String($panel.find(`[data-${ROOT_NS}=up-name]`).val() ?? '').trim();
    let description = String($panel.find(`[data-${ROOT_NS}=up-desc]`).val() ?? '').trim();
    const rawData = String($panel.find(`[data-${ROOT_NS}=up-data]`).val() ?? '').trim();

    // 非区域类型需要验证通用字段
    if (type !== 'region') {
      if (!name) {
        rwToast.warning('请填写标题');
        return;
      }
    }
    // 根据类型自动生成或解析数据
    let data: unknown;
    if (type === 'world-rule') {
      // 世界规则：只需要名称和效果描述
      data = {
        名称: name,
        效果描述: description,
        状态: '生效中',
        细分规则: {},
        适用对象: '全局',
        标记: '世界级'
      };
    } else if (type === 'regional-rule') {
      // 区域规则：只需要规则名和描述
      data = {
        规则名: name,
        描述: description
      };
    } else if (type === 'personal-rule') {
      // 个人规则：只需要名称和效果描述
      data = {
        名称: name,
        效果描述: description,
        状态: '生效中',
        细分规则: {},
        适用对象: '', // 使用时从下拉框选择
        标记: '个人级'
      };
    } else if (type === 'region') {
      // 区域类型：收集智能表单数据
      const regionName = String($panel.find(`[data-${ROOT_NS}=region-name]`).val() ?? '').trim();
      const regionDesc = String($panel.find(`[data-${ROOT_NS}=region-desc]`).val() ?? '').trim();

      if (!regionName) {
        rwToast.warning('请填写区域名称');
        return;
      }
      if (!regionDesc) {
        rwToast.warning('请填写区域描述');
        return;
      }

      // 区域类型使用区域名称作为项目代号
      name = regionName;
      description = regionDesc;

      // 收集建筑数据
      const buildings: Record<string, unknown> = {};
      $panel.find(`[data-${ROOT_NS}=building-item]`).each(function() {
        const $building = $(this);
        const buildingName = String($building.find(`[data-${ROOT_NS}=building-name]`).val() ?? '').trim();
        const buildingDesc = String($building.find(`[data-${ROOT_NS}=building-desc]`).val() ?? '').trim();

        if (!buildingName) {
          rwToast.warning('请填写所有建筑的名称');
          return false; // 中断循环
        }
        if (!buildingDesc) {
          rwToast.warning('请填写所有建筑的描述');
          return false;
        }

        // 收集房间
        const rooms: Record<string, { 描述: string }> = {};
        $building.find(`[data-${ROOT_NS}=room-name]`).each(function() {
          const $roomRow = $(this).closest('div');
          const roomName = String($(this).val() ?? '').trim();
          const roomDesc = String($roomRow.find(`[data-${ROOT_NS}=room-desc]`).val() ?? '').trim();
          if (roomName) {
            rooms[roomName] = { 描述: roomDesc };
          }
        });

        // 收集活动
        const activities: Record<string, { 描述: string }> = {};
        $building.find(`[data-${ROOT_NS}=activity-name]`).each(function() {
          const $activityRow = $(this).closest('div');
          const activityName = String($(this).val() ?? '').trim();
          const activityDesc = String($activityRow.find(`[data-${ROOT_NS}=activity-desc]`).val() ?? '').trim();
          if (activityName) {
            activities[activityName] = { 描述: activityDesc };
          }
        });

        const buildingId = `BLD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        buildings[buildingId] = {
          名称: buildingName,
          描述: buildingDesc,
          所属区域ID: '',
          内部房间布局: rooms,
          当前活动: activities,
          当前角色: {}
        };
      });

      // 检查是否有建筑验证失败的标志
      if ($panel.find(`[data-${ROOT_NS}=building-item]`).length > 0 && Object.keys(buildings).length === 0) {
        return; // 有建筑但没有收集到数据，说明验证失败
      }

      data = {
        区域数据: {
          [regionName]: {
            名称: regionName,
            描述: regionDesc,
            包含建筑: Object.fromEntries(Object.keys(buildings).map(id => [id, true]))
          }
        },
        建筑数据: buildings
      };
    } else if (type === 'building') {
      // 建筑类型：收集智能表单数据
      // 收集房间
      const rooms: Record<string, { 描述: string }> = {};
      $panel.find(`[data-${ROOT_NS}=room-name]`).each(function() {
        const $roomRow = $(this).closest('div');
        const roomName = String($(this).val() ?? '').trim();
        const roomDesc = String($roomRow.find(`[data-${ROOT_NS}=room-desc]`).val() ?? '').trim();
        if (roomName) {
          rooms[roomName] = { 描述: roomDesc };
        }
      });

      // 收集活动
      const activities: Record<string, { 描述: string }> = {};
      $panel.find(`[data-${ROOT_NS}=activity-name]`).each(function() {
        const $activityRow = $(this).closest('div');
        const activityName = String($(this).val() ?? '').trim();
        const activityDesc = String($activityRow.find(`[data-${ROOT_NS}=activity-desc]`).val() ?? '').trim();
        if (activityName) {
          activities[activityName] = { 描述: activityDesc };
        }
      });

      data = {
        名称: name,
        描述: description,
        所属区域ID: '', // 使用时从下拉框选择
        内部房间布局: rooms,
        当前活动: activities,
        当前角色: {}
      };
    } else {
      // 角色类型：需要手动输入完整数据
      if (!rawData) {
        rwToast.warning('请填写数据载荷');
        return;
      }
      try {
        data = JSON.parse(rawData) as unknown;
      } catch {
        data = { text: rawData };
      }
    }
    // 生成本地ID
    const localId = `local-${type}-${Date.now()}`;

    // 保存到本地存储（确保本地始终可用）
    const localContent: LocalContent = {
      id: localId,
      type,
      name,
      description,
      author: state.user?.username || '本地用户',
      data,
      tags: [],
      status: 'approved', // 本地内容直接通过
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likes: 0,
      downloads: 0,
    };
    saveLocalContent(localContent);
    rwToast.success('已保存到本地');

    // 尝试同步到后端（如果失败不影响本地使用）
    try {
      await apiJson('/api/content/create', {
        method: 'POST',
        token: v.access_token,
        body: { type, name, description, data, tags: [] },
      });
      rwToast.success('已同步到云端');
    } catch (e) {
      console.warn('[规则工坊] 同步到后端失败:', e);
      rwToast.info('仅保存到本地，云端同步失败');
    }

    // 清空表单
    $panel.find(`[data-${ROOT_NS}=up-name]`).val('');
    $panel.find(`[data-${ROOT_NS}=up-desc]`).val('');
    $panel.find(`[data-${ROOT_NS}=up-data]`).val('');
    resetRegionForm($panel); // 清空区域表单

    // 刷新我的工作台列表
    void loadMyContent();
  });

  console.info('[规则工坊] 事件处理器绑定完成 ✓ (面板上有', $panel.find('button').length, '个按钮)');
}

// 示例内容数据：likes/downloads 仅作结构占位，列表展示统一用 0；真实数据来自 API 或 KV
const DEMO_CONTENTS: Record<WorkshopContentType, { name: string; description: string; data: unknown; author: string; downloads: number; likes: number }> = {
  'world-rule': {
    name: '下克上',
    description: '上级会无条件的听从下级的指令',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      名称: '下克上',
      效果描述: '上级会无条件的听从下级的指令',
      状态: '生效中',
      细分规则: {},
      适用对象: '全局',
      标记: '世界级'
    }
  },
  'regional-rule': {
    name: '全裸',
    description: '所有人都全裸',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    // 区域规则数据只包含规则名和描述，区域名在使用时从变量管理器获取
    // 最终 path: /区域规则/{当前区域名}/细分规则/{规则名}
    data: {
      规则名: '全裸',
      描述: '所有人都全裸'
    }
  },
  'personal-rule': {
    name: '发情',
    description: '一直处于发情状态',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      名称: '发情',
      效果描述: '一直处于发情状态',
      状态: '生效中',
      细分规则: {},
      适用对象: '',
      标记: '个人级'
    }
  },
  'region': {
    name: '圣华女子学院',
    description: '坐落于近郊的顶级私立贵族女校，环境优美，纪律严明',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      名称: '圣华女子学院',
      描述: '坐落于近郊的顶级私立贵族女校，环境优美，纪律严明',
      包含建筑: {
        '教学楼': true
      }
    }
  },
  'building': {
    name: '教学楼',
    description: '学院的主体建筑，红砖风格，内部设施现代化',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      名称: '教学楼',
      描述: '学院的主体建筑，红砖风格，内部设施现代化',
      所属区域: '圣华女子学院',
      内部房间布局: {
        '1-A教室': { 描述: '白梦梦所在的班级教室，采光良好' },
        '走廊': { 描述: '宽敞整洁的走廊' },
        '教师办公室': { 描述: '老师们办公的地方' }
      }
    }
  },
  'character': {
    name: '白梦梦',
    description: '圣华女子学院高中部的学生。外表如小兔子般软萌可爱',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      姓名: '白梦梦',
      角色简介: '圣华女子学院高中部的学生。外表如小兔子般软萌可爱，留着整齐的齐刘海',
      当前位置: {
        区域: '圣华女子学院',
        建筑: '教学楼',
        房间: '1-A教室'
      }
    }
  }
};

/** 「我的作品」列表末尾追加的官方示例元数据（与 openDetail 的 demo-* id 一致） */
function buildOfficialDemoMetas(): ContentMetadata[] {
  return ALL_WORKSHOP_TYPES.map(type => {
    const d = DEMO_CONTENTS[type];
    return {
      id: `demo-${type}`,
      type,
      name: d.name,
      description: d.description,
      author: d.author,
      authorId: 'demo',
      authorAvatar: null,
      tags: [] as string[],
      status: 'approved',
      createdAt: '',
      updatedAt: '',
      downloads: 0,
      likes: 0,
    };
  });
}

// (Seed data is now injected via /api/admin/seed endpoint on backend)

function init(): void {
  console.info('[规则工坊] 初始化开始 v1.1.3 (直接绑定模式)');

  // 清理所有命名空间事件 (含旧版本可能残留的)
  $(document).off('.thrw');
  $(window).off('.thrw');

  injectStyles();

  const mountDoc = getMountDocument();

  // 移除可能残留的旧根节点/面板/弹窗（必须在父页面 document 上选）
  $(`#${SCRIPT_ROOT_ID}, #${RW_MSG_OVERLAY_ID}, #${SCRIPT_TOGGLE_ID}, #${SCRIPT_PANEL_ID}, .${ROOT_NS}-modal-bg`, mountDoc).remove();

  // 在父页面 html 下挂专用根层（与 body 同级），使 position:fixed 相对视口；节点必须用 mountDoc.createElement 归属正确文档
  const rootEl = mountDoc.createElement('div');
  rootEl.id = SCRIPT_ROOT_ID;
  mountDoc.documentElement.appendChild(rootEl);
  $(buildPanelHtml().trim()).appendTo(rootEl);

  if (!getPanel().length) {
    console.error('[规则工坊] 面板 DOM 挂载失败（getPanel 为空），请检查 buildPanelHtml / 控制台报错');
    return;
  }

  const v = loadVars();

  // 初始化侧边栏分类为"推荐"
  $(`.${ROOT_NS}-sidebar-item[data-category="__recommended__"]`).addClass('active');
  getPanel().data('current-category', '__recommended__');

  renderHeaderUser();
  bindPanelEvents();
  bindDetailActions();
  bindRwMessageOverlay();

  // 尝试刷新用户状态，然后加载推荐列表
  void (async () => {
    if (v.access_token) {
      try {
        await refreshMe();
      } catch {
        // ignore refresh error
      }
    }
    void loadList('__recommended__');
  })();

  replaceScriptButtons([{ name: '规则工坊', visible: true }]);
  eventOn(getButtonEvent('规则工坊'), () => {
    toggleWorkshopPanel();
  });

  bindToggleViewportRecalc();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncToggleViewportPosition());
  });

  console.info('[规则工坊] 初始化完成 ✓');
}

$(() => {
  errorCatched(init)();
});

$(window).on('pagehide', () => {
  teardownToggleViewportSync?.();
  teardownToggleViewportSync = undefined;
  closeRwMessage();
  const mountDoc = getMountDocument();
  $(`#${SCRIPT_ROOT_ID}, #${RW_MSG_OVERLAY_ID}, #${SCRIPT_TOGGLE_ID}, #${SCRIPT_PANEL_ID}, .${ROOT_NS}-modal-bg, #${ROOT_NS}-style`, mountDoc).remove();
});
