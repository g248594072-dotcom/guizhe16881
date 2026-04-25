<template>
  <div class="rcp" :class="isDarkMode ? 'rcp--dark' : 'rcp--light'">
    <p class="rcp-hint">确认选择，然后点击复制到对话框应用。发送聊天之后生成。</p>

    <div class="rcp-grid custom-scrollbar">
      <div v-for="(c, i) in candidates" :key="i" class="rcp-tall-wrap">
        <div
          class="rcp-tall-card"
          :class="{ 'rcp-tall-card--selected': selectedIndices.includes(i) }"
          role="button"
          tabindex="0"
          @click="openDetail(i)"
          @keydown.enter.prevent="openDetail(i)"
          @keydown.space.prevent="openDetail(i)"
        >
          <span class="rcp-glow" aria-hidden="true" />
          <div class="rcp-tall-inner">
            <span class="rcp-bracket-tl" aria-hidden="true" />
            <span class="rcp-bracket-br" aria-hidden="true" />

            <div class="rcp-hero">
              <div class="rcp-hero-gradient" aria-hidden="true" />
              <span class="rcp-hero-name" aria-hidden="true">{{ c.名字 }}</span>
            </div>

            <div class="rcp-body">
              <div class="rcp-select-wrap" @click.stop>
                <button
                  type="button"
                  class="rcp-select-bar"
                  :class="{ 'rcp-select-bar--on': selectedIndices.includes(i) }"
                  :aria-pressed="selectedIndices.includes(i)"
                  :aria-label="
                    selectedIndices.includes(i)
                      ? `已选择 ${c.名字}，点击取消`
                      : `确认选择候选人：${c.名字}`
                  "
                  @click="emitToggle(i)"
                >
                  <i
                    class="fa-solid"
                    :class="selectedIndices.includes(i) ? 'fa-check' : 'fa-hand-pointer'"
                    aria-hidden="true"
                  />
                  <span>{{ selectedIndices.includes(i) ? '已选择 · 点击取消' : '确认选择' }}</span>
                </button>
              </div>

              <div v-if="tagPills(c).length" class="rcp-tags">
                <span v-for="(t, ti) in tagPills(c)" :key="ti" class="rcp-tag">{{ t }}</span>
              </div>

              <p v-if="oneLiner(c)" class="rcp-one-liner">{{ oneLiner(c) }}</p>

              <p class="rcp-meta">
                <span class="rcp-meta-age">AGE / {{ c.年龄 }}</span>
                <span class="rcp-meta-sep">·</span>
                <span>{{ c.情感状况 }}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="rcp-actions">
      <button type="button" class="action-btn rcp-btn-back" @click="emit('back')">返回修改需求</button>
      <button
        type="button"
        class="action-btn cyber-button cyber-button-cyan rcp-btn-commit"
        :disabled="selectedIndices.length === 0 || committing"
        @click="emit('confirm')"
      >
        <i :class="committing ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-user-plus'" />
        <span>{{ committing ? '准备中…' : '复制到对话框' }}</span>
      </button>
    </div>

    <RecruitCandidateDetailDrawer
      v-if="detailIndex !== null && candidates[detailIndex]"
      :candidate="candidates[detailIndex]!"
      :index="detailIndex"
      :is-dark-mode="isDarkMode"
      @close="detailIndex = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CompanionCandidateRecord } from '../utils/characterRecruitFromAi';
import RecruitCandidateDetailDrawer from './RecruitCandidateDetailDrawer.vue';

const props = withDefaults(
  defineProps<{
    candidates: CompanionCandidateRecord[];
    selectedIndices: number[];
    committing: boolean;
    isDarkMode: boolean;
    /** 生成中（列表区由父级占位时可不传） */
    generating?: boolean;
  }>(),
  { generating: false },
);

const emit = defineEmits<{
  toggle: [index: number, checked: boolean];
  back: [];
  confirm: [];
}>();

const detailIndex = ref<number | null>(null);

function emitToggle(i: number) {
  const on = props.selectedIndices.includes(i);
  emit('toggle', i, !on);
}

function openDetail(i: number) {
  detailIndex.value = i;
}

