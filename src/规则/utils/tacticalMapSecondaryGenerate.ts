/**
 * 地图专用：第二 API 单次 generateRaw（短上下文），与全量 processWithSecondaryApi 分离。
 */

import type { SecondaryApiConfig } from '../types';
import {
  generatePrimaryRawOrderedPrompts,
  generateSecondaryRawOrderedPrompts,
  isSecondaryApiConfigured,
} from './apiSettings';

/**
 * 地图 generateRaw 专用：避免沿用聊天预设里过小的 max_tokens（如 300），导致 JSON Patch / 建筑数组被截断无解析结果。
 * 仍可在 {@link TacticalMapSecondaryGenerateOptions.maxTokens} 中按需调高。
 */
const TACTICAL_MAP_GENERATE_RAW_DEFAULT_MAX_TOKENS = 4096;

function extractUpdateVariableBlock(raw: string): string | null {
  const m = String(raw || '').match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i);
  return m ? `<UpdateVariable>${m[1].trim()}</UpdateVariable>` : null;
}

/**
 * 将模型输出整理为可粘贴/发送的变量块（供写入酒馆发送框）。
 * 若已有完整 UpdateVariable 则原样返回；否则尝试包一层。
 */
export function formatTacticalMapAiOutputForSendBox(raw: string): string {
  const t = String(raw || '').trim();
  const block = extractUpdateVariableBlock(t);
  if (block) return block;
  const jsonLike = t.match(/\[[\s\S]*\]/);
  if (jsonLike) {
    return `<UpdateVariable>\n${jsonLike[0].trim()}\n</UpdateVariable>`;
  }
  return `<UpdateVariable>\n${t}\n</UpdateVariable>`;
}

export type TacticalMapSecondaryGenerateOptions = {
  /** 顶栏黄条文案（与全局「变量更新」区分）；不传则用默认地图提示 */
  bannerMessage?: string;
  /** 覆盖本次请求的 max_tokens；默认 {@link TACTICAL_MAP_GENERATE_RAW_DEFAULT_MAX_TOKENS} */
  maxTokens?: number;
};

/** 判断模型输出是否像「未写完的 JSON 数组」（常见于 max_tokens 截断） */
export function isProbablyTruncatedJsonArray(raw: string): boolean {
  let t = String(raw ?? '').trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) t = fence[1].trim();
  if (!t.startsWith('[')) return false;
  if (!t.endsWith(']')) return true;
  try {
    const v = JSON.parse(t) as unknown;
    return !Array.isArray(v);
  } catch {
    return true;
  }
}

export async function runTacticalMapSecondaryGenerate(
  systemPrompt: string,
  userPrompt: string,
  config: SecondaryApiConfig,
  options?: TacticalMapSecondaryGenerateOptions,
): Promise<string> {
  const cap = Math.min(65536, Math.max(256, Math.floor(Number(options?.maxTokens) || TACTICAL_MAP_GENERATE_RAW_DEFAULT_MAX_TOKENS)));
  const banner = options?.bannerMessage?.trim() || 'AI 正在处理地图请求…';
  const common = { maxTokens: cap, bannerMessage: banner };

  if (!isSecondaryApiConfigured(config)) {
    console.info('[TacticalMap] 第二 API 未配置，改用主连接（第一 API）');
    toastr.info('第二 API 未配置，已改用主连接生成');
    return generatePrimaryRawOrderedPrompts(systemPrompt, userPrompt, {
      ...common,
      bannerMessage: 'AI 正在使用主连接生成地图…',
    });
  }

  try {
    return await generateSecondaryRawOrderedPrompts(systemPrompt, userPrompt, config, common);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[TacticalMap] 第二 API 失败，改用主连接:', e);
    toastr.warning(`第二 API 失败（${msg}），已改用主连接重试`);
    return generatePrimaryRawOrderedPrompts(systemPrompt, userPrompt, {
      ...common,
      bannerMessage: 'AI 正在使用主连接生成地图…',
    });
  }
}
