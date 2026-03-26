/**
 * 小手机壳脚本：在酒馆页面挂载遮罩 + iframe，加载独立部署的 React 手机 UI。
 * 主界面或其它前端通过 window.parent.TavernPhone.open/toggle/close 调用。
 *
 * 脚本变量（type: script）可配置：
 * - phone_ui_url / tavern_phone_ui_url: 手机界面 index.html 的完整 URL（必填才能显示内容）
 */
import { createScriptIdDiv } from '../../util/script';

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

  function getIframeEl(): HTMLIFrameElement | null {
    return $iframe?.[0] ?? null;
  }

  function applyLayout() {
    if (!$phoneRoot?.length) {
      return;
    }
    const vw = window.parent.innerWidth;
    const vh = window.parent.innerHeight;
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
      $(window.parent).off('resize', resizeHandler);
      resizeHandler = null;
    }
  }

  function buildDom() {
    if ($phoneRoot?.length) {
      return;
    }

    $overlay = createScriptIdDiv()
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
      .appendTo('body');

    $phoneRoot = createScriptIdDiv()
      .attr('data-tavern-phone', 'root')
      .css({
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: Z_PHONE,
        display: 'none',
        pointerEvents: 'auto',
      })
      .appendTo('body');

    const $inner = createScriptIdDiv()
      .attr('data-tavern-phone', 'inner')
      .css({
        borderRadius: '55px',
        overflow: 'hidden',
        boxShadow: '0 24px 40px rgba(0,0,0,0.5)',
        background: '#000',
      });

    $iframe = $(`<iframe>`)
      .attr({
        title: 'Tavern Phone',
        frameborder: '0',
        allow: 'clipboard-read; clipboard-write',
      })
      .css({
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

    resizeHandler = () => {
      if (isOpen) {
        applyLayout();
      }
    };
    $(window.parent).on('resize', resizeHandler);

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
    $phoneRoot?.css('display', 'block');
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
