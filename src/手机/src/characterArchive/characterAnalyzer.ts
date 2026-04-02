/**
 * 角色分析器（CharacterAnalyzer）
 * 基于 MVU 角色档案 + 聊天历史，通过副 API 生成动态角色分析结果
 * 适配 src/规则/schema.ts 中的角色档案格式
 */

import { getAnalysisScheduler, type AnalysisTask } from './analysisScheduler';
import { requestCharacterArchiveFromShell, syncCharacterAnalysisToWorldbook } from './bridge';
import { loadWeChatThreadForScope } from '../weChatStorage';
import { getChatScopeId } from '../tavernPhoneBridge';
import { getTavernContextForAnalysis } from '../chatContext';

/** 分析结果（写入 MVU 变量）- 完整角色档案 */
export interface CharacterAnalysisResult {
  characterId: string;
  // 基础信息
  姓名?: string;
  性别?: string;
  年龄?: number;
  职业?: string;
  外貌?: string;
  外貌细节?: string;
  // 性格
  personality?: Record<string, string>;
  // 性癖和敏感部位
  fetishes?: Record<string, { 等级: number; 细节描述: string; 自我合理化: string }>;
  sensitiveParts?: Record<string, { 敏感等级: number; 生理反应: string; 开发细节: string }>;
  // 背景故事
  背景故事?: string;
  // 兴趣爱好
  兴趣爱好?: string[];
  // 生活习惯
  生活习惯?: string[];
  // 说话风格
  说话风格?: string;
  日常对话示例?: string[];
  // 当前状态
  currentThought?: string;
  currentPhysiologicalDescription?: string;
  // 数值
  stats?: {
    好感度?: number;
    发情值?: number;
    性癖开发值?: number;
  };
  // 身份标签
  identityTags?: Record<string, string>;
}

/** 角色动态分析结果 - 近期动态变化 */
export interface CharacterDynamicsResult {
  characterId: string;
  characterName: string;
  // 行为变化
  behaviorChange?: string;
  // 性格微调
  personalityTweak?: string;
  // 语言风格
  languageStyle?: string;
  // 个人目标
  personalGoal?: string;
  // 生成时间
  generatedAt: string;
}

type CallAPIOptions = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
};

type CallAPI = (prompt: string, opts: CallAPIOptions) => Promise<string>;

/** 角色分析器单例 */
class CharacterAnalyzer {
  private callApi: CallAPI | null = null;
  private initialized = false;

  /** 注入 API 调用函数 */
  setApiCaller(fn: CallAPI): void {
    this.callApi = fn;
    this.init();
  }

