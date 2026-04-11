/**
 * 消息解析工具
 * 从最新楼层消息中解析 maintext 和 option 标签
 */

/** ok：仅 1 开 1 闭（或可选标签未出现）；warning：多组闭合或开比闭多 1（仍可按最后一对解析）；error：未闭合或严重失衡 */
export type TagCheckSeverity = 'ok' | 'warning' | 'error';

/**
 * 标签验证结果
 */
export interface TagCheckResult {
  tag: string;
  /** 是否可按最后一对标签正常解析（ok / warning 为 true；error 为 false） */
  isValid: boolean;
  severity: TagCheckSeverity;
  isOpen: boolean;
  isClosed: boolean;
  message: string;
}

/** 多一个开标签、少一个闭标签：常见于正文前重复书写了格式示例（与预设/提示词有关） */
export function isSuspiciousDuplicateOpenMismatch(open: number, close: number): boolean {
  return open === close + 1 && close >= 1;
}

type TagKind = 'optionalAbsent' | 'required';

/**
 * 标签检核着色：仅 1 开 1 闭为绿；多组闭合或开比闭恰好多 1 为黄（仍可按最后一对解析）；闭比开多、有开无闭、开比闭多 2+ 为红。
 */
function classifyTagBalance(
  tag: TagCheckResult['tag'],
  open: number,
  close: number,
  kind: TagKind,
  /** 消息里替代默认 `<tag>` 的展示名（如正文：`<maintext> / <content>`） */
  angleOverride?: string,
): TagCheckResult {
  const angle =
    angleOverride ??
    (tag === 'UpdateVariable' ? '<UpdateVariable>' : `<${tag}>`);

  if (kind === 'optionalAbsent' && open === 0 && close === 0) {
    const absentMsg =
      tag === 'thinking'
        ? '无 <thinking> 标签'
        : tag === 'sum'
          ? '无 <sum> 标签（可选）'
          : '无 <UpdateVariable> 标签（可选）';
    return {
      tag,
      isValid: true,
      severity: 'ok',
      isOpen: false,
      isClosed: false,
      message: absentMsg,
    };
  }

  if (kind === 'required' && open === 0) {
    return {
      tag,
      isValid: false,
      severity: 'error',
      isOpen: false,
      isClosed: false,
      message:
        tag === 'maintext'
          ? `缺少 ${angle} 开标签`
          : tag === 'choice'
            ? '缺少 <choice> 标签'
            : '缺少 <option> 标签',
    };
  }

  if (open < close) {
    return {
      tag,
      isValid: false,
      severity: 'error',
      isOpen: true,
      isClosed: true,
      message: `${angle} 多余的闭标签（${open} 开 / ${close} 闭）`,
    };
  }

  if (close === 0 && open > 0) {
    return {
      tag,
      isValid: false,
      severity: 'error',
      isOpen: true,
      isClosed: false,
      message: `${angle} 未闭合（${open} 开 / 0 闭）`,
    };
  }

  if (open === close) {
    // option / choice：只要有一个闭合就算绿
    if ((tag === 'option' || tag === 'choice') && close >= 1) {
      return {
        tag,
        isValid: true,
        severity: 'ok',
        isOpen: true,
        isClosed: true,
        message: close === 1 ? `${angle} 仅 1 组开闭，正确` : `${angle} 共 ${open} 组开闭，正确`,
      };
    }
    if (open === 1) {
      return {
        tag,
        isValid: true,
        severity: 'ok',
        isOpen: true,
        isClosed: true,
        message: `${angle} 仅 1 组开闭，正确`,
      };
    }
    return {
      tag,
      isValid: true,
      severity: 'warning',
      isOpen: true,
      isClosed: true,
      message: `${angle} 共 ${open} 组闭合；仅 1 组为绿，多组为黄（已按最后一对解析）`,
    };
  }

  const extra = open - close;
  if (extra === 1) {
    return {
      tag,
      isValid: true,
      severity: 'warning',
      isOpen: true,
      isClosed: true,
      message: `${angle} 多 1 个开标签（${open} 开 / ${close} 闭），为黄（已按最后一对解析）`,
    };
  }

  return {
    tag,
    isValid: false,
    severity: 'error',
    isOpen: true,
    isClosed: false,
    message: `${angle} 未正确闭合（${open} 开 / ${close} 闭），缺 ${extra} 个闭标签`,
  };
}

