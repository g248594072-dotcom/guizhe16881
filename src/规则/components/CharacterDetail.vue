<template>
  <section id="panel-character-detail" class="character-detail">
    <!-- 编辑模式：左上角绿色编辑完成，右上角红色取消 -->
    <div v-if="isEditingBasic" class="edit-mode-bar">
      <button type="button" class="btn-complete" @click="onFinishEditBasic">
        <i class="fa-solid fa-check"></i>
        <span>编辑完成</span>
      </button>
      <button type="button" class="btn-cancel" @click="cancelEditBasic">
        <i class="fa-solid fa-xmark"></i>
        <span>取消</span>
      </button>
    </div>

    <button class="back-btn" @click="$emit('back')">
      <i class="fa-solid fa-arrow-left"></i>
      <span>返回角色列表</span>
    </button>

    <!-- Header Profile：大屏为「头像 | 姓名+元数据 + 操作列」，避免侧栏窄时姓名被压成竖排 -->
    <div class="profile-header">
      <div
        id="btn-edit-avatar"
        class="avatar-edit"
        @click="!isEditingBasic && $emit('openModal', 'edit_avatar', { characterId })"
      >
        <img v-if="displayAvatarSrc" class="avatar-face" :src="displayAvatarSrc" alt="" />
        <i v-else class="fa-solid fa-user"></i>
        <div class="edit-overlay">
          <i class="fa-solid fa-pen"></i>
        </div>
      </div>
      <div class="profile-main">
        <div class="profile-info">
          <div class="name-row">
            <template v-if="isEditingBasic">
              <input v-model="editForm.name" type="text" class="edit-name-input" placeholder="姓名" />
            </template>
            <template v-else>
              <h2>{{ name }}</h2>
            </template>
          </div>
          <p class="meta">ID: {{ characterId }} | 状态: {{ characterStatusText }}</p>
        </div>
        <div v-if="!isEditingBasic" class="header-actions">
          <button id="btn-delete-character" class="delete-btn" @click="onDeleteCharacter">
            <i class="fa-solid fa-trash"></i>
            <span>删除角色</span>
          </button>
          <button id="btn-edit-basic" class="edit-btn" @click="startEditBasic">
            <i class="fa-solid fa-pen"></i>
            <span>编辑基础信息</span>
          </button>
        </div>
      </div>
    </div>

    <div class="detail-grid">
      <!-- Basic Stats -->
      <article class="detail-card" :class="{ 'cyber-card': isDarkMode }">
        <div class="card-title">
          <i class="fa-solid fa-chart-line"></i>
          <h3>生理指标</h3>
        </div>
        <div v-if="isEditingBasic" class="stats-list edit-stats">
          <div class="stat-row edit">
            <span class="label">年龄</span>
            <input v-model="editForm.age" type="text" class="edit-value" placeholder="如 17 岁" />
          </div>
          <div class="stat-row edit">
            <span class="label">身高</span>
            <input v-model="editForm.height" type="text" class="edit-value" placeholder="如 165 cm" />
          </div>
          <div class="stat-row edit">
            <span class="label">体重</span>
            <input v-model="editForm.weight" type="text" class="edit-value" placeholder="如 48 kg" />
          </div>
          <div class="stat-row edit">
            <span class="label">三围</span>
            <input v-model="editForm.threeSize" type="text" class="edit-value" placeholder="如 B88 W58 H89" />
          </div>
          <div class="stat-row edit">
            <span class="label">体质</span>
            <input v-model="editForm.physique" type="text" class="edit-value" placeholder="如 敏感型" />
          </div>
          <div class="stat-row edit">
            <span class="label">好感度</span>
            <input v-model.number="editForm.affection" type="number" class="edit-value" min="-100" max="100" />
          </div>
          <div class="stat-row edit">
            <span class="label">发情值</span>
            <input v-model.number="editForm.lust" type="number" class="edit-value" min="0" max="100" />
          </div>
          <div class="stat-row edit">
            <span class="label">性癖开发值</span>
            <input v-model.number="editForm.fetish" type="number" class="edit-value" min="0" max="100" />
          </div>
        </div>
        <template v-else>
          <div class="stats-list">
            <StatRow label="年龄" :value="displayAge" />
            <StatRow label="身高" :value="displayHeight" />
            <StatRow label="体重" :value="displayWeight" />
            <StatRow label="三围" :value="displayThreeSize" />
            <StatRow label="体质" :value="displayPhysique" />
          </div>
          <div class="stat-bars">
            <StatBar
              label="好感度 AFFECTION"
              :value="affectionValueLabel"
              :percentage="affectionBarPercent"
              accent="cyan"
            />
            <StatBar
              label="发情值 LUST"
              :value="`${displayLust}/100`"
              :percentage="lustBarPercent"
              accent="magenta"
            />
            <StatBar
              label="性癖开发值 FETISH"
              :value="`${displayFetish}/100`"
              :percentage="displayFetish"
              accent="purple"
            />
          </div>
          <div class="physiology-summary">
            <span class="section-label">当前综合生理描述</span>
            <p class="thought-text">
              {{ displayPhysiologicalDesc }}
            </p>
          </div>
        </template>
      </article>

      <!-- Psychology -->
      <article class="detail-card" :class="{ 'cyber-card': isDarkMode }">
        <div class="card-title">
          <i class="fa-solid fa-brain"></i>
          <h3>心理状态</h3>
          <button
            type="button"
            class="edit-mini-btn"
            @click="$emit('openModal', 'edit_character_mind', { characterId })"
          >
            编辑
          </button>
        </div>
        <div class="psych-content">
          <div class="thought-section">
            <span class="section-label">当前想法</span>
            <p class="thought-text">
              {{ displayThought }}
            </p>
          </div>
          <div class="traits-section">
            <span class="section-label">性格特征</span>
            <div class="badges">
              <template v-if="displayTraits.length > 0">
                <Badge
                  v-for="(t, idx) in displayTraits"
                  :key="`${t}-${idx}`"
                  :text="String(t)"
                  :highlight="idx === 0"
                />
              </template>
              <template v-else>
                <span class="empty-hint">暂无</span>
              </template>
            </div>
          </div>
        </div>
      </article>

      <!-- 位置与参与活动（MVU 角色档案：当前位置 / 参与活动记录） -->
      <article class="detail-card" :class="{ 'cyber-card': isDarkMode }">
        <div class="card-title">
          <i class="fa-solid fa-location-crosshairs"></i>
          <h3>位置与参与活动</h3>
        </div>
        <div class="location-participation-block">
          <div v-if="locationLine !== '—'" class="detail-row">
            <span class="detail-label">区域 / 建筑 / 活动</span>
            <span class="detail-value">{{ locationLine }}</span>
          </div>
          <div v-if="locationBehaviorDescription" class="detail-row">
            <span class="detail-label">当前行为</span>
            <span class="detail-value">{{ locationBehaviorDescription }}</span>
          </div>
          <div v-if="buildingOccupantsSummary" class="detail-row">
            <span class="detail-label">同建筑在场：</span>
            <span class="detail-value">{{ buildingOccupantsSummary }}</span>
          </div>
          <template v-if="participationRows.length > 0">
            <span class="section-label sub">参与活动记录</span>
            <ul class="participation-list">
              <li v-for="row in participationRows" :key="row.id">
                <strong>{{ row.activityTitle }}</strong>：{{ row.summary }}
              </li>
            </ul>
          </template>
          <p
            v-if="
              locationLine === '—' &&
              !locationBehaviorDescription &&
              !buildingOccupantsSummary &&
              participationRows.length === 0
            "
            class="empty-hint"
          >
            暂无位置与活动记录（由剧情变量写入「当前位置」「参与活动记录」后显示）
          </p>
        </div>
      </article>

      <!-- Fetishes -->
      <article class="detail-card" :class="{ 'cyber-card': isDarkMode }">
        <div class="card-title">
          <i class="fa-solid fa-heart"></i>
          <h3>性癖与敏感带</h3>
          <button
            type="button"
            class="edit-mini-btn"
            @click="$emit('openModal', 'edit_character_fetish', { characterId })"
          >
            编辑
          </button>
        </div>
        <div class="fetish-content">
          <div class="sensitive-section">
            <span class="section-label">敏感点开发</span>
            <div v-if="sensitiveChipsList.length > 0" class="fetish-chip-row">
              <button
                v-for="chip in sensitiveChipsList"
                :key="chip.name"
                type="button"
                class="fetish-chip-btn"
                :class="{ 'fetish-chip-btn--active': expandedSensitivePart === chip.name }"
                :style="mvuLevelPinkChipStyle(chip.level)"
                @click="toggleSensitivePartDetail(chip.name)"
              >
                {{ chip.name }}
              </button>
            </div>
            <div v-else class="badges">
              <template v-if="displaySensitiveParts.length > 0">
                <Badge
                  v-for="(p, idx) in displaySensitiveParts"
                  :key="`${p}-${idx}`"
                  :text="String(p)"
                  :highlight="idx === 0"
                  class="clickable-badge"
                  @click="toggleSensitivePartDetail(sensitiveBadgeKey(String(p)))"
                />
              </template>
              <template v-else>
                <span class="empty-hint">暂无</span>
              </template>
            </div>
            <!-- 敏感点开发详情展开区域 -->
            <template v-if="expandedSensitivePart">
              <div class="detail-expand-panel">
                <div class="detail-header">
                  <span class="detail-title">{{ sensitiveBadgeKey(expandedSensitivePart) }}</span>
                  <button type="button" class="close-btn" @click="expandedSensitivePart = null">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div class="detail-body">
                  <div v-if="sensitiveExpandedDetail != null" class="detail-row">
                    <span class="detail-label">敏感等级</span>
                    <span class="detail-value">{{ sensitiveExpandedDetail.level }}</span>
                  </div>
                  <div
                    v-if="
                      sensitiveExpandedDetail?.reaction != null &&
                      String(sensitiveExpandedDetail.reaction).length > 0
                    "
                    class="detail-row"
                  >
                    <span class="detail-label">生理反应</span>
                    <span class="detail-value">{{ sensitiveExpandedDetail.reaction }}</span>
                  </div>
                  <div
                    v-if="
                      sensitiveExpandedDetail?.devDetails != null &&
                      String(sensitiveExpandedDetail.devDetails).length > 0
                    "
                    class="detail-row"
                  >
                    <span class="detail-label">开发细节</span>
                    <span class="detail-value">{{ sensitiveExpandedDetail.devDetails }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div class="traits-section">
            <span class="section-label">性癖</span>
            <div v-if="fetishChipsList.length > 0" class="fetish-chip-row">
              <button
                v-for="chip in fetishChipsList"
                :key="chip.name"
                type="button"
                class="fetish-chip-btn"
                :class="{ 'fetish-chip-btn--active': expandedFetish === chip.name }"
                :style="mvuLevelPinkChipStyle(chip.level)"
                @click="toggleFetishDetail(chip.name)"
              >
                {{ chip.name }}
              </button>
            </div>
            <div v-else class="badges">
              <template v-if="displayFetishes.length > 0">
                <Badge
                  v-for="(f, idx) in displayFetishes"
                  :key="`${f}-${idx}`"
                  :text="String(f)"
                  :highlight="idx === 0"
                  class="clickable-badge"
                  @click="toggleFetishDetail(fetishBadgeKey(String(f)))"
                />
              </template>
              <template v-else>
                <span class="empty-hint">暂无</span>
              </template>
            </div>
            <!-- 性癖详情展开区域 -->
            <template v-if="expandedFetish">
              <div class="detail-expand-panel">
                <div class="detail-header">
                  <span class="detail-title">{{ expandedFetish }}</span>
                  <button type="button" class="close-btn" @click="expandedFetish = null">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div class="detail-body">
                  <div v-if="expandedFetish && getFetishDetail(expandedFetish) != null" class="detail-row">
                    <span class="detail-label">等级</span>
                    <span class="detail-value">{{ getFetishDetail(expandedFetish)!.level }}</span>
                  </div>
                  <div class="detail-row" v-if="getFetishDetail(expandedFetish)?.description">
                    <span class="detail-label">细节描述</span>
                    <span class="detail-value">{{ getFetishDetail(expandedFetish)?.description }}</span>
                  </div>
                  <div class="detail-row" v-if="getFetishDetail(expandedFetish)?.justification">
                    <span class="detail-label">自我合理化</span>
                    <span class="detail-value">{{ getFetishDetail(expandedFetish)?.justification }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div class="hidden-fetish">
            <span class="section-label">隐藏性癖</span>
            <p>{{ displayHiddenFetish }}</p>
          </div>
        </div>
      </article>

      <!-- 服装与身体状态：紧挨「性癖与敏感带」，与身份标签同屏出现（双列时一般在性癖右侧） -->
      <article
        id="panel-character-appearance"
        class="detail-card character-appearance-card"
        :class="{ 'cyber-card': isDarkMode }"
      >
        <div class="card-title">
          <i class="fa-solid fa-shirt"></i>
          <h3>服装与身体状态</h3>
          <button
            type="button"
            class="edit-mini-btn"
            @click="$emit('openModal', 'edit_character_appearance', { characterId })"
          >
            编辑
          </button>
        </div>
        <div class="appearance-content">
          <div class="appearance-block">
            <span class="section-label">服装槽位</span>
            <p class="clothing-slot-hint">
              每槽可多件，<strong>服装名</strong>为 MVU 对象键（<code>服装状态.&lt;槽位&gt;.&lt;服装名&gt;</code>）；点服装名编辑，或点「添加」。
            </p>
            <div class="clothing-slot-stack">
              <div
                v-for="slotKey in appearanceSlotKeys"
                :key="'slot-' + slotKey"
                class="clothing-slot-block clothing-slot-block--group"
              >
                <div class="clothing-slot-group-head">
                  <span class="clothing-slot-section-title">{{ slotKey }}</span>
                  <button type="button" class="clothing-add-chip" @click="openBodyGarmentEditor(slotKey, null)">
                    + 添加
                  </button>
                </div>
                <div v-if="bodyGarmentEntriesForSlot(slotKey).length" class="clothing-slot-stack clothing-slot-stack--nested">
                  <div
                    v-for="row in bodyGarmentEntriesForSlot(slotKey)"
                    :key="slotKey + '-' + row.name"
                    class="clothing-slot-block clothing-slot-block--nested"
                  >
                    <button type="button" class="clothing-slot-btn" @click="openBodyGarmentEditor(slotKey, row.name)">
                      {{ row.name }}
                    </button>
                    <div class="clothing-slot-detail">
                      <div class="clothing-meta-row">
                        <span class="meta-k">状态</span>
                        <span class="meta-v">{{ row.状态 }}</span>
                      </div>
                      <div v-if="row.描述" class="clothing-meta-row">
                        <span class="meta-k">描述</span>
                        <span class="meta-v">{{ row.描述 }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span v-else class="empty-hint clothing-slot-empty">暂无</span>
              </div>
            </div>
            <span class="section-label sub">饰品</span>
            <p class="clothing-slot-hint">每件饰品单独按钮编辑，对应 <code>服装状态.饰品.&lt;名字&gt;</code>。</p>
            <div v-if="jewelryEntries.length > 0" class="clothing-slot-stack">
              <div v-for="jw in jewelryEntries" :key="'jw-' + jw.name" class="clothing-slot-block clothing-slot-block--jewelry">
                <button type="button" class="clothing-slot-btn" @click="openJewelryItemEditor(jw.name)">
                  {{ jw.name }}
                </button>
                <div class="clothing-slot-detail">
                  <span class="clothing-name-tag">{{ jewelryTagTitle(jw.name, jw) }}</span>
                  <div class="clothing-meta-row">
                    <span class="meta-k">状态</span>
                    <span class="meta-v">{{ jw.状态 }}</span>
                  </div>
                  <div v-if="jw.描述" class="clothing-meta-row">
                    <span class="meta-k">描述</span>
                    <span class="meta-v">{{ jw.描述 }}</span>
                  </div>
                </div>
              </div>
            </div>
            <span v-else class="empty-hint">暂无饰品（点某件饰品名或顶部「编辑」添加）</span>
          </div>
          <div class="appearance-block">
            <span class="section-label">身体部位物理状态</span>
            <div v-if="bodyPartBadgeLines.length > 0" class="body-part-rows">
              <div
                v-for="line in bodyPartBadgeLines"
                :key="'bp-' + line"
                class="body-part-row-wrap"
              >
                <button
                  type="button"
                  class="body-part-line"
                  :class="{
                    'is-expanded': expandedBodyPart === line,
                    'is-updated': bodyPartUpdatedHighlight[line],
                  }"
                  @click="toggleBodyPartExpand(line)"
                >
                  <span class="body-part-name">{{ line }}</span>
                </button>
                <div
                  v-if="expandedBodyPart === line"
                  class="detail-expand-panel body-part-detail-panel"
                >
                  <div class="detail-header">
                    <span class="detail-title">{{ line }}</span>
                    <button type="button" class="close-btn" @click="expandedBodyPart = null">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <div class="detail-body">
                    <div v-if="getBodyPartPhysics(line)?.外观描述" class="detail-row">
                      <span class="detail-label">外观描述</span>
                      <span class="detail-value">{{ getBodyPartPhysics(line)?.外观描述 }}</span>
                    </div>
                    <div v-if="getBodyPartPhysics(line)?.当前状态" class="detail-row">
                      <span class="detail-label">当前状态</span>
                      <span class="detail-value">{{ getBodyPartPhysics(line)?.当前状态 }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span v-else class="empty-hint">暂无（点「编辑」添加部位）</span>
          </div>
        </div>
      </article>

      <!-- Identity Tags -->
      <article class="detail-card identity-tags-card" :class="{ 'cyber-card': isDarkMode }">
        <div class="card-title">
          <i class="fa-solid fa-tags"></i>
          <h3>身份标签</h3>
          <button
            type="button"
            class="edit-mini-btn"
            @click="$emit('openModal', 'edit_identity_tags', { characterId })"
          >
            编辑
          </button>
        </div>
        <div class="identity-content">
          <template v-if="displayIdentityTags.length > 0">
            <div
              v-for="(tag, idx) in displayIdentityTags"
              :key="`${tag.category}-${idx}`"
              class="identity-tag-row"
            >
              <span class="identity-category">{{ tag.category }}</span>
              <span class="identity-value">{{ tag.value }}</span>
            </div>
          </template>
          <template v-else>
            <span class="empty-hint">暂无身份标签</span>
          </template>
        </div>
      </article>

      <!-- Affected Rules（放在同一 grid 内，大屏占满列宽） -->
      <article class="rules-card" :class="{ 'cyber-card cyber-card--no-clip': isDarkMode }">
        <div class="rules-header">
          <div class="title-group">
            <i class="fa-solid fa-shield-exclamation"></i>
            <h3>当前受影响规则</h3>
          </div>
          <button id="btn-manage-rules" class="manage-btn" @click="$emit('openModal', 'manage_rules', manageRulesPayload())">
            管理规则影响
          </button>
        </div>
        <div class="rules-grid">
          <template v-if="affectedPersonalRules.length > 0">
            <div
              v-for="r in affectedPersonalRules"
              :key="r.id"
              class="personal-rule-row"
              :class="{ 'cyber-flowing-border': isDarkMode }"
            >
              <div class="rule-desc">{{ r.desc || r.title }}</div>
              <div class="rule-actions">
                <button
                  type="button"
                  class="action edit"
                  title="编辑"
                  @click="$emit('openModal', 'edit_personal_rule', personalRulePayload(r))"
                >
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button
                  type="button"
                  class="action archive"
                  title="归档"
                  @click="$emit('openModal', 'archive_personal_rule', personalRulePayload(r))"
                >
                  <i class="fa-solid fa-archive"></i>
                </button>
                <button
                  type="button"
                  class="action delete"
                  title="删除"
                  @click="$emit('openModal', 'delete_personal_rule', personalRulePayload(r))"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="empty-hint">暂无个人规则影响</div>
          </template>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.css';
import type {
  ActivityParticipationRecordZh,
  CharacterData,
  CharacterLocationZh,
  ClothingBodySlotKeyZh,
  ClothingStateZh,
  JewelryItemZh,
  RuleData,
} from '../types';
import { CLOTHING_BODY_SLOT_KEYS } from '../types';
import StatRow from './StatRow.vue';
import StatBar from './StatBar.vue';
import Badge from './Badge.vue';
import { useCharacters, useDataStore, usePersonalRules } from '../store';
import {
  loadCharacterAvatarOverrides,
  PHONE_CHARACTER_AVATARS_CHANGED,
  resolveCharacterAvatarFromBrowserOnly,
} from '../../shared/phoneCharacterAvatarStorage';
import {
  buildCharacterBasicItem,
  buildDeleteCharacterItem,
  isEditCartEnabled,
  stageItem,
} from '../utils/editCartFlow';
import { tagFieldToBadgeLines } from '../utils/tagMap';
import { clothingStateFromMvuRaw } from '../utils/dialogAndVariable';
import { formatMvuBuildingOccupantsLine } from '../utils/mvuOccupantValue';
import { getRulesMergedStatSnapshotForDisplay } from '../utils/rulesMvuDisplaySnapshot';

const props = defineProps<{
  characterId: string;
  isDarkMode?: boolean;
}>();

const isDarkMode = computed(() => !!props.isDarkMode);

const dataStore = useDataStore();
const displayLocation = ref<CharacterLocationZh>({});
const participationMap = ref<Record<string, ActivityParticipationRecordZh>>({});

/** 与 store 同规则从 `getVariables` 拉平合并后的快照，专供本卡名称类只读展示 */
const mergedDisplayStat = computed(() => {
  void dataStore.data.角色档案;
  void dataStore.data.区域数据;
  void dataStore.data.建筑数据;
  void dataStore.data.活动数据;
  void dataStore.data.区域规则;
  void dataStore.data.元信息?.最近更新时间;
  return getRulesMergedStatSnapshotForDisplay();
});

/** 与名称解析同源：从合并快照取当前角色的「当前位置」「参与活动记录」 */
function getCharacterRecordFromSnap(
  snap: Record<string, unknown>,
  characterId: string,
): Record<string, unknown> | undefined {
  const chars = snap['角色档案'] as Record<string, unknown> | undefined;
  const raw = chars?.[characterId];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return undefined;
}

const locationParticipationFromSnap = computed(() => {
  const snap = mergedDisplayStat.value;
  const ch = getCharacterRecordFromSnap(snap, props.characterId);
  if (!ch) return null;
  const loc = ch['当前位置'];
  if (loc == null || typeof loc !== 'object' || Array.isArray(loc)) return null;
  const o = loc as Record<string, unknown>;
  const prRaw = ch['参与活动记录'];
  const 参与活动记录: Record<string, ActivityParticipationRecordZh> =
    prRaw != null && typeof prRaw === 'object' && !Array.isArray(prRaw)
      ? { ...(prRaw as Record<string, ActivityParticipationRecordZh>) }
      : {};
  return {
    区域ID: String(o['区域ID'] ?? '').trim(),
    建筑ID: String(o['建筑ID'] ?? '').trim(),
    活动ID: String(o['活动ID'] ?? '').trim(),
    当前行为描述: String(o['当前行为描述'] ?? '').trim(),
    参与活动记录,
  };
});

const locationBehaviorDescription = computed(() => {
  const fromSnap = locationParticipationFromSnap.value;
  if (fromSnap?.当前行为描述) return fromSnap.当前行为描述;
  return String(displayLocation.value.当前行为描述 ?? '').trim();
});

function resolveMvuRegionDisplayName(snap: Record<string, unknown>, regionId: string): string {
  const id = regionId.trim();
  if (!id) return '';
  const map = snap['区域数据'] as Record<string, unknown> | undefined;
  const r = map?.[id] as Record<string, unknown> | undefined;
  let name = String(r?.['名称'] ?? '').trim();
  if (!name) {
    const rules = snap['区域规则'] as Record<string, unknown> | undefined;
    const rr = rules?.[id] as Record<string, unknown> | undefined;
    name = String(rr?.['名称'] ?? '').trim();
  }
  return name || id;
}

function resolveMvuBuildingDisplayName(snap: Record<string, unknown>, buildingId: string): string {
  const id = buildingId.trim();
  if (!id) return '';
  const map = snap['建筑数据'] as Record<string, unknown> | undefined;
  const r = map?.[id] as Record<string, unknown> | undefined;
  const name = String(r?.['名称'] ?? '').trim();
  return name || id;
}

function resolveMvuActivityDisplayName(snap: Record<string, unknown>, activityId: string): string {
  const id = activityId.trim();
  if (!id) return '';
  const map = snap['活动数据'] as Record<string, unknown> | undefined;
  const r = map?.[id] as Record<string, unknown> | undefined;
  const name = String(r?.['活动名称'] ?? '').trim();
  return name || id;
}

/**
 * 对应酒馆提示词里的 `{{user}}`：当前聊天用户显示名以 `SillyTavern.name1` 为准（随人设/用户资料变更），
 * 再回退 MVU `元信息.玩家名称`、`player.name`。
 */
function resolvePlayerDisplayNameForUi(snap: Record<string, unknown>): string {
  const st = String(SillyTavern?.name1 ?? '').trim();
  if (st) return st;
  const meta = snap['元信息'] as Record<string, unknown> | undefined;
  const fromMeta = String(meta?.['玩家名称'] ?? '').trim();
  if (fromMeta) return fromMeta;
  const pl = snap['player'] as Record<string, unknown> | undefined;
  const fromPlayer = String(pl?.['name'] ?? '').trim();
  if (fromPlayer) return fromPlayer;
  return '玩家';
}

/** 轻量轮询：人设改名后 `name1` 会变，触发「同建筑在场」等重算 */
const stUserNameDisplayRev = ref(0);
let lastStUserNameForPoll = '';
const { pause: pauseStUserNamePoll } = useIntervalFn(
  () => {
    const n = String(SillyTavern?.name1 ?? '').trim();
    if (n !== lastStUserNameForPoll) {
      lastStUserNameForPoll = n;
      stUserNameDisplayRev.value += 1;
    }
  },
  1500,
  { immediate: true },
);
onUnmounted(() => pauseStUserNamePoll());

/** `当前角色` 的键可为 CHR-ID 或文字标签；`玩家` 对应酒馆 `{{user}}` 显示为当前用户显示名 */
function resolveMvuOccupantKeyDisplay(snap: Record<string, unknown>, key: string): string {
  const k = key.trim();
  if (!k) return '';
  const lower = k.toLowerCase();
  if (k === '玩家' || lower === 'player') return resolvePlayerDisplayNameForUi(snap);
  const chars = snap['角色档案'] as Record<string, unknown> | undefined;
  const raw = chars?.[k];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const zh = String(o['姓名'] ?? '').trim();
    if (zh && zh !== '未知') return zh;
    const en = String((o as { name?: unknown }).name ?? '').trim();
    if (en) return en;
  }
  return k;
}

watch(
  () => dataStore.data.角色档案?.[props.characterId],
  raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      displayLocation.value = {};
      participationMap.value = {};
      return;
    }
    const loc = (raw as Record<string, unknown>).当前位置;
    if (loc && typeof loc === 'object' && !Array.isArray(loc)) {
      const o = loc as Record<string, unknown>;
      displayLocation.value = {
        区域ID: String(o['区域ID'] ?? '').trim(),
        建筑ID: String(o['建筑ID'] ?? '').trim(),
        活动ID: String(o['活动ID'] ?? '').trim(),
        当前行为描述: String(o['当前行为描述'] ?? '').trim(),
      };
    } else {
      displayLocation.value = {};
    }
    const pr = (raw as Record<string, unknown>).参与活动记录;
    if (pr && typeof pr === 'object' && !Array.isArray(pr)) {
      participationMap.value = { ...(pr as Record<string, ActivityParticipationRecordZh>) };
    } else {
      participationMap.value = {};
    }
  },
  { deep: true, immediate: true },
);

