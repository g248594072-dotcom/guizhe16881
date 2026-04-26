<template>
  <div class="ecf">
    <!-- 新增角色 -->
    <template v-if="modalType === 'add_character'">
      <label class="eci-label">名字</label>
      <input
        v-model="form.addCharacterName"
        type="text"
        class="eci-input"
        placeholder="可不填，会随机生成。"
      />
      <label class="eci-label">关系和身份</label>
      <input
        v-model="form.addCharacterRelationIdentity"
        type="text"
        class="eci-input"
        placeholder="一行：与主角或他人的关系、身份。与主弹窗一致。"
      />
      <label class="eci-label">角色简介（必填）</label>
      <textarea
        v-model="form.addCharacterDescription"
        class="eci-textarea eci-textarea--recruit"
        rows="3"
        placeholder="几句小传、气质与关键词、职业或剧情钩子等。与主弹窗一致；填写后在大弹窗内点「AI生成」或「正文输出角色」。"
      />
      <p class="eci-hint">新增角色为弹窗内招募，确认后仅复制到酒馆输入框、不直写 MVU；「编辑暂存」开启时本条不入队。</p>
    </template>

    <template v-else-if="modalType === 'add_world_rule' || modalType === 'edit_world_rule'">
      <label class="eci-label">规则名称</label>
      <input v-model="form.worldRuleName" type="text" class="eci-input" />
      <label class="eci-label">规则细节</label>
      <textarea v-model="form.worldRuleDetail" class="eci-textarea" rows="4" />
    </template>

    <template v-else-if="modalType === 'add_region'">
      <label class="eci-label">区域名称</label>
      <input v-model="form.regionName" type="text" class="eci-input" />
      <label class="eci-label">首条细分规则名称</label>
      <input v-model="form.regionFirstRuleName" type="text" class="eci-input" />
      <label class="eci-label">区域描述 / 规则细节</label>
      <textarea v-model="form.regionDetail" class="eci-textarea" rows="4" />
    </template>

    <template v-else-if="modalType === 'edit_region'">
      <label class="eci-label">区域名称</label>
      <input v-model="form.regionName" type="text" class="eci-input" />
      <label class="eci-label">规则细节</label>
      <textarea v-model="form.regionDetail" class="eci-textarea" rows="4" />
    </template>

    <template v-else-if="modalType === 'add_region_rule' || modalType === 'edit_region_rule'">
      <label class="eci-label">所属区域（只读）</label>
      <input v-model="form.regionName" type="text" class="eci-input" disabled />
      <label class="eci-label">规则名称</label>
      <input v-model="form.regionRuleName" type="text" class="eci-input" />
      <label class="eci-label">规则细节</label>
      <textarea v-model="form.regionRuleDetail" class="eci-textarea" rows="4" />
    </template>

    <template v-else-if="modalType === 'add_personal_rule' || modalType === 'edit_personal_rule'">
      <label class="eci-label">对象（角色名）</label>
      <PersonalRuleCharacterPicker
        v-model="form.personalRuleCharacter"
        select-class="eci-input"
        input-class="eci-input"
      />
      <label class="eci-label">规则名字</label>
      <input v-model="form.personalRuleName" type="text" class="eci-input" placeholder="输入本条个人规则的名称" />
      <label class="eci-label">规则细节</label>
      <textarea v-model="form.personalRuleDetail" class="eci-textarea" rows="4" />
    </template>

    <template v-else-if="modalType === 'edit_character_mind'">
      <label class="eci-label">当前内心想法</label>
      <textarea v-model="form.characterPsychThought" class="eci-textarea eci-textarea--thought-min" rows="2" />
      <label class="eci-label">性格（每行一条，默认可拉高一格）</label>
      <textarea v-model="form.characterPsychTraits" class="eci-textarea eci-textarea--traits-min" rows="1" />
      <h4 class="ecf-mind-hobby-title">爱好</h4>
      <div
        v-for="(row, hidx) in form.characterPsychHobbyRows"
        :key="'ecf-psych-hb-' + hidx"
        class="ecf-detail-row ecf-bg-hobby-row"
      >
        <input v-model="row.name" type="text" class="eci-input" placeholder="爱好标签名" />
        <input v-model.number="row.level" type="number" class="eci-input eci-input-level" min="0" max="10" />
        <input v-model="row.reason" type="text" class="eci-input" placeholder="喜欢的原因" />
        <button type="button" class="ecf-icon-btn" @click="form.characterPsychHobbyRows.splice(hidx, 1)">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <button type="button" class="ecf-add-btn" @click="form.characterPsychHobbyRows.push({ name: '', level: 1, reason: '' })">
        + 爱好
      </button>
    </template>

    <template v-else-if="modalType === 'edit_character_fetish'">
      <label class="eci-label">敏感点开发（每行一条）</label>
      <textarea v-model="form.characterPsychSensitiveParts" class="eci-textarea" rows="3" />
      <label class="eci-label">性癖（每行一条）</label>
      <textarea v-model="form.characterPsychFetishes" class="eci-textarea" rows="3" />
      <label class="eci-label">隐藏性癖</label>
      <textarea v-model="form.characterPsychHiddenFetish" class="eci-textarea" rows="2" />

      <details class="ecf-details">
        <summary>敏感点开发详情（等级 / 反应 / 开发细节）</summary>
        <div
          v-for="(part, idx) in form.sensitivePartDetails"
          :key="'sp-' + idx"
          class="ecf-detail-block"
        >
          <div class="ecf-detail-row">
            <input v-model="part.name" type="text" class="eci-input" placeholder="部位名称" />
            <button type="button" class="ecf-icon-btn" @click="form.sensitivePartDetails.splice(idx, 1)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <input v-model.number="part.level" type="number" min="1" max="10" class="eci-input" />
          <input v-model="part.reaction" type="text" class="eci-input" placeholder="生理反应" />
          <textarea v-model="part.devDetails" class="eci-textarea" rows="2" placeholder="开发细节" />
        </div>
        <button
          type="button"
          class="ecf-add-btn"
          @click="form.sensitivePartDetails.push({ name: '', level: 1, reaction: '', devDetails: '' })"
        >
          + 添加敏感点
        </button>
      </details>

      <details class="ecf-details">
        <summary>性癖详情（等级 / 描述 / 合理化）</summary>
        <div
          v-for="(f, idx) in form.fetishDetails"
          :key="'f-' + idx"
          class="ecf-detail-block"
        >
          <div class="ecf-detail-row">
            <input v-model="f.name" type="text" class="eci-input" placeholder="性癖名称" />
            <button type="button" class="ecf-icon-btn" @click="form.fetishDetails.splice(idx, 1)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <input v-model.number="f.level" type="number" min="1" max="10" class="eci-input" />
          <input v-model="f.description" type="text" class="eci-input" placeholder="细节描述" />
          <textarea v-model="f.justification" class="eci-textarea" rows="2" placeholder="自我合理化" />
        </div>
        <button
          type="button"
          class="ecf-add-btn"
          @click="form.fetishDetails.push({ name: '', level: 1, description: '', justification: '' })"
        >
          + 添加性癖
        </button>
      </details>
    </template>

    <template v-else-if="modalType === 'edit_avatar'">
      <p class="eci-hint">填写图片 URL 或 data URL；提交后写入本机缓存。</p>
      <textarea v-model="form.avatarUrl" class="eci-textarea" rows="3" placeholder="https:// 或 data:image/..." />
    </template>

    <template v-else-if="showAppearanceCart">
      <p class="eci-hint">{{ appearanceCartHint }}</p>
      <details v-if="appearanceCartShowGarments" class="ecf-details" open>
        <summary>服装（槽位 · 名字 · 状态 · 描述）</summary>
        <div
          v-for="(gr, gidx) in form.appearanceBodyGarmentRows"
          :key="'bg-' + gidx"
          class="ecf-detail-block"
        >
          <div class="ecf-detail-row">
            <select v-model="gr.slot" class="eci-input" aria-label="槽位">
              <option v-for="sk in appearanceSlotKeys" :key="'sk-' + sk" :value="sk">{{ sk }}</option>
            </select>
            <button type="button" class="ecf-icon-btn" @click="form.appearanceBodyGarmentRows.splice(gidx, 1)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <input v-model="gr.name" type="text" class="eci-input" placeholder="服装名（键）" />
          <input v-model="gr.状态" type="text" class="eci-input" placeholder="状态" />
          <input v-model="gr.描述" type="text" class="eci-input eci-input-desc-narrow" placeholder="描述" />
        </div>
        <button
          type="button"
          class="ecf-add-btn"
          @click="
            form.appearanceBodyGarmentRows.push({
              slot: appearanceSlotKeys[0],
              name: '',
              状态: '正常',
              描述: '',
            })
          "
        >
          + 服装条目
        </button>
      </details>
      <details v-if="appearanceCartShowJewelry" class="ecf-details" :open="appearanceCartSlice === 'jewelry'">
        <summary>饰品（名字 · 部位 · 描述）</summary>
        <div
          v-for="(jw, jidx) in form.appearanceJewelryRows"
          :key="'jw-' + jidx"
          class="ecf-detail-row ecf-jewelry-detail-row"
        >
          <input v-model="jw.name" type="text" class="eci-input" placeholder="名字" aria-label="饰品名字" />
          <input v-model="jw.部位" type="text" class="eci-input" placeholder="部位" aria-label="饰品部位" />
          <input v-model="jw.描述" type="text" class="eci-input eci-input-desc-narrow" placeholder="描述" aria-label="饰品描述" />
          <button type="button" class="ecf-icon-btn" @click="form.appearanceJewelryRows.splice(jidx, 1)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <button
          type="button"
          class="ecf-add-btn"
          @click="form.appearanceJewelryRows.push({ name: '', 部位: '', 描述: '' })"
        >
          + 饰品
        </button>
      </details>
      <details v-if="appearanceCartShowBody" class="ecf-details" :open="appearanceCartSlice === 'body'">
        <summary>身体部位物理状态</summary>
        <div
          v-for="(bp, bpidx) in form.appearanceBodyPartRows"
          :key="'bp-' + bpidx"
          class="ecf-detail-block"
        >
          <div class="ecf-detail-row">
            <input v-model="bp.key" type="text" class="eci-input" placeholder="部位名" />
            <button type="button" class="ecf-icon-btn" @click="form.appearanceBodyPartRows.splice(bpidx, 1)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <input v-model="bp.外观描述" type="text" class="eci-input eci-input-desc-narrow" placeholder="外观描述" />
          <input v-model="bp.当前状态" type="text" class="eci-input eci-input-desc-narrow" placeholder="当前状态" />
        </div>
        <button
          type="button"
          class="ecf-add-btn"
          @click="form.appearanceBodyPartRows.push({ key: '', 外观描述: '', 当前状态: '' })"
        >
          + 身体部位
        </button>
      </details>
    </template>

    <template v-else-if="modalType === 'edit_character_background_archive'">
      <div class="ecf-bg-archive">
        <section class="ecf-bg-archive-section">
          <h4 class="ecf-bg-archive-section__title">角色简介</h4>
          <textarea v-model="form.backgroundCharacterIntro" class="eci-textarea eci-textarea--intro" rows="4" placeholder="一整段背景或简介" />
        </section>
        <section class="ecf-bg-archive-section">
          <h4 class="ecf-bg-archive-section__title">代表性发言</h4>
          <div
            v-for="(row, sidx) in form.backgroundSpeechRows"
            :key="'ecf-sp-' + sidx"
            class="ecf-detail-row ecf-bg-speech-row"
          >
            <input v-model="row.context" type="text" class="eci-input" placeholder="场景或语境标识" />
            <input v-model="row.line" type="text" class="eci-input" placeholder="台词" />
            <button type="button" class="ecf-icon-btn" @click="form.backgroundSpeechRows.splice(sidx, 1)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <button type="button" class="ecf-add-btn" @click="form.backgroundSpeechRows.push({ context: '', line: '' })">
            + 发言
          </button>
        </section>
      </div>
    </template>

    <template v-else-if="modalType === 'edit_identity_tags'">
      <div
        v-for="(tag, idx) in form.identityTags"
        :key="'tag-' + idx"
        class="ecf-detail-row"
      >
        <input v-model="tag.category" type="text" class="eci-input" placeholder="分类" />
        <input v-model="tag.value" type="text" class="eci-input" placeholder="内容" />
        <button type="button" class="ecf-icon-btn" @click="form.identityTags.splice(idx, 1)">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <button type="button" class="ecf-add-btn" @click="form.identityTags.push({ category: '', value: '' })">
        + 添加标签
      </button>
    </template>

    <template v-else>
      <p class="eci-hint">未提供该类型的快速编辑表单：<code>{{ modalType }}</code></p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EditCartModalForm } from '../types/editCart';
