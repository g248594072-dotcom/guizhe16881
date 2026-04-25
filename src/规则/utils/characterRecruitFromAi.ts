/**
 * 招募式新增角色：`generateRaw` 短上下文（无酒馆整卡预设）→ 解析 `<companion>` → 映射 `角色档案` 并 Schema 校验。
 */
import { klona } from 'klona';
import { z } from 'zod';
import { Schema } from '../schema';
import { createEmptyCharacterRecord } from './dialogAndVariable';
import { allocateNextChrId } from './chrId';
import { traceWrappedGenerateRaw } from './generationTrace';

type GameRoot = z.infer<typeof Schema>;

export const RECRUIT_COMPANION_CANDIDATE_COUNT = 5;

export interface CompanionCandidateRecord {
  名字: string;
  标签: string;
  年龄: string;
  常见穿搭: string;
  情感状况: string;
  一句话介绍: string;
  简介: string;
  爱好: string;
  性癖: string;
  敏感点: string;
  代表性发言一: string;
  代表性发言二: string;
  代表性发言三: string;
}

const FIELD_KEYS = [
  '名字',
  '标签',
  '年龄',
  '常见穿搭',
  '情感状况',
  '一句话介绍',
  '简介',
  '爱好',
  '性癖',
  '敏感点',
  '代表性发言一',
  '代表性发言二',
  '代表性发言三',
] as const;

