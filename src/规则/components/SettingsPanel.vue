<template>
  <div class="settings-panel settings-panel--mode-only" :class="{ dark: isDarkMode, light: !isDarkMode }">
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

    <!-- 保存成功提示 -->
    <div v-if="showSaveSuccess" class="save-success-toast">
      <i class="fa-solid fa-check-circle"></i>
      <span>设置已保存</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { OutputMode, SecondaryApiConfig, InputActionMode } from '../types';
import { DEFAULT_SECONDARY_API_CONFIG } from '../utils/apiSettings';
import type { UiLayoutSettings } from '../utils/uiLayoutLimits';
import {
  loadOutputMode,
  saveOutputMode,
  loadSecondaryApiConfig,
  saveSecondaryApiConfig,
  saveUiLayout,
  loadOtherSettings,
  saveOtherSettingsLocal,
} from '../utils/localSettings';
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

const outputMode = ref<OutputMode>('dual');

const inputActionMode = ref<InputActionMode>('append');

const secondaryApi = ref<SecondaryApiConfig>({ ...DEFAULT_SECONDARY_API_CONFIG });

const fontSettings = ref<FontSettings>({ ...DEFAULT_FONT_SETTINGS });

const showSaveSuccess = ref(false);

const lastErrorToastTime = ref(0);
const ERROR_TOAST_THROTTLE = 5000;

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
    secondaryApi.value = loadSecondaryApiConfig();
    const otherSettings = loadOtherSettings();
    inputActionMode.value = otherSettings.inputActionMode;
    fontSettings.value = loadFontSettings();
    applyFont(fontSettings.value.currentFontId);
    console.log('✅ [SettingsPanel] 设置从 localStorage 加载成功:', {
      outputMode: outputMode.value,
      secondaryApi: { ...secondaryApi.value, key: '***' },
      inputActionMode: inputActionMode.value,
      fontSettings: fontSettings.value,
    });
  } catch (error) {
    console.warn('⚠️ [SettingsPanel] 从 localStorage 加载设置失败:', error);
  }
}

function saveSettings(layoutSnapshot?: UiLayoutSettings) {
  const layout = layoutSnapshot ?? props.uiLayout;
  try {
    saveOutputMode(outputMode.value);
    saveSecondaryApiConfig(secondaryApi.value);
    saveUiLayout(layout);
    saveOtherSettingsLocal({
      inputActionMode: inputActionMode.value,
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

  i {
    font-size: 16px;
  }
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
</style>
