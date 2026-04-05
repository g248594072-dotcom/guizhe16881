/**
 * 新闻事件检测器
 * 【现实世界记者新闻系统】剧情变化检测模块
 * 
 * 检测剧情中的重大事件，为新闻生成提供触发源
 */

import type { EventDetectionResult, NewsEventType } from './types/news';

/** 最近检测的剧情摘要（用于对比变化） */
let lastStorySnapshot: string = '';
let lastEventDetectionTime: number = 0;

/** 检测冷却期（毫秒，避免频繁生成） */
const DETECTION_COOLDOWN = 10 * 60 * 1000; // 10分钟

/** 最小剧情长度才触发检测 */
const MIN_CONTEXT_LENGTH = 200;

/** 事件关键词映射 */
const EVENT_KEYWORDS: Record<NewsEventType, string[]> = {
  conflict: [
    '战斗', '打斗', '冲突', '争吵', '打架', '攻击', '伤害', '杀', '死', '受伤',
    '战争', '战役', '对抗', '争斗', '厮杀', '暴力', '殴打', '刺伤', '射杀',
    'fight', 'battle', 'attack', 'kill', 'death', 'murder', 'hurt', 'wound',
    'conflict', 'combat', 'war', 'assault', 'stab', 'shoot',
  ],
  revelation: [
    '真相', '发现', '秘密', '揭露', '暴露', '识破', '识破', '发觉',
    '真相大白', '揭开', '发现', '察觉', '注意到', '意识到',
    'truth', 'secret', 'discover', 'reveal', 'expose', 'uncover', 'find out',
    'realize', 'notice', 'aware',
  ],
  death: [
    '死亡', '死去', '尸体', '葬礼', '牺牲', '阵亡', '遇害', '被杀', '自杀',
    '病逝', '意外死亡', '离世', '咽气', '断气', '丧命', '毙命',
    'death', 'die', 'dead', 'corpse', 'funeral', 'killed', 'murdered', 'suicide',
    'passed away', 'deceased', 'fatal',
  ],
  romance: [
    '喜欢', '爱', '表白', '告白', '约会', '接吻', '亲吻', '拥抱', '上床',
    '做爱', '发生关系', '恋爱', '情人', '暧昧', '出轨', '偷情', '暗恋',
    '感情', '心动', '迷恋', '欲望', '诱惑', '勾引', '亲热', '缠绵',
    'love', 'like', 'confession', 'date', 'kiss', 'sex', 'make love', 'affair',
    'cheat', 'flirt', 'attracted', 'desire', 'passion', 'intimacy', 'romantic',
    'affection', 'crush', 'obsession', 'lust',
  ],
  mystery: [
    '魔法', '诅咒', '诡异', '神秘', '不可思议', '奇怪', '异常', '超自然',
    '灵异', '鬼怪', '怪物', '变异', '附身', '控制', '洗脑', '精神控制',
    '规则', '强制', '改变', '服从', '顺从', '听话', '无法反抗', '命令',
    'magic', 'curse', 'mysterious', 'strange', 'weird', 'supernatural', 'paranormal',
    'monster', 'possessed', 'control', 'brainwash', 'mind control', 'rule', 'forced',
    'change', 'obey', 'submit', 'compelled', 'command',
  ],
  control: [
    '控制', '支配', '操控', '命令', '强制', '被迫', '不得不', '必须',
    '洗脑', '精神控制', '人格改变', '记忆修改', '行为控制', '限制',
    '无法反抗', '只能服从', '顺从', '听话', '臣服', '奴性',
    'control', 'dominate', 'manipulate', 'command', 'forced', 'compelled', 'must',
    'brainwash', 'mind control', 'personality change', 'memory alter', 'behavior control',
    'restriction', 'can\'t resist', 'obey', 'submit', 'servant',
  ],
  crime: [
    '犯罪', '违法', '罪行', '作恶', '害人', '抢劫', '偷窃', '绑架', '侵犯',
    '强奸', '性骚扰', '虐待', '囚禁', '非法拘禁', '人口贩卖', '器官贩卖',
    'crime', 'illegal', 'criminal', 'evil', 'harm', 'rob', 'steal', 'kidnap',
    'violate', 'rape', 'sexual assault', 'abuse', 'imprison', 'illegal detention',
    'trafficking', 'organ trade',
  ],
  power_change: [
    '掌权', '夺权', '政变', '下台', '上位', '继位', '登基', '加冕',
    '罢免', '废黜', '革命', '起义', '反抗', '统治', '领导权',
    'power', 'seize power', 'coup', 'step down', 'rise', 'succession', 'crown',
    'depose', 'revolution', 'uprising', 'resist', 'rule', 'leadership',
  ],
  social_issue: [
    '贫困', '饥荒', '瘟疫', '疾病', '灾难', '不平等', '歧视', '压迫',
    '剥削', '阶级', '贫富差距', '奴隶', '奴役', '人权', '自由',
    'poverty', 'famine', 'plague', 'disease', 'disaster', 'inequality', 'discrimination',
    'oppression', 'exploitation', 'class', 'gap', 'slave', 'slavery', 'human rights',
    'freedom', 'liberty',
  ],
};

