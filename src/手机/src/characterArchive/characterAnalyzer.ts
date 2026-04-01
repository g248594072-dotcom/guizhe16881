/**
 * 角色分析器（CharacterAnalyzer）
 * 基于 MVU 角色档案 + 聊天历史，通过副 API 生成动态角色分析结果
 * 适配 src/规则/schema.ts 中的角色档案格式
 */

import { getAnalysisScheduler, type AnalysisTask } from './analysisScheduler';
import { requestCharacterArchiveFromShell, writeCharacterAnalysisResult, syncCharacterAnalysisToWorldbook } from './bridge';

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

      // 构建分析提示词
      const prompt = this.buildAnalysisPrompt(characterName, profile);
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

      // 写回 MVU 变量（通过壳脚本）
      await this.writeBackToMvu(characterId, result);

      console.log('[analyzer] 角色分析完成:', characterId, result);
      return result;
    } catch (e) {
      console.error('[analyzer] 角色分析异常:', e);
      return null;
    }
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

  /** 构建分析提示词 - 生成完整角色档案 */
  private buildAnalysisPrompt(characterName: string, profile: Record<string, unknown>): string {
    const profileJson = JSON.stringify(profile, null, 2);
    return `你是一位专门分析虚拟角色心理与状态的 AI 助手。
请根据以下角色档案和当前游戏上下文，生成角色的完整分析档案。

## 角色档案（JSON）
\`\`\`json
${profileJson}
\`\`\`

## 任务
分析该角色，输出符合以下 JSON 格式的完整角色档案。如果是首次分析，生成完整的档案内容；如果是后续分析，更新"当前状态"部分：

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
      // 尝试提取 JSON 代码块
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) return null;
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr.trim());

      // 构建完整分析结果
      const result: CharacterAnalysisResult = {
        characterId,
        // 基础信息
        姓名: parsed.姓名 || parsed.characterId || characterId,
        性别: parsed.性别,
        年龄: parsed.年龄,
        职业: parsed.职业,
        外貌: parsed.外貌,
        外貌细节: parsed.外貌细节,
        // 性格
        personality: parsed.性格 || parsed.personality,
        // 性癖和敏感部位
        fetishes: parsed.性癖 || parsed.fetishes,
        sensitiveParts: parsed.敏感部位 || parsed.sensitiveParts,
        // 背景故事
        背景故事: parsed.背景故事,
        // 兴趣爱好
        兴趣爱好: parsed.兴趣爱好,
        // 生活习惯
        生活习惯: parsed.生活习惯,
        // 说话风格
        说话风格: parsed.说话风格,
        日常对话示例: parsed.日常对话示例,
        // 当前状态
        currentThought: parsed.当前内心想法 || parsed.currentThought,
        currentPhysiologicalDescription: parsed.当前综合生理描述 || parsed.currentPhysiologicalDescription,
        // 数值
        stats: parsed.数值 || parsed.stats,
        // 身份标签
        identityTags: parsed.身份标签 || parsed.identityTags,
      };

      return result;
    } catch (e) {
      console.warn('[analyzer] 解析 JSON 失败:', e);
      return null;
    }
  }

  /** 写回 MVU 变量（通过壳脚本的 REQUEST_WRITE_CHARACTER_ANALYSIS 接口） */
  private async writeBackToMvu(characterId: string, result: CharacterAnalysisResult): Promise<void> {
    try {
      const updates: Parameters<typeof writeCharacterAnalysisResult>[1] = {};

      // 基础信息
      if (result.姓名) updates['姓名'] = result.姓名;
      if (result.性别) updates['性别'] = result.性别;
      if (result.年龄 !== undefined) updates['年龄'] = result.年龄;
      if (result.职业) updates['职业'] = result.职业;
      if (result.外貌) updates['外貌'] = result.外貌;
      if (result.外貌细节) updates['外貌细节'] = result.外貌细节;

      // 性格
      if (result.personality) {
        updates['性格'] = result.personality;
      }

      // 性癖和敏感部位
      if (result.fetishes) {
        updates['性癖'] = result.fetishes;
      }
      if (result.sensitiveParts) {
        updates['敏感部位'] = result.sensitiveParts;
      }

      // 背景故事
      if (result.背景故事) updates['背景故事'] = result.背景故事;

      // 兴趣爱好
      if (result.兴趣爱好) updates['兴趣爱好'] = result.兴趣爱好;

      // 生活习惯
      if (result.生活习惯) updates['生活习惯'] = result.生活习惯;

      // 说话风格
      if (result.说话风格) updates['说话风格'] = result.说话风格;
      if (result.日常对话示例) updates['日常对话示例'] = result.日常对话示例;

      // 当前状态
      if (result.currentThought) {
        updates['当前内心想法'] = result.currentThought;
      }
      if (result.currentPhysiologicalDescription) {
        updates['当前综合生理描述'] = result.currentPhysiologicalDescription;
      }

      // 数值
      if (result.stats) {
        updates['数值'] = result.stats;
      }

      // 身份标签
      if (result.identityTags) {
        updates['身份标签'] = result.identityTags;
      }

      const writeResult = await writeCharacterAnalysisResult(characterId, updates);
      if (writeResult.ok) {
        console.log('[analyzer] ✅ 角色分析结果已成功写回 MVU:', characterId);
        // 同步到世界书
        const wbResult = await syncCharacterAnalysisToWorldbook(characterId, {
          ...updates,
          姓名: result.姓名 || result.characterId,
        });
        if (wbResult.ok) {
          console.log('[analyzer] ✅ 角色分析结果已同步到世界书:', characterId, '是否新条目:', wbResult.isNew);
        } else {
          console.warn('[analyzer] ⚠️ 角色分析结果同步到世界书失败:', wbResult.error);
        }
      } else {
        console.warn('[analyzer] ⚠️ 角色分析结果写回失败:', writeResult.error);
      }
    } catch (e) {
      console.error('[analyzer] ❌ 写回 MVU 变量异常:', e);
    }
  }
}

/** 全局单例 */
const characterAnalyzer = new CharacterAnalyzer();
export function getCharacterAnalyzer(): CharacterAnalyzer {
  return characterAnalyzer;
}
