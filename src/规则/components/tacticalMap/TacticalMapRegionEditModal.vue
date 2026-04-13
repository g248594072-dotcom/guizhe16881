<template>
  <div class="tm-modal-overlay" @click.self="$emit('close')">
    <div
      class="tm-modal tm-modal--wide tm-modal--solid-bg tm-modal--vivid-controls dynamic-panel dynamic-border"
      role="dialog"
      aria-labelledby="tm-region-edit-title"
    >
      <div class="tm-modal-head dynamic-border">
        <h2 id="tm-region-edit-title" class="dynamic-text">编辑区域</h2>
        <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="$emit('close')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="tm-modal-body tm-modal-body--scroll">
        <label class="tm-label dynamic-text-muted">区域名称</label>
        <input v-model="name" type="text" class="tm-input dynamic-input dynamic-border dynamic-text" />
        <label class="tm-label dynamic-text-muted">区域描述</label>
        <textarea
          v-model="description"
          rows="9"
          class="tm-input tm-textarea-region-desc dynamic-input dynamic-border dynamic-text"
        />
        <label class="tm-label dynamic-text-muted">区域颜色</label>
        <div class="tm-color-row">
          <button
            v-for="c in REGION_COLORS"
            :key="c.name"
            type="button"
            class="tm-color-dot"
            :class="{ 'tm-color-dot--on': color === c.value }"
            :style="{ backgroundColor: c.value || 'var(--grid-color)' }"
            :title="c.name"
            @click="color = c.value"
          />
        </div>
        <label class="tm-label dynamic-text-muted">区域图标</label>
        <div class="tm-icon-grid">
          <button
            v-for="key in ICON_KEYS"
            :key="key"
            type="button"
            class="tm-icon-pick dynamic-border dynamic-text"
            :class="{ 'tm-icon-pick--on': icon === key }"
            :title="key"
            @click="icon = key"
          >
            <i :class="ICON_MAP[key]" class="text-lg" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div class="tm-modal-foot dynamic-border tm-modal-foot--split">
        <button type="button" class="tm-btn-del-text" @click="$emit('delete')">删除区域</button>
        <div class="tm-modal-foot-right">
          <button type="button" class="tm-btn dynamic-text" @click="$emit('close')">取消</button>
          <button type="button" class="tm-btn tm-btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Region } from './types';
import { REGION_COLORS } from './themePresets';
import { ICON_KEYS, ICON_MAP } from './iconMap';

const props = defineProps<{ region: Region }>();

const emit = defineEmits<{
  close: [];
  update: [updates: Partial<Region>];
  delete: [];
}>();

const name = ref(props.region.name);
const description = ref(props.region.description);
const icon = ref(props.region.icon || 'MapPin');
const color = ref(props.region.color || '');

watch(
  () => props.region,
  r => {
    name.value = r.name;
    description.value = r.description;
    icon.value = r.icon || 'MapPin';
    color.value = r.color || '';
  },
);

function save() {
  emit('update', {
    name: name.value,
    description: description.value,
    icon: icon.value,
    color: color.value,
    isNew: false,
  });
  emit('close');
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
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  padding: 1rem;
  color-scheme: dark light;
}

.tm-modal {
  width: 100%;
  max-width: 28rem;
  max-height: 90vh;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tm-modal--wide {
  max-width: 31rem;
}

.tm-modal--solid-bg {
  @include tmModalSolid.tm-modal-solid-surface;
}

.tm-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.1rem;
  border-bottom-width: 1px;
}

.tm-modal-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.tm-close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem;
}

.tm-modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tm-modal-body--scroll {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.tm-label {
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 0.35rem;
}

.tm-input {
  width: 100%;
  border-radius: 0.375rem;
  padding: 0.5rem 0.6rem;
  font-size: 0.8125rem;
  outline: none;
}

.tm-textarea-region-desc {
  min-height: 11.5rem;
  resize: vertical;
  line-height: 1.45;
}

.tm-color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tm-color-dot {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.tm-color-dot--on {
  border-color: var(--accent-color);
  transform: scale(1.08);
}

.tm-icon-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.35rem;
}

.tm-icon-pick {
  padding: 0.35rem;
  border-radius: 0.375rem;
  border-width: 1px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tm-icon-pick--on {
  border-color: var(--accent-color);
  background: rgba(0, 0, 0, 0.05);
}

.tm-modal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-top-width: 1px;
  gap: 0.75rem;
  background: color-mix(
    in srgb,
    var(--panel-bg, rgba(15, 23, 42, 0.98)) 88%,
    var(--bg-color, #020617)
  );
}

.tm-modal-foot-right {
  display: flex;
  gap: 0.5rem;
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

.tm-btn-del-text {
  border: none;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
}

.tm-btn-del-text:hover {
  text-decoration: underline;
}
</style>