/** 严重程度评分关键词 */
const SEVERITY_KEYWORDS = {
  critical: ['死亡', '杀人', '被杀', '尸体', '毁灭', '灭绝', '末日', '毁灭性'],
  high: ['重伤', '严重', '重大', '危机', '灾难', '惨败', '背叛', '政变'],
  medium: ['冲突', '争吵', '发现', '改变', '影响', '损失'],
  low: ['小', '轻微', '轻微', '轻微', '细微', '略有'],
};

/**
 * 检测剧情重大事件
 * @param storyContext 剧情上下文（最近聊天记录）
 * @returns 事件检测结果
 */
export function detectMajorEvent(
  storyContext: string,
): EventDetectionResult {
  // 检查冷却期
  const now = Date.now();
  if (now - lastEventDetectionTime < DETECTION_COOLDOWN) {
    return { hasEvent: false };
  }

  // 检查上下文长度
  if (!storyContext || storyContext.length < MIN_CONTEXT_LENGTH) {
    return { hasEvent: false };
  }

  // 如果剧情没有变化，不触发
  const currentSnapshot = generateStorySnapshot(storyContext);
  if (currentSnapshot === lastStorySnapshot) {
    return { hasEvent: false };
  }

  // 检测事件类型
  const detectedEvent = analyzeEventType(storyContext);

  if (detectedEvent.hasEvent) {
    lastStorySnapshot = currentSnapshot;
    lastEventDetectionTime = now;
  }

  return detectedEvent;
}

/**
 * 生成剧情快照（用于对比变化）
 */
function generateStorySnapshot(storyContext: string): string {
  // 取前500字符的哈希特征
  const normalized = storyContext
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '') // 只保留中文和字母数字
    .slice(0, 500);

  // 简单哈希
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return hash.toString(36);
}

/**
 * 分析事件类型
 */
function analyzeEventType(storyContext: string): EventDetectionResult {
  const context = storyContext.toLowerCase();
  const scores: Record<NewsEventType, number> = {
    conflict: 0,
    revelation: 0,
    death: 0,
    romance: 0,
    mystery: 0,
    control: 0,
    crime: 0,
    power_change: 0,
    social_issue: 0,
  };

  // 计算各类事件得分
  for (const [eventType, keywords] of Object.entries(EVENT_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = context.match(regex);
      if (matches) {
        scores[eventType as NewsEventType] += matches.length;
      }
    }
  }

  // 找出得分最高的事件
  let maxScore = 0;
  let detectedType: NewsEventType | null = null;

  for (const [eventType, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = eventType as NewsEventType;
    }
  }

  // 阈值：至少3个关键词匹配才算有事件
  if (maxScore < 3 || !detectedType) {
    return { hasEvent: false };
  }

  // 确定严重程度
  const severity = determineSeverity(context);

  // 生成事件描述
  const description = generateEventDescription(detectedType, context);

  return {
    hasEvent: true,
    eventType: detectedType,
    description,
    severity,
  };
}

