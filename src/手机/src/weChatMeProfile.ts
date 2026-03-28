const STORAGE_KEY = 'tavern-phone:wechat-me';

export type WeChatMeProfile = {
  /** 主角在小手机微信里的昵称 */
  nickname: string;
  /** 头像，支持 http(s) 或 data URL */
  avatarUrl: string;
  /** 在「我」页展示壳脚本下发的注入上下文（主剧情节选、档案摘要等），便于排查 */
  showInjectDebug?: boolean;
};

const defaultProfile: WeChatMeProfile = {
  nickname: '我',
  avatarUrl: '',
  showInjectDebug: false,
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
      showInjectDebug: typeof p.showInjectDebug === 'boolean' ? p.showInjectDebug : false,
    };
  } catch {
    return { ...defaultProfile };
  }
}

export function saveWeChatMe(profile: WeChatMeProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/** 展示用：有自定义 URL 则返回，否则空串（界面层使用微信风格默认头像 SVG） */
export function resolveMeAvatarDisplay(profile: WeChatMeProfile): string {
  const u = typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : '';
  return u;
}
