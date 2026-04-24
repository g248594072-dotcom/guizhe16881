/**
 * JSON Patch（RFC 6902 子集）解析与应用，供 App.vue 用户消息解析与战术地图 AI 确认共用。
 */

import { extractAllClosedUpdateVariableBlocks, innerBodyOfUpdateVariableBlock } from './updateVariableExtract';

export type JsonPatchOp = { op: string; path: string; value?: unknown; from?: string };

/** 优先从 `<JSONPatch>` 提取数组 */
export function extractJsonPatchFromUpdateVariable(message: string): JsonPatchOp[] | null {
  const match = message.match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
  if (!match) return null;

  try {
    const jsonStr = match[1].trim();
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed as JsonPatchOp[];
    }
    return null;
  } catch (e) {
    console.warn('⚠️ [jsonPatchStat] JSON Patch 解析失败:', e);
    return null;
  }
}

/**
 * 战术地图第二 API：`formatTacticalMapAiOutputForSendBox` 有时仅输出 `<UpdateVariable>...</UpdateVariable>` 内含裸 JSON 数组。
 */
export function extractJsonPatchFromTacticalAiBlock(text: string): JsonPatchOp[] | null {
  const fromTag = extractJsonPatchFromUpdateVariable(text);
  if (fromTag && fromTag.length > 0) return fromTag;

  const blocks = extractAllClosedUpdateVariableBlocks(text);
  if (blocks.length === 0) return null;
  const inner = innerBodyOfUpdateVariableBlock(blocks[0] ?? '');
  if (!inner) return null;
  const arrMatch = inner.match(/\[[\s\S]*\]/);
  if (!arrMatch) return null;
  try {
    const parsed = JSON.parse(arrMatch[0]);
    return Array.isArray(parsed) ? (parsed as JsonPatchOp[]) : null;
  } catch {
    return null;
  }
}

/** 模型偶发把对象/数组二次编码成 JSON 字符串，写入前尝试解析 */
export function coerceJsonPatchValue(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (
    (s.startsWith('{') && s.endsWith('}')) ||
    (s.startsWith('[') && s.endsWith(']'))
  ) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return v;
}

/**
 * 应用 JSON Patch 到对象（支持 replace, add, remove, move）
 * 兼容模型偶发使用的 `insert`：与 RFC 6902 的 `add` 同义（本实现与 add/replace 赋值路径一致）
 */
export function applyJsonPatch(target: any, patches: JsonPatchOp[]): void {
  for (const patch of patches) {
    const pathParts = patch.path.replace(/^\//, '').split('/');

    switch (patch.op) {
      case 'replace':
      case 'add':
      case 'insert': {
        let current = target as Record<string, unknown>;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!(part in current)) {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
        const lastPart = pathParts[pathParts.length - 1];
        current[lastPart] = coerceJsonPatchValue(patch.value) as unknown;
        break;
      }
      case 'remove': {
        let current = target as Record<string, unknown>;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!(part in current)) break;
          current = current[part] as Record<string, unknown>;
        }
        const lastPart = pathParts[pathParts.length - 1];
        delete current[lastPart];
        break;
      }
      case 'move': {
        if (!patch.from) break;
        const fromParts = patch.from.replace(/^\//, '').split('/');
        let source = target as Record<string, unknown>;
        for (let i = 0; i < fromParts.length - 1; i++) {
          const part = fromParts[i];
          if (!(part in source)) break;
          source = source[part] as Record<string, unknown>;
        }
        const value = source[fromParts[fromParts.length - 1]];
        let current = target as Record<string, unknown>;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!(part in current)) {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
        current[pathParts[pathParts.length - 1]] = value as unknown;
        delete source[fromParts[fromParts.length - 1]];
        break;
      }
      default:
        break;
    }
  }
}