/**
 * 确定严重程度
 */
function determineSeverity(
  context: string,
): 'low' | 'medium' | 'high' | 'critical' {
  for (const keyword of SEVERITY_KEYWORDS.critical) {
    if (context.includes(keyword)) return 'critical';
  }
  for (const keyword of SEVERITY_KEYWORDS.high) {
    if (context.includes(keyword)) return 'high';
  }
  for (const keyword of SEVERITY_KEYWORDS.medium) {
    if (context.includes(keyword)) return 'medium';
  }
  return 'low';
}

/**
 * 生成事件描述
 */
function generateEventDescription(
  eventType: NewsEventType,
  context: string,
): string {
  const descriptions: Record<NewsEventType, string> = {
    conflict: '检测到冲突/战斗事件',
    revelation: '检测到重大发现/秘密揭露',
    death: '检测到死亡/严重伤害事件',
    romance: '检测到情感/性相关事件',
    mystery: '检测到神秘/规则相关异常',
    control: '检测到人格/行为控制事件',
    crime: '检测到犯罪行为',
    power_change: '检测到权力变动',
    social_issue: '检测到社会问题',
  };

  // 提取关键句子（包含最多关键词的句子）
  const sentences = context.split(/[。！？.!?]/);
  let keySentence = '';
  let maxKeywords = 0;

  for (const sentence of sentences.slice(-10)) { // 只看最近10句
    const keywordCount = countKeywordsInSentence(sentence);
    if (keywordCount > maxKeywords) {
      maxKeywords = keywordCount;
      keySentence = sentence;
    }
  }

  return `${descriptions[eventType]}: ${keySentence.slice(0, 100)}...`;
}

/**
 * 计算句子中的关键词数量
 */
function countKeywordsInSentence(sentence: string): number {
  let count = 0;
  const allKeywords = Object.values(EVENT_KEYWORDS).flat();

  for (const keyword of allKeywords) {
    if (sentence.includes(keyword)) {
      count++;
    }
  }

  return count;
}

/**
 * 提取最近剧情的关键摘要
 * 用于生成新闻时提供上下文
 */
export function extractStorySnippet(storyContext: string, maxLength: number = 300): string {
  if (!storyContext) return '';

  // 取最近的部分
  const recent = storyContext.slice(-maxLength * 2);

  // 按句子分割，取最重要的几句
  const sentences = recent.split(/[。！？.!?]/).filter(s => s.trim());

  // 选择包含关键词的句子
  const importantSentences = sentences.filter(sentence => {
    const allKeywords = Object.values(EVENT_KEYWORDS).flat();
    return allKeywords.some(keyword => sentence.includes(keyword));
  });

  // 如果找不到重要句子，就取最后几句
  const selectedSentences = importantSentences.length > 0
    ? importantSentences.slice(-3)
    : sentences.slice(-3);

  return selectedSentences.join('。').slice(0, maxLength) + '...';
}

/**
 * 根据事件类型推荐新闻分类
 */
export function recommendNewsCategory(
  eventType: NewsEventType,
): import('./types/news').NewsCategory {
  const mapping: Record<NewsEventType, import('./types/news').NewsCategory> = {
    conflict: 'headline',
    death: 'headline',
    crime: 'society',
    control: 'society',
    revelation: 'column',
    mystery: 'science',
    romance: 'entertainment',
    power_change: 'finance',
    social_issue: 'society',
  };

  return mapping[eventType];
}

/**
 * 重置检测状态（用于测试或重新开始）
 */
export function resetEventDetection(): void {
  lastStorySnapshot = '';
  lastEventDetectionTime = 0;
}

/**
 * 获取检测状态信息
 */
export function getDetectionStatus(): {
  lastSnapshot: string;
  lastDetectionTime: number;
  cooldownRemaining: number;
} {
  const now = Date.now();
  return {
    lastSnapshot: lastStorySnapshot,
    lastDetectionTime: lastEventDetectionTime,
    cooldownRemaining: Math.max(0, DETECTION_COOLDOWN - (now - lastEventDetectionTime)),
  };
}
