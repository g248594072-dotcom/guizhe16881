/**
 * 小手机壳脚本：在酒馆页面挂载遮罩 + iframe，加载独立部署的 React 手机 UI。
 * 主界面或其它前端通过 window.parent.TavernPhone.open/toggle/close 调用。
 *
 * 脚本变量（type: script）可配置：
 * - phone_ui_url / tavern_phone_ui_url: 手机界面 index.html 的完整 URL（必填才能显示内容）
 * - phone_wechat_field_map（可选）: 微信联动时从「角色变量」「最新楼层变量」读取字段的 lodash 风格路径，例如：
 *   `{ "personality": "性格", "thought": "心理想法", "name": "微信名" }`
 *   name 若留空或路径无值，则使用当前角色卡名称；thought/personality 优先角色变量，再尝试最新消息变量。
 * - phone_wechat_contacts（可选）: 微信会话列表，数组项支持 `{ id, displayName, name, avatarUrl, personality, thought }` 或字符串（作 displayName）。
 * - phone_wechat_contacts_path（可选）: 从变量中取「会话列表」的路径（点路径）。支持：
 *   - 数组：与 phone_wechat_contacts 同类项；
 *   - 对象字典：键为角色 ID（如 CHR-001），值为角色档案对象（含 姓名、性格、当前内心想法 等），与「角色档案」结构一致。
 *   未配置时，会自动尝试常见路径（含「stat_data.角色档案」等，与规则系统 stat_data 对齐）。
 *   依次尝试 聊天变量 → 最新消息楼层 → 角色变量 → 全局变量。
 */
const VERSION = '1.0.0';
const PHONE_W = 375;
const PHONE_H = 812;
const Z_OVERLAY = 10050;
const Z_PHONE = 10051;

/** 与 src/手机 内 tavernPhoneBridge.ts 保持一致 */
const MSG = {
  REQUEST_CLOSE: 'tavern-phone:request-close',
  REQUEST_CONTEXT: 'tavern-phone:request-context',
  REQUEST_ROLE_ARCHIVE: 'tavern-phone:request-role-archive',
  CONTEXT: 'tavern-phone:context',
  ROLE_ARCHIVE: 'tavern-phone:role-archive',
  OPENED: 'tavern-phone:opened',
  CLOSED: 'tavern-phone:closed',
  READY: 'tavern-phone:ready',
} as const;

function getByPath(obj: unknown, path: string): unknown {
  if (!path?.trim() || obj == null) {
    return undefined;
  }
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function pickWeChatField(
  map: Record<string, string>,
  key: 'personality' | 'thought' | 'name',
  charVars: Record<string, unknown>,
  msgVars: Record<string, unknown>,
): string {
  const path = map[key];
  if (!path?.trim()) {
    return '';
  }
  const fromChar = getByPath(charVars, path);
  if (fromChar != null && String(fromChar).trim() !== '') {
    return String(fromChar);
  }
  const fromMsg = getByPath(msgVars, path);
  if (fromMsg != null && String(fromMsg).trim() !== '') {
    return String(fromMsg);
  }
  return '';
}

type WeChatContactOut = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  personality?: string;
  thought?: string;
};

/** 将「性格」等字段格式化为字符串（支持 string 或 string[]） */
function formatTraitField(val: unknown): string | undefined {
  if (typeof val === 'string' && val.trim()) {
    return val.trim();
  }
  if (Array.isArray(val) && val.length > 0) {
    const s = val.map(x => String(x)).filter(t => t.trim());
    return s.length ? s.join('、') : undefined;
  }
  return undefined;
}

function pickInnerThought(o: Record<string, unknown>): string | undefined {
  const t = o.当前内心想法 ?? o.心理想法 ?? o.thought;
  if (typeof t === 'string' && t.trim()) {
    return t.trim();
  }
  return undefined;
}

/**
 * 角色档案条目：键为 CHR-001 等，值为含 姓名、性格、当前内心想法、描写 等字段的对象
 */
