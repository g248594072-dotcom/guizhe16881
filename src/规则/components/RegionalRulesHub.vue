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
        @click="onSubTabRequest('rules')"
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
        @click="onSubTabRequest('map')"
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
      <TacticalMapPanel v-show="subTab === 'map'" ref="tacticalMapPanelRef" :is-dark-mode="isDarkMode" />
    </div>

    <Teleport to="body">
      <div
        v-if="mapLeaveGuardOpen"
        class="rr-map-leave-overlay"
        role="presentation"
        @click.self="closeMapLeaveGuard"
      >
        <div class="rr-map-leave-dialog dynamic-panel dynamic-border" role="dialog" aria-labelledby="rr-map-leave-title">
          <h2 id="rr-map-leave-title" class="rr-map-leave-title dynamic-text">地图有未提交的修改</h2>
          <p class="rr-map-leave-desc dynamic-text-muted">
            切换离开「地图」前请先确认：将修改写入变量并追加 JSON Patch 到酒馆发送框，或放弃修改还原到上次确认状态。
          </p>
          <div class="rr-map-leave-actions">
            <button type="button" class="rr-map-leave-btn rr-map-leave-btn--ghost dynamic-border dynamic-text" @click="closeMapLeaveGuard">
              留在地图
            </button>
            <button type="button" class="rr-map-leave-btn dynamic-border dynamic-text" @click="onMapLeaveDiscard">
              放弃修改并切换
            </button>
            <button type="button" class="rr-map-leave-btn rr-map-leave-btn--primary" @click="onMapLeaveApply">
              确认应用并切换
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
const tacticalMapPanelRef = ref<InstanceType<typeof TacticalMapPanel> | null>(null);
const mapLeaveGuardOpen = ref(false);

function closeMapLeaveGuard() {
  mapLeaveGuardOpen.value = false;
}

function onSubTabRequest(next: 'rules' | 'map') {
  if (next === 'map') {
    subTab.value = 'map';
    return;
  }
  if (subTab.value === 'map' && tacticalMapPanelRef.value?.checkMapDraftDirty?.()) {
    mapLeaveGuardOpen.value = true;
    return;
  }
  subTab.value = next;
}

function onMapLeaveDiscard() {
  tacticalMapPanelRef.value?.discardMapDraft();
  subTab.value = 'rules';
  closeMapLeaveGuard();
}

function onMapLeaveApply() {
  const ok = tacticalMapPanelRef.value?.confirmMapDraft() ?? false;
  if (!ok) return;
  subTab.value = 'rules';
  closeMapLeaveGuard();
}

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

.rr-map-leave-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(2, 6, 23, 0.55);
}

.rr-map-leave-dialog {
  width: min(26rem, 100%);
  padding: 1rem 1.1rem;
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.96);
  color: #e2e8f0;
}

.rr-map-leave-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 700;
}

.rr-map-leave-desc {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.rr-map-leave-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}

.rr-map-leave-btn {
  padding: 0.4rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 0.35rem;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.9);
  color: #e2e8f0;
}

.rr-map-leave-btn--ghost {
  background: transparent;
}

.rr-map-leave-btn--primary {
  border: 1px solid transparent;
  background: #0d9488;
  color: #f0fdfa;
}

.rr-map-leave-btn--primary:hover {
  filter: brightness(1.06);
}
</style>
