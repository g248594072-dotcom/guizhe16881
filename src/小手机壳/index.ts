/**
 * 小手机壳脚本：在酒馆页面挂载遮罩 + iframe，加载独立部署的 React 手机 UI。
 * 主界面或其它前端通过 window.parent.TavernPhone.open/toggle/close 调用。
 *
 * 脚本变量（type: script）可配置：
 * - phone_ui_url / tavern_phone_ui_url: 手机界面 index.html 的完整 URL（必填才能显示内容）
 */
const VERSION = '1.0.0';
const PHONE_W = 375;
const PHONE_H = 812;
const Z_OVERLAY = 10050;
const Z_PHONE = 10051;

/** 与 src/手机 内 tavernPhoneBridge.ts 保持一致 */
const MSG = {
  REQUEST_CLOSE: 'tavern-phone:request-close',
  OPENED: 'tavern-phone:opened',
  CLOSED: 'tavern-phone:closed',
  READY: 'tavern-phone:ready',
} as const;

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