const locationLine = computed(() => {
  const snap = mergedDisplayStat.value;
  const fromSnap = locationParticipationFromSnap.value;
  const a = fromSnap ?? {
    区域ID: displayLocation.value.区域ID,
    建筑ID: displayLocation.value.建筑ID,
    活动ID: displayLocation.value.活动ID,
  };
  const parts: string[] = [];
  const r = String(a.区域ID ?? '').trim();
  const b = String(a.建筑ID ?? '').trim();
  const act = String(a.活动ID ?? '').trim();
  if (r) parts.push(resolveMvuRegionDisplayName(snap, r));
  if (b) parts.push(resolveMvuBuildingDisplayName(snap, b));
  if (act) parts.push(resolveMvuActivityDisplayName(snap, act));
  return parts.length > 0 ? parts.join(' / ') : '—';
});

const participationRows = computed(() => {
  const snap = mergedDisplayStat.value;
  const fromSnap = locationParticipationFromSnap.value;
  const map =
    fromSnap && Object.keys(fromSnap.参与活动记录).length > 0
      ? fromSnap.参与活动记录
      : participationMap.value;
  return Object.entries(map).map(([id, rec]) => ({
    id,
    activityTitle: resolveMvuActivityDisplayName(snap, id),
    summary: [
      rec.开始时间 && `起 ${rec.开始时间}`,
      rec.结束时间 && `止 ${rec.结束时间}`,
      rec.参与程度 && `程度：${rec.参与程度}`,
    ]
      .filter(Boolean)
      .join('；') || '（无起止与程度字段）',
  }));
});

