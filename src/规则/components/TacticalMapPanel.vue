<template>
  <div
    class="tactical-map-root"
    :class="[
      themeClass,
      isDarkMode ? 'tactical-map--host-dark' : 'tactical-map--host-light',
    ]"
  >
    <!-- Top bar：桌面端左为「图标 + 地图」，右为两行（下拉 / 按钮） -->
    <div v-if="!isMobileLayout" class="tm-topbar dynamic-panel dynamic-border">
      <div class="tm-topbar-brand">
        <i class="fa-solid fa-map dynamic-accent tm-icon-lg" aria-hidden="true"></i>
        <h1 class="tm-title tm-title--brand-short dynamic-text">地图</h1>
      </div>
      <div class="tm-topbar-tray">
        <div class="tm-topbar-row tm-topbar-row--selects">
          <label for="tm-region-nav-select" class="tm-sr-only">区域跳转</label>
          <select
            id="tm-region-nav-select"
            class="tm-select tm-region-select dynamic-input dynamic-border dynamic-text"
            @change="onRegionNavSelect"
          >
            <option value="">地图…</option>
            <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
        <div class="tm-topbar-row tm-topbar-row--actions">
          <div class="tm-topbar-actions-main">
            <button type="button" class="tm-btn dynamic-border dynamic-text" @click="showEventNavModal = true">
              <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
              活动导航
            </button>
            <button
              v-if="!isGlobalEditMode"
              type="button"
              class="tm-btn tm-btn-primary"
              @click="showCreateEventModal = true"
            >
              <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
              创建活动
            </button>
            <button
              type="button"
              class="tm-btn tm-btn-toggle dynamic-border dynamic-text"
              :class="{ 'tm-btn-toggle--on': isGlobalEditMode }"
              @click="toggleEditMode"
            >
              <i :class="isGlobalEditMode ? 'fa-solid fa-eye' : 'fa-solid fa-pen-to-square'" aria-hidden="true"></i>
              {{ isGlobalEditMode ? '退出编辑模式' : '进入编辑模式' }}
            </button>
            <template v-if="isGlobalEditMode">
              <button type="button" class="tm-btn dynamic-border dynamic-text dynamic-accent" @click="openAiGenerate">
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                AI 生成区域
              </button>
              <button type="button" class="tm-btn dynamic-border dynamic-text dynamic-accent" @click="openAddRegion">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                新建区域
              </button>
              <button type="button" class="tm-btn dynamic-border dynamic-text dynamic-accent" @click="openAddBuilding">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                建造模块
              </button>
            </template>
          </div>
          <div ref="mapSettingsWrapRef" class="tm-map-settings-wrap">
            <button
              type="button"
              class="tm-btn dynamic-border dynamic-text"
              :aria-expanded="mapSettingsOpen"
              aria-controls="tm-map-settings-panel"
              @click="mapSettingsOpen = !mapSettingsOpen"
            >
              <i class="fa-solid fa-gear" aria-hidden="true"></i>
              地图设置
            </button>
            <div
              v-show="mapSettingsOpen"
              id="tm-map-settings-panel"
              class="tm-map-settings-pop dynamic-panel dynamic-border"
              role="dialog"
              aria-label="地图设置"
            >
              <div class="tm-map-settings-field">
                <label class="tm-map-settings-label dynamic-text-muted" for="tm-world-select-settings">当前世界</label>
                <select
                  id="tm-world-select-settings"
                  :value="currentWorldId"
                  class="tm-select tm-map-settings-select dynamic-input dynamic-border dynamic-text"
                  @change="onWorldSelect"
                >
                  <option v-for="w in worlds" :key="w.id" :value="w.id">{{ w.name }}</option>
                  <option value="__new__">+ 自定义新世界…</option>
                </select>
                <template v-if="currentWorld.details">
                  <span class="tm-map-settings-label dynamic-text-muted">世界详情</span>
                  <p class="tm-map-settings-world-detail dynamic-text-muted">{{ currentWorld.details }}</p>
                </template>
              </div>
              <div class="tm-map-settings-field">
                <label class="tm-map-settings-label dynamic-text-muted" for="tm-theme-select-settings">皮肤</label>
                <select
                  id="tm-theme-select-settings"
                  :value="mapUiTheme"
                  class="tm-select tm-map-settings-select dynamic-input dynamic-border dynamic-text"
                  @change="onMapUiThemeSelect"
                >
                  <option v-for="(theme, key) in THEMES" :key="key" :value="key">{{ theme.name }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 手机端：顶栏「地图」+ 区域跳转下拉（与悬浮抽屉内原「地图」导航一致） -->
    <div v-else class="tm-topbar tm-topbar--mobile dynamic-panel dynamic-border">
      <div class="tm-topbar-brand tm-topbar-brand--mobile">
        <i class="fa-solid fa-map dynamic-accent tm-icon-lg" aria-hidden="true"></i>
        <h1 class="tm-title tm-title--brand-short dynamic-text">地图</h1>
      </div>
      <div class="tm-topbar-mobile-region-wrap">
        <label for="tm-m-top-region-nav" class="tm-sr-only">区域导航</label>
        <select
          id="tm-m-top-region-nav"
          class="tm-select tm-topbar-mobile-region-select dynamic-input dynamic-border dynamic-text"
          @change="onRegionNavSelect"
        >
          <option value="">区域导航</option>
          <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
    </div>

    <!-- Map viewport -->
    <div
      ref="containerRef"
      class="tm-viewport dynamic-bg"
      :class="{ 'tm-viewport--grabbing': mapPan.active }"
    >
      <div
        ref="mapSurfaceRef"
        class="tm-map-surface dynamic-grid"
        :style="mapSurfaceStyle"
        @pointerdown="onMapSurfacePointerDown"
        @pointermove="onMapPanPointerMove"
        @pointerup="onMapPanPointerUp"
        @pointercancel="onMapPanPointerUp"
      >
        <TacticalMapRegionBlock
          v-for="region in regions"
          :key="region.id"
          :region="region"
          :region-buildings="buildingsInRegion(region.id)"
          :show-buildings="showBuildings"
          :is-global-edit-mode="isGlobalEditMode"
          :block-empty-place-building="isEditingPanel || !!selectedBuilding?.isNew"
          :scale="scale"
          :selected-id="selectedId"
          @edit="editingRegionId = region.id"
          @drag-end="(dx, dy) => handleRegionDragEnd(region.id, dx, dy)"
          @add-building-at="(gx, gy) => handleAddBuildingAt(region.id, gx, gy)"
          @select-building="onSelectBuildingFromMap"
          @building-drag-end="onBuildingDragEnd"
        />

        <TacticalMapBuildingMarker
          v-for="b in orphanBuildings"
          v-show="showBuildings"
          :key="b.id"
          :building="b"
          :selected="selectedId === b.id"
          :is-global-edit-mode="isGlobalEditMode"
          :scale="scale"
          :offset-x="0"
          :offset-y="0"
          :bounds="null"
          :region-color="orphanRegionColor(b)"
          @click="onOrphanBuildingClick(b)"
          @drag-end="(nx, ny) => updateBuilding(b.id, { x: nx, y: ny })"
        />
      </div>

      <TacticalMapRegionIndicator
        v-for="r in regions"
        :key="'ind_' + r.id"
        :region="r"
        :pan-x="panX"
        :pan-y="panY"
        :scale="scale"
        :viewport-el="containerRef"
      />
    </div>

    <!-- Zoom：放大 / 缩小，贴左下（桌面与手机一致） -->
    <div class="tm-zoom dynamic-panel dynamic-border">
      <button type="button" class="tm-zoom-btn dynamic-text" title="放大" @click="bumpScale(0.2)">
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
      </button>
      <button type="button" class="tm-zoom-btn dynamic-text" title="缩小" @click="bumpScale(-0.2)">
        <i class="fa-solid fa-minus" aria-hidden="true"></i>
      </button>
    </div>

    <!-- 手机端：悬浮按钮 + 底部抽屉（收纳顶栏全部功能） -->
    <div v-if="isMobileLayout" class="tm-mobile-fab-layer">
      <div
        v-if="mobileFabOpen"
        class="tm-mobile-fab-backdrop"
        aria-hidden="true"
        @click="mobileFabOpen = false"
      />
      <Transition name="tm-sheet-up">
        <div
          v-if="mobileFabOpen"
          id="tm-mobile-sheet-root"
          class="tm-mobile-sheet dynamic-panel dynamic-border"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tm-mobile-sheet-title"
        >
          <div class="tm-mobile-sheet-head dynamic-border">
            <h2 id="tm-mobile-sheet-title" class="dynamic-text">
              {{ isGlobalEditMode ? '编辑工具' : '地图功能' }}
            </h2>
            <button
              type="button"
              class="tm-mobile-sheet-close dynamic-text-muted"
              aria-label="关闭"
              @click="mobileFabOpen = false"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <div class="tm-mobile-sheet-body">
            <template v-if="!isGlobalEditMode">
              <button type="button" class="tm-btn tm-mobile-full dynamic-border dynamic-text" @click="openEventNavMobile">
                <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
                活动导航
              </button>
              <button type="button" class="tm-btn tm-btn-primary tm-mobile-full" @click="openCreateEventMobile">
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                创建活动
              </button>
              <label class="tm-mobile-label dynamic-text-muted" for="tm-m-world">当前世界</label>
              <select
                id="tm-m-world"
                :value="currentWorldId"
                class="tm-select tm-mobile-full dynamic-input dynamic-border dynamic-text"
                @change="onWorldSelectMobile"
              >
                <option v-for="w in worlds" :key="w.id" :value="w.id">{{ w.name }}</option>
                <option value="__new__">+ 自定义新世界…</option>
              </select>
              <p v-if="currentWorld.details" class="tm-mobile-world-detail dynamic-text-muted">{{ currentWorld.details }}</p>
              <label class="tm-mobile-label dynamic-text-muted" for="tm-m-theme">皮肤</label>
              <select
                id="tm-m-theme"
                :value="mapUiTheme"
                class="tm-select tm-mobile-full dynamic-input dynamic-border dynamic-text"
                @change="onMapUiThemeSelectMobile"
              >
                <option v-for="(theme, key) in THEMES" :key="key" :value="key">{{ theme.name }}</option>
              </select>
              <button
                type="button"
                class="tm-btn tm-btn-toggle tm-mobile-full dynamic-border dynamic-text"
                @click="toggleEditModeMobile"
              >
                <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                进入编辑模式
              </button>
            </template>
            <template v-else>
              <button type="button" class="tm-btn tm-mobile-full dynamic-border dynamic-accent" @click="openAiGenerateMobile">
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                AI 生成区域
              </button>
              <button type="button" class="tm-btn tm-mobile-full dynamic-border dynamic-accent" @click="openAddRegionMobile">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                新建区域
              </button>
              <button type="button" class="tm-btn tm-mobile-full dynamic-border dynamic-accent" @click="openAddBuildingMobile">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                建造模块
              </button>
            </template>
          </div>
        </div>
      </Transition>
      <div class="tm-mobile-fab-stack">
        <button
          type="button"
          class="tm-mobile-fab"
          :class="{ 'tm-mobile-fab--open': mobileFabOpen }"
          :aria-expanded="mobileFabOpen"
          aria-controls="tm-mobile-sheet-root"
          :aria-label="mobileFabOpen ? '关闭地图功能菜单' : '打开地图功能菜单'"
          @click="mobileFabOpen = !mobileFabOpen"
        >
          <i class="fa-solid" :class="mobileFabOpen ? 'fa-xmark' : 'fa-layer-group'" aria-hidden="true" />
        </button>
        <button
          v-if="isGlobalEditMode"
          type="button"
          class="tm-mobile-quit-edit dynamic-panel dynamic-border dynamic-text"
          @click="quitEditModeFromMobileFab"
        >
          退出编辑模式
        </button>
      </div>
    </div>

    <!-- Sidebar -->
    <Transition name="tm-slide">
      <aside
        v-if="selectedBuilding && showBuildings"
        class="tm-sidebar dynamic-panel dynamic-border"
      >
        <TacticalMapEditForm
          v-if="isEditingPanel && isGlobalEditMode"
          :building="selectedBuilding"
          @save="onEditSave"
          @close="isEditingPanel = false"
          @delete="deleteBuilding(selectedBuilding.id)"
        />
        <div v-else class="tm-view-scroll">
          <div class="tm-view-head dynamic-border">
            <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="closeSidebar">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
            <div class="tm-view-title-row">
              <div
                class="tm-view-icon-wrap dynamic-building dynamic-border dynamic-accent"
                :style="regionAccentWrapStyle(selectedBuilding)"
              >
                <i :class="buildingDisplayIcon(selectedBuilding)" aria-hidden="true"></i>
              </div>
              <div>
                <h2 class="tm-view-name dynamic-text">{{ selectedBuilding.name }}</h2>
                <p class="tm-view-meta dynamic-text-muted">
                  {{ typeLabel(selectedBuilding.type) }} | {{ selectedBuilding.width }}×{{ selectedBuilding.height }}
                </p>
              </div>
            </div>
            <p class="tm-view-desc dynamic-text-muted">{{ selectedBuilding.description }}</p>
            <button
              v-if="isGlobalEditMode"
              type="button"
              class="tm-btn tm-btn-block dynamic-border dynamic-text"
              @click="isEditingPanel = true"
            >
              <i class="fa-solid fa-gear" aria-hidden="true"></i>
              编辑建筑
            </button>
          </div>
          <div v-if="selectedBuilding.customProperties.length > 0" class="tm-section dynamic-border">
            <h3 class="tm-section-title dynamic-text-muted">自定义属性</h3>
            <div v-for="prop in selectedBuilding.customProperties" :key="prop.id" class="tm-kv-row">
              <span class="dynamic-text-muted">{{ prop.name }}</span>
              <span class="dynamic-text mono">{{ prop.value }}</span>
            </div>
          </div>
          <div class="tm-section dynamic-border">
            <h3 class="tm-section-title dynamic-text">
              <i class="fa-solid fa-border-all dynamic-accent" aria-hidden="true"></i>
              内部房间布局
            </h3>
            <p v-if="selectedBuilding.rooms.length === 0" class="dynamic-text-muted italic">暂无划分房间。</p>
            <div v-else class="tm-room-grid">
              <div v-for="room in selectedBuilding.rooms" :key="room.id" class="tm-room-card dynamic-border">
                <div class="dynamic-text">{{ room.name }}</div>
                <div class="dynamic-text-muted small">{{ room.type }}</div>
              </div>
            </div>
          </div>
          <div class="tm-section dynamic-border">
            <h3 class="tm-section-title dynamic-text">
              <i class="fa-solid fa-calendar-days dynamic-accent" aria-hidden="true"></i>
              即将举办 / 进行中的活动
            </h3>
            <p class="tm-act-hint dynamic-text-muted small">
              如会议、社团聚会、射击赛、烟火大会、迎新会等集体事件，或个人求助等；条目与生成规则可后续再接。
            </p>
            <template v-if="selectedBuilding.activities.length === 0">
              <p class="dynamic-text-muted italic">尚未登记事件。</p>
              <button
                v-if="isGlobalEditMode"
                type="button"
                class="tm-btn-sm dynamic-border dynamic-text"
                @click="addActivityQuick"
              >
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                新建事件
              </button>
            </template>
            <div v-else class="tm-activities">
              <div v-for="act in selectedBuilding.activities" :key="act.id" class="tm-act">
                <div class="tm-act-head">
                  <div class="tm-act-title-block">
                    <span class="dynamic-text tm-act-name">{{ act.name }}</span>
                    <div class="tm-act-tags">
                      <span class="tm-tag tm-tag--phase dynamic-border">{{ activityPhaseLabel(act) }}</span>
                      <span
                        v-if="activityScopeLabel(act)"
                        class="tm-tag tm-tag--scope dynamic-border dynamic-text-muted"
                      >{{ activityScopeLabel(act) }}</span>
                    </div>
                  </div>
                  <span class="dynamic-accent mono tm-act-pct">{{ act.progress }}%</span>
                </div>
                <div class="tm-progress dynamic-border">
                  <div class="tm-progress-bar dynamic-accent" :style="{ width: `${act.progress}%` }" />
                </div>
              </div>
            </div>
          </div>
          <div class="tm-section">
            <h3 class="tm-section-title dynamic-text">
              <i class="fa-solid fa-users dynamic-accent" aria-hidden="true"></i>
              居住/驻扎人员
            </h3>
            <p v-if="selectedBuilding.people.length === 0" class="dynamic-text-muted italic">建筑内空无一人。</p>
            <div v-else class="tm-people">
              <div v-for="person in selectedBuilding.people" :key="person.id" class="tm-person dynamic-border">
                <span class="dynamic-text">{{ person.name }}</span>
                <span class="dynamic-text-muted mono tag">{{ person.role }}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </Transition>

    <!-- AI modal -->
    <Teleport to="body">
      <Transition name="tm-fade">
        <div
          v-if="showGenerateModal"
          class="tm-modal-overlay"
          :class="isDarkMode ? 'tm-modal-overlay--scheme-dark' : 'tm-modal-overlay--scheme-light'"
          @click.self="showGenerateModal = false"
        >
          <div
            class="tm-modal tm-modal--solid-bg tm-modal--vivid-controls dynamic-panel dynamic-border"
            role="dialog"
            aria-labelledby="tm-modal-title"
          >
            <div class="tm-modal-head dynamic-border">
              <div class="tm-modal-title-row">
                <i class="fa-solid fa-wand-magic-sparkles dynamic-accent" aria-hidden="true"></i>
                <h2 id="tm-modal-title" class="dynamic-text">AI 生成新区域</h2>
              </div>
              <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="showGenerateModal = false">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
            <div class="tm-modal-body">
              <p class="dynamic-text-muted small">
                将按当前世界的<strong class="dynamic-text">机场风格 · {{ THEMES[worldTheme].name }}</strong>生成；地图配色
                <strong class="dynamic-text">{{ THEMES[mapUiTheme].name }}</strong>仅影响界面颜色。<br />
                AI 将在地图的空旷位置生成一个带有边界框的新区域，并在其中自动放置 3-6 个符合设定的建筑。
              </p>
              <label class="dynamic-text small bold">你想生成什么类型的区域？(可选)</label>
              <textarea
                v-model="generatePrompt"
                rows="3"
                class="tm-textarea dynamic-input dynamic-border dynamic-text"
                placeholder="例如：贫民窟、皇家法师塔、星际黑市、废弃的生化实验室... 留空则完全随机生成。"
              />
            </div>
            <div class="tm-modal-foot dynamic-border">
              <button type="button" class="tm-btn dynamic-text" @click="showGenerateModal = false">取消</button>
              <button type="button" class="tm-btn tm-btn-primary" @click="onGenerateStub">
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                开始生成
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <TacticalMapRegionEditModal
        v-if="editingRegion"
        :region="editingRegion"
        @close="onRegionEditModalClose"
        @update="patchRegion(editingRegion!.id, $event)"
        @delete="deleteRegion(editingRegion!.id)"
      />
      <TacticalMapPickRegionForBuildingModal
        v-if="showPickRegionForBuilding"
        :regions="regions"
        @close="showPickRegionForBuilding = false"
        @confirm="onConfirmPickRegionForNewBuilding"
      />
      <TacticalMapCreateWorldModal v-if="showCreateWorldModal" @close="showCreateWorldModal = false" @create="onCreateWorld" />
      <TacticalMapEventNavModal
        v-if="showEventNavModal"
        :regions="regions"
        :buildings="buildings"
        @close="showEventNavModal = false"
        @navigate="onEventNavNavigate"
      />
      <TacticalMapCreateEventModal v-if="showCreateEventModal" :regions="regions" @close="showCreateEventModal = false" />
      <TacticalMapNewBuildingWarningModal
        v-if="pendingAction && selectedBuilding"
        :building="selectedBuilding"
        @save="onUnsavedSave"
        @discard="onUnsavedDiscard"
        @cancel="onUnsavedCancel"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { gsap } from 'gsap';
import { onClickOutside, useMediaQuery } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Activity, ActivityPhase, Building, BuildingType, MapStyle, Region, World } from './tacticalMap/types';
import { normalizeWorlds } from './tacticalMap/migrate';
import { CELL_SIZE, INITIAL_WORLDS, THEMES, TYPE_CONFIG, ZOOM_THRESHOLD } from './tacticalMap/themePresets';
import { ICON_MAP } from './tacticalMap/iconMap';
import TacticalMapEditForm from './TacticalMapEditForm.vue';
import TacticalMapRegionBlock from './TacticalMapRegionBlock.vue';
import TacticalMapBuildingMarker from './TacticalMapBuildingMarker.vue';
import TacticalMapRegionIndicator from './tacticalMap/TacticalMapRegionIndicator.vue';
import TacticalMapRegionEditModal from './tacticalMap/TacticalMapRegionEditModal.vue';
import TacticalMapCreateWorldModal from './tacticalMap/TacticalMapCreateWorldModal.vue';
import TacticalMapEventNavModal from './tacticalMap/TacticalMapEventNavModal.vue';
import TacticalMapCreateEventModal from './tacticalMap/TacticalMapCreateEventModal.vue';
import TacticalMapNewBuildingWarningModal from './tacticalMap/TacticalMapNewBuildingWarningModal.vue';
import TacticalMapPickRegionForBuildingModal from './tacticalMap/TacticalMapPickRegionForBuildingModal.vue';

