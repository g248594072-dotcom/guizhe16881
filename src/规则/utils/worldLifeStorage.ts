/**
 * 世界大势和居民生活独立存储管理
 * 使用localStorage，按聊天文件隔离
 */

// Storage key generators - using chat ID to isolate data per chat file
const STORAGE_KEYS = {
  worldTrend: (chatId: string) => `th_world_trend_${chatId}`,
  residentLife: (chatId: string) => `th_resident_life_${chatId}`,
};

// Maximum number of records to keep
const MAX_RECORDS = 50;

// Get current chat ID from SillyTavern
function getCurrentChatId(): string {
  return SillyTavern.getCurrentChatId?.() || 'default';
}

// ==================== Type Definitions ====================

/**
 * 世界大势记录结构
 */
export interface WorldTrendRecord {
  id: string; // timestamp + random
  timestamp: number;
  triggerRule: string; // 触发规则名称
  ruleLevel: 'world' | 'regional'; // 世界或区域级
  affectedScope: string; // 影响范围描述
  dailyLifeChanges: string; // 日常生活变化描述
  randomNpcCase: {
    name: string;
    identity: string;
    lifeChange: string;
    psychological: string;
  };
  isRead: boolean;
}

/**
 * 居民生活记录结构
 */
export interface ResidentLifeRecord {
  id: string;
  timestamp: number;
  triggerRule: string; // 触发规则名称
  targetCharacter: string; // 规则目标角色
  otherCharacters: Array<{
    name: string;
    status: 'inactive' | 'retired'; // 未出场/暂时退场
    lifeDescription: string;
    abnormalChange: string; // 异常变化（如果有）
  }>;
  isRead: boolean;
}

// ==================== World Trend Records ====================

/**
 * 加载世界大势记录
 */
export function loadWorldTrendRecords(): WorldTrendRecord[] {
  const chatId = getCurrentChatId();
  const key = STORAGE_KEYS.worldTrend(chatId);
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * 保存世界大势记录
 */
export function saveWorldTrendRecord(record: WorldTrendRecord): void {
  const records = loadWorldTrendRecords();
  records.unshift(record); // New records at the front

  // Limit to max records
  if (records.length > MAX_RECORDS) {
    records.pop();
  }

  const chatId = getCurrentChatId();
  localStorage.setItem(STORAGE_KEYS.worldTrend(chatId), JSON.stringify(records));
}

/**
 * 标记世界大势记录为已读
 */
export function markWorldTrendAsRead(recordId: string): void {
  const records = loadWorldTrendRecords();
  const record = records.find((r) => r.id === recordId);
  if (record) {
    record.isRead = true;
  }

  const chatId = getCurrentChatId();
  localStorage.setItem(STORAGE_KEYS.worldTrend(chatId), JSON.stringify(records));
}

/**
 * 标记所有世界大势记录为已读
 */
export function markAllWorldTrendAsRead(): void {
  const records = loadWorldTrendRecords();
  records.forEach((r) => {
    r.isRead = true;
  });

  const chatId = getCurrentChatId();
  localStorage.setItem(STORAGE_KEYS.worldTrend(chatId), JSON.stringify(records));
}

/**
 * 获取未读世界大势记录数量
 */
export function getUnreadWorldTrendCount(): number {
  return loadWorldTrendRecords().filter((r) => !r.isRead).length;
}

// ==================== Resident Life Records ====================

/**
 * 加载居民生活记录
 */
export function loadResidentLifeRecords(): ResidentLifeRecord[] {
  const chatId = getCurrentChatId();
  const key = STORAGE_KEYS.residentLife(chatId);
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * 保存居民生活记录
 */
export function saveResidentLifeRecord(record: ResidentLifeRecord): void {
  const records = loadResidentLifeRecords();
  records.unshift(record); // New records at the front

  // Limit to max records
  if (records.length > MAX_RECORDS) {
    records.pop();
  }

  const chatId = getCurrentChatId();
  localStorage.setItem(STORAGE_KEYS.residentLife(chatId), JSON.stringify(records));
}

/**
 * 标记居民生活记录为已读
 */
export function markResidentLifeAsRead(recordId: string): void {
  const records = loadResidentLifeRecords();
  const record = records.find((r) => r.id === recordId);
  if (record) {
    record.isRead = true;
  }

  const chatId = getCurrentChatId();
  localStorage.setItem(STORAGE_KEYS.residentLife(chatId), JSON.stringify(records));
}

/**
 * 标记所有居民生活记录为已读
 */
export function markAllResidentLifeAsRead(): void {
  const records = loadResidentLifeRecords();
  records.forEach((r) => {
    r.isRead = true;
  });

  const chatId = getCurrentChatId();
  localStorage.setItem(STORAGE_KEYS.residentLife(chatId), JSON.stringify(records));
}

/**
 * 获取未读居民生活记录数量
 */
export function getUnreadResidentLifeCount(): number {
  return loadResidentLifeRecords().filter((r) => !r.isRead).length;
}

// ==================== Utility Functions ====================

/**
 * 清除当前聊天的所有世界大势和居民生活记录
 */
export function clearAllWorldLifeRecords(): void {
  const chatId = getCurrentChatId();
  localStorage.removeItem(STORAGE_KEYS.worldTrend(chatId));
  localStorage.removeItem(STORAGE_KEYS.residentLife(chatId));
  console.log('[WorldLife] 已清除所有记录');
}

/**
 * 检查当前聊天是否有任何记录
 */
export function hasWorldLifeRecords(): boolean {
  const worldRecords = loadWorldTrendRecords();
  const residentRecords = loadResidentLifeRecords();
  return worldRecords.length > 0 || residentRecords.length > 0;
}

/**
 * 获取总未读数量
 */
export function getTotalUnreadCount(): number {
  return getUnreadWorldTrendCount() + getUnreadResidentLifeCount();
}

/**
 * 生成唯一记录ID
 */
export function generateRecordId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 格式化时间显示
 */
export function formatRecordTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 minute
  if (diff < 60000) {
    return '刚刚';
  }
  // Less than 1 hour
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  }
  // Less than 24 hours
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  }
  // Default date format
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}
