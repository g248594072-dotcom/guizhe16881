/**
 * 地图 World 与 MVU `区域数据` / `建筑数据` / `活动数据` 的双向映射（不含格子坐标）。
 * 新开局：空白图 + MVU 写入后按 id 生成占位格子；同 id 保留已有 x/y/w/h 与 people 等，覆盖名称/描述/活动；**内部房间布局**与地图 rooms 双向同步；地图 `Building.type` 仅 UI 用，不再写入 MVU。
 */

import { klona } from 'klona';
import { isEqual } from 'lodash';
import type { Activity, Building, BuildingType, Region, Room, World } from '../components/tacticalMap/types';
import { normalizeWorld } from '../components/tacticalMap/migrate';
import { parseTacticalMvuMapTripleSnapshot, type Schema } from '../schema';
import { bumpUpdateTime, isRulesMvuLiveHostAtInit, tryRulesMvuWritable, useDataStore } from '../store';
import { worldTypeStringToMapStyle } from './tacticalMapWorldType';
import { isMvuOccupantValuePresent } from './mvuOccupantValue';

/** 地图侧默认图标分类（MVU 不再存建筑类型） */
const DEFAULT_MAP_BUILDING_TYPE: BuildingType = 'core';

function roomsFromMvuInternalLayout(
  raw: Schema['建筑数据'][string]['内部房间布局'],
  buildingId: string,
): Room[] {
  if (!raw || typeof raw !== 'object') return [];
  const rec = raw as Record<string, { 描述?: string }>;
  const out: Room[] = [];
  let i = 0;
  for (const roomKey of sortedKeys(rec)) {
    const name = roomKey.trim();
    if (!name) continue;
    const entry = rec[roomKey];
    const desc =
      entry && typeof entry === 'object' ? String((entry as { 描述?: unknown }).描述 ?? '').trim() : '';
    out.push({
      id: `room_${buildingId}_${i}`,
      name,
      type: desc.length > 0 ? (desc.length > 120 ? `${desc.slice(0, 120)}…` : desc) : '—',
    });
    i += 1;
  }
  return out;
}

/** 地图 `rooms[]` → MVU `内部房间布局`（房间名为 record 键，描述存于「描述」） */
export function mapMapRoomsToMvuInternalLayout(
  rooms: Room[],
): Schema['建筑数据'][string]['内部房间布局'] {
  const out: Record<string, { 描述: string }> = {};
  for (const r of rooms ?? []) {
    const name = (r.name ?? '').trim();
    if (!name) continue;
    let key = name;
    let n = 0;
    while (Object.prototype.hasOwnProperty.call(out, key)) {
      n += 1;
      key = `${name}_${n}`;
    }
    out[key] = { 描述: (r.type ?? '').trim() };
  }
  return out;
}

function sortedKeys<T extends object>(rec: Record<string, T>): string[] {
  return Object.keys(rec).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function newRegionSlot(id: string, name: string, description: string, index: number) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    id,
    name: name || '未命名区域',
    description: description ?? '',
    x: 4 + col * 18,
    y: 4 + row * 16,
    width: 10,
    height: 10,
  };
}

function newBuildingSlot(
  id: string,
  name: string,
  description: string,
  regionId: string | undefined,
  type: BuildingType,
  index: number,
): Building {
  const col = index % 5;
  const row = Math.floor(index / 5);
  return {
    id,
    x: 8 + col * 5,
    y: 20 + row * 4,
    width: 2,
    height: 2,
    name: name || '未命名建筑',
    type,
    description: description ?? '',
    regionId,
    people: [],
    activities: [],
    rooms: [],
    customProperties: [],
  };
}

/** 新建建筑放在所属区域格子内，避免固定 y=20 落在区域外（地图上像「没有建筑」） */
function newBuildingSlotInsideRegion(
  id: string,
  name: string,
  description: string,
  region: Region,
  type: BuildingType,
  indexInRegion: number,
): Building {
  const bw = 2;
  const bh = 2;
  const maxCol = Math.max(0, region.width - bw);
  const maxRow = Math.max(0, region.height - bh);
  const step = 2;
  const cols = Math.max(1, Math.floor(maxCol / step) + 1);
  const col = cols > 0 ? indexInRegion % cols : 0;
  const row = cols > 0 ? Math.floor(indexInRegion / cols) : 0;
  let gx = region.x + col * step;
  let gy = region.y + row * step;
  if (gx > region.x + maxCol) gx = region.x + maxCol;
  if (gy > region.y + maxRow) gy = region.y + maxRow;
  return {
    id,
    x: gx,
    y: gy,
    width: bw,
    height: bh,
    name: name || '未命名建筑',
    type,
    description: description ?? '',
    regionId: region.id,
    people: [],
    activities: [],
    rooms: [],
    customProperties: [],
  };
}

