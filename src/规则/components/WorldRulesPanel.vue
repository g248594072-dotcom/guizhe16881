<template>
  <section id="panel-world-rules" class="world-rules-panel">
    <div class="wrm-tabs" role="tablist" aria-label="世界规则与元信息">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'rules'"
        class="wrm-tab"
        :class="{ 'wrm-tab--active': activeTab === 'rules' }"
        @click="activeTab = 'rules'"
      >
        世界规则
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'meta'"
        class="wrm-tab"
        :class="{ 'wrm-tab--active': activeTab === 'meta' }"
        @click="activeTab = 'meta'"
      >
        世界元信息
      </button>
    </div>

    <div
      v-show="activeTab === 'meta'"
      class="wrm-tab-panel wrm-meta-panel"
      :class="{ dark: isDarkMode, light: !isDarkMode }"
      role="tabpanel"
    >
      <div v-show="!metaEditMode" class="wrm-meta-view-outer">
        <div class="wrm-meta-view-header">
          <button type="button" class="wrm-meta-edit-btn" @click="enterMetaEdit">
            <i class="fa-solid fa-pen"></i>
            编辑
          </button>
        </div>
        <div class="wrm-meta-view">
          <div class="wrm-field-label">世界类型</div>
          <div class="wrm-readonly-line">{{ displayWorldType }}</div>
          <div class="wrm-field-label">世界简介</div>
          <div class="wrm-readonly-block">{{ displayWorldIntro }}</div>
        </div>
      </div>

      <div v-show="metaEditMode" class="wrm-meta-form">
        <label class="wrm-field-label" for="wrm-world-type">世界类型</label>
        <input
          id="wrm-world-type"
          v-model="formWorldType"
          class="wrm-input"
          type="text"
          maxlength="64"
          placeholder="如：现代、西幻（留空将存为「现代」）"
        />
        <label class="wrm-field-label" for="wrm-world-intro">世界简介</label>
        <textarea
          id="wrm-world-intro"
          v-model="formWorldIntro"
          class="wrm-textarea"
          rows="8"
          maxlength="2000"
          placeholder="世界观补充说明"
        />
        <div class="wrm-meta-form-actions">
          <button type="button" class="wrm-save-btn" @click="onSaveMeta">
            <i class="fa-solid fa-floppy-disk"></i>
            保存
          </button>
          <button type="button" class="wrm-cancel-btn" @click="cancelMetaEdit">取消</button>
        </div>
      </div>
    </div>

    <div v-show="activeTab === 'rules'" class="wrm-tab-panel" role="tabpanel">
    <div class="section-header">
      <p class="desc">影响整个世界所有实体的基础法则。</p>
      <button id="btn-add-world-rule" class="action-btn cyber-button" @click="$emit('openModal', 'add_world_rule')">
        <i class="fa-solid fa-plus"></i>
        <span>新增世界规则</span>
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>正在加载世界规则...</span>
    </div>

    <template v-else>
      <!-- 顶部：折叠的归档区 -->
      <div
        v-if="archivedRules.length > 0"
        class="archive-section"
        :class="{ 'cyber-card cyber-card--no-clip': isDarkMode }"
      >
        <button
          class="archive-toggle"
          :class="{ open: archiveSectionOpen }"
          @click="archiveSectionOpen = !archiveSectionOpen"
        >
          <i class="fa-solid fa-archive"></i>
          <span>已归档（{{ archivedRules.length }} 条）</span>
          <i class="fa-solid fa-chevron-down toggle-icon"></i>
        </button>
        <div v-show="archiveSectionOpen" class="archive-content">
          <div
            v-for="rule in archivedRules"
            :key="rule.id"
            class="archive-rule-row"
          >
            <span class="archive-rule-desc">{{ rule.title || rule.desc?.slice(0, 40) || '（无标题）' }}</span>
            <button
              class="restore-btn"
              title="复原"
              @click="onRestore(rule)"
            >
              <i class="fa-solid fa-rotate-left"></i>
              <span>复原</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 启用中的规则列表 -->
      <div class="rules-list">
        <RuleListItem
          v-for="rule in activeRules"
          :key="rule.id"
          :is-dark-mode="isDarkMode"
          :title="rule.title"
          :desc="rule.desc"
          :status="rule.status"
          :rule="rule"
          @open-modal="(t, p) => $emit('openModal', t, p)"
        />
      </div>
    </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { klona } from 'klona';