  private init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const scheduler = getAnalysisScheduler();
    scheduler.setProcessor(async (task: AnalysisTask) => {
      if (task.type === 'ANALYZE_CHARACTER') {
        await this.analyzeCharacter(task.characterId, task.characterName);
      } else if (task.type === 'ANALYZE_DYNAMICS') {
        await this.analyzeDynamics(task.characterId, task.characterName);
      }
    });
  }

  /** 执行角色分析 */
  async analyzeCharacter(characterId: string, characterName: string): Promise<CharacterAnalysisResult | null> {
    try {
      const profile = await this.getBaseProfile(characterId);
      if (!profile) {
        console.warn('[analyzer] 未找到角色档案:', characterId);
        return null;
      }

      if (!this.callApi) {
        console.warn('[analyzer] 未配置 API 调用函数');
        return null;
      }

      // 读取该联系人的微信聊天记录作为上下文
      const chatScopeId = getChatScopeId();
      const chatHistory = await loadWeChatThreadForScope(chatScopeId, characterId);
      const recentMessages = chatHistory.slice(-20); // 取最近20条
      console.log(`[analyzer] 读取到 ${recentMessages.length} 条聊天记录用于分析`);

      // 读取酒馆正文上下文（当前楼层+前2层）
      const tavernContext = getTavernContextForAnalysis(2);
      console.log(`[analyzer] 读取到 ${tavernContext.length} 层酒馆正文用于分析`);

      // 构建分析提示词（包含聊天记录上下文）
      const prompt = this.buildAnalysisPrompt(characterName, profile, recentMessages, tavernContext);
      const raw = await this.callApi(prompt, {
        apiBaseUrl: (window as unknown as Record<string, string>).__PHONE_API_BASE__ || '',
        apiKey: (window as unknown as Record<string, string>).__PHONE_API_KEY__ || '',
        model: (window as unknown as Record<string, string>).__PHONE_API_MODEL__ || 'gpt-4o',
      });

      // 解析结果
      const result = this.parseAnalysisResult(raw, characterId);
      if (!result) {
        console.warn('[analyzer] 解析分析结果失败');
        return null;
      }

      // 直接同步到世界书（不写回 MVU 变量）
      const updates: Record<string, unknown> = {
        姓名: result.姓名 || characterName,
        性别: result.性别,
        年龄: result.年龄,
        职业: result.职业,
        外貌: result.外貌,
        外貌细节: result.外貌细节,
        性格: result.personality,
        性癖: result.fetishes,
        敏感部位: result.sensitiveParts,
        背景故事: result.背景故事,
        兴趣爱好: result.兴趣爱好,
        生活习惯: result.生活习惯,
        说话风格: result.说话风格,
        日常对话示例: result.日常对话示例,
        身份标签: result.identityTags,
      };

      // 移除 undefined 值
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });

      // 提取关键词（结合 base profile 和 AI 分析结果）
      const keywords = profile
        ? this.extractCharacterKeywords(profile, characterName, updates)
        : characterName;

      const wbResult = await syncCharacterAnalysisToWorldbook(
        characterId,
        updates,
        {
          keywords: keywords, // 英文逗号分隔的关键词
          preventRecursion: true, // 禁止双递归
        },
      );
      if (wbResult.ok) {
        console.log('[analyzer] ✅ 角色档案已同步到世界书:', characterId);
      } else {
        console.warn('[analyzer] ⚠️ 角色档案同步到世界书失败:', wbResult.error);
      }

      console.log('[analyzer] 角色分析完成:', characterId, result);

      // 角色档案分析完成后自动触发角色动态分析
      console.log('[analyzer] 开始自动触发角色动态分析...');
      try {
        await this.analyzeDynamics(characterId, characterName);
      } catch (dynErr) {
        console.warn('[analyzer] 自动角色动态分析失败，不影响角色档案结果:', dynErr);
      }

      return result;
    } catch (e) {
      console.error('[analyzer] 角色分析异常:', e);
      return null;
    }
  }

  /** 执行角色动态分析 - 生成近期动态报告 */
  async analyzeDynamics(characterId: string, characterName: string): Promise<CharacterDynamicsResult | null> {
    try {
      console.log(`[analyzer] 开始角色动态分析: ${characterId} (${characterName})`);

      const profile = await this.getBaseProfile(characterId);
      if (!profile) {
        console.warn('[analyzer] 未找到角色档案:', characterId);
        return null;
      }

      if (!this.callApi) {
        console.warn('[analyzer] 未配置 API 调用函数');
        return null;
      }

      // 读取该联系人的微信聊天记录作为上下文
      const chatScopeId = getChatScopeId();
      console.log(`[analyzer] 获取聊天记录 - chatScopeId: ${chatScopeId}, characterId: ${characterId}`);
      const chatHistory = await loadWeChatThreadForScope(chatScopeId, characterId);
      const recentMessages = chatHistory.slice(-30); // 取最近30条
      console.log(`[analyzer] 读取到 ${recentMessages.length} 条聊天记录用于动态分析`);

      // 读取酒馆正文上下文（当前楼层+前3层）
      const tavernContext = getTavernContextForAnalysis(3);
      console.log(`[analyzer] 读取到 ${tavernContext.length} 层酒馆正文用于动态分析`);

      // 获取所有关键词（名字、昵称、外号、职务、别称等）
      const keywords = this.extractCharacterKeywords(profile, characterName);
      console.log(`[analyzer] 提取到关键词: ${keywords}`);

      // 构建动态分析提示词
      const prompt = this.buildDynamicsPrompt(characterName, profile, recentMessages, tavernContext);
      console.log('[analyzer] 动态分析提示词长度:', prompt.length);
      console.log('[analyzer] 动态分析提示词前200字符:', prompt.substring(0, 200));

      console.log('[analyzer] 开始调用API进行动态分析...');
      const raw = await this.callApi(prompt, {
        apiBaseUrl: (window as unknown as Record<string, string>).__PHONE_API_BASE__ || '',
        apiKey: (window as unknown as Record<string, string>).__PHONE_API_KEY__ || '',
        model: (window as unknown as Record<string, string>).__PHONE_API_MODEL__ || 'gpt-4o',
      });
      console.log('[analyzer] API返回动态分析结果长度:', raw.length);
      console.log('[analyzer] API返回动态分析结果前500字符:', raw.substring(0, 500));

      // 解析结果
      const result = this.parseDynamicsResult(raw, characterId, characterName);
      if (!result) {
        console.warn('[analyzer] 解析动态分析结果失败');
        return null;
      }
      console.log('[analyzer] 动态分析结果解析成功:', result);

      // 同步到世界书 - 动态报告
      const dynamicsContent = this.formatDynamicsForWorldbook(result);
      const wbResult = await syncCharacterAnalysisToWorldbook(
        `${characterId}_dynamics`,
        {
          姓名: `${characterName}的近期动态`,
          当前内心想法: dynamicsContent,
          身份标签: { 类型: '动态报告' },
        },
        {
          position: 'afterCharDef', // 角色定义后
          priority: 100 + Math.floor(Math.random() * 51), // 100-150 随机优先级
          keywords: keywords, // 英文逗号分隔的关键词
          preventRecursion: true, // 禁止双递归
        },
      );
      if (wbResult.ok) {
        console.log('[analyzer] ✅ 角色动态已同步到世界书:', characterId);
      } else {
        console.warn('[analyzer] ⚠️ 角色动态同步到世界书失败:', wbResult.error);
      }

      console.log('[analyzer] 角色动态分析完成:', characterId, result);
      return result;
    } catch (e) {
      console.error('[analyzer] 角色动态分析异常:', e);
      return null;
    }
  }

  /** 提取角色的所有关键词（名字、昵称、外号、职务、别称等） */
  private extractCharacterKeywords(
    profile: Record<string, unknown>,
    defaultName: string,
    aiResult?: Record<string, unknown>,
  ): string {
    const keywords = new Set<string>();

    const name = (profile.姓名 as string) || defaultName;
    keywords.add(name);
    if (defaultName && defaultName !== name) keywords.add(defaultName);

    // 从 profile 和 AI 结果中提取更多数据
    const sources = [profile, aiResult].filter(Boolean) as Record<string, unknown>[];
    for (const src of sources) {
      // 身份标签
      const tags = src['身份标签'] as Record<string, string> | undefined;
      if (tags && typeof tags === 'object') {
        Object.values(tags).forEach(tag => {
          if (tag && typeof tag === 'string' && tag.length <= 20) {
            keywords.add(tag);
          }
        });
      }

      // 职业
      if (typeof src['职业'] === 'string' && src['职业']) {
        keywords.add(src['职业'] as string);
      }

      // 性格中的短标签（如"猫系少女"）
      const personality = src['性格'] as Record<string, string> | undefined;
      if (personality && typeof personality === 'object') {
        const specialTags = personality['特殊性格标签'];
        if (specialTags && typeof specialTags === 'string') {
          specialTags.split(/[、,，]/).forEach(t => {
            const trimmed = t.trim();
            if (trimmed && trimmed.length <= 10) keywords.add(trimmed);
          });
        }
      }
    }

    // 生成姓名的常见变体（仅用实际姓名，不用标签值）
    const nameChars = name.replace(/\s/g, '');
    if (nameChars.length >= 2) {
      const surname = nameChars[0];
      const givenName = nameChars.slice(1);

      // 姓 + 常见称呼后缀
      const suffixes = ['小姐', '同学', '女士', '先生', '老师', '姐', '哥', '妹', '弟'];
      suffixes.forEach(s => keywords.add(`${surname}${s}`));

      // 小 + 名
      keywords.add(`小${surname}`);
      if (givenName.length >= 1) {
        keywords.add(`小${givenName}`);
        keywords.add(givenName);
        // 叠字昵称：如 梦梦
        if (givenName.length === 2 && givenName[0] === givenName[1]) {
          keywords.add(givenName);
        } else if (givenName.length >= 1) {
          keywords.add(`${givenName[givenName.length - 1]}${givenName[givenName.length - 1]}`);
        }
      }

      // 全名 + 后缀
      keywords.add(`${name}同学`);
      keywords.add(`${name}小姐`);
      keywords.add(`${name}女士`);
      keywords.add(`${name}先生`);
    }

    return Array.from(keywords).join(',');
  }

  /** 构建动态分析提示词 */
  private buildDynamicsPrompt(
    characterName: string,
    profile: Record<string, unknown>,
    chatHistory: Array<{ role: string; content: string; time?: number }> = [],
    tavernContext: Array<{ role: string; name: string; content: string; message_id?: number }> = []
  ): string {
    const profileJson = JSON.stringify(profile, null, 2);

    // 构建聊天记录上下文
    const chatContext = chatHistory.length > 0
      ? chatHistory.map(m => {
          const role = m.role === 'user' ? '玩家' : characterName;
          return `${role}: ${m.content}`;
        }).join('\n')
      : '（暂无聊天记录）';

    // 构建酒馆正文上下文
    const tavernContextStr = tavernContext.length > 0
      ? tavernContext.map(m => {
          const role = m.role === 'user' ? '玩家' : m.name || '角色';
          return `${role}: ${m.content}`;
        }).join('\n')
      : '（暂无酒馆正文上下文）';

    return `你是一位专门分析虚拟角色心理与行为变化的 AI 助手。
请根据以下角色档案和近期互动记录，生成角色的【近期动态】分析报告。

## 角色档案（JSON）
\`\`\`json
${profileJson}
\`\`\`

## 近期微信聊天记录（私密对话）
\`\`\`
${chatContext}
\`\`\`

## 酒馆正文上下文（公开场景互动）
\`\`\`
${tavernContextStr}
\`\`\`

## 任务
请结合角色档案和近期互动记录，分析该角色在最近一段时间内的动态变化。输出符合以下 JSON 格式的动态分析报告：

\`\`\`json
{
  "characterId": "${characterName}的ID",
  "characterName": "${characterName}",
  "behaviorChange": "行为变化：描述角色近期在行为模式上的变化，如对新环境、新人物的适应方式，日常行为的改变等",
  "personalityTweak": "性格微调：描述角色性格上的细微变化，如由于事件影响导致的性格转变、新的心理防御机制等",
  "languageStyle": "语言风格：描述角色近期说话风格的特点，语气变化、用词习惯、与其他角色互动时的语言模式",
  "personalGoal": "个人目标：描述角色当前的目标和动机，想要达成什么、在为什么而努力、对现状的态度"
}
\`\`\`

注意：
- 只输出 JSON，不要有其他内容
- 分析要具体、有细节，不要泛泛而谈
- 要结合聊天记录和酒馆正文中发生的具体事件
- 体现角色的成长、变化或心理转折
- 语言风格要符合角色的性格设定`;
  }

  /** 解析动态分析结果 */
  private parseDynamicsResult(raw: string, characterId: string, characterName: string): CharacterDynamicsResult | null {
    try {
      console.log('[analyzer] AI 返回的动态分析原始内容:', raw);

      // 尝试提取 JSON 代码块
      let jsonStr = '';
      const codeBlockMatch = raw.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        const braceMatch = raw.match(/(\{[\s\S]*\})/);
        if (braceMatch) {
          jsonStr = braceMatch[1];
        } else {
          jsonStr = raw;
        }
      }

      // 清理 JSON
      jsonStr = jsonStr.trim();
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

      // 修复字符串内的换行
      let fixedJson = '';
      let inString = false;
      let escapeNext = false;
      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        if (escapeNext) {
          fixedJson += char;
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          fixedJson += char;
          escapeNext = true;
          continue;
        }
        if (char === '"' && !inString) {
          inString = true;
          fixedJson += char;
          continue;
        }
        if (char === '"' && inString) {
          inString = false;
          fixedJson += char;
          continue;
        }
        if (inString && (char === '\n' || char === '\r')) {
          fixedJson += '\\n';
          continue;
        }
        fixedJson += char;
      }
      jsonStr = fixedJson;

      const parsed = JSON.parse(jsonStr);

      const result: CharacterDynamicsResult = {
        characterId,
        characterName: parsed.characterName || characterName,
        behaviorChange: parsed.behaviorChange || parsed.behavior || parsed.行为变化,
        personalityTweak: parsed.personalityTweak || parsed.personality || parsed.性格微调,
        languageStyle: parsed.languageStyle || parsed.language || parsed.语言风格,
        personalGoal: parsed.personalGoal || parsed.goal || parsed.个人目标,
        generatedAt: new Date().toISOString(),
      };

      console.log('[analyzer] 成功解析动态分析结果:', result);
      return result;
    } catch (e) {
      console.warn('[analyzer] 解析动态分析 JSON 失败:', e);
      return null;
    }
  }

  /** 格式化动态报告为世界书内容 */
  private formatDynamicsForWorldbook(result: CharacterDynamicsResult): string {
    return `【${result.characterName}的近期动态】

行为变化：
${result.behaviorChange || '（暂无变化记录）'}

性格微调：
${result.personalityTweak || '（暂无变化记录）'}

语言风格：
${result.languageStyle || '（暂无变化记录）'}

个人目标：
${result.personalGoal || '（暂无目标记录）'}

---
生成时间：${new Date(result.generatedAt).toLocaleString('zh-CN')}`;
  }

  /** 获取角色基础档案 */
  private async getBaseProfile(characterId: string): Promise<Record<string, unknown> | null> {
    try {
      const data = await requestCharacterArchiveFromShell();
      const 角色档案 = (data['角色档案'] as Record<string, Record<string, unknown>> | undefined) || {};
      return 角色档案[characterId] ?? null;
    } catch (e) {
      console.warn('[analyzer] 获取角色档案失败:', e);
      return null;
    }
  }

  /** 构建分析提示词 - 生成完整角色档案（包含聊天记录上下文） */
  private buildAnalysisPrompt(
    characterName: string,
    profile: Record<string, unknown>,
    chatHistory: Array<{ role: string; content: string; time?: number }> = [],
    tavernContext: Array<{ role: string; name: string; content: string; message_id?: number }> = []
  ): string {
    const profileJson = JSON.stringify(profile, null, 2);

    // 构建聊天记录上下文
    const chatContext = chatHistory.length > 0
      ? chatHistory.map(m => {
          const role = m.role === 'user' ? '玩家' : characterName;
          return `${role}: ${m.content}`;
        }).join('\n')
      : '（暂无聊天记录）';

    // 构建酒馆正文上下文
    const tavernContextStr = tavernContext.length > 0
      ? tavernContext.map(m => {
          const role = m.role === 'user' ? '玩家' : m.name || '角色';
          return `${role}: ${m.content}`;
        }).join('\n')
      : '（暂无酒馆正文上下文）';

    return `你是一位专门分析虚拟角色心理与状态的 AI 助手。
请根据以下角色档案和微信聊天记录，生成角色的完整分析档案。

## 角色档案（JSON）
\`\`\`json
${profileJson}
\`\`\`

## 近期微信聊天记录（私密对话）
\`\`\`
${chatContext}
\`\`\`

## 酒馆正文上下文（公开场景互动）
\`\`\`
${tavernContextStr}
\`\`\`

## 任务
请结合角色档案和聊天记录，分析该角色的完整画像。输出符合以下 JSON 格式的完整角色档案。如果是首次分析，生成完整的档案内容；如果是后续分析，更新"当前状态"部分：

\`\`\`json
{
  "characterId": "${characterName}的ID",
  "姓名": "角色姓名",
  "性别": "男/女/其他",
  "年龄": 数字,
  "职业": "职业描述",
  "外貌": "外貌整体描述（身高、体型、发色、肤色等）",
  "外貌细节": "更详细的身体特征描述（三围、腿部长度、足型、指甲颜色等）",
  "性格": {
    "表面性格": "表面展示给外界的性格",
    "内在性格": "真实的内在性格",
    "特殊性格标签": "如S女/M女等"
  },
  "性癖": {
    "性癖名": {
      "等级": 1-10,
      "细节描述": "详细描述该性癖的表现",
      "自我合理化": "角色如何合理化这一性癖"
    }
  },
  "敏感部位": {
    "部位名": {
      "敏感等级": 1-10,
      "生理反应": "被刺激时的生理反应",
      "开发细节": "该部位的开发程度和细节"
    }
  },
  "背景故事": "角色的出身、经历、当前处境等背景",
  "兴趣爱好": ["爱好1", "爱好2", "爱好3"],
  "生活习惯": ["习惯1", "习惯2", "习惯3"],
  "说话风格": "角色说话的整体风格描述",
  "日常对话示例": ["示例对话1", "示例对话2", "示例对话3"],
  "当前内心想法": "角色当前的心理活动（30字以内）",
  "当前综合生理描述": "角色当前的生理状态",
  "数值": {
    "好感度": 0-100,
    "发情值": 0-100,
    "性癖开发值": 0-100
  },
  "身份标签": {
    "关系": "与主角的关系",
    "地位": "社会地位",
    "其他标签": "其他身份标签"
  }
}
\`\`\`

注意：
- 只输出 JSON，不要有其他内容
- 首次分析需要填写所有字段，生成完整的角色档案
- 后续分析可以只更新"当前状态"相关字段（currentThought, currentPhysiologicalDescription, stats）
- 数值变化请基于档案中现有值合理推断
- 外貌和外貌细节要详细描写，包括身材数据、肤色、发色、特征部位等
- 性格要分表面和内在两层描述
- 背景故事要交代清楚角色的出身和当前处境
- 说话风格要具体，并给出3-5个日常对话示例
- 性癖和敏感部位的描述要足够详细（参考档案中的风格）`;
  }

  /** 解析分析结果 - 支持完整档案格式 */
  private parseAnalysisResult(raw: string, characterId: string): CharacterAnalysisResult | null {
    try {
      // 打印原始内容用于调试
      console.log('[analyzer] AI 返回的原始内容:', raw);

      // 尝试提取 JSON 代码块
      let jsonStr = '';
      // 1) 完整 markdown 代码块
      const codeBlockMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        // 2) 未闭合的 markdown 代码块（AI 输出被截断）
        const openBlockMatch = raw.match(/```json\s*([\s\S]*)/);
        if (openBlockMatch) {
          jsonStr = openBlockMatch[1];
        } else {
          // 3) 花括号包裹的内容
          const braceMatch = raw.match(/(\{[\s\S]*\})/);
          if (braceMatch) {
            jsonStr = braceMatch[1];
          } else {
            // 4) 花括号开头但未闭合（截断）
            const openBraceMatch = raw.match(/(\{[\s\S]*)/);
            if (openBraceMatch) {
              jsonStr = openBraceMatch[1];
            } else {
              jsonStr = raw;
            }
          }
        }
      }

      // 清理和修复 JSON 字符串
      jsonStr = jsonStr.trim();

      // 修复常见 JSON 错误
      // 1. 修复尾随逗号（对象或数组最后一项后的逗号）
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

      // 2. 修复字符串内的真实换行符（将未转义的换行转为 \n）
      // 使用更安全的处理方式，只处理字符串内部
      let fixedJson = '';
      let inString = false;
      let escapeNext = false;
      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        const nextChar = jsonStr[i + 1] || '';

        if (escapeNext) {
          fixedJson += char;
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          fixedJson += char;
          escapeNext = true;
          continue;
        }

        if (char === '"' && !inString) {
          inString = true;
          fixedJson += char;
          continue;
        }

        if (char === '"' && inString) {
          inString = false;
          fixedJson += char;
          continue;
        }

        // 如果在字符串内部，将真实换行符转为转义形式
        if (inString && (char === '\n' || char === '\r')) {
          fixedJson += '\\n';
          continue;
        }

        // 如果在字符串内部，处理未转义的制表符
        if (inString && char === '\t') {
          fixedJson += '\\t';
          continue;
        }

        fixedJson += char;
      }
      jsonStr = fixedJson;

      // 3. 尝试解析 JSON
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.warn('[analyzer] 第一次解析失败，尝试清理后的再次解析:', parseError);

        // 更激进的清理：移除控制字符
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F-\x9F]/g, (char) => {
          // 保留一些常见空白字符的转义形式
          if (char === '\n') return '\\n';
          if (char === '\r') return '\\r';
          if (char === '\t') return '\\t';
          return '';
        });

        // 再次尝试
        try {
          parsed = JSON.parse(jsonStr);
        } catch (secondError) {
          // 第三次：尝试修复被截断的 JSON（补全缺失的引号和括号）
          console.warn('[analyzer] 第二次解析也失败，尝试修复截断的 JSON');
          try {
            let truncated = jsonStr;
            // 删除最后一个不完整的键值对（从最后一个完整的逗号或属性值截断）
            const lastComplete = Math.max(
              truncated.lastIndexOf('",'),
              truncated.lastIndexOf('"],'),
              truncated.lastIndexOf('},'),
              truncated.lastIndexOf('],'),
            );
            if (lastComplete > 0) {
              truncated = truncated.substring(0, lastComplete + 1);
            }
            // 补全所有未闭合的括号
            let openBraces = 0;
            let openBrackets = 0;
            let inStr = false;
            let esc = false;
            for (const ch of truncated) {
              if (esc) { esc = false; continue; }
              if (ch === '\\') { esc = true; continue; }
              if (ch === '"') { inStr = !inStr; continue; }
              if (inStr) continue;
              if (ch === '{') openBraces++;
              if (ch === '}') openBraces--;
              if (ch === '[') openBrackets++;
              if (ch === ']') openBrackets--;
            }
            // 移除尾随逗号
            truncated = truncated.replace(/,\s*$/, '');
            for (let i = 0; i < openBrackets; i++) truncated += ']';
            for (let i = 0; i < openBraces; i++) truncated += '}';
            parsed = JSON.parse(truncated);
            console.info('[analyzer] ✅ 截断 JSON 修复成功');
          } catch (thirdError) {
            console.error('[analyzer] 第三次解析也失败，原始内容:', raw);
            return null;
          }
        }
      }

      // 构建完整分析结果
      const result: CharacterAnalysisResult = {
        characterId,
        // 基础信息
        姓名: (parsed.姓名 as string) || parsed.characterId || characterId,
        性别: parsed.性别 as string,
        年龄: parsed.年龄 as number,
        职业: parsed.职业 as string,
        外貌: parsed.外貌 as string,
        外貌细节: parsed.外貌细节 as string,
        // 性格
        personality: (parsed.性格 || parsed.personality) as Record<string, string>,
        // 性癖和敏感部位
        fetishes: (parsed.性癖 || parsed.fetishes) as Record<string, { 等级: number; 细节描述: string; 自我合理化: string }>,
        sensitiveParts: (parsed.敏感部位 || parsed.sensitiveParts) as Record<string, { 敏感等级: number; 生理反应: string; 开发细节: string }>,
        // 背景故事
        背景故事: parsed.背景故事 as string,
        // 兴趣爱好
        兴趣爱好: parsed.兴趣爱好 as string[],
        // 生活习惯
        生活习惯: parsed.生活习惯 as string[],
        // 说话风格
        说话风格: parsed.说话风格 as string,
        日常对话示例: parsed.日常对话示例 as string[],
        // 当前状态
        currentThought: (parsed.当前内心想法 || parsed.currentThought) as string,
        currentPhysiologicalDescription: (parsed.当前综合生理描述 || parsed.currentPhysiologicalDescription) as string,
        // 数值
        stats: (parsed.数值 || parsed.stats) as { 好感度?: number; 发情值?: number; 性癖开发值?: number },
        // 身份标签
        identityTags: (parsed.身份标签 || parsed.identityTags) as Record<string, string>,
      };

      console.log('[analyzer] 成功解析分析结果:', result);
      return result;
    } catch (e) {
      console.warn('[analyzer] 解析 JSON 失败:', e);
      return null;
    }
  }

}

/** 全局单例 */
const characterAnalyzer = new CharacterAnalyzer();
export function getCharacterAnalyzer(): CharacterAnalyzer {
  return characterAnalyzer;
}
