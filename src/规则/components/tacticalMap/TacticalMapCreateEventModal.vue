<template>
  <div class="tm-modal-overlay" @click.self="$emit('close')">
    <div class="tm-modal tm-modal--solid-bg tm-modal--vivid-controls dynamic-panel dynamic-border" role="dialog">
      <div class="tm-modal-head dynamic-border">
        <h2 class="dynamic-text tm-head-title">
          <i class="fa-solid fa-wand-magic-sparkles dynamic-accent" aria-hidden="true"></i>
          创建活动（第二 API）
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
        <label class="tm-label dynamic-text-muted">活动类型</label>
        <input
          v-model.trim="activityTypeHint"
          type="text"
          class="tm-input dynamic-input dynamic-border dynamic-text"
          placeholder="随机"
          autocomplete="off"
          aria-label="活动类型"
        />
        <p class="hint dynamic-text-muted">
          将使用<strong class="dynamic-text">设置中的第二 API</strong>在后台生成「活动数据」的 JSON Patch；生成完成后请回到地图，在底部确认条写入酒馆发送框。
        </p>
      </div>
      <div class="tm-modal-foot dynamic-border">
        <button type="button" class="tm-btn dynamic-text" @click="$emit('close')">取消</button>
        <button type="button" class="tm-btn tm-btn-primary" @click="onRequest">
          <i class="fa-solid fa-bolt" aria-hidden="true"></i>
          开始生成
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
  requestAi: [payload: { selectedRegionId: string; activityTypeHint: string }];
}>();

const selectedRegionId = ref('all');
/** 空则按「随机」处理 */
const activityTypeHint = ref('随机');

function onRequest() {
  const hint = activityTypeHint.value.trim() || '随机';
  emit('requestAi', { selectedRegionId: selectedRegionId.value, activityTypeHint: hint });
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
}

.tm-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.9rem;
}

.hint {
  font-size: 0.8rem;
  line-height: 1.45;
  margin: 0;
}

.tm-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top-width: 1px;
}

.tm-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  border: 1px solid;
}

.tm-btn-primary {
  border: none;
}
</style>
