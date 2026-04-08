<template>
  <div class="settings-panel settings-panel--mode-only" :class="{ dark: isDarkMode, light: !isDarkMode }">
    <div class="settings-tab-bar" role="tablist" aria-label="系统设置分类">
      <button
        type="button"
        class="settings-tab-btn"
        :class="{ active: settingsTab === 'output' }"
        role="tab"
        :aria-selected="settingsTab === 'output'"
        @click="settingsTab = 'output'"
      >
        <i class="fa-solid fa-gears"></i>
        输出与 API
      </button>
      <button
        type="button"
        class="settings-tab-btn"
        :class="{ active: settingsTab === 'options' }"
        role="tab"
        :aria-selected="settingsTab === 'options'"
        title="剧情选项点击行为、编辑暂存（购物车）"
        @click="settingsTab = 'options'"
      >
        <i class="fa-solid fa-list-check"></i>
        选项与输入
      </button>
      <button
        type="button"
        class="settings-tab-btn"
        :class="{ active: settingsTab === 'layout' }"
        role="tab"
        :aria-selected="settingsTab === 'layout'"
        @click="settingsTab = 'layout'"
      >
        <i class="fa-solid fa-maximize"></i>
        界面与布局
      </button>
    </div>

    <!-- 输出模式 / 双 API -->
    <div v-show="settingsTab === 'output'" class="settings-tab-panel">
      <!-- 数据库：剧情推进 / 自动填表（独立开关） -->
      <div
        class="shujuku-master-toggle"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
      >
        <div class="shujuku-master-section-head">
          <div class="shujuku-master-icon">
            <i class="fa-solid fa-database"></i>
          </div>
          <div class="shujuku-master-section-titles">
            <span class="shujuku-master-section-title">数据库联动（可选）</span>
            <p class="shujuku-master-section-lead">未安装扩展时不会产生实际调用。</p>
          </div>
        </div>

        <div class="shujuku-toggle-row">
          <div class="shujuku-toggle-label">
            <span class="shujuku-toggle-title">剧情推进</span>
            <span class="shujuku-toggle-hint">发送消息前标记意图，供数据库写入规划数据</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="enableShujukuPlotAdvance"
              @change="persistShujukuPlotAdvance"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="shujuku-toggle-row">
          <div class="shujuku-toggle-label">
            <span class="shujuku-toggle-title">自动填表</span>
            <span class="shujuku-toggle-hint">确认标签并写入楼层后调用「立即手动更新」</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="enableShujukuManualUpdateAfterConfirm"
              @change="persistShujukuManualUpdateOption"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- API 模式选择卡片 -->
      <div class="mode-cards mode-cards--standalone">
      <div
        class="mode-card"
        :class="{ active: outputMode === 'single', dark: isDarkMode, light: !isDarkMode }"
        @click="selectMode('single')"
      >
        <div class="mode-header">
          <div class="mode-icon">
            <i class="fa-solid fa-microchip"></i>
          </div>
          <div class="mode-info">
            <h4 class="mode-title">单API模式</h4>
            <span class="mode-badge">默认</span>
          </div>
          <div class="mode-radio">
            <div class="radio-circle" :class="{ checked: outputMode === 'single' }">
              <i v-if="outputMode === 'single'" class="fa-solid fa-check"></i>
            </div>
          </div>
        </div>
        <div class="mode-body">
          <p class="mode-desc">一次输出完整剧情 + 变量更新</p>
          <ul class="mode-features">
            <li><i class="fa-solid fa-check"></i> 简单直接，适合大多数场景</li>
            <li><i class="fa-solid fa-check"></i> 无需额外配置</li>
            <li><i class="fa-solid fa-check"></i> 使用世界书变量规则</li>
          </ul>
        </div>
      </div>

      <div
        class="mode-card"
        :class="{ active: outputMode === 'dual', dark: isDarkMode, light: !isDarkMode }"
        @click="selectMode('dual')"
      >
        <div class="mode-header">
          <div class="mode-icon dual">
            <i class="fa-solid fa-network-wired"></i>
          </div>
          <div class="mode-info">
            <h4 class="mode-title">双API模式</h4>
            <span class="mode-badge advanced">高级</span>
          </div>
          <div class="mode-radio">
            <div class="radio-circle" :class="{ checked: outputMode === 'dual' }">
              <i v-if="outputMode === 'dual'" class="fa-solid fa-check"></i>
            </div>
          </div>
        </div>
        <div class="mode-body">
          <p class="mode-desc">主API输出剧情，第二API单独处理变量</p>
          <ul class="mode-features">
            <li><i class="fa-solid fa-bolt"></i> 变量更新更精准</li>
            <li><i class="fa-solid fa-tachograph"></i> 可使用轻量级模型</li>
            <li><i class="fa-solid fa-clock"></i> 更快响应速度</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 双 API：第二路配置（主 API 只负责剧情；最后一对 &lt;maintext&gt; 闭合后由第二路 generateRaw 单独处理变量，短上下文） -->
    <div
      v-if="outputMode === 'dual'"
      class="dual-api-config"
      :class="{ dark: isDarkMode, light: !isDarkMode }"
    >
      <h3 class="dual-api-title">
        <i class="fa-solid fa-sliders"></i>
        第二 API 配置
      </h3>
      <p class="dual-api-hint">
        主 API 仅生成与解析剧情（含 option/sum 等）；当主回复中最后一对
        <code>&lt;maintext&gt;</code> 闭合后，将其中正文与变量规则等合并为<strong>独立提示词</strong>，通过
        <code>generateRaw</code> 调用第二 API（默认不附带完整预设、聊天记录），仅输出
        <code>&lt;UpdateVariable&gt;</code>，再与主文合并为一条消息。
      </p>

      <label class="field-row checkbox-row">
        <input v-model="secondaryApi.useTavernMainConnection" type="checkbox" @change="persistSecondaryApi" />
        <span>使用酒馆当前聊天补全连接（与主对话同一插头，密钥不写入本地）</span>
      </label>

      <template v-if="!secondaryApi.useTavernMainConnection">
        <label class="field-label">API URL（OpenAI 兼容，可填根地址或 /v1 等）</label>
        <input
          v-model="secondaryApi.url"
          class="field-input"
          type="url"
          placeholder="https://api.openai.com/v1"
          autocomplete="off"
          @blur="persistSecondaryApi"
        />

        <label class="field-label">API Key</label>
        <input
          v-model="secondaryApi.key"
          class="field-input"
          type="password"
          placeholder="sk-..."
          autocomplete="new-password"
          @blur="persistSecondaryApi"
        />
      </template>

      <label class="field-label">模型</label>
      <div class="model-row">
        <input
          v-model="secondaryApi.model"
          class="field-input model-input"
          type="text"
          list="secondary-model-datalist"
          placeholder="手动输入或下方获取列表后选择"
          autocomplete="off"
          @blur="persistSecondaryApi"
        />
        <datalist id="secondary-model-datalist">
          <option v-for="m in fetchedModels" :key="m" :value="m" />
        </datalist>
      </div>

      <label class="field-label">最大重试次数（0–10，失败后的额外尝试次数）</label>
      <div class="retry-row">
        <input
          v-model.number="secondaryApi.maxRetries"
          class="field-input retry-input"
          type="number"
          min="0"
          max="10"
          step="1"
          @change="onRetriesChange"
        />
        <span class="retry-note">总尝试次数 = 1 + 该值</span>
      </div>

      <div class="field-label">第二 API 任务</div>
      <label class="field-row checkbox-row">
        <input v-model="secondaryApi.tasks.includeVariableUpdate" type="checkbox" @change="persistSecondaryApi" />
        <span>变量更新（&lt;UpdateVariable&gt;）</span>
      </label>
      <label class="field-row checkbox-row">
        <input v-model="secondaryApi.tasks.includeWorldTrend" type="checkbox" @change="persistSecondaryApi" />
        <span>世界大势相关说明</span>
      </label>
      <label class="field-row checkbox-row">
        <input v-model="secondaryApi.tasks.includeResidentLife" type="checkbox" @change="persistSecondaryApi" />
        <span>居民生活 / NPC 状态相关说明</span>
      </label>

      <div class="api-actions">
        <button
          type="button"
          class="btn-api"
          :disabled="secondaryTestLoading"
          @click="runSecondaryConnectionTest"
        >
          <i class="fa-solid fa-plug"></i>
          {{ secondaryTestLoading ? '测试中…' : '连接测试' }}
        </button>
        <button
          type="button"
          class="btn-api btn-api-secondary"
          :disabled="secondaryModelsLoading"
          @click="runFetchModels"
        >
          <i class="fa-solid fa-list"></i>
          {{ secondaryModelsLoading ? '获取中…' : '获取可用模型' }}
        </button>
      </div>
      <p v-if="secondaryTestMessage" class="api-status" :class="secondaryTestOk ? 'ok' : 'err'">
        {{ secondaryTestMessage }}
      </p>
    </div>
    </div>

    <!-- 点击选项时：直接发送 vs 填入输入框 -->
    <div v-show="settingsTab === 'options'" class="settings-tab-panel">
      <!-- 编辑暂存（购物车）：置顶，便于在系统设置中找到；默认开启见 DEFAULT_OTHER_SETTINGS -->
      <div
        class="edit-staging-cart-toggle"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
      >
        <div class="shujuku-master-section-head">
          <div class="shujuku-master-icon">
            <i class="fa-solid fa-cart-shopping"></i>
          </div>
          <div class="shujuku-master-section-titles">
            <span class="shujuku-master-section-title">编辑暂存（购物车）</span>
            <p class="shujuku-master-section-lead">
              <strong>默认开启。</strong>开启后修改世界/区域/个人规则与角色等先入队，在侧栏「暂存」统一检视后再写入变量；关闭后每次操作立即生效。
            </p>
          </div>
        </div>
        <div class="shujuku-toggle-row">
          <div class="shujuku-toggle-label">
            <span class="shujuku-toggle-title">启用编辑暂存</span>
            <span class="shujuku-toggle-hint">关闭时若购物车非空将询问是否清空暂存</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="enableEditStagingCart"
              @change="persistEnableEditStagingCart"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <p class="option-behavior-hint">
        点击剧情选项（A / B / C 等）时，将选项文本<strong>直接发送给 AI</strong>，或
        <strong>仅填入本界面底部输入框</strong>（可再编辑后手动发送），在此选择行为。
      </p>
      <div class="mode-cards mode-cards--standalone">
        <div
          class="mode-card"
          :class="{ active: inputActionMode === 'send', dark: isDarkMode, light: !isDarkMode }"
          @click="selectInputActionMode('send')"
        >
          <div class="mode-header">
            <div class="mode-icon">
              <i class="fa-solid fa-paper-plane"></i>
            </div>
            <div class="mode-info">
              <h4 class="mode-title">直接发送</h4>
              <span class="mode-badge">快捷</span>
            </div>
            <div class="mode-radio">
              <div class="radio-circle" :class="{ checked: inputActionMode === 'send' }">
                <i v-if="inputActionMode === 'send'" class="fa-solid fa-check"></i>
              </div>
            </div>
          </div>
          <div class="mode-body">
            <p class="mode-desc">选项文本填入输入框并立即发送</p>
            <ul class="mode-features">
              <li><i class="fa-solid fa-check"></i> 一键推进剧情</li>
              <li><i class="fa-solid fa-check"></i> 适合信任选项措辞时</li>
            </ul>
          </div>
        </div>

        <div
          class="mode-card"
          :class="{ active: inputActionMode === 'append', dark: isDarkMode, light: !isDarkMode }"
          @click="selectInputActionMode('append')"
        >
          <div class="mode-header">
            <div class="mode-icon dual">
              <i class="fa-solid fa-keyboard"></i>
            </div>
            <div class="mode-info">
              <h4 class="mode-title">填入输入框</h4>
              <span class="mode-badge">默认</span>
            </div>
            <div class="mode-radio">
              <div class="radio-circle" :class="{ checked: inputActionMode === 'append' }">
                <i v-if="inputActionMode === 'append'" class="fa-solid fa-check"></i>
              </div>
            </div>
          </div>
          <div class="mode-body">
            <p class="mode-desc">将选项文本写入前端对话框，不自动发送</p>
            <ul class="mode-features">
              <li><i class="fa-solid fa-check"></i> 可修改、补充后再发送</li>
              <li><i class="fa-solid fa-check"></i> 更安全，避免误点</li>
            </ul>
          </div>
        </div>
      </div>

      <p class="option-behavior-hint shujuku-options-hint" :class="{ dark: isDarkMode, light: !isDarkMode }">
        数据库的<strong>剧情推进</strong>与<strong>自动填表</strong>开关在<strong>输出与 API</strong>页顶部「数据库联动」区域。
      </p>
    </div>

    <!-- 界面缩放与主区域长宽（与开局页、游戏主界面共用 localStorage uiLayout） -->
    <div v-show="settingsTab === 'layout'" class="settings-tab-panel settings-tab-panel--layout">
      <p class="layout-intro-hint">
        调整<strong>整体字号与控件比例</strong>（缩放）、主界面<strong>最大宽度</strong>与<strong>最大高度</strong>。开局表单与进入游戏后的主 UI 会读取同一套设置。
      </p>

      <div class="layout-field-block">
        <div class="layout-field-head">
          <label class="field-label layout-field-label" for="ui-scale-range">界面缩放</label>
          <span class="layout-value-pill">{{ layoutScaleDisplay }}</span>
        </div>
        <input
          id="ui-scale-range"
          class="layout-range-input"
          type="range"
          min="0.8"
          max="1.3"
          step="0.05"
          :value="layoutScale"
          @input="onLayoutScaleInput"
        />
        <p class="layout-field-note">范围 0.8～1.3，默认 0.8。影响 <code>--ui-scale</code>。</p>
      </div>

      <div class="layout-field-block">
        <div class="layout-field-head">
          <label class="field-label layout-field-label" for="ui-max-width-range">主界面最大宽度（px）</label>
          <span class="layout-value-pill">{{ layoutMaxWidth }} px</span>
        </div>
        <input
          id="ui-max-width-range"
          class="layout-range-input"
          type="range"
          :min="UI_MAIN_WIDTH_MIN_PX"
          :max="UI_MAIN_WIDTH_MAX_PX"
          step="10"
          :value="layoutMaxWidth"
          @input="onLayoutMaxWidthInput"
        />
        <p class="layout-field-note">{{ UI_MAIN_WIDTH_MIN_PX }}～{{ UI_MAIN_WIDTH_MAX_PX }}，默认 900。</p>
      </div>

      <div class="layout-field-block">
        <div class="layout-field-head">
          <label class="field-label layout-field-label" for="ui-max-height-range">主界面最大高度（px）</label>
          <span class="layout-value-pill">{{ layoutMaxHeight }} px</span>
        </div>
        <input
          id="ui-max-height-range"
          class="layout-range-input"
          type="range"
          :min="UI_MAIN_HEIGHT_MIN_PX"
          :max="UI_MAIN_HEIGHT_MAX_PX"
          step="10"
          :value="layoutMaxHeight"
          @input="onLayoutMaxHeightInput"
        />
        <p class="layout-field-note">{{ UI_MAIN_HEIGHT_MIN_PX }}～{{ UI_MAIN_HEIGHT_MAX_PX }}，与 iframe 最小高度对齐。</p>
      </div>

      <p class="layout-field-note layout-field-note--footer">
        「高度模式」仅随存档保留字段，主界面尚未按该选项分支；当前实际高度以「最大高度」数值为准。调整缩放或宽高后会有轻提示。
      </p>
    </div>

    <!-- 保存成功提示：挂到 body，避免被侧栏 transform / overflow 裁切 -->
    <Teleport to="body">
      <div v-if="showSaveSuccess" class="save-success-toast save-success-toast--teleported">
        <i class="fa-solid fa-check-circle"></i>
        <span>设置已保存</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { OutputMode, SecondaryApiConfig, InputActionMode } from '../types';
