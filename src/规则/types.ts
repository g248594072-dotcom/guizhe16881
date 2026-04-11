/**
 * 类型定义文件
 * 定义游戏中使用的所有数据类型
 */

// ==================== 游戏阶段 ====================

export enum GamePhase {
  TITLE = 'title',       // 标题界面
  OPENING = 'opening',   // 开局表单
  GAME = 'game',         // 游戏主界面
}

// ==================== 开局表单数据 ====================

// 场景时代类型
export type SceneEra = 'modern' | 'medieval' | 'fantasy' | 'future' | 'ancient';

export interface OpeningFormData {
  playerName: string;           // 玩家名称
  gameDifficulty: 'easy' | 'normal' | 'hard';  // 游戏难度
  enableWorldRules: boolean;    // 是否启用世界规则
  enableRegionalRules: boolean; // 是否启用区域规则
  enablePersonalRules: boolean; // 是否启用个人规则
  initialRules: string[];      // 初始规则选择
  // 新的书本式开局表单字段
  sceneDescription?: string;   // 场景描述
  openingSceneDetail?: string; // 开场白场景详细描述（追加到首次生成提示词）
  selectedRules?: Array<{ name: string; desc: string }>;  // 选中的规则列表
  characters?: Array<{ name: string; gender: string; desc: string }>;  // 角色列表
  sceneEra?: SceneEra;          // 场景时代/世界观类型（影响初始时间设定）
  [key: string]: any;
}

// ==================== 游戏状态数据 ====================

export interface GameStatus {
  phase: 'opening' | 'playing' | 'paused';
  turn: number;
  lastUpdated: string;
  [key: string]: any;
}

export interface RuleData {
  id: string;
  title: string;
  desc: string;
  status: 'active' | 'inactive' | 'pending';
  category: 'world' | 'regional' | 'personal';
  createdAt?: string;
  updatedAt?: string;
  /** 个人规则：MVU「适用对象」 */
  target?: string;
  /** 个人规则：MVU「名称」（规则名字） */
  ruleName?: string;
  [key: string]: any;
}

export interface CharacterBasic {
  age?: string;        // 年龄（展示用文案，如 "17 岁"）
  height?: string;     // 身高（如 "165 cm"）
  weight?: string;     // 体重（如 "48 kg"）
  threeSize?: string;  // 三围（如 "B88 W58 H89"）
  physique?: string;   // 体质特征（如 "敏感型"）
  [key: string]: any;
}

/** MVU「服装状态」单槽，与 schema 一致 */
export interface ClothingSlotZh {
  名称?: string;
  状态?: string;
  描述?: string;
}

/** 饰品单条：名字为对象键；兼容旧档仅有「状态」无「部位」 */
export interface JewelryItemZh {
  部位?: string;
  描述?: string;
  /** @deprecated 旧版佩戴/状态文案，读取时若「部位」为空则回退到此键 */
  状态?: string;
}

/** MVU「服装状态」根对象 */
export interface ClothingStateZh {
  上装?: ClothingSlotZh;
  下装?: ClothingSlotZh;
  内衣?: ClothingSlotZh;
  足部?: ClothingSlotZh;
  饰品?: Record<string, JewelryItemZh>;
}

/** 弹窗/购物车中饰品一行编辑态 */
export interface JewelryEditRow {
  name: string;
  部位: string;
  描述: string;
}

/** MVU「身体部位物理状态」单条 */
export interface BodyPartPhysicsZh {
  外观描述?: string;
  当前状态?: string;
}

export interface CharacterData {
  id: string;
  name: string;
  /**
   * 角色基础身体信息，用于展示与编辑。
   * 展示头像由 `phoneCharacterAvatarStorage`（本机）管理，与 MVU 角色档案中的头像字段无关。
   */
  basic?: CharacterBasic;
  /**
   * 数值类属性（与 MVU 角色档案.数值 对应）：
   * - affection: 好感度（约 -100~100）
   * - lust: 发情值
   * - fetish: 性癖开发值
   */
  stats?: {
    [key: string]: number | [number, string];
  };
  status: 'active' | 'inactive' | 'dead';
  description?: string;
  /** 对应变量「当前综合生理描述」 */
  currentPhysiologicalDesc?: string;
  /** 性癖详情（含等级、细节描述、自我合理化） */
  fetishDetails?: FetishDetails;
  /** 敏感部位详情（含敏感等级、生理反应、开发细节） */
  sensitivePartDetails?: SensitivePartDetails;
  /** 身份标签 */
  identityTags?: Record<string, string>;
  /** MVU「服装状态」，与变量键名一致 */
  服装状态?: ClothingStateZh;
  /** MVU「身体部位物理状态」 */
  身体部位物理状态?: Record<string, BodyPartPhysicsZh>;
  [key: string]: any;
}

/** 性癖详情 */
export interface FetishDetails {
  [fetishName: string]: FetishDetail;
}

export interface FetishDetail {
  /** 等级 */
  level: number;
  /** 细节描述 */
  description: string;
  /** 自我合理化（傲娇借口） */
  justification: string;
}