import RuleListItem from './RuleListItem.vue';
import type { RuleData } from '../types';
import { useWorldRules, useDataStore, tryRulesMvuWritable } from '../store';
import {
  submitRestoreWorldRule,
  updateMetaWorldInfo,
  formatMetaWorldInfoMessage,
} from '../utils/dialogAndVariable';
import { isEditCartEnabled, buildMetaWorldInfoCartItem, stageItem } from '../utils/editCartFlow';
import { diffValueToJsonPatches } from '../utils/tacticalMapCommitSendBox';
import { appendPendingUpdateVariablePatches } from '../utils/pendingUpdateVariableQueue';
import { queuePendingPatchesFromBeforeSnapshot } from '../utils/queueStatDataPatchesFromDiff';

withDefaults(defineProps<{ isDarkMode?: boolean }>(), { isDarkMode: false });

const emit = defineEmits<{
  (e: 'openModal', type: string, payload?: Record<string, any>): void;
  (e: 'copyToInput', text: string): void;
}>();

const isLoading = ref(true);
const archiveSectionOpen = ref(false);
const activeTab = ref<'rules' | 'meta'>('rules');
const metaEditMode = ref(false);

const dataStore = useDataStore();
const formWorldType = ref('');
const formWorldIntro = ref('');

const displayWorldType = computed(() => {
  const t = formWorldType.value.trim();
  if (t) return t;
  return '现代';
});
const displayWorldIntro = computed(() => {
  const t = formWorldIntro.value;
  if (t == null || !String(t).length) {
    return '（未设置）';
  }
  return String(t);
});

function enterMetaEdit() {
  syncMetaFormFromStore();
  metaEditMode.value = true;
}

function cancelMetaEdit() {
  syncMetaFormFromStore();
  metaEditMode.value = false;
}

function syncMetaFormFromStore() {
  const meta = dataStore.data.元信息 as { 世界类型?: unknown; 世界简介?: unknown } | undefined;
  const wt = meta?.世界类型;
  formWorldType.value = wt == null || wt === '' ? '' : String(wt);
  const wi = meta?.世界简介;
  formWorldIntro.value = wi == null ? '' : String(wi);
}

watch(activeTab, (t) => {
  metaEditMode.value = false;
  if (t === 'meta') {
    syncMetaFormFromStore();
  }
});

watch(
  () => [activeTab.value, dataStore.data.元信息] as const,
  () => {
    if (activeTab.value === 'meta' && !metaEditMode.value) {
      syncMetaFormFromStore();
    }
  },
  { deep: true, immediate: true },
);

// ⭐ 使用新的响应式 store
const rules = useWorldRules();

const activeRules = computed(() => rules.value.filter((r) => r.status === 'active'));
const archivedRules = computed(() => rules.value.filter((r) => r.status !== 'active'));

// 监听数据加载完成
watch(rules, (val) => {
  if (val) {
    isLoading.value = false;
    console.log('✅ [WorldRulesPanel] 加载世界规则:', val.length);
  }
}, { immediate: true });

async function onRestore(rule: RuleData) {
  const statBefore = klona(dataStore.data);
  await submitRestoreWorldRule(rule.id ?? rule.title);
  queuePendingPatchesFromBeforeSnapshot(statBefore);
}

function onSaveMeta() {
  if (!tryRulesMvuWritable()) return;
  const wt = formWorldType.value.trim().slice(0, 64) || '现代';
  const intro = formWorldIntro.value.slice(0, 2000);
  if (isEditCartEnabled()) {
    stageItem(buildMetaWorldInfoCartItem(wt, intro));
    return;
  }
  const statBefore = klona(dataStore.data);
  updateMetaWorldInfo(wt, intro);
  const messageText = formatMetaWorldInfoMessage(wt, intro);
  const patches = diffValueToJsonPatches('', statBefore, klona(dataStore.data));
  if (patches.length > 0) {
    appendPendingUpdateVariablePatches(patches);
  }
  if (messageText) {
    emit('copyToInput', messageText);
  }
  toastr.success('已更新世界元信息');
  metaEditMode.value = false;
}
</script>

<style lang="scss" scoped>
.world-rules-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
}

.wrm-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 4px;
}

:global(.light) .wrm-tabs {
  border-bottom-color: rgba(0, 0, 0, 0.1);
}

.wrm-tab {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #a1a1aa;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.wrm-tab:hover {
  color: #e4e4e7;
}

.wrm-tab--active,
.wrm-tab[aria-selected='true'] {
  color: #22d3ee;
  border-bottom-color: #22d3ee;
}

:global(.light) .wrm-tab {
  color: #52525b;
}
:global(.light) .wrm-tab:hover {
  color: #18181b;
}
:global(.light) .wrm-tab--active,
:global(.light) .wrm-tab[aria-selected='true'] {
  color: #0891b2;
  border-bottom-color: #0891b2;
}

.wrm-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  flex: 1 1 auto;
}

.wrm-meta-panel {
  padding: 8px 4px 4px;
}

