/**
 * 朋友圈「灵感示例」——随机点火用，非题材白名单；气质过滤避免与人设明显打架。
 */

import type { PhoneCharacterArchive } from './characterArchive/bridge';
import type { MomentContentType } from './types/moments';

export type ArchiveVibe = 'melancholy' | 'upbeat' | 'neutral';

type Inspiration = {
  title: string;
  hint: string;
  /** 多愁善感倾向时跳过（如强励志、立 Flag 鸡血） */
  skipIfMelancholy?: boolean;
  /** 元气开朗倾向时跳过（如纯颓废伤感腔） */
  skipIfUpbeat?: boolean;
  /** 仅用于好友可见类（日常/吐槽/心情等） */
  light?: boolean;
  /** 仅用于阴暗/隐喻类 */
  dark?: boolean;
};

const LIGHT_INSPIRATIONS: Inspiration[] = [
  { title: '万物皆可爱', hint: '路边小花、流浪猫、云的形状；语气柔一点，带点文艺。', light: true },
  { title: '今日份味蕾', hint: '做饭过程、空盘、小店惊喜；烟火气与满足感。', light: true },
  { title: '随机浪漫', hint: '深夜路灯、翻了几页的书、耳机里单曲循环；独处质感。', light: true },
  { title: '打工人实录', hint: '表格、甲方、周一的丧；幽默自嘲，别变纯负能量宣泄。', light: true },
  { title: '人类观察计划', hint: '地铁/商场奇葩趣闻，当事人打码；敏锐风趣。', light: true },
  { title: '大冤种朋友', hint: '死党糗事或损友梗；亲昵互损，不点名第二人称命令。', light: true },
  { title: '纸上得来', hint: '冷知识、电影一句扎心台词；短、有思考感。', light: true },
  { title: '好物不私藏', hint: '零食、文具、APP 安利；热心分享。', light: true },
  { title: '逃离计划', hint: '公园长椅、短途走走；自由开阔，不必写远行。', light: true },
  { title: '光影瞬间', hint: '偏晒图感：一两句或无字+氛围，高冷审美向。', light: true },
  { title: '选择困难症', hint: '午饭二选一、小物投票；轻松互动感，别写成点名约会。', light: true },
  { title: '万能票圈', hint: '求剧求书求攻略；在线等，语气俏皮。', light: true },
  { title: '收纳断舍离', hint: '整理后的清爽或翻出旧物；一句感慨即可。', light: true },
  { title: '天气预报员', hint: '降温大雨暖阳；天气如何影响心情。', light: true },
  { title: '独处报告', hint: '一个人电影、散步、半夜剪指甲；享受独处≠寂寞。', light: true },
  { title: '避雷针计划', hint: '某东西值不值、景点踩雷；不想花冤枉钱。', light: true },
  { title: '不露脸的甜', hint: '两杯奶茶、影子、对方视角里的小细节；含蓄不发合照命令。', light: true },
  { title: '单身调侃', hint: '月老织秋裤类玩笑；轻松不戾气。', light: true },
  { title: '反差萌', hint: '白天干练 vs 晚上熬夜/二次元/手工；一句对比。', light: true },
  { title: '梦想与现实', hint: '想象周六 vs 实际周六；幽默带过。', light: true },
  { title: '立 Flag 与打脸', hint: '健身第 1 天 vs 第 0.5 天；反向励志玩梗。', light: true, skipIfMelancholy: true },
  { title: '元气口号挑战', hint: '短句打鸡血、今天也要加油鸭类；偏营销正能量。', light: true, skipIfMelancholy: true },
  { title: '电量不足', hint: '累了、省电模式、404 Not Found；丧得真诚但不自毁长文。', light: true, skipIfUpbeat: true },
  { title: '间歇性迷茫', hint: '对现状一点怀疑；允许脆弱，收束在两三句内。', light: true, skipIfUpbeat: true },
  { title: '深夜矫情', hint: '歌、旧遗憾；感性一两句，别写成长篇伤感小说。', light: true, skipIfUpbeat: true },
];

