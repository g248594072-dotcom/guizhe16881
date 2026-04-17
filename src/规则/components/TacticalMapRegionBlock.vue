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
    <!-- 放大：框外左上角小卡片（名称 + 简介），为建筑腾出框内空间 -->
    <div
      v-if="showBuildings"
      class="tm-region-outside-card dynamic-panel dynamic-border"
      :style="{ borderColor: borderColor }"
      @pointerdown.stop
    >
      <div
        class="tm-region-outside-card-name dynamic-text"
        @click.stop="onHeaderClick"
      >
        <i :class="regionIconClass" class="dynamic-accent" aria-hidden="true" />
        <span>{{ region.name }}</span>
        <i v-if="isGlobalEditMode" class="fa-solid fa-pen-to-square text-[0.65rem] opacity-60" aria-hidden="true" />
      </div>
      <p
        v-if="descriptionTrimmed"
        class="tm-region-outside-card-desc dynamic-text-muted"
        :title="descriptionTrimmed"
      >
        {{ descriptionTrimmed }}
      </p>
    </div>

    <!-- 缩小：框内居中名称 + 简介 -->
    <div v-if="!showBuildings" class="tm-region-center-stack">
      <div
        class="tm-region-center-name dynamic-text"
        @pointerdown.stop
        @click.stop="onHeaderClick"
      >
        <i :class="regionIconClass" class="dynamic-accent" aria-hidden="true" />
        <span>{{ region.name }}</span>
        <i v-if="isGlobalEditMode" class="fa-solid fa-pen-to-square text-xs opacity-50" aria-hidden="true" />
      </div>
      <p v-if="descriptionTrimmed" class="tm-region-center-desc dynamic-text-muted">
        {{ descriptionTrimmed }}
      </p>
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

const descriptionTrimmed = computed(() => (props.region.description ?? '').trim());

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
  if (!props.isGlobalEditMode) return;
  emit('edit');
}

function onRegionPointerDown(e: PointerEvent) {
  if (!props.isGlobalEditMode) return;
  if ((e.target as HTMLElement).closest('.tm-building-marker')) return;
  if ((e.target as HTMLElement).closest('.tm-region-outside-card')) return;
  if ((e.target as HTMLElement).closest('.tm-region-center-name')) return;
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
  overflow: visible;
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

/* 放大：贴在区域框左上角外侧（名称/简介不占框内） */
.tm-region-outside-card {
  position: absolute;
  left: 0;
  bottom: 100%;
  margin-bottom: 0.35rem;
  z-index: 3;
  max-width: min(22rem, calc(100vw - 2rem));
  padding: 0.42rem 0.55rem 0.48rem;
  border-radius: 0.45rem;
  text-align: left;
  pointer-events: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
}

.tm-region-outside-card-name {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.92rem;
  line-height: 1.35;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.tm-region-outside-card-name > i:first-of-type {
  flex-shrink: 0;
  margin-top: 0.12em;
}

.tm-region-block:not(.tm-region-block--edit) .tm-region-outside-card-name {
  cursor: default;
}

.tm-region-block--edit .tm-region-outside-card-name {
  cursor: pointer;
}

.tm-region-outside-card-desc {
  margin: 0.32rem 0 0;
  font-size: 0.84rem;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

/* 缩小：框内垂直居中 */
.tm-region-center-stack {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 0.75rem;
  text-align: center;
  pointer-events: none;
}

.tm-region-center-name {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-weight: 700;
  font-size: clamp(1.25rem, 4.8vw, 2rem);
  line-height: 1.3;
  max-width: 96%;
  pointer-events: auto;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.65);
}

.tm-region-block:not(.tm-region-block--edit) .tm-region-center-name {
  cursor: default;
}

.tm-region-block--edit .tm-region-center-name {
  cursor: pointer;
}

.tm-region-center-desc {
  margin: 0.6rem 0 0;
  max-width: 96%;
  max-height: 58%;
  overflow-y: auto;
  font-size: clamp(1.02rem, 3.2vw, 1.45rem);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  pointer-events: none;
}
</style>
