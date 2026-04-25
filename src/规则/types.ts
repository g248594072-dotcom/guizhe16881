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

/** 预设场景卡片内部标签（旧预设兼容），与 MVU `元信息.世界类型` 不同 */
export type SceneEra = 'modern' | 'medieval' | 'fantasy' | 'future' | 'ancient';

/** 开局 UI 常用世界类型卡片；MVU `元信息.世界类型` 本身可为任意字符串 */
export const PRESET_WORLD_TAGS = ['现代', '西幻', '玄幻', '未来', '西方中世纪', '东方中世纪', '自定义'] as const;
export type PresetWorldTag = (typeof PRESET_WORLD_TAGS)[number];
/** 与 MVU `元信息.世界类型` 一致：任意非空字符串（预设见 PRESET_WORLD_TAGS） */
export type WorldType = string;

export function isPresetWorldTag(v: unknown): v is PresetWorldTag {
  return typeof v === 'string' && (PRESET_WORLD_TAGS as readonly string[]).includes(v);
}

export function sceneEraToWorldType(era?: SceneEra): string {
  switch (era) {
    case 'modern':
      return '现代';
    case 'medieval':
      return '西方中世纪';
    case 'fantasy':
      return '西幻';
    case 'future':
      return '未来';
    case 'ancient':
      return '东方中世纪';
    default:
      return '现代';
  }
}

/** 旧存档/旧预设中的「未定」迁移为「自定义」；其余非空字符串原样保留 */
export function migrateLegacyWorldType(v: unknown): string | undefined {
  if (v === '未定') return '自定义';
  if (typeof v === 'string') {
    const s = v.trim();
    if (s) return s;
  }
  return undefined;
}

/** 优先 `worldType`，否则由旧 `sceneEra` 推导 */
export function resolveWorldType(form: { worldType?: unknown; sceneEra?: SceneEra }): string {
  const fromForm = migrateLegacyWorldType(form.worldType);
  if (fromForm) return fromForm;
  return sceneEraToWorldType(form.sceneEra);
}

