<template>
  <section id="panel-regional-rules" class="regional-rules-panel">
    <div class="section-header">
      <p class="desc">仅在特定地理区域或建筑内生效的规则。</p>
      <button id="btn-add-region" class="action-btn cyber-button" @click="$emit('openModal', 'add_region')">
        <i class="fa-solid fa-plus"></i>
        <span>新增区域</span>
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>正在加载区域规则...</span>
    </div>

    <template v-else>
      <!-- 顶部：折叠的归档区（按区域分组） -->
      <div
        v-if="archivedGrouped.length > 0"
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
            v-for="item in archivedGrouped"
            :key="item.regionName"
            class="archive-group"
          >
            <div class="archive-group-title">{{ item.regionName }}</div>
            <div
              v-for="rule in item.archived"
              :key="rule.id"
              class="archive-rule-row"
            >
              <span class="archive-rule-desc">{{ ruleSummary(rule) }}</span>
              <button
                class="restore-btn"
                title="复原"
                @click="onRestore(item.regionName, rule)"
              >
                <i class="fa-solid fa-rotate-left"></i>
                <span>复原</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="regions.length === 0 && archivedGrouped.length === 0" class="empty-state">
        <i class="fa-solid fa-map"></i>
        <p>暂无区域规则</p>
        <span class="hint">点击上方按钮新增区域</span>
      </div>

      <!-- 区域卡片（可折叠，展示启用规则与编辑/归档） -->
      <div v-else class="regions-grid">
        <div
          v-for="region in regions"
          :key="region.name"
          class="region-card-wrap"
        >
          <div class="region-card" :class="{ 'cyber-card': isDarkMode }">
            <button
              class="card-header"
              :class="{ expanded: expandedRegions.has(region.name) }"
              @click="toggleRegion(region.name)"
            >
              <div class="title-group">
                <i class="fa-solid fa-map"></i>
                <h3>{{ region.name }}</h3>
              </div>
              <span class="rule-count">{{ activeRulesList(region).length }} / {{ (region.rules || []).length }} 条</span>
              <i class="fa-solid fa-chevron-down header-chevron"></i>
            </button>
            <div v-show="expandedRegions.has(region.name)" class="card-body">
              <div
                v-for="rule in activeRulesList(region)"
                :key="rule.id"
                class="rule-row"
                :class="{ 'cyber-flowing-border': isDarkMode }"
              >
                <div class="rule-desc">{{ rule.desc || rule.title }}</div>
                <div class="rule-actions">
                  <button
                    class="action edit"
                    title="编辑"
                    @click="$emit('openModal', 'edit_region_rule', { regionId: region.id, regionName: region.name, rule })"
                  >
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button
                    class="action archive"
                    title="归档"
                    @click="onArchive(region.name, rule)"
                  >
                    <i class="fa-solid fa-archive"></i>
                  </button>
                </div>
              </div>
              <!-- 在区域卡片内新增细分规则入口 -->
              <button
                class="add-subrule"
                :class="{ 'cyber-dashed-btn': isDarkMode }"
                @click="$emit('openModal', 'add_region_rule', regionPayload(region))"
              >
                <i class="fa-solid fa-plus"></i>
                <span>在该区域新增细分规则</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { RegionData, RuleData } from '../types';
import { useRegionalRules, useRegionalArchivedGrouped } from '../store';
import { submitArchiveRegionalRule, submitRestoreRegionalRule } from '../utils/dialogAndVariable';

withDefaults(defineProps<{ isDarkMode?: boolean }>(), { isDarkMode: false });

const emit = defineEmits<{
  (e: 'openModal', type: string, payload?: Record<string, any>): void;
}>();

const isLoading = ref(true);
const archiveSectionOpen = ref(false);
const expandedRegions = ref<Set<string>>(new Set());

// ⭐ 使用新的响应式 store
const regions = useRegionalRules();
const archivedGrouped = useRegionalArchivedGrouped();

const totalArchived = computed(() =>
  archivedGrouped.value.reduce((sum, g) => sum + g.archived.length, 0)
);

// 监听数据加载完成
watch(regions, (val) => {
  if (val) {
    isLoading.value = false;
    console.log('✅ [RegionalRulesPanel] 加载区域规则:', val.length);
  }
}, { immediate: true });

function activeRulesList(region: RegionData): RuleData[] {
  return (region.rules || []).filter((r) => r.status === 'active');
}

function ruleSummary(rule: RuleData): string {
  const d = (rule.title || rule.desc || '').trim();
  return d.length > 40 ? d.slice(0, 40) + '…' : d || '（无描述）';
}

function regionPayload(region: RegionData): Record<string, any> {
  return {
    id: region.id,
    name: region.name,
    description: region.description,
    rules: region.rules,
  };
}

function toggleRegion(name: string) {
  const next = new Set(expandedRegions.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  expandedRegions.value = next;
}

async function onArchive(regionName: string, rule: RuleData) {
  await submitArchiveRegionalRule(regionName, rule.id, ruleSummary(rule));
  // 无需手动刷新，store 会自动更新
}

async function onRestore(regionName: string, rule: RuleData) {
  await submitRestoreRegionalRule(regionName, rule.id, ruleSummary(rule));
  // 无需手动刷新，store 会自动更新
}
</script>

<style lang="scss" scoped>
.regional-rules-panel {
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

.regions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.region-card:not(.cyber-card) {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
}

.region-card.cyber-card {
  border-radius: 12px;
  overflow: hidden;
}

:global(.light) .region-card:not(.cyber-card) {
  background: rgba(0, 0, 0, 0.02);
  border-color: rgba(0, 0, 0, 0.06);
}

.card-header {
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

  .title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;

    i {
      color: #f59e0b;
      font-size: 16px;
    }

    h3 {
      margin: 0;
      font-size: 14px;
      color: #e4e4e7;
    }
  }

  .rule-count {
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

:global(.light) .card-header {
  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .title-group h3 {
    color: #27272a;
  }
}

.card-body {
  padding: 0 16px 16px;
}

.rule-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
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
  }
}

.add-subrule {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #71717a;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: #e4e4e7;
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }
}

:global(.light) .add-subrule {
  background: rgba(0, 0, 0, 0.02);
  border-color: rgba(0, 0, 0, 0.1);
  color: #a1a1aa;

  &:hover {
    color: #27272a;
    background: rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.2);
  }
}
</style>