defineProps<{ isDarkMode: boolean }>();

function resolveActivityPhase(a: Activity): ActivityPhase {
  return a.phase ?? 'ongoing';
}

function activityPhaseLabel(a: Activity): string {
  return resolveActivityPhase(a) === 'upcoming' ? '即将举办' : '进行中';
}

function activityScopeLabel(a: Activity): string {
  if (a.scope === 'personal') return '个人';
  if (a.scope === 'collective') return '集体';
  return '';
}

const MAP_SIZE = 4000;
const MAP_HALF = MAP_SIZE / 2;

const worlds = ref<World[]>(normalizeWorlds(JSON.parse(JSON.stringify(INITIAL_WORLDS)) as World[]));
const currentWorldId = ref(worlds.value[0]?.id ?? 'w_default');

const currentWorld = computed(() => worlds.value.find(w => w.id === currentWorldId.value) ?? worlds.value[0]);
const buildings = computed(() => currentWorld.value?.buildings ?? []);
const regions = computed(() => currentWorld.value?.regions ?? []);
/** 世界数据上的「机场风格」，与界面配色 mapUiTheme 独立 */
const worldTheme = computed<MapStyle>(() => currentWorld.value?.theme ?? 'modern');
/** 仅控制战术地图界面配色，不修改当前世界数据 */
const mapUiTheme = ref<MapStyle>('sci_fi');

