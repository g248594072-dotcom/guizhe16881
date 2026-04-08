<template>
  <div class="personal-rule-character-picker">
    <div ref="dropdownEl" class="prcp-dropdown">
      <button
        type="button"
        :class="['prcp-trigger', selectClass]"
        :aria-expanded="listOpen"
        aria-haspopup="listbox"
        @click="listOpen = !listOpen"
      >
        <span class="prcp-trigger-label">{{ emptyLabel }}</span>
        <i class="fa-solid fa-chevron-down prcp-chevron" :class="{ 'prcp-chevron--open': listOpen }" aria-hidden="true" />
      </button>
      <ul v-show="listOpen" class="prcp-list" role="listbox">
        <template v-if="archiveCharacterNames.length === 0">
          <li class="prcp-empty" role="presentation">暂无角色档案，请先在角色管理中创建</li>
        </template>
        <template v-else>
          <li v-for="n in archiveCharacterNames" :key="n" role="option">
            <button type="button" class="prcp-option" @click="pickName(n)">
              {{ n }}
            </button>
          </li>
        </template>
      </ul>
    </div>
    <input
      v-model="character"
      type="text"
      :class="inputClass"
      :placeholder="inputPlaceholder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { useDataStore } from '../store';

const character = defineModel<string>({ default: '' });

withDefaults(
  defineProps<{
    selectClass?: string;
    inputClass?: string;
    emptyLabel?: string;
    inputPlaceholder?: string;
  }>(),
  {
    selectClass: 'form-input',
    inputClass: 'form-input',
    emptyLabel: '从角色档案选择…',
    inputPlaceholder: '输入或选择适用角色/对象名称',
  },
);

const listOpen = ref(false);
const dropdownEl = ref<HTMLElement | null>(null);

onClickOutside(dropdownEl, () => {
  listOpen.value = false;
});

const dataStore = useDataStore();

const archiveCharacterNames = computed(() => {
  const arch = dataStore.data.角色档案 as Record<string, Record<string, unknown>> | undefined;
  if (!arch || typeof arch !== 'object') return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const [id, raw] of Object.entries(arch)) {
    if (!raw || typeof raw !== 'object') continue;
    const name = String(raw.姓名 ?? raw.name ?? '').trim();
    const label = name || id;
    if (seen.has(label)) continue;
    seen.add(label);
    names.push(label);
  }
  names.sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return names;
});

function pickName(n: string) {
  const v = n.trim();
  if (v) {
    character.value = v;
  }
  listOpen.value = false;
}
</script>

<style scoped lang="scss">
.personal-rule-character-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.personal-rule-character-picker input {
  width: 100%;
  box-sizing: border-box;
}

.prcp-dropdown {
  position: relative;
  width: 100%;
}

.prcp-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.prcp-trigger-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}

.prcp-chevron {
  flex-shrink: 0;
  font-size: 12px;
  opacity: 0.7;
  transition: transform 0.2s ease;
}

.prcp-chevron--open {
  transform: rotate(180deg);
}

/* 自定义列表：深色底 + 霓虹青字，避免系统原生下拉白底看不见字 */
.prcp-list {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: 120;
  margin: 0;
  padding: 6px 0;
  list-style: none;
  max-height: min(240px, 40vh);
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid rgba(34, 211, 238, 0.45);
  background: #0c0c12;
  box-shadow:
    0 0 0 1px rgba(168, 85, 247, 0.15),
    0 12px 32px rgba(0, 0, 0, 0.55),
    0 0 24px rgba(34, 211, 238, 0.12);
}

.prcp-empty {
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.45;
  color: #71717a;
}

.prcp-option {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  color: #22d3ee;
  text-shadow:
    0 0 12px rgba(34, 211, 238, 0.75),
    0 0 2px rgba(34, 211, 238, 0.9);
  letter-spacing: 0.02em;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    text-shadow 0.15s ease;

  &:hover,
  &:focus-visible {
    outline: none;
    color: #a5f3fc;
    background: rgba(34, 211, 238, 0.12);
    text-shadow:
      0 0 16px rgba(165, 243, 252, 0.9),
      0 0 4px rgba(34, 211, 238, 1);
  }

  &:active {
    color: #f0abfc;
    text-shadow:
      0 0 14px rgba(240, 171, 252, 0.85),
      0 0 4px rgba(217, 70, 239, 0.9);
    background: rgba(192, 38, 211, 0.12);
  }
}

.prcp-list li + li .prcp-option {
  border-top: 1px solid rgba(34, 211, 238, 0.08);
}
</style>
