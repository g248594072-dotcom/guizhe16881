<template>
  <div class="tm-edit-root">
    <div class="tm-edit-head dynamic-border">
      <h2 class="dynamic-text tm-edit-title">编辑建筑</h2>
      <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="$emit('close')">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>

    <div class="tm-edit-scroll">
      <div class="tm-edit-section">
        <label class="tm-label dynamic-text-muted">名称</label>
        <input v-model="form.name" type="text" class="tm-input dynamic-input dynamic-border dynamic-text" />
      </div>

      <div class="tm-edit-row">
        <div class="tm-edit-grow">
          <label class="tm-label dynamic-text-muted">类型</label>
          <select v-model="form.type" class="tm-input dynamic-input dynamic-border dynamic-text">
            <option v-for="(cfg, key) in TYPE_CONFIG" :key="key" :value="key">{{ cfg.label }}</option>
          </select>
        </div>
        <div class="tm-edit-grow">
          <label class="tm-label dynamic-text-muted">地图图标（可选）</label>
          <select v-model="formIconKey" class="tm-input dynamic-input dynamic-border dynamic-text">
            <option value="">默认（随类型）</option>
            <option v-for="key in ICON_KEYS" :key="key" :value="key">{{ key }}</option>
          </select>
        </div>
      </div>

      <div class="tm-edit-section">
        <label class="tm-label dynamic-text-muted">尺寸 (宽×高)</label>
        <div class="tm-size-inputs">
          <input v-model.number="form.width" type="number" min="1" max="5" class="tm-input tm-input-num dynamic-input dynamic-border dynamic-text" />
          <span class="dynamic-text-muted">×</span>
          <input v-model.number="form.height" type="number" min="1" max="5" class="tm-input tm-input-num dynamic-input dynamic-border dynamic-text" />
        </div>
      </div>

      <div class="tm-edit-section">
        <label class="tm-label dynamic-text-muted">描述</label>
        <textarea
          v-model="form.description"
          rows="8"
          class="tm-input tm-textarea-building-desc dynamic-input dynamic-border dynamic-text"
        />
      </div>

      <div class="tm-edit-section">
        <div class="tm-edit-label-row">
          <span class="tm-label-upper dynamic-text-muted">自定义属性</span>
          <button type="button" class="tm-icon-btn dynamic-accent" aria-label="添加属性" @click="addCustomProperty">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>
        <div v-for="cp in form.customProperties" :key="cp.id" class="tm-cp-block dynamic-border">
          <div class="tm-row-gap">
            <input v-model="cp.name" type="text" class="tm-input flex1 dynamic-input dynamic-border dynamic-text" placeholder="名称" />
            <button type="button" class="tm-trash dynamic-text-muted" @click="removeCustomProperty(cp.id)">
              <i class="fa-solid fa-trash" aria-hidden="true"></i>
            </button>
          </div>
          <input
            v-model="cp.description"
            type="text"
            class="tm-input dynamic-input dynamic-border dynamic-text"
            placeholder="说明（可选）"
          />
          <input v-model="cp.value" type="text" class="tm-input dynamic-input dynamic-border dynamic-text mono" placeholder="数值" />
        </div>
      </div>

      <div class="tm-edit-section">
        <div class="tm-edit-label-row">
          <span class="tm-label-upper dynamic-text-muted">内部房间</span>
          <button type="button" class="tm-icon-btn dynamic-accent" aria-label="添加房间" @click="addRoom">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>
        <div v-for="room in form.rooms" :key="room.id" class="tm-row-gap">
          <input v-model="room.name" type="text" class="tm-input flex1 dynamic-input dynamic-border dynamic-text" placeholder="房间名称" />
          <input v-model="room.type" type="text" class="tm-input w24 dynamic-input dynamic-border dynamic-text" placeholder="用途" />
          <button type="button" class="tm-trash dynamic-text-muted" @click="removeRoom(room.id)">
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div class="tm-edit-section">
        <div class="tm-edit-label-row">
          <span class="tm-label-upper dynamic-text-muted">事件（即将 / 进行中）</span>
          <button type="button" class="tm-icon-btn dynamic-accent" aria-label="添加事件" @click="addActivity">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>
        <p class="tm-event-hint dynamic-text-muted small">
          例：例会、社团聚会、射击赛、烟火大会、迎新会；或个人求助等。生成规则可后定。
        </p>
        <div v-for="act in form.activities" :key="act.id" class="tm-act-card dynamic-border">
          <div class="tm-row-gap">
            <input
              v-model="act.name"
              type="text"
              class="tm-input flex1 dynamic-input dynamic-border dynamic-text"
              placeholder="例：社团例会 / 烟火大会 / 路人求助"
            />
            <button type="button" class="tm-trash dynamic-text-muted" @click="removeActivity(act.id)">
              <i class="fa-solid fa-trash" aria-hidden="true"></i>
            </button>
          </div>
          <div class="tm-act-meta-row">
            <div class="tm-act-meta-field">
              <span class="tm-mini-label dynamic-text-muted">阶段</span>
              <select v-model="act.phase" class="tm-input tm-select-compact dynamic-input dynamic-border dynamic-text">
                <option value="upcoming">即将举办</option>
                <option value="ongoing">进行中</option>
              </select>
            </div>
            <div class="tm-act-meta-field">
              <span class="tm-mini-label dynamic-text-muted">类型</span>
              <select v-model="act.scope" class="tm-input tm-select-compact dynamic-input dynamic-border dynamic-text">
                <option value="collective">集体</option>
                <option value="personal">个人</option>
              </select>
            </div>
          </div>
          <div class="tm-range-row">
            <span class="tm-mini-label dynamic-text-muted">进度</span>
            <input v-model.number="act.progress" type="range" min="0" max="100" class="tm-range" />
            <span class="dynamic-accent mono small">{{ act.progress }}%</span>
          </div>
        </div>
      </div>

      <div class="tm-edit-section">
        <div class="tm-edit-label-row">
          <span class="tm-label-upper dynamic-text-muted">人员</span>
          <button type="button" class="tm-icon-btn dynamic-accent" aria-label="添加人员" @click="addPerson">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>
        <div v-for="person in form.people" :key="person.id" class="tm-row-gap">
          <input v-model="person.name" type="text" class="tm-input flex1 dynamic-input dynamic-border dynamic-text" placeholder="姓名" />
          <input v-model="person.role" type="text" class="tm-input w24 dynamic-input dynamic-border dynamic-text" placeholder="身份" />
          <button type="button" class="tm-trash dynamic-text-muted" @click="removePerson(person.id)">
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="tm-edit-foot dynamic-border">
      <button type="button" class="tm-btn-save dynamic-border dynamic-text" @click="handleSave">
        <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
        保存修改
      </button>
      <button type="button" class="tm-btn-del" title="拆除建筑" @click="$emit('delete')">
        <i class="fa-solid fa-trash" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { Activity, ActivityPhase, ActivityScope, Building, BuildingType, CustomProperty, Person, Room } from './tacticalMap/types';