/**
 * 选项区：`<option>…</option>` 与 `<choice>…</choice>` 二选一或并存；检核结果统一挂在 tag `option`（界面仍显示「选项」）。
 */
export function validateOptionOrChoiceTags(messageContent: string): TagCheckResult {
  if (!messageContent) {
    return {
      tag: 'option',
      isValid: false,
      severity: 'error',
      isOpen: false,
      isClosed: false,
      message: '缺少 <option> 或 <choice> 标签',
    };
  }

  const optO = (messageContent.match(/<option/gi) || []).length;
  const optC = (messageContent.match(/<\/option>/gi) || []).length;
  const chO = (messageContent.match(/<choice(\s[^>]*)?>/gi) || []).length;
  const chC = (messageContent.match(/<\/choice>/gi) || []).length;

  const anyOpt = optO > 0 || optC > 0;
  const anyCh = chO > 0 || chC > 0;

  if (!anyOpt && !anyCh) {
    return {
      tag: 'option',
      isValid: false,
      severity: 'error',
      isOpen: false,
      isClosed: false,
      message: '缺少 <option> 或 <choice> 标签',
    };
  }

  if (anyOpt && !anyCh) {
    return classifyTagBalance('option', optO, optC, 'required', '<option>');
  }

  if (!anyOpt && anyCh) {
    const r = classifyTagBalance('choice', chO, chC, 'required', '<choice>');
    return { ...r, tag: 'option' };
  }

  const optR = classifyTagBalance('option', optO, optC, 'required', '<option>');
  const chR = classifyTagBalance('choice', chO, chC, 'required', '<choice>');
  if (optR.isValid || chR.isValid) {
    const bothOk = optR.isValid && chR.isValid;
    const sevOk = optR.severity === 'ok' && chR.severity === 'ok';
    const severity: TagCheckSeverity =
      bothOk && sevOk ? 'ok' : optR.severity === 'error' && chR.severity === 'error' ? 'error' : 'warning';
    return {
      tag: 'option',
      isValid: true,
      severity,
      isOpen: true,
      isClosed: true,
      message: bothOk
        ? sevOk
          ? '同时存在 <option> 与 <choice> 且均可解析（优先 <option id> → <choice> → 无 id 的 <option>）'
          : '同时存在 <option> 与 <choice>，其中一侧为黄（仍可解析）'
        : optR.isValid
          ? `${optR.message}（另有未正确闭合的 <choice>）`
          : `${chR.message}（另有未正确闭合的 <option>）`,
    };
  }

  return {
    tag: 'option',
    isValid: false,
    severity: 'error',
    isOpen: true,
    isClosed: false,
    message: `<option> 与 <choice> 均未正确闭合（${optR.message}；${chR.message}）`,
  };
}

/**
 * 验证消息中的标签闭合情况
 * 顺序：thinking → maintext → option → sum → UpdateVariable
 */
