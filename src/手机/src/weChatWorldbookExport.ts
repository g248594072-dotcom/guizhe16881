import { idbExportThreadsForScope, type WeChatThreadExport } from './weChatIndexedDb';
import { initWeChatStorage } from './weChatStorage';

/** 供父窗口在主界面生成前拉取当前 scope 下全部微信会话 */
export async function exportWeChatThreadsForScope(chatScopeId: string): Promise<WeChatThreadExport[]> {
  await initWeChatStorage();
  return idbExportThreadsForScope(chatScopeId);
}