import { TYPE_CONFIG } from './tacticalMap/themePresets';
import { ICON_KEYS } from './tacticalMap/iconMap';
import { normalizeBuilding } from './tacticalMap/migrate';

const props = defineProps<{ building: Building }>();

const emit = defineEmits<{
  save: [updates: Partial<Building>];
  close: [];
  delete: [];
}>();

function cloneBuilding(b: Building): Building {
  return normalizeBuilding(JSON.parse(JSON.stringify(b)) as Building);
}

function normalizeActivityFields(b: Building) {
  for (const a of b.activities) {
    if (a.phase == null) a.phase = 'ongoing';
    if (a.scope == null) a.scope = 'collective';
  }
}

const form = reactive<Building>(cloneBuilding(props.building));
normalizeActivityFields(form);

watch(
  () => props.building,
  b => {
    Object.assign(form, cloneBuilding(b));
    normalizeActivityFields(form);
  },
  { deep: true },
);

const formIconKey = computed({
  get: () => form.icon ?? '',
  set: (v: string) => {
    form.icon = v || undefined;
  },
});

function addCustomProperty() {
  form.customProperties.push({
    id: `cp_${Date.now()}`,
    name: '新属性',
    description: '',
    value: '',
  });
}

function removeCustomProperty(id: string) {
  form.customProperties = form.customProperties.filter(cp => cp.id !== id);
}

function addRoom() {
  form.rooms.push({ id: `r_${Date.now()}`, name: '新房间', type: '通用' });
}