function tagPills(c: CompanionCandidateRecord): string[] {
  return String(c.标签 ?? '')
    .split(/[/／|｜]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function oneLiner(c: CompanionCandidateRecord): string {
  return String(c.一句话介绍 ?? '').trim();
}
</script>

<style scoped lang="scss">
.rcp {
  position: relative;
  z-index: 1;
}

.rcp-hint {
  margin: 0 0 14px;
  font-size: 14px;
  line-height: 1.55;
  opacity: 0.9;
}

.rcp--dark .rcp-hint {
  color: #d4d4d8;
}

.rcp--light .rcp-hint {
  color: #3f3f46;
}

.rcp-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  max-height: min(52vh, 520px);
  overflow-y: auto;
  padding: 4px 2px 8px;
  margin-bottom: 16px;

  @media (min-width: 520px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 900px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.rcp-tall-wrap {
  min-width: 0;
}

.rcp-tall-card {
  position: relative;
  border-radius: 12px;
  cursor: pointer;
  outline: none;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-3px);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--color-neon-cyan, #00f3ff);
  }
}

.rcp-glow {
  position: absolute;
  inset: -3px;
  border-radius: 14px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s ease;
  z-index: 0;
  background: linear-gradient(125deg, var(--color-neon-cyan), var(--color-neon-magenta));
  filter: blur(12px);
}

.rcp-tall-card:hover .rcp-glow {
  opacity: 0.4;
}

.rcp-tall-card--selected .rcp-glow {
  opacity: 0.22;
}

.rcp-tall-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  min-height: 240px;
  backdrop-filter: blur(10px);
}

.rcp--dark .rcp-tall-inner {
  background: rgba(255, 255, 255, 0.05);
}

.rcp--light .rcp-tall-inner {
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(0, 0, 0, 0.1);
}

.rcp-tall-card--selected .rcp-tall-inner {
  border-color: rgba(0, 243, 255, 0.45);
  box-shadow: 0 0 22px rgba(0, 243, 255, 0.15);
}

.rcp-bracket-tl,
.rcp-bracket-br {
  position: absolute;
  width: 32px;
  height: 32px;
  z-index: 3;
  pointer-events: none;
}

