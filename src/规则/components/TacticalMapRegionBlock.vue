<template>
  <div
    ref="rootRef"
    class="tm-region-block"
    :class="{ 'tm-region-block--edit': isGlobalEditMode, 'tm-region-block--zoomed': showBuildings }"
    :style="regionBoxStyle"
    @pointerdown="onRegionPointerDown"
    @pointermove="onRegionPointerMove"
    @pointerup="onRegionPointerUp"
    @pointercancel="onRegionPointerUp"
  >
    <div
      class="tm-region-block-header dynamic-panel dynamic-border"
      :class="{ dashed: showBuildings }"
      @pointerdown.stop
      @click.stop="onHeaderClick"
    >
      <h3 class="tm-region-block-title dynamic-text" :class="{ large: !showBuildings }">
        <i :class="regionIconClass" class="dynamic-accent" aria-hidden="true" />
        {{ region.name }}
        <i v-if="isGlobalEditMode" class="fa-solid fa-pen-to-square text-xs opacity-50" aria-hidden="true" />
      </h3>
      <p v-if="showBuildings" class="tm-region-block-desc dynamic-text-muted">{{ region.description }}</p>
    </div>

    <div v-if="!showBuildings" class="tm-region-block-body">
      <p class="tm-region-block-big-desc dynamic-text-muted">{{ region.description }}</p>
    </div>

    <template v-if="showBuildings">
      <TacticalMapBuildingMarker
        v-for="b in regionBuildings"
        :key="b.id"
        :building="b"
        :selected="selectedId === b.id"
        :is-global-edit-mode="isGlobalEditMode"
        :scale="scale"
        :offset-x="region.x"
        :offset-y="region.y"
        :bounds="{ width: region.width, height: region.height }"
        :region-color="accentColor"
        @click="emit('select-building', b)"
        @drag-end="(nx, ny) => emit('building-drag-end', b.id, nx, ny)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Building, Region } from './tacticalMap/types';
import { CELL_SIZE } from './tacticalMap/themePresets';
import { ICON_MAP } from './tacticalMap/iconMap';
import TacticalMapBuildingMarker from './TacticalMapBuildingMarker.vue';

const props = withDefaults(
  defineProps<{
    region: Region;
    regionBuildings: Building[];
    showBuildings: boolean;
    isGlobalEditMode: boolean;
    /** 为 true 时：区域内点空地不再新建建筑（正在编辑侧栏或未保存的新建模块时） */
    blockEmptyPlaceBuilding?: boolean;
    scale: number;
    selectedId: string | null;
  }>(),
  { blockEmptyPlaceBuilding: false },
);

const emit = defineEmits<{
  edit: [];
  'drag-end': [dx: number, dy: number];
  'add-building-at': [gx: number, gy: number];
  'select-building': [b: Building];
  'building-drag-end': [id: string, x: number, y: number];
}>();

const rootRef = ref<HTMLElement | null>(null);

const color = computed(() => props.region.color || '');
const borderColor = computed(() => color.value || 'var(--border-color)');
const accentColor = computed(() => color.value || 'var(--accent-color)');
const bgColor = computed(() => (color.value ? `${color.value}33` : 'var(--grid-color)'));

const regionIconClass = computed(() => {
  const k = props.region.icon;
  if (k && ICON_MAP[k]) return ICON_MAP[k];
  return 'fa-solid fa-map';
});

const regionBoxStyle = computed(() => ({
  left: `${props.region.x * CELL_SIZE + regionDragPx.value.x}px`,
  top: `${props.region.y * CELL_SIZE + regionDragPx.value.y}px`,
  width: `${props.region.width * CELL_SIZE}px`,
  height: `${props.region.height * CELL_SIZE}px`,
  borderColor: borderColor.value,
  backgroundColor: props.showBuildings ? bgColor.value : 'var(--panel-bg)',
  opacity: props.showBuildings ? 1 : 0.8,
  borderStyle: props.showBuildings ? 'dashed' : 'solid',
  borderWidth: props.showBuildings ? '2px' : '4px',
}));

const regionDragPx = ref({ x: 0, y: 0 });
const regionDrag = ref<{
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
} | null>(null);

function onHeaderClick() {
  if (props.isGlobalEditMode) emit('edit');
}

function onRegionPointerDown(e: PointerEvent) {
  if (!props.isGlobalEditMode) return;
  if ((e.target as HTMLElement).closest('.tm-building-marker')) return;
  regionDrag.value = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    moved: false,
  };
  regionDragPx.value = { x: 0, y: 0 };
  rootRef.value?.setPointerCapture(e.pointerId);
}

function onRegionPointerMove(e: PointerEvent) {
  const d = regionDrag.value;
  if (!d || e.pointerId !== d.pointerId) return;
  const dx = (e.clientX - d.startClientX) / props.scale;
  const dy = (e.clientY - d.startClientY) / props.scale;
  if (Math.hypot(dx, dy) > 4) d.moved = true;
  regionDragPx.value = { x: dx, y: dy };
}

function onRegionPointerUp(e: PointerEvent) {
  const d = regionDrag.value;
  if (!d || e.pointerId !== d.pointerId) return;
  try {
    rootRef.value?.releasePointerCapture(e.pointerId);
  } catch {
    /* noop */
  }
  regionDrag.value = null;
  if (!props.isGlobalEditMode) return;

  if (d.moved) {
    const gridDx = Math.round(regionDragPx.value.x / CELL_SIZE);
    const gridDy = Math.round(regionDragPx.value.y / CELL_SIZE);
    regionDragPx.value = { x: 0, y: 0 };
    if (gridDx !== 0 || gridDy !== 0) emit('drag-end', gridDx, gridDy);
    return;
  }

  regionDragPx.value = { x: 0, y: 0 };

  if (props.blockEmptyPlaceBuilding) return;

  if (!props.showBuildings || !rootRef.value) return;
  const rect = rootRef.value.getBoundingClientRect();
  const localX = Math.floor((e.clientX - rect.left) / props.scale / CELL_SIZE);
  const localY = Math.floor((e.clientY - rect.top) / props.scale / CELL_SIZE);
  if (localX >= 0 && localX < props.region.width && localY >= 0 && localY < props.region.height) {
    emit('add-building-at', props.region.x + localX, props.region.y + localY);
  }
}
</script>

<style scoped>
.tm-region-block {
  position: absolute;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.35s;
  z-index: 1;
}

.tm-region-block:not(.tm-region-block--edit) {
  pointer-events: none;
}

.tm-region-block--edit {
  pointer-events: auto;
  cursor: move;
}

.tm-region-block-header {
  pointer-events: auto;
  padding: 0.4rem 0.75rem;
  width: fit-content;
  border-radius: 0 0 0.75rem 0;
  border-bottom-width: 1px;
}

.tm-region-block-header.dashed {
  border-style: dashed;
}

.tm-region-block-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.875rem;
}

.tm-region-block-title.large {
  font-size: 1.35rem;
}

.tm-region-block-desc {
  font-size: 0.7rem;
  margin-top: 0.15rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-region-block-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  pointer-events: none;
}

.tm-region-block-big-desc {
  text-align: center;
  max-width: 28rem;
  line-height: 1.6;
  font-size: 1.1rem;
  opacity: 0.75;
}
</style>
