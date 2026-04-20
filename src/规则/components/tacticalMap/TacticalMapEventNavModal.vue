<template>
  <div class="tm-modal-overlay" @click.self="$emit('close')">
    <div class="tm-modal tm-modal--xl tm-event-nav-modal dynamic-panel dynamic-border" role="dialog">
      <div class="tm-modal-head dynamic-border">
        <h2 class="dynamic-text tm-head-title">
          <i class="fa-solid fa-calendar-days dynamic-accent" aria-hidden="true"></i>
          活动导航
        </h2>
        <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="$emit('close')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="tm-modal-body tm-scroll">
        <template v-for="region in regions" :key="region.id">
          <div v-if="buildingsForRegion(region).length" class="tm-region-section">
            <h3 class="tm-region-title dynamic-text dynamic-border">
              <i class="fa-solid fa-map dynamic-accent" aria-hidden="true"></i>
              {{ region.name }}
            </h3>
            <div class="tm-card-grid">
              <div
                v-for="building in buildingsForRegion(region)"
                :key="building.id"
                class="tm-building-card dynamic-border"
                @click="$emit('navigate', building, region)"
              >
                <div class="tm-card-head">
                  <h4 class="dynamic-text">{{ building.name }}</h4>
                  <span class="tm-chip dynamic-text-muted">
                    预计参与:
                    {{ building.people.length ? building.people.map(p => p.name).join(', ') : '无特定人员' }}
                  </span>
                </div>
                <div class="tm-act-list">
                  <div v-for="act in building.activities" :key="act.id" class="tm-act-box">
                    <div class="tm-act-line">
                      <span class="dynamic-text">{{ act.name }}</span>
                      <span class="dynamic-accent mono small">{{ act.progress }}%</span>
                    </div>
                    <div class="tm-bar dynamic-border">
                      <div class="tm-bar-fill dynamic-accent" :style="{ width: `${act.progress}%` }" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <div v-if="!hasAnyActivities" class="tm-empty dynamic-text-muted">
          <p>当前没有任何活动。您可以在上方点击「AI 创建活动」来生成。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Building, Region } from './types';

const props = defineProps<{
  regions: Region[];
  buildings: Building[];
}>();

defineEmits<{
  close: [];
  navigate: [building: Building, region: Region];
}>();

function buildingsForRegion(region: Region) {
  return props.buildings.filter(
    b =>
      b.x >= region.x &&
      b.x <= region.x + region.width &&
      b.y >= region.y &&
      b.y <= region.y + region.height &&
      b.activities.length > 0,
  );
}

const hasAnyActivities = computed(() => props.buildings.some(b => b.activities.length > 0));
</script>

<style scoped lang="scss">
.tm-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  padding: 1rem;
}

.tm-modal--xl {
  width: 100%;
  max-width: 42rem;
  max-height: 80vh;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Teleport 到 body 时父级主题变量可能不可用，使用 var 回退；底色加实，避免透出背后地图 */
.tm-event-nav-modal {
  background-color: color-mix(in srgb, var(--panel-bg, rgba(15, 23, 42, 0.98)) 94%, var(--bg-color, #020617));
  background-image:
    radial-gradient(ellipse 120% 80% at 50% 0%, var(--accent-color, #2dd4bf) 0%, transparent 55%),
    linear-gradient(
      to right,
      color-mix(in srgb, var(--grid-color, rgba(45, 212, 191, 0.12)) 100%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--grid-color, rgba(45, 212, 191, 0.12)) 100%, transparent) 1px,
      transparent 1px
    );
  background-size: auto, 20px 20px, 20px 20px;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent-color, #2dd4bf) 18%, transparent),
    0 24px 48px rgba(0, 0, 0, 0.45);
}

.tm-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom-width: 1px;
  flex-shrink: 0;
}

.tm-head-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tm-close {
  border: none;
  background: transparent;
  cursor: pointer;
}

.tm-scroll {
  overflow-y: auto;
  padding: 1.25rem;
  flex: 1;
  min-height: 0;
  background-color: color-mix(in srgb, var(--input-bg, rgba(2, 6, 23, 0.78)) 90%, var(--bg-color, #020617));
  background-image: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.1) 100%);
}

.tm-region-section {
  margin-bottom: 2rem;
}

.tm-region-title {
  font-size: 0.95rem;
  font-weight: 700;
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
  border-bottom-width: 1px;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.tm-card-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tm-building-card {
  border-radius: 0.5rem;
  border-width: 1px;
  padding: 0.85rem;
  cursor: pointer;
  background: var(--building-bg, rgba(15, 23, 42, 0.72));
}

.tm-building-card:hover {
  background: color-mix(in srgb, var(--accent-color, #2dd4bf) 8%, var(--building-bg, rgba(15, 23, 42, 0.85)));
}

.tm-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  margin-bottom: 0.65rem;
}

.tm-card-head h4 {
  margin: 0;
  font-size: 0.875rem;
}

.tm-chip {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.06);
}

.tm-act-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tm-act-box {
  background: color-mix(in srgb, var(--panel-bg, #0f172a) 70%, rgba(0, 0, 0, 0.35));
  border-radius: 0.35rem;
  padding: 0.45rem 0.5rem;
}

.tm-act-line {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.tm-bar {
  height: 0.25rem;
  border-radius: 999px;
  overflow: hidden;
  border-width: 1px;
}

.tm-bar-fill {
  height: 100%;
  background: var(--accent-color);
}

.tm-empty {
  text-align: center;
  padding: 2.5rem 1rem;
  font-size: 0.875rem;
}

.small {
  font-size: 0.7rem;
}

.mono {
  font-family: ui-monospace, monospace;
}
</style>
