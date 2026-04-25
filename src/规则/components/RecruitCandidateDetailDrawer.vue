<template>
  <Teleport to="body">
    <div class="rcd-overlay" :class="isDarkMode ? 'rcd--dark' : 'rcd--light'" @click.self="emit('close')">
      <div class="rcd-panel custom-scrollbar" role="dialog" aria-modal="true" :aria-labelledby="titleId" @click.stop>
        <header class="rcd-header">
          <button type="button" class="rcd-back" @click="emit('close')">
            <i class="fa-solid fa-arrow-left" aria-hidden="true" />
            <span>返回列表</span>
          </button>
          <h2 :id="titleId" class="rcd-title">{{ candidate.名字 }}</h2>
        </header>

        <div class="rcd-grid">
          <section class="rcd-card">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">档案摘要</h3>
            <dl class="rcd-dl">
              <div class="rcd-row">
                <dt>标签</dt>
                <dd>{{ candidate.标签 }}</dd>
              </div>
              <div class="rcd-row">
                <dt>年龄</dt>
                <dd>{{ candidate.年龄 }}</dd>
              </div>
              <div class="rcd-row">
                <dt>情感状况</dt>
                <dd>{{ candidate.情感状况 }}</dd>
              </div>
              <div v-if="hiddenFetishDisplay" class="rcd-row">
                <dt>隐藏性癖</dt>
                <dd>{{ hiddenFetishDisplay }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="hobbyRows.length" class="rcd-card rcd-card--wide">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">爱好</h3>
            <dl class="rcd-dl">
              <div v-for="row in hobbyRows" :key="row.name" class="rcd-row rcd-row--stack">
                <dt>{{ row.name }}</dt>
                <dd class="rcd-dd-block">{{ row.text }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="fetishRows.length" class="rcd-card rcd-card--wide">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">性癖</h3>
            <dl class="rcd-dl">
              <div v-for="row in fetishRows" :key="row.name" class="rcd-row rcd-row--stack">
                <dt>{{ row.name }}</dt>
                <dd class="rcd-dd-block">{{ row.text }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="sensitiveRows.length" class="rcd-card rcd-card--wide">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">敏感点开发</h3>
            <dl class="rcd-dl">
              <div v-for="row in sensitiveRows" :key="row.name" class="rcd-row rcd-row--stack">
                <dt>{{ row.name }}</dt>
                <dd class="rcd-dd-block">{{ row.text }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="clothingJsonDisplay" class="rcd-card rcd-card--wide">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">服装状态</h3>
            <pre class="rcd-pre">{{ clothingJsonDisplay }}</pre>
          </section>

          <section class="rcd-card rcd-card--wide">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">简介</h3>
            <p class="rcd-body">{{ candidate.简介 }}</p>
          </section>

          <section v-if="speechRows.length" class="rcd-card rcd-card--wide">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">代表性发言</h3>
            <p v-for="row in speechRows" :key="row.scene" class="rcd-quote">
              <span class="rcd-scene">{{ row.scene }}：</span>「{{ row.line }}」
            </p>
          </section>

          <section v-if="oneLinerText" class="rcd-card rcd-card--wide">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">一句话介绍</h3>
            <p class="rcd-body rcd-body--one-liner">{{ oneLinerText }}</p>
          </section>
        </div>

        <p class="rcd-foot">仅浏览，不会写入 MVU；是否在名单请在列表卡片上点「确认选择」横条。</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CompanionCandidateRecord } from '../utils/characterRecruitFromAi';
import { clothingStateFromMvuRaw } from '../utils/dialogAndVariable';
import {
  normalizeFetishRecord,
  normalizeHobbyRecord,
  normalizeRepresentativeSpeechRecord,
  normalizeSensitivePartRecord,
} from '../utils/tagMap';

const props = defineProps<{
  candidate: CompanionCandidateRecord;
  index: number;
  isDarkMode: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const titleId = computed(() => `rcd-title-${props.index}`);

const oneLinerText = computed(() => String(props.candidate.一句话介绍 ?? '').trim());

const hiddenFetishDisplay = computed(() => String(props.candidate.隐藏性癖 ?? '').trim());

const hobbyRows = computed(() => {
  try {
    const raw = JSON.parse(String(props.candidate.爱好 ?? '').trim()) as unknown;
    const norm = normalizeHobbyRecord(raw);
    return Object.entries(norm).map(([name, v]) => ({
      name,
      text: [`等级：${v.等级}`, v.喜欢的原因 && `原因：${v.喜欢的原因}`].filter(Boolean).join('\n'),
    }));
  } catch {
    return [];
  }
});

const speechRows = computed(() => {
  try {
    const raw = JSON.parse(String(props.candidate.代表性发言 ?? '').trim()) as unknown;
    const norm = normalizeRepresentativeSpeechRecord(raw);
    return Object.entries(norm).map(([scene, line]) => ({ scene, line }));
  } catch {
    return [];
  }
});

const fetishRows = computed(() => {
  try {
    const raw = JSON.parse(String(props.candidate.性癖 ?? '').trim()) as unknown;
    const norm = normalizeFetishRecord(raw);
    return Object.entries(norm).map(([name, v]) => ({
      name,
      text: [`等级：${v.等级}`, v.细节描述 && `细节：${v.细节描述}`, v.自我合理化 && `自我合理化：${v.自我合理化}`]
        .filter(Boolean)
        .join('\n'),
    }));
  } catch {
    return [];
  }
});

const sensitiveRows = computed(() => {
  try {
    const raw = JSON.parse(String(props.candidate.敏感点开发 ?? '').trim()) as unknown;
    const norm = normalizeSensitivePartRecord(raw);
    return Object.entries(norm).map(([name, v]) => ({
      name,
      text: [
        `敏感等级：${v.敏感等级}`,
        v.生理反应 && `生理反应：${v.生理反应}`,
        v.开发细节 && `开发细节：${v.开发细节}`,
      ]
        .filter(Boolean)
        .join('\n'),
    }));
  } catch {
    return [];
  }
});

const clothingJsonDisplay = computed(() => {
  try {
    const raw = JSON.parse(String(props.candidate.服装状态 ?? '').trim()) as unknown;
    const norm = clothingStateFromMvuRaw(raw);
    return JSON.stringify(norm, null, 2);
  } catch {
    return '';
  }
});
</script>

<style scoped lang="scss">
.rcd-overlay {
  position: fixed;
  inset: 0;
  z-index: 100002;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 12px;
  overflow-y: auto;
  backdrop-filter: blur(6px);
}

.rcd--dark.rcd-overlay {
  background: rgba(0, 0, 0, 0.72);
}

.rcd--light.rcd-overlay {
  background: rgba(24, 24, 27, 0.45);
}

.rcd-panel {
  width: min(640px, 100%);
  max-height: min(88vh, 900px);
  overflow-y: auto;
  margin-top: 4vh;
  padding: 20px 22px 16px;
  border-radius: 12px;
  border: 1px solid rgba(0, 243, 255, 0.25);
  box-shadow: 0 0 40px rgba(0, 243, 255, 0.12);
}

.rcd--dark .rcd-panel {
  background: rgba(10, 10, 14, 0.95);
  color: #e4e4e7;
}

.rcd--light .rcd-panel {
  background: #fafafa;
  color: #18181b;
  border-color: rgba(8, 145, 178, 0.35);
}

.rcd-header {
  margin-bottom: 18px;
}

.rcd-back {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px 10px 0;
  margin: -4px 0 8px -2px;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.55);
  transition: color 0.2s ease;

  i {
    font-size: 1.15em;
    line-height: 1;
  }
}

.rcd--light .rcd-back {
  color: #52525b;
}

.rcd-back:hover {
  color: var(--color-neon-cyan, #00f3ff);
}

.rcd-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 900;
  font-style: italic;
  font-family: var(--font-cyber-display, 'Orbitron', sans-serif);
  letter-spacing: -0.02em;
  text-shadow:
    0.03em 0 0 rgba(255, 0, 255, 0.3),
    -0.03em 0 0 rgba(0, 243, 255, 0.3);
}

.rcd-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rcd-card {
  position: relative;
  padding: 14px 16px 14px 18px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.rcd--dark .rcd-card {
  background: rgba(255, 255, 255, 0.05);
}

.rcd--light .rcd-card {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 0, 0, 0.08);
}

.rcd-card--wide {
  width: 100%;
}

.rcd-bracket-tl,
.rcd-bracket-br {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}

.rcd-bracket-tl {
  top: 8px;
  left: 8px;
  border-top: 2px solid var(--color-neon-cyan, #00f3ff);
  border-left: 2px solid var(--color-neon-cyan, #00f3ff);
}

.rcd-bracket-br {
  bottom: 8px;
  right: 8px;
  border-bottom: 2px solid var(--color-neon-magenta, #ff00ff);
  border-right: 2px solid var(--color-neon-magenta, #ff00ff);
}

.rcd-card-title {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-neon-cyan, #00f3ff);
}

.rcd-dl {
  margin: 0;
}

.rcd-row {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
}

.rcd--light .rcd-row {
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

.rcd-row dt {
  flex: 0 0 5.5rem;
  margin: 0;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
}

.rcd--light .rcd-row dt {
  color: #71717a;
}

.rcd-row dd {
  margin: 0;
  flex: 1;
  line-height: 1.45;
}

.rcd-row--stack {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}

.rcd-row--stack dt {
  flex: none;
  color: var(--color-neon-cyan, #00f3ff);
  opacity: 0.95;
}

.rcd--light .rcd-row--stack dt {
  color: #0891b2;
}

.rcd-dd-block {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.rcd-pre {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(0, 243, 255, 0.15);
  font-family: var(--font-cyber-mono, 'JetBrains Mono', monospace);
}

.rcd--light .rcd-pre {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
  color: #27272a;
}

.rcd-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.rcd-body--one-liner {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.rcd-quote {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  font-style: italic;
}

.rcd-quote + .rcd-quote {
  margin-top: 10px;
}

.rcd-scene {
  font-weight: 700;
  color: var(--color-neon-cyan, #00f3ff);
  opacity: 0.9;
}

.rcd--light .rcd-scene {
  color: #0891b2;
}

.rcd-foot {
  margin: 16px 0 0;
  font-size: 11px;
  opacity: 0.65;
  font-family: var(--font-cyber-mono, 'JetBrains Mono', monospace);
}

.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--color-neon-cyan) rgba(255, 255, 255, 0.06);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-neon-cyan);
  border-radius: 6px;
}
</style>
