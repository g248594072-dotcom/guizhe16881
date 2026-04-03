import { idbExportThreadsForScope, type WeChatThreadExport } from './weChatIndexedDb';
import { initWeChatStorage } from './weChatStorage';
import { exportGroupChatThreadsForScope, type GroupChatThreadExport } from './groupChatWorldbookExport';

/** 私聊线程导出 */
export type { WeChatThreadExport };

/** 群聊线程导出 */
export type { GroupChatThreadExport };

/** 综合导出结果：私聊 + 群聊 */
export interface PhoneThreadsExport {
  /** 私聊线程列表 */
  privateThreads: WeChatThreadExport[];
  /** 群聊线程列表 */
  groupThreads: GroupChatThreadExport[];
}

/** 供父窗口在主界面生成前拉取当前 scope 下全部微信会话（私聊 + 群聊） */
export async function exportWeChatThreadsForScope(chatScopeId: string): Promise<PhoneThreadsExport> {
  await initWeChatStorage();

  const [privateThreads, groupThreads] = await Promise.all([
    idbExportThreadsForScope(chatScopeId),
    exportGroupChatThreadsForScope(chatScopeId),
  ]);

  return {
    privateThreads,
    groupThreads,
  };
}

/** 兼容旧接口：只导出私聊线程 */
export async function exportPrivateThreadsForScope(chatScopeId: string): Promise<WeChatThreadExport[]> {
  await initWeChatStorage();
  return idbExportThreadsForScope(chatScopeId);
}
