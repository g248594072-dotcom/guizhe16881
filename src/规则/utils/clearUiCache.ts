import {
  loadCharacterAvatarOverrides,
  persistCharacterAvatarOverrides,
  broadcastCharacterAvatarSyncToParent,
} from '../../shared/phoneCharacterAvatarStorage';

/**
 * 开局页「清理缓存」：清除本 iframe 中可安全丢弃的浏览器侧数据；可按需追加步骤。
 */
export function clearOpeningUiCache(): void {
  const ids = Object.keys(loadCharacterAvatarOverrides());
  persistCharacterAvatarOverrides({});
  for (const id of ids) {
    broadcastCharacterAvatarSyncToParent(id, '');
  }
}
