/**
 * 朋友圈类型定义
 * 模拟角色的私密社交媒体动态
 */

/** 可见性类型 */
export type MomentVisibility =
  | 'public'           // 公开 - 所有人可见
  | 'friends_only'     // 好友可见 - 基于角色关系
  | 'main_character';  // 仅本人可见（但主角也有权限看到）- 显示"仅本人可见"标签

/** 动态内容类型（决定可见性和风格） - 扩展更多样化类型 */
export type MomentContentType =
  | 'daily_life'      // 日常生活 - 好友可见
  | 'dark_thought'    // 阴暗想法 - 仅本人可见（但主角特权可窥探）
  | 'venting'         // 吐槽抱怨 - 好友可见
  | 'location_checkin' // 定位打卡 - 好友可见
  | 'mood_share'      // 心情分享 - 好友可见
  | 'observation'     // 观察感悟 - 好友可见
  | 'secret_hint';    // 暗示/隐喻 - 好友可见（但可能含有深层含义）

/** 点赞 */
export interface MomentLike {
  characterId: string;
  characterName: string;
  timestamp: number;
}

/** 评论 */
export interface MomentComment {
  id: string;
  momentId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  timestamp: number;
  gameDate: string;
  likes: MomentLike[];
  isLiked?: boolean;
  // 评论的可见性（朋友圈常见：共同好友可见）
  visibleToCharacterIds?: string[];
}

/** 朋友圈动态 */
export interface Moment {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string;

  // 内容
  content: string;
  contentType: MomentContentType;

  // 可见性
  visibility: MomentVisibility;
  // 当visibility为friends_only时，指定哪些关系可见
  allowedRelations?: string[];

  // 时间和游戏时间
  createdAt: number;
  gameDate: string;
  gameTime?: string;  // 可选的游戏内具体时间

  // 互动数据
  likes: MomentLike[];
  comments: MomentComment[];
  isLiked?: boolean;

  // 元数据
  generationMode: 'auto' | 'manual';
  location?: string;  // 定位信息（可选）
  selfJustification?: string; // 自我辩解心理活动（可选，用于生成参考）
}

/** 角色朋友圈元数据 */
export interface MomentCharacterMeta {
  characterId: string;
  autoGenerateEnabled: boolean;
  lastGeneratedAt: number;
  lastGeneratedGameDate: string;
  defaultVisibility: MomentVisibility;
  // 触发间隔配置
  triggerIntervalMessages: number;  // 消息楼层间隔（默认5-10）
  triggerIntervalMinutes: number;   // 游戏时间间隔（默认2-4小时）
}

/** 全局设置 */
export interface MomentsGlobalSettings {
  autoGenerateEnabled: boolean;
  defaultContentTypes: MomentContentType[];
  /** 消息楼层触发间隔设置 */
  intervalMessages: { min: number; max: number };
  /** 游戏时间触发间隔设置（单位：分钟） */
  intervalGameMinutes: { min: number; max: number };
  /** 是否启用消息楼层触发 */
  enableMessageTrigger: boolean;
  /** 是否启用游戏时间触发 */
  enableGameTimeTrigger: boolean;
}

/** 生成的动态结果 */
export interface GeneratedMoment {
  content: string;
  contentType: MomentContentType;
  visibility: MomentVisibility;
  location?: string;
  selfJustification?: string;
}

/** 生成的评论结果 */
export interface GeneratedMomentComment {
  authorId: string;
  authorName: string;
  content: string;
}
