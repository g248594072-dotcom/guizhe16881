/**
 * 招募式新增角色：`generateRaw` 短上下文（无酒馆整卡预设）→ 解析 `<companion>` → 映射 `角色档案` 并 Schema 校验。
 */
import { klona } from 'klona';
import { z } from 'zod';
import { Schema } from '../schema';
import { clothingStateFromMvuRaw, createEmptyCharacterRecord } from './dialogAndVariable';
import { allocateNextChrId } from './chrId';
import { traceWrappedGenerateRaw } from './generationTrace';
import {
  normalizeFetishRecord,
  normalizeHobbyRecord,
  normalizeRepresentativeSpeechRecord,
  normalizeSensitivePartRecord,
} from './tagMap';
import { RECRUIT_MVU_CHARACTER_ARCHIVE_SHAPE_ZH } from './recruitCharacterArchiveShapeZh';

type GameRoot = z.infer<typeof Schema>;

export const RECRUIT_COMPANION_CANDIDATE_COUNT = 5;

/** 与 `<companion>` 内每段「候选人:」后的字段顺序一致；其中 爱好 / 性癖 / 敏感点开发 / 服装状态 / 代表性发言 为单行 JSON（见系统提示） */
export const FIELD_KEYS = [
  '名字',
  '标签',
  '年龄',
  '情感状况',
  '一句话介绍',
  '简介',
  '爱好',
  '隐藏性癖',
  '性癖',
  '敏感点开发',
  '服装状态',
  '代表性发言',
] as const;

export type RecruitFieldKey = (typeof FIELD_KEYS)[number];

export interface CompanionCandidateRecord {
  名字: string;
  标签: string;
  年龄: string;
  情感状况: string;
  一句话介绍: string;
  简介: string;
  爱好: string;
  隐藏性癖: string;
  /** 单行 JSON：`Record<性癖标签名, { 等级, 细节描述, 自我合理化 }>` */
  性癖: string;
  /** 单行 JSON：`Record<名称, { 敏感等级, 生理反应, 开发细节 }>`，与 MVU「敏感点开发」同形 */
  敏感点开发: string;
  /** 单行 JSON：与 MVU「服装状态」同形（上装/下装/内衣/腿部/足部/饰品） */
  服装状态: string;
  /** 单行 JSON：`Record<场景或语境标识, 台词>`，与 MVU「代表性发言」同形 */
  代表性发言: string;
}

/** 简介前若干字拼入「描写」，与一句话介绍组合，避免与角色简介全文重复 */
const RECRUIT_DESCRIPTION_INTRO_SLICE = 400;

function buildRecruitMergedDescription(oneLiner: string, introFull: string): string {
  const one = String(oneLiner ?? '').trim();
  const intro = String(introFull ?? '').trim();
  const slice =
    intro.length > RECRUIT_DESCRIPTION_INTRO_SLICE
      ? `${intro.slice(0, RECRUIT_DESCRIPTION_INTRO_SLICE)}…`
      : intro;
  if (one && slice) return `${one}\n${slice}`;
  return one || slice || '';
}