function normalizeRoleArchiveEntry(roleId: string, raw: unknown): WeChatContactOut | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const nameRaw = o.姓名 ?? o.displayName ?? o.name ?? o.昵称;
  if (typeof nameRaw !== 'string' || !nameRaw.trim()) {
    return null;
  }
  const id = roleId.trim() || 'unknown';
  let avatarUrl: string | undefined;
  if (typeof o.avatarUrl === 'string' && o.avatarUrl.trim()) {
    avatarUrl = o.avatarUrl.trim();
  } else if (typeof o.头像 === 'string' && o.头像.trim()) {
    avatarUrl = o.头像.trim();
  }
  const trait = formatTraitField(o.性格);
  const desc = typeof o.描写 === 'string' && o.描写.trim() ? o.描写.trim() : '';
  let personality: string | undefined;
  if (trait && desc) {
    personality = `${trait}；${desc}`;
  } else {
    personality = trait ?? (desc || undefined);
  }
  const thought = pickInnerThought(o);
  return {
    id,
    displayName: nameRaw.trim(),
    avatarUrl,
    personality,
    thought,
  };
}

function normalizeWeChatContact(raw: unknown, index: number): WeChatContactOut | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) {
      return null;
    }
    return { id: `idx-${index}`, displayName: s };
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const dn = o.displayName ?? o.name ?? o.名称 ?? o.昵称 ?? o.姓名;
    if (typeof dn !== 'string' || !dn.trim()) {
      return null;
    }
    const idRaw = o.id ?? o.ID;
    const id =
      typeof idRaw === 'string' && idRaw.trim()
        ? idRaw.trim()
        : typeof idRaw === 'number'
          ? String(idRaw)
          : `idx-${index}`;
    let avatarUrl: string | undefined;
    if (typeof o.avatarUrl === 'string' && o.avatarUrl.trim()) {
      avatarUrl = o.avatarUrl.trim();
    } else if (typeof o.avatar === 'string' && o.avatar.trim()) {
      avatarUrl = o.avatar.trim();
    }
    const trait = formatTraitField(o.性格);
    const desc = typeof o.描写 === 'string' && o.描写.trim() ? o.描写.trim() : '';
    let personality: string | undefined;
    if (trait && desc) {
      personality = `${trait}；${desc}`;
    } else {
      personality = trait ?? (desc || undefined);
    }
    if (!personality && typeof o.personality === 'string' && o.personality.trim()) {
      personality = o.personality.trim();
    }
    const thought = pickInnerThought(o);
    return { id, displayName: dn.trim(), avatarUrl, personality, thought };
  }
  return null;
}

/** 从变量节点解析联系人：数组 或 角色 ID → 档案 的对象字典 */
function contactsFromVariableValue(val: unknown): WeChatContactOut[] {
  if (val == null) {
    return [];
  }
  if (Array.isArray(val)) {
    return val.map(normalizeWeChatContact).filter((x): x is WeChatContactOut => x != null);
  }
  if (typeof val === 'object') {
    const out: WeChatContactOut[] = [];
    for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        const fromArchive = normalizeRoleArchiveEntry(key, v);
        if (fromArchive) {
          out.push(fromArchive);
        } else {
          const fb = normalizeWeChatContact({ ...(v as Record<string, unknown>), id: key }, out.length);
          if (fb) {
            out.push(fb);
          }
        }
      }
    }
    return out;
  }
  return [];
}

function collectVariablesSources(): Record<string, unknown>[] {
  const trySources: Record<string, unknown>[] = [];
  try {
    trySources.push(getVariables({ type: 'chat' }) as Record<string, unknown>);
  } catch {
    /* */
  }
  try {
    trySources.push(getVariables({ type: 'message', message_id: 'latest' }) as Record<string, unknown>);
  } catch {
    /* */
  }
  try {
    trySources.push(getVariables({ type: 'character' }) as Record<string, unknown>);
  } catch {
    /* */
  }
  try {
    trySources.push(getVariables({ type: 'global' }) as Record<string, unknown>);
  } catch {
    /* */
  }
  return trySources;
}

/**
 * 常见「角色档案」在变量中的点路径（优先 stat_data，与规则系统 JSON 结构一致）
 */
const COMMON_ROLE_ARCHIVE_PATHS = [
  'stat_data.角色档案',
  '角色档案',
  '规则.角色档案',
  '世界.角色档案',
  '数据.角色档案',
  '游戏.角色档案',
];

