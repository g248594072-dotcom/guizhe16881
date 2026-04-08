<template>
  <section id="panel-character-list" class="character-list">
    <div class="section-header">
      <p class="desc">管理当前世界中的所有角色实体。</p>
      <div class="actions">
        <button
          id="btn-add-character"
          class="action-btn cyber-button cyber-button-cyan"
          @click="$emit('openModal', 'add_character')"
        >
          <i class="fa-solid fa-plus"></i>
          <span>新增角色</span>
        </button>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="isLoading" class="loading-state">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>正在加载角色数据...</span>
    </div>

    <div v-else-if="visibleCharacters.length === 0" class="empty-state">
      <i class="fa-solid fa-users"></i>
      <p>暂无角色</p>
      <span class="hint">点击上方按钮添加新角色，或等待AI生成初始数据</span>
    </div>

    <div v-else class="character-grid">
      <article
        v-for="char in visibleCharacters"
        :key="char.id"
        class="character-card"
        @click="$emit('select', char.id)"
      >
        <div class="card-header">
          <div class="avatar">
            <img v-if="char.displayAvatar" class="avatar-face" :src="char.displayAvatar" alt="" />
            <i v-else class="fa-solid fa-user"></i>
          </div>
          <div class="info">
            <h4>{{ char.name }}</h4>
            <p>{{ char.role }} | {{ char.id }}</p>
          </div>
        </div>
        <div class="stats">
          <div class="stat-row">
            <span class="label">好感度 AFFECTION</span>
            <span class="value">{{ formatAffection(char.affection) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">发情值 LUST</span>
            <span class="value">{{ char.lust }}%</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useCharacters } from '../store';
import {
  loadCharacterAvatarOverrides,
  PHONE_CHARACTER_AVATARS_CHANGED,
  resolveCharacterAvatarFromBrowserOnly,
} from '../../shared/phoneCharacterAvatarStorage';

interface CharacterCardView {
  id: string;
  name: string;
  role: string;
  status: string;
  lust: number;
  affection: number;
  displayAvatar: string;
}

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'openModal', type: string): void;
}>();

const isLoading = ref(true);
const avatarStorageRev = ref(0);

// ⭐ 使用新的响应式 store
const characters = useCharacters();

function onBrowserAvatarStorageChange() {
  avatarStorageRev.value += 1;
}

const visibleCharacters = computed((): CharacterCardView[] => {
  void avatarStorageRev.value;
  const overrides = loadCharacterAvatarOverrides();
  return (characters.value || []).map(c => ({
    id: c.id,
    name: toDisplayName(c.name, c.id),
    role: '角色',
    status: c.status === 'active' ? '出场中' : '暂时退场',
    lust: typeof c.stats?.lust === 'number' ? c.stats.lust : 0,
    affection: typeof c.stats?.affection === 'number' ? c.stats.affection : 0,
    displayAvatar: resolveCharacterAvatarFromBrowserOnly(c.id, overrides, toDisplayName(c.name, c.id)),
  }));
});

/** 空数组 [] 在 JS 中为 truthy，原先 `if (val)` 会在首帧就结束加载并显示「暂无角色」，而角色档案往往晚于世界规则 / 第二 API 写入。 */
let emptyFallbackTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  characters,
  (val) => {
    if (val.length > 0) {
      isLoading.value = false;
      if (emptyFallbackTimer) {
        clearTimeout(emptyFallbackTimer);
        emptyFallbackTimer = null;
      }
    }
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener(PHONE_CHARACTER_AVATARS_CHANGED, onBrowserAvatarStorageChange);
  void nextTick(() => {
    if (characters.value.length > 0) {
      isLoading.value = false;
      return;
    }
    emptyFallbackTimer = setTimeout(() => {
      isLoading.value = false;
      emptyFallbackTimer = null;
    }, 2800);
  });
});

onUnmounted(() => {
  window.removeEventListener(PHONE_CHARACTER_AVATARS_CHANGED, onBrowserAvatarStorageChange);
  if (emptyFallbackTimer) {
    clearTimeout(emptyFallbackTimer);
    emptyFallbackTimer = null;
  }
});

function toDisplayName(name: unknown, fallback: string) {
  const n = String(name ?? '').trim();
  if (!n) return fallback;
  if (n === '未知' || n === '未命名') return fallback;
  return n;
}

function formatAffection(v: number) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '0';
  return String(Math.round(v));
}
</script>

<style scoped>
.character-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
}

.section-header .desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn:not(.cyber-button) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--accent-color, #4f46e5);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.action-btn:not(.cyber-button):hover {
  opacity: 0.9;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
}

.loading-state i,
.empty-state i {
  font-size: 2rem;
  opacity: 0.5;
}

.empty-state .hint {
  font-size: 0.75rem;
  opacity: 0.7;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

/* 浅色中间栏：扁平卡片（深色由 cyber-panels-dark 的 .middle-panel.dark .character-list .character-card 负责） */
:global(.middle-panel.light) .character-card {
  background: var(--card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.middle-panel.light) .character-card:hover {
  background: var(--card-hover-bg, rgba(255, 255, 255, 0.08));
  border-color: var(--accent-color, #4f46e5);
}

.character-card {
  cursor: pointer;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent-color, #4f46e5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.25rem;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar .avatar-face {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.info p {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
}

.stat-row .label {
  color: var(--text-secondary);
}

:global(.middle-panel.light) .character-card .stat-row .value {
  color: var(--accent-color, #4f46e5);
  font-weight: 600;
}
</style>