function phaseFromMvu活动状态(rec: Schema['活动数据'][string]): Activity['phase'] {
  const s = rec.状态;
  if (s === '已结束') return 'ended';
  if (s === '已取消') return 'cancelled';
  if (s === '进行中') return 'ongoing';
  return 'ongoing';
}

function activityFromMvuRecord(actId: string, rec: Schema['活动数据'][string]): Activity {
  const title = (rec.活动名称 ?? '').trim() || '未命名活动';
  const body = (rec.活动内容 ?? '').trim();
  const name =
    body.length > 0
      ? `${title}（${body.slice(0, 80)}${body.length > 80 ? '…' : ''}）`
      : title;
  return {
    id: actId,
    name,
    progress: rec.状态 === '已结束' ? 100 : 0,
    phase: phaseFromMvu活动状态(rec),
    scope: 'collective',
  };
}

/** 活动数据（所在建筑）+ 建筑数据.当前活动 引用合并为地图上的活动列表 */
function collectActivitiesForBuildingFromMvu(
  buildingId: string,
  buildingRec: Schema['建筑数据'][string] | undefined,
  活动数据: Schema['活动数据'],
): Activity[] {
  const byId = new Map<string, Activity>();
  for (const actId of sortedKeys(活动数据)) {
    const rec = 活动数据[actId];
    if ((rec.所在建筑ID ?? '').trim() !== buildingId) continue;
    byId.set(actId, activityFromMvuRecord(actId, rec));
  }
  const refs = buildingRec?.当前活动;
  if (refs && typeof refs === 'object') {
    for (const actId of sortedKeys(refs as Record<string, unknown>)) {
      if (!isMvuOccupantValuePresent((refs as Record<string, unknown>)[actId])) continue;
      if (byId.has(actId)) continue;
      const rec = 活动数据[actId];
      if (rec && (rec.所在建筑ID ?? '').trim() !== buildingId) continue;
      byId.set(
        actId,
        rec
          ? activityFromMvuRecord(actId, rec)
          : {
              id: actId,
              name: actId,
              progress: 0,
              phase: 'ongoing',
              scope: 'collective',
            },
      );
    }
  }
  return [...byId.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')).map(id => byId.get(id)!);
}

function mapPhaseToMvu活动状态(phase?: Activity['phase']): '进行中' | '已结束' | '已取消' {
  if (phase === 'ended') return '已结束';
  if (phase === 'cancelled') return '已取消';
  return '进行中';
}

/** 地图活动名为「标题（摘要）」时尽量还原为变量用短标题 */
function baseTitleFromMapActivityName(name: string): string {
  const t = name.trim();
  const m = t.match(/^(.+?)（[\s\S]*）$/);
  return (m ? m[1] : t).trim() || '未知活动';
}

/**
 * 区域「包含建筑」中有 id、但尚无「建筑数据」条目时补占位建筑。
 */
function appendBuildingsFrom区域包含建筑Refs(
  buildings: Building[],
  regionsList: Region[],
  区域数据: Schema['区域数据'],
  建筑数据: Schema['建筑数据'],
  prevById: Map<string, Building>,
  slotIndexByRegionId: Map<string, number>,
): Building[] {
  const seen = new Set(buildings.map(b => b.id));
  const out = [...buildings];
  for (const rid of sortedKeys(区域数据)) {
    const rec = 区域数据[rid];
    const refs = rec?.包含建筑;
    if (!refs || typeof refs !== 'object') continue;
    for (const bid of sortedKeys(refs as Record<string, unknown>)) {
      if (!isMvuOccupantValuePresent((refs as Record<string, unknown>)[bid])) continue;
      if (seen.has(bid)) continue;
      if (建筑数据[bid] != null) continue;
      seen.add(bid);
      const reg = regionsList.find(r => r.id === rid);
      const p = prevById.get(bid);
      if (p) {
        out.push({
          ...p,
          regionId: rid,
          name: (p.name ?? '').trim() || bid,
          description:
            (p.description ?? '').trim() ||
            '仅出现在区域「包含建筑」中，变量尚无「建筑数据」条目',
          activities: p.activities ?? [],
        });
      } else if (reg) {
        const n = slotIndexByRegionId.get(rid) ?? 0;
        slotIndexByRegionId.set(rid, n + 1);
        out.push(
          newBuildingSlotInsideRegion(
            bid,
            bid,
            '仅「包含建筑」引用，尚无建筑数据条目',
            reg,
            'core',
            n,
          ),
        );
      } else {
        out.push(newBuildingSlot(bid, bid, '', rid, 'core', out.length));
      }
    }
  }
  return out;
}

function hydrateFromRecords(
  base: World,
  区域数据: Schema['区域数据'],
  建筑数据: Schema['建筑数据'],
  活动数据: Schema['活动数据'],
): World {
  const regions = [...base.regions];
  let buildings = [...base.buildings];

  for (const id of sortedKeys(区域数据)) {
    const rec = 区域数据[id];
    const idx = regions.findIndex(r => r.id === id);
    if (idx >= 0) {
      const r = regions[idx];
      regions[idx] = {
        ...r,
        name: (rec.名称 ?? '').trim() || r.name,
        description: rec.描述 ?? '',
      };
    } else {
      regions.push(newRegionSlot(id, rec.名称 ?? '', rec.描述 ?? '', regions.length));
    }
  }

  let appendedBuildingIndex = 0;
  const slotIndexByRegionId = new Map<string, number>();
  for (const id of sortedKeys(建筑数据)) {
    const rec = 建筑数据[id];
    const rid = (rec.所属区域ID ?? '').trim();
    const regionId = rid === '' ? undefined : rid;
    const mvuRooms = roomsFromMvuInternalLayout(rec.内部房间布局, id);
    const idx = buildings.findIndex(b => b.id === id);
    if (idx >= 0) {
      const b = buildings[idx];
      const mapType = b.type ?? DEFAULT_MAP_BUILDING_TYPE;
      buildings[idx] = {
        ...b,
        name: (rec.名称 ?? '').trim() || b.name,
        description: rec.描述 ?? '',
        regionId: regionId ?? b.regionId,
        type: mapType,
        rooms: mvuRooms,
      };
    } else {
      const reg = regionId ? regions.find(r => r.id === regionId) : undefined;
      const mapType = DEFAULT_MAP_BUILDING_TYPE;
      if (reg) {
        const n = slotIndexByRegionId.get(regionId) ?? 0;
        slotIndexByRegionId.set(regionId, n + 1);
        buildings.push({
          ...newBuildingSlotInsideRegion(id, rec.名称 ?? '', rec.描述 ?? '', reg, mapType, n),
          rooms: mvuRooms,
        });
      } else {
        buildings.push({
          ...newBuildingSlot(id, rec.名称 ?? '', rec.描述 ?? '', regionId, mapType, appendedBuildingIndex++),
          rooms: mvuRooms,
        });
      }
    }
  }

  buildings = appendBuildingsFrom区域包含建筑Refs(
    buildings,
    regions,
    区域数据,
    建筑数据,
    new Map(buildings.map(b => [b.id, b])),
    slotIndexByRegionId,
  );

  for (let i = 0; i < buildings.length; i++) {
    const id = buildings[i].id;
    const rec = 建筑数据[id];
    const acts = collectActivitiesForBuildingFromMvu(id, rec, 活动数据);
    buildings[i] = { ...buildings[i], activities: acts };
  }

  return normalizeWorld({ ...base, regions, buildings });
}

/** 仅元信息、无区域/建筑：开局空白地图 */
export function createBlankTacticalWorldShell(stat: Schema): World {
  const meta = stat.元信息;
  const worldTypeStr = (meta?.世界类型 ?? '现代').trim() || '现代';
  const worldIntro = typeof meta?.世界简介 === 'string' ? meta.世界简介 : '';
  const theme = worldTypeStringToMapStyle(worldTypeStr);
  return normalizeWorld({
    id: 'w_tactical',
    name: worldTypeStr.slice(0, 64) || '当前世界',
    theme,
    details: worldIntro,
    regions: [],
    buildings: [],
  });
}

export type SyncWorldFromMvuOptions = {
  /**
   * 为 true 时：凡变量里 `所属区域ID` 能匹配到区域，则按区域内规则重算该建筑的 x/y（保留 people/rooms 等）。
   * 用于「从变量同步到地图」——避免旧本地档把建筑留在区域外却不再挪回。
   */
  repositionAssignedBuildingsIntoRegion?: boolean;
};

/**
 * 将 MVU 区域/建筑/活动同步到当前 World：以变量为语义真相；同 id 默认保留格子与 people/rooms/customProperties，新增用占位格。
 * 变量中已不存在的 id 会从地图上移除。
 */
export function syncWorldFromMvu(previous: World, stat: Schema, options?: SyncWorldFromMvuOptions): World {
  const shell = createBlankTacticalWorldShell(stat);
  const 区域数据 = stat.区域数据 ?? {};
  const 建筑数据 = stat.建筑数据 ?? {};
  const 活动数据 = stat.活动数据 ?? {};
  const hasMap =
    Object.keys(区域数据).length > 0 ||
    Object.keys(建筑数据).length > 0 ||
    Object.keys(活动数据).length > 0;
  if (!hasMap) {
    return normalizeWorld({
      ...shell,
      id: previous.id || shell.id,
      regions: [],
      buildings: [],
    });
  }

  const prevR = new Map((previous.regions ?? []).map(r => [r.id, r]));
  const regions = sortedKeys(区域数据).map((id, idx) => {
    const rec = 区域数据[id];
    const p = prevR.get(id);
    if (p) {
      return {
        ...p,
        name: (rec.名称 ?? '').trim() || p.name,
        description: rec.描述 ?? '',
      };
    }
    return newRegionSlot(id, rec.名称 ?? '', rec.描述 ?? '', idx);
  });

  const prevB = new Map((previous.buildings ?? []).map(b => [b.id, b]));
  let newBuildingIdx = 0;
  const slotIndexByRegionId = new Map<string, number>();
  const buildings = sortedKeys(建筑数据).map(id => {
    const rec = 建筑数据[id];
    const rid = (rec.所属区域ID ?? '').trim();
    const regionId = rid === '' ? undefined : rid;
    const mvuRooms = roomsFromMvuInternalLayout(rec.内部房间布局, id);
    const acts = collectActivitiesForBuildingFromMvu(id, 建筑数据[id], 活动数据);
    const p = prevB.get(id);
    const mapType = p?.type ?? DEFAULT_MAP_BUILDING_TYPE;
    const reg = regionId ? regions.find(r => r.id === regionId) : undefined;
    if (p && options?.repositionAssignedBuildingsIntoRegion && reg) {
      const n = slotIndexByRegionId.get(regionId!) ?? 0;
      slotIndexByRegionId.set(regionId!, n + 1);
      const slot = newBuildingSlotInsideRegion(
        id,
        (rec.名称 ?? '').trim() || p.name,
        rec.描述 ?? '',
        reg,
        mapType,
        n,
      );
      return {
        ...p,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        name: (rec.名称 ?? '').trim() || p.name,
        description: rec.描述 ?? '',
        regionId: regionId ?? p.regionId,
        type: mapType,
        rooms: mvuRooms,
        activities: acts,
      };
    }
    if (p) {
      return {
        ...p,
        name: (rec.名称 ?? '').trim() || p.name,
        description: rec.描述 ?? '',
        regionId: regionId ?? p.regionId,
        type: mapType,
        rooms: mvuRooms,
        activities: acts,
      };
    }
    if (reg) {
      const n = slotIndexByRegionId.get(regionId) ?? 0;
      slotIndexByRegionId.set(regionId, n + 1);
      return {
        ...newBuildingSlotInsideRegion(id, rec.名称 ?? '', rec.描述 ?? '', reg, mapType, n),
        rooms: mvuRooms,
        activities: acts,
      };
    }
    const slot = newBuildingSlot(
      id,
      rec.名称 ?? '',
      rec.描述 ?? '',
      regionId,
      mapType,
      newBuildingIdx++,
    );
    return { ...slot, rooms: mvuRooms, activities: acts };
  });

  const buildingsMerged = appendBuildingsFrom区域包含建筑Refs(
    buildings,
    regions,
    区域数据,
    建筑数据,
    prevB,
    slotIndexByRegionId,
  );

  return normalizeWorld({
    ...shell,
    id: previous.id || shell.id,
    regions,
    buildings: buildingsMerged,
  });
}

/**
 * 用 MVU 根数据生成单张地图 World（无浏览器档、无几何缓存时）。
 * 无区域/建筑/活动记录时为空白图；有记录时从空白底 hydrate 占位格。
 */
export function buildWorldFromMvuStat(stat: Schema): World {
  const blank = createBlankTacticalWorldShell(stat);
  const 区域数据 = stat.区域数据 ?? {};
  const 建筑数据 = stat.建筑数据 ?? {};
  const 活动数据 = stat.活动数据 ?? {};
  const hasMapRecords =
    Object.keys(区域数据).length > 0 ||
    Object.keys(建筑数据).length > 0 ||
    Object.keys(活动数据).length > 0;
  if (!hasMapRecords) return blank;
  return hydrateFromRecords(blank, 区域数据, 建筑数据, 活动数据);
}

export type ExportTacticalWorldToMvuOptions = {
  /** @deprecated 地图已不再自动回写 MVU，保留字段仅为兼容旧调用 */
  fromAutoSync?: boolean;
};

/** 根据当前世界与 MVU 中已有记录，合并出将写入 store 的「区域/建筑/活动」三块（不写 store）。 */
export function buildTacticalMvuMapRecordsFromWorld(
  world: World,
  curR: Schema['区域数据'],
  curB: Schema['建筑数据'],
  curA: Schema['活动数据'],
): { 区域数据: Schema['区域数据']; 建筑数据: Schema['建筑数据']; 活动数据: Schema['活动数据'] } {
  const 区域: Schema['区域数据'] = {};
  for (const r of world.regions ?? []) {
    const prev = curR[r.id] ?? {};
    const 包含建筑: Record<string, boolean> = {};
    for (const b of world.buildings ?? []) {
      if (b.regionId === r.id) 包含建筑[b.id] = true;
    }
    区域[r.id] = {
      ...prev,
      名称: r.name,
      描述: r.description ?? '',
      包含建筑,
    };
  }
  const 建筑: Schema['建筑数据'] = {};
  for (const b of world.buildings ?? []) {
    const prevB = curB[b.id] ?? {};
    const 当前活动: Record<string, boolean> = {};
    for (const a of b.activities ?? []) 当前活动[a.id] = true;
    建筑[b.id] = {
      ...prevB,
      名称: b.name,
      描述: b.description ?? '',
      所属区域ID: b.regionId ?? '',
      内部房间布局: mapMapRoomsToMvuInternalLayout(b.rooms ?? []),
      当前活动,
      当前角色: prevB.当前角色 ?? {},
    };
  }
  const 活动: Schema['活动数据'] = {};
  for (const b of world.buildings ?? []) {
    for (const a of b.activities ?? []) {
      const prevAct = curA[a.id];
      const prevObj =
        prevAct && typeof prevAct === 'object' ? (prevAct as Schema['活动数据'][string]) : undefined;
      活动[a.id] = {
        ...prevObj,
        所在建筑ID: b.id,
        活动名称: (prevObj?.活动名称 ?? '').trim() || baseTitleFromMapActivityName(a.name),
        活动内容: prevObj?.活动内容 ?? '',
        开始时间: prevObj?.开始时间 ?? '',
        参与者: prevObj?.参与者 ?? {},
        状态: mapPhaseToMvu活动状态(a.phase),
      };
    }
  }
  return parseTacticalMvuMapTripleSnapshot({
    区域数据: 区域,
    建筑数据: 建筑,
    活动数据: 活动,
  });
}

/** 将当前地图语义写回 MVU（不写格子）；不可写时返回 false（手动同步会 toast）。 */
export function exportTacticalWorldToMvu(
  world: World,
  options?: ExportTacticalWorldToMvuOptions,
): boolean {
  if (options?.fromAutoSync) {
    if (!isRulesMvuLiveHostAtInit()) return false;
  } else if (!tryRulesMvuWritable()) {
    return false;
  }
  const store = useDataStore();
  const curR = store.data.区域数据 ?? {};
  const curB = store.data.建筑数据 ?? {};
  const curA = store.data.活动数据 ?? {};

  const { 区域数据: 区域, 建筑数据: 建筑, 活动数据: 活动 } = buildTacticalMvuMapRecordsFromWorld(
    world,
    curR,
    curB,
    curA,
  );
  if (isEqual(区域, curR) && isEqual(建筑, curB) && isEqual(活动, curA)) {
    return true;
  }
  store.data.区域数据 = 区域;
  store.data.建筑数据 = 建筑;
  store.data.活动数据 = 活动;
  bumpUpdateTime();
  return true;
}
