<template>
  <div class="tm-modal-overlay" @click.self="$emit('close')">
    <div class="tm-modal tm-modal--solid-bg tm-modal--vivid-controls dynamic-panel dynamic-border" role="dialog">
      <div class="tm-modal-head dynamic-border">
        <h2 class="dynamic-text">自定义新世界</h2>
        <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="$emit('close')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="tm-modal-body">
        <label class="tm-label dynamic-text-muted" for="tm-new-world-name">世界名称</label>
        <input
          id="tm-new-world-name"
          v-model="name"
          type="text"
          class="tm-input tm-native-control dynamic-input dynamic-border dynamic-text"
          placeholder="例如：废土新城"
        />
        <label class="tm-label dynamic-text-muted" for="tm-new-world-details">世界详情</label>
        <textarea
          id="tm-new-world-details"
          v-model="details"
          rows="3"
          class="tm-input tm-textarea tm-native-control dynamic-input dynamic-border dynamic-text"
          placeholder="例如：多势力共存的移动空港、资源与航线规则……"
        />
        <label class="tm-label dynamic-text-muted" for="tm-new-world-style">机场风格</label>
        <select id="tm-new-world-style" v-model="theme" class="tm-input tm-native-control dynamic-input dynamic-border dynamic-text">
          <option v-for="(t, key) in THEMES" :key="key" :value="key">{{ t.name }}</option>
        </select>
      </div>
      <div class="tm-modal-foot dynamic-border">
        <button type="button" class="tm-btn dynamic-text" @click="$emit('close')">取消</button>
        <button type="button" class="tm-btn tm-btn-primary" :disabled="!name.trim()" @click="submit">创建</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { MapStyle } from './types';
import { THEMES } from './themePresets';

const emit = defineEmits<{
  close: [];
  create: [name: string, theme: MapStyle, details: string];
}>();

const name = ref('');
const details = ref('');
const theme = ref<MapStyle>('modern');

function submit() {
  if (!name.value.trim()) return;
  emit('create', name.value.trim(), theme.value, details.value.trim());
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
  max-width: 22rem;
  border-radius: 0.75rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  font-size: 1.1rem;
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

.tm-textarea {
  resize: vertical;
  min-height: 4rem;
  line-height: 1.45;
}

.tm-native-control {
  color-scheme: dark light;
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
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
