/**
 * 正文展示用：不调用模型，在纯文本/HTML 片段上对 ** / * 心理、「」/“”/直引号 " " 对白 做固定 class 替换，供 v-html 与宿主 CSS 配合。
 * 不修改写回楼层的 mainText 原文，仅在 formatMaintextForHtmlView 之后套用。
 *
 * 展示前会先拆掉模型/第二路写入的 <span class="th-…">…</span>，再按符号规则重新包一层，实现「前端固定模板」对白与心理，而不依赖 AI 塞标签。
 */

/** 可剥离的模型装饰 span（不含 th-ui-meta：须保留以维持 display:none 等）；class 可在任意属性位 */
const TH_SPAN_OPEN =
  /<span\b[^>]*\bclass=["']([^"']*\bth-(?!ui-meta\b)[^"']*)["'][^>]*>/gi;

/** 拆掉最外层一处 <span class="th-…">…</span>（按任意 <span / </span> 嵌套深度配对），返回新串或 null */
function unwrapOneOutermostThSpan(t: string): string | null {
  TH_SPAN_OPEN.lastIndex = 0;
  const m = TH_SPAN_OPEN.exec(t);
  if (!m) return null;
  const openStart = m.index;
  const openEnd = TH_SPAN_OPEN.lastIndex;
  let depth = 1;
  let i = openEnd;
  while (i < t.length && depth > 0) {
    const rest = t.slice(i);
    const op = rest.search(/<span\b/i);
    const cl = rest.search(/<\/span>/i);
    const opi = op === -1 ? Infinity : i + op;
    const cli = cl === -1 ? Infinity : i + cl;
    if (cli === Infinity) return null;
    if (opi < cli) {
      depth++;
      const gt = t.indexOf('>', opi);
      if (gt === -1) return null;
      i = gt + 1;
    } else {
      depth--;
      const closeEnd = cli + (t.slice(cli).match(/^<\/span>/i)?.[0].length ?? 7);
      if (depth === 0) {
        const inner = t.slice(openEnd, cli);
        return t.slice(0, openStart) + inner + t.slice(closeEnd);
      }
      i = closeEnd;
    }
  }
  return null;
}

/** 反复拆掉模型写入的 <span class="th-…">…</span>，保留内文 */
export function unwrapThPresentationSpans(raw: string): string {
  let t = raw;
  for (let g = 0; g < 500; g++) {
    const next = unwrapOneOutermostThSpan(t);
    if (next === null) break;
    t = next;
  }
  return t;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 片段内若像 HTML（含未闭合 <tag），不对其做 * / " 替换，避免误匹配 class="…" 等属性 */
function looksLikeHtmlFragment(plain: string): boolean {
  return /<[A-Za-z!?/]/.test(plain);
}

/** 按标签切开，仅在非标签片段上做替换，避免破坏已有 HTML */
function transformPlainSegments(text: string, fn: (plain: string) => string): string {
  return text
    .split(/(<[^>]+>)/g)
    .map((chunk, i) => (i % 2 === 1 ? chunk : looksLikeHtmlFragment(chunk) ? chunk : fn(chunk)))
    .join('');
}

/** **…** 与单星号 *…*（常见模型心理/轻声）→ 心理活动；先处理双星号避免与粗体冲突 */
function applyThoughtMarks(plain: string): string {
  let s = plain.replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/gs, (full, inner: string) => {
    const body = inner.trim();
    if (!body) return full;
    return `<span class="th-thought-inline">${escapeHtml(body)}</span>`;
  });
  s = s.replace(/\*([^*\n]+?)\*/g, (full, inner: string) => {
    const body = inner.trim();
    if (!body) return full;
    return `<span class="th-thought-inline">${escapeHtml(body)}</span>`;
  });
  return s;
}

/** 弯引号 “…”、角引号 「…」、ASCII 直引号 "…" → 对白流光（class 由宿主样式定义） */
const DIALOGUE_ASCII_MAX = 800;

/** ASCII 对白须含至少一个汉字，避免把 class="th-dialog-shimmer" 等属性当对白 */
const HAS_CJK = /[\u4e00-\u9fff]/;

/** 开口 " 前须为行首或对白常见前文，避免匹配 HTML 属性里的引号 */
const ASCII_DIALOGUE_OPEN = new RegExp(
  `(^|[\\s\\u3000，。、；：？！…．‧『」）\\]\\}\\n\\r\\uff1a\\uff0c])"([^"\\n]{1,${DIALOGUE_ASCII_MAX}})"`,
  'g'
);

function applyDialogueMarks(plain: string): string {
  let t = plain.replace(/\u201c([^\u201d]+)\u201d/g, (_, inner: string) => {
    return `<span class="th-dialog-shimmer">\u201c${escapeHtml(inner)}\u201d</span>`;
  });
  t = t.replace(/「([^」]+)」/g, (_, inner: string) => {
    return `<span class="th-dialog-shimmer">「${escapeHtml(inner)}」</span>`;
  });
  t = t.replace(ASCII_DIALOGUE_OPEN, (full, pre: string, inner: string) => {
    if (!HAS_CJK.test(inner)) return full;
    return `${pre}<span class="th-dialog-shimmer">"${escapeHtml(inner)}"</span>`;
  });
  return t;
}

/** 剥离此前误匹配属性引号产生的残缺前缀，避免整行废掉 */
function stripLegacyBeautifierArtifacts(raw: string): string {
  return raw
    .replace(/"th-dialog-shimmer">/g, '')
    .replace(/"th-thought-inline">/g, '');
}

/**
 * 在已去注释的 maintext 字符串上套用内联美化。
 * 仅在「标签外」的纯文本片段替换，故可与 <htmlcontent> 小前端共存；整段仅含 <script> 时仍跳过以免误改脚本。
 */
export function applyMaintextInlineBeautify(text: string): string {
  if (!text) return '';
  if (/<\s*script\b/i.test(text)) {
    return text;
  }
  const stripped = unwrapThPresentationSpans(text);
  const cleaned = stripLegacyBeautifierArtifacts(stripped);
  return transformPlainSegments(cleaned, seg => applyDialogueMarks(applyThoughtMarks(seg)));
}
