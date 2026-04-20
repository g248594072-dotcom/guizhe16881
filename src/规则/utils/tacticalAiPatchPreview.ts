/**
 * 第二 API 地图变量待确认界面：从 `<UpdateVariable>` / JSON Patch 解析人类可读摘要（区域 / 建筑 / 活动 / 房间 / 人员）。
 */

import { coerceJsonPatchValue, extractJsonPatchFromTacticalAiBlock } from './jsonPatchStat';

export type TacticalAiPreviewKind = 'region' | 'building' | 'activity';

export interface TacticalAiPreviewItem {
  kind: TacticalAiPreviewKind;
  /** REG-xxx / BLD-xxx / ACT-xxx */
  id: string;
  /** 列表主标题 */
  title: string;
  /** 副标题一行 */
  subtitle?: string;
  /** 建筑：内部房间名 */
  rooms: string[];
  /** 活动：参与者名；建筑：当前在场角色键名（简化展示） */
  people: string[];
  /** 详情面板用（已合并的子路径 Patch） */
  detail: Record<string, unknown>;
}

function splitPointer(path: string): string[] {
  return path
    .replace(/^\//, '')
    .split('/')
    .map(seg => seg.replace(/~1/g, '/').replace(/~0/g, '~'))
    .filter(Boolean);
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function setDeep(target: Record<string, unknown>, parts: string[], leaf: unknown): void {
  if (parts.length === 0) return;
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const next = cur[k];
    if (!isPlainRecord(next)) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = leaf as unknown;
}

/** 自 object 取出路径上的嵌套对象（浅拷贝链路） */
function getDeepCloneLeafContainer(root: Record<string, unknown>, parts: string[]): Record<string, unknown> {
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const next = cur[k];
    if (!isPlainRecord(next)) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  return cur;
}

const REGION_ROOT = '区域数据';
const BUILD_ROOT = '建筑数据';
const ACT_ROOT = '活动数据';

export type TacticalAiPatchPreviewResult = {
  items: TacticalAiPreviewItem[];
  patchCount: number;
  rawFullSend: string;
};

function collectPeopleFromOccupants(raw: unknown): string[] {
  if (!isPlainRecord(raw)) return [];
  return Object.entries(raw)
    .filter(([, v]) => {
      if (v === true || v === 'true') return true;
      if (typeof v === 'string') return v.trim().length > 0;
      if (typeof v === 'number') return !Number.isNaN(v) && v !== 0;
      return false;
    })
    .map(([k]) => k);
}

function collectParticipants(raw: unknown): string[] {
  if (!isPlainRecord(raw)) return [];
  return Object.entries(raw)
    .filter(([, v]) => v === true || v === 'true')
    .map(([k]) => k);
}

function roomNamesFrom布局(layout: unknown): string[] {
  if (!isPlainRecord(layout)) return [];
  return Object.keys(layout).map(k => k.trim()).filter(Boolean);
}

function itemFromRegion(id: string, detail: Record<string, unknown>): TacticalAiPreviewItem {
  const name = typeof detail.名称 === 'string' ? detail.名称.trim() : '';
  const desc = typeof detail.描述 === 'string' ? detail.描述.trim() : '';
  return {
    kind: 'region',
    id,
    title: name || id,
    subtitle: desc ? (desc.length > 72 ? `${desc.slice(0, 72)}…` : desc) : undefined,
    rooms: [],
    people: [],
    detail,
  };
}

function itemFromBuilding(id: string, detail: Record<string, unknown>): TacticalAiPreviewItem {
  const name = typeof detail.名称 === 'string' ? detail.名称.trim() : '';
  const desc = typeof detail.描述 === 'string' ? detail.描述.trim() : '';
  const rooms = roomNamesFrom布局(detail.内部房间布局);
  const people = collectPeopleFromOccupants(detail.当前角色);
  const regionId = typeof detail.所属区域ID === 'string' ? detail.所属区域ID.trim() : '';
  let subtitle = regionId ? `所属区域 ${regionId}` : undefined;
  if (desc) {
    const short = desc.length > 48 ? `${desc.slice(0, 48)}…` : desc;
    subtitle = subtitle ? `${subtitle} · ${short}` : short;
  }
  return {
    kind: 'building',
    id,
    title: name || id,
    subtitle,
    rooms,
    people,
    detail,
  };
}

function itemFromActivity(id: string, detail: Record<string, unknown>): TacticalAiPreviewItem {
  const name = typeof detail.活动名称 === 'string' ? detail.活动名称.trim() : '';
  const body = typeof detail.活动内容 === 'string' ? detail.活动内容.trim() : '';
  const bid = typeof detail.所在建筑ID === 'string' ? detail.所在建筑ID.trim() : '';
  const people = collectParticipants(detail.参与者);
  let subtitle = bid ? `建筑 ${bid}` : undefined;
  const t0 = typeof detail.开始时间 === 'string' ? detail.开始时间.trim() : '';
  if (t0) subtitle = subtitle ? `${subtitle} · ${t0}` : t0;
  if (body) {
    const short = body.length > 40 ? `${body.slice(0, 40)}…` : body;
    subtitle = subtitle ? `${subtitle} · ${short}` : short;
  }
  const st = typeof detail.状态 === 'string' ? detail.状态 : '';
  if (st) subtitle = subtitle ? `${subtitle} · ${st}` : st;
  return {
    kind: 'activity',
    id,
    title: name || id,
    subtitle,
    rooms: [],
    people,
    detail,
  };
}

/**
 * 将第二 API 返回全文解析为预览项；无法解析 Patch 时返回 null。
 */
export function parseTacticalAiPatchPreview(fullSend: string): TacticalAiPatchPreviewResult | null {
  const rawFullSend = fullSend.trim();
  const patches = extractJsonPatchFromTacticalAiBlock(rawFullSend);
  if (!patches?.length) return null;

  const regions = new Map<string, Record<string, unknown>>();
  const buildings = new Map<string, Record<string, unknown>>();
  const activities = new Map<string, Record<string, unknown>>();

  for (const p of patches) {
    if (p.op !== 'add' && p.op !== 'replace') continue;
    const parts = splitPointer(p.path);
    if (parts.length < 2) continue;
    const root = parts[0];
    const id = parts[1];
    const leaf = coerceJsonPatchValue(p.value);

    if (root === REGION_ROOT) {
      const bucket = regions.get(id) ?? {};
      if (parts.length === 2 && isPlainRecord(leaf)) {
        Object.assign(bucket, leaf);
      } else if (parts.length > 2) {
        setDeep(bucket, parts.slice(2), leaf);
      }
      regions.set(id, bucket);
    } else if (root === BUILD_ROOT) {
      const bucket = buildings.get(id) ?? {};
      if (parts.length === 2 && isPlainRecord(leaf)) {
        Object.assign(bucket, leaf);
      } else if (parts.length > 2) {
        setDeep(bucket, parts.slice(2), leaf);
      }
      buildings.set(id, bucket);
    } else if (root === ACT_ROOT) {
      const bucket = activities.get(id) ?? {};
      if (parts.length === 2 && isPlainRecord(leaf)) {
        Object.assign(bucket, leaf);
      } else if (parts.length > 2) {
        setDeep(bucket, parts.slice(2), leaf);
      }
      activities.set(id, bucket);
    }
  }

  const items: TacticalAiPreviewItem[] = [];

  const regionIds = [...regions.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  for (const id of regionIds) {
    items.push(itemFromRegion(id, regions.get(id)!));
  }

  const buildingIds = [...buildings.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  for (const id of buildingIds) {
    items.push(itemFromBuilding(id, buildings.get(id)!));
  }

  const activityIds = [...activities.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  for (const id of activityIds) {
    items.push(itemFromActivity(id, activities.get(id)!));
  }

  return {
    items,
    patchCount: patches.length,
    rawFullSend,
  };
}
