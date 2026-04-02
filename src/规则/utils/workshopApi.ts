/**
 * 创意工坊 API 客户端
 * 封装所有云端 API 调用，处理 Discord 登录和本地 auth 存储
 */

import type { RuleSnippet, CharacterSnippet, SceneSnippet, OpeningSceneSnippet, OpeningPreset } from './openingStorage';

// 后端服务器地址（开发环境使用 localhost，生产环境换成 Render 地址）
const API_BASE_URL = process.env.WORKSHOP_API_URL || 'http://localhost:3000';

// localStorage 键名
const AUTH_STORAGE_KEY = 'rule_modifier_workshop_auth';

export type WorkshopItemType = 'rule' | 'character' | 'scene' | 'openingScene' | 'preset';
export type WorkshopItemStatus = 'pending' | 'approved' | 'rejected';

export interface WorkshopAuthor {
  id: string;
  username: string;
  avatar?: string;
}

export interface WorkshopItem {
  id: string;
  type: WorkshopItemType;
  content: RuleSnippet | CharacterSnippet | SceneSnippet | OpeningSceneSnippet | OpeningPreset;
  author: WorkshopAuthor;
  status: WorkshopItemStatus;
  rejectReason?: string;
  createdAt: number;
  downloads: number;
}

export interface AuthData {
  user: WorkshopAuthor;
  isAdmin: boolean;
  token: string; // base64 encoded user data
}

// ===== Auth Storage =====

export function saveAuth(auth: AuthData): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch (e) {
    console.warn('[workshopApi] Failed to save auth:', e);
  }
}

export function loadAuth(): AuthData | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthData;
  } catch (e) {
    console.warn('[workshopApi] Failed to load auth:', e);
    return null;
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    console.warn('[workshopApi] Failed to clear auth:', e);
  }
}

export function isAuthenticated(): boolean {
  return loadAuth() !== null;
}

export function isAdmin(): boolean {
  const auth = loadAuth();
  return auth?.isAdmin || false;
}

// ===== Discord OAuth Login =====