/** 自 MVU「建筑数据.<建筑ID>.当前角色」读取在场标识（兼容 true / "在场" / 1） */
const buildingOccupantsSummary = computed(() => {
  void stUserNameDisplayRev.value;
  const snap = mergedDisplayStat.value;
  const fromSnap = locationParticipationFromSnap.value;
  const bid = String(fromSnap?.建筑ID ?? displayLocation.value.建筑ID ?? '').trim();
  if (!bid) return '';
  const buildings = snap['建筑数据'] as Record<string, unknown> | undefined;
  const b = buildings?.[bid] as Record<string, unknown> | undefined;
  const cur = b?.['当前角色'];
  return formatMvuBuildingOccupantsLine(
    cur != null && typeof cur === 'object' && !Array.isArray(cur) ? (cur as Record<string, unknown>) : undefined,
    key => resolveMvuOccupantKeyDisplay(snap, key),
  );
});

const avatarStorageRev = ref(0);
function onBrowserAvatarStorageChange() {
  avatarStorageRev.value += 1;
}

const defaultName = computed(() => '未知');

const appearanceSlotKeys = CLOTHING_BODY_SLOT_KEYS;

const currentExtra = ref<{
  currentThought?: string;
  traits?: string[];
  fetishes?: string[];
  sensitiveParts?: string[];
  hiddenFetish?: string;
  physiologicalDesc?: string;
  fetishDetails?: Record<string, { level: number; description: string; justification: string }>;
  sensitivePartDetails?: Record<string, { level: number; reaction: string; devDetails: string }>;
  identityTags?: Record<string, string>;
  clothingState?: ClothingStateZh;
  bodyPartPhysics?: Record<string, { 外观描述?: string; 当前状态?: string }>;
}>({});

