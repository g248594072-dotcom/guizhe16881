<template>
  <section class="world-life-panel" :class="{ dark: isDarkMode, light: !isDarkMode }">
    <!-- 主标签页切换 -->
    <div class="tabs-header">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'world' }"
        @click="switchTab('world')"
      >
        <i class="fa-solid fa-earth-asia"></i>
        <span>世界</span>
        <span v-if="unreadWorldCount > 0" class="badge">{{ unreadWorldCount }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'personal' }"
        @click="switchTab('personal')"
      >
        <i class="fa-solid fa-users"></i>
        <span>个人</span>
        <span v-if="unreadPersonalCount > 0" class="badge">{{ unreadPersonalCount }}</span>
      </button>
    </div>

    <!-- 世界标签页 -->
    <div v-show="activeTab === 'world'" class="tab-content">
      <div v-if="worldRecords.length === 0" class="empty-state">
        <i class="fa-solid fa-earth-americas"></i>
        <p>暂无世界大势记录</p>
        <span class="hint">世界或区域级规则变更后将自动生成</span>
      </div>

      <template v-else>
        <!-- 最新记录概览 -->
        <div
          v-if="latestWorldRecord"
          class="latest-card"
          :class="{ unread: !latestWorldRecord.isRead, expanded: expandedWorld === latestWorldRecord.id }"
          @click="toggleWorldExpand(latestWorldRecord.id)"
        >
          <div class="latest-header">
            <span class="trigger">{{ latestWorldRecord.triggerRule }}</span>
            <span class="level-badge" :class="latestWorldRecord.ruleLevel">
              {{ latestWorldRecord.ruleLevel === 'world' ? '世界' : '区域' }}
            </span>
            <span v-if="!latestWorldRecord.isRead" class="new-badge">新</span>
          </div>
          <p class="scope">影响范围：{{ latestWorldRecord.affectedScope }}</p>
          <p v-show="expandedWorld !== latestWorldRecord.id" class="changes-preview">
            {{ truncateText(latestWorldRecord.dailyLifeChanges, 100) }}
          </p>
          <div v-show="expandedWorld === latestWorldRecord.id" class="detail-content">
            <p class="changes">{{ latestWorldRecord.dailyLifeChanges }}</p>
          </div>
        </div>

        <!-- 历史记录列表 -->
        <div class="section-title">历史记录</div>
        <div class="records-list">
          <div
            v-for="record in worldRecords.slice(1)"
            :key="record.id"
            class="record-card"
            :class="{ unread: !record.isRead, expanded: expandedWorld === record.id }"
            @click="toggleWorldExpand(record.id)"
          >
            <div class="record-header">
              <span class="time">{{ formatRecordTime(record.timestamp) }}</span>
              <span class="level-tag" :class="record.ruleLevel">
                {{ record.ruleLevel === 'world' ? '世界' : '区域' }}
              </span>
              <span class="trigger">{{ record.triggerRule }}</span>
              <span v-if="!record.isRead" class="unread-dot"></span>
            </div>
            <p class="scope">{{ record.affectedScope }}</p>
            <div v-show="expandedWorld === record.id" class="record-detail">
              <p class="changes">{{ record.dailyLifeChanges }}</p>
            </div>
          </div>
        </div>

        <!-- 随机NPC案例区 -->
        <div v-if="randomNpcCase" class="npc-case-section">
          <div class="npc-header">
            <div class="npc-title">
              <i class="fa-solid fa-user"></i>
              <span>随机案例：{{ randomNpcCase.name }}</span>
            </div>
            <button class="refresh-btn" @click.stop="refreshRandomNpc">
              <i class="fa-solid fa-rotate"></i>
              换一个
            </button>
          </div>
          <div class="npc-content">
            <p class="identity">
              <strong>身份：</strong>
              {{ randomNpcCase.identity }}
            </p>
            <p class="life-change">
              <strong>生活变化：</strong>
              {{ randomNpcCase.lifeChange }}
            </p>
            <p class="psychological">
              <strong>内心反应：</strong>
              {{ randomNpcCase.psychological }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <!-- 个人标签页 -->
    <div v-show="activeTab === 'personal'" class="tab-content">
      <div v-if="residentRecords.length === 0" class="empty-state">
        <i class="fa-solid fa-users-slash"></i>
        <p>暂无居民生活记录</p>
        <span class="hint">个人规则变更或角色退场后将自动生成</span>
      </div>

      <template v-else>
        <!-- 最新记录概览 -->
        <div
          v-if="latestResidentRecord"
          class="latest-card"
          :class="{ unread: !latestResidentRecord.isRead, expanded: expandedResident === latestResidentRecord.id }"
          @click="toggleResidentExpand(latestResidentRecord.id)"
        >
          <div class="latest-header">
            <span class="trigger">{{ latestResidentRecord.triggerRule }}</span>
            <span class="target-badge">目标：{{ latestResidentRecord.targetCharacter }}</span>
            <span v-if="!latestResidentRecord.isRead" class="new-badge">新</span>
          </div>
          <p class="scope">
            影响角色：
            {{ latestResidentRecord.otherCharacters.map((c) => c.name).join('、') }}
          </p>
          <div v-show="expandedResident === latestResidentRecord.id" class="detail-content">
            <div
              v-for="char in latestResidentRecord.otherCharacters"
              :key="char.name"
              class="character-item"
            >
              <div class="char-header">
                <span class="char-name">{{ char.name }}</span>
                <span class="char-status" :class="char.status">{{ char.status === 'retired' ? '暂时退场' : '未出场' }}</span>
              </div>
              <p class="char-life">{{ char.lifeDescription }}</p>
              <p v-if="char.abnormalChange && char.abnormalChange !== '无'" class="char-abnormal">
                <strong>异常：</strong>
                {{ char.abnormalChange }}
              </p>
            </div>
          </div>
        </div>

        <!-- 历史记录列表 -->
        <div class="section-title">历史记录</div>
        <div class="records-list">
          <div
            v-for="record in residentRecords.slice(1)"
            :key="record.id"
            class="record-card"
            :class="{ unread: !record.isRead, expanded: expandedResident === record.id }"
            @click="toggleResidentExpand(record.id)"
          >
            <div class="record-header">
              <span class="time">{{ formatRecordTime(record.timestamp) }}</span>
              <span class="target-tag">{{ record.targetCharacter }}</span>
              <span class="trigger">{{ record.triggerRule }}</span>
              <span v-if="!record.isRead" class="unread-dot"></span>
            </div>
            <p class="scope">
              影响：
              {{ record.otherCharacters.length }} 个角色
            </p>
            <div v-show="expandedResident === record.id" class="record-detail">
              <div
                v-for="char in record.otherCharacters"
                :key="char.name"
                class="character-item"
              >
                <div class="char-header">
                  <span class="char-name">{{ char.name }}</span>
                  <span class="char-status" :class="char.status">{{ char.status === 'retired' ? '暂时退场' : '未出场' }}</span>
                </div>
                <p class="char-life">{{ char.lifeDescription }}</p>
                <p v-if="char.abnormalChange && char.abnormalChange !== '无'" class="char-abnormal">
                  <strong>异常：</strong>
                  {{ char.abnormalChange }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  loadWorldTrendRecords,
  loadResidentLifeRecords,
  markWorldTrendAsRead,
  markResidentLifeAsRead,
  markAllWorldTrendAsRead,
  markAllResidentLifeAsRead,
  getUnreadWorldTrendCount,
  getUnreadResidentLifeCount,
  formatRecordTime,
  type WorldTrendRecord,
  type ResidentLifeRecord,
} from '../utils/worldLifeStorage';

const props = defineProps<{
  isDarkMode: boolean;
}>();

// ==================== State ====================
const activeTab = ref<'world' | 'personal'>('world');
const worldRecords = ref<WorldTrendRecord[]>([]);
const residentRecords = ref<ResidentLifeRecord[]>([]);
const expandedWorld = ref<string | null>(null);
const expandedResident = ref<string | null>(null);
const currentRandomNpcIndex = ref(0);

// ==================== Computed ====================
const latestWorldRecord = computed(() => worldRecords.value[0] ?? null);
const latestResidentRecord = computed(() => residentRecords.value[0] ?? null);

const unreadWorldCount = computed(() => {
  return worldRecords.value.filter((r) => !r.isRead).length;
});

const unreadPersonalCount = computed(() => {
  return residentRecords.value.filter((r) => !r.isRead).length;
});

const randomNpcCase = computed(() => {
  const recordsWithNpc = worldRecords.value.filter((r) => r.randomNpcCase);
  if (recordsWithNpc.length === 0) return null;
  const index = currentRandomNpcIndex.value % recordsWithNpc.length;
  return recordsWithNpc[index]?.randomNpcCase;
});

// ==================== Methods ====================
function loadData() {
  worldRecords.value = loadWorldTrendRecords();
  residentRecords.value = loadResidentLifeRecords();
}

function switchTab(tab: 'world' | 'personal') {
  // Mark all as read when switching away
  if (activeTab.value === 'world' && tab !== 'world') {
    markAllWorldTrendAsRead();
  } else if (activeTab.value === 'personal' && tab !== 'personal') {
    markAllResidentLifeAsRead();
  }

  activeTab.value = tab;
  loadData();
}

function toggleWorldExpand(id: string) {
  if (expandedWorld.value === id) {
    expandedWorld.value = null;
  } else {
    expandedWorld.value = id;
    markWorldTrendAsRead(id);
    loadData();
  }
}

function toggleResidentExpand(id: string) {
  if (expandedResident.value === id) {
    expandedResident.value = null;
  } else {
    expandedResident.value = id;
    markResidentLifeAsRead(id);
    loadData();
  }
}

function refreshRandomNpc() {
  currentRandomNpcIndex.value++;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ==================== Lifecycle ====================
onMounted(() => {
  loadData();

  // Listen for storage changes (for cross-tab sync)
  window.addEventListener('storage', (e) => {
    if (e.key?.includes('th_world_trend_') || e.key?.includes('th_resident_life_')) {
      loadData();
    }
  });

  // Periodic refresh (every 5 seconds)
  const interval = setInterval(loadData, 5000);

  // Cleanup on unmount
  return () => {
    clearInterval(interval);
  };
});

// Watch for tab visibility changes
watch(
  () => activeTab.value,
  (tab) => {
    loadData();
  },
);
</script>

<style lang="scss" scoped>
.world-life-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ==================== Tabs Header ====================
.tabs-header {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.light .tabs-header {
  border-color: rgba(0, 0, 0, 0.06);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: transparent;
  color: #a1a1aa;

  i {
    font-size: 14px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.03);
    color: #e4e4e7;
  }

  &.active {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
}

.light .tab-btn {
  color: #71717a;

  &:hover {
    background: rgba(0, 0, 0, 0.03);
    color: #27272a;
  }

  &.active {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 600;
}

// ==================== Tab Content ====================
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

// ==================== Empty State ====================
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 16px;
  color: #71717a;

  i {
    font-size: 48px;
    opacity: 0.3;
  }

  p {
    font-size: 16px;
    font-weight: 500;
  }

  .hint {
    font-size: 13px;
    text-align: center;
    max-width: 280px;
  }
}

.light .empty-state {
  color: #a1a1aa;
}

// ==================== Latest Card ====================
.latest-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &.unread {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.05);
  }

  &.expanded {
    .detail-content {
      display: block;
    }
  }
}

.light .latest-card {
  background: rgba(0, 0, 0, 0.02);
  border-color: rgba(0, 0, 0, 0.06);

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  &.unread {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.03);
  }
}