export function validateTags(messageContent: string): TagCheckResult[] {
  if (!messageContent) {
    return [
      classifyTagBalance('thinking', 0, 0, 'optionalAbsent'),
      classifyTagBalance('maintext', 0, 0, 'required', '<maintext> / <content>'),
      validateOptionOrChoiceTags(''),
      classifyTagBalance('sum', 0, 0, 'optionalAbsent'),
      classifyTagBalance('UpdateVariable', 0, 0, 'optionalAbsent'),
    ];
  }

  const thinkingOpen = (messageContent.match(/<thinking>/gi) || []).length;
  const thinkingClose = (messageContent.match(/<\/thinking>/gi) || []).length;
  const thinking = classifyTagBalance('thinking', thinkingOpen, thinkingClose, 'optionalAbsent');

  /** 正文区：开标签可为 <maintext> 或 <content>，闭标签可为 </maintext> 或 </content> */
  const maintextOpen =
    (messageContent.match(/<maintext>/gi) || []).length +
    (messageContent.match(/<content(\s[^>]*)?>/gi) || []).length;
  const maintextClose =
    (messageContent.match(/<\/maintext>/gi) || []).length +
    (messageContent.match(/<\/content>/gi) || []).length;
  const maintext = classifyTagBalance(
    'maintext',
    maintextOpen,
    maintextClose,
    'required',
    '<maintext> / <content>',
  );

  const option = validateOptionOrChoiceTags(messageContent);

  const sumOpen = (messageContent.match(/<sum>/gi) || []).length;
  const sumClose = (messageContent.match(/<\/sum>/gi) || []).length;
  const sum = classifyTagBalance('sum', sumOpen, sumClose, 'optionalAbsent');

  const uvOpen = (messageContent.match(/<UpdateVariable>/gi) || []).length;
  const uvClose = (messageContent.match(/<\/UpdateVariable>/gi) || []).length;
  const updateVariable = classifyTagBalance('UpdateVariable', uvOpen, uvClose, 'optionalAbsent');

  return [thinking, maintext, option, sum, updateVariable];
}


/**
 * 检查消息是否有未闭合的 thinking 或 redacted_reasoning 标签
 * 返回 true 表示所有过滤标签都已闭合，可以开始解析
 */
export function isFilteringComplete(messageContent: string): boolean {
  if (!messageContent) return true;

  // 检查 <thinking>
  const thinkingOpen = (messageContent.match(/<thinking>/gi) || []).length;
  const thinkingClose = (messageContent.match(/<\/thinking>/gi) || []).length;
  if (thinkingOpen > thinkingClose) return false;

  // 检查 <redacted_reasoning>
  const redactedOpen = (messageContent.match(/<redacted_reasoning>/gi) || []).length;
  const redactedClose = (messageContent.match(/<\/redacted_reasoning>/gi) || []).length;
  if (redactedOpen > redactedClose) return false;

  return true;
}

/**
 * 从流式文本中提取已过滤的内容（去除 thinking 和 redacted_reasoning 后）
 */
export function extractFilteredContent(streamText: string): string {
  if (!streamText) return '';

  // 移除所有已闭合的 <thinking> 标签及其内容
  let cleaned = streamText.replace(/<thinking>.*?<\/thinking>/gis, '');

  // 移除所有已闭合的 <redacted_reasoning> 标签及其内容
  cleaned = cleaned.replace(/<redacted_reasoning>.*?<\/redacted_reasoning>/gis, '');

  // 如果有未闭合的 <thinking> 标签，截断到该位置
  const thinkingStart = cleaned.search(/<thinking>/i);
  if (thinkingStart !== -1) {
    cleaned = cleaned.substring(0, thinkingStart);
  }

  // 如果有未闭合的 <redacted_reasoning> 标签，截断到该位置
  const redactedStart = cleaned.search(/<redacted_reasoning>/i);
  if (redactedStart !== -1) {
    cleaned = cleaned.substring(0, redactedStart);
  }

  return cleaned.trim();
}