function buildRecruitSystemPrompt(): string {
  const n = String(RECRUIT_COMPANION_CANDIDATE_COUNT);
  const keyList = FIELD_KEYS.join('、');
  const m = String(FIELD_KEYS.length);
  return [
    '# 角色',
    '你是「招募候选人名单」生成器，输出将写入虚构作品的变量系统。所有人物均为虚构。',
    '',
    '# 输出契约（违反则任务失败）',
    '- 回复中**只能**出现一对标签：<companion> … </companion>，前后不要有任何其它字符。',
    '- 禁止：Markdown 标题或代码块、自我介绍、确认收到、翻译、正文块（maintext/content）、选项（choice）、摘要（sum）、<UpdateVariable>。',
    '- **禁止**用 JSON 作为整条回复的根格式；但下列字段的值**必须是写在英文双引号内的一行 JSON 文本**（见下文「JSON 五字段」）。',
    '- 标签内恰好 ' +
      n +
      ' 位候选人；每位必须以单独一行「候选人:」起头（行首），再跟 ' +
      m +
      ' 行字段（每行一个键）。**不要**写成 `候选人: "姓名"` 与「名字」合并；应写 `候选人:` 单独一行后接 `名字: "姓名"`（若误写成 `候选人: "姓名"`，下一行须从 `标签:` 起，解析器会从引号行取回姓名）。',
    '- 每行格式：字段名: "值" —— 值必须用英文直引号 " 包裹；**值内禁止换行**；值内出现英文双引号时**一律**写成 `\\"`（含 JSON 五字段里**每一个**键名、字符串值的引号），否则整段会解析失败。',
    '- ' + m + ' 键顺序必须严格如下（键名与冒号后空格须与示例一致）：' + keyList + '。',
    '- 正确示例（节选排版；五行 JSON 行内为 minify，注意 \\"）：',
    '  候选人:',
    '  名字: "小春"',
    '  标签: "活泼/短发/田径社"',
    '  …',
    '  爱好: "{\\"晨跑\\":{\\"等级\\":7,\\"喜欢的原因\\":\\"独处与节奏感\\"}}"',
    '  性癖: "{\\"羞耻\\":{\\"等级\\":2,\\"细节描述\\":\\"……\\",\\"自我合理化\\":\\"……\\"}}"',
    '  代表性发言: "{\\"被婉拒后\\":\\"……\\"}"',
    '- 标签：恰好三个词或短语，用英文斜杠 / 分隔，体现性格或身份维度。',
    '- 一句话介绍：单行梗概，用于列表展示；建议 8～36 个汉字（或等效长度），与「简介」不得重复堆砌；禁止写成多句。',
    '- 简介：展开型角色小传，须更具体、更有画面：日常习惯、人际钩子、可扮演细节、与用户「角色简介」等说明相呼应；建议 2～4 句、总长度约 120～400 字（仍须写在一对引号内、不换行）。',
    '- **爱好（JSON 行）**：\`Record<标签名,{\\"等级\\":1-10,\\"喜欢的原因\\":\\"...\\"}>\`，**至少一条**爱好键；须与性兴奋无关的日常兴趣。凡能引发性兴奋的偏好写在「性癖」JSON，不得写在爱好 JSON。',
    '- **隐藏性癖**：普通字符串（可为空串 `""`），写角色未明说、与表层人设反差或压抑的欲望侧写；与「性癖」JSON 中已写明的条目不得简单重复堆砌。',
    '',
    '# JSON 五字段（须单行 minify，键名与 MVU 一致）',
    '- **性癖**：JSON 对象，形如 `{"标签名":{"等级":3,"细节描述":"……","自我合理化":"……"}}`。键为性癖标签名；`等级` 为 0～10 的整数；`细节描述` 写具体可扮演表现；`自我合理化` 写角色如何自发认可自己会对该点产生性兴奋。**至少一条**键。',
    '- **敏感点开发**：JSON 对象，形如 `{"后颈":{"敏感等级":2,"生理反应":"……","开发细节":"……"}}`。键为部位或称呼；`敏感等级` 为非负整数；`生理反应`、`开发细节` 为字符串。**至少一条**键。',
    '- **服装状态**：JSON 对象，顶层键须包含 **上装、下装、内衣、腿部、足部、饰品**（可为空对象 `{}`）。',
    '  - 上装/下装/内衣/腿部/足部：各为 `{ "服装名": { "状态": "正常", "描述": "……" } }`，服装名为对象键。',
    '  - 饰品：`{ "饰品名": { "部位": "关联身体部位，可写未知", "状态": "正常", "描述": "……" } }`。',
    '- 上述 JSON 写在行的双引号内时，JSON 里的每个 `"` 必须写成 `\\"`，且**不要**在 JSON 内换行。',
    '',
    '# 内容与尺度',
    '- 根据用户招募说明（含名字、关系、角色简介等）设计外貌、职业、气质与剧情钩子；五位之间要有明显差异（年龄层、性格、职业/来历、与说明契合度等至少两维不同）。',
    '- **代表性发言（JSON 行）**：\`Record<场景或语境标识, \\"台词\\">\`，**至少一条**键。',
    '- **成人向（R18）**：若用户需求涉及情色、性暗示、肉体描写、支配/服从、成人关系等，允许在「简介」「性癖」「敏感点开发」「服装状态」「代表性发言」JSON 的文案中写入与需求强度匹配的露骨虚构描写；「爱好」JSON 仍须非性化日常兴趣。若需求明显全年龄：性癖/敏感点暧昧暗示，爱好可正常写。',
    '- 世界观：尊重用户给出的世界类型与地点摘要；不要编造与摘要冲突的硬设定。',
    '',
    '# 禁忌与偏好',
    '- 除非用户明确要求，否则姓名避免出现姓氏：林、苏、顾、柳、赵、慕容、夏、安。',
    '- 避免「潘驴邓小闲」式油腻男凝与空洞「霸总/王者」符号堆叠；角色要有可扮演细节。',
    '- 候选人处于「应征名单」阶段：不要写其已认识玩家或已知玩家隐私。',
    '',
    '# MVU 角色档案（合并后须符合）',
    RECRUIT_MVU_CHARACTER_ARCHIVE_SHAPE_ZH,
    '',
    '# 自检',
    '输出前确认：仅一对 companion、内部 ' +
      n +
      ' 段「候选人:」、每段 ' +
      m +
      ' 键齐全且带引号、顺序与键名无误；「爱好」与「性癖」JSON 不得混写；**爱好、性癖、敏感点开发、服装状态、代表性发言** 五行 JSON 均可被 `JSON.parse` 解析。',
  ].join('\n');
}

