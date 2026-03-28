const STORAGE_KEY = 'tavern-phone:wechat-me';

export type WeChatMeProfile = {
  /** 主角在小手机微信里的昵称 */
  nickname: string;
  /** 头像，支持 http(s) 或 data URL */
  avatarUrl: string;
};

const defaultProfile: WeChatMeProfile = {
  nickname: '我',
  avatarUrl: '',
};

export function loadWeChatMe(): WeChatMeProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultProfile };
    }
    const p = JSON.parse(raw) as Partial<WeChatMeProfile>;
    return {
      nickname: typeof p.nickname === 'string' && p.nickname.trim() ? p.nickname.trim() : defaultProfile.nickname,
      avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl.trim() : '',
    };
  } catch {
    return { ...defaultProfile };
  }
}

export function saveWeChatMe(profile: WeChatMeProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function defaultMeAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

/** 展示用：无自定义 URL 时用 dicebear */
export function resolveMeAvatarDisplay(profile: WeChatMeProfile): string {
  if (profile.avatarUrl) {
    return profile.avatarUrl;
  }
  return defaultMeAvatarUrl(profile.nickname || 'me');
}
