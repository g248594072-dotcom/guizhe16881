/**
 * 在通过 &lt;JSONPatch&gt; 成功写入 MVU 后，根据路径检测世界/区域规则变更并异步生成「世界大势」。
 * 个人规则变更仅标记待刷新；「居民生活」在变量提交后由 residentLifePending 统一触发第二 API。
 */

import { generateWorldTrend } from './worldLifeGenerator';
import { markPendingIfPersonalRulePatches } from './residentLifePending';

export type JsonPatchOp = { op: string; path: string; value?: unknown; from?: string };

function decodeJsonPointerSegment(s: string): string {
  return s.replace(/~1/g, '/').replace(/~0/g, '~');
}

function pathSegments(path: string): string[] {
  return path
    .replace(/^\//, '')
    .split('/')
    .map(decodeJsonPointerSegment)
    .filter((p) => p.length > 0);
}

function collectPathsFromPatches(patches: JsonPatchOp[]): string[] {
  const out: string[] = [];
  for (const p of patches) {
    if (p.path) out.push(p.path);
    if ((p.op === 'move' || p.op === 'copy') && p.from) out.push(p.from);
  }
  return out;
}

interface RuleTriggerSets {
  worldKeys: Set<string>;
  regionKeys: Set<string>;
  subRegional: Set<string>;
  personalKeys: Set<string>;
}

function collectRuleKeysFromPaths(paths: string[]): RuleTriggerSets {
  const worldKeys = new Set<string>();
  const regionKeys = new Set<string>();
  const subRegional = new Set<string>();
  const personalKeys = new Set<string>();

  for (const raw of paths) {
    const segs = pathSegments(raw);
    if (segs[0] === '世界规则' && segs[1]) {
      worldKeys.add(segs[1]);
      continue;
    }
    if (segs[0] === '区域规则' && segs[1]) {
      const rk = segs[1];
      if (segs[2] === '细分规则') {
        if (segs[3]) {
          subRegional.add(`${rk}::${segs[3]}`);
        } else {
          regionKeys.add(rk);
        }
      } else {
        regionKeys.add(rk);
      }
      continue;
    }
    if (segs[0] === '个人规则' && segs[1]) {
      personalKeys.add(segs[1]);
    }
  }

  return { worldKeys, regionKeys, subRegional, personalKeys };
}

async function runWorldTrendTriggersOnly(
  patches: JsonPatchOp[],
  statData: Record<string, unknown>,
): Promise<void> {
  const paths = collectPathsFromPatches(patches);
  if (!paths.length) return;

  const { worldKeys, regionKeys, subRegional } = collectRuleKeysFromPaths(paths);
  if (worldKeys.size === 0 && regionKeys.size === 0 && subRegional.size === 0) {
    return;
  }

  const 世界规则 = statData['世界规则'] as Record<string, Record<string, unknown>> | undefined;
  const 区域规则 = statData['区域规则'] as Record<string, Record<string, unknown>> | undefined;

  for (const key of worldKeys) {
    const r = 世界规则?.[key];
    if (!r || typeof r !== 'object') continue;
    const name = String(r['名称'] ?? key).trim() || key;
    const desc = String(r['效果描述'] ?? '').trim() || '（效果描述未提供）';
    const ok = await generateWorldTrend(name, 'world', desc);
    if (ok) toastr.success(`已生成世界大势说明：${name}`);
  }

  for (const rk of regionKeys) {
    const region = 区域规则?.[rk];
    if (!region || typeof region !== 'object') continue;
    const displayName = String(region['名称'] ?? rk).trim() || rk;
    const desc = String(region['效果描述'] ?? '').trim() || '（效果描述未提供）';
    const ok = await generateWorldTrend(displayName, 'regional', desc, [displayName]);
    if (ok) toastr.success(`已生成世界大势说明：${displayName}`);
  }

  for (const composite of subRegional) {
    const [regionKey, subKey] = composite.split('::');
    if (!regionKey || !subKey) continue;
    const region = 区域规则?.[regionKey];
    if (!region || typeof region !== 'object') continue;
    const 细分规则 = region['细分规则'];
    if (!细分规则 || typeof 细分规则 !== 'object') continue;
    const sub = (细分规则 as Record<string, Record<string, unknown>>)[subKey];
    if (!sub || typeof sub !== 'object') continue;
    const regionDisplay = String(region['名称'] ?? regionKey).trim() || regionKey;
    const desc = String(sub['描述'] ?? '').trim() || '（效果描述未提供）';
    const ok = await generateWorldTrend(subKey, 'regional', desc, [regionDisplay]);
    if (ok) toastr.success(`已生成世界大势说明：${subKey}`);
  }
}

/**
 * 非阻塞：在下一事件循环中根据 JSON Patch 与合并后的 stat_data 触发世界/居民生成。
 */
export function scheduleWorldLifeTriggersFromJsonPatches(
  patches: JsonPatchOp[] | null | undefined,
  statData: Record<string, unknown> | null | undefined,
): void {
  if (!patches?.length || !statData) return;

  markPendingIfPersonalRulePatches(patches);

  setTimeout(() => {
    void (async () => {
      try {
        await runWorldTrendTriggersOnly(patches, statData);
      } catch (e) {
        console.warn('[WorldLifePatch] 根据 JSON Patch 触发生成失败:', e);
      }
    })();
  }, 0);
}
