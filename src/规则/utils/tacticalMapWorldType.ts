import type { MapStyle } from '../components/tacticalMap/types';

/**
 * 将 MVU `元信息.世界类型` 文案映射为地图 `World.theme`（MapStyle）。
 * 自定义与无法识别时回退 `modern`；可做轻量子串匹配（避免误判时优先精确匹配）。
 */
export function worldTypeStringToMapStyle(raw: string): MapStyle {
  const t = raw.trim();
  if (!t || t === '自定义') return 'modern';
  if (t === '现代') return 'modern';
  if (t === '西方中世纪') return 'western_medieval';
  if (t === '东方中世纪') return 'eastern_medieval';
  if (t === '未来') return 'future';
  if (t === '西幻') return 'western_medieval';
  if (t === '玄幻') return 'eastern_medieval';
  if (/^(现代|都市)/.test(t)) return 'modern';
  if (/未来|赛博|2077|星际/.test(t)) return 'future';
  if (/东方|古中国|仙侠|武侠|修真|玄幻/.test(t)) return 'eastern_medieval';
  if (/中世纪|西幻|骑士|城堡|王国|精灵|矮人/.test(t)) return 'western_medieval';
  return 'modern';
}
