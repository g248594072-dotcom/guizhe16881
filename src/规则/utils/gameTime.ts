/**
 * 游戏内时间系统工具函数
 * 处理游戏内变量时间的格式化、计算等
 * 注意：此时间是游戏世界观内的时间，存储于 MVU 变量中，完全由剧情控制
 * 与现实系统时间无关，不会自动流逝，仅随剧情推进而更新
 */

import { tryRulesMvuWritable, useDataStore } from '../store';
import { formatNarrativeGameDate } from './gameTimeCalendar';

/**
 * 游戏时间对象接口
 */
export interface GameTime {
  年: number;
  月: number;
  日: number;
  时: number;
  分: number;
  纪历体系?: string;
  纪年名称?: string;
  纪年年数?: number;
  时间演算基底?: string;
}

/**
 * 时间格式化模板
 */
export type TimeFormatTemplate =
  | 'YYYY年MM月DD日'      // 2026年04月04日
  | 'YYYY-MM-DD'           // 2026-04-04
  | 'MM/DD/YYYY'           // 04/04/2026
  | 'HH:mm'                // 12:00
  | 'HH时mm分'             // 12时00分
  | 'YYYY年MM月DD日 HH:mm' // 完整日期时间
  | 'MM月DD日 HH:mm'       // 04月04日 12:00
  | '相对描述';            // 早晨/上午/下午/晚上/深夜

/**
 * 格式化游戏时间为字符串
 */
export function formatGameTime(
  time: GameTime,
  template: TimeFormatTemplate = 'YYYY年MM月DD日 HH:mm',
): string {
  const { 年, 月, 日, 时, 分 } = time;
  const 体系 = time.纪历体系 ?? '公历';
  const pad = (n: number) => String(n).padStart(2, '0');

  if (template === 'HH:mm') return `${pad(时)}:${pad(分)}`;
  if (template === 'HH时mm分') return `${pad(时)}时${pad(分)}分`;
  if (
    template === 'YYYY年MM月DD日 HH:mm' ||
    template === 'YYYY年MM月DD日' ||
    template === 'MM月DD日 HH:mm'
  ) {
    return formatNarrativeGameDate(time);
  }

  switch (template) {
    case 'YYYY年MM月DD日':
      return `${年}年${pad(月)}月${pad(日)}日`;
    case 'YYYY-MM-DD':
      return `${年}-${pad(月)}-${pad(日)}`;
    case 'MM/DD/YYYY':
      return `${pad(月)}/${pad(日)}/${年}`;
    case 'HH:mm':
      return `${pad(时)}:${pad(分)}`;
    case 'HH时mm分':
      return `${pad(时)}时${pad(分)}分`;
    case 'YYYY年MM月DD日 HH:mm':
      return `${年}年${pad(月)}月${pad(日)}日 ${pad(时)}:${pad(分)}`;
    case 'MM月DD日 HH:mm':
      return `${pad(月)}月${pad(日)}日 ${pad(时)}:${pad(分)}`;
    case '相对描述':
      return getTimeRelativeDescription(time);
    default:
      return `${年}-${pad(月)}-${pad(日)} ${pad(时)}:${pad(分)}`;
  }
}

/**
 * 获取时间的相对描述（早晨/上午/下午/晚上/深夜）
 */
export function getTimeRelativeDescription(time: GameTime): string {
  const { 时, 分 } = time;
  const totalMinutes = 时 * 60 + 分;

  // 5:00 - 8:00: 清晨
  if (totalMinutes >= 300 && totalMinutes < 480) {
    return '清晨';
  }
  // 8:00 - 11:30: 上午
  if (totalMinutes >= 480 && totalMinutes < 690) {
    return '上午';
  }
  // 11:30 - 13:30: 中午
  if (totalMinutes >= 690 && totalMinutes < 810) {
    return '中午';
  }
  // 13:30 - 17:30: 下午
  if (totalMinutes >= 810 && totalMinutes < 1050) {
    return '下午';
  }
  // 17:30 - 19:30: 傍晚
  if (totalMinutes >= 1050 && totalMinutes < 1170) {
    return '傍晚';
  }
  // 19:30 - 22:00: 晚上
  if (totalMinutes >= 1170 && totalMinutes < 1320) {
    return '晚上';
  }
  // 22:00 - 24:00: 深夜
  if (totalMinutes >= 1320 || totalMinutes < 300) {
    return '深夜';
  }

  return '';
}

/**
 * 获取详细时间段描述（带具体时间）
 */
export function getDetailedTimeDescription(time: GameTime): string {
  const period = getTimeRelativeDescription(time);
  const format = formatGameTime(time, 'HH:mm');
  return `${period} ${format}`;
}

/**
 * 推进游戏时间
 * @param minutes 要推进的分钟数
 */