.latest-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.trigger {
  font-weight: 600;
  font-size: 15px;
  color: #e4e4e7;
  flex: 1;
}

.light .trigger {
  color: #27272a;
}

.level-badge,
.target-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.level-badge {
  &.world {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  &.regional {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }
}

.target-badge {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.new-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: #ef4444;
  color: white;
}

.scope {
  font-size: 13px;
  color: #a1a1aa;
  margin-bottom: 12px;
}

.light .scope {
  color: #71717a;
}

.changes-preview {
  font-size: 13px;
  color: #71717a;
  line-height: 1.5;
}

.changes {
  font-size: 14px;
  color: #e4e4e7;
  line-height: 1.6;
  white-space: pre-wrap;
}

.light .changes {
  color: #3f3f46;
}

.detail-content {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.light .detail-content {
  border-color: rgba(0, 0, 0, 0.06);
}

// ==================== Section Title ====================
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  padding-left: 4px;
}

.light .section-title {
  color: #a1a1aa;
}

// ==================== Records List ====================
.records-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.record-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &.unread {
    border-left: 3px solid #3b82f6;
  }

  &.expanded {
    .record-detail {
      display: block;
    }
  }
}

.light .record-card {
  background: rgba(0, 0, 0, 0.01);
  border-color: rgba(0, 0, 0, 0.04);

  &:hover {
    background: rgba(0, 0, 0, 0.03);
    border-color: rgba(0, 0, 0, 0.08);
  }

  &.unread {
    border-left-color: #2563eb;
  }
}

