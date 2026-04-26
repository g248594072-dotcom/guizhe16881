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

          <section v-if="clothingStatusLine" class="rcd-card rcd-card--wide rcd-card--clothing">
            <span class="rcd-bracket-tl" aria-hidden="true" />
            <span class="rcd-bracket-br" aria-hidden="true" />
            <h3 class="rcd-card-title">服装状态</h3>
            <p v-if="clothingJsonInvalid" class="rcd-clothing-error">无法解析服装状态 JSON，请检查 AI 输出。</p>
            <template v-else>
              <div class="rcd-clothing-grid">
                <div v-for="block in clothingSlotBlocks" :key="'slot-' + block.slotKey" class="rcd-clothing-slot-card">
                  <div class="rcd-clothing-slot-head">
                    <span class="rcd-clothing-slot-title">{{ block.slotKey }}</span>
                  </div>
                  <div class="rcd-clothing-slot-items">
                    <template v-if="block.items.length">
                      <div v-for="row in block.items" :key="block.slotKey + '-' + row.name" class="rcd-clothing-item">
                        <span class="rcd-clothing-name-pill">{{ row.name }}</span>
                        <div class="rcd-clothing-meta-row">
                          <span class="rcd-meta-k">状态</span>
                          <span class="rcd-meta-v">{{ row.状态 }}</span>
                        </div>
                        <div v-if="row.描述" class="rcd-clothing-meta-row">
                          <span class="rcd-meta-k">描述</span>
                          <span class="rcd-meta-v">{{ row.描述 }}</span>
                        </div>
                      </div>
                    </template>
                    <p v-else class="rcd-clothing-empty">暂无</p>
                  </div>
                </div>
              </div>
              <div v-if="recruitJewelryRows.length" class="rcd-clothing-jewelry-wrap">
                <div class="rcd-clothing-slot-head rcd-clothing-slot-head--jewelry">
                  <span class="rcd-clothing-slot-title">饰品</span>
                </div>
                <div class="rcd-clothing-jewelry-strip">
                  <div v-for="jw in recruitJewelryRows" :key="'jw-' + jw.name" class="rcd-clothing-item rcd-clothing-item--jewelry">
                    <span class="rcd-clothing-name-pill rcd-clothing-name-pill--jewelry">{{ jw.name }}</span>
                    <div v-if="jw.部位" class="rcd-clothing-meta-row">
                      <span class="rcd-meta-k">部位</span>
                      <span class="rcd-meta-v">{{ jw.部位 }}</span>
                    </div>
                    <div class="rcd-clothing-meta-row">
                      <span class="rcd-meta-k">状态</span>
                      <span class="rcd-meta-v">{{ jw.状态 }}</span>
                    </div>
                    <div v-if="jw.描述" class="rcd-clothing-meta-row">
                      <span class="rcd-meta-k">描述</span>
                      <span class="rcd-meta-v">{{ jw.描述 }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
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
  CLOTHING_BODY_SLOT_KEYS,
  type ClothingBodySlotKeyZh,
  type ClothingStateZh,
  type JewelryItemZh,
} from '../types';
import {
  normalizeFetishRecord,
  normalizeHobbyRecord,
  normalizeRepresentativeSpeechRecord,
  normalizeSensitivePartRecord,
} from '../utils/tagMap';

const clothingSlotKeys = CLOTHING_BODY_SLOT_KEYS;

