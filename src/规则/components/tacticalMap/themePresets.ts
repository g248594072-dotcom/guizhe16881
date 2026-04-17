import type { Building, BuildingType, MapStyle, Region, World } from './types';
import { normalizeWorld } from './migrate';

export const CELL_SIZE = 64;
export const ZOOM_THRESHOLD = 0.5;

export const REGION_COLORS: { name: string; value: string }[] = [
  { name: '默认', value: '' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '红色', value: '#ef4444' },
  { name: '绿色', value: '#10b981' },
  { name: '黄色', value: '#f59e0b' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
  { name: '青色', value: '#14b8a6' },
  { name: '橙色', value: '#f97316' },
];

const R_INIT: Region = {
  id: 'r_init',
  name: '初始营地',
  description: '最初建立的定居点，设施基础但功能齐全。',
  x: 6,
  y: 6,
  width: 10,
  height: 10,
  icon: 'Tent',
  color: '#14b8a6',
};

const R_OUTPOST: Region = {
  id: 'r_outpost',
  name: '前沿哨站',
  description: '远离主聚落的前哨与补给节点。',
  x: 28,
  y: 8,
  width: 8,
  height: 8,
  icon: 'Flag',
  color: '#3b82f6',
};

const INITIAL_BUILDINGS_RAW: Building[] = [
  {
    id: 'b1',
    regionId: 'r_init',
    x: 10,
    y: 10,
    width: 2,
    height: 2,
    name: '核心枢纽',
    type: 'core',
    description: '聚落的核心建筑，控制主要功能和后勤调度。',
    people: [
      { id: 'p1', name: '林指挥官', role: '领袖' },
      { id: 'p2', name: '艾拉', role: '顾问' },
    ],
    activities: [
      { id: 'a1', name: '同步核心数据/能量', progress: 75, phase: 'ongoing', scope: 'collective' },
      { id: 'a2', name: '升级防御系统', progress: 30, phase: 'ongoing', scope: 'collective' },
      { id: 'a2b', name: '新生欢迎会（筹备）', progress: 20, phase: 'upcoming', scope: 'collective' },
    ],
    rooms: [
      { id: 'r1', name: '主控室', type: '控制' },
      { id: 'r2', name: '能源室', type: '能源' },
    ],
    customProperties: [
      { id: 'cp1', name: '能量等级', description: '当前建筑的能量储备等级', value: '高' },
      { id: 'cp2', name: '科技/魔法层级', description: '建筑的科技或魔法发展阶段', value: '3' },
    ],
  },
  {
    id: 'b2',
    regionId: 'r_init',
    x: 13,
    y: 8,
    width: 1,
    height: 2,
    name: '外围卫戍区',
    type: 'military',
    description: '用于训练和防御的军事哨所。',
    people: [{ id: 'p3', name: '新兵 凯尔', role: '受训者' }],
    activities: [{ id: 'a3', name: '战斗演练', progress: 50, phase: 'ongoing', scope: 'collective' }],
    rooms: [{ id: 'r3', name: '兵营', type: '居住' }],
    customProperties: [{ id: 'cp3', name: '安全评级', description: '该区域的安全防卫级别', value: 'Alpha' }],
  },
  {
    id: 'b3',
    regionId: 'r_init',
    x: 8,
    y: 12,
    width: 2,
    height: 1,
    name: '交易集市',
    type: 'commercial',
    description: '商品、物资和遗物交易的中心。',
    people: [],
    activities: [],
    rooms: [],
    customProperties: [],
  },
  {
    id: 'b4',
    regionId: 'r_outpost',
    x: 30,
    y: 10,
    width: 1,
    height: 1,
    name: '中继塔',
    type: 'research',
    description: '维持远距离通讯的小型中继站。',
    people: [],
    activities: [{ id: 'a4', name: '校准天线', progress: 40, phase: 'ongoing', scope: 'collective' }],
    rooms: [],
    customProperties: [],
  },
];

/** 单地图默认数据（不再支持多世界切换） */
export const INITIAL_WORLD: World = normalizeWorld({
  id: 'w_default',
  name: '默认世界',
  theme: 'modern',
  details: '',
  buildings: INITIAL_BUILDINGS_RAW,
  regions: [R_INIT, R_OUTPOST],
});

export const TYPE_CONFIG: Record<
  BuildingType,
  {
    iconClass: string;
    label: string;
  }
> = {
  core: { iconClass: 'fa-solid fa-circle-nodes', label: '核心枢纽' },
  military: { iconClass: 'fa-solid fa-shield-halved', label: '军事防卫' },
  commercial: { iconClass: 'fa-solid fa-store', label: '商业贸易' },
  research: { iconClass: 'fa-solid fa-flask', label: '研究探索' },
  industrial: { iconClass: 'fa-solid fa-wrench', label: '工业生产' },
};

export const THEMES: Record<MapStyle, { name: string; className: string }> = {
  sci_fi: { name: '科幻 (Sci-Fi)', className: '' },
  western_medieval: { name: '西方中世纪 (Western Fantasy)', className: 'theme-western' },
  eastern_medieval: { name: '东方中世纪 (Eastern Fantasy)', className: 'theme-eastern' },
  future: { name: '未来 (Cyberpunk)', className: 'theme-future' },
  modern: { name: '现代 (Modern)', className: 'theme-modern' },
};