function removeRoom(id: string) {
  form.rooms = form.rooms.filter(r => r.id !== id);
}

function addActivity() {
  form.activities.push({
    id: `a_${Date.now()}`,
    name: '未命名事件',
    progress: 0,
    phase: 'upcoming',
    scope: 'collective',
  });
}

function removeActivity(id: string) {
  form.activities = form.activities.filter(a => a.id !== id);
}

function addPerson() {
  form.people.push({ id: `p_${Date.now()}`, name: '未知人员', role: '平民' });
}

function removePerson(id: string) {
  form.people = form.people.filter(p => p.id !== id);
}

function handleSave() {
  const width = Math.min(5, Math.max(1, Number(form.width) || 1));
  const height = Math.min(5, Math.max(1, Number(form.height) || 1));
  const activities: Activity[] = form.activities.map(a => ({
    ...a,
    progress: Math.min(100, Math.max(0, Number(a.progress) || 0)),
    phase: (a.phase === 'upcoming' || a.phase === 'ongoing' ? a.phase : 'ongoing') as ActivityPhase,
    scope: (a.scope === 'personal' || a.scope === 'collective' ? a.scope : 'collective') as ActivityScope,
  }));
  emit('save', {
    ...form,
    width,
    height,
    type: form.type as BuildingType,
    icon: form.icon || undefined,
    activities,
    rooms: form.rooms.map((r: Room) => ({ ...r })),
    people: form.people.map((p: Person) => ({ ...p })),
    customProperties: form.customProperties.map((c: CustomProperty) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      value: c.value,
    })),
    isNew: false,
  });
}
</script>

<style scoped lang="scss">
.tm-edit-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.tm-edit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-bottom-width: 1px;
  flex-shrink: 0;
}

.tm-edit-title {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tm-close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem;
}

.tm-edit-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.tm-edit-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tm-label {
  font-size: 0.7rem;
  font-weight: 500;
}

.tm-label-upper {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tm-edit-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tm-icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0.2rem;
}

.tm-edit-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.tm-edit-grow {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tm-edit-sizes {
  width: 38%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tm-size-inputs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.tm-input {
  width: 100%;
  border-radius: 0.375rem;
  padding: 0.45rem 0.55rem;
  font-size: 0.8125rem;
  outline: none;
}

.tm-textarea-building-desc {
  min-height: 9rem;
  resize: vertical;
  line-height: 1.45;
}

.tm-input-num {
  text-align: center;
}

.tm-cp-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  border-width: 1px;
  margin-bottom: 0.35rem;
}

.tm-row-gap {
  display: flex;
  gap: 0.35rem;
  align-items: flex-start;
}

.flex1 {
  flex: 1;
}

.w24 {
  width: 6rem;
}

.mono {
  font-family: ui-monospace, monospace;
}

.small {
  font-size: 0.7rem;
}

.tm-trash {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0.35rem;
}

.tm-trash:hover {
  color: #ef4444;
}

.tm-act-card {
  border-radius: 0.375rem;
  border-width: 1px;
  padding: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tm-event-hint {
  margin: 0 0 0.4rem;
  line-height: 1.4;
}

.tm-act-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.tm-act-meta-field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1 1 120px;
  min-width: 0;
}

.tm-mini-label {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tm-select-compact {
  padding: 0.3rem 0.4rem;
  font-size: 0.75rem;
}

.tm-range-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.tm-range-row .tm-mini-label {
  flex-shrink: 0;
  text-transform: none;
  letter-spacing: 0;
}

.tm-range {
  flex: 1;
}

.tm-edit-foot {
  display: flex;
  gap: 0.5rem;
  padding: 0.85rem;
  border-top-width: 1px;
  flex-shrink: 0;
}

.tm-btn-save {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 0.375rem;
  cursor: pointer;
  background: transparent;
}

.tm-btn-del {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #ef4444;
  background: transparent;
  cursor: pointer;
}

.tm-btn-del:hover {
  background: rgba(239, 68, 68, 0.08);
}

.dynamic-text {
  color: var(--text-main);
}

.dynamic-text-muted {
  color: var(--text-muted);
}

.dynamic-accent {
  color: var(--accent-color);
}

.dynamic-border {
  border-color: var(--border-color);
}

.dynamic-input {
  background-color: var(--input-bg);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}
</style>
