/**
 * 第二 API「世界演化」：在变量更新之外，根据正文与 stat 中多源上下文推断地图语义增量（区域/建筑/活动），
 * 生成 JSON Patch，并与主变量更新合并为同一段 &lt;UpdateVariable&gt; 内数组。
 *
 * 注意：本文件不 import `./apiSettings`，避免与 `processWithSecondaryApi` 内的动态 import 形成循环依赖。
 */

import type { SecondaryApiConfig } from '../types';
import { normalizeOpenAiUrl } from './openaiUrl';
import { VARIABLE_JSON_PATCH_RUNTIME_RULES } from './variableUpdatePromptExtras';

declare function generateRaw(config: unknown): Promise<string | undefined | null>;

const WORLD_EVOLUTION_MAX_TOKENS = 8192;

/** 与地图第二 API 同形：短上下文 generateRaw；不派发顶栏事件（嵌套在变量路内） */
async function generateWorldEvolutionRawOrdered(
  systemPrompt: string,
  userPrompt: string,
  config: SecondaryApiConfig,
  maxTokens: number,
): Promise<string> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用');
  }
  const cap = Math.min(65536, Math.max(256, Math.floor(maxTokens)));
  if (config.useTavernMainConnection) {
    const genConfig = {
      user_input: '',
      should_stream: false,
      should_silence: true,
      max_chat_history: 0,
      automatic_trigger: true,
      ordered_prompts: [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ],
      custom_api: {
        max_tokens: cap,
      },
    };
    return String((await generateRaw(genConfig)) ?? '');
  }
  if (!String(config.key || '').trim()) {
    throw new Error('第二 API Key 未配置');
  }
  const normalized = normalizeOpenAiUrl(config.url);
  const modelTrim = String(config.model || '').trim();
  const genConfig: Record<string, unknown> = {
    user_input: '',
    should_stream: false,
    should_silence: true,
    max_chat_history: 0,
    automatic_trigger: true,
    ordered_prompts: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    custom_api: {
      apiurl: normalized.base,
      key: config.key,
      source: 'openai',
      max_tokens: cap,
    },
  };
  if (modelTrim) {
    (genConfig.custom_api as Record<string, unknown>).model = modelTrim;
  }
  return String((await generateRaw(genConfig)) ?? '');
}

const WORLD_EVOLUTION_SYSTEM = `你是「世界演化 → 地图变量」协助模型，与「逐字段修角色数值」的常规变量更新**分工不同**。
你的任务：在读完**本回合正文**与**用户消息里附带的上下文摘录**后，判断地理与场所层面是否应发生**可见演化**；若应演化，输出**一段且仅一段** \`<UpdateVariable>…</UpdateVariable>\`，其内为 **RFC 6902 JSON 数组**（仅 replace / add / remove；禁止 delta / copy / merge）。

**创作边界（R18 / 破限 / 虚构向）**
- 输出仅用于用户自有虚构地图与剧情；允许在名称、描述、活动文案、在场人员等字段中出现虚构成人向、情色张力、恐怖暴力等描写，须与正文与上下文一致。
- 禁止煽动对真实个人/群体的仇恨；禁止现实违法操作教程。

**硬性规则**
- path 均相对于 **stat_data 根**，以 \`/\` 开头。
- **仅允许**操作 **/区域数据**、**/建筑数据**、**/活动数据** 下的路径；**禁止**修改角色档案、元信息、世界规则等其他路径。
- **禁止**用一条 replace 覆盖整个 \`/区域数据\`、\`/建筑数据\` 或 \`/活动数据\` 根对象；必须对**具体 id** 使用 add，或对**具体子路径**使用 replace/remove。
- 新建区域、建筑、活动时必须使用**全新** id（建议 REG-/BLD-/ACT- 前缀 + 时间戳），**禁止**与上下文中列出的已有 id 重复。
- 若你认为**无需**新增场所、无需改建筑描述或活动，可输出 \`<UpdateVariable>[]</UpdateVariable>\` 或仅含 \`[]\` 的等价块。
- 新建筑须含齐 MVU 所需字段：名称、描述、所属区域ID、内部房间布局（对象，可至少一间）、当前活动（对象，引用你在本 Patch 内新建的活动 id）、当前角色（对象，至少一人在场占位亦可）。
- 新活动须含：所在建筑ID、活动名称、活动内容、开始时间、参与者（对象）、状态（进行中|已结束|已取消）。
- 禁止输出标签外解释文字；禁止 \`<Analysis>\`。

${VARIABLE_JSON_PATCH_RUNTIME_RULES}`;