const expandedBodyPart = ref<string | null>(null);

/** 身体部位变量自上次快照以来有变更时，对应按钮用绿色边框提示 */
const bodyPartUpdatedHighlight = ref<Record<string, boolean>>({});
const bodyPartLastSerialized = ref<Record<string, string>>({});
const bodyPartDiffPrimed = ref(false);

function serializeBodyPartEntry(v: unknown): string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return '{"外观描述":"","当前状态":""}';
  const o = v as Record<string, unknown>;
  return JSON.stringify({
    外观描述: String(o['外观描述'] ?? ''),
    当前状态: String(o['当前状态'] ?? ''),
  });
}

watch(
  () => props.characterId,
  () => {
    bodyPartUpdatedHighlight.value = {};
    bodyPartLastSerialized.value = {};
    bodyPartDiffPrimed.value = false;
  },
);

watch(
  () => {
    const raw = dataStore.data.角色档案?.[props.characterId];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const bp = (raw as Record<string, unknown>)['身体部位物理状态'];
    if (!bp || typeof bp !== 'object' || Array.isArray(bp)) return undefined;
    return bp as Record<string, { 外观描述?: string; 当前状态?: string }>;
  },
  (bp) => {
    const next = bp && typeof bp === 'object' ? { ...bp } : {};
    const serialized: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) {
      const nk = String(k).trim();
      if (!nk) continue;
      serialized[nk] = serializeBodyPartEntry(v);
    }

    currentExtra.value = {
      ...currentExtra.value,
      bodyPartPhysics: next,
    };

    if (!bodyPartDiffPrimed.value) {
      bodyPartLastSerialized.value = { ...serialized };
      bodyPartDiffPrimed.value = true;
      return;
    }

    const prev = bodyPartLastSerialized.value;
    const prevHadKeys = Object.keys(prev).some(key => prev[key] !== undefined);
    const nextHasKeys = Object.keys(serialized).length > 0;
    if (!prevHadKeys && nextHasKeys) {
      bodyPartLastSerialized.value = { ...serialized };
      return;
    }

    const flags = { ...bodyPartUpdatedHighlight.value };
    const expanded = expandedBodyPart.value;
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(serialized)]);
    for (const k of allKeys) {
      const a = prev[k];
      const b = serialized[k];
      if (a === b) continue;
      if (b !== undefined) {
        if (expanded !== k) {
          flags[k] = true;
        } else {
          delete flags[k];
        }
      } else {
        delete flags[k];
      }
    }
    bodyPartUpdatedHighlight.value = flags;
    bodyPartLastSerialized.value = { ...serialized };
  },
  { deep: true, immediate: true },
);

// 展开的性癖详情
const expandedFetish = ref<string | null>(null);
const expandedSensitivePart = ref<string | null>(null);

function toggleFetishDetail(fetishName: string) {
  if (expandedFetish.value === fetishName) {
    expandedFetish.value = null;
  } else {
    expandedFetish.value = fetishName;
    expandedSensitivePart.value = null;
    expandedBodyPart.value = null;
  }
}

function toggleSensitivePartDetail(partName: string) {
  if (expandedSensitivePart.value === partName) {
    expandedSensitivePart.value = null;
  } else {
    expandedSensitivePart.value = partName;
    expandedFetish.value = null;
    expandedBodyPart.value = null;
  }
}

function toggleBodyPartExpand(partName: string) {
  if (expandedBodyPart.value === partName) {
    expandedBodyPart.value = null;
  } else {
    expandedBodyPart.value = partName;
    expandedFetish.value = null;
    expandedSensitivePart.value = null;
    const h = { ...bodyPartUpdatedHighlight.value };
    delete h[partName];
    bodyPartUpdatedHighlight.value = h;
  }
}