import {
  DEFAULT_SECONDARY_API_CONFIG,
  testSecondaryApiConnection,
  fetchSecondaryApiModelList,
  clampSecondaryApiRetries,
} from '../utils/apiSettings';
import type { UiLayoutSettings } from '../utils/uiLayoutLimits';
import {
  UI_MAIN_HEIGHT_MIN_PX,
  UI_MAIN_HEIGHT_MAX_PX,
  UI_MAIN_WIDTH_MIN_PX,
  UI_MAIN_WIDTH_MAX_PX,
  clampMainUiHeightPx,
  clampMainUiWidthPx,
} from '../utils/uiLayoutLimits';
import {
  loadOutputMode,
  saveOutputMode,
  loadSecondaryApiConfig,
  saveSecondaryApiConfig,
  saveUiLayout,
} from '../utils/localSettings';
import { getOtherSettings, saveOtherSettings } from '../utils/otherSettings';
import { useEditCartStore } from '../stores/editCart';
import {
  loadFontSettings,
  applyFont,
  DEFAULT_FONT_SETTINGS,
  type FontSettings,
} from '../utils/fontManager';

const props = defineProps<{
  isDarkMode: boolean;
  /** 由 App 唯一水合，避免本组件再 readGameData 合并布局导致闪动 */
  uiLayout: UiLayoutSettings;
}>();

