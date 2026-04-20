/**
 * 战术地图草稿：对比「当前地图」与「上次确认」生成人类可读变更列表（离开地图弹窗用）。
 */

import { isEqual } from 'lodash';
import type { World } from '../components/tacticalMap/types';
import { normalizeWorld } from '../components/tacticalMap/migrate';

const MAX_LINES = 48;

function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const it of list) m.set(it.id, it);
  return m;
}

const REGION_LABEL: Record<string, string> = {
  name: '名称',
  description: '简介',
  x: '格点 X',
  y: '格点 Y',
  width: '宽度',
  height: '高度',
  icon: '图标',
  color: '颜色',
  isNew: '新建标记',
};

const BUILDING_LABEL: Record<string, string> = {
  name: '名称',
  description: '简介',
  x: '格点 X',
  y: '格点 Y',
  width: '占地宽',
  height: '占地高',
  type: '建筑类型',
  regionId: '所属区域',
  people: '在场人员',
  activities: '活动',
  rooms: '房间',
  customProperties: '自定义属性',
  icon: '图标',
  isNew: '新建标记',
};

function changedKeys(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  keys: readonly string[],
): string[] {
  const out: string[] = [];
  for (const k of keys) {
    if (!isEqual(a[k], b[k])) out.push(k);
  }
  return out;
}

function formatKeyList(keys: string[], labels: Record<string, string>): string {
  return keys.map(k => labels[k] ?? k).join('、');
}

/**
 * @param current 当前编辑中的地图
 * @param committed 上次「确认应用」的快照
 */
export function buildTacticalMapDraftChangeLines(current: World, committed: World): string[] {
  const cur = normalizeWorld(current);
  const com = normalizeWorld(committed);
  const lines: string[] = [];

  const worldKeys = ['name', 'theme', 'details'] as const;
  const wDiff = changedKeys(
    cur as unknown as Record<string, unknown>,
    com as unknown as Record<string, unknown>,
    [...worldKeys],
  );
  if (wDiff.length) {
    const wl: Record<string, string> = { name: '世界名称', theme: '设定主题', details: '世界简介' };
    lines.push(`世界：已调整 ${formatKeyList(wDiff, wl)}`);
  }

  const curR = byId(cur.regions ?? []);
  const comR = byId(com.regions ?? []);
  const rIds = new Set([...curR.keys(), ...comR.keys()]);

  for (const id of rIds) {
    const a = curR.get(id);
    const b = comR.get(id);
    if (a && !b) {
      lines.push(`区域：新增「${a.name || id}」`);
      continue;
    }
    if (!a && b) {
      lines.push(`区域：删除「${b.name || id}」`);
      continue;
    }
    if (a && b && !isEqual(a, b)) {
      const keys = changedKeys(
        a as unknown as Record<string, unknown>,
        b as unknown as Record<string, unknown>,
        ['name', 'description', 'x', 'y', 'width', 'height', 'icon', 'color', 'isNew'],
      );
      if (keys.length) {
        lines.push(`区域「${a.name || id}」：${formatKeyList(keys, REGION_LABEL)}`);
      } else {
        lines.push(`区域「${a.name || id}」：有其它字段变化`);
      }
    }
  }

  const curB = byId(cur.buildings ?? []);
  const comB = byId(com.buildings ?? []);
  const bIds = new Set([...curB.keys(), ...comB.keys()]);

  for (const id of bIds) {
    const a = curB.get(id);
    const b = comB.get(id);
    if (a && !b) {
      lines.push(`建筑：新增「${a.name || id}」`);
      continue;
    }
    if (!a && b) {
      lines.push(`建筑：删除「${b.name || id}」`);
      continue;
    }
    if (a && b && !isEqual(a, b)) {
      const keys = changedKeys(
        a as unknown as Record<string, unknown>,
        b as unknown as Record<string, unknown>,
        [
          'name',
          'description',
          'x',
          'y',
          'width',
          'height',
          'type',
          'regionId',
          'people',
          'activities',
          'rooms',
          'customProperties',
          'icon',
          'isNew',
        ],
      );
      if (keys.length) {
        lines.push(`建筑「${a.name || id}」：${formatKeyList(keys, BUILDING_LABEL)}`);
      } else {
        lines.push(`建筑「${a.name || id}」：有其它字段变化`);
      }
    }
  }

  if (lines.length === 0) {
    return ['检测到与上次确认状态不一致（可能为布局或内部状态），建议点「确认应用」或「放弃修改」。'];
  }

  if (lines.length > MAX_LINES) {
    const extra = lines.length - MAX_LINES;
    return [...lines.slice(0, MAX_LINES), `…另有 ${extra} 条变更未完整列出，可在地图上核对后确认或放弃。`];
  }
  return lines;
}
