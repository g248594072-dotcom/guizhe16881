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

    <!-- Header Profile -->
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
            <span class="section-label">敏感部位</span>
            <div class="badges">
              <template v-if="displaySensitiveParts.length > 0">
                <Badge
                  v-for="(p, idx) in displaySensitiveParts"
                  :key="`${p}-${idx}`"
                  :text="String(p)"
                  :highlight="idx === 0"
                  class="clickable-badge"
                  @click="toggleSensitivePartDetail(String(p))"
                />
              </template>
              <template v-else>
                <span class="empty-hint">暂无</span>
              </template>
            </div>
            <!-- 敏感部位详情展开区域 -->
            <template v-if="expandedSensitivePart">
              <div class="detail-expand-panel">
                <div class="detail-header">
                  <span class="detail-title">{{ expandedSensitivePart }}</span>
                  <button type="button" class="close-btn" @click="expandedSensitivePart = null">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div class="detail-body">
                  <div class="detail-row" v-if="getSensitivePartDetail(expandedSensitivePart)?.level">
                    <span class="detail-label">敏感等级</span>
                    <span class="detail-value">{{ getSensitivePartDetail(expandedSensitivePart)?.level }}</span>
                  </div>
                  <div class="detail-row" v-if="getSensitivePartDetail(expandedSensitivePart)?.reaction">
                    <span class="detail-label">生理反应</span>
                    <span class="detail-value">{{ getSensitivePartDetail(expandedSensitivePart)?.reaction }}</span>
                  </div>
                  <div class="detail-row" v-if="getSensitivePartDetail(expandedSensitivePart)?.devDetails">
                    <span class="detail-label">开发细节</span>
                    <span class="detail-value">{{ getSensitivePartDetail(expandedSensitivePart)?.devDetails }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div class="traits-section">
            <span class="section-label">性癖</span>
            <div class="badges">
              <template v-if="displayFetishes.length > 0">
                <Badge
                  v-for="(f, idx) in displayFetishes"
                  :key="`${f}-${idx}`"
                  :text="String(f)"
                  :highlight="idx === 0"
                  class="clickable-badge"
                  @click="toggleFetishDetail(String(f))"
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
                  <div class="detail-row" v-if="getFetishDetail(expandedFetish)?.level">
                    <span class="detail-label">等级</span>
                    <span class="detail-value">{{ getFetishDetail(expandedFetish)?.level }}</span>
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

      <!-- Identity Tags -->
      <article class="detail-card" :class="{ 'cyber-card': isDarkMode }">
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
    </div>

    <!-- Affected Rules -->
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
                @click="onArchivePersonalRule(r)"
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
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.css';
import type { CharacterData, RuleData } from '../types';
import StatRow from './StatRow.vue';
import StatBar from './StatBar.vue';
import Badge from './Badge.vue';
import { useCharacters, usePersonalRules } from '../store';
import {
  loadCharacterAvatarOverrides,
  PHONE_CHARACTER_AVATARS_CHANGED,
  resolveCharacterAvatarFromBrowserOnly,
} from '../../shared/phoneCharacterAvatarStorage';
import {
  buildArchivePersonalItem,
  buildCharacterBasicItem,
  buildDeleteCharacterItem,
  isEditCartEnabled,
  stageItem,
} from '../utils/editCartFlow';
import { tagFieldToBadgeLines } from '../utils/tagMap';

const props = defineProps<{
  characterId: string;
  isDarkMode?: boolean;
}>();

const isDarkMode = computed(() => !!props.isDarkMode);

const avatarStorageRev = ref(0);
function onBrowserAvatarStorageChange() {
  avatarStorageRev.value += 1;
}

const defaultName = computed(() => '未知');

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
}>({});

// 展开的性癖详情
const expandedFetish = ref<string | null>(null);
const expandedSensitivePart = ref<string | null>(null);

function toggleFetishDetail(fetishName: string) {
  if (expandedFetish.value === fetishName) {
    expandedFetish.value = null;
  } else {
    expandedFetish.value = fetishName;
    expandedSensitivePart.value = null; // 关闭其他展开
  }
}

function toggleSensitivePartDetail(partName: string) {
  if (expandedSensitivePart.value === partName) {
    expandedSensitivePart.value = null;
  } else {
    expandedSensitivePart.value = partName;
    expandedFetish.value = null; // 关闭其他展开
  }
}

function getFetishDetail(name: string) {
  return currentExtra.value.fetishDetails?.[name];
}

function getSensitivePartDetail(name: string) {
  return currentExtra.value.sensitivePartDetails?.[name];
}

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
const displaySensitiveParts = computed(() => tagFieldToBadgeLines(currentExtra.value.sensitiveParts, 'sensitive'));
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
  return {
    id: rule.id,
    title: rule.title,
    character: groupName,
    desc: rule.desc,
  };
}

function ruleSummary(rule: RuleData): string {
  if (rule.title && rule.title !== (rule as any).target) return rule.title;
  const d = (rule.desc || '').trim();
  return d.length > 40 ? d.slice(0, 40) + '…' : d || '（无描述）';
}

async function onArchivePersonalRule(rule: RuleData) {
  const groupName = rule.target || name.value || props.characterId;
  const summary = ruleSummary(rule);
  if (isEditCartEnabled()) {
    stageItem(
      buildArchivePersonalItem(rule.id, groupName, summary, `归档个人规则：${rule.title || groupName}`),
    );
    return;
  }
  const { submitArchivePersonalRule } = await import('../utils/dialogAndVariable');
  await submitArchivePersonalRule(rule.id, groupName, summary);
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
  align-items: flex-end;
  gap: 24px;

  .avatar-edit {
    width: 128px;
    height: 128px;
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

  .profile-info {
    flex: 1;
    padding-bottom: 8px;

    .name-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      h2 {
        font-size: 36px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #fff;
      }
    }

    .meta {
      font-size: 14px;
      color: #a1a1aa;
      font-family: monospace;
    }
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
  margin-bottom: 8px;

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
  gap: 8px;
  margin-bottom: 8px;
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
    grid-template-columns: repeat(2, 1fr);
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

  .card-title {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    i {
      font-size: 20px;
      color: #d4d4d8;
    }

    h3 {
      font-size: 18px;
      font-weight: 500;
      color: #f4f4f5;
      flex: 1;
    }

    .edit-mini-btn {
      font-size: 12px;
      color: #a1a1aa;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: color 0.2s;

      &:hover {
        color: #fff;
      }
    }
  }
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

  .card-title {
    border-color: rgba(0, 0, 0, 0.1);

    i { color: #52525b; }
    h3 { color: #18181b; }
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

.rules-card:not(.cyber-card) {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);

  .rules-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 24px;

    .title-group {
      display: flex;
      align-items: center;
      gap: 12px;

      i {
        font-size: 20px;
        color: #d4d4d8;
      }

      h3 {
        font-size: 18px;
        font-weight: 500;
        color: #f4f4f5;
      }
    }

    .manage-btn {
      font-size: 12px;
      color: #a1a1aa;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: color 0.2s;

      &:hover {
        color: #fff;
      }
    }
  }
}

.rules-card.cyber-card {
  padding: 24px;
  border-radius: 14px;
}

:global(.light) .rules-card:not(.cyber-card) {
  border-color: rgba(0, 0, 0, 0.1);
  background: #fff;

  .rules-header {
    border-color: rgba(0, 0, 0, 0.1);

    .title-group {
      i { color: #52525b; }
      h3 { color: #18181b; }
    }

    .manage-btn {
      color: #71717a;

      &:hover {
        color: #18181b;
      }
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
    margin-right: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

:global(.light) {
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