const emit = defineEmits<{
  (e: 'modeChange', mode: OutputMode): void;
  (e: 'updateWorldbook', mode: OutputMode): void;
  (e: 'layoutChange', layout: UiLayoutSettings): void;
}>();

const settingsTab = ref<'output' | 'options' | 'layout'>('output');

const outputMode = ref<OutputMode>('dual');

const inputActionMode = ref<InputActionMode>('append');

/** 发送前是否标记意图以触发数据库剧情推进 */
const enableShujukuPlotAdvance = ref(true);

/** 标签确认写入楼层后是否调用数据库 manualUpdate（默认开；未装插件时静默跳过） */
const enableShujukuManualUpdateAfterConfirm = ref(true);

/** 编辑暂存（购物车）：先入队再统一提交（默认开启，与 OtherSettings 一致） */
const enableEditStagingCart = ref(true);

const secondaryApi = ref<SecondaryApiConfig>({ ...DEFAULT_SECONDARY_API_CONFIG });

const fontSettings = ref<FontSettings>({ ...DEFAULT_FONT_SETTINGS });

const showSaveSuccess = ref(false);

const fetchedModels = ref<string[]>([]);
const secondaryTestLoading = ref(false);
const secondaryModelsLoading = ref(false);
const secondaryTestMessage = ref('');
const secondaryTestOk = ref(false);