const orphanBuildings = computed(() => buildings.value.filter(b => !b.regionId));

const selectedId = ref<string | null>(null);
const isEditingPanel = ref(false);
const isGlobalEditMode = ref(false);
const scale = ref(1);
const showGenerateModal = ref(false);
const generatePrompt = ref('');
const editingRegionId = ref<string | null>(null);
const showCreateWorldModal = ref(false);
const showEventNavModal = ref(false);
const showCreateEventModal = ref(false);
const pendingAction = ref<'toggle_mode' | 'close_panel' | null>(null);
const pendingNextSelectedId = ref<string | null>(null);

const isMobileLayout = useMediaQuery('(max-width: 639px)');
const mobileFabOpen = ref(false);
const mapSettingsOpen = ref(false);
const mapSettingsWrapRef = ref<HTMLElement | null>(null);
const showPickRegionForBuilding = ref(false);

onClickOutside(mapSettingsWrapRef, () => {
  mapSettingsOpen.value = false;
});

const containerRef = ref<HTMLElement | null>(null);
const mapSurfaceRef = ref<HTMLElement | null>(null);

const panX = ref(0);
const panY = ref(0);
const mapPan = ref({
  active: false,
  startClientX: 0,
  startClientY: 0,
  panX0: 0,
  panY0: 0,
  pointerId: 0,
});

