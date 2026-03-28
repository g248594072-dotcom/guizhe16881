/**
 * Phase 0：会话隔离 ID 契约
 * - chatScopeId：与当前酒馆聊天文件一致（由父窗口提供，通常即 getCurrentChatId）
 * - roleId：项目内稳定键（此处为联系人 id，如 CHR-001）
 * - conversationId：二者组合，IndexedDB 中线程主键
 */
export const LOCAL_OFFLINE_SCOPE = 'local-offline';

/** 从旧版 localStorage 迁入 IndexedDB 时使用的占位 scope */
export const LEGACY_SCOPE = 'legacy';

/** 避免与分隔符冲突，并限制长度 */
export function sanitizeRoleId(roleId: string): string {
  const t = roleId.trim() || 'unknown';
  return t.replace(/::/g, '_').slice(0, 256);
}

export function makeConversationId(chatScopeId: string, roleId: string): string {
  const scope = (chatScopeId.trim() || LOCAL_OFFLINE_SCOPE).replace(/::/g, '_');
  return `${scope}::${sanitizeRoleId(roleId)}`;
}

export function parseConversationId(conversationId: string): { chatScopeId: string; roleId: string } | null {
  const idx = conversationId.indexOf('::');
  if (idx <= 0) {
    return null;
  }
  return { chatScopeId: conversationId.slice(0, idx), roleId: conversationId.slice(idx + 2) };
}

export function resolveChatScopeId(fromParent: string | null | undefined): string {
  if (fromParent != null && String(fromParent).trim() !== '') {
    return String(fromParent).trim();
  }
  return LOCAL_OFFLINE_SCOPE;
}