function buildRecruitUserPrompt(userBrief: string, worldSummary: string): string {
  const b = String(userBrief ?? '').trim();
  const w = String(worldSummary ?? '').trim();
  const lines: string[] = [];
  lines.push('请根据下列信息生成招募候选人名单。');
  lines.push('');
  lines.push('【招募说明】');
  lines.push(b || '（未填写：请生成五种不同气质、可进入同一世界观的虚构女性或男性或混合名单，由你合理假设。）');
  if (w) {
    lines.push('');
    lines.push('【当前世界与地点摘要】（供你统一时代感与用语）');
    lines.push(w);
  }
  lines.push('');
  lines.push(
    '现在只输出 <companion>...</companion>，内含恰好 ' +
      String(RECRUIT_COMPANION_CANDIDATE_COUNT) +
      ' 位「候选人:」块，格式与系统说明一致。',
  );
  return lines.join('\n');
}

/** 从 MVU 根数据拼短摘要，控制长度 */
export function buildWorldContextSummaryForRecruit(data: GameRoot, maxChars = 1800): string {
  const parts: string[] = [];
  const meta = data.元信息;
  if (meta) {
    const t = String(meta.世界类型 ?? '').trim();
    const intro = String(meta.世界简介 ?? '').trim().slice(0, 600);
    if (t || intro) parts.push(`世界类型：${t || '（未填）'}\n世界简介：${intro || '（未填）'}`);
  }
  const regs = data.区域数据 ?? {};
  const regKeys = Object.keys(regs).slice(0, 6);
  for (const k of regKeys) {
    const r = regs[k] as { 名称?: string; 描述?: string } | undefined;
    if (!r) continue;
    const n = String(r.名称 ?? k).trim();
    const d = String(r.描述 ?? '').trim().slice(0, 200);
    parts.push(`区域 ${k}：${n}${d ? ` — ${d}` : ''}`);
  }
  const blds = data.建筑数据 ?? {};
  const bldKeys = Object.keys(blds).slice(0, 8);
  for (const k of bldKeys) {
    const b = blds[k] as { 名称?: string; 描述?: string; 所属区域ID?: string } | undefined;
    if (!b) continue;
    const n = String(b.名称 ?? k).trim();
    const d = String(b.描述 ?? '').trim().slice(0, 160);
    const rid = String(b.所属区域ID ?? '').trim();
    parts.push(`建筑 ${k}：${n}${rid ? `（区域 ${rid}）` : ''}${d ? ` — ${d}` : ''}`);
  }
  let out = parts.join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars) + '\n…（已截断）';
  return out;
}