export function advanceGameTime(minutes: number): void {
  if (!tryRulesMvuWritable()) return;
  const store = useDataStore();
  const gameTime = store.data.游戏时间;

  if (!gameTime) {
    console.error('[游戏时间] 游戏时间变量未定义');
    return;
  }

  // 推进时间
  gameTime.分 += Math.round(minutes);

  console.log(`[游戏时间] 推进了 ${minutes} 分钟，当前时间:`, formatGameTime(gameTime));
}

/**
 * 设置游戏时间到指定值
 */
export function setGameTime(newTime: Partial<GameTime>): void {
  if (!tryRulesMvuWritable()) return;
  const store = useDataStore();
  const gameTime = store.data.游戏时间;

  if (!gameTime) {
    console.error('[游戏时间] 游戏时间变量未定义');
    return;
  }

  // 更新提供的字段
  if (newTime.年 !== undefined) gameTime.年 = newTime.年;
  if (newTime.月 !== undefined) gameTime.月 = newTime.月;
  if (newTime.日 !== undefined) gameTime.日 = newTime.日;
  if (newTime.时 !== undefined) gameTime.时 = newTime.时;
  if (newTime.分 !== undefined) gameTime.分 = newTime.分;
  if (newTime.纪历体系 !== undefined) (gameTime as GameTime).纪历体系 = newTime.纪历体系;
  if (newTime.纪年名称 !== undefined) (gameTime as GameTime).纪年名称 = newTime.纪年名称;
  if (newTime.纪年年数 !== undefined) (gameTime as GameTime).纪年年数 = newTime.纪年年数;
  if (newTime.时间演算基底 !== undefined) (gameTime as GameTime).时间演算基底 = newTime.时间演算基底;

  console.log(`[游戏时间] 时间已设置:`, formatGameTime(gameTime));
}

/**
 * 获取游戏时间的响应式引用（用于Vue组件）
 */
export function useGameTime() {
  const store = useDataStore();

  return computed({
    get: (): GameTime => {
      const gameTime = store.data.游戏时间;
      return {
        年: gameTime?.年 ?? 2026,
        月: gameTime?.月 ?? 4,
        日: gameTime?.日 ?? 4,
        时: gameTime?.时 ?? 12,
        分: gameTime?.分 ?? 0,
        纪历体系: gameTime?.纪历体系,
        纪年名称: gameTime?.纪年名称,
        纪年年数: gameTime?.纪年年数,
        时间演算基底: gameTime?.时间演算基底,
      };
    },
    set: (newTime: GameTime) => {
      setGameTime(newTime);
    },
  });
}

/**
 * 计算两个时间点的差值（以分钟为单位）
 */
export function getTimeDifferenceInMinutes(time1: GameTime, time2: GameTime): number {
  // 每月按31天计算，与schema保持一致
  const 每月天数 = 31;
  const toTotalMinutes = (t: GameTime) =>
    ((((t.年 * 12) + t.月) * 每月天数) + t.日) * 24 * 60 + t.时 * 60 + t.分;

  return Math.abs(toTotalMinutes(time1) - toTotalMinutes(time2));
}

/**
 * 判断是否是同一天
 */
export function isSameDay(time1: GameTime, time2: GameTime): boolean {
  return time1.年 === time2.年 && time1.月 === time2.月 && time1.日 === time2.日;
}

/**
 * 判断是否是白天（6:00 - 18:00）
 */
export function isDaytime(time: GameTime): boolean {
  return time.时 >= 6 && time.时 < 18;
}

/**
 * 判断是否是夜晚（18:00 - 6:00）
 */
export function isNighttime(time: GameTime): boolean {
  return !isDaytime(time);
}

/**
 * 获取星期几（基于日期计算，0=周日，1=周一...）
 */
export function getDayOfWeek(time: GameTime): number {
  // 使用基姆拉尔森计算公式（Zeller公式的变体）
  const { 年, 月, 日 } = time;

  let y = 年;
  let m = 月;
  let d = 日;

  if (m < 3) {
    m += 12;
    y -= 1;
  }

  const c = Math.floor(y / 100);
  const y2 = y % 100;

  const w = (c / 4 - 2 * c + y2 + y2 / 4 + 13 * (m + 1) / 5 + d - 1) % 7;
  return Math.floor(w + 7) % 7;
}

/**
 * 获取星期几的中文描述
 */
export function getDayOfWeekChinese(time: GameTime): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[getDayOfWeek(time)];
}

/**
 * 获取完整时间显示（用于手机锁屏等场景）
 */
export function getFullTimeDisplay(time: GameTime): string {
  const 体系 = time.纪历体系 ?? '公历';
  const dateStr = formatNarrativeGameDate(time);
  const weekStr = 体系 === '公历' ? getDayOfWeekChinese(time) : '';

  return weekStr ? `${dateStr} ${weekStr}` : dateStr;
}