function buildWeChatContacts(baseDisplayName: string): WeChatContactOut[] {
  const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
  const explicit = scriptVars.phone_wechat_contacts;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map(normalizeWeChatContact).filter((x): x is WeChatContactOut => x != null);
  }
  const pathCustom = typeof scriptVars.phone_wechat_contacts_path === 'string' ? scriptVars.phone_wechat_contacts_path.trim() : '';
  const pathsToTry = pathCustom ? [pathCustom] : [...COMMON_ROLE_ARCHIVE_PATHS];
  const trySources = collectVariablesSources();
  for (const path of pathsToTry) {
    for (const src of trySources) {
      const node = getByPath(src, path);
      const list = contactsFromVariableValue(node);
      if (list.length > 0) {
        return list;
      }
    }
  }
  return [{ id: 'default', displayName: baseDisplayName }];
}

/** 合并多路径、多变量源，供「+ 手动添加」拉取全部可选角色（不返回单条 fallback） */
function buildRoleArchiveCandidates(): WeChatContactOut[] {
  const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
  const explicit = scriptVars.phone_wechat_contacts;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map(normalizeWeChatContact).filter((x): x is WeChatContactOut => x != null);
  }
  const pathCustom = typeof scriptVars.phone_wechat_contacts_path === 'string' ? scriptVars.phone_wechat_contacts_path.trim() : '';
  const pathsOrdered: string[] = [];
  if (pathCustom) {
    pathsOrdered.push(pathCustom);
  }
  for (const p of COMMON_ROLE_ARCHIVE_PATHS) {
    if (p && !pathsOrdered.includes(p)) {
      pathsOrdered.push(p);
    }
  }
  const merged = new Map<string, WeChatContactOut>();
  const trySources = collectVariablesSources();
  for (const path of pathsOrdered) {
    if (!path) {
      continue;
    }
    for (const src of trySources) {
      const node = getByPath(src, path);
      const list = contactsFromVariableValue(node);
      for (const c of list) {
        merged.set(c.id, c);
      }
    }
  }
  return Array.from(merged.values());
}

function buildWeChatContext(): {
  characterName: string | null;
  displayName: string;
  personality: string;
  thought: string;
  contacts: WeChatContactOut[];
} {
  const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
  const defaultMap: Record<string, string> = {
    personality: '性格',
    thought: '心理想法',
    name: '',
  };
  const custom =
    typeof scriptVars.phone_wechat_field_map === 'object' && scriptVars.phone_wechat_field_map !== null
      ? (scriptVars.phone_wechat_field_map as Record<string, string>)
      : {};
  const map: Record<string, string> = { ...defaultMap, ...custom };
  let charVars: Record<string, unknown> = {};
  let msgVars: Record<string, unknown> = {};
  try {
    charVars = getVariables({ type: 'character' }) as Record<string, unknown>;
  } catch {
    /* 无角色卡 */
  }
  try {
    msgVars = getVariables({ type: 'message', message_id: 'latest' }) as Record<string, unknown>;
  } catch {
    /* 无楼层 */
  }
  const nameField = pickWeChatField(map, 'name', charVars, msgVars);
  const cardName = getCurrentCharacterName();
  const displayName = (nameField && nameField.trim()) || cardName || '未命名角色';
  const contacts = buildWeChatContacts(displayName);
  return {
    characterName: cardName,
    displayName,
    personality: pickWeChatField(map, 'personality', charVars, msgVars),
    thought: pickWeChatField(map, 'thought', charVars, msgVars),
    contacts,
  };
}

function getPhoneUiUrl(): string {
  try {
    const raw = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    const u = raw.phone_ui_url ?? raw.tavern_phone_ui_url;
    if (typeof u === 'string' && u.trim()) {
      return u.trim();
    }
  } catch {
    /* 忽略 */
  }
  return '';
}

function mountTavernPhoneApi(api: TavernPhoneApi) {
  window.parent.TavernPhone = api;
}

function unmountTavernPhoneApi() {
  try {
    delete window.parent.TavernPhone;
  } catch {
    /* 忽略 */
  }
}

