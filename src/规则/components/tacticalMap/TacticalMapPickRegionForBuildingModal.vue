<template>
  <div class="tm-modal-overlay" @click.self="$emit('close')">
    <div class="tm-modal tm-modal--solid-bg tm-modal--vivid-controls dynamic-panel dynamic-border" role="dialog">
      <div class="tm-modal-head dynamic-border">
        <h2 class="dynamic-text tm-head-title">选择要建造模块的区域</h2>
        <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="$emit('close')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="tm-modal-body">
        <label class="tm-label dynamic-text-muted" for="tm-pick-region-building">目标区域</label>
        <select id="tm-pick-region-building" v-model="selectedId" class="tm-input dynamic-input dynamic-border dynamic-text">
          <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <p class="hint dynamic-text-muted">确认后会在该区域内随机格点放置新模块，并将视图对准该区域。</p>
      </div>
      <div class="tm-modal-foot dynamic-border">
        <button type="button" class="tm-btn dynamic-text" @click="$emit('close')">取消</button>
        <button type="button" class="tm-btn tm-btn-primary" :disabled="!selectedId" @click="confirm">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Region } from './types';

const props = defineProps<{
  regions: Region[];
}>();

const emit = defineEmits<{
  close: [];
  confirm: [regionId: string];
}>();

const selectedId = ref(props.regions[0]?.id ?? '');

watch(
  () => props.regions,
  list => {
    if (!list.length) {
      selectedId.value = '';
      return;
    }
    if (!list.some(r => r.id === selectedId.value)) {
      selectedId.value = list[0]!.id;
    }
  },
  { deep: true },
);

function confirm() {
  if (!selectedId.value) return;
  emit('confirm', selectedId.value);
}
</script>

<style scoped lang="scss">
@use './tm-modal-solid.scss' as tmModalSolid;
@use './tm-modal-vivid.scss' as tmModalVivid;

.tm-modal--vivid-controls {
  @include tmModalVivid.tm-modal-vivid-controls;
}

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
  color-scheme: dark light;
}

.tm-modal {
  width: 100%;
  max-width: 26rem;
  border-radius: 0.75rem;
  overflow: hidden;
}

.tm-modal--solid-bg {
  @include tmModalSolid.tm-modal-solid-surface;
}

.tm-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom-width: 1px;
}

.tm-head-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.tm-close {
  border: none;
  background: transparent;
  cursor: pointer;
}

.tm-modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tm-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.tm-input {
  width: 100%;
  border-radius: 0.375rem;
  padding: 0.5rem 0.6rem;
  font-size: 0.8125rem;
  outline: none;
}

.hint {
  font-size: 0.7rem;
  line-height: 1.45;
  margin: 0.25rem 0 0;
}

.tm-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-top-width: 1px;
}

.tm-btn {
  padding: 0.45rem 0.85rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  font-size: 0.8125rem;
}

.tm-btn-primary {
  border-color: transparent;
  background: var(--accent-color);
  color: var(--bg-color, #020617);
  font-weight: 600;
}

.tm-btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