const lastErrorToastTime = ref(0);
const ERROR_TOAST_THROTTLE = 5000;

/** 布局滑块连续拖动时限制 toastr 频率 */
const lastLayoutToastTime = ref(0);
const LAYOUT_TOAST_THROTTLE_MS = 400;

function normalizedLayout(): UiLayoutSettings {
  return {
    scale: Math.min(1.3, Math.max(0.8, Number(props.uiLayout.scale) || 0.8)),
    maxWidth: clampMainUiWidthPx(props.uiLayout.maxWidth ?? 900),
    maxHeight: clampMainUiHeightPx(props.uiLayout.maxHeight ?? 600),
    heightMode: props.uiLayout.heightMode === 'custom' ? 'custom' : 'fit',
  };
}

function commitLayout(patch: Partial<UiLayoutSettings>) {
  const base = normalizedLayout();
  const next: UiLayoutSettings = { ...base, ...patch };
  if (patch.scale !== undefined) {
    next.scale = Math.min(1.3, Math.max(0.8, Number(patch.scale)));
  }
  if (patch.maxWidth !== undefined) {
    next.maxWidth = clampMainUiWidthPx(patch.maxWidth);
  }
  if (patch.maxHeight !== undefined) {
    next.maxHeight = clampMainUiHeightPx(patch.maxHeight);
  }
  if (patch.heightMode !== undefined) {
    next.heightMode = patch.heightMode === 'custom' ? 'custom' : 'fit';
  }
  emit('layoutChange', next);
  saveUiLayout(next);
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);

  const now = Date.now();
  if (now - lastLayoutToastTime.value >= LAYOUT_TOAST_THROTTLE_MS) {
    lastLayoutToastTime.value = now;
    toastr.success('界面布局已应用');
  }
}