/** 最后一个正文闭标签位置：`</maintext>` 或 `</content>`（取在文中更靠后者） */
function findLastBodyClose(text: string, lc: string): { idx: number; len: number } | null {
  const idxM = lc.lastIndexOf('</maintext>');
  const idxC = lc.lastIndexOf('</content>');
  if (idxM < 0 && idxC < 0) return null;
  const preferM = idxM >= idxC;
  const candidates = preferM
    ? [
        { idx: idxM, re: /^<\/maintext>/i },
        { idx: idxC, re: /^<\/content>/i },
      ]
    : [
        { idx: idxC, re: /^<\/content>/i },
        { idx: idxM, re: /^<\/maintext>/i },
      ];
  for (const { idx, re } of candidates) {
    if (idx < 0) continue;
    const m = text.slice(idx).match(re);
    if (m) return { idx, len: m[0].length };
  }
  return null;
}

/** 在 closeIdx 之前，最后一个 `<maintext>` 或 `<content …>` 开标签 */
function lastBodyOpenBefore(text: string, closeIdx: number): { idx: number; len: number } | null {
  const opens = [...text.matchAll(/<maintext>|<content(\s[^>]*)?>/gi)];
  let best: { idx: number; len: number } | null = null;
  for (const m of opens) {
    const i = m.index ?? 0;
    if (i >= closeIdx) continue;
    if (!best || i > best.idx) best = { idx: i, len: m[0].length };
  }
  return best;
}

/**
 * 从后往前配对：最后一个 `</maintext>` 或 `</content>` 与其前方最后一个 `<maintext>` / `<content>` 之间的内容。
 * 避免前文「1. <maintext>」等未闭合示例与唯一闭标签被非贪婪正则误配成一对。
 */
export function extractMaintextByLastClosePair(text: string): string {
  if (!text) return '';

  const lc = text.toLowerCase();
  const close = findLastBodyClose(text, lc);
  if (!close) return '';

  const open = lastBodyOpenBefore(text, close.idx);
  if (!open) return '';

  const innerStart = open.idx + open.len;
  if (innerStart > close.idx) return '';

  return text.slice(innerStart, close.idx).trim();
}

/**
 * 将「最后一对」<maintext> 的内部替换为 newInner，保留原有开闭标签写法（含大小写）。
 * 用于编辑保存，避免只替换到第一对标签。
 */
export function replaceLastMaintextInnerContent(fullMessage: string, newInner: string): string {
  if (!fullMessage) return fullMessage;

  const lc = fullMessage.toLowerCase();
  const close = findLastBodyClose(fullMessage, lc);
  if (!close) return fullMessage;

  const open = lastBodyOpenBefore(fullMessage, close.idx);
  if (!open) return fullMessage;

  const innerStart = open.idx + open.len;
  if (innerStart > close.idx) return fullMessage;

  return fullMessage.slice(0, innerStart) + newInner + fullMessage.slice(close.idx);
}

/**
 * 解析消息中的正文
 * 注意：先移除 <thinking> / redacted_reasoning，再按最后一对闭标签从后往前取 maintext
 */
export function parseMaintext(messageContent: string): string {
  if (!messageContent) return '';

  // 先移除所有<thinking>和标签及其内容
  let cleaned = messageContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '');

  // 检查是否有未闭合的标签
  const thinkingStart = cleaned.search(/<thinking>/i);
  if (thinkingStart !== -1) {
    cleaned = cleaned.substring(0, thinkingStart);
  }
  const redactedStart = cleaned.search(/<redacted_reasoning>/i);
  if (redactedStart !== -1) {
    cleaned = cleaned.substring(0, redactedStart);
  }

  return extractMaintextByLastClosePair(cleaned);
}

/**
 * 仅用于界面 `v-html` 展示：移除 HTML 注释并压缩因注释行产生的多余换行。
 * 不用于写回楼层、编辑框或二次 API——那些路径应保留原文（含 `<!-- … -->`）。
 */
export function formatMaintextForHtmlView(html: string): string {
  if (!html) return '';
  let t = html.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/^[ \t\u00a0]*\n+/, '');
  t = t.replace(/\n+[ \t\u00a0]*$/, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t;
}