function getBodyPartPhysics(name: string) {
  return currentExtra.value.bodyPartPhysics?.[name];
}

function bodyGarmentEntriesForSlot(slotKey: ClothingBodySlotKeyZh): Array<{ name: string; 状态: string; 描述: string }> {
  const rec = currentExtra.value.clothingState?.[slotKey];
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

const jewelryEntries = computed(() => {
  const acc = currentExtra.value.clothingState?.饰品;
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

function jewelryTagTitle(name: string, row: { 部位: string }): string {
  const p = String(row.部位 ?? '').trim();
  return p ? `${name}（${p}）` : name;
}

async function openBodyGarmentEditor(slotKey: ClothingBodySlotKeyZh, itemName: string | null) {
  const { tryRulesMvuWritable } = await import('../store');
  if (!tryRulesMvuWritable()) return;
  const existing = itemName != null && String(itemName).trim() !== '';
  const nm0 = existing ? String(itemName).trim() : '';
  const row = existing ? bodyGarmentEntriesForSlot(slotKey).find(r => r.name === nm0) : undefined;
  const status0 = row?.状态 ?? '正常';
  const desc0 = row?.描述 ?? '';
  const baseId = `th-cloth-${Math.random().toString(36).slice(2, 10)}`;
  const result = await Swal.fire({
    title: existing ? `编辑「${slotKey}」·${nm0}` : `添加「${slotKey}」`,
    html: `<div class="th-swal-cloth-form" style="text-align:left">
      <p style="font-size:12px;color:#64748b;margin:0 0 12px">写入 MVU <b>服装状态.${slotKey}.${existing ? nm0 : '〈服装名〉'}</b>（服装名为对象键）</p>
      ${
        existing
          ? ''
          : `<label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">服装名</label>
      <input id="${baseId}-n" type="text" class="swal2-input" style="margin:0 0 10px;width:100%;box-sizing:border-box" placeholder="如：白衬衫">`
      }
      <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">状态</label>
      <input id="${baseId}-s" type="text" class="swal2-input" style="margin:0 0 10px;width:100%;box-sizing:border-box" placeholder="如：正常">
      <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">描述</label>
      <textarea id="${baseId}-d" class="swal2-textarea" rows="3" style="width:100%;box-sizing:border-box;margin:0" placeholder="外观或穿着描述"></textarea>
    </div>`,
    width: 520,
    showCancelButton: true,
    showDenyButton: existing,
    confirmButtonText: '保存',
    denyButtonText: '移除',
    cancelButtonText: '取消',
    focusConfirm: false,
    didOpen: () => {
      if (!existing) {
        const n = document.getElementById(`${baseId}-n`) as HTMLInputElement | null;
        if (n) n.value = '';
      }
      const s = document.getElementById(`${baseId}-s`) as HTMLInputElement | null;
      const d = document.getElementById(`${baseId}-d`) as HTMLTextAreaElement | null;
      if (s) s.value = status0;
      if (d) d.value = desc0;
    },
    preConfirm: () => {
      const n = document.getElementById(`${baseId}-n`) as HTMLInputElement | null;
      const s = document.getElementById(`${baseId}-s`) as HTMLInputElement | null;
      const d = document.getElementById(`${baseId}-d`) as HTMLTextAreaElement | null;
      const nameNew = existing ? nm0 : (n?.value ?? '').trim();
      if (!nameNew) {
        Swal.showValidationMessage('请填写服装名');
        return false;
      }
      return {
        garmentName: nameNew,
        状态: (s?.value ?? '正常').trim() || '正常',
        描述: (d?.value ?? '').trim(),
      };
    },
  });
  const { patchCharacterClothingBodyGarment, removeCharacterClothingBodyGarment } = await import('../utils/dialogAndVariable');
  if (result.isDenied && existing) {
    removeCharacterClothingBodyGarment(props.characterId, slotKey, nm0);
    return;
  }
  if (!result.isConfirmed || !result.value) return;
  const v = result.value as { garmentName: string; 状态: string; 描述: string };
  patchCharacterClothingBodyGarment(props.characterId, slotKey, v.garmentName, {
    状态: v.状态,
    描述: v.描述,
  });
}

async function openJewelryItemEditor(itemName: string) {
  const { tryRulesMvuWritable } = await import('../store');
  if (!tryRulesMvuWritable()) return;
  const nm = String(itemName ?? '').trim();
  if (!nm) return;
  const o = currentExtra.value.clothingState?.饰品?.[nm] ?? {};
  const part0 = String(o.部位 ?? '');
  const status0 = String(o.状态 ?? '正常');
  const desc0 = String(o.描述 ?? '');
  const baseId = `th-jw-${Math.random().toString(36).slice(2, 10)}`;
  const result = await Swal.fire({
    title: `编辑饰品「${nm}」`,
    html: `<div class="th-swal-cloth-form" style="text-align:left">
      <p style="font-size:12px;color:#64748b;margin:0 0 12px">写入 MVU <b>服装状态.饰品.${nm}</b>（名字为键，不可在此改名；改名请用顶部「编辑」）</p>
      <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">部位</label>
      <input id="${baseId}-p" type="text" class="swal2-input" style="margin:0 0 10px;width:100%;box-sizing:border-box" placeholder="如：手腕">
      <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">状态</label>
      <input id="${baseId}-s" type="text" class="swal2-input" style="margin:0 0 10px;width:100%;box-sizing:border-box" placeholder="如：正常">
      <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">描述</label>
      <textarea id="${baseId}-d" class="swal2-textarea" rows="3" style="width:100%;box-sizing:border-box;margin:0" placeholder="外观或佩戴方式"></textarea>
    </div>`,
    width: 520,
    showCancelButton: true,
    confirmButtonText: '保存',
    cancelButtonText: '取消',
    focusConfirm: false,
    didOpen: () => {
      const p = document.getElementById(`${baseId}-p`) as HTMLInputElement | null;
      const s = document.getElementById(`${baseId}-s`) as HTMLInputElement | null;
      const d = document.getElementById(`${baseId}-d`) as HTMLTextAreaElement | null;
      if (p) p.value = part0;
      if (s) s.value = status0;
      if (d) d.value = desc0;
    },
    preConfirm: () => {
      const p = document.getElementById(`${baseId}-p`) as HTMLInputElement | null;
      const s = document.getElementById(`${baseId}-s`) as HTMLInputElement | null;
      const d = document.getElementById(`${baseId}-d`) as HTMLTextAreaElement | null;
      return {
        部位: (p?.value ?? '').trim(),
        状态: (s?.value ?? '正常').trim() || '正常',
        描述: (d?.value ?? '').trim(),
      };
    },
  });
  if (!result.isConfirmed || !result.value) return;
  const { patchCharacterJewelryItem } = await import('../utils/dialogAndVariable');
  patchCharacterJewelryItem(props.characterId, nm, result.value);
}

const bodyPartBadgeLines = computed(() => {
  const m = currentExtra.value.bodyPartPhysics;
  if (!m || typeof m !== 'object') return [];
  return Object.keys(m).map(k => String(k).trim()).filter(Boolean);
});

function getFetishDetail(name: string) {
  return currentExtra.value.fetishDetails?.[name];
}

function getSensitivePartDetail(name: string) {
  return currentExtra.value.sensitivePartDetails?.[name];
}

/** Badge 文案形如「部位：Lv.x …」，取键名供详情展开 */
function sensitiveBadgeKey(line: string) {
  const m = String(line).match(/^([^：]+)/);
  return m ? m[1].trim() : String(line).trim();
}

const sensitiveExpandedDetail = computed(() => {
  const k = expandedSensitivePart.value;
  if (!k) return null;
  return getSensitivePartDetail(sensitiveBadgeKey(k)) ?? null;
});

const displayIdentityTags = computed(() => {
  const tags = currentExtra.value.identityTags;
  if (!tags || typeof tags !== 'object') return [];
  return Object.entries(tags)
    .filter(([_, value]) => typeof value === 'string' && value.trim())
    .map(([category, value]) => ({ category, value: String(value) }));
});

const affectedPersonalRules = ref<RuleData[]>([]);

const savedForm = ref({
  name: defaultName.value,
  age: '未知',
  height: '未知',
  weight: '未知',
  threeSize: 'B88 W58 H89',
  physique: '未知',
  affection: 0,
  lust: 0,
  fetish: 0,
});
watch(defaultName, (v) => { savedForm.value.name = v; }, { immediate: true });

const name = computed(() => savedForm.value.name || defaultName.value);

const displayAvatarSrc = computed(() => {
  void avatarStorageRev.value;
  void name.value;
  return resolveCharacterAvatarFromBrowserOnly(
    props.characterId,
    loadCharacterAvatarOverrides(),
    name.value,
  );
});

const displayAge = computed(() => savedForm.value.age);
const displayHeight = computed(() => savedForm.value.height);
const displayWeight = computed(() => savedForm.value.weight);
const displayThreeSize = computed(() => savedForm.value.threeSize);
const displayPhysique = computed(() => savedForm.value.physique);
const displayAffection = computed(() => savedForm.value.affection);
const displayLust = computed(() => savedForm.value.lust);
const displayFetish = computed(() => savedForm.value.fetish);

const affectionBarPercent = computed(() => {
  const a = Number(displayAffection.value);
  if (!Number.isFinite(a)) return 50;
  return Math.min(100, Math.max(0, ((a + 100) / 200) * 100));
});

const affectionValueLabel = computed(() => `${displayAffection.value} (−100~100)`);

const lustBarPercent = computed(() => {
  const v = Number(displayLust.value);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
});

const isEditingBasic = ref(false);
const editForm = ref({ ...savedForm.value });

const displayThought = computed(() => {
  const v = currentExtra.value.currentThought;
  if (typeof v === 'string' && v.trim().length > 0) return v;
  return '暂无';
});
const displayTraits = computed(() => tagFieldToBadgeLines(currentExtra.value.traits));
const displayFetishes = computed(() => tagFieldToBadgeLines(currentExtra.value.fetishes, 'fetish'));

/** 有结构化 `fetishDetails` 时：一名称一按钮（等级 0–10 控制白→粉配色） */
const fetishChipsList = computed(() => {
  const fd = currentExtra.value.fetishDetails;
  if (!fd || typeof fd !== 'object') return [];
  return Object.entries(fd)
    .filter(([name]) => String(name).trim().length > 0)
    .map(([name, d]) => ({
      name,
      level: Math.min(10, Math.max(0, Math.round(Number(d?.level) || 0))),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
});

/** Badge 行「名称：Lv…」取名称，供旧数据展开 */
function fetishBadgeKey(line: string) {
  const m = String(line).match(/^([^：:]+)[：:]/);
  return m ? m[1].trim() : String(line).trim();
}

/** 性癖等级 / 敏感等级共用：0 偏白 → 10 偏粉 */
function mvuLevelPinkChipStyle(level: number): Record<string, string> {
  const t = Math.min(10, Math.max(0, Math.round(Number(level) || 0))) / 10;
  const r = Math.round(244 + (251 - 244) * t);
  const g = Math.round(244 + (207 - 244) * t);
  const b = Math.round(245 + (232 - 245) * t);
  const color = t > 0.5 ? '#9d174d' : '#27272a';
  const border = `1px solid rgba(244, 114, 182, ${0.2 + t * 0.55})`;
  return {
    background: `rgb(${r}, ${g}, ${b})`,
    color,
    border,
  };
}

const displaySensitiveParts = computed(() => tagFieldToBadgeLines(currentExtra.value.sensitiveParts, 'sensitive'));

/** 有结构化 `sensitivePartDetails` 时：部位名按钮，敏感等级 0–10 控制白→粉 */
const sensitiveChipsList = computed(() => {
  const sd = currentExtra.value.sensitivePartDetails;
  if (!sd || typeof sd !== 'object') return [];
  return Object.entries(sd)
    .filter(([name]) => String(name).trim().length > 0)
    .map(([name, d]) => ({
      name,
      level: Math.min(10, Math.max(0, Math.round(Number(d?.level) || 0))),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
});
const displayHiddenFetish = computed(() => {
  const v = currentExtra.value.hiddenFetish;
  if (typeof v === 'string' && v.trim().length > 0) return v;
  return '暂无';
});

const displayPhysiologicalDesc = computed(() => {
  const v = currentExtra.value.physiologicalDesc;
  if (typeof v === 'string' && v.trim().length > 0) return v;
  return '暂无（由剧情与数值跨阶变化时更新）';
});
const characterStatusText = ref('出场中');

const allPersonalRules = usePersonalRules();

function refreshAffectedPersonalRulesForCharacter(characterNameForMatch: string) {
  try {
    const idMatch = props.characterId;
    const nameMatch = characterNameForMatch;
    affectedPersonalRules.value = (allPersonalRules.value || []).filter((r: any) => {
      const t = r?.target;
      if (!t) return false;
      return t === idMatch || t === nameMatch;
    });
  } catch (e) {
    console.warn('加载个人规则失败', e);
    affectedPersonalRules.value = [];
  }
}

onMounted(() => {
  window.addEventListener(PHONE_CHARACTER_AVATARS_CHANGED, onBrowserAvatarStorageChange);
  try {
    const characters = useCharacters();

    // 使用 watch 监听数据变化
    const unwatch = watch(characters, (list) => {
      if (!list || list.length === 0) return;

      const current = list.find((c) => c.id === props.characterId);
      if (!current) return;

      {
        const n = String(current.name ?? '').trim();
        savedForm.value.name = n && n !== '未知' && n !== '未命名' ? n : (current.id || defaultName.value);
      }

      const basic = (current as any).basic || {};
      if (basic.age) savedForm.value.age = basic.age;
      if (basic.height) savedForm.value.height = basic.height;
      if (basic.weight) savedForm.value.weight = basic.weight;
      if (basic.threeSize) savedForm.value.threeSize = basic.threeSize;
      if (basic.physique) savedForm.value.physique = basic.physique;

      const stats = (current as any).stats || {};
      if (typeof stats.affection === 'number') savedForm.value.affection = stats.affection;
      if (typeof stats.lust === 'number') savedForm.value.lust = stats.lust;
      if (typeof stats.fetish === 'number') savedForm.value.fetish = stats.fetish;

      currentExtra.value = {
        currentThought: (current as any).currentThought,
        traits: (current as any).traits,
        fetishes: (current as any).fetishes,
        sensitiveParts: (current as any).sensitiveParts,
        hiddenFetish: (current as any).hiddenFetish,
        physiologicalDesc: (current as any).currentPhysiologicalDesc,
        fetishDetails: (current as any).fetishDetails || {},
        sensitivePartDetails: (current as any).sensitivePartDetails || {},
        identityTags: (current as any).identityTags || {},
        clothingState: clothingStateFromMvuRaw((current as any).服装状态),
        bodyPartPhysics: (current as any).身体部位物理状态 || {},
      };
      characterStatusText.value = (current as any).status === 'active' ? '出场中' : '暂时退场';

      refreshAffectedPersonalRulesForCharacter(String(current.name ?? ''));

      editForm.value = { ...savedForm.value };

      // 数据已加载，停止监听（须 nextTick：immediate 首次回调同步执行时 const unwatch 尚未完成赋值）
      nextTick(() => {
        unwatch();
      });
    }, { immediate: true });
  } catch (e) {
    console.warn('加载角色数据失败', e);
  }
});

onUnmounted(() => {
  window.removeEventListener(PHONE_CHARACTER_AVATARS_CHANGED, onBrowserAvatarStorageChange);
});

// 与个人规则管理一致：变量变更后刷新本角色受影响列表（编辑/归档后）
watch(
  allPersonalRules,
  () => {
    refreshAffectedPersonalRulesForCharacter(String(name.value || ''));
  },
  { deep: true },
);

/** 与「个人规则管理」分组 key 一致，用于跳转并展开对应折叠组 */
function manageRulesPayload(): Record<string, any> {
  const first = affectedPersonalRules.value[0];
  const expandGroupName = (first?.target && String(first.target)) || name.value || props.characterId;
  return {
    characterId: props.characterId,
    characterName: name.value,
    expandGroupName,
  };
}

/** 与个人规则管理面板 PersonalRulesPanel.rulePayload 一致，供编辑/删除弹窗使用 */
function personalRulePayload(rule: RuleData): Record<string, any> {
  const groupName = rule.target || name.value || props.characterId;
  const target = String(rule.target ?? '').trim() || groupName;
  return {
    id: rule.id,
    title: rule.title,
    character: groupName,
    target,
    ruleName: rule.ruleName ?? '',
    desc: rule.desc,
  };
}

function startEditBasic() {
  editForm.value = { ...savedForm.value };
  isEditingBasic.value = true;
}

function cancelEditBasic() {
  isEditingBasic.value = false;
}

async function onFinishEditBasic() {
  try {
    const data = {
      name: editForm.value.name,
      age: editForm.value.age,
      height: editForm.value.height,
      weight: editForm.value.weight,
      threeSize: editForm.value.threeSize,
      physique: editForm.value.physique,
      affection: typeof editForm.value.affection === 'number' ? editForm.value.affection : parseInt(String(editForm.value.affection), 10) || 0,
      lust: typeof editForm.value.lust === 'number' ? editForm.value.lust : parseInt(String(editForm.value.lust), 10) || 0,
      fetish: typeof editForm.value.fetish === 'number' ? editForm.value.fetish : parseInt(String(editForm.value.fetish), 10) || 0,
    };
    if (isEditCartEnabled()) {
      stageItem(buildCharacterBasicItem(props.characterId, data, name.value));
      Object.assign(savedForm.value, editForm.value);
      isEditingBasic.value = false;
      return;
    }
    const { submitEditCharacterBasic } = await import('../utils/dialogAndVariable');
    const messageText = await submitEditCharacterBasic(props.characterId, data);
    Object.assign(savedForm.value, editForm.value);
    isEditingBasic.value = false;
    if (messageText) emit('copyToInput', messageText);
  } catch (e) {
    console.error('提交编辑失败', e);
  }
}

async function onDeleteCharacter() {
  const safeName = String(name.value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const result = await Swal.fire({
    title: '确认删除角色？',
    html: `即将删除角色「<strong>${safeName}</strong>」及其所有相关数据（包括个人规则、头像缓存等），<br>此操作<strong>不可恢复</strong>。`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  });

  if (!result.isConfirmed) return;

  try {
    if (isEditCartEnabled()) {
      stageItem(buildDeleteCharacterItem(props.characterId, name.value));
      return;
    }
    const { submitDeleteCharacter } = await import('../utils/dialogAndVariable');
    const messageText = await submitDeleteCharacter(props.characterId, name.value);

    emit('back');
    if (messageText) emit('copyToInput', messageText);
  } catch (e) {
    console.error('删除角色失败', e);
    toastr.error('删除失败，请查看控制台');
  }
}

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'openModal', type: string, payload?: Record<string, any>): void;
  (e: 'copyToInput', text: string): void;
}>();
</script>

<style lang="scss" scoped>
.character-detail {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-bottom: 80px;
  width: 100%;
  max-width: 1400px;
  margin-inline: auto;
  box-sizing: border-box;
}

.location-participation-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.participation-list {
  margin: 0.35rem 0 0;
  padding-left: 1.15rem;
  font-size: 0.9rem;
  line-height: 1.55;
}

.edit-mode-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .btn-complete {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    background: #22c55e;
    color: #fff;

    &:hover { background: #16a34a; }
  }

  .btn-cancel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    background: #ef4444;
    color: #fff;

    &:hover { background: #dc2626; }
  }
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #a1a1aa;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
  width: fit-content;

  &:hover {
    color: #fff;
  }
}

:global(.light) .back-btn:hover {
  color: #18181b;
}

.profile-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 20px;

  @media (max-width: 639px) {
    flex-direction: column;
    align-items: center;
    text-align: center;

    .profile-main {
      align-items: center;
    }

    .profile-info .name-row {
      justify-content: center;
    }

    .header-actions {
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
    }
  }

  .avatar-edit {
    width: 128px;
    height: 128px;
    flex-shrink: 0;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.02);

    .avatar-face {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    i {
      font-size: 48px;
      color: #52525b;
      transition: transform 0.5s ease;
    }

    &:hover i {
      transform: scale(1.1);
    }

    .edit-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      transition: opacity 0.3s;

      i {
        font-size: 20px;
        color: #fff;
        transform: none;
      }
    }

    &:hover .edit-overlay {
      opacity: 1;
    }
  }

  // 始终纵向：姓名 → 元数据 → 按钮行，避免大屏下与按钮并排导致文字区被 flex 压成「一字一行」
  .profile-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    align-self: stretch;
    gap: 14px;
    padding-top: 4px;
  }

  .profile-info {
    width: 100%;
    min-width: 0;

    .name-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      h2 {
        font-size: clamp(1.5rem, 2.5vw, 2.25rem);
        font-weight: 700;
        letter-spacing: 0.02em;
        color: #fff;
        word-break: keep-all;
        overflow-wrap: break-word;
        line-height: 1.2;
        font-family: ui-sans-serif, system-ui, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      }
    }

    .meta {
      font-size: 14px;
      color: #a1a1aa;
      font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
      white-space: normal;
      word-break: normal;
      overflow-wrap: anywhere;
      line-height: 1.5;
    }
  }
}

@media (min-width: 1100px) {
  .profile-header .avatar-edit {
    width: 144px;
    height: 144px;
    border-radius: 18px;
  }
}

:global(.light) .profile-header {
  .avatar-edit {
    border-color: rgba(0, 0, 0, 0.1);
    background: #f4f4f5;
  }

  .profile-info .name-row h2 {
    color: #18181b;
  }
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: #e4e4e7;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

:global(.light) .edit-btn {
  background: rgba(0, 0, 0, 0.05);
  color: #27272a;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
  align-self: flex-start;
}

.delete-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  white-space: nowrap;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
  }
}

:global(.light) .delete-btn {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;

  &:hover {
    background: rgba(239, 68, 68, 0.15);
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }

  @media (min-width: 1280px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 28px;
  }

  > .rules-card {
    @media (min-width: 768px) {
      grid-column: 1 / -1;
    }
  }

  > .identity-tags-card {
    @media (min-width: 1280px) {
      grid-column: span 2;
    }
  }
}

// 与是否挂上 .cyber-card 无关：保证深色/赛博下标题行与「编辑」同一套 flex 排版
.detail-card .card-title {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  > i {
    flex-shrink: 0;
    font-size: 20px;
    color: #d4d4d8;
  }

  > h3 {
    flex: 1;
    min-width: 0;
    font-size: 18px;
    font-weight: 500;
    color: #f4f4f5;
  }

  .edit-mini-btn {
    flex-shrink: 0;
    align-self: center;
    padding: 6px 4px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
    color: #4ade80;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.2s, filter 0.2s;
    white-space: nowrap;

    &:hover {
      color: #86efac;
    }

    &:active {
      filter: brightness(1.08);
    }
  }
}

.detail-card:not(.cyber-card) {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detail-card.cyber-card {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  border-radius: 14px;
}

:global(.light) .detail-card:not(.cyber-card) {
  border-color: rgba(0, 0, 0, 0.1);
  background: #fff;
}

:global(.light) .detail-card .card-title {
  border-bottom-color: rgba(0, 0, 0, 0.1);

  > i {
    color: #52525b;
  }

  > h3 {
    color: #18181b;
  }

  .edit-mini-btn {
    color: #16a34a;

    &:hover {
      color: #15803d;
    }
  }
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &.edit-stats .stat-row.edit {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    .label {
      font-size: 14px;
      color: #71717a;
      flex-shrink: 0;
    }

    .edit-value {
      flex: 1;
      max-width: 180px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 14px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      outline: none;
    }
  }
}

:global(.light) .stats-list.edit-stats .stat-row.edit .edit-value {
  border-color: rgba(0, 0, 0, 0.15);
  background: #fff;
  color: #18181b;
}

.edit-name-input {
  font-size: 36px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  outline: none;
  width: 100%;
  max-width: 320px;
}

:global(.light) .edit-name-input {
  border-color: rgba(0, 0, 0, 0.15);
  background: #fff;
  color: #18181b;
}

.stat-bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

:global(.light) .stat-bars {
  border-color: rgba(0, 0, 0, 0.05);
}

.physiology-summary {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);

  .section-label {
    display: block;
    font-size: 12px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }

  .thought-text {
    font-size: 14px;
    color: #d4d4d8;
    line-height: 1.6;
  }
}

:global(.light) .physiology-summary {
  border-color: rgba(0, 0, 0, 0.05);

  .thought-text {
    color: #3f3f46;
  }
}

.psych-content,
.fetish-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.thought-section {
  .section-label {
    display: block;
    font-size: 12px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }

  .thought-text {
    font-size: 14px;
    color: #d4d4d8;
    font-style: italic;
    line-height: 1.6;
  }
}

:global(.light) .thought-section .thought-text {
  color: #3f3f46;
}

.traits-section,
.sensitive-section {
  .section-label {
    display: block;
    font-size: 12px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 12px;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .fetish-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .fetish-chip-btn {
    appearance: none;
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    line-height: 1.35;
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease,
      filter 0.12s ease;

    &:hover {
      transform: translateY(-1px);
      filter: brightness(1.03);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
    }

    &:active {
      transform: translateY(0);
    }

    &--active {
      box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.65);
    }
  }
}

.empty-hint {
  font-size: 14px;
  color: #71717a;
}

.rules-grid .empty-hint {
  padding: 12px 0;
}

.hidden-fetish {
  .section-label {
    display: block;
    font-size: 12px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }

  p {
    font-size: 14px;
    color: #d4d4d8;
    line-height: 1.6;
  }
}

:global(.light) .hidden-fetish p {
  color: #3f3f46;
}

// 与 .cyber-card 无关：与上方 .detail-card .card-title 同一套顶栏逻辑（含窄屏防「一字一行」）
.rules-card .rules-header {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 24px;

  .title-group {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1 1 0%;

    > i {
      flex-shrink: 0;
      font-size: 20px;
      color: #d4d4d8;
    }

    > h3 {
      flex: 1 1 0%;
      min-width: 0;
      font-size: 18px;
      font-weight: 500;
      color: #f4f4f5;
      line-height: 1.35;
      writing-mode: horizontal-tb;
      word-break: keep-all;
      overflow-wrap: break-word;
    }
  }

  .manage-btn {
    flex-shrink: 0;
    align-self: center;
    padding: 6px 4px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
    color: #4ade80;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.2s, filter 0.2s;
    white-space: nowrap;
    text-align: right;

    &:hover {
      color: #86efac;
    }

    &:active {
      filter: brightness(1.08);
    }
  }
}

.rules-card:not(.cyber-card) {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
}

.rules-card.cyber-card {
  padding: 24px;
  border-radius: 14px;
}

/* 与 .detail-card 一致：占满网格列宽，避免父级 flex/grid 下被压成 min-content 导致标题竖排 */
.rules-card {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .rules-card .rules-header {
    flex-direction: column;
    align-items: stretch;
    flex-wrap: wrap;
    gap: 10px;

    .title-group {
      flex: none;
      width: 100%;
    }

    .manage-btn {
      align-self: flex-end;
    }
  }
}

:global(.light) .rules-card:not(.cyber-card) {
  border-color: rgba(0, 0, 0, 0.1);
  background: #fff;
}

:global(.light) .rules-card .rules-header {
  border-bottom-color: rgba(0, 0, 0, 0.1);

  .title-group {
    > i {
      color: #52525b;
    }

    > h3 {
      color: #18181b;
    }
  }

  .manage-btn {
    color: #16a34a;

    &:hover {
      color: #15803d;
    }
  }
}

.rules-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.personal-rule-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }

  .rule-desc {
    font-size: 13px;
    color: #a1a1aa;
    flex: 1;
    min-width: 0;
    margin-right: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.5;
  }

  .rule-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;

    .action {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 12px;

      &.edit {
        color: #60a5fa;
        background: rgba(96, 165, 250, 0.1);

        &:hover {
          background: rgba(96, 165, 250, 0.2);
        }
      }

      &.archive {
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);

        &:hover {
          background: rgba(245, 158, 11, 0.2);
        }
      }

      &.delete {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);

        &:hover {
          background: rgba(239, 68, 68, 0.2);
        }
      }
    }
  }
}