.record-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.time {
  font-size: 12px;
  color: #71717a;
  font-variant-numeric: tabular-nums;
}

.level-tag,
.target-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
}

.level-tag {
  &.world {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  &.regional {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }
}

.target-tag {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  margin-left: auto;
}

.record-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.light .record-detail {
  border-color: rgba(0, 0, 0, 0.06);
}

// ==================== NPC Case Section ====================
.npc-case-section {
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}

.light .npc-case-section {
  background: rgba(245, 158, 11, 0.03);
}

.npc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.npc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #f59e0b;

  i {
    font-size: 14px;
  }
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: #a1a1aa;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e4e4e7;
  }
}

.light .refresh-btn {
  background: rgba(0, 0, 0, 0.05);
  color: #71717a;

  &:hover {
    background: rgba(0, 0, 0, 0.08);
    color: #27272a;
  }
}

.npc-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #a1a1aa;
  line-height: 1.6;

  strong {
    color: #e4e4e7;
  }
}

.light .npc-content {
  color: #71717a;

  strong {
    color: #27272a;
  }
}

// ==================== Character Items (Personal Tab) ====================
.character-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.light .character-item {
  background: rgba(0, 0, 0, 0.02);
}

.char-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.char-name {
  font-weight: 500;
  color: #e4e4e7;
}

.light .char-name {
  color: #27272a;
}

.char-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;

  &.inactive {
    background: rgba(107, 114, 128, 0.1);
    color: #6b7280;
  }

  &.retired {
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
  }
}

.char-life {
  font-size: 13px;
  color: #a1a1aa;
  line-height: 1.5;
  margin-bottom: 4px;
}

.char-abnormal {
  font-size: 12px;
  color: #ef4444;
  line-height: 1.5;
}
</style>