import { CLOTHING_BODY_SLOT_KEYS } from '../types';
import PersonalRuleCharacterPicker from './PersonalRuleCharacterPicker.vue';

const props = defineProps<{
  modalType: string;
  form: EditCartModalForm;
}>();

const appearanceSlotKeys = CLOTHING_BODY_SLOT_KEYS;

function appearanceCartSliceFromType(t: string): 'full' | 'clothing' | 'jewelry' | 'body' | null {
  if (t === 'edit_character_appearance') return 'full';
  if (t === 'edit_character_clothing') return 'clothing';
  if (t === 'edit_character_jewelry') return 'jewelry';
  if (t === 'edit_character_body_physics') return 'body';
  return null;
}

const appearanceCartSlice = computed(() => appearanceCartSliceFromType(props.modalType));
const showAppearanceCart = computed(() => appearanceCartSlice.value != null);
const appearanceCartShowGarments = computed(
  () => appearanceCartSlice.value === 'full' || appearanceCartSlice.value === 'clothing',
);
const appearanceCartShowJewelry = computed(
  () => appearanceCartSlice.value === 'full' || appearanceCartSlice.value === 'jewelry',
);
const appearanceCartShowBody = computed(
  () => appearanceCartSlice.value === 'full' || appearanceCartSlice.value === 'body',
);
const appearanceCartHint = computed(() => {
  switch (appearanceCartSlice.value) {
    case 'full':
      return '身体槽下多件服装（服装名为 MVU 键）；与主弹窗一致。';
    case 'clothing':
      return '仅编辑服装槽位；暂存提交时会保留当前饰品与身体部位。';
    case 'jewelry':
      return '仅编辑饰品；提交时会保留当前槽位服装与身体部位。';
    case 'body':
      return '仅编辑身体部位物理状态；提交时会保留当前服装与饰品。';
    default:
      return '';
  }
});
</script>

