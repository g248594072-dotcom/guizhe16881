/**
 * 角色分析器（CharacterAnalyzer）
 * 基于 MVU 角色档案 + 聊天历史，通过副 API 生成动态角色分析结果
 * 适配 src/规则/schema.ts 中的角色档案格式
 */

import { getAnalysisScheduler, type AnalysisTask } from './analysisScheduler';
import { requestCharacterArchiveFromShell, writeCharacterAnalysisResult, syncCharacterAnalysisToWorldbook } from './bridge';

/** 分析结果（写入 MVU 变量） */
export interface CharacterAnalysisResult {
  characterId: string;
  currentThought?: string;
  personality?: Record<string, string>;
  fetishes?: Record<string, { 等级: number; 细节描述: string; 自我合理化: string }>;
  sensitiveParts?: Record<string, { 敏感等级: number; 生理反应: string; 开发细节: string }>;
  stats?: {
    好感度?: number;
    发情值?: number;
    性癖开发值?: number;
  };
  currentPhysiologicalDescription?: string;
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

  /** 构建分析提示词 */
  private buildAnalysisPrompt(characterName: string, profile: Record<string, unknown>): string {
    const profileJson = JSON.stringify(profile, null, 2);
    return `你是一位专门分析虚拟角色心理与状态的 AI 助手。
请根据以下角色档案和当前游戏上下文，生成角色的心理状态更新。

## 角色档案（JSON）
\`\`\`json
${profileJson}
\`\`\`

## 任务
分析该角色在当前情境下的状态变化，输出符合以下 JSON 格式的分析结果：

\`\`\`json
{
  "characterId": "${characterName}的ID",
  "currentThought": "角色当前内心想法（30字以内）",
  "personality": {
    "标签名": "表现程度"
  },
  "fetishes": {
    "性癖名": {
      "等级": 1-10,
      "细节描述": "描述",
      "自我合理化": "角色如何合理化这一性癖"
    }
  },
  "sensitiveParts": {
    "部位名": {
      "敏感等级": 1-10,
      "生理反应": "反应描述",
      "开发细节": "开发程度"
    }
  },
  "stats": {
    "好感度": 0-100,
    "发情值": 0-100,
    "性癖开发值": 0-100
  },
  "identityTags": {
    "分类名": "标签值"
  }
}
\`\`\`

注意：
- 只输出 JSON，不要有其他内容
- 如果某个字段没有变化，可以不填或填 null
- 数值变化请基于档案中现有值合理推断`;
  }

  /** 解析分析结果 */
  private parseAnalysisResult(raw: string, characterId: string): CharacterAnalysisResult | null {
    try {
      // 尝试提取 JSON 代码块
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) return null;
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr.trim());
      return {
        characterId,
        currentThought: parsed.currentThought,
        personality: parsed.personality,
        fetishes: parsed.fetishes,
        sensitiveParts: parsed.sensitiveParts,
        stats: parsed.stats,
        currentPhysiologicalDescription: parsed.currentPhysiologicalDescription,
        identityTags: parsed.identityTags,
      };
    } catch (e) {
      console.warn('[analyzer] 解析 JSON 失败:', e);
      return null;
    }
  }

  /** 写回 MVU 变量（通过壳脚本的 REQUEST_WRITE_CHARACTER_ANALYSIS 接口） */
  private async writeBackToMvu(characterId: string, result: CharacterAnalysisResult): Promise<void> {
    try {
      const updates: Parameters<typeof writeCharacterAnalysisResult>[1] = {};

      if (result.currentThought) {
        updates['当前内心想法'] = result.currentThought;
      }
      if (result.personality) {
        updates['性格'] = result.personality;
      }
      if (result.fetishes) {
        updates['性癖'] = result.fetishes;
      }
      if (result.sensitiveParts) {
        updates['敏感部位'] = result.sensitiveParts;
      }
      if (result.stats) {
        updates['数值'] = result.stats;
      }
      if (result.identityTags) {
        updates['身份标签'] = result.identityTags;
      }
      if (result.currentPhysiologicalDescription) {
        updates['当前综合生理描述'] = result.currentPhysiologicalDescription;
      }

      const writeResult = await writeCharacterAnalysisResult(characterId, updates);
      if (writeResult.ok) {
        console.log('[analyzer] ✅ 角色分析结果已成功写回 MVU:', characterId);
        // 同步到世界书
        const wbResult = await syncCharacterAnalysisToWorldbook(characterId, {
          ...updates,
          姓名: result.characterId,
        });
        if (wbResult.ok) {
          console.log('[analyzer] ✅ 角色分析结果已同步到世界书:', characterId);
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
