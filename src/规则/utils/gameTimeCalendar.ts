/**
 * 按「世界类型」初始化游戏内纪年，及「自定义」时随机套用六种之一。
 * 与 MVU `游戏时间` 扩展字段（纪历体系、纪年名称、纪年年数、时间演算基底）一致。
 */


/** 用于计时的六种世界基底（不含「自定义」） */
export const CALENDAR_WORLD_TYPES = ['现代', '西幻', '玄幻', '未来', '西方中世纪', '东方中世纪'] as const;
export type CalendarWorldType = (typeof CALENDAR_WORLD_TYPES)[number];

export function isCalendarWorldType(v: string): v is CalendarWorldType {
  return (CALENDAR_WORLD_TYPES as readonly string[]).includes(v);
}

/** 选「自定义」或任意非六种预设字符串时随机基底；六种预设则与之一致 */
export function resolveCalendarWorldType(uiWorldType: string): CalendarWorldType {
  const w = (uiWorldType || '').trim();
  if (w === '自定义' || !w) {
    const i = Math.floor(Math.random() * CALENDAR_WORLD_TYPES.length);
    return CALENDAR_WORLD_TYPES[i];
  }
  if (isCalendarWorldType(w)) return w;
  const i = Math.floor(Math.random() * CALENDAR_WORLD_TYPES.length);
  return CALENDAR_WORLD_TYPES[i];
}

function randomMd(): { 月: number; 日: number } {
  return {
    月: Math.floor(Math.random() * 12) + 1,
    日: Math.floor(Math.random() * 28) + 1,
  };
}

/** 唐及五代常见年号（起止为公元年，含首尾） */
const EASTERN_REIGNS: { 名称: string; 起: number; 止: number }[] = [
  { 名称: '贞观', 起: 627, 止: 649 },
  { 名称: '永徽', 起: 650, 止: 655 },
  { 名称: '开元', 起: 713, 止: 741 },
  { 名称: '天宝', 起: 742, 止: 756 },
  { 名称: '大中', 起: 847, 止: 859 },
  { 名称: '乾符', 起: 874, 止: 879 },
];

const WEST_FANTASY_ERAS = ['创世纪', '星坠历', '龙眠纪', '盟誓历', '魔潮历', '圣辉历'];

const XUANHUAN_ERAS = ['天元', '灵涌', '劫末', '归真', '太初', '混元'];

export type GameTimeInitRecord = {
  年: number;
  月: number;
  日: number;
  时: number;
  分: number;
  纪历体系: string;
  纪年名称: string;
  纪年年数: number;
  /** 实际用于演算纪年的世界基底（与「自定义」随机结果一致） */
  时间演算基底: CalendarWorldType;
};

/**
 * 根据纪年基底生成完整 `游戏时间` 初始对象。
 * @param cal 已解析后的纪历基底（「自定义」时须先调用 resolveCalendarWorldType）
 * @param uiWorldType 界面所选世界类型（写入「时间演算基底」语义用；与 cal 一并存变量）
 */
export function buildInitialGameTimeRecord(cal: CalendarWorldType, _uiWorldType: string): GameTimeInitRecord {
  const { 月, 日 } = randomMd();
  const 时 = 12;
  const 分 = 0;
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const cd = now.getDate();

  const base: Omit<GameTimeInitRecord, '年' | '纪历体系' | '纪年名称' | '纪年年数'> = {
    月,
    日,
    时,
    分,
    时间演算基底: cal,
  };

  switch (cal) {
    case '现代': {
      const 年 = cy;
      return {
        ...base,
        年,
        月: cm,
        日: cd,
        纪历体系: '公历',
        纪年名称: '公元',
        纪年年数: 年,
      };
    }

    case '未来': {
      const 年 = 2077 + Math.floor(Math.random() * 50);
      return {
        ...base,
        年,
        纪历体系: '公历',
        纪年名称: '公元',
        纪年年数: 年,
      };
    }

    case '西方中世纪': {
      const 年 = 1000 + Math.floor(Math.random() * 400);
      return {
        ...base,
        年,
        纪历体系: '公历',
        纪年名称: '公元',
        纪年年数: 年,
      };
    }

    case '东方中世纪': {
      const r = EASTERN_REIGNS[Math.floor(Math.random() * EASTERN_REIGNS.length)];
      const ad = r.起 + Math.floor(Math.random() * (r.止 - r.起 + 1));
      const 纪年年数 = ad - r.起 + 1;
      return {
        ...base,
        年: ad,
        纪历体系: '年号历',
        纪年名称: r.名称,
        纪年年数,
      };
    }

    case '西幻': {
      const 纪年名称 = WEST_FANTASY_ERAS[Math.floor(Math.random() * WEST_FANTASY_ERAS.length)];
      const 纪年年数 = 1 + Math.floor(Math.random() * 320);
      return {
        ...base,
        年: 1200 + Math.floor(Math.random() * 400),
        纪历体系: '西幻纪',
        纪年名称,
        纪年年数,
      };
    }

    case '玄幻': {
      const 纪年名称 = XUANHUAN_ERAS[Math.floor(Math.random() * XUANHUAN_ERAS.length)];
      const 纪年年数 = 1 + Math.floor(Math.random() * 888);
      return {
        ...base,
        年: 1800 + Math.floor(Math.random() * 400),
        纪历体系: '修真历',
        纪年名称,
        纪年年数,
      };
    }

  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 剧情/UI 用：按纪历体系输出可读日期时间 */
export function formatNarrativeGameDate(t: {
  年: number;
  月: number;
  日: number;
  时: number;
  分: number;
  纪历体系?: string;
  纪年名称?: string;
  纪年年数?: number;
  时间演算基底?: string;
}): string {
  const clock = `${pad2(t.时)}:${pad2(t.分)}`;
  const md = `${t.月}月${t.日}日`;
  const 体系 = t.纪历体系 || '公历';

  if (体系 === '公历') {
    const name = t.纪年名称?.trim() ? t.纪年名称 : '公元';
    const yOrd = (t.纪年年数 ?? 0) > 0 ? t.纪年年数! : t.年;
    return `${name}${yOrd}年${pad2(t.月)}月${pad2(t.日)}日 ${clock}`;
  }

  if (体系 === '年号历' && t.纪年名称 && (t.纪年年数 ?? 0) > 0) {
    return `${t.纪年名称}${t.纪年年数}年${md} ${clock}（公元${t.年}年）`;
  }
  if (体系 === '西幻纪' && t.纪年名称 && (t.纪年年数 ?? 0) > 0) {
    return `${t.纪年名称} ${t.纪年年数}年 ${md} ${clock}`;
  }
  if (体系 === '修真历' && t.纪年名称 && (t.纪年年数 ?? 0) > 0) {
    return `${t.纪年名称}第${t.纪年年数}载 ${md} ${clock}`;
  }
  return `${t.年}年${pad2(t.月)}月${pad2(t.日)}日 ${clock}`;
}