$(() => {
  let phoneUiUrl = getPhoneUiUrl();

  let $overlay: JQuery | null = null;
  let $phoneRoot: JQuery | null = null;
  let $iframe: JQuery<HTMLIFrameElement> | null = null;
  let isOpen = false;
  let messageHandler: ((e: MessageEvent) => void) | null = null;
  let resizeHandler: (() => void) | null = null;
  /** 与 buildDom 里绑定 resize 的窗口一致，便于 removeDom 卸载 */
  let resizeTargetWindow: Window | null = null;
  let visualViewportRef: VisualViewport | null = null;

  /**
   * 遮罩与手机挂在「能看见整页」的窗口 document 上。
   * 脚本常在嵌套 iframe 里：仅用 parent 可能仍是小 iframe；优先 top（同源），再 parent，再自身。
   */
  function getShellDocument(): Document {
    try {
      const topWin = window.top;
      if (topWin && topWin !== window && topWin.document?.body) {
        return topWin.document;
      }
    } catch {
      /* 跨域 top */
    }
    try {
      if (window.parent !== window && window.parent.document?.body) {
        return window.parent.document;
      }
    } catch {
      /* 跨域 parent */
    }
    return document;
  }

  function getShellWindow(): Window {
    return getShellDocument().defaultView ?? window;
  }

  function createShellDiv(doc: Document): JQuery<HTMLDivElement> {
    const el = doc.createElement('div');
    el.setAttribute('script_id', getScriptId());
    return $(el) as JQuery<HTMLDivElement>;
  }

  function getIframeEl(): HTMLIFrameElement | null {
    return $iframe?.[0] ?? null;
  }

  function applyLayout() {
    if (!$phoneRoot?.length) {
      return;
    }
    const win = getShellWindow();
    const vv = win.visualViewport;
    const vw = vv?.width ?? win.innerWidth;
    const vh = vv?.height ?? win.innerHeight;
    const marginX = 32;
    const marginY = 48;
    const scale = Math.min((vw - marginX) / PHONE_W, (vh - marginY) / PHONE_H, 1);
    const inner = $phoneRoot.find(`[data-tavern-phone="inner"]`);
    inner.css({
      width: `${PHONE_W}px`,
      height: `${PHONE_H}px`,
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
    });
    $iframe?.css({
      width: `${PHONE_W}px`,
      height: `${PHONE_H}px`,
    });
    const iw = getIframeEl()?.contentWindow;
    if (iw) {
      try {
        iw.dispatchEvent(new Event('resize'));
      } catch {
        /* ignore */
      }
    }
  }

  function postToPhone(data: { type: string }) {
    const win = getIframeEl()?.contentWindow;
    if (win) {
      win.postMessage(data, '*');
    }
  }

  function removeDom() {
    $overlay?.remove();
    $overlay = null;
    $phoneRoot = null;
    $iframe = null;
    if (resizeHandler) {
      if (visualViewportRef) {
        visualViewportRef.removeEventListener('resize', resizeHandler);
        visualViewportRef.removeEventListener('scroll', resizeHandler);
        visualViewportRef = null;
      }
      if (resizeTargetWindow) {
        $(resizeTargetWindow).off('resize', resizeHandler);
      }
      resizeHandler = null;
      resizeTargetWindow = null;
    }
  }

  function buildDom() {
    if ($phoneRoot?.length) {
      return;
    }

    const parentDoc = getShellDocument();
    const $mount = $(parentDoc.body);

    $overlay = createShellDiv(parentDoc)
      .attr('data-tavern-phone', 'overlay')
      .css({
        position: 'fixed',
        inset: '0',
        zIndex: Z_OVERLAY,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'none',
        pointerEvents: 'auto',
      })
      .appendTo($mount);

    $phoneRoot = createShellDiv(parentDoc)
      .attr('data-tavern-phone', 'root')
      .css({
        position: 'fixed',
        inset: '0',
        boxSizing: 'border-box',
        display: 'none',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_PHONE,
        pointerEvents: 'none',
        margin: 0,
        padding: 0,
      })
      .appendTo($mount);

    const $inner = createShellDiv(parentDoc)
      .attr('data-tavern-phone', 'inner')
      .css({
        position: 'relative',
        flexShrink: 0,
        borderRadius: '40px',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.32)',
        background: 'transparent',
        pointerEvents: 'auto',
      });

    const iframeEl = parentDoc.createElement('iframe');
    iframeEl.title = 'Tavern Phone';
    iframeEl.setAttribute('frameborder', '0');
    iframeEl.setAttribute('allow', 'clipboard-read; clipboard-write');
    $iframe = $(iframeEl).css({
      display: 'block',
      width: PHONE_W + 'px',
      height: PHONE_H + 'px',
      border: 'none',
      background: '#000',
    }) as JQuery<HTMLIFrameElement>;

    $inner.append($iframe);

    $phoneRoot.append($inner);

    $overlay.on('click', () => {
      close();
    });

    $phoneRoot.on('click', e => {
      e.stopPropagation();
    });

    $iframe.on('load', () => {
      postToPhone({ type: MSG.OPENED });
    });

    const layoutWin = getShellWindow();
    resizeTargetWindow = layoutWin;
    resizeHandler = () => {
      if (isOpen) {
        applyLayout();
      }
    };
    $(layoutWin).on('resize', resizeHandler);
    const vv = layoutWin.visualViewport;
    if (vv) {
      visualViewportRef = vv;
      vv.addEventListener('resize', resizeHandler);
      vv.addEventListener('scroll', resizeHandler);
    }

    applyLayout();
  }

  function setIframeSrc() {
    phoneUiUrl = getPhoneUiUrl();
    const el = getIframeEl();
    if (!el || !phoneUiUrl) {
      return;
    }
    if (el.src !== phoneUiUrl) {
      el.src = phoneUiUrl;
    }
  }

  messageHandler = (e: MessageEvent) => {
    if (e.source !== getIframeEl()?.contentWindow) {
      return;
    }
    const t = e.data?.type;
    if (t === MSG.REQUEST_CONTEXT) {
      const requestId = e.data?.requestId;
      if (typeof requestId !== 'string') {
        return;
      }
      try {
        const payload = buildWeChatContext();
        getIframeEl()?.contentWindow?.postMessage({ type: MSG.CONTEXT, requestId, payload }, '*');
      } catch (err) {
        getIframeEl()?.contentWindow?.postMessage(
          { type: MSG.CONTEXT, requestId, error: err instanceof Error ? err.message : String(err) },
          '*',
        );
      }
      return;
    }
    if (t === MSG.REQUEST_ROLE_ARCHIVE) {
      const requestId = e.data?.requestId;
      if (typeof requestId !== 'string') {
        return;
      }
      try {
        const contacts = buildRoleArchiveCandidates();
        getIframeEl()?.contentWindow?.postMessage({ type: MSG.ROLE_ARCHIVE, requestId, contacts }, '*');
      } catch (err) {
        getIframeEl()?.contentWindow?.postMessage(
          {
            type: MSG.ROLE_ARCHIVE,
            requestId,
            contacts: [] as WeChatContactOut[],
            error: err instanceof Error ? err.message : String(err),
          },
          '*',
        );
      }
      return;
    }
    if (t === MSG.REQUEST_CLOSE) {
      close();
    }
  };
  window.parent.addEventListener('message', messageHandler);

  function open() {
    phoneUiUrl = getPhoneUiUrl();
    if (!phoneUiUrl) {
      toastr.warning('请在本脚本变量中配置 phone_ui_url（手机界面 index.html 的完整 URL，含协议）');
      return;
    }

    buildDom();
    setIframeSrc();

    $overlay?.css('display', 'block');
    $phoneRoot?.css('display', 'flex');
    isOpen = true;
    applyLayout();
  }

  function close() {
    if (!isOpen) {
      return;
    }
    postToPhone({ type: MSG.CLOSED });
    $overlay?.css('display', 'none');
    $phoneRoot?.css('display', 'none');
    isOpen = false;
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  const api: TavernPhoneApi = {
    version: VERSION,
    get isOpen() {
      return isOpen;
    },
    open,
    close,
    toggle,
    getIframeWindow: () => getIframeEl()?.contentWindow ?? null,
  };

  mountTavernPhoneApi(api);

  replaceScriptButtons([{ name: '小手机', visible: true }]);
  eventOn(getButtonEvent('小手机'), () => {
    toggle();
  });

  $(window).on('pagehide', () => {
    if (messageHandler) {
      window.parent.removeEventListener('message', messageHandler);
    }
    messageHandler = null;
    close();
    removeDom();
    unmountTavernPhoneApi();
  });
});