:global(.light) .personal-rule-row {
  border-color: rgba(0, 0, 0, 0.05);

  .rule-desc {
    color: #71717a;
  }
}

@media (max-width: 768px) {
  .personal-rule-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 0;
  }

  .personal-rule-row .rule-desc {
    margin-right: 0;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .personal-rule-row .rule-actions {
    justify-content: flex-end;
  }
}

// 可点击的徽章样式
.clickable-badge {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  }
}

// 详情展开面板
.detail-expand-panel {
  margin-top: 12px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideDown 0.2s ease-out;

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .detail-title {
      font-size: 16px;
      font-weight: 600;
      color: #f472b6;
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      color: #a1a1aa;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: rgba(239, 68, 68, 0.3);
        color: #ef4444;
      }
    }
  }

  .detail-body {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .detail-row {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .detail-label {
        font-size: 11px;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .detail-value {
        font-size: 14px;
        color: #d4d4d8;
        line-height: 1.5;
      }
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 身份标签样式
.identity-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.identity-tag-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);

  .identity-category {
    flex-shrink: 0;
    min-width: 80px;
    font-size: 12px;
    font-weight: 500;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .identity-value {
    font-size: 14px;
    color: #d4d4d8;
    line-height: 1.5;
  }
}

.appearance-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.appearance-block {
  .section-label.sub {
    display: block;
    margin-top: 12px;
    margin-bottom: 6px;
    font-size: 1.25rem;
    font-weight: 700;
    color: #f87171;
    letter-spacing: 0.02em;
  }
}

:global(.light) .appearance-block .section-label.sub {
  color: #dc2626;
}

.clothing-slot-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #71717a;
  line-height: 1.5;
}

.clothing-slot-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.clothing-slot-block--group {
  width: 100%;
}

.clothing-slot-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.clothing-slot-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #e4e4e7;
}