/** 敏感部位详情 */
export interface SensitivePartDetails {
  [partName: string]: SensitivePartDetail;
}

export interface SensitivePartDetail {
  /** 敏感等级 */
  level: number;
  /** 生理反应 */
  reaction: string;
  /** 开发细节 */
  devDetails: string;
}

export interface RegionData {
  id: string;
  name: string;
  description?: string;
  rules: RuleData[];
  status: 'active' | 'inactive';
  [key: string]: any;
}

// 完整的游戏数据结构（用于 MVU 变量存储）
export interface GameData {
  gameStatus: GameStatus;
  worldRules: RuleData[];
  regionalRules: RegionData[];
  personalRules: RuleData[];
  characters: CharacterData[];
  player: {
    name: string;
    settings: Record<string, any>;
  };
  meta: {
    createdAt: string;
    updatedAt: string;
    version: string;
  };
}

// ==================== 消息和选项 ====================

export interface Option {
  id: string;
  text: string;
}

export interface MessageContent {
  maintext: string;
  options: Option[];
  sum?: string;
  updateVariable?: string;
  messageId?: number;
  userMessageId?: number;
  fullMessage?: string;
}

// ==================== 请求类型 ====================

export type RequestType = 'option' | 'custom' | 'action';

export interface RequestData {
  type: RequestType;
  content: string;
  optionId?: string;
  metadata?: Record<string, any>;
}

// ==================== 请求处理器回调 ====================

export interface RequestHandlerCallbacks {
  onDisableOptions?: () => void;
  onShowGenerating?: () => void;
  onHideGenerating?: () => void;
  onEnableOptions?: () => void;
  onError?: (error: string) => void;
  onRefreshStory?: () => void;
  onStreamingUpdate?: (text: string) => void;
  onRefreshVariables?: () => void;
  onGenerationComplete?: (result: GameTurnResult) => void;
}

// ==================== 游戏回合 ====================

export interface GameTurnResult {
  generationId: string;
  maintext: string;
  options: Option[];
  sum: string;
  raw: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  maintext: string;
  options: Option[];
  sum: string;
  error?: string;
}

// ==================== 编年史 ====================

export interface ChronicleEntry {
  messageId: number;
  turnNumber: number;  // 回合编号 = messageId / 2
  sum: string;
  timestamp: string;
}

// ==================== 变量命令 ====================

export interface VariableCommand {
  name: string;
  value: string | number | boolean;
  path?: string;
}

// ==================== MVU 数据格式 ====================

export interface MvuData {
  stat_data: Record<string, any>;
  display_data?: Record<string, any>;
  delta_data?: Record<string, any>;
}

// ==================== 世界书条目 ====================

export interface WorldbookEntry {
  uid: number;
  name: string;  // 条目标题（酒馆世界书使用 name 而不是 title）
  content: string;
  comment: string;
  enabled: boolean;  // 是否启用（酒馆使用 enabled 而不是 enable）
  order: number;
  position: string;
  depth: number;
  selective: boolean;
  selectiveLogic: string;
  constant: boolean;
  key: string[];
  keysecondary: string[];
  [key: string]: any;
}

// ==================== 输出模式配置 ====================

export type OutputMode = 'single' | 'dual';

export interface SecondaryApiConfig {
  url: string;
  key: string;
  model: string;
  /** 失败后的最大重试次数（0–10），总尝试次数 = 1 + 该值 */
  maxRetries: number;
  /** 为 true 时运行时从 SillyTavern 当前聊天补全（插头）读取 URL / 密钥 / 模型，不保存密钥到变量 */
  useTavernMainConnection?: boolean;
  tasks: {
    includeVariableUpdate: boolean;
    includeWorldTrend: boolean;
    includeResidentLife: boolean;
  };
}

export interface OutputModeSettings {
  mode: OutputMode;
  secondaryApi?: SecondaryApiConfig;
}

// ==================== 导航配置 ====================

export interface NavItem {
  id: string;
  icon: string;
  label: string;
}

export interface PanelConfig {
  title: string;
  component: string;
}

// ==================== 其他设置 ====================

export type InputActionMode = 'send' | 'append';

export interface OtherSettings {
  /** 输入框行为模式：'send' 直接发送，'append' 追加到输入框 */
  inputActionMode: InputActionMode;
  /**
   * 发送消息前是否向数据库标记用户意图，以触发剧情推进（与 #send_but 监听一致）。
   */
  enableShujukuPlotAdvance: boolean;
  /**
   * 标签验证确认并将 AI 楼层写入后，调用数据库 `manualUpdate()`（与插件「立即手动更新」一致）。
   * 未安装插件时自动跳过，无影响。
   */
  enableShujukuManualUpdateAfterConfirm: boolean;
  /**
   * 编辑暂存（购物车）：规则/角色等先入队，统一检视后再写入 MVU。
   */
  enableEditStagingCart: boolean;
}

export const DEFAULT_OTHER_SETTINGS: OtherSettings = {
  inputActionMode: 'append', // 默认使用追加模式（更安全，不自动发送）
  enableShujukuPlotAdvance: true,
  enableShujukuManualUpdateAfterConfirm: true,
  enableEditStagingCart: true,
};
