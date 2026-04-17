<template>
  <div
    v-show="visible"
    class="tm-region-ind"
    :style="{
      left: `${ix}px`,
      top: `${iy}px`,
      transform: 'translate(-50%, -50%)',
      opacity: visible ? 1 : 0,
    }"
  >
    <div class="tm-region-ind-label">{{ region.name }}</div>
    <div class="tm-region-ind-arrow dynamic-accent" :style="{ transform: `rotate(${rotation}deg)` }" />
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Region } from './types';
import { CELL_SIZE } from './themePresets';

const MAP_HALF = 2000;

const props = defineProps<{
  region: Region;
  panX: number;
  panY: number;
  scale: number;
  /** 地图视口 DOM（与 pan/scale 同一坐标系），箭头仅在此区域内定位 */
  viewportEl: HTMLElement | null;
}>();

const visible = ref(false);
const ix = ref(0);
const iy = ref(0);
const rotation = ref(0);

function update() {
  const el = props.viewportEl;
  if (!el) {
    visible.value = false;
    return;
  }

  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w < 48 || h < 48) {
    visible.value = false;
    return;
  }

  const regionCenterX = (props.region.x + props.region.width / 2) * CELL_SIZE;
  const regionCenterY = (props.region.y + props.region.height / 2) * CELL_SIZE;

  /** 区域中心在视口本地坐标中的位置（与 .tm-map-surface 的 transform 一致） */
  const localCx = w / 2 + props.panX + (regionCenterX - MAP_HALF) * props.scale;
  const localCy = h / 2 + props.panY + (regionCenterY - MAP_HALF) * props.scale;

  const margin = 36;

  if (localCx >= margin && localCx <= w - margin && localCy >= margin && localCy <= h - margin) {
    visible.value = false;
    return;
  }

  visible.value = true;

  const scx = w / 2;
  const scy = h / 2;

  const dx = localCx - scx;
  const dy = localCy - scy;

  rotation.value = (Math.atan2(dy, dx) * 180) / Math.PI;

  let px = localCx;
  let py = localCy;

  if (Math.abs(dx) > 0.001) {
    const slope = dy / dx;
    if (dx > 0) {
      px = w - margin;
      py = scy + (px - scx) * slope;
    } else {
      px = margin;
      py = scy + (px - scx) * slope;
    }

    if (py < margin || py > h - margin) {
      if (dy > 0) {
        py = h - margin;
        px = scx + (py - scy) / slope;
      } else {
        py = margin;
        px = scx + (py - scy) / slope;
      }
    }
  } else {
    px = scx;
    py = dy > 0 ? h - margin : margin;
  }

  px = Math.max(margin, Math.min(w - margin, px));
  py = Math.max(margin, Math.min(h - margin, py));

  ix.value = px;
  iy.value = py;
}

let raf = 0;
function schedule() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(update);
}

const viewportTarget = computed(() => props.viewportEl ?? null);
useResizeObserver(viewportTarget, () => schedule());

watch(
  () => [props.panX, props.panY, props.scale, props.region.x, props.region.y, props.region.width, props.region.height, props.viewportEl],
  () => schedule(),
  { deep: true },
);

onMounted(() => {
  schedule();
  window.addEventListener('resize', schedule);
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', schedule);
});
</script>

<style scoped>
.tm-region-ind {
  position: absolute;
  z-index: 18;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tm-region-ind-label {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 10px;
  padding: 0.2rem 0.45rem;
  border-radius: 0.25rem;
  white-space: nowrap;
  margin-bottom: 0.2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tm-region-ind-arrow {
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 10px solid currentcolor;
}
</style>
