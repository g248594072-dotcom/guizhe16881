<template>
  <section id="panel-personal-rules" class="personal-rules-panel">
    <div class="section-header">
      <p class="desc">针对特定个体的专属规则与设定。</p>
      <button id="btn-add-personal-rule" class="action-btn cyber-button" @click="$emit('openModal', 'add_personal_rule')">
        <i class="fa-solid fa-plus"></i>
        <span>新增个人规则</span>
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>正在加载个人规则...</span>
    </div>

    <template v-else>
      <!-- 顶部：折叠的归档区（按人分组） -->
      <div
        v-if="archivedGroups.length > 0"
        class="archive-section"
        :class="{ 'cyber-card cyber-card--no-clip': isDarkMode }"
      >
        <button
          class="archive-toggle"
          :class="{ open: archiveSectionOpen }"
          @click="archiveSectionOpen = !archiveSectionOpen"
        >
          <i class="fa-solid fa-archive"></i>
          <span>已归档（{{ totalArchived }} 条）</span>
          <i class="fa-solid fa-chevron-down toggle-icon"></i>
        </button>
        <div v-show="archiveSectionOpen" class="archive-content">
          <div
            v-for="grp in archivedGroups"
            :key="grp.groupName"
            class="archive-group"
          >
            <div class="archive-group-title">{{ grp.groupName }}</div>
            <div
              v-for="rule in grp.archived"
              :key="rule.id"
              class="archive-rule-row"
            >
              <span class="archive-rule-desc">{{ ruleSummary(rule) }}</span>
              <button
                class="restore-btn"
                title="复原"
                @click="onRestore(rule, grp.groupName)"
              >
                <i class="fa-solid fa-rotate-left"></i>
                <span>复原</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="grouped.length === 0 && archivedGroups.length === 0" class="empty-state">
        <i class="fa-solid fa-user-circle"></i>
        <p>暂无个人规则</p>
        <span class="hint">点击上方按钮添加新规则，或等待AI生成初始数据</span>
      </div>

      <!-- 按人分组的折叠列表 -->
      <div v-else class="personal-rules-list">
        <div
          v-for="grp in grouped"
          :key="grp.groupName"
          class="group-card"
          :class="{ 'cyber-card': isDarkMode }"
        >
          <button
            class="group-header"
            :class="{ expanded: expandedGroups.has(grp.groupName) }"
            @click="toggleGroup(grp.groupName)"
          >
            <i class="fa-solid fa-user-circle"></i>
            <span class="group-name">{{ grp.groupName }}</span>
            <span class="group-count">{{ grp.active.length }} / {{ grp.active.length + grp.archived.length }} 条</span>
            <i class="fa-solid fa-chevron-down header-chevron"></i>
          </button>
          <div v-show="expandedGroups.has(grp.groupName)" class="group-body">
            <div
              v-for="rule in grp.active"
              :key="rule.id"
              class="rule-row"
              :class="{ 'cyber-flowing-border': isDarkMode }"
            >
              <div class="rule-desc">{{ rule.desc || rule.title }}</div>
              <div class="rule-actions">
                <button
                  class="action edit"
                  title="编辑"
                  @click="$emit('openModal', 'edit_personal_rule', rulePayload(rule, grp.groupName))"
                >
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button
                  class="action archive"
                  title="归档"
                  @click="onArchive(rule, grp.groupName)"
                >
                  <i class="fa-solid fa-archive"></i>
                </button>
                <button
                  class="action delete"
                  title="删除"
                  @click="$emit('openModal', 'delete_personal_rule', rulePayload(rule, grp.groupName))"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { RuleData } from '../types';
import { usePersonalRulesByCharacter } from '../store';
import { submitArchivePersonalRule, submitRestorePersonalRule } from '../utils/dialogAndVariable';

const props = defineProps<{
  /** 从角色详情「管理规则影响」跳转时要展开的分组名（与 rule.target 一致） */
  expandGroupName?: string | null;
  isDarkMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'openModal', type: string, payload?: Record<string, any>): void;
  (e: 'expandGroupConsumed'): void;
}>();

const isLoading = ref(true);
const archiveSectionOpen = ref(false);
const expandedGroups = ref<Set<string>>(new Set());