const layoutScale = computed(() => normalizedLayout().scale);

const layoutScaleDisplay = computed(() => `${layoutScale.value.toFixed(2)}×`);

const layoutMaxWidth = computed(() => normalizedLayout().maxWidth);

const layoutMaxHeight = computed(() => normalizedLayout().maxHeight);

function onLayoutScaleInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value);
  commitLayout({ scale: raw });
}

function onLayoutMaxWidthInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (!Number.isFinite(v)) return;
  commitLayout({ maxWidth: v });
}

function onLayoutMaxHeightInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (!Number.isFinite(v)) return;
  commitLayout({ maxHeight: v });
}

function throttledErrorToast(message: string) {
  const now = Date.now();
  if (now - lastErrorToastTime.value >= ERROR_TOAST_THROTTLE) {
    lastErrorToastTime.value = now;
    toastr.error(message);
  }
}

onMounted(() => {
  loadSettings();
});

function loadSettings() {
  try {
    outputMode.value = loadOutputMode();
    const loaded = loadSecondaryApiConfig();
    loaded.maxRetries = clampSecondaryApiRetries(loaded.maxRetries);
    secondaryApi.value = loaded;
    const other = getOtherSettings();
    inputActionMode.value = other.inputActionMode;
    enableShujukuPlotAdvance.value = other.enableShujukuPlotAdvance;
    enableShujukuManualUpdateAfterConfirm.value = other.enableShujukuManualUpdateAfterConfirm;
    enableEditStagingCart.value = other.enableEditStagingCart;
    fontSettings.value = loadFontSettings();
    applyFont(fontSettings.value.currentFontId);
    console.log('✅ [SettingsPanel] 设置从 localStorage 加载成功:', {
      outputMode: outputMode.value,
      secondaryApi: { ...secondaryApi.value, key: '***' },
      inputActionMode: inputActionMode.value,
      enableShujukuPlotAdvance: enableShujukuPlotAdvance.value,
      enableShujukuManualUpdateAfterConfirm: enableShujukuManualUpdateAfterConfirm.value,
      fontSettings: fontSettings.value,
    });
  } catch (error) {
    console.warn('⚠️ [SettingsPanel] 从 localStorage 加载设置失败:', error);
  }
}

function persistSecondaryApi() {
  secondaryApi.value.maxRetries = clampSecondaryApiRetries(secondaryApi.value.maxRetries);
  saveSecondaryApiConfig(secondaryApi.value);
}

function onRetriesChange() {
  secondaryApi.value.maxRetries = clampSecondaryApiRetries(secondaryApi.value.maxRetries);
  persistSecondaryApi();
}

async function runSecondaryConnectionTest() {
  secondaryTestMessage.value = '';
  secondaryTestLoading.value = true;
  try {
    await testSecondaryApiConnection(secondaryApi.value);
    secondaryTestOk.value = true;
    secondaryTestMessage.value = '连接成功：第二 API 可正常响应。';
    toastr.success('第二 API 连接成功');
  } catch (e) {
    secondaryTestOk.value = false;
    const msg = e instanceof Error ? e.message : String(e);
    secondaryTestMessage.value = `连接失败：${msg}`;
    toastr.error('第二 API 连接失败');
  } finally {
    secondaryTestLoading.value = false;
  }
}