const mapClickCandidate = ref<{ x: number; y: number } | null>(null);

let panTween: gsap.core.Tween | null = null;

const selectedBuilding = computed(() => buildings.value.find(b => b.id === selectedId.value) ?? null);
const editingRegion = computed(() => regions.value.find(r => r.id === editingRegionId.value) ?? null);
const showBuildings = computed(() => scale.value >= ZOOM_THRESHOLD);

const themeClass = computed(() => THEMES[mapUiTheme.value].className);

const mapSurfaceStyle = computed(() => ({
  width: `${MAP_SIZE}px`,
  height: `${MAP_SIZE}px`,
  transform: `translate(calc(-50% + ${panX.value}px), calc(-50% + ${panY.value}px)) scale(${scale.value})`,
}));

function setBuildings(updater: Building[] | ((prev: Building[]) => Building[])) {
  const cw = currentWorld.value;
  if (!cw) return;
  const next = typeof updater === 'function' ? updater([...cw.buildings]) : updater;
  worlds.value = worlds.value.map(w => (w.id === cw.id ? { ...w, buildings: next } : w));
}

function setRegions(updater: Region[] | ((prev: Region[]) => Region[])) {
  const cw = currentWorld.value;
  if (!cw) return;
  const next = typeof updater === 'function' ? updater([...cw.regions]) : updater;
  worlds.value = worlds.value.map(w => (w.id === cw.id ? { ...w, regions: next } : w));
}

function buildingsInRegion(regionId: string) {
  return buildings.value.filter(b => b.regionId === regionId);
}

function regionColorForBuilding(b: Building) {
  if (b.regionId) {
    return regions.value.find(r => r.id === b.regionId)?.color;
  }
  return regions.value.find(
    reg => b.x >= reg.x && b.x < reg.x + reg.width && b.y >= reg.y && b.y < reg.y + reg.height,
  )?.color;
}

function buildingDisplayIcon(b: Building) {
  if (b.icon && ICON_MAP[b.icon]) return ICON_MAP[b.icon];
  return TYPE_CONFIG[b.type].iconClass;
}

function regionAccentWrapStyle(b: Building) {
  const c = regionColorForBuilding(b);
  return c ? { color: c, borderColor: c } : {};
}

function orphanRegionColor(b: Building) {
  return regionColorForBuilding(b);
}

function typeIcon(t: BuildingType) {
  return TYPE_CONFIG[t].iconClass;
}

function typeLabel(t: BuildingType) {
  return TYPE_CONFIG[t].label;
}

function clampPan() {
  const lim = 2000;
  panX.value = Math.min(lim, Math.max(-lim, panX.value));
  panY.value = Math.min(lim, Math.max(-lim, panY.value));
}

function zoomTo(newScale: number) {
  const currentScale = scale.value;
  const clamped = Math.min(3, Math.max(0.1, newScale));
  if (clamped === currentScale) return;
  const ratio = clamped / currentScale;
  panX.value *= ratio;
  panY.value *= ratio;
  scale.value = clamped;
  clampPan();
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  zoomTo(scale.value + delta);
}

function bumpScale(d: number) {
  zoomTo(scale.value + d);
}

function navigateToRegion(r: Region) {
  panTween?.kill();
  scale.value = 1;
  const regionCenterX = (r.x + r.width / 2) * CELL_SIZE;
  const regionCenterY = (r.y + r.height / 2) * CELL_SIZE;
  const targetX = MAP_HALF - regionCenterX;
  const targetY = MAP_HALF - regionCenterY;
  const state = { x: panX.value, y: panY.value };
  panTween = gsap.to(state, {
    x: targetX,
    y: targetY,
    duration: 0.55,
    ease: 'power2.out',
    onUpdate: () => {
      panX.value = state.x;
      panY.value = state.y;
      clampPan();
    },
  });
}

function onRegionNavSelect(e: Event) {
  const el = e.target as HTMLSelectElement;
  const id = el.value;
  if (!id) return;
  const r = regions.value.find(x => x.id === id);
  if (r) navigateToRegion(r);
  el.selectedIndex = 0;
}

