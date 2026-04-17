import type { Activity, Building, CustomProperty, Region, World } from './types';

export function normalizeCustomProperty(raw: unknown): CustomProperty {
  const o = raw as Record<string, unknown> | null | undefined;
  const id = String(o?.id ?? `cp_${Date.now()}`);
  const nameRaw = o?.name;
  const keyRaw = o?.key;
  const name =
    typeof nameRaw === 'string' && nameRaw.trim() !== ''
      ? nameRaw
      : typeof keyRaw === 'string' && keyRaw.trim() !== ''
        ? keyRaw
        : '未命名';
  return {
    id,
    name,
    description: typeof o?.description === 'string' ? o.description : '',
    value: typeof o?.value === 'string' ? o.value : String(o?.value ?? ''),
  };
}

export function normalizeActivity(a: Activity): Activity {
  const phaseOk =
    a.phase === 'upcoming' ||
    a.phase === 'ongoing' ||
    a.phase === 'ended' ||
    a.phase === 'cancelled';
  return {
    ...a,
    phase: phaseOk ? a.phase : 'ongoing',
    scope: a.scope === 'personal' || a.scope === 'collective' ? a.scope : 'collective',
  };
}

export function normalizeBuilding(b: Building): Building {
  return {
    ...b,
    customProperties: (b.customProperties ?? []).map(normalizeCustomProperty),
    activities: (b.activities ?? []).map(normalizeActivity),
  };
}

export function normalizeRegion(r: Region): Region {
  return {
    ...r,
    isNew: r.isNew === true,
  };
}

export function normalizeWorld(w: World): World {
  return {
    ...w,
    details: typeof w.details === 'string' ? w.details : '',
    buildings: (w.buildings ?? []).map(normalizeBuilding),
    regions: (w.regions ?? []).map(normalizeRegion),
  };
}

export function normalizeWorlds(worlds: World[]): World[] {
  return worlds.map(normalizeWorld);
}
