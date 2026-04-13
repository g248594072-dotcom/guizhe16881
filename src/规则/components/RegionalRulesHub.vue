<template>
  <section
    id="panel-regional-rules-hub"
    class="regional-rules-hub"
    :class="{ dark: isDarkMode, light: !isDarkMode, 'regional-rules-hub--map': subTab === 'map' }"
  >
    <div class="hub-subtabs" role="tablist" aria-label="区域规则子面板">
      <button
        type="button"
        role="tab"
        :aria-selected="subTab === 'rules'"
        class="hub-subtab"
        :class="{ active: subTab === 'rules' }"
        @click="subTab = 'rules'"
      >
        <i class="fa-solid fa-list" aria-hidden="true"></i>
        <span>规则</span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="subTab === 'map'"
        class="hub-subtab"
        :class="{ active: subTab === 'map' }"
        @click="subTab = 'map'"
      >
        <i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>
        <span>地图</span>
      </button>
    </div>

    <div class="hub-body">
      <RegionalRulesPanel
        v-show="subTab === 'rules'"
        :is-dark-mode="isDarkMode"
        @open-modal="onOpenModal"
      />
      <TacticalMapPanel v-show="subTab === 'map'" :is-dark-mode="isDarkMode" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import RegionalRulesPanel from './RegionalRulesPanel.vue';
import TacticalMapPanel from './TacticalMapPanel.vue';

defineProps<{ isDarkMode: boolean }>();

const emit = defineEmits<{
  openModal: [type: string, payload?: Record<string, unknown>];
  subTabChange: [tab: 'rules' | 'map'];
}>();

function onOpenModal(type: string, payload?: Record<string, unknown>) {
  emit('openModal', type, payload);
}

const subTab = ref<'rules' | 'map'>('rules');

watch(
  subTab,
  v => {
    emit('subTabChange', v);
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.regional-rules-hub {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.hub-subtabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0 0.75rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  flex-shrink: 0;
}

.regional-rules-hub.dark .hub-subtabs {
  border-bottom-color: rgba(45, 212, 191, 0.2);
}

.hub-subtab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  cursor: pointer;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  transition:
    background 0.15s,
    opacity 0.15s,
    border-color 0.15s;

  &:hover {
    opacity: 1;
  }

  &.active {
    opacity: 1;
    border-color: rgba(45, 212, 191, 0.45);
    background: rgba(45, 212, 191, 0.08);
  }
}

.regional-rules-hub.light .hub-subtab.active {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.06);
}

.hub-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: 0.5rem;
}

.hub-body > :deep(*) {
  flex: 1;
  min-height: 0;
}

.regional-rules-hub--map .hub-subtabs {
  padding-bottom: 0.4rem;
}

.regional-rules-hub--map .hub-body {
  padding-top: 0.25rem;
}
</style>
