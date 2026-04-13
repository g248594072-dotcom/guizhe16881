<template>
  <div class="tm-modal-overlay" @click.self="$emit('close')">
    <div class="tm-modal tm-modal--solid-bg tm-modal--vivid-controls dynamic-panel dynamic-border" role="dialog">
      <div class="tm-modal-head dynamic-border">
        <h2 class="dynamic-text tm-head-title">
          <i class="fa-solid fa-wand-magic-sparkles dynamic-accent" aria-hidden="true"></i>
          随机创建活动
        </h2>
        <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="$emit('close')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="tm-modal-body">
        <label class="tm-label dynamic-text-muted">选择目标区域</label>
        <select v-model="selectedRegionId" class="tm-input dynamic-input dynamic-border dynamic-text">
          <option value="all">所有区域</option>
          <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <p class="hint dynamic-text-muted">
          AI 将根据所选区域内建筑的用途和人员，自动生成符合逻辑的事件或活动。（当前为占位，不调用外部模型）
        </p>
      </div>
      <div class="tm-modal-foot dynamic-border">
        <button type="button" class="tm-btn dynamic-text" @click="$emit('close')">取消</button>
        <button type="button" class="tm-btn tm-btn-primary" :disabled="busy" @click="onStubGenerate">
          <i v-if="busy" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <i v-else class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          {{ busy ? '生成中…' : '开始生成' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Region } from './types';

defineProps<{
  regions: Region[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const selectedRegionId = ref('all');
const busy = ref(false);

function onStubGenerate() {
  busy.value = true;
  setTimeout(() => {
    busy.value = false;
    toastr.info('AI 批量创建活动功能待接入');
    emit('close');
  }, 400);
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.tm-btn-primary {
  border-color: transparent;
  background: var(--accent-color);
  color: var(--bg-color, #020617);
  font-weight: 600;
}

.tm-btn-primary:disabled {
  opacity: 0.55;
  cursor: wait;
}
</style>
