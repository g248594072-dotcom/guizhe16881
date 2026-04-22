<template>
  <Teleport :to="teleportTo">
    <Transition name="fade">
      <div
        v-if="open && draft"
        class="edit-cart-item-editor-overlay"
        @click.self="onClose"
      >
        <div
          class="edit-cart-item-editor-panel"
          :class="{ dark: isDarkMode, light: !isDarkMode }"
          role="dialog"
          aria-labelledby="edit-cart-item-editor-title"
          @click.stop
        >
          <div class="eci-header">
            <h3 id="edit-cart-item-editor-title">编辑暂存项</h3>
            <button type="button" class="eci-close" aria-label="关闭" @click="onClose">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="eci-body">
            <template v-if="draft.action.kind === 'archive_world_rule'">
              <label class="eci-label">要归档的世界规则名称</label>
              <input v-model="draft.action.title" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'delete_world_rule'">
              <label class="eci-label">要删除的世界规则名称</label>
              <input v-model="draft.action.title" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'archive_region'">
              <label class="eci-label">要归档的区域名称</label>
              <input v-model="draft.action.name" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'delete_region'">
              <label class="eci-label">要删除的区域名称（将移除该区域及全部细分规则）</label>
              <input v-model="draft.action.name" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'archive_regional_rule'">
              <label class="eci-label">区域名称</label>
              <input v-model="draft.action.regionName" type="text" class="eci-input" />
              <label class="eci-label">规则 ID / 标题</label>
              <input v-model="draft.action.ruleIdOrTitle" type="text" class="eci-input" />
              <label class="eci-label">规则摘要（可选）</label>
              <input v-model="draft.action.ruleSummary" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'delete_regional_rule'">
              <label class="eci-label">区域名称</label>
              <input v-model="draft.action.regionName" type="text" class="eci-input" />
              <label class="eci-label">规则 ID / 标题</label>
              <input v-model="draft.action.ruleIdOrTitle" type="text" class="eci-input" />
              <label class="eci-label">规则摘要（可选）</label>
              <input v-model="draft.action.ruleSummary" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'archive_personal_rule'">
              <p class="eci-hint">规则标识（一般勿改）</p>
              <input v-model="draft.action.idOrTitle" type="text" class="eci-input" disabled />
              <label class="eci-label">角色 / 分组名</label>
              <input v-model="draft.action.characterName" type="text" class="eci-input" />
              <label class="eci-label">规则摘要（可选）</label>
              <input v-model="draft.action.ruleSummary" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'delete_personal_rule'">
              <p class="eci-hint">规则标识（一般勿改）</p>
              <input v-model="draft.action.idOrTitle" type="text" class="eci-input" disabled />
              <label class="eci-label">角色 / 分组名</label>
              <input v-model="draft.action.characterName" type="text" class="eci-input" />
              <label class="eci-label">规则摘要（可选）</label>
              <input v-model="draft.action.ruleSummary" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'archive_personal_rules_group'">
              <label class="eci-label">对象 / 分组名（归档该对象下全部个人规则）</label>
              <input v-model="draft.action.groupName" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'delete_personal_rules_group'">
              <label class="eci-label">对象 / 分组名（删除该对象下全部个人规则）</label>
              <input v-model="draft.action.groupName" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'character_basic'">
              <label class="eci-label">姓名</label>
              <input v-model="basicName" type="text" class="eci-input" />
              <label class="eci-label">年龄</label>
              <input v-model="basicAge" type="text" class="eci-input" />
              <label class="eci-label">身高</label>
              <input v-model="basicHeight" type="text" class="eci-input" />
              <label class="eci-label">体重</label>
              <input v-model="basicWeight" type="text" class="eci-input" />
              <label class="eci-label">三围</label>
              <input v-model="basicThree" type="text" class="eci-input" />
              <label class="eci-label">体质</label>
              <input v-model="basicPhysique" type="text" class="eci-input" />
              <label class="eci-label">好感度</label>
              <input v-model.number="basicAffection" type="number" class="eci-input" />
              <label class="eci-label">发情值</label>
              <input v-model.number="basicLust" type="number" class="eci-input" />
              <label class="eci-label">性癖开发值</label>
              <input v-model.number="basicFetish" type="number" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'delete_character'">
              <p class="eci-hint">角色 ID：{{ draft.action.characterId }}（不可改）</p>
              <label class="eci-label">显示名称（用于删除说明文案）</label>
              <input v-model="draft.action.characterName" type="text" class="eci-input" />
            </template>

            <template v-else-if="draft.action.kind === 'random_add_world'">
              <label class="eci-label">规则名称</label>
              <input v-model="draft.action.title" type="text" class="eci-input" />
              <label class="eci-label">效果描述</label>
              <textarea v-model="draft.action.desc" class="eci-textarea" rows="5" />
            </template>

            <template v-else-if="draft.action.kind === 'random_add_regional'">
              <p class="eci-hint">区域：{{ draft.action.regionName }}（ID {{ draft.action.regionId }}）</p>
              <label class="eci-label">规则名称</label>
              <input v-model="draft.action.title" type="text" class="eci-input" />
              <label class="eci-label">效果描述</label>
              <textarea v-model="draft.action.desc" class="eci-textarea" rows="5" />
            </template>

            <template v-else-if="draft.action.kind === 'random_add_personal'">
              <label class="eci-label">适用角色</label>
              <input v-model="draft.action.target" type="text" class="eci-input" />
              <label class="eci-label">规则名字</label>
              <input v-model="draft.action.ruleName" type="text" class="eci-input" />
              <label class="eci-label">规则内容</label>
              <textarea v-model="draft.action.detail" class="eci-textarea" rows="5" />
            </template>

            <template v-else-if="draft.action.kind === 'meta_world_info'">
              <label class="eci-label">世界类型</label>
              <input
                v-model="draft.action.世界类型"
                type="text"
                class="eci-input"
                maxlength="64"
                placeholder="如：现代、西幻"
              />
              <label class="eci-label">世界简介</label>
              <textarea
                v-model="draft.action.世界简介"
                class="eci-textarea"
                rows="6"
                maxlength="2000"
                placeholder="世界观补充说明"
              />
            </template>
            <template v-else-if="draft.action.kind === 'modal_commit'">
              <ModalCommitFields :modal-type="draft.action.modalType" :form="draft.action.form" />
            </template>
          </div>
          <div class="eci-footer">
            <button type="button" class="eci-btn secondary" @click="onClose">取消</button>
            <button type="button" class="eci-btn primary" @click="onSave">保存</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { klona } from 'klona';
