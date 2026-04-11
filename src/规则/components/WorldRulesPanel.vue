<template>
  <section id="panel-world-rules" class="world-rules-panel">
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
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import RuleListItem from './RuleListItem.vue';
import type { RuleData } from '../types';
import { useWorldRules } from '../store';
import { submitRestoreWorldRule } from '../utils/dialogAndVariable';

withDefaults(defineProps<{ isDarkMode?: boolean }>(), { isDarkMode: false });

const emit = defineEmits<{
  (e: 'openModal', type: string, payload?: Record<string, any>): void;
}>();

const isLoading = ref(true);
const archiveSectionOpen = ref(false);

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
  await submitRestoreWorldRule(rule.id ?? rule.title);
  // 无需手动刷新，store 会自动更新
}
</script>

<style lang="scss" scoped>
.world-rules-panel {
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
