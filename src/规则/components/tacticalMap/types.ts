export type BuildingType = 'core' | 'military' | 'commercial' | 'research' | 'industrial';

export type MapStyle = 'sci_fi' | 'western_medieval' | 'eastern_medieval' | 'future' | 'modern';

export interface Person {
  id: string;
  name: string;
  role: string;
}

/** 事件所处阶段：即将举办 / 已在进行 */
export type ActivityPhase = 'upcoming' | 'ongoing';

/** 集体向事件 vs 个人向事件（书写与生成规则可后续约定） */
export type ActivityScope = 'collective' | 'personal';

export interface Activity {
  id: string;
  name: string;
  /** 0–100：筹备进度或进行进度，具体语义由阶段与后续生成规则约定 */
  progress: number;
  phase?: ActivityPhase;
  scope?: ActivityScope;
}

export interface CustomProperty {
  id: string;
  name: string;
  description: string;
  value: string;
  /** 旧版字段，读档时由 migrate 迁移到 name */
  key?: string;
}

export interface Room {
  id: string;
  name: string;
  type: string;
}

export interface Building {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  type: BuildingType;
  description: string;
  people: Person[];
  activities: Activity[];
  rooms: Room[];
  customProperties: CustomProperty[];
  /** 所属区域；缺省为游离建筑（仍可按几何落在某区内描边） */
  regionId?: string;
  /** 覆盖类型默认图标，键名见 iconMap */
  icon?: string;
  /** 新建未保存 */
  isNew?: boolean;
}

export interface Region {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  icon?: string;
  color?: string;
  /** 新建未在弹窗中确认保存；取消关闭时丢弃 */
  isNew?: boolean;
}

export interface World {
  id: string;
  name: string;
  /** 机场风格等：世界设定分类，与界面配色（地图预设）独立 */
  theme: MapStyle;
  /** 世界简介 / 设定详情 */
  details?: string;
  buildings: Building[];
  regions: Region[];
}