async function runFetchModels() {
  secondaryTestMessage.value = '';
  secondaryModelsLoading.value = true;
  try {
    const list = await fetchSecondaryApiModelList(secondaryApi.value);
    fetchedModels.value = list.slice(0, 500);
    secondaryTestOk.value = true;
    secondaryTestMessage.value = `已获取 ${list.length} 个模型（列表已填入「模型」下拉联想）。`;
    toastr.success(`已获取 ${list.length} 个模型`);
  } catch (e) {
    secondaryTestOk.value = false;
    const msg = e instanceof Error ? e.message : String(e);
    secondaryTestMessage.value = `获取模型失败：${msg}`;
    toastr.error('获取模型列表失败');
  } finally {
    secondaryModelsLoading.value = false;
  }
}

function saveSettings(layoutSnapshot?: UiLayoutSettings) {
  const layout = layoutSnapshot ?? props.uiLayout;
  try {
    saveOutputMode(outputMode.value);
    secondaryApi.value.maxRetries = clampSecondaryApiRetries(secondaryApi.value.maxRetries);
    saveSecondaryApiConfig(secondaryApi.value);
    saveUiLayout(layout);
    saveOtherSettings({
      inputActionMode: inputActionMode.value,
      enableShujukuPlotAdvance: enableShujukuPlotAdvance.value,
      enableShujukuManualUpdateAfterConfirm: enableShujukuManualUpdateAfterConfirm.value,
      enableEditStagingCart: enableEditStagingCart.value,
    });
    showSaveSuccess.value = true;
    setTimeout(() => {
      showSaveSuccess.value = false;
    }, 2000);
  } catch (error) {
    console.error('保存设置失败:', error);
    throttledErrorToast('设置保存失败');
  }
}

function persistShujukuPlotAdvance() {
  saveOtherSettings({
    enableShujukuPlotAdvance: enableShujukuPlotAdvance.value,
  });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(
    enableShujukuPlotAdvance.value ? '已开启：剧情推进' : '已关闭：剧情推进',
  );
}

function persistShujukuManualUpdateOption() {
  saveOtherSettings({
    enableShujukuManualUpdateAfterConfirm: enableShujukuManualUpdateAfterConfirm.value,
  });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(
    enableShujukuManualUpdateAfterConfirm.value
      ? '已开启：自动填表（确认标签后 manualUpdate）'
      : '已关闭：自动填表',
  );
}

function persistEnableEditStagingCart() {
  if (!enableEditStagingCart.value) {
    const cart = useEditCartStore();
    if (cart.pendingCount > 0) {
      const ok = window.confirm(
        '购物车中有未提交的修改。确定将清空暂存并关闭「编辑暂存」吗？点「取消」可保留开关与购物车。',
      );
      if (!ok) {
        enableEditStagingCart.value = true;
        return;
      }
      cart.clear();
    }
  }
  saveOtherSettings({ enableEditStagingCart: enableEditStagingCart.value });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(
    enableEditStagingCart.value ? '已开启：编辑暂存（购物车）' : '已关闭：编辑暂存（立即生效）',
  );
}

function selectInputActionMode(mode: InputActionMode) {
  if (inputActionMode.value === mode) return;
  inputActionMode.value = mode;
  saveOtherSettings({ inputActionMode: mode });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(mode === 'send' ? '已设为：点击选项直接发送' : '已设为：点击选项填入输入框');
}

async function selectMode(mode: OutputMode) {
  if (outputMode.value === mode) return;

  const oldMode = outputMode.value;
  outputMode.value = mode;

  await saveSettings();

  emit('modeChange', mode);

  if (mode === 'dual') {
    try {
      emit('updateWorldbook', mode);
      toastr.success('已切换到双API模式');
    } catch (error) {
      console.error('更新世界书失败:', error);
      toastr.error('切换失败');
    }
  } else if (oldMode === 'dual' && mode === 'single') {
    try {
      emit('updateWorldbook', mode);
      toastr.success('已切换到单API模式');
    } catch (error) {
      console.error('更新世界书失败:', error);
      toastr.error('切换失败');
    }
  }
}
</script>

<style lang="scss" scoped>
.settings-panel {
  padding: 24px;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.settings-panel--mode-only {
  justify-content: flex-start;
  overflow-y: auto;
}

.settings-tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: -4px 0 16px;
  flex-shrink: 0;
}

.settings-tab-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.dark .settings-tab-btn {
  background: #2d2d33;
  color: #d4d4d8;
  border-color: rgba(255, 255, 255, 0.12);
}

