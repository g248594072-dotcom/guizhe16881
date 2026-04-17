/**
 * 地图 localStorage：整图（区域/建筑/活动/人员/自定义属性、World.theme、视口 pan/scale、界面皮肤）按聊天隔离。
 *
 * - **键**：`th_tactical_map_v1_${chatScopeId}`，`chatScopeId` 与 `getChatScopeId()` 一致（通常即 `SillyTavern.getCurrentChatId()`，空则 `'default'`）。
 * - **不同聊天记录**使用不同 `chatScopeId`，互不覆盖、不串档。
 * - 与 worldLifeStorage 一致，不依赖 MVU。
 */

import type { MapStyle, World } from '../components/tacticalMap/types';
import { normalizeWorld, normalizeWorlds } from '../components/tacticalMap/migrate';
import { THEMES } from '../components/tacticalMap/themePresets';

const SCHEMA_VERSION = 2 as const;
const KEY_PREFIX = 'th_tactical_map_v1_';

type SillyTavernLike = { getCurrentChatId?: () => string };

function pickSillyTavern(): SillyTavernLike | null {
  const candidates: unknown[] = [window];
  try {
    candidates.push(window.parent);
  } catch {
    /* cross-origin */
  }
  try {
    if (window.top !== window) candidates.push(window.top);
  } catch {
    /* cross-origin */
  }
  for (const w of candidates) {
    try {
      const st = (w as { SillyTavern?: SillyTavernLike })?.SillyTavern;
      if (st && typeof st.getCurrentChatId === 'function') return st;
    } catch {
      /* */
    }
  }
  return null;
}

/** 与 getChatScopeWorldbookName / worldLifeStorage 语义一致：当前聊天文件标识 */
export function getChatScopeId(): string {
  const st = pickSillyTavern();
  const raw = st?.getCurrentChatId?.() ?? '';
  const s = String(raw).trim();
  return s !== '' ? s : 'default';
}

export function tacticalMapStorageKey(scope: string): string {
  return `${KEY_PREFIX}${scope}`;
}

export interface TacticalMapPersisted {
  schemaVersion: typeof SCHEMA_VERSION;
  world: World;
  mapUiTheme: MapStyle;
  panX: number;
  panY: number;
  scale: number;
}

const MAP_STYLE_KEYS = new Set<string>(Object.keys(THEMES));

function isMapStyle(s: unknown): s is MapStyle {
  return typeof s === 'string' && MAP_STYLE_KEYS.has(s);
}

function clampNumber(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return n;
}

function parseWorldField(raw: unknown): World | null {
  if (!raw || typeof raw !== 'object') return null;
  return normalizeWorld(raw as World);
}

/**
 * 读取并校验；失败返回 null（调用方用 INITIAL_WORLD 等默认）。
 * 兼容旧版 schemaVersion=1 的 worlds[] + currentWorldId。
 */
export function loadPersisted(scope: string): TacticalMapPersisted | null {
  if (typeof localStorage === 'undefined') return null;
  const key = tacticalMapStorageKey(scope);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    const mapUiTheme = isMapStyle(o.mapUiTheme) ? o.mapUiTheme : 'sci_fi';
    const panX = clampNumber(o.panX, 0);
    const panY = clampNumber(o.panY, 0);
    const scale = Math.min(3, Math.max(0.1, clampNumber(o.scale, 1)));

    if (o.schemaVersion === SCHEMA_VERSION) {
      const world = parseWorldField(o.world);
      if (!world) return null;
      return { schemaVersion: SCHEMA_VERSION, world, mapUiTheme, panX, panY, scale };
    }

    // v1：worlds[] + currentWorldId → 合并为单 world
    if (Array.isArray(o.worlds) && o.worlds.length > 0) {
      const worlds = normalizeWorlds(o.worlds as World[]);
      const cw = typeof o.currentWorldId === 'string' ? o.currentWorldId : '';
      const picked = worlds.find(w => w.id === cw) ?? worlds[0]!;
      return {
        schemaVersion: SCHEMA_VERSION,
        world: picked,
        mapUiTheme,
        panX,
        panY,
        scale,
      };
    }

    return null;
  } catch (e) {
    console.warn('[tacticalMapBrowserStorage] load failed:', key, e);
    return null;
  }
}

export function savePersisted(scope: string, snapshot: TacticalMapPersisted): void {
  if (typeof localStorage === 'undefined') return;
  const key = tacticalMapStorageKey(scope);
  try {
    const payload: TacticalMapPersisted = {
      ...snapshot,
      schemaVersion: SCHEMA_VERSION,
      world: normalizeWorld(snapshot.world),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('[tacticalMapBrowserStorage] save failed:', key, e);
    toastr.error('地图保存失败（可能超出浏览器 localStorage 容量）');
  }
}