.wrm-meta-view-outer {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  align-self: flex-start;
  width: 100%;
  gap: 8px;
}

.wrm-meta-view-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 36px;
}

.wrm-meta-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: #a5f3fc;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.25);
  border-radius: 8px;
  transition: background 0.15s, border-color 0.15s;
}
.wrm-meta-edit-btn:hover {
  background: rgba(34, 211, 238, 0.2);
  border-color: rgba(34, 211, 238, 0.45);
  color: #e0f2fe;
}
:global(.light) .wrm-meta-edit-btn {
  color: #0e7490;
  background: rgba(8, 145, 178, 0.1);
  border-color: rgba(8, 145, 178, 0.3);
}
:global(.light) .wrm-meta-edit-btn:hover {
  background: rgba(8, 145, 178, 0.18);
  border-color: rgba(8, 145, 178, 0.45);
}

.wrm-meta-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  text-align: left;
  color: inherit;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
:global(.light) .wrm-meta-view {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
}

.wrm-readonly-line,
.wrm-readonly-block {
  color: #e4e4e7;
  font-size: 14px;
  line-height: 1.45;
}
:global(.light) .wrm-readonly-line,
:global(.light) .wrm-readonly-block {
  color: #27272a;
}

.wrm-readonly-line {
  padding: 4px 0 6px;
}

.wrm-readonly-block {
  min-height: 100px;
  max-height: 40vh;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  white-space: pre-wrap;
  overflow: auto;
}
:global(.light) .wrm-readonly-block {
  background: #f4f4f5;
  border-color: rgba(0, 0, 0, 0.1);
}

.wrm-meta-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 720px;
}

.wrm-field-label {
  font-size: 13px;
  font-weight: 600;
  color: #a1a1aa;
}

:global(.light) .wrm-field-label {
  color: #52525b;
}

.wrm-input,
.wrm-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.45;
  color: #e4e4e7;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.1);
  outline: none;
}

.wrm-textarea {
  resize: vertical;
  min-height: 120px;
  white-space: pre-wrap;
}

:global(.light) .wrm-input,
:global(.light) .wrm-textarea {
  color: #27272a;
  background: #fff;
  border-color: rgba(0, 0, 0, 0.12);
}

.wrm-input:focus,
.wrm-textarea:focus {
  border-color: rgba(34, 211, 238, 0.45);
}

.wrm-save-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: rgba(34, 211, 238, 0.2);
  color: #a5f3fc;
}

.wrm-save-btn:hover {
  background: rgba(34, 211, 238, 0.3);
}

:global(.light) .wrm-save-btn {
  background: rgba(8, 145, 178, 0.12);
  color: #0e7490;
}

:global(.light) .wrm-save-btn:hover {
  background: rgba(8, 145, 178, 0.2);
}

.wrm-meta-form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.wrm-cancel-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.06);
  color: #a1a1aa;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.wrm-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e4e4e7;
}
:global(.light) .wrm-cancel-btn {
  background: #fff;
  color: #52525b;
  border-color: rgba(0, 0, 0, 0.12);
}
:global(.light) .wrm-cancel-btn:hover {
  background: #fafafa;
  color: #18181b;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .desc {
    font-size: 14px;
    color: #a1a1aa;
  }
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: #e4e4e7;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

:global(.light) .action-btn {
  background: rgba(0, 0, 0, 0.05);
  color: #27272a;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 12px;
  color: #71717a;

  i {
    font-size: 24px;
  }
}

.archive-section:not(.cyber-card) {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
}

.archive-section.cyber-card {
  border-radius: 10px;
  overflow: hidden;
}

:global(.light) .archive-section:not(.cyber-card) {
  background: rgba(0, 0, 0, 0.02);
  border-color: rgba(0, 0, 0, 0.06);
}

.archive-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: #a1a1aa;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
    color: #e4e4e7;
  }

  .toggle-icon {
    margin-left: auto;
    transition: transform 0.2s;
  }

  &.open .toggle-icon {
    transform: rotate(180deg);
  }
}

:global(.light) .archive-toggle {
  color: #71717a;

  &:hover {
    background: rgba(0, 0, 0, 0.03);
    color: #27272a;
  }
}

.archive-content {
  padding: 8px 16px 16px;
}

.archive-rule-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }
}

:global(.light) .archive-rule-row {
  border-color: rgba(0, 0, 0, 0.05);
}

.archive-rule-desc {
  font-size: 13px;
  color: #71717a;
  flex: 1;
  min-width: 0;
  margin-right: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.restore-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.3);
  }
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 768px) {
  .archive-rule-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 10px 0;
  }

  .archive-rule-desc {
    margin-right: 0;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .restore-btn {
    align-self: flex-end;
  }
}
</style>