.dark .settings-tab-btn:hover {
  background: #3f3f46;
}

.dark .settings-tab-btn.active {
  background: #1e3a5f;
  border-color: #60a5fa;
  color: #f8fafc;
}

.light .settings-tab-btn {
  background: #fff;
  color: #3f3f46;
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.light .settings-tab-btn:hover {
  border-color: rgba(0, 0, 0, 0.12);
}

.light .settings-tab-btn.active {
  background: rgba(59, 130, 246, 0.08);
  border-color: #3b82f6;
  color: #1e40af;
}

.settings-tab-panel {
  flex: 1;
  min-height: 0;
}

.shujuku-bridge-block {
  margin-top: 20px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.dark .shujuku-bridge-block {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);
}

.light .shujuku-bridge-block {
  background: rgba(255, 255, 255, 0.6);
}

/* 数据库联动区域 */
.shujuku-master-toggle {
  margin-bottom: 20px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.dark .shujuku-master-toggle {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.25);
}

.light .shujuku-master-toggle {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.2);
}

.shujuku-master-section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.shujuku-master-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  color: white;
  font-size: 16px;
}

.shujuku-master-section-titles {
  flex: 1;
  min-width: 0;
}

.shujuku-master-section-title {
  display: block;
  font-size: 15px;
  font-weight: 600;
}

.shujuku-master-section-lead {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.45;
  opacity: 0.85;
}

.dark .shujuku-master-section-lead {
  color: #a1a1aa;
}

.light .shujuku-master-section-lead {
  color: #52525b;
}

.edit-staging-cart-toggle {
  margin: 0 0 20px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(234, 179, 8, 0.35);
}

.dark .edit-staging-cart-toggle {
  background: rgba(234, 179, 8, 0.1);
}

.light .edit-staging-cart-toggle {
  background: rgba(234, 179, 8, 0.06);
}

.edit-staging-cart-toggle .shujuku-master-icon {
  background: linear-gradient(135deg, #ca8a04, #eab308);
}

.shujuku-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.dark .shujuku-toggle-row {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.shujuku-master-section-head + .shujuku-toggle-row {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.shujuku-toggle-label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shujuku-toggle-title {
  font-size: 14px;
  font-weight: 600;
}

.shujuku-toggle-hint {
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.8;
}

.dark .shujuku-toggle-hint {
  color: #a1a1aa;
}

.light .shujuku-toggle-hint {
  color: #52525b;
}

.shujuku-options-hint {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}

.dark .shujuku-options-hint {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #d4d4d8;
}

.light .shujuku-options-hint {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #3f3f46;
}

/* 开关样式 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.25);
  border-radius: 24px;
  transition: 0.2s;
}

.dark .toggle-slider {
  background-color: rgba(255, 255, 255, 0.2);
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

input:checked + .toggle-slider {
  background-color: #3b82f6;
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* 禁用的子选项 */
.checkbox-row.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-row .muted {
  color: #71717a;
}

.shujuku-bridge-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.shujuku-bridge-lead {
  margin-bottom: 12px !important;
}

.shujuku-bridge-lead code {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
}

.dark .shujuku-bridge-lead code {
  background: rgba(255, 255, 255, 0.08);
}

.light .shujuku-bridge-lead code {
  background: rgba(0, 0, 0, 0.06);
}

.option-behavior-hint {
  font-size: 13px;
  line-height: 1.55;
  margin: 0 0 16px;
  opacity: 0.92;
}

.dark .option-behavior-hint {
  color: #d4d4d8;
}

.light .option-behavior-hint {
  color: #52525b;
}

.dark.settings-panel {
  background: #1f1f23;
}

.light.settings-panel {
  background: #f4f4f5;
}

.mode-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mode-cards--standalone {
  flex: 0 0 auto;
}

.mode-card {
  border-radius: 12px;
  border: 2px solid transparent;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
  }

  &.active {
    border-color: #3b82f6;
  }
}

.dark .mode-card {
  background: #2d2d33;
  border-color: rgba(255, 255, 255, 0.18);

  &:hover {
    background: #3f3f46;
    border-color: rgba(255, 255, 255, 0.28);
  }

  &.active {
    background: #1e40af;
    border-color: #93c5fd;
  }
}

.light .mode-card {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  &:hover {
    border-color: rgba(0, 0, 0, 0.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &.active {
    background: rgba(59, 130, 246, 0.05);
    border-color: #3b82f6;
  }
}

.mode-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.mode-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;

  &.dual {
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }
}

.mode-info {
  flex: 1;
}

.mode-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.dark .mode-title {
  color: #fafafa;
}

.light .mode-title {
  color: #18181b;
}

.mode-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #a1a1aa;

  &.advanced {
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }
}

.light .mode-badge {
  background: rgba(0, 0, 0, 0.05);
  color: #71717a;
}

.mode-radio {
  .radio-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    i {
      font-size: 12px;
    }
  }
}

.dark .mode-radio .radio-circle {
  border-color: rgba(255, 255, 255, 0.2);
  color: #3b82f6;

  &.checked {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }
}

.light .mode-radio .radio-circle {
  border-color: rgba(0, 0, 0, 0.2);
  color: #3b82f6;

  &.checked {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }
}

.mode-body {
  .mode-desc {
    font-size: 14px;
    margin-bottom: 12px;
    line-height: 1.5;
  }
}

.dark .mode-body .mode-desc {
  color: #d4d4d8;
}

.light .mode-body .mode-desc {
  color: #71717a;
}

.mode-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;

    i {
      font-size: 12px;
      width: 16px;
      text-align: center;
    }
  }
}