import type { EditCartItem, EditCartModalForm } from '../types/editCart';
import {
  bodyGarmentRowsFromClothingState,
  clothingStateFromMvuRaw,
  normalizeJewelryEditRow,
} from '../utils/dialogAndVariable';
import { refreshEditCartItem } from '../utils/editCartFlow';
import ModalCommitFields from './EditCartModalCommitFields.vue';

const props = withDefaults(
  defineProps<{
    /** 与 App 主界面一致：游戏阶段挂 #app-root，避免被主层挡住点击 */
    teleportTo?: string;
    open: boolean;
    item: EditCartItem | null;
    isDarkMode: boolean;
  }>(),
  { teleportTo: 'body' },
);

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'save', item: EditCartItem): void;
}>();

const draft = ref<EditCartItem | null>(null);

watch(
  () => [props.open, props.item] as const,
  ([isOpen, it]) => {
    if (isOpen && it) {
      const copy = klona(it) as EditCartItem;
      if (copy.action.kind === 'archive_personal_rule') {
        const a = copy.action;
        if (a.characterName === undefined) a.characterName = '';
        if (a.ruleSummary === undefined) a.ruleSummary = '';
      }
      if (copy.action.kind === 'modal_commit' && copy.action.modalType === 'edit_character_appearance') {
        const f = copy.action.form as EditCartModalForm;
        f.appearanceClothing = clothingStateFromMvuRaw(f.appearanceClothing ?? {});
        const rows = f.appearanceBodyGarmentRows;
        if (!rows || rows.length === 0) {
          f.appearanceBodyGarmentRows = bodyGarmentRowsFromClothingState(f.appearanceClothing);
        }
        f.appearanceJewelryRows = (f.appearanceJewelryRows ?? []).map(r => normalizeJewelryEditRow(r));
        if (!f.appearanceBodyPartRows) f.appearanceBodyPartRows = [];
      }
      if (copy.action.kind === 'modal_commit') {
        const f = copy.action.form as EditCartModalForm;
        if (f.personalRuleName === undefined || f.personalRuleName === null) f.personalRuleName = '';
      }
      if (copy.action.kind === 'random_add_personal') {
        const a = copy.action;
        if (a.ruleName === undefined || a.ruleName === null) {
          const d = String(a.detail ?? '');
          const i = d.indexOf(':');
          if (i > 0) {
            a.ruleName = d.slice(0, i).trim();
            a.detail = d.slice(i + 1).trim();
          } else {
            a.ruleName = '';
          }
        }
      }
      draft.value = copy;
    }
    if (!isOpen) {
      draft.value = null;
    }
  },
  { immediate: true },
);