function garmentEntriesForSlot(
  state: ClothingStateZh | null,
  slotKey: ClothingBodySlotKeyZh,
): Array<{ name: string; 状态: string; 描述: string }> {
  if (!state) return [];
  const rec = state[slotKey];
  if (!rec || typeof rec !== 'object') return [];
  return Object.entries(rec)
    .filter(([k]) => String(k).trim())
    .map(([name, raw]) => {
      const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      return {
        name,
        状态: String(o.状态 ?? '正常').trim() || '正常',
        描述: String(o.描述 ?? '').trim(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

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

const clothingStatusLine = computed(() => String(props.candidate.服装状态 ?? '').trim());

const clothingJsonInvalid = computed(() => {
  if (!clothingStatusLine.value) return false;
  try {
    JSON.parse(clothingStatusLine.value);
    return false;
  } catch {
    return true;
  }
});

const recruitClothingState = computed((): ClothingStateZh | null => {
  if (!clothingStatusLine.value || clothingJsonInvalid.value) return null;
  try {
    return clothingStateFromMvuRaw(JSON.parse(clothingStatusLine.value));
  } catch {
    return null;
  }
});

const clothingSlotBlocks = computed(() => {
  const s = recruitClothingState.value;
  return clothingSlotKeys.map(slotKey => ({
    slotKey,
    items: garmentEntriesForSlot(s, slotKey),
  }));
});

const recruitJewelryRows = computed(() => {
  const acc = recruitClothingState.value?.饰品;
  if (!acc || typeof acc !== 'object') return [];
  return Object.entries(acc)
    .filter(([k]) => String(k).trim().length > 0)
    .map(([name, raw]) => {
      const o = raw as JewelryItemZh;
      return {
        name,
        部位: String(o?.部位 ?? '').trim(),
        状态: String(o?.状态 ?? '正常').trim() || '正常',
        描述: String(o?.描述 ?? '').trim(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
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
  width: min(880px, 100%);
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

.rcd-card--clothing {
  padding-top: 12px;
}

.rcd-clothing-error {
  margin: 0;
  font-size: 12px;
  color: #f87171;
  line-height: 1.5;
}

.rcd--light .rcd-clothing-error {
  color: #dc2626;
}

.rcd-clothing-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 4px;
}

@media (max-width: 560px) {
  .rcd-clothing-grid {
    grid-template-columns: 1fr;
  }
}

.rcd-clothing-slot-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.rcd--light .rcd-clothing-slot-card {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.03);
}

.rcd-clothing-slot-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rcd-clothing-slot-head--jewelry {
  margin-bottom: 6px;
}

.rcd-clothing-slot-title {
  font-size: 13px;
  font-weight: 700;
  color: #e4e4e7;
}

.rcd--light .rcd-clothing-slot-title {
  color: #18181b;
}

.rcd-clothing-slot-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rcd-clothing-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.rcd--light .rcd-clothing-item {
  border-color: rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.65);
}

.rcd-clothing-name-pill {
  display: inline-block;
  max-width: 100%;
  padding: 6px 14px;
  border-radius: 9999px;
  border: 1px solid rgba(167, 139, 250, 0.45);
  background: rgba(167, 139, 250, 0.12);
  color: #e9d5ff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.rcd--light .rcd-clothing-name-pill {
  color: #5b21b6;
  border-color: rgba(124, 58, 237, 0.4);
  background: rgba(124, 58, 237, 0.1);
}

.rcd-clothing-name-pill--jewelry {
  padding: 4px 10px;
  font-size: 12px;
  border-color: rgba(248, 113, 113, 0.45);
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
}

.rcd--light .rcd-clothing-name-pill--jewelry {
  color: #b91c1c;
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(248, 113, 113, 0.12);
}

.rcd-clothing-meta-row {
  width: 100%;
  font-size: 13px;
  line-height: 1.55;
  color: #d4d4d8;
}

.rcd-meta-k {
  display: inline-block;
  min-width: 3em;
  margin-right: 6px;
  color: #a1a1aa;
  font-size: 12px;
}

.rcd-meta-v {
  color: #e4e4e7;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.rcd--light .rcd-clothing-meta-row {
  color: #3f3f46;
}

.rcd--light .rcd-meta-k {
  color: #71717a;
}

.rcd--light .rcd-meta-v {
  color: #18181b;
}

.rcd-clothing-empty {
  margin: 0;
  font-size: 12px;
  color: #a1a1aa;
}

.rcd--light .rcd-clothing-empty {
  color: #71717a;
}

.rcd-clothing-jewelry-wrap {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.rcd--light .rcd-clothing-jewelry-wrap {
  border-top-color: rgba(0, 0, 0, 0.08);
}

.rcd-clothing-jewelry-strip {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10px 12px;
  align-items: stretch;
}

.rcd-clothing-item--jewelry {
  flex: 1 1 200px;
  min-width: 0;
  max-width: min(100%, 280px);
  padding: 8px 10px;
  gap: 4px;
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