function onWorldSelect(e: Event) {
  const el = e.target as HTMLSelectElement;
  const v = el.value;
  if (v === '__new__') {
    el.value = currentWorldId.value;
    showCreateWorldModal.value = true;
    return;
  }
  currentWorldId.value = v;
  selectedId.value = null;
  isEditingPanel.value = false;
}

function onMapUiThemeSelect(e: Event) {
  mapUiTheme.value = (e.target as HTMLSelectElement).value as MapStyle;
}

function onCreateWorld(name: string, theme: MapStyle, details: string) {
  const newWorld: World = {
    id: `w_${Date.now()}`,
    name,
    theme,
    details,
    buildings: [],
    regions: [],
  };
  worlds.value = [...worlds.value, newWorld];
  currentWorldId.value = newWorld.id;
  selectedId.value = null;
  isEditingPanel.value = false;
  showCreateWorldModal.value = false;
}

function onEventNavNavigate(b: Building, region: Region) {
  showEventNavModal.value = false;
  selectedId.value = b.id;
  isEditingPanel.value = false;
  navigateToRegion(region);
}

function toggleEditMode() {
  if (isGlobalEditMode.value && isEditingPanel.value && selectedBuilding.value?.isNew) {
    pendingAction.value = 'toggle_mode';
    return;
  }
  isGlobalEditMode.value = !isGlobalEditMode.value;
  isEditingPanel.value = false;
}

function closeSidebar() {
  if (selectedBuilding.value?.isNew) {
    pendingAction.value = 'close_panel';
    return;
  }
  selectedId.value = null;
  isEditingPanel.value = false;
}

function onUnsavedSave() {
  const b = selectedBuilding.value;
  if (!b) return;
  const action = pendingAction.value;
  updateBuilding(b.id, { isNew: false });
  pendingAction.value = null;
  if (action === 'toggle_mode') {
    isGlobalEditMode.value = false;
    isEditingPanel.value = false;
    pendingNextSelectedId.value = null;
    return;
  }
  if (pendingNextSelectedId.value) {
    selectedId.value = pendingNextSelectedId.value;
    pendingNextSelectedId.value = null;
  } else {
    selectedId.value = null;
  }
  isEditingPanel.value = false;
}

function onUnsavedDiscard() {
  const wasToggle = pendingAction.value === 'toggle_mode';
  const nextId = pendingNextSelectedId.value;
  const b = selectedBuilding.value;
  pendingAction.value = null;
  pendingNextSelectedId.value = null;
  if (b) {
    setBuildings(prev => prev.filter(x => x.id !== b.id));
  }
  selectedId.value = null;
  isEditingPanel.value = false;
  if (wasToggle) {
    isGlobalEditMode.value = false;
    return;
  }
  if (nextId) selectedId.value = nextId;
}

function onUnsavedCancel() {
  pendingAction.value = null;
  pendingNextSelectedId.value = null;
}

