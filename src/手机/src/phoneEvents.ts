/**
 * 手机事件系统
 * 提供统一的事件发布/订阅机制，支持：
 * - app-opened: APP 打开事件
 * - app-closed: APP 关闭事件
 * - go-home: 返回主屏幕
 * - message-sent: 消息发送事件
 * - message-received: 消息接收事件
 * - chat-changed: 聊天切换事件
 * - worldbook-synced: 世界书同步完成事件
 * - memory-updated: 记忆更新事件
 */

// ==================== 事件类型定义 ====================

export type PhoneEventType =
  | 'app-opened'
  | 'app-closed'
  | 'go-home'
  | 'message-sent'
  | 'message-received'
  | 'chat-changed'
  | 'worldbook-synced'
  | 'memory-updated'
  | 'context-refreshed'
  | 'contact-added'
  | 'contact-removed'
  | 'thread-deleted';

export interface PhoneEventData {
  'app-opened': { appId: string };
  'app-closed': { appId: string };
  'go-home': Record<string, never>;
  'message-sent': { conversationId: string; contactId: string; content: string };
  'message-received': { conversationId: string; contactId: string; content: string; sender: string };
  'chat-changed': { chatScopeId: string };
  'worldbook-synced': { success: boolean; error?: string };
  'memory-updated': { contactId: string; summary: string };
  'context-refreshed': { chatScopeId: string };
  'contact-added': { contactId: string; displayName: string };
  'contact-removed': { contactId: string };
  'thread-deleted': { conversationId: string; count: number };
}

export type PhoneEventHandler<T extends PhoneEventType> = (data: PhoneEventData[T]) => void;

// ==================== 事件总线 ====================

class PhoneEventBus {
  private listeners: Map<PhoneEventType, Set<PhoneEventHandler<PhoneEventType>>> = new Map();

  /**
   * 订阅事件
   */
  on<T extends PhoneEventType>(event: T, handler: PhoneEventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as PhoneEventHandler<PhoneEventType>);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /**
   * 取消订阅
   */
  off<T extends PhoneEventType>(event: T, handler: PhoneEventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as PhoneEventHandler<PhoneEventType>);
    }
  }

  /**
   * 发布事件
   */
  emit<T extends PhoneEventType>(event: T, data: PhoneEventData[T]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (e) {
          console.error(`[PhoneEvents] Handler error for event "${event}":`, e);
        }
      }
    }
  }

  /**
   * 订阅一次性事件
   */
  once<T extends PhoneEventType>(event: T, handler: PhoneEventHandler<T>): () => void {
    const wrappedHandler = (data: PhoneEventData[T]) => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    return this.on(event, wrappedHandler);
  }

  /**
   * 清除所有事件监听
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 获取某个事件的监听器数量
   */
  listenerCount(event: PhoneEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// 单例
export const phoneEvents = new PhoneEventBus();

// ==================== 便捷方法 ====================

/**
 * 发送消息事件（供内部使用）
 */
export function emitMessageSent(conversationId: string, contactId: string, content: string): void {
  phoneEvents.emit('message-sent', { conversationId, contactId, content });
}

/**
 * 接收消息事件（供内部使用）
 */
export function emitMessageReceived(
  conversationId: string,
  contactId: string,
  content: string,
  sender: string,
): void {
  phoneEvents.emit('message-received', { conversationId, contactId, content, sender });
}

/**
 * 聊天切换事件
 */
export function emitChatChanged(chatScopeId: string): void {
  phoneEvents.emit('chat-changed', { chatScopeId });
}

/**
 * 世界书同步完成事件
 */
export function emitWorldbookSynced(success: boolean, error?: string): void {
  phoneEvents.emit('worldbook-synced', { success, error });
}

/**
 * 记忆更新事件
 */
export function emitMemoryUpdated(contactId: string, summary: string): void {
  phoneEvents.emit('memory-updated', { contactId, summary });
}

/**
 * 上下文刷新事件
 */
export function emitContextRefreshed(chatScopeId: string): void {
  phoneEvents.emit('context-refreshed', { chatScopeId });
}

/**
 * 联系人添加事件
 */
export function emitContactAdded(contactId: string, displayName: string): void {
  phoneEvents.emit('contact-added', { contactId, displayName });
}

/**
 * 联系人移除事件
 */
export function emitContactRemoved(contactId: string): void {
  phoneEvents.emit('contact-removed', { contactId });
}

/**
 * 线程删除事件
 */
export function emitThreadDeleted(conversationId: string, count: number): void {
  phoneEvents.emit('thread-deleted', { conversationId, count });
}

/**
 * APP 打开事件
 */
export function emitAppOpened(appId: string): void {
  phoneEvents.emit('app-opened', { appId });
}

/**
 * APP 关闭事件
 */
export function emitAppClosed(appId: string): void {
  phoneEvents.emit('app-closed', { appId });
}

/**
 * 返回主屏幕事件
 */
export function emitGoHome(): void {
  phoneEvents.emit('go-home', {});
}

// ==================== 导出类型和总线 ====================

export type { PhoneEventBus };