<style scoped lang="scss">
.ecf {
  font-size: 14px;
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
  margin-bottom: 4px;
}

.eci-textarea {
  resize: vertical;
}

.eci-input-desc-narrow {
  max-width: 22rem;
}

.eci-textarea--intro {
  min-height: 5rem;
  max-height: min(36vh, 220px);
  resize: vertical;
}

.eci-textarea--traits-min {
  min-height: 2.25rem;
  max-height: min(50vh, 20rem);
  resize: vertical;
}

.eci-textarea--thought-min {
  min-height: calc(2 * 1.4em + 0.8rem);
  line-height: 1.4;
  max-height: min(50vh, 20rem);
}

.ecf-mind-hobby-title {
  margin: 8px 0 4px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.eci-input-level {
  flex: 0 0 4.25rem;
  max-width: 4.5rem;
}

.ecf-bg-speech-row,
.ecf-bg-hobby-row {
  flex-wrap: wrap;
}

.ecf-bg-archive {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ecf-bg-archive-section {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);

  &__title {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .ecf-add-btn {
    margin-top: 6px;
  }
}

.eci-textarea--recruit {
  min-height: 0;
  max-height: min(42vh, 320px);
}

.ecf-details {
  margin-top: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px;
}

.ecf-details summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.ecf-detail-block {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.ecf-detail-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;

  .eci-input {
    flex: 1;
  }
}

.ecf-jewelry-detail-row {
  flex-wrap: wrap;

  .eci-input {
    flex: 1 1 22%;
    min-width: 4.5rem;
  }
}

.ecf-icon-btn {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: transparent;
  color: #f87171;
  cursor: pointer;
}

.ecf-add-btn {
  margin-top: 8px;
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid rgba(59, 130, 246, 0.5);
  background: transparent;
  color: #60a5fa;
  cursor: pointer;
}
</style>