/** 匹配 `<sum>` / `<sum …>` 或 `</sum>`，用于栈配对（只认完整闭合对） */
const SUM_PAIR_TOKEN_RE = /<sum(\s[^>]*)?>|<\/sum>/gi;

/**
 * 提取「最后一个已闭合」的 `<sum>…</sum>` 内部文本：以文档中最后一个 `</sum>` 为准，与其栈配对的 `<sum>` 之间的内容。
 * 用栈配对，避免非贪婪正则把第一个 `</sum>` 错配给第一个 `<sum>`（例如示例 + 正文多段 sum 时）。
 */
export function extractLastSumContent(messageContent: string): string {
  if (!messageContent) return '';
  let cleaned = messageContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '');
  const stack: number[] = [];
  let lastClosedInner = '';
  SUM_PAIR_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SUM_PAIR_TOKEN_RE.exec(cleaned)) !== null) {
    const token = m[0];
    if (/^<\/sum>/i.test(token)) {
      const contentStart = stack.pop();
      if (contentStart !== undefined) {
        lastClosedInner = cleaned.slice(contentStart, m.index).trim();
      }
    } else {
      stack.push(m.index + token.length);
    }
  }
  return lastClosedInner;
}

/** 整段为 `${…}` 时去掉外壳（仅一层） */
function stripOuterDollarBraces(s: string): string {
  const t = s.trim();
  if (t.startsWith('${') && t.endsWith('}')) {
    return t.slice(2, -1).trim();
  }
  return t;
}

/**
 * 选项在界面中展示的文案：去掉 `${…}` 外壳，保留「短标题 - 正文」结构。
 * - `标题 - ${…}` → `标题 - …`（正文为 `${}` 内层）
 * - `${…}` → 仅内层
 * - `标题 - ${选项内容: …}` → 仍按旧规则取冒号后说明，并去掉可能残留的外层 `${}`
 */
export function formatOptionDisplayForUi(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  const templateRe = /^(.+?)\s*-\s*\$\{\s*选项内容\s*:\s*(.*)\}\s*$/s;
  const tm = s.match(templateRe);
  if (tm) {
    return stripOuterDollarBraces(tm[2].trim());
  }

  const plainDash = /^(.+?)\s*-\s*(.+)$/s;
  const pm = s.match(plainDash);
  if (pm) {
    const left = pm[1].trim();
    const right = stripOuterDollarBraces(pm[2].trim());
    return `${left} - ${right}`.trim();
  }

  return stripOuterDollarBraces(s);
}

/**
 * 从 `<choice>` 单行「序号后正文」中提取玩家可选行动文案（与 {@link formatOptionDisplayForUi} 一致）。
 */
function normalizeChoiceLineBody(afterPrefix: string): string {
  return formatOptionDisplayForUi(afterPrefix);
}

/** 全角数字 → ASCII，便于匹配「１．」等 */
function choiceLineToAsciiNumberPrefix(line: string): string {
  return line.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
}

/** 是否为新选项行：`1. ` / `１．` / `A. ` 等 */
function isChoiceOptionStartLine(line: string): boolean {
  const s = choiceLineToAsciiNumberPrefix(line).replace(/^\uFEFF/, '');
  return /^[0-9]+\s*[.．]\s+\S/.test(s) || /^[A-Za-z]\s*[.．]\s+\S/.test(s);
}

/**
 * 合并因 `${…}` 换行而拆开的行，再按行解析序号选项。
 */
function mergeChoiceContinuationLines(lines: string[]): string[] {
  const merged: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^\uFEFF/, '').trim();
    if (!line) continue;
    if (isChoiceOptionStartLine(line)) {
      merged.push(line);
    } else if (merged.length > 0) {
      merged[merged.length - 1] += `\n${line}`;
    }
  }
  return merged;
}

