/**
 * 将多段 / 多块的 `<UpdateVariable>…` 与自由叙述合并为**至多一对**最外层标签，
 * 供本界面输入框与 `sendMessage` 发送内容统一结构。
 */
import { extractJsonPatchFromUpdateVariable } from './jsonPatchStat';
import { formatMergedUpdateVariableBlock, type TacticalMapCommitPatchOp } from './tacticalMapCommitSendBox';
import {
  extractAllClosedUpdateVariableBlockRanges,
  extractFreeTextOutsideUpdateVariableBlocks,
  innerBodyOfUpdateVariableBlock,
} from './updateVariableExtract';
const PS_OPEN = /<PlayerStagingSummary>([\s\S]*?)<\/PlayerStagingSummary>/i;
const JSP_RE = /<JSONPatch>([\s\S]*?)<\/JSONPatch>/i;

function unescapeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

/**
 * 从 `UpdateVariable` 块**内部**正文拆出：摘要、Patch、以及无标签时的整段作为摘要。
 */
export function parseInnerToSummaryAndPatches(
  inner: string,
): { summary: string; patches: TacticalMapCommitPatchOp[] } {
  const raw = String(inner ?? '').trim();
  if (!raw) {
    return { summary: '', patches: [] };
  }

  let jsonPatches: TacticalMapCommitPatchOp[] = [];
  const fromInner =
    extractJsonPatchFromUpdateVariable(raw) ??
    extractJsonPatchFromUpdateVariable(`<UpdateVariable>\n${raw}\n</UpdateVariable>`);
  if (fromInner && fromInner.length > 0) {
    jsonPatches = fromInner;
  } else {
    // 裸 `[]` 在 inner 中
    const arrM = raw.match(/^\[([\s\S]*)\]$/m);
    if (arrM) {
      try {
        const p = JSON.parse(arrM[0]) as unknown;
        if (Array.isArray(p)) {
          jsonPatches = p as TacticalMapCommitPatchOp[];
        }
      } catch {
        // ignore
      }
    }
  }

  const psM = raw.match(PS_OPEN);
  const summaryFromTag = psM ? unescapeXmlEntities(psM[1].trim()) : '';

  const free = raw
    .replace(JSP_RE, '')
    .replace(PS_OPEN, '')
    .trim();
  if (summaryFromTag && !free) {
    return { summary: summaryFromTag, patches: jsonPatches };
  }
  if (summaryFromTag && free) {
    return { summary: [summaryFromTag, free].filter(Boolean).join('\n\n').trim(), patches: jsonPatches };
  }
  if (!psM) {
    if (jsonPatches.length > 0) {
      return { summary: free, patches: jsonPatches };
    }
    // 无标签、无 patch：整段为摘要（如旧版 [个人规则]…）
    return { summary: raw, patches: [] };
  }
  return { summary: summaryFromTag, patches: jsonPatches };
}

function mergeInnersToSummaryAndPatches(inners: string[]): { summary: string; patches: TacticalMapCommitPatchOp[] } {
  if (inners.length === 0) {
    return { summary: '', patches: [] };
  }
  if (inners.length === 1) {
    return parseInnerToSummaryAndPatches(inners[0] ?? '');
  }
  const summaries: string[] = [];
  const allPatches: TacticalMapCommitPatchOp[] = [];
  for (const inner of inners) {
    const { summary, patches } = parseInnerToSummaryAndPatches(inner);
    if (summary) summaries.push(summary);
    allPatches.push(...patches);
  }
  return { summary: summaries.join('\n\n').trim(), patches: allPatches };
}

/**
 * 抽取「最前一段连续自由叙述」与所有顶层闭合的完整 `<UpdateVariable>…` 子串；中间/末尾的游离字串一并并入 `freeTextParts`。
 */
export function splitFreeTextAndUpdateVariableBlocks(s: string): { freeText: string; fullBlocks: string[] } {
  const text = String(s ?? '');
  const ranges = extractAllClosedUpdateVariableBlockRanges(text);
  if (ranges.length === 0) {
    return { freeText: text.trim(), fullBlocks: [] };
  }
  const blocks = ranges.map(({ start, end }) => text.slice(start, end));
  return { freeText: extractFreeTextOutsideUpdateVariableBlocks(text), fullBlocks: blocks };
}

/**
 * 将**整段**中多处 `<UpdateVariable>` 折叠为一对；自由叙述合并在块前，以 `\\n\\n` 连接。
 */