// ⭐ 使用新的响应式 store
const grouped = usePersonalRulesByCharacter();

const archivedGroups = computed(() =>
  grouped.value.filter((g) => g.archived.length > 0)
);

const totalArchived = computed(() =>
  archivedGroups.value.reduce((sum, g) => sum + g.archived.length, 0)
);

// 监听数据加载完成
watch(grouped, (val) => {
  if (val) {
    isLoading.value = false;
    console.log('✅ [PersonalRulesPanel] 加载个人规则:', val.length);
  }
}, { immediate: true });

function ruleSummary(rule: RuleData): string {
  if (rule.title && rule.title !== (rule as any).target) return rule.title;
  const d = (rule.desc || '').trim();
  return d.length > 40 ? d.slice(0, 40) + '…' : d || '（无描述）';
}

function rulePayload(rule: RuleData, character: string): Record<string, any> {
  return {
    id: rule.id,
    title: rule.title,
    character,
    desc: rule.desc,
  };
}

function toggleGroup(name: string) {
  const next = new Set(expandedGroups.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  expandedGroups.value = next;
}

let expandFailSafeTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  [() => props.expandGroupName, grouped],
  () => {
    const n = props.expandGroupName?.trim();
    if (!n) return;
    if (expandFailSafeTimer) {
      clearTimeout(expandFailSafeTimer);
      expandFailSafeTimer = null;
    }
    nextTick(() => {
      const names = grouped.value.map((g) => g.groupName);
      if (names.includes(n)) {
        const next = new Set(expandedGroups.value);
        next.add(n);
        expandedGroups.value = next;
        emit('expandGroupConsumed');
        return;
      }
      expandFailSafeTimer = setTimeout(() => {
        expandFailSafeTimer = null;
        emit('expandGroupConsumed');
      }, 1200);
    });
  },
  { deep: true },
);

async function onArchive(rule: RuleData, groupName: string) {
  await submitArchivePersonalRule(rule.id, groupName, ruleSummary(rule));
  // 无需手动刷新，store 会自动更新
}

async function onRestore(rule: RuleData, groupName: string) {
  await submitRestorePersonalRule(rule.id, groupName, ruleSummary(rule));
  // 无需手动刷新，store 会自动更新
}
</script>

<style lang="scss" scoped>
.personal-rules-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 12px;
  color: #71717a;
  text-align: center;

  i {
    font-size: 32px;
    opacity: 0.5;
  }

  .hint {
    font-size: 12px;
    opacity: 0.7;
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

.archive-group {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.archive-group-title {
  font-size: 12px;
  color: #71717a;
  margin-bottom: 8px;
  padding-left: 4px;
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

.personal-rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card:not(.cyber-card) {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
}

.group-card.cyber-card {
  border-radius: 12px;
  overflow: hidden;
}

:global(.light) .group-card:not(.cyber-card) {
  background: rgba(0, 0, 0, 0.02);
  border-color: rgba(0, 0, 0, 0.06);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  i:first-child {
    color: #8b5cf6;
    font-size: 18px;
  }

  .group-name {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: #e4e4e7;
    text-align: left;
  }

  .group-count {
    font-size: 12px;
    color: #71717a;
  }

  .header-chevron {
    color: #71717a;
    transition: transform 0.2s;
  }

  &.expanded .header-chevron {
    transform: rotate(180deg);
  }
}

:global(.light) .group-header {
  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .group-name {
    color: #27272a;
  }
}

.group-body {
  padding: 0 16px 16px;
}

.rule-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }
}

:global(.light) .rule-row {
  border-color: rgba(0, 0, 0, 0.05);
}

.rule-desc {
  font-size: 13px;
  color: #a1a1aa;
  flex: 1;
  margin-right: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-actions {
  display: flex;
  gap: 4px;

  .action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;

    &.edit {
      color: #60a5fa;
      background: rgba(96, 165, 250, 0.1);

      &:hover {
        background: rgba(96, 165, 250, 0.2);
      }
    }

    &.archive {
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);

      &:hover {
        background: rgba(245, 158, 11, 0.2);
      }
    }

    &.delete {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);

      &:hover {
        background: rgba(239, 68, 68, 0.2);
      }
    }
  }
}
</style>