function truncate(s: string, max: number): string {
  const t = String(s ?? '');
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function sliceJson(obj: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(obj, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}\n…（已截断，共 ${s.length} 字）`;
  } catch {
    return '（无法序列化）';
  }
}

function buildCharacterMindContext(stat: Record<string, unknown>): Record<string, unknown> {
  const 角色档案 = (stat.角色档案 ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [id, raw] of Object.entries(角色档案)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    out[id] = {
      姓名: c.姓名,
      当前内心想法: truncate(String(c.当前内心想法 ?? ''), 500),
      当前位置: c.当前位置,
      当前综合生理描述: truncate(String(c.当前综合生理描述 ?? ''), 280),
    };
  }
  return out;
}

export function buildWorldEvolutionUserPrompt(maintext: string, stat: Record<string, unknown>): string {
  const meta = (stat.元信息 ?? {}) as Record<string, unknown>;
  const 游戏状态 = stat.游戏状态 ?? {};

  return `## 本回合正文（主 API &lt;maintext&gt;，世界演化的首要依据）
<maintext>
${maintext}
</maintext>

## 元信息（世界基调）
${sliceJson(
  {
    世界类型: meta.世界类型,
    世界简介: truncate(String(meta.世界简介 ?? ''), 900),
    当前阶段: meta.当前阶段,
    进度: meta.进度,
  },
  1400,
)}

## 游戏状态（含「世界大势」等宏观说明键时，可据此推断新场景、新设施）
${sliceJson(游戏状态, 4000)}

## 当前 区域数据 / 建筑数据 / 活动数据（已有 id 禁止占用；可在此基础 add 或细粒度 replace）
### 区域数据
${sliceJson(stat.区域数据 ?? {}, 7000)}
### 建筑数据
${sliceJson(stat.建筑数据 ?? {}, 14000)}
### 活动数据
${sliceJson(stat.活动数据 ?? {}, 7000)}

## 角色档案摘录（内心想法、位置、生理描述 — 常含地名、想去某处、对某建筑的印象，可触发新区域/建筑）
${sliceJson(buildCharacterMindContext(stat), 14000)}

## 你的任务（再次强调）
1. 综合正文、世界简介、游戏状态、角色内心与位置等，判断**地图语义**是否应演化（新地点、新建筑、新活动、或对已有建筑/活动的合理增补）。
2. 若需要演化：仅输出针对 **/区域数据**、**/建筑数据**、**/活动数据** 的 **JSON Patch 数组**（包在 \`<UpdateVariable>…</UpdateVariable>\` 内）；**不要**整表 replace 三个根键。
3. 若不需要：输出空数组 \`[]\` 的 \`<UpdateVariable>\` 块即可。`;
}

function tryParseJsonPatchArrayFromInner(inner: string): unknown[] | null {
  const t = inner.trim();
  const jp = t.match(/^<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
  const jsonStr = jp ? jp[1].trim() : t;
  try {
    const v = JSON.parse(jsonStr) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * 合并两段「UpdateVariable 标签内部」的 Patch 文本（通常为 JSON 数组或 &lt;JSONPatch&gt; 包裹的数组）。
 */
export function mergeVariableUpdateJsonPatchInners(primary: string, secondary: string): string {
  const a = tryParseJsonPatchArrayFromInner(primary);
  const b = tryParseJsonPatchArrayFromInner(secondary);
  if (a === null && b === null) return primary.trim();
  if (a === null) return (b?.length ?? 0) > 0 ? secondary.trim() : primary.trim();
  if (b === null || b.length === 0) return primary.trim();
  return JSON.stringify([...a, ...b], null, 2);
}

function extractEvolutionPatchInner(raw: string): string | null {
  const m = String(raw || '').match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i);
  if (m) return m[1].trim();
  let t = String(raw || '').trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) t = fence[1].trim();
  const arr = t.match(/\[[\s\S]*\]/);
  if (!arr) return null;
  try {
    const v = JSON.parse(arr[0]) as unknown;
    return Array.isArray(v) ? arr[0].trim() : null;
  } catch {
    return null;
  }
}

/**
 * 调用第二 API 生成世界演化 Patch；返回 **UpdateVariable 内部** 字符串（不含外层标签），失败抛错。
 */
export async function runWorldEvolutionSecondaryApi(
  maintext: string,
  config: SecondaryApiConfig,
  stat: Record<string, unknown>,
): Promise<string | null> {
  const user = buildWorldEvolutionUserPrompt(maintext, stat);
  const raw = await generateWorldEvolutionRawOrdered(WORLD_EVOLUTION_SYSTEM, user, config, WORLD_EVOLUTION_MAX_TOKENS);
  const inner = extractEvolutionPatchInner(raw);
  if (inner == null || inner === '') {
    console.warn('[worldEvolutionSecondaryApi] 模型未返回可解析的 <UpdateVariable> Patch');
    return null;
  }
  const arr = tryParseJsonPatchArrayFromInner(inner);
  if (arr && arr.length === 0) {
    return null;
  }
  return inner;
}