.clothing-add-chip {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px dashed rgba(167, 139, 250, 0.5);
  background: transparent;
  color: #d8b4fe;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: rgba(167, 139, 250, 0.85);
    background: rgba(167, 139, 250, 0.1);
  }
}

.clothing-slot-stack--nested {
  gap: 10px;
  width: 100%;
}

.clothing-slot-block--nested {
  padding: 10px 12px;
}

.clothing-slot-empty {
  margin: 0;
  font-size: 12px;
}

.clothing-slot-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.clothing-slot-btn {
  padding: 6px 14px;
  border-radius: 9999px;
  border: 1px solid rgba(167, 139, 250, 0.45);
  background: rgba(167, 139, 250, 0.12);
  color: #e9d5ff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: rgba(167, 139, 250, 0.22);
    border-color: rgba(167, 139, 250, 0.65);
  }
}

.clothing-slot-detail {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 2px;
}

.clothing-name-tag {
  display: inline-block;
  align-self: flex-start;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fce7f3;
  background: rgba(244, 114, 182, 0.18);
  border: 1px solid rgba(244, 114, 182, 0.35);
}

.clothing-meta-row {
  font-size: 13px;
  color: #d4d4d8;
  line-height: 1.55;

  .meta-k {
    display: inline-block;
    min-width: 3em;
    margin-right: 6px;
    color: #a1a1aa;
    font-size: 12px;
  }

  .meta-v {
    color: #e4e4e7;
  }
}