function buildRecruitSystemPrompt(): string {
  const n = String(RECRUIT_COMPANION_CANDIDATE_COUNT);
  const keyList = FIELD_KEYS.join('、');
  return [
    '# 角色',
    '你是「招募候选人名单」生成器，输出将写入虚构作品的变量系统。所有人物均为虚构。',
    '',
    '# 输出契约（违反则任务失败）',
    '- 回复中**只能**出现一对标签：<companion> … </companion>，前后不要有任何其它字符。',
    '- 禁止：Markdown 标题或代码块、自我介绍、确认收到、翻译、正文块（maintext/content）、选项（choice）、摘要（sum）、<UpdateVariable>、JSON。',
    '- 标签内恰好 ' + n + ' 位候选人；每位必须以单独一行「候选人:」起头（行首），再跟十三行字段（每行一个键）。',
    '- 每行格式：字段名: "值" —— 值必须用英文直引号 " 包裹；值内禁止换行；需要引号时用 \\" 转义。',
    '- 十三键顺序必须严格如下（键名与冒号后空格须与示例一致）：' + keyList + '。',
    '- 标签：恰好三个词或短语，用英文斜杠 / 分隔，体现性格或身份维度。',
    '- 一句话介绍：单行梗概，用于列表展示；建议 8～36 个汉字（或等效长度），与「简介」不得重复堆砌；禁止写成多句。',
    '- 简介：展开型角色小传，须更具体、更有画面：日常习惯、人际钩子、可扮演细节、与用户「角色简介」等说明相呼应；建议 2～4 句、总长度约 120～400 字（仍须写在一对引号内、不换行）。',
    '- **爱好**：与性兴奋无关的日常兴趣、技能或消遣（如美食探店、游戏、运动、收集、音乐、学习等）。凡能**引发或强化性兴奋、性幻想、生理唤起**的偏好**禁止**写在「爱好」里，必须写在「性癖」。',
    '- **性癖**：只写**在虚构设定下会令该角色产生性兴奋、性紧张或明确性幻想**的倾向、情境、刺激类型或心理开关（可含支配/服从、窥视、特定身体意象、禁忌联想等）；须写得**具体、可扮演**，避免空泛词如「喜欢帅哥」而无性刺激内涵。若角色无性向或全年龄卡：可写「暂无明确性癖」或极轻的暗示级一笔，但仍须与「爱好」严格分流。',
    '- **敏感点**：身体部位、触碰方式、语气或情境等**易被唤起反应**的敏感带（虚构）；可与性癖呼应，侧重「哪里/怎样一触即发」。全年龄时保持隐喻。',
    '- 代表性发言一、二、三：三条**不同语气或场景**的口语台词（可分别为感叹、疑问、碎碎念/自言自语等），每条独立一行键；勿三条雷同。',
    '',
    '# 内容与尺度',
    '- 根据用户招募说明（含名字、关系、角色简介等）设计外貌、职业、气质与剧情钩子；五位之间要有明显差异（年龄层、性格、职业/来历、与说明契合度等至少两维不同）。',
    '- **成人向（R18）**：若用户需求涉及情色、性暗示、肉体描写、支配/服从、成人关系等，允许在「简介」「常见穿搭」「性癖」「敏感点」「代表性发言一/二/三」中写入与需求强度匹配的露骨虚构描写；「爱好」仍须保持非性化日常兴趣。若需求明显全年龄：性癖/敏感点暧昧暗示，爱好可正常写。',
    '- 世界观：尊重用户给出的世界类型与地点摘要；不要编造与摘要冲突的硬设定。',
    '',
    '# 禁忌与偏好',
    '- 除非用户明确要求，否则姓名避免出现姓氏：林、苏、顾、柳、赵、慕容、夏、安。',
    '- 避免「潘驴邓小闲」式油腻男凝与空洞「霸总/王者」符号堆叠；角色要有可扮演细节。',
    '- 候选人处于「应征名单」阶段：不要写其已认识玩家或已知玩家隐私。',
    '',
    '# 自检',
    '输出前确认：仅一对 companion、内部 ' + n + ' 段「候选人:」、每段十三键齐全且带引号、顺序与键名无误；「爱好」与「性癖」不得混写。',
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

/** 从单个候选人文本块解析十三字段 */
export function parseOneCandidateBlock(block: string): Partial<CompanionCandidateRecord> {
  const out: Partial<CompanionCandidateRecord> = {};
  for (const key of FIELD_KEYS) {
    const re = new RegExp(
      `${key}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"(?:\\s*$|\\s*\\n)`,
      'm',
    );
    const m = block.match(re);
    if (m) (out as Record<string, string>)[key] = unescapeQuoted(m[1]);
  }
  return out;
}

function isCompleteCandidate(p: Partial<CompanionCandidateRecord>): p is CompanionCandidateRecord {
  for (const k of FIELD_KEYS) {
    if (p[k] == null || !String(p[k]).trim()) return false;
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
      `候选人数量应为 ${RECRUIT_COMPANION_CANDIDATE_COUNT}，实际解析到 ${list.length}。请检查模型输出是否为「候选人:」分段且十三字段均为 "..." 形式、键名与顺序与系统说明一致。`,
    );
  }
  return list;
}

export function mergeCandidateIntoCharacterEntry(
  c: CompanionCandidateRecord,
  recruitBrief: string,
): Record<string, unknown> {
  const name = String(c.名字 ?? '').trim() || '未命名';
  const lines: string[] = [];
  if (recruitBrief.trim()) lines.push(`【招募说明】${recruitBrief.trim()}`);
  const oneLiner = String(c.一句话介绍 ?? '').trim();
  if (oneLiner) lines.push(`一句话介绍：${oneLiner}`);
  lines.push(String(c.简介 ?? '').trim());
  lines.push(`标签：${String(c.标签 ?? '').trim()}`);
  lines.push(`常见穿搭：${String(c.常见穿搭 ?? '').trim()}`);
  lines.push(`情感状况：${String(c.情感状况 ?? '').trim()}`);
  const hobby = String(c.爱好 ?? '').trim();
  if (hobby) lines.push(`爱好：${hobby}`);
  const q1 = String(c.代表性发言一 ?? '').trim();
  const q2 = String(c.代表性发言二 ?? '').trim();
  const q3 = String(c.代表性发言三 ?? '').trim();
  if (q1) lines.push(`代表性发言：「${q1}」`);
  if (q2) lines.push(`「${q2}」`);
  if (q3) lines.push(`「${q3}」`);
  const desc = lines.filter(Boolean).join('\n');
  const base = createEmptyCharacterRecord(name, desc) as Record<string, unknown>;
  const xp = String(c.性癖 ?? '').trim();
  if (xp) base.隐藏性癖 = xp;
  const sens = String(c.敏感点 ?? '').trim();
  if (sens) base.当前综合生理描述 = sens;
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
  const outfit = String(c.常见穿搭 ?? '').trim();
  if (outfit) {
    const 上装 = { 着装: { 状态: '正常', 描述: outfit } };
    (base.服装状态 as Record<string, unknown>).上装 = 上装;
  }
  return base;
}

/** 十三字段 + 更长简介/三句台词，略提高上限以降低截断概率 */
const RECRUIT_GENERATE_RAW_MAX_TOKENS = 10240;

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