function updateBuilding(id: string, updates: Partial<Building>) {
  setBuildings(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
}

function deleteBuilding(id: string) {
  setBuildings(prev => prev.filter(b => b.id !== id));
  selectedId.value = null;
  isEditingPanel.value = false;
}

function patchRegion(id: string, updates: Partial<Region>) {
  setRegions(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
}

function deleteRegion(id: string) {
  setRegions(prev => prev.filter(r => r.id !== id));
  setBuildings(prev => prev.map(b => (b.regionId === id ? { ...b, regionId: undefined } : b)));
  editingRegionId.value = null;
}

function onRegionEditModalClose() {
  const id = editingRegionId.value;
  if (id) {
    const r = regions.value.find(x => x.id === id);
    if (r?.isNew) {
      deleteRegion(id);
      return;
    }
  }
  editingRegionId.value = null;
}

function handleRegionDragEnd(regionId: string, deltaX: number, deltaY: number) {
  setRegions(prev => prev.map(r => (r.id === regionId ? { ...r, x: r.x + deltaX, y: r.y + deltaY } : r)));
  setBuildings(prev =>
    prev.map(b => (b.regionId === regionId ? { ...b, x: b.x + deltaX, y: b.y + deltaY } : b)),
  );
}

function handleAddBuildingAt(regionId: string, gx: number, gy: number) {
  const newBuilding: Building = {
    id: `b_${Date.now()}`,
    x: gx,
    y: gy,
    width: 1,
    height: 1,
    name: '',
    type: 'core',
    description: '',
    people: [],
    activities: [],
    rooms: [],
    customProperties: [],
    isNew: true,
    regionId: regionId,
  };
  setBuildings(prev => [...prev, newBuilding]);
  selectedId.value = newBuilding.id;
  isEditingPanel.value = true;
  if (scale.value < ZOOM_THRESHOLD) scale.value = 1;
}

function handleAddRegion() {
  if (!isGlobalEditMode.value) return;
  const newRegion: Region = {
    id: `r_${Date.now()}`,
    name: '新建区域',
    description: '一个刚刚建立的新区域。',
    x: 10 + Math.floor(Math.random() * 5) - 2,
    y: 10 + Math.floor(Math.random() * 5) - 2,
    width: 10,
    height: 10,
    icon: 'MapPin',
    color: '',
    isNew: true,
  };
  setRegions(prev => [...prev, newRegion]);
  editingRegionId.value = newRegion.id;
}

function onConfirmPickRegionForNewBuilding(regionId: string) {
  const region = regions.value.find(r => r.id === regionId);
  if (!region) return;
  showPickRegionForBuilding.value = false;
  const x = region.x + Math.floor(Math.random() * Math.max(1, region.width - 1));
  const y = region.y + Math.floor(Math.random() * Math.max(1, region.height - 1));
  handleAddBuildingAt(regionId, x, y);
  navigateToRegion(region);
}

function onSelectBuildingFromMap(b: Building) {
  const sel = selectedBuilding.value;
  if (sel?.isNew && sel.id !== b.id) {
    pendingNextSelectedId.value = b.id;
    pendingAction.value = 'close_panel';
    return;
  }
  selectedId.value = b.id;
  isEditingPanel.value = false;
}

function onOrphanBuildingClick(b: Building) {
  onSelectBuildingFromMap(b);
}

function onBuildingDragEnd(id: string, x: number, y: number) {
  updateBuilding(id, { x, y });
}

function onMapSurfacePointerDown(e: PointerEvent) {
  if (e.target !== mapSurfaceRef.value) return;
  mapPan.value = {
    active: true,
    startClientX: e.clientX,
    startClientY: e.clientY,
    panX0: panX.value,
    panY0: panY.value,
    pointerId: e.pointerId,
  };
  mapClickCandidate.value = { x: e.clientX, y: e.clientY };
  mapSurfaceRef.value.setPointerCapture(e.pointerId);
}

function onMapPanPointerMove(e: PointerEvent) {
  const p = mapPan.value;
  if (!p.active || e.pointerId !== p.pointerId) return;
  panX.value = p.panX0 + (e.clientX - p.startClientX);
  panY.value = p.panY0 + (e.clientY - p.startClientY);
  clampPan();
}

function onMapPanPointerUp(e: PointerEvent) {
  const p = mapPan.value;
  if (!p.active || e.pointerId !== p.pointerId) return;
  const dx = e.clientX - p.startClientX;
  const dy = e.clientY - p.startClientY;
  if (Math.hypot(dx, dy) < 5 && mapClickCandidate.value) {
    const c = mapClickCandidate.value;
    if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 5) {
      if (selectedBuilding.value?.isNew) {
        pendingAction.value = 'close_panel';
      } else {
        selectedId.value = null;
        isEditingPanel.value = false;
      }
    }
  }
  mapPan.value = { ...p, active: false };
  mapClickCandidate.value = null;
  try {
    mapSurfaceRef.value?.releasePointerCapture(e.pointerId);
  } catch {
    /* noop */
  }
}

function addActivityQuick() {
  const b = selectedBuilding.value;
  if (!b || !isGlobalEditMode.value) return;
  const newActivity: Activity = {
    id: `a_${Date.now()}`,
    name: '未命名事件',
    progress: 0,
    phase: 'upcoming',
    scope: 'collective',
  };
  updateBuilding(b.id, { activities: [...b.activities, newActivity] });
  isEditingPanel.value = true;
}

function onEditSave(updates: Partial<Building>) {
  const b = selectedBuilding.value;
  if (!b) return;
  updateBuilding(b.id, { ...updates, isNew: false });
  isEditingPanel.value = false;
}

function onGenerateStub() {
  toastr.info('AI 生成区域功能待接入');
  showGenerateModal.value = false;
  generatePrompt.value = '';
}

function openAiGenerate() {
  showGenerateModal.value = true;
}

function openAddRegion() {
  handleAddRegion();
}

function openAddBuilding() {
  if (!isGlobalEditMode.value) return;
  if (!regions.value.length) {
    toastr.warning('请先新建并保存至少一个区域');
    return;
  }
  showPickRegionForBuilding.value = true;
}

function openEventNavMobile() {
  showEventNavModal.value = true;
  mobileFabOpen.value = false;
}

function openCreateEventMobile() {
  showCreateEventModal.value = true;
  mobileFabOpen.value = false;
}

function onWorldSelectMobile(e: Event) {
  onWorldSelect(e);
}

function onMapUiThemeSelectMobile(e: Event) {
  onMapUiThemeSelect(e);
}

function toggleEditModeMobile() {
  toggleEditMode();
}

function quitEditModeFromMobileFab() {
  if (!isGlobalEditMode.value) return;
  toggleEditMode();
  if (!pendingAction.value) {
    mobileFabOpen.value = false;
  }
}

function openAiGenerateMobile() {
  showGenerateModal.value = true;
  mobileFabOpen.value = false;
}

function openAddRegionMobile() {
  handleAddRegion();
  mobileFabOpen.value = false;
}

function openAddBuildingMobile() {
  if (!regions.value.length) {
    toastr.warning('请先新建并保存至少一个区域');
    mobileFabOpen.value = false;
    return;
  }
  mobileFabOpen.value = false;
  showPickRegionForBuilding.value = true;
}

onMounted(() => {
  containerRef.value?.addEventListener('wheel', onWheel, { passive: false });
});

onUnmounted(() => {
  panTween?.kill();
  containerRef.value?.removeEventListener('wheel', onWheel);
});

watch(isGlobalEditMode, v => {
  if (!v) {
    isEditingPanel.value = false;
    const rid = editingRegionId.value;
    if (rid) {
      const r = regions.value.find(x => x.id === rid);
      if (r?.isNew) deleteRegion(rid);
      else editingRegionId.value = null;
    }
  }
});

watch(isMobileLayout, m => {
  if (m) {
    mapSettingsOpen.value = false;
  } else {
    mobileFabOpen.value = false;
  }
  showPickRegionForBuilding.value = false;
});
</script>

<style scoped lang="scss">
@use './tacticalMap/tm-modal-solid.scss' as tmModalSolid;
@use './tacticalMap/tm-modal-vivid.scss' as tmModalVivid;

.tm-modal--vivid-controls {
  @include tmModalVivid.tm-modal-vivid-controls;
}

.tactical-map-root {
  --bg-color: #020617;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --accent-color: #2dd4bf;
  --panel-bg: rgba(15, 23, 42, 0.85);
  --border-color: rgba(45, 212, 191, 0.3);
  --grid-color: rgba(45, 212, 191, 0.1);
  --building-bg: rgba(15, 23, 42, 0.9);
  --building-border: rgba(45, 212, 191, 0.4);
  --building-selected: #2dd4bf;
  --input-bg: rgba(2, 6, 23, 0.8);

  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 0.375rem;
  border: 1px solid rgba(45, 212, 191, 0.2);
}

.tactical-map-root.theme-western {
  --bg-color: #f4ebd8;
  --text-main: #3e2723;
  --text-muted: #795548;
  --accent-color: #8b5a2b;
  --panel-bg: rgba(232, 220, 196, 0.95);
  --border-color: rgba(139, 90, 43, 0.3);
  --grid-color: rgba(139, 90, 43, 0.15);
  --building-bg: rgba(232, 220, 196, 0.95);
  --building-border: rgba(139, 90, 43, 0.5);
  --building-selected: #8b5a2b;
  --input-bg: rgba(244, 235, 216, 0.8);
}

.tactical-map-root.theme-eastern {
  --bg-color: #e9e4d4;
  --text-main: #2c3e50;
  --text-muted: #546e7a;
  --accent-color: #2e7d32;
  --panel-bg: rgba(215, 208, 189, 0.95);
  --border-color: rgba(46, 125, 50, 0.3);
  --grid-color: rgba(44, 62, 80, 0.1);
  --building-bg: rgba(224, 218, 200, 0.95);
  --building-border: rgba(44, 62, 80, 0.4);
  --building-selected: #2e7d32;
  --input-bg: rgba(233, 228, 212, 0.8);
}

.tactical-map-root.theme-future {
  --bg-color: #09090b;
  --text-main: #f3e8ff;
  --text-muted: #a855f7;
  --accent-color: #d946ef;
  --panel-bg: rgba(24, 24, 27, 0.85);
  --border-color: rgba(217, 70, 239, 0.4);
  --grid-color: rgba(168, 85, 247, 0.15);
  --building-bg: rgba(24, 24, 27, 0.9);
  --building-border: rgba(168, 85, 247, 0.5);
  --building-selected: #d946ef;
  --input-bg: rgba(9, 9, 11, 0.8);
}

.tactical-map-root.theme-modern {
  --bg-color: #f8fafc;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --accent-color: #2563eb;
  --panel-bg: rgba(255, 255, 255, 0.95);
  --border-color: rgba(148, 163, 184, 0.4);
  --grid-color: rgba(148, 163, 184, 0.2);
  --building-bg: rgba(255, 255, 255, 0.95);
  --building-border: rgba(100, 116, 139, 0.4);
  --building-selected: #2563eb;
  --input-bg: rgba(241, 245, 249, 0.8);
}

.tactical-map--host-dark.tactical-map-root {
  border-color: rgba(45, 212, 191, 0.25);
  color-scheme: dark;
}

.tactical-map--host-light.tactical-map-root {
  border-color: rgba(148, 163, 184, 0.35);
  color-scheme: light;
}

.dynamic-bg {
  background-color: var(--bg-color);
  color: var(--text-main);
}

.dynamic-panel {
  background-color: var(--panel-bg);
  border-color: var(--border-color);
  backdrop-filter: blur(12px);
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
  border: 1px solid var(--border-color);
}

.dynamic-input {
  background-color: var(--input-bg);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.dynamic-grid {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center center;
  background-image:
    linear-gradient(to right, var(--grid-color) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-color) 1px, transparent 1px);
  background-size: 64px 64px;
}

.tm-topbar {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0.55rem 0.75rem;
  min-height: 3.5rem;
  padding: 0.45rem 0.65rem;
  z-index: 10;
  flex-shrink: 0;
  border-bottom-width: 1px;
  overflow: visible;
}

.tm-topbar-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex: 0 0 auto;
  align-self: center;
}