.dark .mode-features li {
  color: #e4e4e7;

  i {
    color: #4ade80;
  }
}

.light .mode-features li {
  color: #71717a;

  i {
    color: #16a34a;
  }
}

.save-success-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  animation: slideUp 0.3s ease;
  z-index: 20000;

  i {
    font-size: 16px;
  }
}

/* Teleport 到 body 后仍需压住侧栏 z-index:110 */
.save-success-toast--teleported {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.dark .save-success-toast {
  background: rgba(34, 197, 94, 0.9);
  color: #fff;
}

.light .save-success-toast {
  background: #22c55e;
  color: #fff;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.dual-api-config {
  margin-top: 20px;
  padding: 18px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.light .dual-api-config {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.6);
}

.dark .dual-api-config {
  background: rgba(0, 0, 0, 0.2);
}

.dual-api-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 10px;
}

.dark .dual-api-title {
  color: #fafafa;
}

.light .dual-api-title {
  color: #18181b;
}

.dual-api-hint {
  font-size: 12px;
  line-height: 1.55;
  margin: 0 0 14px;
  opacity: 0.9;
}

.dual-api-hint code {
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
}

.dark .dual-api-hint code {
  background: rgba(255, 255, 255, 0.08);
}

.light .dual-api-hint code {
  background: rgba(0, 0, 0, 0.06);
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin: 10px 0 6px;
  opacity: 0.9;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
}

.light .field-input {
  border-color: rgba(0, 0, 0, 0.12);
  background: #fff;
  color: #18181b;
}

.field-row.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0;
  font-size: 13px;
  cursor: pointer;
}

.field-row.checkbox-row input {
  margin-top: 3px;
}

.model-row {
  width: 100%;
}

.model-input {
  font-family: ui-monospace, monospace;
}

.retry-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.retry-input {
  width: 88px;
  max-width: 100%;
}

.retry-note {
  font-size: 12px;
  opacity: 0.75;
}

.api-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.btn-api {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: #3b82f6;
  color: #fff;
}

.btn-api:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-api-secondary {
  background: #64748b;
}

.dark .btn-api-secondary {
  background: #52525b;
}

.api-status {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.45;
}

.api-status.ok {
  color: #4ade80;
}

.api-status.err {
  color: #f87171;
}

.light .api-status.ok {
  color: #15803d;
}

.light .api-status.err {
  color: #b91c1c;
}

/* —— 界面与布局 标签页 —— */
.layout-intro-hint {
  font-size: 13px;
  line-height: 1.55;
  margin: 0 0 18px;
  opacity: 0.92;
}

.dark .layout-intro-hint {
  color: #d4d4d8;
}

.light .layout-intro-hint {
  color: #52525b;
}

.layout-field-block {
  margin-bottom: 4px;
}

.layout-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.layout-field-label {
  margin: 0 !important;
}

.layout-value-pill {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.dark .layout-value-pill {
  background: rgba(255, 255, 255, 0.08);
  color: #e4e4e7;
}

.light .layout-value-pill {
  background: rgba(0, 0, 0, 0.06);
  color: #3f3f46;
}

.layout-range-input {
  display: block;
  width: 100%;
  margin: 0 0 6px;
  accent-color: #3b82f6;
}

.layout-field-note {
  font-size: 12px;
  margin: 0 0 14px;
  opacity: 0.78;
  line-height: 1.45;
}

.dark .layout-field-note {
  color: #a1a1aa;
}

.light .layout-field-note {
  color: #71717a;
}

.layout-field-note code {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
}

.dark .layout-field-note code {
  background: rgba(255, 255, 255, 0.08);
}

.light .layout-field-note code {
  background: rgba(0, 0, 0, 0.06);
}

.layout-field-note--footer {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.light .layout-field-note--footer {
  border-top-color: rgba(0, 0, 0, 0.08);
}

.settings-tab-panel--layout .field-label:first-of-type {
  margin-top: 0;
}
</style>
