<template>
  <div class="random-rules-panel" :class="{ dark: isDarkMode, light: !isDarkMode }">
    <!-- 头部说明 -->
    <div class="panel-description">
      <p class="desc-text">
        <i class="fa-solid fa-shuffle"></i>
        使用 AI 生成随机暧昧规则，为游戏增添情色变数
      </p>
      <p class="desc-sub">规则聚焦于带有暧昧暗示的日常行为习惯、身体接触、羞耻感与亲密行为的约束与改变；新生成会追加到列表，刷新页面前一直保留</p>
    </div>

    <!-- 生成按钮区 -->
    <div class="generate-section">
      <button
        type="button"
        class="generate-btn"
        :disabled="isGenerating"
        @click="openThemeDialog"
      >
        <i :class="isGenerating ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-wand-magic-sparkles'"></i>
        {{ isGenerating ? '生成中...' : '生成随机规则' }}
      </button>
      <p v-if="isGenerating" class="generating-hint">正在调用 AI 生成生活规则，请稍候...</p>
    </div>

    <!-- 生成结果区 -->
    <div v-if="generatedRules.length > 0" class="results-section">
      <h3 class="results-title">
        <i class="fa-solid fa-list-check"></i>
        生成的规则
      </h3>

      <!-- 个人规则 -->
      <div v-if="personalRules.length > 0" class="rule-category">
        <h4 class="category-title">
          <i class="fa-solid fa-user"></i>
          个人规则
        </h4>
        <div v-for="(rule, idx) in personalRules" :key="rule.id" class="rule-card">
          <div class="rule-header">
            <span class="rule-target">{{ rule.target }}</span>
            <span class="rule-type">个人</span>
          </div>
          <div class="rule-title">{{ rule.title }}</div>
          <div class="rule-desc">{{ rule.desc }}</div>
          <div class="rule-actions">
            <button
              type="button"
              class="btn-apply"
              :disabled="isRuleApplied(rule.id)"
              @click="openApplyEditDialog(rule, 'personal')"
            >
              <i :class="isRuleApplied(rule.id) ? 'fa-solid fa-check' : 'fa-solid fa-plus'"></i>
              {{ isRuleApplied(rule.id) ? '已应用' : '应用此规则' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 区域规则 -->
      <div v-if="regionalRules.length > 0" class="rule-category">
        <h4 class="category-title">
          <i class="fa-solid fa-map-location-dot"></i>
          区域规则
        </h4>
        <div v-for="(rule, idx) in regionalRules" :key="rule.id" class="rule-card">
          <div class="rule-header">
            <span class="rule-target">{{ rule.regionName }}</span>
            <span class="rule-type">区域</span>
          </div>
          <div class="rule-title">{{ rule.title }}</div>
          <div class="rule-desc">{{ rule.desc }}</div>
          <div class="rule-actions">
            <button
              type="button"
              class="btn-apply"
              :disabled="isRuleApplied(rule.id)"
              @click="openApplyEditDialog(rule, 'regional')"
            >
              <i :class="isRuleApplied(rule.id) ? 'fa-solid fa-check' : 'fa-solid fa-plus'"></i>
              {{ isRuleApplied(rule.id) ? '已应用' : '应用此规则' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 世界规则 -->
      <div v-if="worldRules.length > 0" class="rule-category">
        <h4 class="category-title">
          <i class="fa-solid fa-globe"></i>
          世界规则
        </h4>
        <div v-for="(rule, idx) in worldRules" :key="rule.id" class="rule-card">
          <div class="rule-header">
            <span class="rule-type">世界</span>
          </div>
          <div class="rule-title">{{ rule.title }}</div>
          <div class="rule-desc">{{ rule.desc }}</div>
          <div class="rule-actions">
            <button
              type="button"
              class="btn-apply"
              :disabled="isRuleApplied(rule.id)"
              @click="openApplyEditDialog(rule, 'world')"
            >
              <i :class="isRuleApplied(rule.id) ? 'fa-solid fa-check' : 'fa-solid fa-plus'"></i>
              {{ isRuleApplied(rule.id) ? '已应用' : '应用此规则' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 重新生成按钮 -->
      <div class="regenerate-section">
        <button
          type="button"
          class="btn-secondary"
          :disabled="isGenerating"
          @click="openThemeDialog"
        >
          <i class="fa-solid fa-rotate"></i>
          重新生成
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-message">
      <i class="fa-solid fa-circle-exclamation"></i>
      {{ errorMessage }}
    </div>
  </div>

  <!-- 主题输入弹窗 -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showThemeDialog"
        class="theme-dialog-overlay"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
        @click.self="closeThemeDialog"
      >
        <div class="theme-dialog-modal" :class="{ dark: isDarkMode, light: !isDarkMode }">
          <div class="theme-dialog-header">
            <h2><i class="fa-solid fa-lightbulb"></i> 随机规则主题</h2>
            <button type="button" class="close-btn" @click="closeThemeDialog">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="theme-dialog-body">
            <p class="theme-hint">输入一个主题方向，所有生成的规则将围绕该主题展开。留空则完全随机。</p>
            <textarea
              v-model="themeInput"
              class="theme-textarea"
              rows="3"
              placeholder="输入一个暧昧主题方向（如：身体接触、穿着暴露、羞耻习惯、亲密接触...），留空则完全随机"
              @keydown.enter.prevent
            ></textarea>
            <div class="theme-examples">
              <span class="example-tag" @click="setTheme('身体接触')">身体接触</span>
              <span class="example-tag" @click="setTheme('穿着暴露')">穿着暴露</span>
              <span class="example-tag" @click="setTheme('暧昧问候')">暧昧问候</span>
              <span class="example-tag" @click="setTheme('羞耻习惯')">羞耻习惯</span>
              <span class="example-tag" @click="setTheme('亲密接触')">亲密接触</span>
              <span class="example-tag" @click="setTheme('展示欲望')">展示欲望</span>
              <span class="example-tag" @click="setTheme('禁忌突破')">禁忌突破</span>
              <span class="example-tag" @click="setTheme('服从仪式')">服从仪式</span>
            </div>
          </div>
          <div class="theme-dialog-actions">
            <button type="button" class="btn-cancel" @click="closeThemeDialog">取消</button>
            <button type="button" class="btn-confirm" @click="confirmThemeAndGenerate">
              <i class="fa-solid fa-sparkles"></i>
              开始生成
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 应用前编辑弹窗 -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showEditDialog"
        class="theme-dialog-overlay"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
        @click.self="closeEditDialog"
      >
        <div class="theme-dialog-modal theme-dialog-modal--wide" :class="{ dark: isDarkMode, light: !isDarkMode }">
          <div class="theme-dialog-header">
            <h2><i class="fa-solid fa-pen-to-square"></i> 编辑并应用规则</h2>
            <button type="button" class="close-btn" @click="closeEditDialog">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="theme-dialog-body">
            <div class="form-readonly-row">
              <span class="form-label">类型</span>
              <span class="form-readonly-value">{{ applyEditTypeLabel }}</span>
            </div>
            <div v-if="editingRule?.type === 'personal'" class="form-readonly-row">
              <span class="form-label">适用角色</span>
              <span class="form-readonly-value">{{ editingRule?.target || '—' }}</span>
            </div>
            <div v-if="editingRule?.type === 'regional'" class="form-readonly-row">
              <span class="form-label">所属区域</span>
              <span class="form-readonly-value">{{ editingRule?.regionName || '—' }}</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="apply-edit-title">规则名称</label>
              <input
                id="apply-edit-title"
                v-model="applyEditTitle"
                type="text"
                class="form-input"
                placeholder="规则标题"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="apply-edit-desc">效果描述</label>
              <textarea
                id="apply-edit-desc"
                v-model="applyEditDesc"
                class="form-textarea"
                rows="5"
                placeholder="规则效果描述"
              ></textarea>
            </div>
            <p class="theme-hint apply-edit-hint">确认后将与其他「添加规则」一致：写入变量并发送到酒馆对话框。</p>
          </div>
          <div class="theme-dialog-actions">
            <button type="button" class="btn-cancel" @click="closeEditDialog">取消</button>
            <button type="button" class="btn-confirm" @click="confirmApplyFromDialog">
              <i class="fa-solid fa-paper-plane"></i>
              确认并应用
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useDataStore, useCharacters, bumpUpdateTime } from '../store';
import type { CharacterData, RegionData } from '../types';
import {
  randomRulesSessionGenerated as generatedRules,
  randomRulesSessionCurrentTheme as currentTheme,
  randomRulesSessionIsApplied,
  randomRulesSessionMarkApplied,
  reloadRandomRulesSessionFromStorage,
} from '../utils/randomRulesPanelSession';
import {
  buildRandomPersonalItem,
  buildRandomRegionalItem,
  buildRandomWorldItem,
  isEditCartEnabled,
  stageItem,
} from '../utils/editCartFlow';

interface GeneratedRule {
  id: string;
  title: string;
  desc: string;
  target?: string;
  regionName?: string;
}

interface EditingRuleData {
  id: string;
  title: string;
  desc: string;
  type: 'personal' | 'regional' | 'world';
  target?: string;
  regionName?: string;
}

function uniqueRuleId(prefix: string, idx: number): string {
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}-${Date.now()}-${rnd}-${idx}`;
}

const props = defineProps<{
  isDarkMode: boolean;
}>();

const isGenerating = ref(false);
const errorMessage = ref('');

// 主题输入相关
const showThemeDialog = ref(false);
const themeInput = ref('');

/** 与模板中 isRuleApplied(rule.id) 对应，读取会话级已应用 id */
function isRuleApplied(id: string): boolean {
  return randomRulesSessionIsApplied(id);
}

let stopChatChangeListener: (() => void) | null = null;

onMounted(() => {
  reloadRandomRulesSessionFromStorage();
  try {
    if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined') {
      const ret = eventOn(tavern_events.CHAT_CHANGED, () => {
        reloadRandomRulesSessionFromStorage();
      });
      stopChatChangeListener = () => {
        ret.stop?.();
      };
    }
  } catch (e) {
    console.warn('[RandomRulesPanel] 无法监听 CHAT_CHANGED:', e);
  }
});

onUnmounted(() => {
  stopChatChangeListener?.();
  stopChatChangeListener = null;
});

// 应用前编辑弹窗
const showEditDialog = ref(false);
const editingRule = ref<EditingRuleData | null>(null);
const applyEditTitle = ref('');
const applyEditDesc = ref('');

const applyEditTypeLabel = computed(() => {
  const t = editingRule.value?.type;
  if (t === 'personal') return '个人规则';
  if (t === 'regional') return '区域规则';
  if (t === 'world') return '世界规则';
  return '—';
});

// 使用 store 获取数据
const store = useDataStore();
const characters = useCharacters();

// 计算属性：分类规则
const personalRules = computed(() =>
  generatedRules.value.filter(r => r.target && !r.regionName)
);
const regionalRules = computed(() =>
  generatedRules.value.filter(r => r.regionName)
);
const worldRules = computed(() =>
  generatedRules.value.filter(r => !r.target && !r.regionName)
);

// 获取当前活跃的角色列表
function getActiveCharacters(): CharacterData[] {
  return characters.value.filter(c => c.status === 'active');
}

// 获取当前活跃的区域列表
function getActiveRegions(): Array<{ name: string; data: RegionData }> {
  const regions = store.data.区域规则 || {};
  return Object.entries(regions)
    .filter(([_, region]) => region.状态 === '生效中')
    .map(([name, data]) => ({ name: data.名称 || name, data }));
}

// 打开主题输入弹窗
function openThemeDialog() {
  showThemeDialog.value = true;
  // 保留上次输入的主题
  themeInput.value = currentTheme.value;
}

// 关闭主题输入弹窗
function closeThemeDialog() {
  showThemeDialog.value = false;
}

// 快速设置主题
function setTheme(theme: string) {
  themeInput.value = theme;
}

// 确认主题并开始生成
async function confirmThemeAndGenerate() {
  currentTheme.value = themeInput.value.trim();
  showThemeDialog.value = false;
  await handleGenerate();
}

// 生成提示词 - 聚焦于带情色色彩的日常生活习惯差异
function buildPrompt(characters: CharacterData[], regions: Array<{ name: string }>, theme: string): string {
  const charNames = characters.map(c => c.name).join('、') || '暂无角色';
  const regionNames = regions.map(r => r.name).join('、') || '暂无区域';

  const themeSection = theme
    ? `\n## 用户指定主题\n本次生成的所有规则必须围绕主题「${theme}」展开。所有个人规则、区域规则、世界规则都必须与${theme}相关。`
    : '';

  return `你是一位日常生活规则设计师。请为游戏生成6条关于日常生活、行为习惯、社交礼仪的随机规则。

## 可用资源
- 角色列表：${charNames}
- 当前区域：${regionNames}${themeSection}

## 生成要求（重要）

规则必须聚焦于**带有情色色彩的日常生活习惯**，与常规世界观产生明显反差。规则应带有一些暧昧、暗示性或轻度的色情元素，但要保持日常生活场景的可执行性。

**禁止内容**：
- 禁止生成RPG技能、战斗能力、魔法效果、属性数值
- 禁止生成"攻击力提升"、"法力回复"、"防御增强"等游戏机制
- 禁止生成超自然能力或奇幻特效描述
- 禁止过于直白露骨的色情描写，保持暗示性和暧昧感

**规则类型说明**：

### 个人规则（2条）
聚焦角色的带情色暗示的日常行为习惯改变：
- 身体习惯：特殊的清洁方式、裸露程度、身体触碰偏好、私密部位展示规则
- 社交行为：带有暧昧意味的打招呼方式、肢体接触距离、眼神交流方式、亲吻拥抱规则
- 情感表达：带有性暗示的情绪宣泄、特殊的撒娇方式、亲密行为触发条件
- 个人仪式：与身体相关的重复行为、特殊的着装或脱衣习惯、私密时刻的固定流程

示例（而非限制）：
- "每天早晨醒来后必须在窗前伸展身体至少3分钟，窗帘必须拉开让他人能够看见"
- "与人交谈时必须保持极近的距离，近到能够感受到对方呼吸，否则会感到不安"
- "感到紧张时会无意识地用手指轻咬下唇并发出轻微的哼声，无法自控"
- "在家时必须只穿着轻薄的内衣，穿上正常衣物会感到窒息般的不适"

### 区域规则（2条）
聚焦于该区域内带暧昧色彩的社会习俗和通行规矩：
- 交往礼仪：带有身体接触的见面/告别方式、称呼时的特殊动作、等级间的服从仪式
- 服务习惯：服务时必须的身体接触方式、接受服务时的回应规则、交易时的附加动作
- 空间规范：公共场所的裸露接受度、私密空间的开放程度、身体界限的特殊定义
- 社交规则：聚会时的特殊互动游戏、公共场合的亲密行为标准、羞耻心的重新定义

示例（而非限制）：
- "在该区域内，人们见面问候时必须互相轻抚对方脸颊至少3秒，直接交谈而不触碰被视为冷漠"
- "进入任何私人空间前必须先脱下外衣，保持较为暴露的状态是对主人的尊重"
- "该区域内，人们在交谈时会习惯性地用手轻触对方的手臂或腰部，回避这种接触会被视为拒绝交往"
- "公共场所允许甚至鼓励适度的亲密接触，保持距离反而会被认为是孤僻和不友好"

### 世界规则（2条）
聚焦于全世界范围内带情色色彩的日常生活惯例被颠覆：
- 全球社交：全人类带有暧昧意味的问候方式、交往时的身体接触规则、言语中的暗示传统
- 生活方式：工作与休息时的着装标准、睡眠模式的改变、饮食时的特殊仪式
- 身体观念：对裸露的重新定义、羞耻感的改变、身体展示的日常化
- 亲密关系：建立关系的特殊仪式、维持关系所需的定期互动、分手的特殊规则

示例（而非限制）：
- "全世界所有人必须在每天日落时，向当天遇到的最后一个陌生人献上亲吻，否则会被视为对其存在价值的否定"
- "所有人都被禁止穿着完整的衣物入睡，必须以最自然的状态入睡，否则会被认为是对睡眠之神的亵渎"
- "哭泣时发出呻吟声不再被视为羞耻，反而被认为是最真诚的表达方式，压抑声音会被视为虚伪"
- "全世界的人类都必须定期（至少每周一次）在公共场所展示自己的肌肤，逃避这一行为会被认为是心理障碍"

## 输出格式
请严格按照以下JSON格式输出，不要包含任何其他内容：

\`\`\`json
{
  "personal": [
    {
      "target": "角色名",
      "title": "规则名称（简洁描述该带情色暗示的行为改变）",
      "desc": "规则效果描述（30-60字，清晰说明这个角色的日常行为习惯有何暧昧或暗示性的不同）"
    }
  ],
  "regional": [
    {
      "regionName": "区域名",
      "title": "规则名称（简洁描述该区域的暧昧社会习俗）",
      "desc": "规则效果描述（30-60字，清晰说明该区域内的日常生活规矩有何情色或暗示性的特殊之处）"
    }
  ],
  "world": [
    {
      "title": "规则名称（简洁描述全球暧昧生活习惯改变）",
      "desc": "规则效果描述（30-60字，清晰说明全世界人类在该方面的日常惯例被如何带情色色彩地颠覆）"
    }
  ]
}
\`\`\`

**核心原则**：
- 规则应简洁、具体、可执行，像一条社会法规或地方风俗
- 与常规世界观产生明显差异和反差，带有暧昧和暗示性的情色色彩
- 聚焦于日常生活场景，而非战斗、冒险、超能力
- 保持适度的情色暗示，不要过于直白露骨，重在暧昧感和羞耻感
- 规则要有创意，但符合生活逻辑，易于在游戏中通过角色行为体现`;
}

// 调用 API
async function callAPI(prompt: string): Promise<string> {
  const { getSecondaryApiConfig } = await import('../utils/apiSettings');
  const config = getSecondaryApiConfig();

  if (!config) {
    throw new Error('未配置 API，请先在系统设置中配置第二 API');
  }

  // 优先使用第二 API
  if (config.url && config.key) {
    return callSecondaryAPI(prompt, config);
  }

  // 尝试使用酒馆主 API
  const { getTavernMainOpenAiCredentials } = await import('../utils/tavernMainConnection');
  const tavernCreds = getTavernMainOpenAiCredentials();
  if (tavernCreds) {
    return callTavernAPI(prompt, tavernCreds);
  }

  throw new Error('未找到可用的 API 配置');
}

// 调用第二 API
async function callSecondaryAPI(prompt: string, config: { url: string; key: string; model?: string }): Promise<string> {
  const response = await fetch(`${config.url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.key}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// 调用酒馆主 API
async function callTavernAPI(prompt: string, creds: { url: string; key: string; model: string }): Promise<string> {
  const response = await fetch(creds.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.key}`,
    },
    body: JSON.stringify({
      model: creds.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// 解析 API 返回结果
function parseGeneratedRules(content: string): GeneratedRule[] {
  try {
    // 提取 JSON
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/```\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    const data = JSON.parse(jsonStr);

    const rules: GeneratedRule[] = [];

    // 解析个人规则
    if (data.personal && Array.isArray(data.personal)) {
      data.personal.forEach((r: any, idx: number) => {
        rules.push({
          id: uniqueRuleId('gen-personal', idx),
          title: r.title || r.name || '未命名规则',
          desc: r.desc || r.description || r.effect || '无描述',
          target: r.target || r.character || r.appliesTo || '未知角色',
        });
      });
    }

    // 解析区域规则
    if (data.regional && Array.isArray(data.regional)) {
      data.regional.forEach((r: any, idx: number) => {
        rules.push({
          id: uniqueRuleId('gen-regional', idx),
          title: r.title || r.name || '未命名规则',
          desc: r.desc || r.description || r.effect || '无描述',
          regionName: r.regionName || r.region || r.area || '未知区域',
        });
      });
    }

    // 解析世界规则
    if (data.world && Array.isArray(data.world)) {
      data.world.forEach((r: any, idx: number) => {
        rules.push({
          id: uniqueRuleId('gen-world', idx),
          title: r.title || r.name || '未命名规则',
          desc: r.desc || r.description || r.effect || '无描述',
        });
      });
    }

    return rules;
  } catch (e) {
    console.error('解析生成结果失败:', e);
    throw new Error('无法解析 AI 返回的内容');
  }
}

// 生成规则主函数
async function handleGenerate() {
  if (isGenerating.value) return;

  isGenerating.value = true;
  errorMessage.value = '';

  try {
    const activeChars = getActiveCharacters();
    const activeRegions = getActiveRegions();

    if (activeChars.length === 0) {
      throw new Error('没有活跃的角色，请先添加角色');
    }
    if (activeRegions.length === 0) {
      throw new Error('没有活跃的区域，请先添加区域');
    }

    const prompt = buildPrompt(activeChars, activeRegions, currentTheme.value);
    const result = await callAPI(prompt);
    const rules = parseGeneratedRules(result);

    if (rules.length === 0) {
      throw new Error('AI 未返回有效的规则数据');
    }

    generatedRules.value.push(...rules);
    const themeText = currentTheme.value ? `（主题：${currentTheme.value}）` : '';
    toastr.success(`已追加 ${rules.length} 条随机规则${themeText}（共 ${generatedRules.value.length} 条）`);
  } catch (e) {
    console.error('生成规则失败:', e);
    errorMessage.value = e instanceof Error ? e.message : '生成失败，请检查 API 配置';
    toastr.error(errorMessage.value);
  } finally {
    isGenerating.value = false;
  }
}

function openApplyEditDialog(rule: GeneratedRule, type: 'personal' | 'regional' | 'world') {
  editingRule.value = {
    id: rule.id,
    title: rule.title,
    desc: rule.desc,
    type,
    target: rule.target,
    regionName: rule.regionName,
  };
  applyEditTitle.value = rule.title;
  applyEditDesc.value = rule.desc;
  showEditDialog.value = true;
}

function closeEditDialog() {
  showEditDialog.value = false;
  editingRule.value = null;
  applyEditTitle.value = '';
  applyEditDesc.value = '';
}

// 确认后写入变量并发送到对话框（与手动添加规则一致）；购物车开启时先入队
async function confirmApplyFromDialog() {
  const ctx = editingRule.value;
  if (!ctx) return;

  const title = applyEditTitle.value.trim();
  const desc = applyEditDesc.value.trim();
  if (!title) {
    toastr.warning('请填写规则名称');
    return;
  }
  if (!desc) {
    toastr.warning('请填写效果描述');
    return;
  }

  try {
    if (isEditCartEnabled()) {
      switch (ctx.type) {
        case 'world':
          stageItem(buildRandomWorldItem(title, desc));
          break;
        case 'regional':
          if (ctx.regionName) {
            const regions = store.data.区域规则 || {};
            const regionEntry = Object.entries(regions).find(
              ([_, r]) => r.名称 === ctx.regionName,
            );
            if (regionEntry) {
              stageItem(buildRandomRegionalItem(regionEntry[0], ctx.regionName, title, desc));
            } else {
              toastr.error('未找到对应区域，无法应用区域规则');
              return;
            }
          } else {
            toastr.error('缺少区域信息');
            return;
          }
          break;
        case 'personal':
          if (ctx.target) {
            stageItem(buildRandomPersonalItem(ctx.target, `${title}: ${desc}`));
          } else {
            toastr.error('缺少适用角色');
            return;
          }
          break;
      }
      closeEditDialog();
      toastr.success(`已加入暂存：${title}`);
      return;
    }

    const { submitAddWorldRule, submitAddRegionalRule, submitAddPersonalRule } =
      await import('../utils/dialogAndVariable');

    let messageText = '';

    switch (ctx.type) {
      case 'world':
        messageText = await submitAddWorldRule(title, desc);
        break;

      case 'regional':
        if (ctx.regionName) {
          const regions = store.data.区域规则 || {};
          const regionEntry = Object.entries(regions).find(
            ([_, r]) => r.名称 === ctx.regionName
          );
          if (regionEntry) {
            messageText = await submitAddRegionalRule(regionEntry[0], ctx.regionName, title, desc);
          } else {
            toastr.error('未找到对应区域，无法应用区域规则');
            return;
          }
        } else {
          toastr.error('缺少区域信息');
          return;
        }
        break;

      case 'personal':
        if (ctx.target) {
          messageText = await submitAddPersonalRule(ctx.target, `${title}: ${desc}`);
        } else {
          toastr.error('缺少适用角色');
          return;
        }
        break;
    }

    const trimmed = String(messageText ?? '').trim();
    if (trimmed) {
      try {
        window.dispatchEvent(
          new CustomEvent('th:copy-to-input', { detail: { message: trimmed } }),
        );
      } catch (e) {
        console.warn('[RandomRulesPanel] 复制到输入框事件派发失败', e);
      }
    }

    randomRulesSessionMarkApplied(ctx.id);
    bumpUpdateTime();
    toastr.success(`已应用规则：${title}`);
    closeEditDialog();
  } catch (e) {
    console.error('应用规则失败:', e);
    toastr.error('应用规则失败');
  }
}
</script>

<style scoped lang="scss">
.random-rules-panel {
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
}

.panel-description {
  text-align: center;
  margin-bottom: 24px;

  .desc-text {
    font-size: 1.2em;
    font-weight: 600;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    i {
      color: #8b5cf6;
    }
  }

  .desc-sub {
    font-size: 0.9em;
    opacity: 0.7;
  }
}

.dark .panel-description {
  color: #e2e8f0;
}

.light .panel-description {
  color: #475569;
}

.generate-section {
  text-align: center;
  margin-bottom: 32px;

  .generate-btn {
    padding: 12px 32px;
    font-size: 1.1em;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .generating-hint {
    margin-top: 12px;
    font-size: 0.9em;
    opacity: 0.7;
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.results-section {
  .results-title {
    font-size: 1.3em;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      color: #10b981;
    }
  }

  .rule-category {
    margin-bottom: 24px;

    .category-title {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid;
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        font-size: 0.9em;
      }
    }
  }
}

.dark .rule-category .category-title {
  border-color: #334155;
  color: #94a3b8;
}

.light .rule-category .category-title {
  border-color: #e2e8f0;
  color: #64748b;
}

.rule-card {
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid;
  transition: all 0.2s ease;

  &:hover {
    transform: translateX(4px);
  }

  .rule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .rule-target {
      font-size: 0.85em;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(139, 92, 246, 0.2);
      color: #8b5cf6;
    }

    .rule-type {
      font-size: 0.75em;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 700;

      &[data-type="personal"] {
        background: #3b82f6;
        color: white;
      }

      &[data-type="regional"] {
        background: #f59e0b;
        color: white;
      }

      &[data-type="world"] {
        background: #ef4444;
        color: white;
      }
    }
  }

  .rule-title {
    font-size: 1.1em;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .rule-desc {
    font-size: 0.95em;
    line-height: 1.5;
    opacity: 0.85;
    margin-bottom: 12px;
  }

  .rule-actions {
    display: flex;
    justify-content: flex-end;

    .btn-apply {
      padding: 6px 16px;
      font-size: 0.9em;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
      background: #10b981;
      color: white;

      &:hover:not(:disabled) {
        background: #059669;
        transform: scale(1.05);
      }

      &:disabled {
        background: #6b7280;
        cursor: default;
      }
    }
  }
}

.dark .rule-card {
  background: rgba(30, 41, 59, 0.6);
  border-color: #334155;

  .rule-title {
    color: #f1f5f9;
  }

  .rule-desc {
    color: #cbd5e1;
  }
}

.light .rule-card {
  background: #f8fafc;
  border-color: #e2e8f0;

  .rule-title {
    color: #1e293b;
  }

  .rule-desc {
    color: #475569;
  }
}

.regenerate-section {
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid;

  .btn-secondary {
    padding: 8px 20px;
    font-size: 0.95em;
    border: 1px solid;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;

    &:hover:not(:disabled) {
      transform: scale(1.02);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.dark .regenerate-section {
  border-color: #334155;

  .btn-secondary {
    background: transparent;
    border-color: #475569;
    color: #94a3b8;

    &:hover:not(:disabled) {
      background: rgba(71, 85, 105, 0.3);
      color: #e2e8f0;
    }
  }
}

.light .regenerate-section {
  border-color: #e2e8f0;

  .btn-secondary {
    background: transparent;
    border-color: #cbd5e1;
    color: #64748b;

    &:hover:not(:disabled) {
      background: rgba(203, 213, 225, 0.3);
      color: #475569;
    }
  }
}

.error-message {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;

  i {
    color: #ef4444;
  }
}

.dark .error-message {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
}

.light .error-message {
  background: #fef2f2;
  color: #991b1b;
}

// 主题输入弹窗样式
.theme-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.theme-dialog-modal {
  width: 100%;
  max-width: 500px;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: modalSlideIn 0.3s ease;
}

.theme-dialog-modal--wide {
  max-width: 560px;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dark .theme-dialog-modal {
  background: #1e293b;
}

.light .theme-dialog-modal {
  background: #ffffff;
}

.form-readonly-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 0.9em;

  .form-label {
    flex-shrink: 0;
    min-width: 4.5em;
    opacity: 0.75;
    font-weight: 500;
  }

  .form-readonly-value {
    flex: 1;
    word-break: break-word;
  }
}

.form-group {
  margin-bottom: 14px;

  .form-label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.9em;
    font-weight: 500;
    opacity: 0.85;
  }
}

.dark .form-group .form-label,
.dark .form-readonly-row .form-label {
  color: #94a3b8;
}

.light .form-group .form-label,
.light .form-readonly-row .form-label {
  color: #64748b;
}

.dark .form-readonly-row .form-readonly-value {
  color: #e2e8f0;
}

.light .form-readonly-row .form-readonly-value {
  color: #334155;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid;
  font-size: 0.95em;
  font-family: inherit;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.dark .form-input,
.dark .form-textarea {
  background: #0f172a;
  border-color: #334155;
  color: #f1f5f9;

  &::placeholder {
    color: #475569;
  }
}

.light .form-input,
.light .form-textarea {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #1e293b;

  &::placeholder {
    color: #94a3b8;
  }
}

.apply-edit-hint {
  margin-top: 8px;
  margin-bottom: 0;
}

.theme-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    font-size: 1.2em;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;

    i {
      color: #f59e0b;
    }
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
}

.dark .theme-dialog-header {
  border-color: #334155;
  color: #f1f5f9;

  .close-btn {
    color: #94a3b8;
  }
}

.light .theme-dialog-header {
  border-color: #e2e8f0;
  color: #1e293b;

  .close-btn {
    color: #64748b;
  }
}

.theme-dialog-body {
  padding: 20px;

  .theme-hint {
    font-size: 0.9em;
    opacity: 0.8;
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .theme-textarea {
    width: 100%;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid;
    font-size: 0.95em;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: #8b5cf6;
    }
  }

  .theme-examples {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .example-tag {
      padding: 4px 12px;
      font-size: 0.85em;
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        transform: scale(1.05);
      }
    }
  }
}

.dark .theme-dialog-body {
  .theme-hint {
    color: #94a3b8;
  }

  .theme-textarea {
    background: #0f172a;
    border-color: #334155;
    color: #f1f5f9;

    &::placeholder {
      color: #475569;
    }
  }

  .example-tag {
    background: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);

    &:hover {
      background: rgba(139, 92, 246, 0.3);
    }
  }
}

.light .theme-dialog-body {
  .theme-hint {
    color: #64748b;
  }

  .theme-textarea {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #1e293b;

    &::placeholder {
      color: #94a3b8;
    }
  }

  .example-tag {
    background: rgba(139, 92, 246, 0.1);
    color: #7c3aed;
    border: 1px solid rgba(139, 92, 246, 0.2);

    &:hover {
      background: rgba(139, 92, 246, 0.2);
    }
  }
}

.theme-dialog-actions {
  padding: 16px 20px;
  border-top: 1px solid;
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  button {
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 0.95em;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;

    &.btn-cancel {
      background: transparent;
      border: 1px solid;
    }

    &.btn-confirm {
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: white;
      border: none;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
      }
    }
  }
}

.dark .theme-dialog-actions {
  border-color: #334155;

  .btn-cancel {
    color: #94a3b8;
    border-color: #475569;

    &:hover {
      background: rgba(71, 85, 105, 0.3);
    }
  }
}

.light .theme-dialog-actions {
  border-color: #e2e8f0;

  .btn-cancel {
    color: #64748b;
    border-color: #cbd5e1;

    &:hover {
      background: rgba(203, 213, 225, 0.3);
    }
  }
}

// 弹窗过渡动画
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .theme-dialog-modal {
    transform: translateY(-20px);
  }
}
</style>