function parseChoiceBlockInner(inner: string): Option[] {
  const lines = mergeChoiceContinuationLines(inner.split('\n').map(l => l.trim()).filter(l => l.length > 0));
  const out: Option[] = [];

  const letterWithBody = /^([A-Za-z])\s*[.．]\s+(.+)$/su;

  for (const line of lines) {
    const asciiNumLine = choiceLineToAsciiNumberPrefix(line);
    let m = asciiNumLine.match(/^([0-9]+)\s*[.．]\s+(.+)$/su);
    if (m) {
      out.push({ id: m[1], text: normalizeChoiceLineBody(m[2]) });
      continue;
    }
    m = line.match(letterWithBody);
    if (m) {
      out.push({ id: m[1].toUpperCase(), text: normalizeChoiceLineBody(m[2]) });
    }
  }
  return out;
}

/**
 * 解析消息中的选项
 * 支持格式：
 * 1. 带 id: <option id="A">选项文本</option>
 * 2. <choice>…</choice>：多行 `1. …` / `A. …`，兼容 ` - ${选项内容:…}`、`标题 - ${…}`；界面展示会去掉 `${}` 外壳
 * 3. 不带 id: <option>\nA. 选项1\nB. 选项2\n</option>
 */
export interface Option {
  id: string;
  text: string;
}

export function parseOptions(messageContent: string): Option[] {
  if (!messageContent) return [];

  // 先移除 thinking 和 redacted_reasoning 标签
  let cleaned = messageContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '');

  const thinkingStart = cleaned.search(/<thinking>/i);
  if (thinkingStart !== -1) {
    cleaned = cleaned.substring(0, thinkingStart);
  }
  const redactedStart = cleaned.search(/<redacted_reasoning>/i);
  if (redactedStart !== -1) {
    cleaned = cleaned.substring(0, redactedStart);
  }

  // 匹配所有带 id 的 <option id="X">...</option> 标签（支持多行内容）
  const optionWithIdRegex = /<option id="([^"]+)">([\s\S]*?)<\/option>/gi;
  const optionsWithId: Option[] = [];
  let match;
  while ((match = optionWithIdRegex.exec(cleaned)) !== null) {
    optionsWithId.push({
      id: match[1].trim().toUpperCase(),
      text: formatOptionDisplayForUi(match[2].trim()),
    });
  }

  // <choice>…</choice>：取最后一组闭合块（与 option 多段示例场景一致）
  const choicePairRe = /<choice([^>]*)>([\s\S]*?)<\/choice>/gi;
  const choicePairs = [...cleaned.matchAll(choicePairRe)];
  let fromChoice: Option[] = [];
  if (choicePairs.length > 0) {
    const lastInner = (choicePairs[choicePairs.length - 1]?.[2] ?? '').trim();
    fromChoice = parseChoiceBlockInner(lastInner);
  }

  // 世界书里的 <option id> 示例常只有 A/B/C 三条；若本楼层 <choice> 解析出更多条，应以 choice 为准
  const nId = optionsWithId.length;
  const nCh = fromChoice.length;
  if (nCh > nId) {
    return fromChoice;
  }
  if (nId > 0) {
    return optionsWithId;
  }
  if (nCh > 0) {
    return fromChoice;
  }

  // 兼容旧格式：匹配所有不带 id 的 <option>...</option> 标签对
  const optionPairRe = /<option([^>]*)>([\s\S]*?)<\/option>/gi;
  const allPairs = [...cleaned.matchAll(optionPairRe)];

  // 取最后若干组闭合标签，避免文首示例块干扰，同时支持 4+ 条独立 <option>
  const LEGACY_OPTION_TAG_MAX = 16;
  const legacyPairs = allPairs.slice(-LEGACY_OPTION_TAG_MAX);
  const allOptionTexts: string[] = [];
  for (const pair of legacyPairs) {
    const text = (pair[2] ?? '').trim();
    if (text) allOptionTexts.push(text);
  }
  if (allOptionTexts.length === 0) {
    return [];
  }

  const optionText = allOptionTexts.join('\n');
  const lines = optionText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // 检查是否是 A.、B.、C. 格式
  const optionPattern = /^[A-Z]\.\s*/;
  const hasLetterPrefix = lines.some(line => optionPattern.test(line));

  if (hasLetterPrefix) {
    // 按字母开头分割选项
    const options: Option[] = [];
    let currentOption: string[] = [];

    for (const line of lines) {
      if (optionPattern.test(line)) {
        if (currentOption.length > 0) {
          const text = currentOption.join('\n');
          const id = text.match(/^([A-Z])\./)?.[1] || String.fromCharCode(65 + options.length);
          options.push({
            id,
            text: formatOptionDisplayForUi(text.replace(/^[A-Z]\.\s*/, '').trim()),
          });
          currentOption = [];
        }
        currentOption.push(line);
      } else {
        if (currentOption.length > 0) {
          currentOption.push(line);
        }
      }
    }

    if (currentOption.length > 0) {
      const text = currentOption.join('\n');
      const id = text.match(/^([A-Z])\./)?.[1] || String.fromCharCode(65 + options.length);
      options.push({
        id,
        text: formatOptionDisplayForUi(text.replace(/^[A-Z]\.\s*/, '').trim()),
      });
    }

    return options;
  } else {
    // 单个选项或简单的多行选项
    return lines.map((line, index) => ({
      id: String.fromCharCode(65 + index),
      text: formatOptionDisplayForUi(line),
    }));
  }
}

