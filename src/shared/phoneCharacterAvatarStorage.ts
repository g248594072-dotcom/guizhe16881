/**
 * 角色头像子系统：与 MVU / 角色档案变量里的「头像」字段无关，可单独演进。
 * - 持久化：本页 localStorage（`tavern-phone:character-avatars`）+ 可选父窗口 postMessage 中继（跨 iframe/端口）。
 * - 按角色 id 存一条；保存时若带 displayName，会额外写入「同名键」`__byname__:规范化姓名`，
 *   同名角色可共用一张图。
 * - 规则页、手机「角色档案」等 UI 请用 `resolveCharacterAvatarFromBrowserOnly`，不要用 MVU 里的链接作 fallback。
 * - 微信联系人头像亦只用本机 overrides（`resolveCharacterAvatarFromBrowserOnly`），不再合并壳/变量里的 URL。
 */

const STORAGE_KEY = 'tavern-phone:character-avatars';

/** 微信「我」页专用键（小手机）；不参与按姓名共享 */
export const PHONE_WECHAT_ME_AVATAR_ID = '__wechat_me__';

const NAME_OVERRIDE_PREFIX = '__byname__:';

/** 用于「同名共享」：去首尾空白、中间连续空白压成单空格 */
export function normalizeCharacterNameForAvatar(name: string): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function nameOverrideStorageKey(displayName: string): string | null {
  const n = normalizeCharacterNameForAvatar(displayName);
  if (!n) {
    return null;
  }
  return `${NAME_OVERRIDE_PREFIX}${n}`;
}

export const PHONE_CHARACTER_AVATARS_CHANGED = 'tavern-phone-character-avatars-changed';

/** 子 iframe → 父窗口 → 壳转发：跨端口同步头像 */
export const PHONE_CHARACTER_AVATAR_SYNC_TYPE = 'tavern-phone:character-avatar-sync';

/** 子 iframe 挂载后向父窗口请求壳内已缓存的头像镜像（本地多端口时用） */
export const PHONE_CHARACTER_AVATAR_MIRROR_REQUEST = 'tavern-phone:request-avatar-mirror';

function parseMap(raw: string | null): Record<string, string> {
  if (!raw) {
    return {};
  }
  try {
    const p = JSON.parse(raw) as { overrides?: Record<string, unknown> };
    const o = p?.overrides;
    if (!o || typeof o !== 'object') {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && v.trim()) {
        out[k] = v.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function loadCharacterAvatarOverrides(): Record<string, string> {
  try {
    return parseMap(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

export function persistCharacterAvatarOverrides(map: Record<string, string>): void {
  try {
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ overrides: map }));
    }
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new Event(PHONE_CHARACTER_AVATARS_CHANGED));
}

/**
 * 仅写本 iframe 的 localStorage + 触发本页事件（用于父窗口转发回来的数据，避免再次向 parent post）
 */
export function applyCharacterAvatarOverrideLocal(roleId: string, avatarUrl: string): void {
  const id = typeof roleId === 'string' ? roleId.trim() : '';
  if (!id) {
    return;
  }
  const u = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  const map = { ...loadCharacterAvatarOverrides() };
  if (!u) {
    delete map[id];
  } else {
    map[id] = u;
  }
  persistCharacterAvatarOverrides(map);
}

/** 仅通知父窗口（例如迁移完成后补发一次） */
export function broadcastCharacterAvatarSyncToParent(roleId: string, avatarUrl: string): void {
  try {
    if (typeof window === 'undefined' || window.parent === window) {
      return;
    }
    window.parent.postMessage(
      {
        type: PHONE_CHARACTER_AVATAR_SYNC_TYPE,
        roleId,
        avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
      },
      '*',
    );
  } catch {
    /* */
  }
}

export type SetCharacterAvatarOverrideOptions = {
  /**
   * 档案/微信里的展示姓名；与 id 同时写入时，其他相同规范化姓名的角色也会显示该头像。
   * 不要用于 PHONE_WECHAT_ME_AVATAR_ID。
   */
  displayName?: string | null;
};

/** 本机覆盖：先按 id，再按同名键；否则用 remoteUrl（外链/壳下发的非 MVU 头像等） */
export function resolveRoleAvatarDisplay(
  roleId: string,
  remoteUrl: string | undefined | null,
  overrides: Record<string, string>,
  displayName?: string | null,
): string {
  const id = typeof roleId === 'string' ? roleId.trim() : '';
  if (id && overrides[id]?.trim()) {
    return overrides[id].trim();
  }
  const nk = nameOverrideStorageKey(displayName ?? '');
  if (nk && overrides[nk]?.trim()) {
    return overrides[nk].trim();
  }
  return typeof remoteUrl === 'string' ? remoteUrl.trim() : '';
}

/**
 * 与 MVU 角色档案中的头像字段解耦：只读本机 overrides + 同名键，不读变量里的 头像链接。
 */
export function resolveCharacterAvatarFromBrowserOnly(
  roleId: string,
  overrides: Record<string, string>,
  displayName?: string | null,
): string {
  return resolveRoleAvatarDisplay(roleId, '', overrides, displayName);
}

/**
 * @param avatarUrl 空串则清除该 id 的覆盖；若提供 displayName 则同时清除同名键。
 */
export function setCharacterAvatarOverride(
  roleId: string,
  avatarUrl: string,
  options?: SetCharacterAvatarOverrideOptions,
): void {
  const id = typeof roleId === 'string' ? roleId.trim() : '';
  if (!id) {
    return;
  }
  const u = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  applyCharacterAvatarOverrideLocal(id, u);
  broadcastCharacterAvatarSyncToParent(id, u);

  const nameKey = nameOverrideStorageKey(options?.displayName ?? '');
  if (nameKey) {
    applyCharacterAvatarOverrideLocal(nameKey, u);
    broadcastCharacterAvatarSyncToParent(nameKey, u);
  }
}