function basicData() {
  const d = draft.value;
  if (d?.action.kind !== 'character_basic') return null;
  return d.action.data;
}

const basicName = computed({
  get: () => String(basicData()?.name ?? ''),
  set: (v: string) => {
    const b = basicData();
    if (b) b.name = v;
  },
});
const basicAge = computed({
  get: () => String(basicData()?.age ?? ''),
  set: (v: string) => {
    const b = basicData();
    if (b) b.age = v;
  },
});
const basicHeight = computed({
  get: () => String(basicData()?.height ?? ''),
  set: (v: string) => {
    const b = basicData();
    if (b) b.height = v;
  },
});
const basicWeight = computed({
  get: () => String(basicData()?.weight ?? ''),
  set: (v: string) => {
    const b = basicData();
    if (b) b.weight = v;
  },
});
const basicThree = computed({
  get: () => String(basicData()?.threeSize ?? ''),
  set: (v: string) => {
    const b = basicData();
    if (b) b.threeSize = v;
  },
});
const basicPhysique = computed({
  get: () => String(basicData()?.physique ?? ''),
  set: (v: string) => {
    const b = basicData();
    if (b) b.physique = v;
  },
});
const basicAffection = computed({
  get: () => Number(basicData()?.affection ?? 0),
  set: (v: number) => {
    const b = basicData();
    if (b) b.affection = v;
  },
});
const basicLust = computed({
  get: () => Number(basicData()?.lust ?? 0),
  set: (v: number) => {
    const b = basicData();
    if (b) b.lust = v;
  },
});
const basicFetish = computed({
  get: () => Number(basicData()?.fetish ?? 0),
  set: (v: number) => {
    const b = basicData();
    if (b) b.fetish = v;
  },
});

function onClose() {
  emit('update:open', false);
}

function onSave() {
  const d = draft.value;
  if (!d) return;
  emit('save', refreshEditCartItem(d));
  emit('update:open', false);
}
</script>

<style scoped lang="scss">
.edit-cart-item-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 210000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.6);
}

.edit-cart-item-editor-panel {
  width: 100%;
  max-width: 520px;
  max-height: min(85vh, 720px);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.edit-cart-item-editor-panel.dark {
  background: #18181b;
  color: #e4e4e7;
}

.edit-cart-item-editor-panel.light {
  background: #fafafa;
  color: #18181b;
  border-color: rgba(0, 0, 0, 0.1);
}

.eci-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  h3 {
    margin: 0;
    font-size: 16px;
  }
}

.light .eci-header {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}

.eci-close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 18px;
  opacity: 0.85;

  &:hover {
    opacity: 1;
  }
}

.eci-body {
  padding: 12px 14px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.eci-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.light .eci-footer {
  border-top-color: rgba(0, 0, 0, 0.08);
}

.eci-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin: 10px 0 4px;
}

.eci-hint {
  font-size: 12px;
  opacity: 0.75;
  margin: 0 0 8px;
}

.eci-input,
.eci-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  font-size: 14px;
}

.light .eci-input,
.light .eci-textarea {
  border-color: rgba(0, 0, 0, 0.12);
  background: #fff;
}

.eci-textarea {
  resize: vertical;
  min-height: 80px;
}

.eci-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: none;

  &.secondary {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: inherit;
  }

  &.primary {
    background: #3b82f6;
    color: #fff;

    &:hover {
      background: #2563eb;
    }
  }
}

.light .eci-btn.secondary {
  border-color: rgba(0, 0, 0, 0.15);
}
</style>
