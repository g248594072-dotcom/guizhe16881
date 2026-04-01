import { useEffect, useMemo, useState } from 'react';
import { loadWeChatMe } from './weChatMeProfile';
import {
  broadcastCharacterAvatarSyncToParent,
  loadCharacterAvatarOverrides,
  persistCharacterAvatarOverrides,
  PHONE_CHARACTER_AVATARS_CHANGED,
  PHONE_WECHAT_ME_AVATAR_ID,
  resolveRoleAvatarDisplay,
  setCharacterAvatarOverride,
} from '../../shared/phoneCharacterAvatarStorage';

export {
  loadCharacterAvatarOverrides,
  normalizeCharacterNameForAvatar,
  PHONE_CHARACTER_AVATARS_CHANGED,
  PHONE_WECHAT_ME_AVATAR_ID,
  resolveCharacterAvatarFromBrowserOnly,
  resolveRoleAvatarDisplay,
  setCharacterAvatarOverride,
  type SetCharacterAvatarOverrideOptions,
} from '../../shared/phoneCharacterAvatarStorage';

const LEGACY_UNIFIED_KEY = 'tavern-phone:unified-avatar';

export function usePhoneCharacterAvatarOverrides(): Record<string, string> {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const fn = () => setRev(r => r + 1);
    window.addEventListener(PHONE_CHARACTER_AVATARS_CHANGED, fn);
    return () => window.removeEventListener(PHONE_CHARACTER_AVATARS_CHANGED, fn);
  }, []);
  return useMemo(() => loadCharacterAvatarOverrides(), [rev]);
}

export function migrateLegacyPhoneCharacterAvatars(): void {
  let map = loadCharacterAvatarOverrides();
  let touched = false;

  try {
    const oldUnified = localStorage.getItem(LEGACY_UNIFIED_KEY);
    if (oldUnified) {
      const p = JSON.parse(oldUnified) as { avatarUrl?: string };
      const u = typeof p?.avatarUrl === 'string' ? p.avatarUrl.trim() : '';
      if (u && !map[PHONE_WECHAT_ME_AVATAR_ID]) {
        map = { ...map, [PHONE_WECHAT_ME_AVATAR_ID]: u };
        touched = true;
      }
      localStorage.removeItem(LEGACY_UNIFIED_KEY);
    }
  } catch {
    /* */
  }

  if (!map[PHONE_WECHAT_ME_AVATAR_ID]) {
    const me = loadWeChatMe();
    const u = typeof me.avatarUrl === 'string' ? me.avatarUrl.trim() : '';
    if (u) {
      map = { ...map, [PHONE_WECHAT_ME_AVATAR_ID]: u };
      touched = true;
    }
  }

  if (touched) {
    persistCharacterAvatarOverrides(map);
    const me = map[PHONE_WECHAT_ME_AVATAR_ID];
    if (me) {
      broadcastCharacterAvatarSyncToParent(PHONE_WECHAT_ME_AVATAR_ID, me);
    }
  }
}