export async function workshopLogin(): Promise<AuthData | null> {
  return new Promise((resolve) => {
    // 打开 Discord OAuth 弹窗
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authWindow = window.open(
      `${API_BASE_URL}/auth/discord`,
      'Discord Login',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!authWindow) {
      toastr.error('无法打开登录窗口，请检查弹窗拦截设置');
      resolve(null);
      return;
    }

    // 监听 postMessage
    const messageHandler = async (event: MessageEvent) => {
      if (event.origin !== new URL(API_BASE_URL).origin) return;
      
      if (event.data?.type === 'workshop-auth-success') {
        const { code, user } = event.data.data;
        
        // 用 code 换取完整 auth 数据
        try {
          const res = await fetch(`${API_BASE_URL}/auth/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          
          if (!res.ok) throw new Error('Auth exchange failed');
          
          const data = await res.json();
          const auth: AuthData = {
            user: data.user,
            isAdmin: data.isAdmin,
            token: btoa(JSON.stringify(data.user)),
          };
          
          saveAuth(auth);
          window.removeEventListener('message', messageHandler);
          toastr.success(`欢迎，${auth.user.username}！`);
          resolve(auth);
        } catch (e) {
          toastr.error('登录失败');
          resolve(null);
        }
      }
    };

    window.addEventListener('message', messageHandler);

    // 超时处理
    const checkClosed = setInterval(() => {
      if (authWindow.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        
        // 检查 localStorage 是否有 pending auth
        setTimeout(() => {
          const pending = localStorage.getItem('workshop_auth_pending');
          if (pending) {
            localStorage.removeItem('workshop_auth_pending');
            try {
              const data = JSON.parse(pending);
              if (data.code && data.user) {
                // 重新触发 exchange
                fetch(`${API_BASE_URL}/auth/exchange`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code: data.code }),
                })
                  .then(res => res.json())
                  .then(data => {
                    const auth: AuthData = {
                      user: data.user,
                      isAdmin: data.isAdmin,
                      token: btoa(JSON.stringify(data.user)),
                    };
                    saveAuth(auth);
                    toastr.success(`欢迎，${auth.user.username}！`);
                    resolve(auth);
                  })
                  .catch(() => resolve(null));
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        }, 500);
      }
    }, 500);
  });
}

export function workshopLogout(): void {
  clearAuth();
  toastr.success('已退出登录');
}

// ===== API Calls =====

function getAuthHeaders(): Record<string, string> {
  const auth = loadAuth();
  if (!auth) return {};
  return {
    'Authorization': `Bearer ${auth.token}`,
  };
}

// 上传内容
export async function workshopUpload(
  type: WorkshopItemType,
  content: RuleSnippet | CharacterSnippet | SceneSnippet | OpeningSceneSnippet | OpeningPreset
): Promise<{ success: boolean; id?: string; message?: string }> {
  const auth = loadAuth();
  if (!auth) {
    toastr.error('请先登录 Discord');
    return { success: false };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        type,
        content,
        author: auth.user,
      }),
    });

    if (!res.ok) throw new Error('Upload failed');
    
    const data = await res.json();
    toastr.success(data.message || '上传成功');
    return data;
  } catch (e) {
    toastr.error('上传失败');
    return { success: false };
  }
}

// 获取已审核的内容列表
export async function workshopFetchItems(type: WorkshopItemType): Promise<WorkshopItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/items?type=${type}&status=approved`);
    if (!res.ok) throw new Error('Fetch failed');
    
    const data = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      type: item.type,
      content: item.content,
      author: {
        id: item.author_id,
        username: item.author_name,
        avatar: item.author_avatar,
      },
      status: item.status,
      rejectReason: item.reject_reason,
      createdAt: item.created_at,
      downloads: item.downloads,
    }));
  } catch (e) {
    console.error('[workshopApi] Fetch items failed:', e);
    return [];
  }
}

// 获取待审核列表（管理员）
export async function workshopFetchPending(): Promise<WorkshopItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/pending`, {
      headers: getAuthHeaders(),
    });
    
    if (!res.ok) {
      if (res.status === 403) {
        toastr.error('需要管理员权限');
      }
      throw new Error('Fetch pending failed');
    }
    
    const data = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      type: item.type,
      content: item.content,
      author: {
        id: item.author_id,
        username: item.author_name,
        avatar: item.author_avatar,
      },
      status: item.status,
      rejectReason: item.reject_reason,
      createdAt: item.created_at,
      downloads: item.downloads,
    }));
  } catch (e) {
    console.error('[workshopApi] Fetch pending failed:', e);
    return [];
  }
}

// 审核内容（管理员）
export async function workshopReview(
  itemId: string,
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ itemId, decision, reason }),
    });

    if (!res.ok) {
      if (res.status === 403) {
        toastr.error('需要管理员权限');
      }
      throw new Error('Review failed');
    }

    toastr.success(decision === 'approved' ? '已通过审核' : '已拒绝');
    return true;
  } catch (e) {
    toastr.error('审核操作失败');
    return false;
  }
}

// 下载内容
export async function workshopDownload(itemId: string): Promise<WorkshopItem | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/download/${itemId}`, {
      method: 'POST',
    });

    if (!res.ok) throw new Error('Download failed');

    const data = await res.json();
    return {
      id: data.id,
      type: data.type,
      content: data.content,
      author: {
        id: '', // 下载接口不返回 author_id
        username: data.author_name,
        avatar: data.author_avatar,
      },
      status: 'approved',
      createdAt: data.created_at,
      downloads: data.downloads,
    };
  } catch (e) {
    toastr.error('下载失败');
    return null;
  }
}

// 获取我的上传列表
export async function workshopFetchMyUploads(): Promise<WorkshopItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/my-uploads`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) throw new Error('Fetch uploads failed');

    const data = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      type: item.type,
      content: item.content,
      author: {
        id: item.author_id,
        username: item.author_name,
        avatar: item.author_avatar,
      },
      status: item.status,
      rejectReason: item.reject_reason,
      createdAt: item.created_at,
      downloads: item.downloads,
    }));
  } catch (e) {
    console.error('[workshopApi] Fetch uploads failed:', e);
    return [];
  }
}
