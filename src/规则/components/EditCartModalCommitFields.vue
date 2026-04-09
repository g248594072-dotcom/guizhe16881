<template>
  <div class="ecf">
    <!-- 新增角色 -->
    <template v-if="modalType === 'add_character'">
      <label class="eci-label">角色名字</label>
      <input v-model="form.addCharacterName" type="text" class="eci-input" />
      <label class="eci-label">简单描述</label>
      <textarea v-model="form.addCharacterDescription" class="eci-textarea" rows="5" />
      <p class="eci-hint">提交购物车后只发消息，不预写档案；角色在 AI 写入变量后出现。</p>
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
      <label class="eci-label">规则细节</label>
      <textarea v-model="form.personalRuleDetail" class="eci-textarea" rows="4" />
    </template>

    <template v-else-if="modalType === 'edit_character_mind'">
      <label class="eci-label">当前内心想法</label>
      <textarea v-model="form.characterPsychThought" class="eci-textarea" rows="3" />
      <label class="eci-label">性格（每行一条）</label>
      <textarea v-model="form.characterPsychTraits" class="eci-textarea" rows="3" />
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

    <template v-else-if="modalType === 'edit_character_appearance'">
      <p class="eci-hint">服装槽位与身体部位物理状态（与主弹窗一致）。</p>
      <div
        v-for="slotKey in appearanceSlotKeys"
        :key="slotKey"
        class="ecf-detail-block"
      >
        <div class="eci-label">{{ slotKey }}</div>
        <input
          v-model="form.appearanceClothing[slotKey].名称"
          type="text"
          class="eci-input"
          placeholder="名称"
        />
        <input
          v-model="form.appearanceClothing[slotKey].状态"
          type="text"
          class="eci-input"
          placeholder="状态"
        />
        <textarea
          v-model="form.appearanceClothing[slotKey].描述"
          class="eci-textarea"
          rows="2"
          placeholder="描述"
        />
      </div>
      <details class="ecf-details">
        <summary>饰品</summary>
        <div
          v-for="(jw, jidx) in form.appearanceJewelryRows"
          :key="'jw-' + jidx"
          class="ecf-detail-row"
        >
          <input v-model="jw.name" type="text" class="eci-input" placeholder="名称" />
          <input v-model="jw.状态" type="text" class="eci-input" placeholder="状态" />
          <input v-model="jw.描述" type="text" class="eci-input" placeholder="描述" />
          <button type="button" class="ecf-icon-btn" @click="form.appearanceJewelryRows.splice(jidx, 1)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <button
          type="button"
          class="ecf-add-btn"
          @click="form.appearanceJewelryRows.push({ name: '', 状态: '正常', 描述: '' })"
        >
          + 饰品
        </button>
      </details>
      <details class="ecf-details">
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
          <textarea v-model="bp.外观描述" class="eci-textarea" rows="2" placeholder="外观描述" />
          <textarea v-model="bp.当前状态" class="eci-textarea" rows="2" placeholder="当前状态" />
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
import type { EditCartModalForm } from '../types/editCart';
import PersonalRuleCharacterPicker from './PersonalRuleCharacterPicker.vue';

defineProps<{
  modalType: string;
  form: EditCartModalForm;
}>();

const appearanceSlotKeys = ['上装', '下装', '内衣', '足部'] as const;
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
