<template>
  <div
    class="tm-building-marker tm-building"
    :class="{
      'tm-building--selected': selected,
      'tm-building--edit': isGlobalEditMode,
    }"
    :style="wrapperStyle"
    @pointerdown.stop="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click.stop="onClick"
  >
    <div
      class="tm-building-inner dynamic-building dynamic-border"
      :style="{ borderColor: borderColorResolved }"
    >
      <i :class="displayIconClass" class="tm-building-icon dynamic-accent" aria-hidden="true" />
      <span v-if="building.activities.length > 0" class="tm-building-ping dynamic-accent" aria-hidden="true" />
    </div>
    <div class="tm-building-label dynamic-panel dynamic-border dynamic-text">{{ building.name || '未命名' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Building, BuildingType } from './tacticalMap/types';
import { CELL_SIZE, TYPE_CONFIG } from './tacticalMap/themePresets';
import { ICON_MAP } from './tacticalMap/iconMap';

const props = defineProps<{
  building: Building;
  selected: boolean;
  isGlobalEditMode: boolean;
  scale: number;
  /** 区域左上角格坐标；游离建筑为 0 */
  offsetX: number;
  offsetY: number;
  /** 相对 offset 的约束框（格）；null 表示全图不约束 */
  bounds: { width: number; height: number } | null;
  regionColor?: string;
}>();

const emit = defineEmits<{
  click: [];
  'drag-end': [x: number, y: number];
}>();

const dragPx = ref({ x: 0, y: 0 });
const dragState = ref<{
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
} | null>(null);

const leftPx = computed(() => (props.building.x - props.offsetX) * CELL_SIZE);
const topPx = computed(() => (props.building.y - props.offsetY) * CELL_SIZE);

const borderColorResolved = computed(() => {
  if (props.regionColor) return props.regionColor;
  if (props.selected) return 'var(--building-selected)';
  return 'var(--border-color)';
});

const displayIconClass = computed(() => {
  const key = props.building.icon;
  if (key && ICON_MAP[key]) return ICON_MAP[key];
  return TYPE_CONFIG[props.building.type as BuildingType].iconClass;
});

const wrapperStyle = computed(() => ({
  width: `${props.building.width * CELL_SIZE}px`,
  height: `${props.building.height * CELL_SIZE}px`,
  left: `${leftPx.value}px`,
  top: `${topPx.value}px`,
  transform: `translate(${dragPx.value.x}px, ${dragPx.value.y}px)`,
}));

function clampDrag(dx: number, dy: number) {
  let x = dx;
  let y = dy;
  const b = props.bounds;
  if (b) {
    const left = leftPx.value;
    const top = topPx.value;
    const w = props.building.width * CELL_SIZE;
    const h = props.building.height * CELL_SIZE;
    const maxR = b.width * CELL_SIZE - left - w;
    const maxB = b.height * CELL_SIZE - top - h;
    x = Math.min(maxR, Math.max(-left, x));
    y = Math.min(maxB, Math.max(-top, y));
  }
  return { x, y };
}

function onPointerDown(e: PointerEvent) {
  if (!props.isGlobalEditMode) return;
  dragState.value = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    moved: false,
  };
  dragPx.value = { x: 0, y: 0 };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  const d = dragState.value;
  if (!d || e.pointerId !== d.pointerId) return;
  const dx = (e.clientX - d.startClientX) / props.scale;
  const dy = (e.clientY - d.startClientY) / props.scale;
  if (Math.hypot(dx, dy) > 4) d.moved = true;
  dragPx.value = clampDrag(dx, dy);
}

function onPointerUp(e: PointerEvent) {
  const d = dragState.value;
  if (!d || e.pointerId !== d.pointerId) return;
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    /* noop */
  }
  dragState.value = null;
  if (!props.isGlobalEditMode) return;
  if (d.moved) {
    const nx = Math.round((props.building.x * CELL_SIZE + dragPx.value.x) / CELL_SIZE);
    const ny = Math.round((props.building.y * CELL_SIZE + dragPx.value.y) / CELL_SIZE);
    emit('drag-end', nx, ny);
  }
  dragPx.value = { x: 0, y: 0 };
}

function onClick() {
  emit('click');
}
</script>

<style scoped>
.tm-building-marker {
  position: absolute;
  z-index: 2;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tm-building--edit {
  cursor: move;
}

.tm-building:not(.tm-building--edit) {
  cursor: pointer;
}

.tm-building-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 0.5rem;
  border-width: 2px;
  border-style: solid;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.tm-building--selected .tm-building-inner {
  border-color: var(--building-selected);
  box-shadow: 0 0 16px var(--building-selected);
}

.tm-building-icon {
  font-size: 1.75rem;
  opacity: 0.85;
}

.tm-building-ping {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentcolor;
  animation: tm-pulse 1.2s ease-in-out infinite;
}

@keyframes tm-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.tm-building-label {
  position: absolute;
  bottom: -1.85rem;
  padding: 0.2rem 0.45rem;
  font-size: 0.975rem;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
  pointer-events: none;
}
</style>