/**
 * 从最新 assistant 消息中读取正文和选项
 */
export function loadFromLatestMessage(): {
  maintext: string;
  options: Option[];
  messageId?: number;
  userMessageId?: number;
  fullMessage?: string;
} {
  try {
    const lastMessageId = getLastMessageId();
    if (lastMessageId < 0) {
      return { maintext: '', options: [] };
    }

    // 获取最新 assistant 消息
    const messages = getChatMessages(lastMessageId, { role: 'assistant' });
    if (!messages || messages.length === 0) {
      // 尝试获取任意角色的最新消息
      const allMessages = getChatMessages(lastMessageId);
      if (!allMessages || allMessages.length === 0) {
        return { maintext: '', options: [] };
      }
      const latestMessage = allMessages[0];
      const maintext = parseMaintext(latestMessage.message || '');
      const options = parseOptions(latestMessage.message || '');

      // 查找对应的 user 消息（往前遍历，找到最近的一条 user 消息）
      let userMessageId: number | undefined;
      const msgId = latestMessage.message_id;
      for (let i = msgId - 1; i >= 0; i--) {
        const prevMessages = getChatMessages(i, { role: 'user' });
        if (prevMessages && prevMessages.length > 0) {
          userMessageId = prevMessages[0].message_id;
          break;
        }
      }

      return {
        maintext,
        options,
        messageId: latestMessage.message_id,
        userMessageId,
        fullMessage: latestMessage.message
      };
    }

    const latestAssistantMessage = messages[0];
    const messageContent = latestAssistantMessage.message || '';

    const maintext = parseMaintext(messageContent);
    const options = parseOptions(messageContent);

    // 查找对应的 user 消息（往前遍历，找到最近的一条 user 消息）
    let userMessageId: number | undefined;
    const assistantId = latestAssistantMessage.message_id;
    for (let i = assistantId - 1; i >= 0; i--) {
      const prevMessages = getChatMessages(i, { role: 'user' });
      if (prevMessages && prevMessages.length > 0) {
        userMessageId = prevMessages[0].message_id;
        break;
      }
    }

    return {
      maintext,
      options,
      messageId: latestAssistantMessage.message_id,
      userMessageId,
      fullMessage: messageContent
    };
  } catch (error) {
    console.error('❌ [messageParser] 加载最新消息失败:', error);
    return { maintext: '', options: [] };
  }
}
