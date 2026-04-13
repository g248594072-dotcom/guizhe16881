<template>
  <div class="tm-modal-overlay" @click.self="$emit('cancel')">
    <div class="tm-modal tm-modal--solid-bg tm-modal--vivid-controls dynamic-panel dynamic-border" role="dialog">
      <div class="tm-modal-head dynamic-border">
        <h2 class="dynamic-text">未保存的建筑</h2>
        <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="$emit('cancel')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="tm-modal-body">
        <p class="dynamic-text small">
          您有一个新建的建筑尚未保存。如果退出，该建筑将会丢失。是否保存？
        </p>
        <p v-if="!canSave" class="warn">请先在编辑面板中填写建筑名称和描述才能保存。</p>
      </div>
      <div class="tm-modal-foot dynamic-border">
        <button type="button" class="tm-btn dynamic-text" @click="$emit('cancel')">取消</button>
        <button type="button" class="tm-btn tm-btn-danger" @click="$emit('discard')">放弃更改</button>
        <button type="button" class="tm-btn tm-btn-primary" :disabled="!canSave" @click="$emit('save')">保存建筑</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Building } from './types';

const props = defineProps<{ building: Building }>();

defineEmits<{
  save: [];
  discard: [];
  cancel: [];
}>();

const canSave = computed(
  () => props.building.name.trim() !== '' && props.building.description.trim() !== '',
);
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
  z-index: 55;
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
  max-width: 22rem;
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

.tm-modal-head h2 {
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
}

.small {
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
}

.warn {
  font-size: 0.75rem;
  color: #ef4444;
  margin: 0.5rem 0 0;
}

.tm-modal-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-top-width: 1px;
}

.tm-btn {
  padding: 0.45rem 0.75rem;
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
  opacity: 0.45;
  cursor: not-allowed;
}

.tm-btn-danger {
  border-color: transparent;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}
</style>
