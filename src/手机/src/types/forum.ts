/**
 * 论坛类型定义
 * 【面具下的树洞】论坛模块的类型定义
 */

/** 身份显示类型 */
export type ForumIdentityType =
  | 'anonymous'     // 完全匿名(随机网名)
  | 'username'      // 特征明显的自定义网名
  | 'real_name'     // 使用角色真实姓名
  | 'role_title';   // 使用身份头衔(如"总裁","学姐")

/** 帖子内容类型 */
export type ForumPostType =
  | 'seeking_validation'  // 寻求认同
  | 'venting'             // 宣泄恶意/吐槽
  | 'contrast'            // 反差人设
  | 'help'                // 求助
  | 'gossip'              // 八卦闲聊
  | 'rant';               // 暴论

/** 论坛标签 */
export type ForumTag =
  | '全部'
  | '树洞'
  | '求助'
  | '吐槽'
  | '八卦'
  | '暴论'
  | '反差';

/** 帖子数据结构 */
export interface ForumPost {
  id: string;
  characterId: string;              // 内部关联ID(不对外显示)
  characterName: string;            // 角色真实姓名(内部使用)
  identityType: ForumIdentityType;  // 本次发帖选择的身份类型
  authorName: string;               // 根据identityType生成的显示名
  authorAvatar?: string;            // 头像(可选)
  title: string;                    // 帖子标题
  content: string;                  // 帖子内容
  gameDate: string;                 // 发帖日期(游戏内日期)
  createdAt: number;                // 实际创建时间戳
  postType: ForumPostType;          // 帖子内容类型
  tags: ForumTag[];                 // 标签列表
  views: number;                    // 浏览数
  likes: number;                    // 点赞数
  comments: number;                 // 评论数
  isRead: boolean;                  // 是否已读
  isLiked: boolean;                 // 当前用户是否点赞
  /** 生成模式 */
  generationMode: 'auto' | 'manual';
  /** 额外事件描述(生成时使用的参考事件) */
  todayEvents?: string;
}

/** 评论数据结构 */
export interface ForumComment {
  id: string;
  postId: string;                   // 所属帖子ID
  characterId?: string;             // 评论者角色ID(内部)
  authorName: string;               // 评论者显示名
  identityType: ForumIdentityType;  // 评论者身份类型
  content: string;                  // 评论内容
  createdAt: number;                // 创建时间
  gameDate: string;                 // 游戏内日期
  replyTo?: {
    commentId: string;
    authorName: string;
  };                                // 回复对象
  likes: number;
  isLiked: boolean;
}

/** 生成帖子参数 */
export interface ForumGenerationParams {
  characterId: string;
  characterName: string;
  gameDate: string;
  /** 今日事件(可选，用于指导帖子内容) */
  todayEvents?: string;
  /** 额外提示词 */
  extraPrompt?: string;
  /** 强制指定的身份类型(不指定则AI自动选择) */
  forcedIdentityType?: ForumIdentityType;
  /** 强制指定的帖子类型(不指定则AI自动选择) */
  forcedPostType?: ForumPostType;
}

/** 生成结果 */
export interface GeneratedForumPost {
  title: string;
  content: string;
  identityType: ForumIdentityType;
  authorName: string;               // 根据identityType生成的网名
  postType: ForumPostType;
  tags: ForumTag[];
  generatedAt: number;
}

/** 生成评论参数 */
export interface CommentGenerationParams {
  post: ForumPost;
  characterId: string;
  characterName: string;
  gameDate: string;
  /** 回复对象(可选) */
  replyTo?: ForumComment;
}

/** 论坛元数据(每个角色) */
export interface ForumMeta {
  characterId: string;
  lastGeneratedGameDate: string;
  lastGeneratedAt: number;
  autoGenerateEnabled: boolean;
  /** 角色各身份类型的默认网名 */
  defaultUsernames: {
    anonymous: string;
    username: string;
    real_name: string;
    role_title: string;
  };
}

/** 论坛全局设置 */
export interface ForumGlobalSettings {
  key: 'global';
  /** 自动更新是否启用 */
  autoUpdateEnabled: boolean;
  /** 间隔天数(1-30天) */
  intervalDays: number;
  /** 上次检查的游戏日期 */
  lastCheckedGameDate: string;
  /** 最后更新时间戳 */
  updatedAt: number;
}

/** 网名池配置 */
export interface ForumUsernamePool {
  /** 通用匿名网名池 */
  anonymous: string[];
  /** 按性格类型划分的特征网名 */
  byPersonality: {
    arrogant: string[];   // 傲慢型
    cute: string[];       // 可爱型
    dark: string[];       // 阴暗型
    tsundere: string[];   // 傲娇型
    gentle: string[];     // 温柔型
    cool: string[];       // 高冷型
    playful: string[];    //  playful型
    mysterious: string[]; // 神秘型
  };
  /** 身份头衔模板 */
  roleTitleTemplates: string[];
}

/** 世界书导出数据结构 */
export interface ForumWorldbookExport {
  posts: Array<{
    id: string;
    authorName: string;
    identityType: ForumIdentityType;
    title: string;
    content: string;
    gameDate: string;
    postType: ForumPostType;
    tags: ForumTag[];
    likes: number;
    comments: number;
  }>;
  exportedAt: number;
}