.tm-topbar-tray {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 0.4rem;
  flex: 1 1 auto;
  min-width: 0;
  margin-left: auto;
}

.tm-topbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.5rem;
  min-width: 0;
}

.tm-topbar-row--selects {
  /* 第一行：下拉条从左排开 */
  justify-content: flex-start;
}

.tm-topbar-row--actions {
  width: 100%;
  justify-content: flex-start;
  align-items: flex-start;
}

.tm-topbar-actions-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.5rem;
  flex: 1 1 auto;
  min-width: 0;
}

.tm-map-settings-wrap {
  position: relative;
  flex: 0 0 auto;
  margin-left: auto;
  align-self: center;
}

.tm-map-settings-pop {
  position: absolute;
  top: calc(100% + 0.3rem);
  right: 0;
  z-index: 40;
  min-width: 14rem;
  max-width: min(22rem, calc(100vw - 2rem));
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  border-radius: 0.5rem;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}

.tm-map-settings-field {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  min-width: 0;
}

.tm-map-settings-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.tm-map-settings-world-detail {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.45;
  max-height: 4.5rem;
  overflow-y: auto;
}

.tm-map-settings-select {
  width: 100%;
  max-width: 100%;
}

.tm-region-jump {
  width: 100%;
  max-width: min(22rem, 100%);
}

.tm-region-select {
  flex: 1 1 12rem;
  width: auto;
  min-width: 8rem;
  max-width: min(24rem, 100%);
}

.tm-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.tm-icon-lg {
  font-size: 1.25rem;
}

.tm-title {
  font-size: clamp(0.8rem, 2.8vw, 1rem);
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-title--brand-short {
  font-size: 1.05rem;
  letter-spacing: 0.08em;
}

.tm-select {
  border-radius: 0.375rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.8125rem;
  outline: none;
}

.tm-divider {
  width: 1px;
  height: 1.25rem;
  opacity: 0.25;
  background: currentcolor;
}

.tm-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 0.375rem;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

/* 描边按钮：浅色叠底，避免黑叠底在深色顶栏上发灰发闷 */
.tm-btn:hover:not(.tm-btn-primary):not(.tm-btn-toggle--on) {
  background: rgba(255, 255, 255, 0.09);
}

.tactical-map--host-light .tm-btn:hover:not(.tm-btn-primary):not(.tm-btn-toggle--on) {
  background: rgba(15, 23, 42, 0.07);
}

/* 主色 / 编辑开启：不再叠黑半透明，悬停整体提亮 */
.tm-btn-primary:hover,
.tm-btn-toggle--on:hover {
  filter: brightness(1.14);
}

.tm-btn-toggle--on {
  color: var(--bg-color);
  background: var(--accent-color);
  border-color: transparent;
}

.tm-btn-primary {
  color: var(--bg-color);
  background: var(--accent-color);
  border-color: transparent;
}

.tm-viewport {
  flex: 1 1 auto;
  position: relative;
  overflow: hidden;
  cursor: grab;
  min-height: 0;
}

.tm-edge-hints {
  position: absolute;
  inset: 0;
  z-index: 12;
  pointer-events: none;
}

.tm-edge-hint {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.4rem 0.15rem 0.3rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.2;
  max-width: min(8.5rem, 42vw);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  border-width: 1px;
}

.tm-edge-hint:hover {
  filter: brightness(1.08);
}

.tm-edge-hint-arrow {
  font-size: 0.55rem;
  flex-shrink: 0;
  display: inline-block;
}

.tm-edge-hint-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-viewport--grabbing {
  cursor: grabbing;
}

.tm-map-surface {
  will-change: transform;
  touch-action: none;
}

.tm-region {
  position: absolute;
  border-radius: 0.75rem;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.35s;
}

.tm-region--zoomed {
  border: 2px dashed var(--border-color);
  background-color: var(--grid-color);
}

.tm-region:not(.tm-region--zoomed) {
  border: 4px solid var(--border-color);
  background-color: var(--panel-bg);
}

.tm-region-header {
  padding: 0.4rem 0.75rem;
  width: fit-content;
  border-radius: 0 0 0.75rem 0;
}

.tm-region-header.dashed {
  border-style: dashed;
}

.tm-region-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.875rem;
}

.tm-region-title.large {
  font-size: 1.35rem;
}

.tm-region-desc {
  font-size: 0.7rem;
  margin-top: 0.15rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-region-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.tm-region-big-desc {
  text-align: center;
  max-width: 28rem;
  line-height: 1.6;
  font-size: 1.1rem;
  opacity: 0.75;
}

.tm-building {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tm-building--edit {
  cursor: move;
}

.tm-building:not(.tm-building--edit) {
  cursor: pointer;
}

.tm-building-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 0.5rem;
  border-width: 2px;
  border-style: solid;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s;
}

.tm-building--selected .tm-building-inner {
  border-color: var(--building-selected);
  box-shadow: 0 0 16px var(--building-selected);
}

.tm-building-icon {
  font-size: 1.75rem;
  opacity: 0.85;
}

.tm-building-ping {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentcolor;
  animation: tm-pulse 1.2s ease-in-out infinite;
}

@keyframes tm-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.tm-building-label {
  position: absolute;
  bottom: -1.35rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.65rem;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
  pointer-events: none;
}

.tm-zoom {
  position: absolute;
  bottom: env(safe-area-inset-bottom, 0px);
  left: env(safe-area-inset-left, 0px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border-radius: 0;
  overflow: hidden;

  .tm-zoom-btn {
    padding: 0.52rem 0.58rem;
    font-size: 1.05rem;
    line-height: 1;
    border-radius: 0;
    border: 1px solid var(--border-color);
    background: var(--panel-bg);
    cursor: pointer;
  }

  .tm-zoom-btn + .tm-zoom-btn {
    margin-top: -1px;
  }
}

.tm-topbar--mobile {
  flex-wrap: nowrap;
  align-items: center;
  min-height: auto;
  padding: 0.3rem 0.5rem;
  gap: 0.45rem;
}

.tm-topbar-brand--mobile {
  flex: 0 0 auto;
  min-width: 0;
}

.tm-topbar-mobile-region-wrap {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
}

.tm-topbar-mobile-region-select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  font-size: 0.75rem;
  padding: 0.3rem 0.45rem;
}

.tm-mobile-fab-layer {
  position: absolute;
  inset: 0;
  /* 高于区域边缘指示器 (z-index:18)，低于侧栏 (20)，保证悬浮抽屉与遮罩盖住箭头标签 */
  z-index: 19;
  pointer-events: none;
}

.tm-mobile-fab-backdrop {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.42);
}