const DARK_INSPIRATIONS: Inspiration[] = [
  { title: '嫉妒与掩饰', hint: '具体嫉妒什么、表面如何装没事；内心独白。', dark: true },
  { title: '报复幻想', hint: '想象报复但不会真做；合理化自己的恶意。', dark: true },
  { title: '隐藏欲望', hint: '压抑了什么、为什么不敢说。', dark: true },
  { title: '愤世一小句', hint: '对现象的不爽，别写成论文。', dark: true },
  { title: '自我怀疑', hint: '对自己哪一点不满意；私密语气。', dark: true },
  { title: '隐秘厌恶', hint: '表面友好内心翻白眼；带一点幽默的毒。', dark: true },
  { title: '未说出口的好感', hint: '为什么不敢承认；别扭心理。', dark: true },
  { title: '腹黑玩笑', hint: '元气人设也可：带刺的玩笑、阴阳怪气但不颓废长文。', dark: true },
  { title: '恶意小念头', hint: '一闪而过的坏心思与自我辩解。', dark: true },
  { title: '独处阴暗面', hint: '只想一个人烂在床上/谁也别理；短促有力。', dark: true, skipIfUpbeat: true },
];

const DISCLAIMER =
  '【说明】以下为灵感参考，可自由发挥，不必套用字面；不得把选题窄化在下列几句之内。正文以角色此刻自然想发的那条为准。\n\n';

/** 粗分档案气质，供过滤灵感示例（启发式，不追求完美） */
export function inferArchiveVibe(archive: PhoneCharacterArchive): ArchiveVibe {
  const blob = [
    archive.name,
    archive.currentThought || '',
    archive.currentPhysiologicalDescription || '',
    ...Object.entries(archive.personality || {}).flatMap(([k, v]) => [k, String(v ?? '')]),
  ]
    .join('\n')
    .toLowerCase();

  const melancholyHits =
    /敏感|内向|多愁|忧郁|emo|丧|脆弱|孤独|自卑|焦虑|抑郁|心事|低落|眼泪|难过|破碎|阴郁|文静|细腻/.test(blob);
  const upbeatHits =
    /元气|开朗|活泼|乐观|大大咧咧|沙雕|梗王|阳光|直率|外向|热情|好胜|傲娇|霸道|娇蛮|主动/.test(blob);

  if (melancholyHits && !upbeatHits) {
    return 'melancholy';
  }
  if (upbeatHits && !melancholyHits) {
    return 'upbeat';
  }
  if (melancholyHits && upbeatHits) {
    return 'neutral';
  }
  return 'neutral';
}

function filterPool(pool: Inspiration[], vibe: ArchiveVibe): Inspiration[] {
  let out = pool;
  if (vibe === 'melancholy') {
    out = out.filter(i => !i.skipIfMelancholy);
  }
  if (vibe === 'upbeat') {
    out = out.filter(i => !i.skipIfUpbeat);
  }
  if (out.length === 0) {
    out = pool;
  }
  return out;
}

function pickUnique<T>(arr: T[], count: number): T[] {
  if (arr.length === 0) {
    return [];
  }
  const idx = new Set<number>();
  while (idx.size < Math.min(count, arr.length)) {
    idx.add(Math.floor(Math.random() * arr.length));
  }
  return [...idx].map(i => arr[i]!);
}

function isDarkContentType(t: MomentContentType): boolean {
  return t === 'dark_thought' || t === 'secret_hint';
}

/**
 * 拼一段注入 system 的「灵感参考」文本（含免责声明 + 1～2 条示例）。
 */
export function pickMomentInspirationBlock(archive: PhoneCharacterArchive, contentType: MomentContentType): string {
  const vibe = inferArchiveVibe(archive);
  const dark = isDarkContentType(contentType);
  const basePool = dark ? DARK_INSPIRATIONS.filter(i => i.dark) : LIGHT_INSPIRATIONS.filter(i => i.light);
  const pool = filterPool(basePool.length ? basePool : dark ? DARK_INSPIRATIONS : LIGHT_INSPIRATIONS, vibe);
  const picks = pickUnique(pool, 2);
  if (picks.length === 0) {
    return `${DISCLAIMER}（暂无匹配灵感条，请自由发挥分享/炫耀/吐槽/求助类内容。）`;
  }
  const body = picks
    .map((p, i) => `${i + 1}. 「${p.title}」— ${p.hint}`)
    .join('\n');
  return `${DISCLAIMER}${body}`;
}
