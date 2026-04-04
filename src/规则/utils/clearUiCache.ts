import {
  loadCharacterAvatarOverrides,
  persistCharacterAvatarOverrides,
  broadcastCharacterAvatarSyncToParent,
} from '../../shared/phoneCharacterAvatarStorage';

/**
 * 清理日记数据（IndexedDB）
 */
async function clearDiaryData(): Promise<void> {
  const DB_NAME = 'tavern-phone-diary';
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('删除日记数据库失败'));
    });
  } catch {
    // 可能没有日记数据，忽略错误
  }
}

/**
 * 清理微信聊天记录（IndexedDB）
 */
async function clearWeChatData(): Promise<void> {
  const DB_NAME = 'tavern-phone-wechat';
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('删除微信数据库失败'));
    });
  } catch {
    // 可能没有聊天记录，忽略错误
  }
}

/**
 * 清理群聊记录（IndexedDB）
 */
async function clearGroupChatData(): Promise<void> {
  const DB_NAME = 'tavern-phone-groupchat';
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('删除群聊数据库失败'));
    });
  } catch {
    // 可能没有群聊记录，忽略错误
  }
}

/**
 * 开局页「清理缓存」：清除本 iframe 中可安全丢弃的浏览器侧数据。
 * 包括：头像缓存、日记数据。
 * 注意：聊天记录（微信/群聊）保留，与界面提示文字一致。
 */
export async function clearOpeningUiCache(): Promise<void> {
  // 1. 清理头像缓存
  const ids = Object.keys(loadCharacterAvatarOverrides());
  persistCharacterAvatarOverrides({});
  for (const id of ids) {
    broadcastCharacterAvatarSyncToParent(id, '');
  }

  // 2. 清理日记数据
  await clearDiaryData();
}
