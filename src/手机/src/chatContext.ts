/**
 * 酒馆正文上下文获取工具
 * 用于获取当前楼层和前几层的正文消息作为分析上下文
 */

interface TavernMessage {
  message_id: number;
  role: 'user' | 'assistant' | 'system';
  name: string;
  content: string;
  time?: number;
}

/**
 * 获取当前消息楼层ID
 */
export function getCurrentMessageId(): number {
  try {
    // 尝试从 SillyTavern 全局对象获取
    const st = (window as unknown as { parent: { SillyTavern?: { getCurrentMessageId?: () => number } } }).parent;
    if (st?.SillyTavern?.getCurrentMessageId) {
      return st.SillyTavern.getCurrentMessageId();
    }
    return -1;
  } catch {
    return -1;
  }
}

/**
 * 获取指定范围的酒馆正文消息
 * @param count 要获取的消息数量（从最新消息往前数）
 */
export function getChatMessages(count: number = 3): TavernMessage[] {
  try {
    const messages: TavernMessage[] = [];
    const currentId = getCurrentMessageId();

    if (currentId <= 0) {
      return messages;
    }

    // 获取最近 count 条消息
    for (let i = 0; i < count; i++) {
      const msgId = currentId - i;
      if (msgId < 0) break;

      try {
        // 使用全局的 getChatMessages（从酒馆助手注入）
        const msgData = (window as unknown as {
          parent: {
            getChatMessages?: (range: string | number) => Array<{
              message_id: number;
              role: string;
              name: string;
              message: string;
            }>
          }
        }).parent;

        if (msgData?.getChatMessages) {
          const result = msgData.getChatMessages(msgId);
          if (result && result.length > 0) {
            const msg = result[0];
            messages.push({
              message_id: msg.message_id,
              role: msg.role as 'user' | 'assistant' | 'system',
              name: msg.name || (msg.role === 'user' ? '玩家' : 'AI'),
              content: msg.message || '',
            });
          }
        }
      } catch (e) {
        console.warn(`[chatContext] 获取楼层 ${msgId} 消息失败:`, e);
      }
    }

    return messages.reverse(); // 按时间顺序排列
  } catch (e) {
    console.warn('[chatContext] 获取酒馆正文失败:', e);
    return [];
  }
}

/**
 * 获取当前楼层和前几层的上下文（用于角色分析）
 * @param depth 要获取的上下文深度（默认当前+前2层）
 */
export function getTavernContextForAnalysis(depth: number = 2): TavernMessage[] {
  return getChatMessages(depth + 1);
}