.tm-mobile-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 16;
  /* 100%：不超过战术地图根节点高度，避免父级 overflow:hidden 裁掉抽屉上半截；85vh 在嵌套 iframe 里可能远大于可视区 */
  max-height: min(85vh, 600px, 100%);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  border-radius: 0.75rem 0.75rem 0 0;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  min-height: 0;
  overscroll-behavior: contain;
}

.tm-mobile-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  border-bottom-width: 1px;
  flex-shrink: 0;
}

.tm-mobile-sheet-head h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.tm-mobile-sheet-close {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1.1rem;
}

.tm-mobile-sheet-body {
  /* 父级只有 max-height、无固定 height 时，1 1 0 会把可滚动区压成一条缝；用 auto 基准由内容撑起，再用 min-height:0 在触顶 max-height 时可收缩并滚动 */
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.75rem 0.85rem 1rem;
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.tm-mobile-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tm-mobile-world-detail {
  margin: -0.15rem 0 0.1rem;
  font-size: 0.72rem;
  line-height: 1.45;
  max-height: 4rem;
  overflow-y: auto;
}

.tm-mobile-full {
  width: 100%;
  justify-content: center;
}

.tm-mobile-divider {
  height: 1px;
  margin: 0.15rem 0;
  border: none;
  background: var(--border-color);
  opacity: 0.6;
}

.tm-mobile-fab-stack {
  position: absolute;
  right: max(0.65rem, env(safe-area-inset-right, 0px));
  bottom: max(0.65rem, env(safe-area-inset-bottom, 0px));
  /* 低于遮罩与抽屉，打开菜单时悬浮球与「退出编辑」被压在面板下 */
  z-index: 14;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  pointer-events: auto;
}

.tm-mobile-fab {
  width: 3.1rem;
  height: 3.1rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  background: var(--accent-color);
  color: var(--bg-color);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}

.tm-mobile-quit-edit {
  max-width: 7.5rem;
  padding: 0.35rem 0.55rem;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.25;
  border-radius: 0.375rem;
  cursor: pointer;
  text-align: center;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28);
  white-space: normal;
}

.tm-mobile-fab--open {
  background: var(--panel-bg);
  color: var(--accent-color);
  border: 1px solid var(--border-color);
}

.tm-sheet-up-enter-active,
.tm-sheet-up-leave-active {
  transition:
    transform 0.22s ease,
    opacity 0.2s ease;
}

.tm-sheet-up-enter-from,
.tm-sheet-up-leave-to {
  transform: translateY(100%);
  opacity: 0.65;
}

@media (max-width: 639px) {
  .tm-sidebar {
    top: 2.55rem;
    width: min(22rem, 100vw);
  }
}

.tm-sidebar {
  position: absolute;
  right: 0;
  top: 3.25rem;
  bottom: 0;
  width: min(22rem, 92vw);
  z-index: 20;
  border-left-width: 1px;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
}

.tm-slide-enter-active,
.tm-slide-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.2s ease;
}

.tm-slide-enter-from,
.tm-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.tm-view-scroll {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tm-view-head {
  padding: 1.25rem;
  border-bottom-width: 1px;
  position: relative;
}

.tm-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem;
}

.tm-view-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.tm-view-icon-wrap {
  padding: 0.5rem;
  border-radius: 0.375rem;
  font-size: 1.25rem;
}

.tm-view-name {
  font-size: 1.2rem;
  font-weight: 700;
}

.tm-view-meta {
  font-size: 0.7rem;
  font-family: ui-monospace, monospace;
}

.tm-view-desc {
  font-size: 0.85rem;
  line-height: 1.5;
  margin-top: 0.75rem;
}

.tm-btn-block {
  width: 100%;
  justify-content: center;
  margin-top: 0.75rem;
}

.tm-section {
  padding: 1.25rem;
  border-bottom-width: 1px;
}

.tm-section-title {
  font-size: 0.75rem;
  font-weight: 700;
  margin-bottom: 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.tm-kv-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  gap: 0.5rem;
}

.mono {
  font-family: ui-monospace, monospace;
}

.small {
  font-size: 0.75rem;
}

.italic {
  font-style: italic;
}

.bold {
  font-weight: 600;
}

.tm-room-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
}

.tm-room-card {
  padding: 0.35rem;
  border-radius: 0.35rem;
  text-align: center;
}

.tm-btn-sm {
  margin-top: 0.35rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  border-radius: 0.25rem;
  cursor: pointer;
  background: transparent;
}

.tm-act-hint {
  margin: 0 0 0.5rem;
  line-height: 1.45;
}

.tm-activities {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tm-act-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.35rem;
  font-size: 0.8125rem;
}

.tm-act-title-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.tm-act-name {
  font-weight: 600;
}

.tm-act-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tm-tag {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  letter-spacing: 0.02em;
}

.tm-tag--phase {
  color: var(--accent-color);
  border-width: 1px;
  border-style: solid;
  border-color: var(--border-color);
  background: rgba(0, 0, 0, 0.12);
}

.tm-tag--scope {
  border-width: 1px;
  border-style: solid;
  font-weight: 600;
}

.tm-act-pct {
  flex-shrink: 0;
  font-size: 0.75rem;
}

.tm-progress {
  height: 5px;
  border-radius: 999px;
  overflow: hidden;
  margin-top: 0.2rem;
}

.tm-progress-bar {
  height: 100%;
  background: currentcolor;
}

.tm-people {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tm-person {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.65rem;
  border-radius: 0.35rem;
}

.tm-person .tag {
  font-size: 0.65rem;
  padding: 0.15rem 0.35rem;
  border-radius: 0.25rem;
  border: 1px solid var(--border-color);
}

.tm-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}

.tm-modal-overlay--scheme-dark {
  color-scheme: dark;
}

.tm-modal-overlay--scheme-light {
  color-scheme: light;
}

.tm-modal {
  width: min(480px, 94vw);
  border-radius: 0.75rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

.tm-modal--solid-bg {
  @include tmModalSolid.tm-modal-solid-surface;
}

.tm-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.1rem;
  border-bottom-width: 1px;
  position: relative;
}

.tm-modal-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tm-modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.tm-textarea {
  width: 100%;
  border-radius: 0.375rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.8125rem;
  resize: none;
  outline: none;
}

.tm-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-top-width: 1px;
  background: rgba(0, 0, 0, 0.06);
}

.tm-fade-enter-active,
.tm-fade-leave-active {
  transition: opacity 0.2s ease;
}

.tm-fade-enter-from,
.tm-fade-leave-to {
  opacity: 0;
}
</style>