export function collapseMultipleUpdateVariableBlocksInText(text: string): string {
  const { freeText, fullBlocks } = splitFreeTextAndUpdateVariableBlocks(text);
  if (fullBlocks.length === 0) {
    return text.trim();
  }
  if (fullBlocks.length === 1) {
    if (!freeText) return String(text).trim();
    return [freeText, fullBlocks[0]].filter(Boolean).join('\n\n');
  }
  const inners = fullBlocks.map(b => innerBodyOfUpdateVariableBlock(b));
  const { summary, patches } = mergeInnersToSummaryAndPatches(inners);
  const one = formatMergedUpdateVariableBlock({ summary: summary || undefined, patches });
  if (!one) return (freeText || text).trim();
  return freeText ? [freeText, one].filter(Boolean).join('\n\n') : one;
}

/**
 * 合并**两段**来源（输入框中已打的内容 + 待发 `takePendingUpdateVariableBlock` 整段）为一条可发送的 `message`，
 * 保证**至多一对**最外层 `UpdateVariable` 闭合；摘要写在块外，块内仅累计 `<JSONPatch>`（仍兼容旧块内 `<PlayerStagingSummary>`）。
 */
export function buildSendMessageContent(typed: string, pendingBlockFromQueue: string): string {
  const a = String(typed ?? '').trim();
  const b = String(pendingBlockFromQueue ?? '').trim();
  if (!a) return b ? collapseMultipleUpdateVariableBlocksInText(b) : '';
  if (!b) return collapseMultipleUpdateVariableBlocksInText(a);

  const sa = splitFreeTextAndUpdateVariableBlocks(a);
  const sb = splitFreeTextAndUpdateVariableBlocks(b);
  const allBlocks = [...sa.fullBlocks, ...sb.fullBlocks];
  const freeJoin = [sa.freeText, sb.freeText].filter(s => s && s.trim()).join('\n\n').trim();

  if (allBlocks.length === 0) {
    return [a, b].join('\n\n');
  }
  if (allBlocks.length === 1) {
    const u = [freeJoin, allBlocks[0]].filter(s => s && s.trim());
    return u.length ? u.join('\n\n') : a + '\n\n' + b;
  }
  const inners = allBlocks.map(bl => innerBodyOfUpdateVariableBlock(bl));
  const { summary, patches } = mergeInnersToSummaryAndPatches(inners);
  const one = formatMergedUpdateVariableBlock({ summary: summary || undefined, patches });
  if (!one) return [a, b].join('\n\n');
  return freeJoin ? [freeJoin, one].filter(Boolean).join('\n\n') : one;
}

/**
 * 将**一段**要作为「说明」的文本与可选的 `JSONPatch` 操作，并入 `current` 中**已存在**的块；
 * 用于 `copyToInput` 追加/替换（唯一一对 `UpdateVariable` 闭合 tag）。
 * @param opts.patches 与本次说明同批的 op（如弹窗后 diff）；缺省为空数组
 * @param mode `replace`：以本批摘要（块外）+ 唯一变量块（仅 patch）替换整段，不保留原块与前方自由叙述（恢复发言等特判仍可在调用方用 bypass 绕过）
 * @param mode `append`：累加摘要（块外）与 op（块内）；保留原自由叙述
 */
export function mergeAppendOrReplaceUpdateVariableInInput(
  current: string,
  opts: {
    summary: string;
    patches?: TacticalMapCommitPatchOp[];
    mode: 'append' | 'replace';
  },
): string {
  const sum = String(opts.summary ?? '').trim();
  const newP = opts.patches ?? [];
  const m = opts.mode;
  const cur = String(current ?? '');

  if (m === 'replace') {
    if (!sum && newP.length === 0) return cur.trim();
    return formatMergedUpdateVariableBlock({ summary: sum || undefined, patches: newP });
  }

  if (!cur.trim()) {
    return formatMergedUpdateVariableBlock({ summary: sum || undefined, patches: newP });
  }
  const { freeText, fullBlocks } = splitFreeTextAndUpdateVariableBlocks(cur);
  const inners = fullBlocks.map(b => innerBodyOfUpdateVariableBlock(b));
  const prior = inners.length > 0 ? mergeInnersToSummaryAndPatches(inners) : { summary: '', patches: [] as TacticalMapCommitPatchOp[] };
  const nextSummary = [prior.summary, sum].map(s => s && s.trim()).filter(Boolean).join('\n\n').trim();
  const nextPatches: TacticalMapCommitPatchOp[] = [...prior.patches, ...newP];
  if (!fullBlocks.length) {
    const newBlock = formatMergedUpdateVariableBlock({ summary: nextSummary || undefined, patches: nextPatches });
    if (freeText && newBlock) return [freeText, newBlock].filter(Boolean).join('\n\n');
    return newBlock || cur;
  }
  const out = formatMergedUpdateVariableBlock({ summary: nextSummary || undefined, patches: nextPatches });
  if (!out) return cur;
  if (freeText) return [freeText, out].filter(Boolean).join('\n\n');
  return out;
}
