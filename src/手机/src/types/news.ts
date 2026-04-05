/**
 * 新闻系统类型定义
 * 【现实世界记者新闻系统】模块的类型定义
 * 
 * 核心概念：现实世界记者穿越到"规则模拟器"世界，用现代法律视角报道荒诞事件
 */

/** 新闻类别 */
export type NewsCategory =
  | 'headline'      // 头条 - 重大事件，规则控制相关
  | 'society'       // 社会 - 犯罪、人身权利、人格控制
  | 'entertainment' // 娱乐 - 名人八卦、性丑闻、规则下的异状
  | 'finance'       // 财经 - 经济、人身控制产业链
  | 'science'       // 科技/科学 - 用科学解释"规则"现象
  | 'column';       // 专栏 - 记者点评、讽刺

/** 新闻风格 */
export type NewsStyle = 'serious' | 'satire' | 'tabloid';

/** 报道基调 */
export type NewsTone = 'neutral' | 'critical' | 'shocked' | 'mocking' | 'concerned';

/** 触发来源 */
export type NewsTriggerSource = 'time_based' | 'event_based' | 'manual';

/** 新闻文章 */
export interface NewsArticle {
  id: string;
  category: NewsCategory;
  style: NewsStyle;
  tone: NewsTone;
  title: string;
  subtitle?: string;
  summary: string;      // 导语
  content: string;      // 正文
  source: string;       // 新闻来源（如"现实世界观察报"）
  reporter: string;     // 记者署名
  gameDate: string;     // 游戏内日期
  gameTime?: string;    // 游戏内时间（可选）
  createdAt: number;    // 实际创建时间
  triggerSource: NewsTriggerSource; // 触发来源
  views: number;
  isRead: boolean;
  imageUrl?: string;     // 配图URL（可选，暂时使用占位图）
  relatedCharacters?: string[]; // 相关角色ID
  relatedEvent?: string;  // 关联事件描述
  /** 是否包含NSFW内容 */
  hasNSFWContent?: boolean;
  /** 关键词标签 */
  tags?: string[];
}

/** 新闻生成参数 */
export interface NewsGenerationParams {
  category: NewsCategory;
  gameDate: string;
  gameTime?: string;
  /** 今日事件/剧情上下文 */
  storyContext?: string;
  /** 检测到的具体事件 */
  detectedEvent?: {
    type: string;
    description: string;
  };
  /** 强制指定风格（不指定则基于category自动选择） */
  forcedStyle?: NewsStyle;
  /** 强制指定基调 */
  forcedTone?: NewsTone;
  /** 是否允许NSFW内容 */
  allowNSFW?: boolean;
  /** 额外提示词 */
  extraPrompt?: string;
}

/** 生成的新闻内容 */
export interface GeneratedNewsContent {
  category: NewsCategory;
  style: NewsStyle;
  tone: NewsTone;
  title: string;
  subtitle?: string;
  summary: string;
  content: string;
  source: string;
  reporter: string;
  relatedCharacters?: string[];
  tags?: string[];
  hasNSFWContent?: boolean;
  generatedAt: number;
}

/** 全局设置 */
export interface NewsGlobalSettings {
  key: 'global';
  /** 自动更新是否启用 */
  autoGenerateEnabled: boolean;
  /** 定时触发间隔（小时，默认4小时） */
  intervalHours: number;
  /** 是否开启事件触发 */
  eventTriggerEnabled: boolean;
  /** 上次生成的游戏日期 */
  lastGeneratedGameDate: string;
  /** 上次检查的游戏日期 */
  lastCheckedGameDate: string;
  /** 最后更新时间戳 */
  updatedAt: number;
  /** 偏好的新闻风格 */
  preferredStyles: NewsStyle[];
  /** 当前是否允许NSFW内容 */
  allowNSFW: boolean;
}

/** 事件检测结果 */
export interface EventDetectionResult {
  hasEvent: boolean;
  eventType?: NewsEventType;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  relatedCharacters?: string[];
}

/** 新闻事件类型 */
export type NewsEventType =
  | 'conflict'        // 冲突/争斗
  | 'revelation'      // 重大发现/秘密揭露
  | 'death'           // 死亡/伤害事件
  | 'romance'         // 情感/性相关事件
  | 'mystery'         // 神秘/规则相关事件
  | 'control'         // 人格控制/行为控制
  | 'crime'           // 犯罪事件
  | 'power_change'    // 权力变动
  | 'social_issue';   // 社会问题

/** 新闻元数据 */
export interface NewsMeta {
  key: 'meta';
  /** 已生成文章数量 */
  totalArticles: number;
  /** 未读数量 */
  unreadCount: number;
  /** 最后更新时间 */
  lastUpdated: number;
}

/** 分类配置 */
export const NEWS_CATEGORY_CONFIG: Record<NewsCategory, {
  label: string;
  icon: string;
  color: string;
  description: string;
}> = {
  headline: {
    label: '头条',
    icon: 'newspaper',
    color: '#ef4444',
    description: '重大事件报道'
  },
  society: {
    label: '社会',
    icon: 'building',
    color: '#3b82f6',
    description: '人身权利、人格控制'
  },
  entertainment: {
    label: '娱乐',
    icon: 'star',
    color: '#a855f7',
    description: '名人八卦、性丑闻'
  },
  finance: {
    label: '财经',
    icon: 'chart-line',
    color: '#22c55e',
    description: '规则经济产业链'
  },
  science: {
    label: '科学',
    icon: 'flask',
    color: '#06b6d4',
    description: '科学解释规则现象'
  },
  column: {
    label: '专栏',
    icon: 'pen-nib',
    color: '#f97316',
    description: '记者点评、讽刺'
  }
};

/** 基调标签配置 */
export const NEWS_TONE_CONFIG: Record<NewsTone, {
  label: string;
  color: string;
  icon: string;
}> = {
  neutral: {
    label: '客观',
    color: '#6b7280',
    icon: 'circle'
  },
  critical: {
    label: '批判',
    color: '#dc2626',
    icon: 'exclamation-circle'
  },
  shocked: {
    label: '震惊',
    color: '#f59e0b',
    icon: 'bolt'
  },
  mocking: {
    label: '嘲讽',
    color: '#7c3aed',
    icon: 'face-grin-squint-tears'
  },
  concerned: {
    label: '关切',
    color: '#0891b2',
    icon: 'hand-holding-heart'
  }
};

/** 风格标签配置 */
export const NEWS_STYLE_CONFIG: Record<NewsStyle, {
  label: string;
  description: string;
}> = {
  serious: {
    label: '严肃',
    description: '如新华社调查报道'
  },
  satire: {
    label: '讽刺',
    description: '如洋葱新闻'
  },
  tabloid: {
    label: '八卦',
    description: '如娱乐小报'
  }
};