.clothing-slot-block--jewelry .clothing-slot-btn {
  border-color: rgba(248, 113, 113, 0.45);
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;

  &:hover {
    background: rgba(248, 113, 113, 0.2);
    border-color: rgba(248, 113, 113, 0.6);
  }
}

.body-part-rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 6px;
}

.body-part-row-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.body-part-detail-panel {
  margin-top: 0;
}

.body-part-line {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  font: inherit;
  color: inherit;

  &:hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
  }

  &.is-expanded {
    border-color: rgba(167, 139, 250, 0.5);
    background: rgba(167, 139, 250, 0.09);
  }

  &.is-updated {
    border-color: rgba(34, 197, 94, 0.65);
    background: rgba(34, 197, 94, 0.1);
  }

  &.is-expanded.is-updated {
    border-color: rgba(34, 197, 94, 0.75);
    background: rgba(34, 197, 94, 0.12);
  }
}

.body-part-name {
  font-size: 14px;
  font-weight: 600;
  color: #a78bfa;
  line-height: 1.35;
}

:global(.light) {
  .clothing-slot-hint {
    color: #71717a;
  }

  .clothing-slot-block {
    border-color: rgba(0, 0, 0, 0.08);
    background: rgba(0, 0, 0, 0.02);
  }

  .clothing-name-tag {
    color: #9d174d;
    background: rgba(244, 114, 182, 0.15);
    border-color: rgba(244, 114, 182, 0.35);
  }

  .clothing-meta-row {
    color: #3f3f46;

    .meta-k {
      color: #71717a;
    }

    .meta-v {
      color: #27272a;
    }
  }

  .body-part-line {
    border-color: rgba(0, 0, 0, 0.1);
    background: rgba(0, 0, 0, 0.02);

    &:hover {
      border-color: rgba(0, 0, 0, 0.14);
      background: rgba(0, 0, 0, 0.04);
    }

    &.is-expanded {
      border-color: rgba(124, 58, 237, 0.35);
      background: rgba(124, 58, 237, 0.06);
    }

    &.is-updated {
      border-color: rgba(22, 163, 74, 0.55);
      background: rgba(22, 163, 74, 0.08);
    }

    &.is-expanded.is-updated {
      border-color: rgba(21, 128, 61, 0.6);
      background: rgba(22, 163, 74, 0.1);
    }
  }

  .body-part-name {
    color: #7c3aed;
  }

  .detail-expand-panel {
    background: rgba(0, 0, 0, 0.03);
    border-color: rgba(0, 0, 0, 0.1);

    .detail-header {
      border-color: rgba(0, 0, 0, 0.1);

      .detail-title {
        color: #db2777;
      }

      .close-btn:hover {
        background: rgba(239, 68, 68, 0.15);
        color: #dc2626;
      }
    }

    .detail-body .detail-row {
      .detail-label {
        color: #71717a;
      }
      .detail-value {
        color: #3f3f46;
      }
    }
  }

  .identity-tag-row {
    background: rgba(0, 0, 0, 0.02);
    border-color: rgba(0, 0, 0, 0.08);

    .identity-category {
      color: #7c3aed;
    }

    .identity-value {
      color: #3f3f46;
    }
  }

  .clickable-badge:hover {
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  }
}
</style>
