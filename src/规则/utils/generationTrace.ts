/**
 * 记录「一轮」内界面侧可见的 generate / generateRaw 调用，供导出调试 txt。
 * 说明：不包含酒馆主进程拼好的完整 messages[]（generate 未回传）；仅记录调用方传入的配置摘要与模型返回字符串。
 */

const TRACE_MAX_FIELD_CHARS = 350_000;

export type GenerationTraceApiKind = 'generate' | 'generateRaw';

export interface GenerationTraceStep {
  index: number;
  name: string;
  api: GenerationTraceApiKind;
  /** 毫秒 */
  durationMs: number;
  /** 已截断、可 JSON 序列化的请求摘要 */
  request: unknown;
  /** 模型返回全文（可能截断） */
  response?: string;
  error?: string;
}

export interface GenerationTraceRound {
  startedAtIso: string;
  committedAtIso: string;
  source?: string;
  /** 用户侧输入预览（如 user_input 或等价） */
  userPreview?: string;
  steps: GenerationTraceStep[];
}

let stepSeq = 0;
let roundMeta: { startedAtIso: string; source?: string; userPreview?: string } | null = null;
const workingSteps: GenerationTraceStep[] = [];
let lastRound: GenerationTraceRound | null = null;

function truncateText(s: string, max = TRACE_MAX_FIELD_CHARS): string {
  const t = String(s ?? '');
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n…（已截断，原长 ${t.length} 字符）`;
}

/** 脱敏 custom_api 中的 key */
function redactCustomApi(api: unknown): unknown {
  if (!api || typeof api !== 'object') return api;
  const o = { ...(api as Record<string, unknown>) };
  if (typeof o.key === 'string' && o.key.length > 0) {
    o.key = '***';
  }
  return o;
}

/**
 * 摘要主 `generate` 配置（无法包含酒馆合并后的完整 prompt）。
 */
export function summarizeGenerateConfig(config: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const c = config as Record<string, unknown>;
  const out: Record<string, unknown> = {
    user_input: typeof c.user_input === 'string' ? truncateText(c.user_input) : c.user_input,
    should_stream: c.should_stream,
    should_silence: c.should_silence,
    generation_id: c.generation_id,
    max_chat_history: c.max_chat_history,
    automatic_trigger: c.automatic_trigger,
  };
  if (c.custom_api != null) out.custom_api = redactCustomApi(c.custom_api);
  if (c.injects != null) out.injects = c.injects;
  if (c.overrides != null) out.overrides = c.overrides;
  if (c.json_schema != null) out.json_schema = '[present]';
  return out;
}

/**
 * 摘要 `generateRaw` 的 ordered_prompts（保留全文但单字段截断）。
 */
export function summarizeGenerateRawConfig(config: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const c = config as Record<string, unknown>;
  const ordered = c.ordered_prompts;
  let promptsSummary: unknown = ordered;
  if (Array.isArray(ordered)) {
    promptsSummary = ordered.map((p: unknown) => {
      if (p && typeof p === 'object' && 'role' in p && 'content' in p) {
        const pr = p as { role?: string; content?: string };
        return {
          role: pr.role,
          content: truncateText(String(pr.content ?? '')),
        };
      }
      return p;
    });
  }
  return {
    user_input: typeof c.user_input === 'string' ? truncateText(c.user_input) : c.user_input,
    should_stream: c.should_stream,
    should_silence: c.should_silence,
    max_chat_history: c.max_chat_history,
    automatic_trigger: c.automatic_trigger,
    ordered_prompts: promptsSummary,
    custom_api: c.custom_api != null ? redactCustomApi(c.custom_api) : undefined,
  };
}

function stringifyResult(res: unknown): string {
  if (typeof res === 'string') return truncateText(res);
  try {
    return truncateText(JSON.stringify(res, null, 2));
  } catch {
    return truncateText(String(res));
  }
}

/**
 * 新一轮生成开始前调用（会清空工作区；不自动把上一轮写入 last，由 commit 完成）。
 */
export function beginTraceRound(meta?: { source?: string; userPreview?: string }): void {
  stepSeq = 0;
  workingSteps.length = 0;
  roundMeta = {
    startedAtIso: new Date().toISOString(),
    source: meta?.source,
    userPreview: meta?.userPreview != null ? truncateText(String(meta.userPreview), 20_000) : undefined,
  };
}

/**
 * 追加一步（若未 begin 则忽略，避免污染）。
 */
export function recordTraceStep(step: {
  name: string;
  api: GenerationTraceApiKind;
  request: unknown;
  response?: string;
  error?: string;
  durationMs: number;
}): void {
  if (!roundMeta) return;
  const idx = ++stepSeq;
  workingSteps.push({
    index: idx,
    name: step.name,
    api: step.api,
    durationMs: step.durationMs,
    request: step.request,
    response: step.response != null ? truncateText(step.response) : undefined,
    error: step.error,
  });
}

/**
 * 将当前工作区写入「上一轮」快照并清空工作区。
 */
export function commitTraceRound(): void {
  if (!roundMeta) {
    roundMeta = null;
    workingSteps.length = 0;
    return;
  }
  lastRound = {
    startedAtIso: roundMeta.startedAtIso,
    committedAtIso: new Date().toISOString(),
    source: roundMeta.source,
    userPreview: roundMeta.userPreview,
    steps: workingSteps.map(s => ({ ...s })),
  };
  roundMeta = null;
  workingSteps.length = 0;
}

export function getLastTraceRound(): GenerationTraceRound | null {
  return lastRound;
}

export function formatTraceRoundAsTxt(round: GenerationTraceRound | null = lastRound): string {
  if (!round) {
    return '（尚无已提交的生成追踪：请先完成一轮对话生成，或确认已调用 beginTraceRound → commitTraceRound）\n';
  }
  const lines: string[] = [];
  lines.push('=== 规则界面 · 上一轮 AI 调用追踪 ===');
  lines.push(`来源: ${round.source ?? '（未标注）'}`);
  lines.push(`开始: ${round.startedAtIso}`);
  lines.push(`提交: ${round.committedAtIso}`);
  if (round.userPreview) {
    lines.push('');
    lines.push('--- 用户侧输入预览 ---');
    lines.push(round.userPreview);
  }
  lines.push('');
  lines.push(`共 ${round.steps.length} 次调用`);
  lines.push('');

  for (const s of round.steps) {
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`#${s.index}  ${s.name}`);
    lines.push(`API: ${s.api}   耗时: ${s.durationMs} ms`);
    lines.push('');
    lines.push('--- 请求（摘要 / 本进程传入配置）---');
    try {
      lines.push(JSON.stringify(s.request, null, 2));
    } catch {
      lines.push(String(s.request));
    }
    lines.push('');
    if (s.error) {
      lines.push('--- 错误 ---');
      lines.push(s.error);
    } else {
      lines.push('--- 模型返回 ---');
      lines.push(s.response ?? '（空）');
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function downloadTraceTextFile(text: string, filename?: string): void {
  const safe =
    filename?.replace(/[^\w\u4e00-\u9fa5\-_.]/g, '_') ||
    `规则-生成追踪-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadLastTraceRoundTxt(): boolean {
  if (!lastRound) {
    return false;
  }
  downloadTraceTextFile(formatTraceRoundAsTxt(lastRound));
  return true;
}

/** 包装一次 generate，自动记录 */
export async function traceWrappedGenerate(
  stepName: string,
  genConfig: Record<string, unknown>,
  exec: () => Promise<unknown>,
): Promise<unknown> {
  const t0 = Date.now();
  const req = summarizeGenerateConfig(genConfig);
  try {
    const res = await exec();
    recordTraceStep({
      name: stepName,
      api: 'generate',
      request: req,
      response: stringifyResult(res),
      durationMs: Date.now() - t0,
    });
    return res;
  } catch (e) {
    recordTraceStep({
      name: stepName,
      api: 'generate',
      request: req,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - t0,
    });
    throw e;
  }
}

/** 包装一次 generateRaw，自动记录 */
export async function traceWrappedGenerateRaw(
  stepName: string,
  genConfig: Record<string, unknown>,
  exec: () => Promise<unknown>,
): Promise<unknown> {
  const t0 = Date.now();
  const req = summarizeGenerateRawConfig(genConfig);
  try {
    const res = await exec();
    recordTraceStep({
      name: stepName,
      api: 'generateRaw',
      request: req,
      response: stringifyResult(res),
      durationMs: Date.now() - t0,
    });
    return res;
  } catch (e) {
    recordTraceStep({
      name: stepName,
      api: 'generateRaw',
      request: req,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - t0,
    });
    throw e;
  }
}