.rcp-bracket-tl {
  top: 10px;
  left: 10px;
  border-top: 3px solid var(--color-neon-cyan, #00f3ff);
  border-left: 3px solid var(--color-neon-cyan, #00f3ff);
}

.rcp-bracket-br {
  bottom: 10px;
  right: 10px;
  border-bottom: 3px solid var(--color-neon-magenta, #ff00ff);
  border-right: 3px solid var(--color-neon-magenta, #ff00ff);
}

.rcp-hero {
  position: relative;
  height: 28%;
  min-height: 84px;
  max-height: 112px;
  overflow: hidden;
}

.rcp-hero-gradient {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(160deg, rgba(0, 243, 255, 0.15) 0%, rgba(255, 0, 255, 0.08) 45%, rgba(0, 0, 0, 0.5) 100%);
}

.rcp-hero-name {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px 4px;
  box-sizing: border-box;
  max-width: 100%;
  font-size: clamp(0.95rem, 1.15vw + 0.55rem, 1.45rem);
  font-weight: 900;
  font-style: italic;
  font-family: var(--font-cyber-display, 'Orbitron', sans-serif);
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(248, 250, 252, 0.96);
  user-select: none;
  letter-spacing: 0.02em;
  text-shadow:
    0 0 1px rgba(0, 0, 0, 0.95),
    0 0 18px rgba(0, 0, 0, 0.75),
    0 1px 2px rgba(0, 0, 0, 0.9),
    0 0 12px rgba(0, 243, 255, 0.55),
    0.05em 0 0 rgba(0, 243, 255, 0.45),
    -0.05em 0 0 rgba(255, 0, 255, 0.35);
}

.rcp--light .rcp-hero-name {
  color: #0f172a;
  text-shadow:
    0 0 1px rgba(255, 255, 255, 0.9),
    0 0 10px rgba(8, 145, 178, 0.35),
    0.04em 0 0 rgba(8, 145, 178, 0.25),
    -0.04em 0 0 rgba(192, 38, 211, 0.2);
}

.rcp-body {
  flex: 1;
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rcp-select-wrap {
  width: 100%;
}

.rcp-select-bar {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 48px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(0, 243, 255, 0.22);
  background: rgba(0, 0, 0, 0.35);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.82);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;

  i {
    font-size: 17px;
    color: var(--color-neon-cyan, #00f3ff);
    opacity: 0.95;
  }

  &:hover {
    border-color: var(--color-neon-cyan, #00f3ff);
    color: var(--color-neon-cyan, #00f3ff);
    box-shadow: 0 0 16px rgba(0, 243, 255, 0.12);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 243, 255, 0.45);
  }
}

.rcp--light .rcp-select-bar {
  border: 1px solid rgba(8, 145, 178, 0.28);
  background: rgba(255, 255, 255, 0.72);
  color: #27272a;

  i {
    color: #0891b2;
  }

  &:hover {
    border-color: #0891b2;
    color: #0e7490;
    box-shadow: 0 0 14px rgba(8, 145, 178, 0.15);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.4);
  }
}

.rcp-select-bar--on {
  border-style: solid;
  border-color: rgba(0, 243, 255, 0.55);
  background: rgba(0, 243, 255, 0.12);
  color: var(--color-neon-cyan, #00f3ff);

  i {
    color: var(--color-neon-cyan, #00f3ff);
  }

  &:hover {
    border-color: rgba(255, 0, 255, 0.45);
    color: rgba(255, 220, 255, 0.95);
    box-shadow: 0 0 18px rgba(255, 0, 255, 0.12);
  }
}

.rcp--light .rcp-select-bar--on {
  border-color: rgba(8, 145, 178, 0.5);
  background: rgba(8, 145, 178, 0.12);
  color: #0e7490;

  i {
    color: #0e7490;
  }

  &:hover {
    border-color: #a21caf;
    color: #86198f;
    box-shadow: 0 0 14px rgba(162, 28, 175, 0.12);
  }
}

.rcp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.rcp-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.45);
}

.rcp--light .rcp-tag {
  border-color: rgba(0, 0, 0, 0.12);
  color: rgba(24, 24, 27, 0.55);
}

.rcp-one-liner {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  opacity: 0.92;
}

.rcp--dark .rcp-one-liner {
  color: #e2e8f0;
}

.rcp--light .rcp-one-liner {
  color: #3f3f46;
}

.rcp-meta {
  margin: 0;
  font-family: var(--font-cyber-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rcp--dark .rcp-meta {
  color: var(--color-neon-cyan, #00f3ff);
  opacity: 0.9;
}

.rcp--light .rcp-meta {
  color: #0891b2;
}

.rcp-meta-sep {
  margin: 0 0.35em;
  opacity: 0.5;
}

.rcp-actions {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 12px;
  align-items: stretch;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
  }
}

.rcp-actions .action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 52px;
  padding: 14px 18px;
  font-size: 16px;
  font-weight: 700;
  box-sizing: border-box;

  @media (min-width: 640px) {
    width: auto;
    flex: 1;
    min-width: 0;
  }
}

.rcp-btn-back {
  border: 1px dashed rgba(255, 255, 255, 0.25);
  background: transparent;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.rcp--dark .rcp-btn-back {
  color: rgba(255, 255, 255, 0.65);

  &:hover {
    border-color: var(--color-neon-cyan, #00f3ff);
    color: var(--color-neon-cyan, #00f3ff);
  }
}

.rcp--light .rcp-btn-back {
  color: #52525b;
  border-color: rgba(0, 0, 0, 0.2);

  &:hover {
    border-color: #0891b2;
    color: #0891b2;
  }
}

.rcp-btn-commit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transform: skewX(-4deg);

  span,
  i {
    transform: skewX(4deg);
  }

  &:not(:disabled):hover {
    box-shadow: 0 0 20px rgba(0, 243, 255, 0.35);
  }
}

.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--color-neon-cyan, #00f3ff) rgba(255, 255, 255, 0.06);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-neon-cyan, #00f3ff);
  border-radius: 6px;
}
</style>
