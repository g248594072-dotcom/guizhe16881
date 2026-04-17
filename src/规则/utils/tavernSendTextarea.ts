/**
 * 将文本追加到酒馆主界面「用户发送框」，供玩家确认后发送以触发变量合并。
 */

function tryAppend(doc: Document | null | undefined, text: string): boolean {
  if (!doc) return false;
  const el = doc.querySelector(
    '#send_textarea, textarea#send_textarea, #message_input, textarea.mes_text, form#send_form textarea',
  ) as HTMLTextAreaElement | null;
  if (!el) return false;
  const cur = el.value ?? '';
  el.value = cur.trim() ? `${cur.trim()}\n\n${text}` : text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  try {
    el.focus();
  } catch {
    /* */
  }
  return true;
}

/** 追加到酒馆发送框；失败返回 false（可提示用户手动粘贴） */
export function appendTavernUserSendText(text: string): boolean {
  const t = String(text ?? '').trim();
  if (!t) return false;
  if (tryAppend(document, t)) return true;
  try {
    if (window.parent && window.parent !== window) {
      if (tryAppend(window.parent.document, t)) return true;
    }
  } catch {
    /* cross-origin */
  }
  try {
    if (window.top && window.top !== window && window.top !== window.parent) {
      if (tryAppend(window.top.document, t)) return true;
    }
  } catch {
    /* */
  }
  return false;
}