export function extractCompanionInner(raw: string): string | null {
  const full = String(raw ?? '').trim();
  let t = full;
  const fence = t.match(/^```(?:xml|text|markdown)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fence) t = fence[1].trim();
  let m = t.match(/<companion\b[^>]*>([\s\S]*?)<\/companion>/i);
  if (m) return m[1].trim();
  m = full.match(/<companion\b[^>]*>([\s\S]*?)<\/companion>/i);
  return m ? m[1].trim() : null;
}

function unescapeQuoted(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function reEscapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 从「当前键的 opening quote 之后」扫描到闭合 `"`（尊重 `\\"`） */
function scanClosingDoubleQuote(remainder: string): string | undefined {
  let i = 0;
  let acc = '';
  while (i < remainder.length) {
    const c = remainder[i];
    if (c === '\\' && i + 1 < remainder.length) {
      acc += c + remainder[i + 1];
      i += 2;
      continue;
    }
    if (c === '"') {
      return unescapeQuoted(acc);
    }
    acc += c;
    i++;
  }
  return undefined;
}

/**
 * 提取 `键: "值"`：优先用「下一键的行首」作为结束边界，避免 JSON 值内未转义的 `"` 导致截断。
 * 约定各键顺序与 FIELD_KEYS 一致。
 */
function extractFieldByNextKey(block: string, keyIndex: number): string | undefined {
  const key = FIELD_KEYS[keyIndex];
  const prefix = new RegExp(`^${reEscapeForRegex(key)}\\s*:\\s*"`, 'm');
  const m = block.match(prefix);
  if (!m || m.index === undefined) return undefined;
  const absStart = m.index + m[0].length;
  const remainder = block.slice(absStart);
  const nextIdx = keyIndex + 1;
  if (nextIdx >= FIELD_KEYS.length) {
    return scanClosingDoubleQuote(remainder);
  }
  const nextK = FIELD_KEYS[nextIdx];
  const sep = new RegExp(`\\r?\\n${reEscapeForRegex(nextK)}\\s*:\\s*"`);
  const nx = remainder.match(sep);
  if (nx && nx.index !== undefined) {
    const chunk = remainder.slice(0, nx.index);
    if (!chunk.endsWith('"')) return undefined;
    return unescapeQuoted(chunk.slice(0, -1));
  }
  return scanClosingDoubleQuote(remainder);
}

/**
 * 模型偶发写出 `{"键"` 而漏写 `{\"键"`（在整行外层引号内），JSON.parse 会失败；此处按对象边界补反斜杠，最多迭代数次。
 */
function repairLooseJsonObjectKeyQuotes(jsonish: string): string {
  let cur = jsonish;
  for (let p = 0; p < 8; p++) {
    const next = cur.replace(/\{\s*"/g, sub => `${sub.slice(0, -1)}\\"`);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

function tryParseJsonObjectString(raw: string): Record<string, unknown> | null {
  const s0 = String(raw ?? '').trim();
  if (!s0) return null;
  const candidates = [s0, repairLooseJsonObjectKeyQuotes(s0)];
  for (const s of candidates) {
    try {
      const v = JSON.parse(unescapeQuoted(s)) as unknown;
      if (v != null && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** 供 UI 在简介区附带一句人类可读的穿搭摘要 */
export function summarizeClothingStateJsonForBio(jsonStr: string): string {
  const o = tryParseJsonObjectString(jsonStr);
  if (!o) return '';
  const norm = clothingStateFromMvuRaw(o);
  const parts: string[] = [];
  const bodySlots = ['上装', '下装', '内衣', '腿部', '足部'] as const;
  for (const slot of bodySlots) {
    const rec = norm[slot];
    if (!rec || typeof rec !== 'object') continue;
    for (const [name, row] of Object.entries(rec)) {
      const nm = String(name).trim();
      if (!nm) continue;
      const desc = String((row as { 描述?: string })?.描述 ?? '').trim();
      parts.push(desc ? `${nm}（${slot}）：${desc}` : `${nm}（${slot}）`);
      if (parts.length >= 5) return parts.join('；');
    }
  }
  const jew = norm.饰品;
  if (jew && typeof jew === 'object') {
    for (const [name, row] of Object.entries(jew)) {
      const nm = String(name).trim();
      if (!nm) continue;
      const 部位 = String((row as { 部位?: string })?.部位 ?? '').trim();
      const desc = String((row as { 描述?: string })?.描述 ?? '').trim();
      parts.push(部位 ? `${nm}（${部位}）${desc ? `：${desc}` : ''}` : `${nm}${desc ? `：${desc}` : ''}`);
      if (parts.length >= 5) break;
    }
  }
  return parts.join('；');
}

/**
 * 从单个候选人文本块解析各字段。
 * 兼容「候选人:」后首行为 `"姓名"` 再接 `标签:`（模型常误把姓名写在候选人行）。
 */
export function parseOneCandidateBlock(block: string): Partial<CompanionCandidateRecord> {
  let body = block.trim();
  /** `候选人: "桃绘"\n` 去掉头后得到 `"桃绘"\n标签:...` */
  const inlineNameMatch = body.match(/^"((?:[^"\\]|\\.)*)"\s*\r?\n/);
  if (inlineNameMatch) {
    body = body.slice(inlineNameMatch[0].length).trim();
  }
  const out: Partial<CompanionCandidateRecord> = {};
  FIELD_KEYS.forEach((_, idx) => {
    const v = extractFieldByNextKey(body, idx);
    if (v !== undefined) (out as Record<string, string>)[FIELD_KEYS[idx]] = v;
  });
  const nameFromLine = String(out['名字'] ?? '').trim();
  if (!nameFromLine && inlineNameMatch) {
    out['名字'] = unescapeQuoted(inlineNameMatch[1]);
  }
  return out;
}

function isJsonObjectString(s: string): boolean {
  const t = String(s).trim();
  if (!t.startsWith('{')) return false;
  return tryParseJsonObjectString(t) != null;
}

function isCompleteCandidate(p: Partial<CompanionCandidateRecord>): p is CompanionCandidateRecord {
  for (const k of FIELD_KEYS) {
    const v = p[k];
    if (v == null) return false;
    if (k === '隐藏性癖') {
      if (typeof v !== 'string') return false;
      continue;
    }
    if (k === '性癖' || k === '敏感点开发' || k === '服装状态' || k === '爱好' || k === '代表性发言') {
      const s = String(v).trim();
      if (!s || !isJsonObjectString(s)) return false;
      const obj = tryParseJsonObjectString(s);
      if (!obj) return false;
      if (k === '性癖' && Object.keys(normalizeFetishRecord(obj)).length === 0) return false;
      if (k === '敏感点开发' && Object.keys(normalizeSensitivePartRecord(obj)).length === 0) return false;
      if (k === '爱好' && Object.keys(normalizeHobbyRecord(obj)).length === 0) return false;
      if (k === '代表性发言' && Object.keys(normalizeRepresentativeSpeechRecord(obj)).length === 0) return false;
      continue;
    }
    if (!String(v).trim()) return false;
  }
  return true;
}

/**
 * 解析 companion 内文为候选人列表；要求恰好 5 位且字段齐全，否则抛出 Error。
 */
export function parseCompanionCandidates(inner: string): CompanionCandidateRecord[] {
  const text = String(inner ?? '').trim();
  const segments = text.split(/(?=^候选人\s*:)/im).map(s => s.trim()).filter(Boolean);
  const list: CompanionCandidateRecord[] = [];
  for (const seg of segments) {
    const block = seg.replace(/^候选人\s*:\s*/i, '').trim();
    if (!block) continue;
    const p = parseOneCandidateBlock(block);
    if (isCompleteCandidate(p)) list.push(p);
  }
  if (list.length !== RECRUIT_COMPANION_CANDIDATE_COUNT) {
    throw new Error(
      `候选人数量应为 ${RECRUIT_COMPANION_CANDIDATE_COUNT}，实际解析到 ${list.length}。请检查：① 每位以「候选人:」分段；② 每段含 ${String(FIELD_KEYS.length)} 行「键: 英文双引号包裹的值」且键名在行首；③ 推荐「候选人:」单独一行后接「名字: …」，勿只写「候选人: 姓名」；④ 爱好、性癖、敏感点开发、服装状态、代表性发言 五行须为单行合法 JSON，且 JSON 中的每个英文双引号在整行值内均已写成反斜杠加引号转义。`,
    );
  }
  return list;
}

export function mergeCandidateIntoCharacterEntry(
  c: CompanionCandidateRecord,
  recruitBrief: string,
): Record<string, unknown> {
  const name = String(c.名字 ?? '').trim() || '未命名';
  const oneLiner = String(c.一句话介绍 ?? '').trim();
  const introFull = String(c.简介 ?? '').trim();
  const mergedDesc = buildRecruitMergedDescription(oneLiner, introFull);
  const base = createEmptyCharacterRecord(name, mergedDesc) as Record<string, unknown>;

  /** 招募「简介」全文进入 MVU「角色简介」；「描写」为一句话介绍 + 简介前段（见 buildRecruitMergedDescription） */
  base.角色简介 = introFull;

  if (recruitBrief.trim()) {
    base.当前内心想法 = `【招募说明】${recruitBrief.trim()}`;
  }

  base.隐藏性癖 = String(c.隐藏性癖 ?? '').trim();

  const hobbyObj = tryParseJsonObjectString(c.爱好);
  if (hobbyObj) base.爱好 = normalizeHobbyRecord(hobbyObj);

  const speechObj = tryParseJsonObjectString(c.代表性发言);
  if (speechObj) base.代表性发言 = normalizeRepresentativeSpeechRecord(speechObj);

  const fetObj = tryParseJsonObjectString(c.性癖);
  if (fetObj) base.性癖 = normalizeFetishRecord(fetObj);

  const sensObj = tryParseJsonObjectString(c.敏感点开发);
  if (sensObj) base.敏感点开发 = normalizeSensitivePartRecord(sensObj);

  const clothObj = tryParseJsonObjectString(c.服装状态);
  if (clothObj) base.服装状态 = clothingStateFromMvuRaw(clothObj);

  const ageStr = String(c.年龄 ?? '').replace(/[^\d]/g, '');
  const ageNum = parseInt(ageStr, 10);
  if (Number.isFinite(ageNum) && ageNum > 0 && ageNum < 200) {
    (base.身体信息 as Record<string, unknown>).年龄 = ageNum;
  }
  const tags = String(c.标签 ?? '')
    .split(/[/／、,，]/)
    .map(s => s.trim())
    .filter(Boolean);
  const 身份标签: Record<string, string> = { ...(base.身份标签 as Record<string, string>) };
  tags.slice(0, 8).forEach((t, i) => {
    身份标签[`招募标签${i + 1}`] = t;
  });
  base.身份标签 = 身份标签;
  return base;
}

/** 十二字段 + 多段 JSON，略提高上限以降低截断概率 */
const RECRUIT_GENERATE_RAW_MAX_TOKENS = 12288;

/**
 * 使用 `generateRaw` + `ordered_prompts`，不拼接酒馆角色卡/世界书/聊天预设，避免被「正文四件套」格式带偏。
 */
export async function generateCompanionRecruitBlock(
  userBrief: string,
  worldSummary: string,
): Promise<string> {
  const systemPrompt = buildRecruitSystemPrompt();
  const userPrompt = buildRecruitUserPrompt(userBrief, worldSummary);
  const genConfig: Parameters<typeof generateRaw>[0] = {
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
      max_tokens: RECRUIT_GENERATE_RAW_MAX_TOKENS,
    },
  };
  const result = (await traceWrappedGenerateRaw(
    '角色招募·候选人 generateRaw',
    genConfig as unknown as Record<string, unknown>,
    () => generateRaw(genConfig),
  )) as string;
  return String(result ?? '').trim();
}

export interface CommitRecruitSelectionOptions {
  /** 当前完整 MVU 根（通常 `useDataStore().data`） */
  rootData: GameRoot;
  /** 候选人下标（任意数量，须均在 `candidates` 范围内） */
  candidateIndices: number[];
  candidates: CompanionCandidateRecord[];
  recruitBrief: string;
}

/**
 * 将选中候选人写入 `rootData.角色档案` 的新 CHR 键；返回每步的 safeParse 错误信息或 null。
 * 不在此函数内写 Pinia；调用方应把返回的 `rootData` 合并回 store 或逐条赋值。
 */
export function buildRootWithNewCharacters(
  opts: CommitRecruitSelectionOptions,
): { ok: true; data: GameRoot; newIds: string[] } | { ok: false; error: string; zodMessage?: string } {
  const { candidates, recruitBrief } = opts;
  const idxs = [...new Set(opts.candidateIndices)]
    .filter(i => i >= 0 && i < candidates.length)
    .sort((a, b) => a - b);
  if (idxs.length === 0) return { ok: false, error: '请至少选择一位候选人。' };

  const draft = klona(opts.rootData) as GameRoot;
  const newIds: string[] = [];

  for (const idx of idxs) {
    const id = allocateNextChrId(draft.角色档案 as Record<string, unknown>);
    if (!id) {
      return { ok: false, error: '角色档案已达 CHR-999 上限，无法继续新增。' };
    }
    const merged = mergeCandidateIntoCharacterEntry(candidates[idx], recruitBrief);
    draft.角色档案 = { ...(draft.角色档案 ?? {}), [id]: merged } as GameRoot['角色档案'];
    newIds.push(id);
  }

  const parsed = Schema.safeParse(draft);
  if (!parsed.success) {
    return {
      ok: false,
      error: '写入前校验失败：数据不符合 MVU Schema。',
      zodMessage: parsed.error.message,
    };
  }
  return { ok: true, data: parsed.data, newIds };
}

export type RecruitPatchTextResult =
  | { ok: true; text: string; newIds: string[] }
  | { ok: false; error: string; zodMessage?: string };

/**
 * 将选中候选人拼成可粘贴的 `<UpdateVariable><JSONPatch>` 文本（不写 Pinia、不写入消息层变量）。
 */
export function buildRecruitUpdateVariablePatchText(opts: CommitRecruitSelectionOptions): RecruitPatchTextResult {
  const built = buildRootWithNewCharacters(opts);
  if (!built.ok) return built;

  const patchOps: unknown[] = built.newIds.map(id => ({
    op: 'add',
    path: `/角色档案/${id}`,
    value: built.data.角色档案[id],
  }));
  patchOps.push({
    op: 'replace',
    path: '/元信息/最近更新时间',
    value: Date.now(),
  });
  const inner = JSON.stringify(patchOps, null, 2);
  const text = `<UpdateVariable>\n<JSONPatch>\n${inner}\n</JSONPatch>\n</UpdateVariable>`;
  return { ok: true, text, newIds: built.newIds };
}