export interface OpeningFormData {
  playerName: string;           // 玩家名称
  gameDifficulty: 'easy' | 'normal' | 'hard';  // 游戏难度
  enableWorldRules: boolean;    // 是否启用世界规则
  enableRegionalRules: boolean; // 是否启用区域规则
  enablePersonalRules: boolean; // 是否启用个人规则
  initialRules: string[];      // 初始规则选择
  // 新的书本式开局表单字段
  sceneDescription?: string;   // 场景描述
  /** 开场白场景详细描述（追加到首次生成提示词）。纪历为「现代」时若含可解析公历日期（如 2008年6月10日），优先作为游戏时间 */
  openingSceneDetail?: string;
  selectedRules?: Array<{ name: string; desc: string }>;  // 选中的规则列表
  characters?: Array<{ name: string; gender: string; desc: string }>;  // 角色列表
  /** 与 MVU `元信息.世界类型` 一致；开局界面先选 */
  worldType?: WorldType;
  /** 与 MVU `元信息.世界简介` 一致；选「自定义」卡片并在弹窗填写 */
  worldIntro?: string;
  /** 为 true 表示选了「自定义」卡片且 `worldType` 为玩家填写的世界名称（用于开局提示与纪历说明） */
  customWorldFromOpening?: boolean;
  /** 开局 UI 所选世界类型卡片（现代 / 西幻 / … / 自定义）；用于预设读写，避免与 MVU 世界类型字面冲突 */
  worldTypeCard?: PresetWorldTag;
  /** @deprecated 旧开场预设兼容 */
  sceneEra?: SceneEra;
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

/** 身体槽内单件服装（服装名为对象键），与 schema 一致 */
export interface ClothingBodyGarmentZh {
  状态?: string;
  描述?: string;
}

export type ClothingBodySlotRecordZh = Record<string, ClothingBodyGarmentZh>;

/** 饰品单条：名字为对象键；兼容旧档仅有「状态」无「部位」 */
export interface JewelryItemZh {
  部位?: string;
  描述?: string;
  /** @deprecated 旧版佩戴/状态文案，读取时若「部位」为空则回退到此键 */
  状态?: string;
}

/** 服装状态「服装类」槽位（不含饰品），与 schema、角色详情与编辑弹窗一致 */
export const CLOTHING_BODY_SLOT_KEYS = ['上装', '下装', '内衣', '腿部', '足部'] as const;
export type ClothingBodySlotKeyZh = (typeof CLOTHING_BODY_SLOT_KEYS)[number];

/** MVU「服装状态」根对象 */
export interface ClothingStateZh {
  上装?: ClothingBodySlotRecordZh;
  下装?: ClothingBodySlotRecordZh;
  内衣?: ClothingBodySlotRecordZh;
  足部?: ClothingBodySlotRecordZh;
  腿部?: ClothingBodySlotRecordZh;
  饰品?: Record<string, JewelryItemZh>;
}

/** 弹窗/购物车：身体槽多行编辑 */
export interface ClothingBodyGarmentEditRow {
  slot: ClothingBodySlotKeyZh;
  name: string;
  状态: string;
  描述: string;
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

/** MVU「当前位置」：与 区域数据 / 建筑数据 / 活动数据 的键名对齐 */
export interface CharacterLocationZh {
  区域ID?: string;
  建筑ID?: string;
  活动ID?: string;
  当前行为描述?: string;
}

/** MVU「参与活动记录」单条，与 schema 一致 */
export interface ActivityParticipationRecordZh {
  开始时间?: string;
  结束时间?: string;
  参与程度?: '主要参与者' | '次要参与者' | '旁观者' | string;
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
  /** MVU「角色简介」 */
  characterIntro?: string;
  /** MVU「代表性发言」：语境 → 台词 */
  representativeQuotes?: Record<string, string>;
  /** MVU「爱好」：标签名 → 等级与原因 */
  hobbies?: Record<string, { 等级: number; 喜欢的原因?: string }>;
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
  /** MVU「当前位置」：地图语义 id + 行为描述 */
  当前位置?: CharacterLocationZh;
  /** MVU「参与活动记录」：活动 ID → 起止时间与参与程度 */
  参与活动记录?: Record<string, ActivityParticipationRecordZh>;
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
  /**
   * 为 true 时：第二 API 先**仅**跑一轮变量 Patch（不含正文美化 / NPC生活），再**单独**第二轮
   * 合并处理已勾选的附加任务（各任务仍按原逻辑，Patch 会拼进同一条 &lt;UpdateVariable&gt;）。
   * 关闭时保持旧行为（变量与正文美化可并行）。
   */
  splitSecondaryVariablePassAndExtras?: boolean;
  /**
   * 开启「正文美化」时，每回合要求生成 &lt;htmlcontent&gt; 小前端块的概率 0–100。
   * 每次美化调用独立随机；0 = 永不出块，100 = 每回必出。
   */
  maintextBeautifyHtmlcontentChance: number;
  tasks: {
    /** 第二路 generateRaw：根据原始 maintext 生成 HTML 展示层，合并进 `<maintext>`；变量仍基于原始正文 */
    includeMaintextBeautification: boolean;
    /**
     * NPC生活（配置键 includeWorldChanges）：世界大势说明与居民生活 / NPC 状态说明（第二 API 路径上一并受控）。
     * 旧版 `includeWorldTrend` / `includeResidentLife` 在加载配置时会合并为该开关。
     */
    includeWorldChanges: boolean;
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

/** 抢话/防抢话：当前角色世界书中四选一互斥启用的条目 */
export type SpeechIntentWorldbookMode = 'anti_soft' | 'anti_hard' | 'interrupt_soft' | 'interrupt_hard';

/** 各模式对应的世界书条目名称（及常见空格变体），用于匹配 `entry.name` */
export const SPEECH_INTENT_WORLDBOOK_NAME_VARIANTS: Record<SpeechIntentWorldbookMode, readonly string[]> = {
  anti_soft: ['【防抢话】一般防抢话！', '【防抢话】 一般防抢话！'],
  anti_hard: ['【防抢话】强制防抢话！！', '【防抢话】 强制防抢话！！'],
  interrupt_soft: ['【抢话】一般抢话！', '【抢话】 一般抢话！'],
  interrupt_hard: ['【抢话】强制抢话！！', '【抢话】 强制抢话！！'],
} as const;

export const SPEECH_INTENT_WORLD_MODES: SpeechIntentWorldbookMode[] = [
  'anti_soft',
  'anti_hard',
  'interrupt_soft',
  'interrupt_hard',
];

export function parseSpeechIntentWorldbookMode(v: unknown): SpeechIntentWorldbookMode {
  if (typeof v === 'string' && SPEECH_INTENT_WORLD_MODES.includes(v as SpeechIntentWorldbookMode)) {
    return v as SpeechIntentWorldbookMode;
  }
  return 'anti_soft';
}

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
   * 编辑暂存（购物车）：默认开启；先入侧栏暂存再确认写入 MVU。关闭则本界面修改立即写入且不再经暂存队列。
   */
  enableEditStagingCart: boolean;
  /**
   * 「修改是否写入对话框」：是否将修改说明写入本界面下方输入框。
   * 关闭时说明不进入输入框，暂存至发送并与 JSON Patch 同处一条 UpdateVariable。
   */
  copyStagingChangeHintsToInput: boolean;
  /** 主界面正文区顶部是否显示游戏时间条 */
  showGameTimeHud: boolean;
  /** 抢话/防抢话：世界书中四选一；默认一般防抢话 */
  speechIntentWorldbookMode: SpeechIntentWorldbookMode;
}

export const DEFAULT_OTHER_SETTINGS: OtherSettings = {
  inputActionMode: 'append', // 默认使用追加模式（更安全，不自动发送）
  enableShujukuPlotAdvance: true,
  enableShujukuManualUpdateAfterConfirm: true,
  enableEditStagingCart: true,
  copyStagingChangeHintsToInput: true,
  showGameTimeHud: true,
  speechIntentWorldbookMode: 'anti_soft',
};
