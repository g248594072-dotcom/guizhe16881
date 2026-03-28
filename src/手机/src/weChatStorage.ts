import {
  copyLegacyThreadIfTargetEmpty,
  idbGetThread,
  idbPutThread,
  migrateLocalStorageThreadsOnce,
  type WeChatStoredMessage,
} from './weChatIndexedDb';
import { makeConversationId } from './weChatScope';

export type { WeChatStoredMessage };

let initPromise: Promise<void> | null = null;

/** 确保完成 LS→IDB 一次性迁移（幂等） */
export function initWeChatStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = migrateLocalStorageThreadsOnce();
  }
  return initPromise;
}

export async function loadWeChatThreadForScope(chatScopeId: string, roleId: string): Promise<WeChatStoredMessage[]> {
  await initWeChatStorage();
  return copyLegacyThreadIfTargetEmpty(chatScopeId, roleId);
}

export async function saveWeChatThreadForScope(
  chatScopeId: string,
  roleId: string,
  messages: WeChatStoredMessage[],
): Promise<void> {
  await initWeChatStorage();
  const cid = makeConversationId(chatScopeId, roleId);
  await idbPutThread(cid, messages);
}

/** 按 conversationId 直读（测试或扩展用） */
export async function loadWeChatThreadByConversationId(conversationId: string): Promise<WeChatStoredMessage[]> {
  await initWeChatStorage();
  return idbGetThread(conversationId);
}
