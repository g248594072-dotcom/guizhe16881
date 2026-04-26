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
              AI 创建活动
            </button>
            <button
              v-if="!isGlobalEditMode"
              type="button"
              class="tm-btn tm-btn-primary"
              @click="openAiGenerate"
            >
              <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
              AI 生成区域
            </button>
            <button
              v-if="!isGlobalEditMode"
              type="button"
              class="tm-btn tm-btn-primary"
              @click="openAiBuildingsModal"
            >
              <i class="fa-solid fa-building" aria-hidden="true"></i>
              AI 创建建筑
            </button>
            <button
              type="button"
              class="tm-btn dynamic-border dynamic-text"
              :class="{ 'tm-btn-exit-edit': isGlobalEditMode, 'tm-btn-toggle': !isGlobalEditMode }"
              @click="toggleEditMode"
            >
              <i :class="isGlobalEditMode ? 'fa-solid fa-eye' : 'fa-solid fa-pen-to-square'" aria-hidden="true"></i>
              {{ isGlobalEditMode ? '退出编辑模式' : '进入编辑模式' }}
            </button>
            <template v-if="isGlobalEditMode">
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
              <div class="tm-map-settings-field">
                <span class="tm-map-settings-label dynamic-text-muted">本地存档</span>
                <button type="button" class="tm-btn tm-map-settings-save dynamic-border dynamic-text" @click="onSaveMapToBrowser">
                  <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
                  保存地图到浏览器
                </button>
                <button
                  type="button"
                  class="tm-btn tm-map-settings-save dynamic-border dynamic-text"
                  :disabled="!tacticalMapDraftDirty"
                  title="根据当前地图与变量差异生成 JSON Patch 写入酒馆发送框，随后把地图语义写入 MVU，并保存本机地图缓存。"
                  @click="confirmMapDraft"
                >
                  <i class="fa-solid fa-check" aria-hidden="true"></i>
                  确认应用（变量+发送框）
                </button>
                <button
                  type="button"
                  class="tm-btn tm-map-settings-save dynamic-border dynamic-text"
                  :disabled="!tacticalMapDraftDirty"
                  title="撤销自上次确认以来的所有地图编辑，恢复为上次确认时的地图（不写变量、不写发送框）。"
                  @click="discardMapDraft"
                >
                  <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
                  放弃修改
                </button>
                <button type="button" class="tm-btn tm-map-settings-save dynamic-border dynamic-text" @click="onPullVariablesToMap">
                  <i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i>
                  从变量同步到地图
                </button>
                <p class="tm-map-settings-save-hint dynamic-text-muted">
                  按当前聊天（chatScopeId）分别写入本机 localStorage；布局与视图会随编辑防抖保存为草稿。区域/建筑/活动语义须点「确认应用」才写入 MVU，并生成 JSON Patch 追加到酒馆发送框；切换子标签离开地图前若有未确认修改将提示。变量侧若有新数据未反映到格子，可点「从变量同步到地图」。缩放过小时建筑标记会隐藏，可用左下角放大。
                </p>
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

    <!-- 未确认的地图草稿（语义与布局） -->
    <div
      v-if="tacticalMapDraftDirty"
      class="tm-draft-banner dynamic-panel dynamic-border"
      role="status"
    >
      <div class="tm-draft-banner-text dynamic-text">
        <i class="fa-solid fa-triangle-exclamation dynamic-accent" aria-hidden="true"></i>
        当前有未提交的地图修改。请点<strong class="dynamic-text">确认应用</strong>写入变量并生成 JSON Patch 到发送框，或<strong class="dynamic-text">放弃修改</strong>还原到上次确认状态。
      </div>
      <div class="tm-draft-banner-actions">
        <button
          type="button"
          class="tm-btn tm-btn-primary"
          title="对比当前地图与变量 → Patch 写入发送框 → 同步变量 → 保存浏览器缓存。"
          @click="confirmMapDraft"
        >
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          确认应用
        </button>
        <button
          type="button"
          class="tm-btn dynamic-border dynamic-text"
          title="恢复为上次确认时的地图，丢弃未提交编辑。"
          @click="discardMapDraft"
        >
          放弃修改
        </button>
      </div>
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

    <!-- 第二 API 地图生成：待确认写入酒馆发送框 -->
    <div
      v-if="pendingTacticalAiInsert"
      class="tm-pending-ai-banner dynamic-panel dynamic-border"
      role="region"
      aria-live="polite"
    >
      <div class="tm-pending-ai-title-row">
        <div class="tm-pending-ai-title dynamic-text">
          <i class="fa-solid fa-clipboard-check dynamic-accent" aria-hidden="true"></i>
          地图变量待确认（第二 API）
        </div>
        <span v-if="pendingAiPreview" class="tm-pending-ai-badge dynamic-text-muted"
          >{{ pendingAiPreview.patchCount }} 条 Patch</span
        >
      </div>

      <div v-if="pendingAiPreview && pendingAiPreview.items.length > 0" class="tm-pending-ai-scroll">
        <p class="tm-pending-ai-intro dynamic-text-muted">
          本次将写入以下内容；点击条目查看完整字段。建筑下列出内部房间，活动下列出参与者（建筑内为当前角色）。
        </p>
        <ul class="tm-pending-ai-list" role="list">
          <li v-for="it in pendingAiPreview.items" :key="`${it.kind}-${it.id}`" class="tm-pending-ai-li">
            <button
              type="button"
              class="tm-pending-ai-row"
              :aria-label="`查看 ${tacticalAiPreviewKindLabel(it.kind)} ${it.title} 详情`"
              @click="pendingAiDetailItem = it"
            >
              <span class="tm-pending-ai-row-top">
                <span class="tm-pending-ai-kind">{{ tacticalAiPreviewKindLabel(it.kind) }}</span>
                <span class="tm-pending-ai-name">{{ it.title }}</span>
                <code class="tm-pending-ai-id">{{ it.id }}</code>
              </span>
              <span v-if="it.subtitle" class="tm-pending-ai-sub dynamic-text-muted">{{ it.subtitle }}</span>
              <span v-if="it.rooms.length" class="tm-pending-ai-meta"
                >内部房间：{{ it.rooms.join('、') }}</span
              >
              <span v-if="it.people.length" class="tm-pending-ai-meta"
                >{{
                  it.kind === 'activity' ? '参与者' : it.kind === 'building' ? '当前角色' : '人员'
                }}：{{ it.people.join('、') }}</span
              >
            </button>
          </li>
        </ul>
      </div>
      <p v-else-if="pendingAiPreview" class="tm-pending-ai-fallback dynamic-text-muted">
        本批 Patch 未命中区域/建筑/活动路径，请展开底部「原始变量」核对是否含其它字段修改。
      </p>
      <p v-else class="tm-pending-ai-fallback dynamic-text-muted">
        无法从原文解析 Patch 结构，请展开底部「原始变量」核对；若格式明显错误可点「丢弃」后重试生成。
      </p>

      <details class="tm-pending-ai-raw">
        <summary class="tm-pending-ai-raw-summary dynamic-text">查看原始变量（JSON Patch）</summary>
        <textarea
          readonly
          class="tm-pending-ai-textarea tm-pending-ai-textarea--raw dynamic-input dynamic-border dynamic-text"
          :value="pendingTacticalAiInsert.fullSend"
          rows="8"
          aria-label="待发送的完整变量块"
        />
      </details>

      <p class="tm-pending-ai-hint dynamic-text-muted">
        确认后将写入<strong class="dynamic-text">MVU 变量</strong>并<strong class="dynamic-text">刷新地图</strong>；同一批
        JSON Patch 会暂存，在你下次于本界面发送对话时自动附在消息末尾（与地图「确认应用」共用待发队列）。
      </p>
      <div class="tm-pending-ai-actions">
        <button type="button" class="tm-btn tm-btn-primary" @click="confirmPendingTacticalAiInsert">
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          确认并应用
        </button>
        <button type="button" class="tm-btn dynamic-border dynamic-text" @click="dismissPendingTacticalAiInsert">
          丢弃
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="pendingAiDetailItem"
        class="tm-pending-ai-detail-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tm-pending-ai-detail-title"
        @click.self="pendingAiDetailItem = null"
      >
        <div class="tm-pending-ai-detail-card dynamic-panel dynamic-border" @click.stop>
          <div class="tm-pending-ai-detail-head">
            <h2 id="tm-pending-ai-detail-title" class="tm-pending-ai-detail-title dynamic-text">
              {{ tacticalAiPreviewKindLabel(pendingAiDetailItem.kind) }} · {{ pendingAiDetailItem.title }}
            </h2>
            <button
              type="button"
              class="tm-pending-ai-detail-close dynamic-text-muted"
              aria-label="关闭"
              @click="pendingAiDetailItem = null"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <p class="tm-pending-ai-detail-id"><code>{{ pendingAiDetailItem.id }}</code></p>
          <pre class="tm-pending-ai-detail-pre dynamic-text">{{
            JSON.stringify(pendingAiDetailItem.detail, null, 2)
          }}</pre>
        </div>
      </div>
    </Teleport>

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
              <button type="button" class="tm-btn tm-btn-primary tm-mobile-full" @click="openAiGenerateMobile">
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                AI 生成区域
              </button>
              <button type="button" class="tm-btn tm-btn-primary tm-mobile-full" @click="openAiBuildingsModalMobile">
                <i class="fa-solid fa-building" aria-hidden="true"></i>
                AI 创建建筑
              </button>
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
              <button type="button" class="tm-btn tm-mobile-full dynamic-border dynamic-text" @click="onSaveMapToBrowser">
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
                保存地图到浏览器
              </button>
              <details class="tm-mobile-more dynamic-border">
                <summary class="tm-mobile-more-summary dynamic-text">
                  <span>更多：草稿与变量</span>
                  <i class="fa-solid fa-chevron-down tm-mobile-more-chevron" aria-hidden="true"></i>
                </summary>
                <div class="tm-mobile-more-body">
                  <button
                    type="button"
                    class="tm-btn tm-mobile-full dynamic-border dynamic-text"
                    :disabled="!tacticalMapDraftDirty"
                    title="对比地图与变量 → Patch 入发送框 → 同步变量 → 存浏览器。"
                    @click="confirmMapDraftMobile"
                  >
                    <i class="fa-solid fa-check" aria-hidden="true"></i>
                    确认应用（变量+发送框）
                  </button>
                  <button
                    type="button"
                    class="tm-btn tm-mobile-full dynamic-border dynamic-text"
                    :disabled="!tacticalMapDraftDirty"
                    title="恢复上次确认的地图，丢弃草稿。"
                    @click="discardMapDraftMobile"
                  >
                    <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
                    放弃修改
                  </button>
                  <button type="button" class="tm-btn tm-mobile-full dynamic-border dynamic-text" @click="onPullVariablesToMapMobile">
                    <i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i>
                    从变量同步到地图
                  </button>
                </div>
              </details>
            </template>
            <template v-else>
              <button type="button" class="tm-btn tm-btn-primary tm-mobile-full" @click="openCreateEventMobile">
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                AI 创建活动
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
                <p class="tm-view-meta dynamic-text-muted">{{ selectedBuilding.width }}×{{ selectedBuilding.height }}</p>
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
                <div class="tm-act-row">
                  <div class="tm-act-body">
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
                    <div class="tm-progress dynamic-border">
                      <div class="tm-progress-bar dynamic-accent" :style="{ width: `${act.progress}%` }" />
                    </div>
                  </div>
                  <div class="tm-act-side">
                    <span class="dynamic-accent mono tm-act-pct">{{ act.progress }}%</span>
                    <button
                      type="button"
                      class="tm-act-quick-join dynamic-border dynamic-text"
                      title="快速参加"
                      aria-label="快速参加"
                      @click="quickJoinSelectedBuildingActivity(act)"
                    >
                      <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
                      <span class="tm-act-quick-join__text">参加</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="tm-section">
            <h3 class="tm-section-title dynamic-text">
              <i class="fa-solid fa-users dynamic-accent" aria-hidden="true"></i>
              在场人员
            </h3>
            <p v-if="selectedBuilding.people.length === 0" class="dynamic-text-muted italic">暂无在场人员。</p>
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
            <div class="tm-modal-body tm-modal-body--region-ai">
              <p class="dynamic-text-muted small">
                将使用<strong class="dynamic-text">第二 API</strong>发起生成；若未配置或调用失败，会自动改用与主对话相同的<strong class="dynamic-text">主连接（第一 API）</strong>。
              </p>
              <div class="tm-region-ai-row">
                <label class="dynamic-text small bold" for="tm-ai-region-count">一次生成区域数</label>
                <select
                  id="tm-ai-region-count"
                  v-model.number="aiRegionCount"
                  class="tm-select tm-modal-select dynamic-input dynamic-border dynamic-text"
                >
                  <option v-for="n in 5" :key="n" :value="n">{{ n }} 个</option>
                </select>
              </div>
              <div class="tm-region-ai-row">
                <label class="dynamic-text small bold" for="tm-ai-bpr">每区域新建筑数</label>
                <select
                  id="tm-ai-bpr"
                  v-model.number="aiBuildingsPerRegion"
                  class="tm-select tm-modal-select dynamic-input dynamic-border dynamic-text"
                >
                  <option v-for="m in 4" :key="m + 1" :value="m + 1">{{ m + 1 }} 座</option>
                </select>
              </div>
              <div class="tm-region-theme-block dynamic-border">
                <div class="tm-region-theme-toolbar">
                  <span class="dynamic-text small bold">区域主题（可选）</span>
                  <button
                    type="button"
                    class="tm-btn tm-btn--compact dynamic-border dynamic-text"
                    :disabled="tacticalAiBusy"
                    @click="addRegionThemeRow"
                  >
                    <i class="fa-solid fa-plus" aria-hidden="true"></i>
                    添加一条
                  </button>
                </div>
                <p class="dynamic-text-muted tm-region-theme-hint small">
                  自上而下对应<strong class="dynamic-text">第一个、第二个</strong>…新区域。留空或条数少于「区域数」时，未写的区域按世界观随机；多于区域数时只取最前面几条。
                </p>
                <ul v-if="regionThemeRows.length > 0" class="tm-region-theme-list" role="list">
                  <li v-for="(_row, idx) in regionThemeRows" :key="idx" class="tm-region-theme-item dynamic-border">
                    <span class="tm-region-theme-badge dynamic-text-muted">{{ cnOrdinalNthOneBased(idx + 1) }}</span>
                    <input
                      v-model="regionThemeRows[idx]"
                      type="text"
                      class="tm-region-theme-input dynamic-input dynamic-border dynamic-text"
                      :placeholder="'例如：商业街、废弃教堂…（可留空表示本区随机）'"
                      :aria-label="`${cnOrdinalNthOneBased(idx + 1)}新区域的主题`"
                    />
                    <button
                      type="button"
                      class="tm-btn-icon dynamic-text-muted"
                      :aria-label="`删除${cnOrdinalNthOneBased(idx + 1)}主题`"
                      :disabled="tacticalAiBusy"
                      @click="removeRegionThemeRow(idx)"
                    >
                      <i class="fa-solid fa-trash" aria-hidden="true"></i>
                    </button>
                  </li>
                </ul>
                <p v-else class="dynamic-text-muted small tm-region-theme-empty">暂无主题条目，将<strong class="dynamic-text">全部</strong>按世界观随机生成。</p>
              </div>
            </div>
            <div class="tm-modal-foot dynamic-border">
              <button type="button" class="tm-btn dynamic-text" :disabled="tacticalAiBusy" @click="showGenerateModal = false">
                取消
              </button>
              <button
                type="button"
                class="tm-btn tm-btn-primary"
                :disabled="tacticalAiBusy"
                @click="onAiGenerateRegionSubmit"
              >
                <i
                  class="fa-solid"
                  :class="tacticalAiBusy ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"
                  aria-hidden="true"
                ></i>
                {{ tacticalAiBusy ? '生成中…' : '开始生成' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="tm-fade">
        <div
          v-if="showAiBuildingsModal"
          class="tm-modal-overlay"
          :class="isDarkMode ? 'tm-modal-overlay--scheme-dark' : 'tm-modal-overlay--scheme-light'"
          @click.self="showAiBuildingsModal = false"
        >
          <div
            class="tm-modal tm-modal--solid-bg tm-modal--vivid-controls dynamic-panel dynamic-border"
            role="dialog"
            aria-labelledby="tm-ai-buildings-title"
          >
            <div class="tm-modal-head dynamic-border">
              <div class="tm-modal-title-row">
                <i class="fa-solid fa-building dynamic-accent" aria-hidden="true"></i>
                <h2 id="tm-ai-buildings-title" class="dynamic-text">AI 创建建筑</h2>
              </div>
              <button type="button" class="tm-close dynamic-text-muted" aria-label="关闭" @click="showAiBuildingsModal = false">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
            <div class="tm-modal-body">
              <p class="dynamic-text-muted small">
                使用<strong class="dynamic-text">设置中的第二 API</strong>，按格子生成<strong class="dynamic-text">1～5</strong> 座建筑；每座须含<strong class="dynamic-text">名称、简介、内部房间布局（rooms）、活动（activities）、在场人员（people）</strong>，提示词含 R18 破限。世界观参考：<strong class="dynamic-text">{{ THEMES[worldTheme].name }}</strong>。
              </p>
              <label class="dynamic-text small bold" for="tm-ai-buildings-region">目标区域</label>
              <select
                id="tm-ai-buildings-region"
                v-model="aiBuildingsRegionId"
                class="tm-select tm-modal-select dynamic-input dynamic-border dynamic-text"
              >
                <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
              <label class="dynamic-text small bold" for="tm-ai-buildings-count">生成数量</label>
              <select
                id="tm-ai-buildings-count"
                v-model.number="aiBuildingsCount"
                class="tm-select tm-modal-select dynamic-input dynamic-border dynamic-text"
              >
                <option v-for="n in 5" :key="n" :value="n">{{ n }} 座</option>
              </select>
              <label class="dynamic-text small bold" for="tm-ai-buildings-hint">建筑需求描述（可选）</label>
              <textarea
                id="tm-ai-buildings-hint"
                v-model="aiBuildingsPrompt"
                rows="3"
                class="tm-textarea dynamic-input dynamic-border dynamic-text"
                placeholder="例如：要一座带停机坪的指挥塔、两座仓库、一座医疗站… 留空则由模型结合区域简介发挥。"
              />
            </div>
            <div class="tm-modal-foot dynamic-border">
              <button type="button" class="tm-btn dynamic-text" :disabled="tacticalAiBusy" @click="showAiBuildingsModal = false">
                取消
              </button>
              <button
                type="button"
                class="tm-btn tm-btn-primary"
                :disabled="tacticalAiBusy || !regions.length"
                @click="onAiCreateBuildingsSubmit"
              >
                <i
                  class="fa-solid"
                  :class="tacticalAiBusy ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"
                  aria-hidden="true"
                ></i>
                {{ tacticalAiBusy ? '生成中…' : '开始生成' }}
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
      <TacticalMapEventNavModal
        v-if="showEventNavModal"
        :regions="regions"
        :buildings="buildings"
        @close="showEventNavModal = false"
        @navigate="onEventNavNavigate"
        @copy-to-input="(t: string) => emit('copyToInput', t)"
      />
      <TacticalMapCreateEventModal
        v-if="showCreateEventModal"
        :regions="regions"
        @close="showCreateEventModal = false"
        @request-ai="onCreateEventAiRequest"
      />
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
import { klona } from 'klona';
import { isEqual } from 'lodash';
import { onClickOutside, useMediaQuery } from '@vueuse/core';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type {
  Activity,
  ActivityPhase,
  Building,
  BuildingType,
  MapStyle,
  Person,
  Region,
  Room,
  World,
} from './tacticalMap/types';
import { normalizeWorld } from './tacticalMap/migrate';
import { buildTacticalMapDraftChangeLines } from '../utils/tacticalMapDraftChangeSummary';
import {
  getChatScopeId,
  loadPersisted,
  savePersisted,
  type TacticalMapPersisted,
} from '../utils/tacticalMapBrowserStorage';
import {
  buildTacticalMvuMapRecordsFromWorld,
  buildWorldFromMvuStat,
  exportTacticalWorldToMvu,
  syncWorldFromMvu,
} from '../utils/tacticalMapMvuBridge';
import {
  buildTacticalMapJsonPatchesForMvuCommit,
  type TacticalMapCommitPatchOp,
  type TacticalMvuMapRecordsSnapshot,
} from '../utils/tacticalMapCommitSendBox';
import { parseTacticalMvuMapTripleSnapshot } from '../schema';
import {
  buildTacticalActivityUserPrompt,
  buildTacticalAiRegionSystemPrompt,
  buildTacticalMapBuildingsUserPrompt,
  buildTacticalRegionUserPrompt,
  buildPerRegionThemeHintsFromList,
  TACTICAL_AI_ACTIVITY_SYSTEM,
  TACTICAL_AI_MAP_BUILDINGS_SYSTEM,
} from '../utils/tacticalMapAiGeneratePrompts';
import {
  formatTacticalMapAiOutputForSendBox,
  isProbablyTruncatedJsonArray,
  runTacticalMapSecondaryGenerate,
} from '../utils/tacticalMapSecondaryGenerate';
import { useEditCartStore } from '../stores/editCart';
import { appendPendingTacticalMapPatches } from '../utils/pendingTacticalMapUpdateVariable';
import { buildTacticalMapCartItem, isEditCartEnabled } from '../utils/editCartFlow';
import { applyJsonPatch, extractJsonPatchFromTacticalAiBlock } from '../utils/jsonPatchStat';
import {
  parseTacticalAiPatchPreview,
  type TacticalAiPreviewItem,
  type TacticalAiPreviewKind,
} from '../utils/tacticalAiPatchPreview';
import { getSecondaryApiConfig } from '../utils/apiSettings';
import { bumpUpdateTime, tryRulesMvuWritable, useDataStore } from '../store';
import { CELL_SIZE, THEMES, TYPE_CONFIG, ZOOM_THRESHOLD } from './tacticalMap/themePresets';
import { ICON_MAP } from './tacticalMap/iconMap';
import TacticalMapEditForm from './TacticalMapEditForm.vue';
import TacticalMapRegionBlock from './TacticalMapRegionBlock.vue';
import TacticalMapBuildingMarker from './TacticalMapBuildingMarker.vue';
import TacticalMapRegionIndicator from './tacticalMap/TacticalMapRegionIndicator.vue';
import TacticalMapRegionEditModal from './tacticalMap/TacticalMapRegionEditModal.vue';
import TacticalMapEventNavModal from './tacticalMap/TacticalMapEventNavModal.vue';
import TacticalMapCreateEventModal from './tacticalMap/TacticalMapCreateEventModal.vue';
import TacticalMapNewBuildingWarningModal from './tacticalMap/TacticalMapNewBuildingWarningModal.vue';
import TacticalMapPickRegionForBuildingModal from './tacticalMap/TacticalMapPickRegionForBuildingModal.vue';
import { formatQuickJoinActivityLine } from '../utils/tacticalMapQuickJoin';

defineProps<{ isDarkMode: boolean }>();
const emit = defineEmits<{
  copyToInput: [text: string];
}>();

function resolveActivityPhase(a: Activity): ActivityPhase {
  return a.phase ?? 'ongoing';
}

function activityPhaseLabel(a: Activity): string {
  const p = resolveActivityPhase(a);
  if (p === 'upcoming') return '即将举办';
  if (p === 'ended') return '已结束';
  if (p === 'cancelled') return '已取消';
  return '进行中';
}

function activityScopeLabel(a: Activity): string {
  if (a.scope === 'personal') return '个人';
  if (a.scope === 'collective') return '集体';
  return '';
}

const MAP_SIZE = 4000;
const MAP_HALF = MAP_SIZE / 2;

/**
 * 将视口对准「区域 + 建筑」包围盒中心（与 navigateToRegion 使用同一套 map 坐标）。
 * MVU 占位格往往在 (4,4) 一带，而默认 pan=0 对准画布中心 (2000,2000)，会导致「有数据但地图一片空白」。
 */
function computePanToCenterWorld(w: World): { panX: number; panY: number } | null {
  const regs = w.regions ?? [];
  const blds = w.buildings ?? [];
  if (!regs.length && !blds.length) return null;

  let minGx = Infinity;
  let minGy = Infinity;
  let maxGx = -Infinity;
  let maxGy = -Infinity;

  for (const r of regs) {
    minGx = Math.min(minGx, r.x);
    minGy = Math.min(minGy, r.y);
    maxGx = Math.max(maxGx, r.x + r.width);
    maxGy = Math.max(maxGy, r.y + r.height);
  }
  for (const b of blds) {
    minGx = Math.min(minGx, b.x);
    minGy = Math.min(minGy, b.y);
    maxGx = Math.max(maxGx, b.x + b.width);
    maxGy = Math.max(maxGy, b.y + b.height);
  }
  if (!Number.isFinite(minGx)) return null;

  const cx = ((minGx + maxGx) / 2) * CELL_SIZE;
  const cy = ((minGy + maxGy) / 2) * CELL_SIZE;
  return { panX: MAP_HALF - cx, panY: MAP_HALF - cy };
}

function countMapEntities(w: World): number {
  return (w.regions?.length ?? 0) + (w.buildings?.length ?? 0);
}

/** 无浏览器档：空白图 + 当前 MVU 语义（与 buildWorldFromMvuStat 一致） */
function tacticalPersistedWhenNoBrowser(): TacticalMapPersisted {
  const store = useDataStore();
  const world = buildWorldFromMvuStat(store.data);
  const panHint = computePanToCenterWorld(world);
  return {
    schemaVersion: 2,
    world: klona(world) as World,
    mapUiTheme: world.theme,
    panX: panHint?.panX ?? 0,
    panY: panHint?.panY ?? 0,
    scale: 1,
  };
}

/** 当前聊天文件 id，用于 localStorage 分档；切换聊天时在 CHAT_CHANGED 内更新 */
const chatScopeTracked = ref(getChatScopeId());
const initLoaded = loadPersisted(chatScopeTracked.value);
const dataStore = useDataStore();
const initialWorld: World = initLoaded
  ? syncWorldFromMvu(normalizeWorld(klona(initLoaded.world)), dataStore.data)
  : buildWorldFromMvuStat(dataStore.data);

const initialPanHint = computePanToCenterWorld(initialWorld);
const persistedWorldWasEmpty =
  !!initLoaded && !(initLoaded.world.regions?.length) && !(initLoaded.world.buildings?.length);

const initialPersisted: TacticalMapPersisted = initLoaded
  ? {
      ...initLoaded,
      world: initialWorld,
      ...(persistedWorldWasEmpty && initialPanHint
        ? { panX: initialPanHint.panX, panY: initialPanHint.panY }
        : {}),
    }
  : {
      schemaVersion: 2,
      world: initialWorld,
      mapUiTheme: initialWorld.theme,
      panX: initialPanHint?.panX ?? 0,
      panY: initialPanHint?.panY ?? 0,
      scale: 1,
    };

const mapWorld = ref<World>(normalizeWorld(klona(initialPersisted.world)));
/** 上次「确认应用」后的地图快照；与 mapWorld 比较得到是否有未提交草稿 */
const committedMapWorld = ref<World>(normalizeWorld(klona(mapWorld.value)));
/** 用于 MVU 首次写入区域/建筑时自动把镜头从「画布中心」移到实体包围盒（避免看起来像空图） */
const prevEntityCountForMvuAutoPan = ref(countMapEntities(mapWorld.value));
const tacticalMapDraftDirty = computed(
  () => !isEqual(normalizeWorld(klona(mapWorld.value)), normalizeWorld(klona(committedMapWorld.value))),
);
const buildings = computed(() => mapWorld.value.buildings ?? []);
const regions = computed(() => mapWorld.value.regions ?? []);

/** 世界数据上的「机场风格」，与界面配色 mapUiTheme 独立 */
const worldTheme = computed<MapStyle>(() => mapWorld.value.theme ?? 'modern');
/** 仅控制地图界面配色，不修改当前世界数据 */
const mapUiTheme = ref<MapStyle>(initLoaded ? initLoaded.mapUiTheme : initialWorld.theme);

const orphanBuildings = computed(() => buildings.value.filter(b => !b.regionId));

const selectedId = ref<string | null>(null);
const isEditingPanel = ref(false);
const isGlobalEditMode = ref(false);
const scale = ref(initialPersisted.scale);
const showGenerateModal = ref(false);
/** 按顺序：第 i 条对应第 i 个新区域主题；可少于「一次生成区域数」，缺的按世界观随机 */
const regionThemeRows = ref<string[]>([]);
const aiRegionCount = ref(1);
const aiBuildingsPerRegion = ref(3);

function addRegionThemeRow() {
  regionThemeRows.value = [...regionThemeRows.value, ''];
}

function removeRegionThemeRow(index: number) {
  regionThemeRows.value = regionThemeRows.value.filter((_, i) => i !== index);
}

/** 行标签：1 → 第一个，2 → 第二个 … */
function cnOrdinalNthOneBased(n: number): string {
  const x = Math.floor(Math.max(1, n));
  const d = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (x <= 10) {
    if (x === 10) return '第十个';
    return `第${d[x]}个`;
  }
  if (x < 20) return `第十${d[x - 10]}个`;
  return `第${x}个`;
}
const showAiBuildingsModal = ref(false);
const aiBuildingsRegionId = ref('');
const aiBuildingsCount = ref(1);
const aiBuildingsPrompt = ref('');
const editingRegionId = ref<string | null>(null);
const showEventNavModal = ref(false);
const showCreateEventModal = ref(false);
/** 第二 API：地图专用生成进行中 */
const tacticalAiBusy = ref(false);
/** 生成完成、待用户确认写入酒馆发送框 */
const pendingTacticalAiInsert = ref<{ kind: 'region' | 'activity'; fullSend: string } | null>(null);

const pendingAiPreview = computed(() => {
  const p = pendingTacticalAiInsert.value;
  if (!p?.fullSend) return null;
  return parseTacticalAiPatchPreview(p.fullSend);
});

const pendingAiDetailItem = ref<TacticalAiPreviewItem | null>(null);

watch(pendingTacticalAiInsert, () => {
  pendingAiDetailItem.value = null;
});

function tacticalAiPreviewKindLabel(kind: TacticalAiPreviewKind): string {
  if (kind === 'region') return '区域';
  if (kind === 'building') return '建筑';
  return '活动';
}
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

const panX = ref(initialPersisted.panX);
const panY = ref(initialPersisted.panY);
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
let stopTacticalMapChatListener: (() => void) | null = null;

const selectedBuilding = computed(() => buildings.value.find(b => b.id === selectedId.value) ?? null);

/** 侧栏 / 快速参加：解析建筑所属区域名称 */
function regionNameForBuilding(b: Building): string {
  const rid = (b.regionId ?? '').trim();
  if (rid) {
    const r = regions.value.find(x => x.id === rid);
    if (r?.name) return r.name;
  }
  const cx = b.x + (b.width ?? 1) / 2;
  const cy = b.y + (b.height ?? 1) / 2;
  for (const r of regions.value) {
    if (cx >= r.x && cx < r.x + r.width && cy >= r.y && cy < r.y + r.height) {
      return r.name;
    }
  }
  return '未知区域';
}

function quickJoinSelectedBuildingActivity(act: Activity) {
  const b = selectedBuilding.value;
  if (!b) return;
  emit('copyToInput', formatQuickJoinActivityLine(regionNameForBuilding(b), b.name, act.name));
}
const editingRegion = computed(() => regions.value.find(r => r.id === editingRegionId.value) ?? null);
const showBuildings = computed(() => scale.value >= ZOOM_THRESHOLD);

const themeClass = computed(() => THEMES[mapUiTheme.value].className);

const mapSurfaceStyle = computed(() => ({
  width: `${MAP_SIZE}px`,
  height: `${MAP_SIZE}px`,
  transform: `translate(calc(-50% + ${panX.value}px), calc(-50% + ${panY.value}px)) scale(${scale.value})`,
}));

function setBuildings(updater: Building[] | ((prev: Building[]) => Building[])) {
  const w = mapWorld.value;
  const next = typeof updater === 'function' ? updater([...w.buildings]) : updater;
  mapWorld.value = { ...w, buildings: next };
}

function setRegions(updater: Region[] | ((prev: Region[]) => Region[])) {
  const w = mapWorld.value;
  const next = typeof updater === 'function' ? updater([...w.regions]) : updater;
  mapWorld.value = { ...w, regions: next };
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

function clampPan() {
  const lim = 2000;
  panX.value = Math.min(lim, Math.max(-lim, panX.value));
  panY.value = Math.min(lim, Math.max(-lim, panY.value));
}

clampPan();

function resetTransientMapUiState() {
  selectedId.value = null;
  isEditingPanel.value = false;
  isGlobalEditMode.value = false;
  mobileFabOpen.value = false;
  mapSettingsOpen.value = false;
  editingRegionId.value = null;
  showGenerateModal.value = false;
  showEventNavModal.value = false;
  showCreateEventModal.value = false;
  showPickRegionForBuilding.value = false;
  pendingAction.value = null;
  pendingNextSelectedId.value = null;
  regionThemeRows.value = [];
}

function collectTacticalMapSnapshot(): TacticalMapPersisted {
  return {
    schemaVersion: 2,
    world: klona(mapWorld.value) as World,
    mapUiTheme: mapUiTheme.value,
    panX: panX.value,
    panY: panY.value,
    scale: scale.value,
  };
}

function persistCurrentScopeToBrowser() {
  savePersisted(chatScopeTracked.value, collectTacticalMapSnapshot());
}

/** 防抖：拖动/编辑时减少写入次数，仍保证最终写入当前 chatScopeId 对应键 */
let tacticalMapPersistTimer: ReturnType<typeof setTimeout> | null = null;
const TACTICAL_MAP_PERSIST_DEBOUNCE_MS = 400;

/** MVU 变量 → 地图：浏览模式始终跟变量；编辑模式且本地有未提交改动时不自动覆盖 */
const applyingMvuToMap = ref(false);
let mvuToMapTimer: ReturnType<typeof setTimeout> | null = null;
const MVU_TO_MAP_DEBOUNCE_MS = 120;

function cancelTacticalMvuMapSyncTimers() {
  if (mvuToMapTimer != null) {
    clearTimeout(mvuToMapTimer);
    mvuToMapTimer = null;
  }
}

function scheduleApplyMvuToMap() {
  if (isGlobalEditMode.value && tacticalMapDraftDirty.value) return;
  if (mvuToMapTimer != null) clearTimeout(mvuToMapTimer);
  mvuToMapTimer = setTimeout(() => {
    mvuToMapTimer = null;
    applyingMvuToMap.value = true;
    const beforeN = prevEntityCountForMvuAutoPan.value;
    mapWorld.value = normalizeWorld(
      syncWorldFromMvu(normalizeWorld(klona(mapWorld.value)), dataStore.data),
    );
    const nextN = countMapEntities(mapWorld.value);
    if (beforeN === 0 && nextN > 0) {
      const panHint = computePanToCenterWorld(mapWorld.value);
      if (panHint) {
        panX.value = panHint.panX;
        panY.value = panHint.panY;
        if (scale.value < ZOOM_THRESHOLD) {
          zoomTo(ZOOM_THRESHOLD);
        }
        clampPan();
      }
    }
    prevEntityCountForMvuAutoPan.value = nextN;
    committedMapWorld.value = normalizeWorld(klona(mapWorld.value));
    void nextTick(() => {
      applyingMvuToMap.value = false;
    });
  }, MVU_TO_MAP_DEBOUNCE_MS);
}

function schedulePersistCurrentScopeToBrowser() {
  if (tacticalMapPersistTimer != null) clearTimeout(tacticalMapPersistTimer);
  tacticalMapPersistTimer = setTimeout(() => {
    tacticalMapPersistTimer = null;
    persistCurrentScopeToBrowser();
  }, TACTICAL_MAP_PERSIST_DEBOUNCE_MS);
}

/** 立即写入（切换聊天、隐藏标签、卸载前调用，避免未 flush 的防抖丢改） */
function flushPersistCurrentScopeToBrowser() {
  if (tacticalMapPersistTimer != null) {
    clearTimeout(tacticalMapPersistTimer);
    tacticalMapPersistTimer = null;
  }
  persistCurrentScopeToBrowser();
}

function onTacticalMapPageHide() {
  flushPersistCurrentScopeToBrowser();
}

function onTacticalMapVisibilityChange() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    flushPersistCurrentScopeToBrowser();
  }
}

function applyPersistedPayload(data: TacticalMapPersisted | null) {
  cancelTacticalMvuMapSyncTimers();
  panTween?.kill();
  panTween = null;
  if (data) {
    const preSyncEmpty = !(data.world.regions?.length) && !(data.world.buildings?.length);
    mapWorld.value = normalizeWorld(syncWorldFromMvu(normalizeWorld(klona(data.world)), dataStore.data));
    mapUiTheme.value = data.mapUiTheme;
    panX.value = data.panX;
    panY.value = data.panY;
    scale.value = data.scale;
    if (preSyncEmpty) {
      const panHint = computePanToCenterWorld(mapWorld.value);
      if (panHint) {
        panX.value = panHint.panX;
        panY.value = panHint.panY;
        if (scale.value < ZOOM_THRESHOLD) {
          zoomTo(ZOOM_THRESHOLD);
        }
        clampPan();
      }
    }
    prevEntityCountForMvuAutoPan.value = countMapEntities(mapWorld.value);
  } else {
    const boot = tacticalPersistedWhenNoBrowser();
    mapWorld.value = normalizeWorld(klona(boot.world));
    mapUiTheme.value = boot.mapUiTheme;
    panX.value = boot.panX;
    panY.value = boot.panY;
    scale.value = boot.scale;
    prevEntityCountForMvuAutoPan.value = countMapEntities(mapWorld.value);
  }
  clampPan();
  committedMapWorld.value = normalizeWorld(klona(mapWorld.value));
  resetTransientMapUiState();
}

function onSaveMapToBrowser() {
  flushPersistCurrentScopeToBrowser();
  toastr.success('地图已保存到本机浏览器');
}

function snapshotMvuMapTriple() {
  return {
    区域数据: klona(dataStore.data.区域数据 ?? {}),
    建筑数据: klona(dataStore.data.建筑数据 ?? {}),
    活动数据: klona(dataStore.data.活动数据 ?? {}),
  };
}

/**
 * 将草稿提交：先算「当前变量 vs 当前地图将写入的语义」差分 → 暂存为待发送的 &lt;UpdateVariable&gt;（于本界面下次发消息时附在 user_input）→ 再 export 到 MVU → 固化提交快照并保存浏览器缓存。
 * 仅改布局、变量语义未变时：不暂存 Patch、不写 MVU，只固化本地。
 */
function confirmMapDraft(): boolean {
  if (!tacticalMapDraftDirty.value) {
    toastr.info('无待提交的地图修改');
    return false;
  }
  let before: TacticalMvuMapRecordsSnapshot;
  try {
    before = parseTacticalMvuMapTripleSnapshot(snapshotMvuMapTriple());
  } catch (e) {
    console.error('[TacticalMapPanel] MVU 地图三块校验失败:', e);
    toastr.error('当前变量中区域/建筑/活动数据无法通过 Schema 校验，请先「从变量同步到地图」或检查变量');
    return false;
  }
  const preview = buildTacticalMvuMapRecordsFromWorld(
    mapWorld.value,
    before.区域数据,
    before.建筑数据,
    before.活动数据,
  );
  const desired: TacticalMvuMapRecordsSnapshot = preview;
  const semanticsWouldChange =
    !isEqual(preview.区域数据, before.区域数据) ||
    !isEqual(preview.建筑数据, before.建筑数据) ||
    !isEqual(preview.活动数据, before.活动数据);

  const patches = buildTacticalMapJsonPatchesForMvuCommit(before, desired);

  if (semanticsWouldChange) {
    if (!tryRulesMvuWritable()) {
      toastr.error('当前楼层变量不可写，无法将地图语义写入变量');
      return false;
    }
  }

  if (isEditCartEnabled()) {
    if (patches.length > 0) {
      useEditCartStore().addOrReplaceItem(buildTacticalMapCartItem(patches, '战术地图变量'));
      toastr.success(
        '地图变更已加入编辑暂存；请在购物车中确认后，于本界面下次发送消息时一并写入玩家楼层',
      );
    } else if (semanticsWouldChange) {
      toastr.error('检测到地图语义变化但未能生成变量补丁，请先「从变量同步到地图」后重试');
      return false;
    } else {
      toastr.success('已确认本地地图布局与视图（与变量语义一致，无需 Patch）');
    }
    committedMapWorld.value = normalizeWorld(klona(mapWorld.value));
    flushPersistCurrentScopeToBrowser();
    return true;
  }

  if (patches.length > 0) {
    appendPendingTacticalMapPatches(patches);
    toastr.success(
      '变量补丁已暂存，将在你下次于本规则界面发送对话时自动附在消息末尾（多次确认会合并为一组标签）',
    );
  }

  if (semanticsWouldChange) {
    if (!exportTacticalWorldToMvu(mapWorld.value)) {
      toastr.error('写入 MVU 变量失败（地图未标记为已确认）。若已暂存 Patch，请勿重复发送直至问题解决');
      return false;
    }
    toastr.success('已将当前地图语义同步到变量');
  } else {
    toastr.success('已确认本地地图布局与视图（与变量语义一致，无需 Patch）');
  }

  committedMapWorld.value = normalizeWorld(klona(mapWorld.value));
  flushPersistCurrentScopeToBrowser();
  return true;
}

function discardMapDraft() {
  mapWorld.value = normalizeWorld(klona(committedMapWorld.value));
  resetTransientMapUiState();
  toastr.info('已放弃未提交的地图修改');
}

/** 立即用当前 MVU 变量重算地图（不依赖防抖）；新建建筑格落在所属区域内，避免落在区域外看不见 */
function onPullVariablesToMap() {
  cancelTacticalMvuMapSyncTimers();
  applyingMvuToMap.value = true;
  try {
    mapWorld.value = normalizeWorld(
      syncWorldFromMvu(normalizeWorld(klona(mapWorld.value)), dataStore.data, {
        repositionAssignedBuildingsIntoRegion: true,
      }),
    );
    if (scale.value < ZOOM_THRESHOLD) {
      zoomTo(ZOOM_THRESHOLD);
    }
    prevEntityCountForMvuAutoPan.value = countMapEntities(mapWorld.value);
    flushPersistCurrentScopeToBrowser();
    committedMapWorld.value = normalizeWorld(klona(mapWorld.value));
    toastr.success('已从变量合并区域与建筑到地图');
  } finally {
    void nextTick(() => {
      applyingMvuToMap.value = false;
    });
  }
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

function onMapUiThemeSelect(e: Event) {
  mapUiTheme.value = (e.target as HTMLSelectElement).value as MapStyle;
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

async function onAiGenerateRegionSubmit() {
  const cfg = getSecondaryApiConfig();
  const themeSnapshot = [...regionThemeRows.value];
  const regionCount = Math.max(1, Math.min(5, Math.floor(Number(aiRegionCount.value) || 1)));
  const buildingsPerRegion = Math.max(2, Math.min(5, Math.floor(Number(aiBuildingsPerRegion.value) || 3)));
  showGenerateModal.value = false;
  regionThemeRows.value = [];
  tacticalAiBusy.value = true;
  try {
    const resolved = buildPerRegionThemeHintsFromList(themeSnapshot, regionCount);
    const systemPrompt = buildTacticalAiRegionSystemPrompt({ regionCount, buildingsPerRegion });
    const userPrompt = buildTacticalRegionUserPrompt({
      world: mapWorld.value,
      mapUiTheme: mapUiTheme.value,
      userHint: resolved.userHint,
      regionCount,
      buildingsPerRegion,
      perRegionHints: resolved.perRegionHints,
    });
    const maxTokens = Math.min(
      65536,
      Math.max(4096, 2200 + regionCount * buildingsPerRegion * 420 + regionCount * 520),
    );
    const raw = await runTacticalMapSecondaryGenerate(systemPrompt, userPrompt, cfg, {
      bannerMessage: 'AI 正在生成区域变量…',
      maxTokens,
    });
    const fullSend = formatTacticalMapAiOutputForSendBox(raw);
    pendingTacticalAiInsert.value = { kind: 'region', fullSend };
    toastr.success('区域变量已生成。请在地图底部预览，确认后将写入变量并刷新地图。');
  } catch (e) {
    console.error('[TacticalMapPanel] AI 生成区域失败:', e);
    toastr.error(`区域生成失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    tacticalAiBusy.value = false;
  }
}

async function onCreateEventAiRequest(payload: { selectedRegionId: string; activityTypeHint: string }) {
  const cfg = getSecondaryApiConfig();
  tacticalAiBusy.value = true;
  try {
    const userPrompt = buildTacticalActivityUserPrompt({
      world: mapWorld.value,
      mapUiTheme: mapUiTheme.value,
      selectedRegionId: payload.selectedRegionId,
      activityTypeHint: payload.activityTypeHint,
    });
    const raw = await runTacticalMapSecondaryGenerate(TACTICAL_AI_ACTIVITY_SYSTEM, userPrompt, cfg, {
      bannerMessage: 'AI 正在生成活动变量…',
    });
    const fullSend = formatTacticalMapAiOutputForSendBox(raw);
    pendingTacticalAiInsert.value = { kind: 'activity', fullSend };
    toastr.success('活动变量已生成。请在地图底部预览，确认后将写入变量并刷新地图。');
  } catch (e) {
    console.error('[TacticalMapPanel] AI 创建活动生成失败:', e);
    toastr.error(`活动生成失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    tacticalAiBusy.value = false;
  }
}

const VALID_AI_BUILDING_TYPES: BuildingType[] = ['core', 'military', 'commercial', 'research', 'industrial'];

function cellKeyTactical(gx: number, gy: number) {
  return `${gx},${gy}`;
}

function collectOccupiedCellsGlobal(regionId: string): Set<string> {
  const set = new Set<string>();
  for (const b of buildings.value) {
    if ((b.regionId ?? '') !== regionId) continue;
    for (let dx = 0; dx < b.width; dx++) {
      for (let dy = 0; dy < b.height; dy++) {
        set.add(cellKeyTactical(b.x + dx, b.y + dy));
      }
    }
  }
  return set;
}

function findPlacementInRegion(
  region: Region,
  occ: Set<string>,
  preferW: number,
  preferH: number,
  preferLx: number,
  preferLy: number,
): { gx: number; gy: number; w: number; h: number } | null {
  const candidates: Array<{ w: number; h: number }> = [{ w: preferW, h: preferH }];
  if (preferW > 1 || preferH > 1) {
    candidates.push({ w: 1, h: 1 });
  }
  for (const { w, h } of candidates) {
    if (w > region.width || h > region.height) continue;
    const tryOne = (lx: number, ly: number) => {
      if (lx < 0 || ly < 0 || lx + w > region.width || ly + h > region.height) return null;
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          const gx = region.x + lx + dx;
          const gy = region.y + ly + dy;
          if (occ.has(cellKeyTactical(gx, gy))) return null;
        }
      }
      return { gx: region.x + lx, gy: region.y + ly, w, h };
    };
    const p0 = tryOne(preferLx, preferLy);
    if (p0) return p0;
    for (let ly = 0; ly <= region.height - h; ly++) {
      for (let lx = 0; lx <= region.width - w; lx++) {
        const t = tryOne(lx, ly);
        if (t) return t;
      }
    }
  }
  return null;
}

function normalizeAiBuildingType(t: unknown): BuildingType {
  const s = String(t ?? '').toLowerCase();
  if (VALID_AI_BUILDING_TYPES.includes(s as BuildingType)) return s as BuildingType;
  return 'core';
}

function parseAiRoomsFromRow(o: Record<string, unknown>, seed: string): Room[] {
  const raw = o.rooms ?? o.room_layout;
  if (!Array.isArray(raw)) return [];
  const out: Room[] = [];
  for (let j = 0; j < raw.length; j++) {
    const item = raw[j];
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const name = String(r.name ?? '').trim();
    if (!name) continue;
    out.push({
      id: String(r.id ?? '').trim() || `room_${seed}_${j}`,
      name,
      type: String(r.type ?? '').trim() || '未分类',
    });
  }
  return out;
}

function normalizeAiActivityPhase(p: unknown): ActivityPhase {
  const s = String(p ?? '').trim().toLowerCase();
  if (s === 'upcoming' || s === '即将举办' || s === '筹备') return 'upcoming';
  if (s === 'ongoing' || s === '进行中') return 'ongoing';
  if (s === 'ended' || s === '已结束') return 'ended';
  if (s === 'cancelled' || s === '已取消') return 'cancelled';
  return 'upcoming';
}

function parseAiActivitiesFromRow(o: Record<string, unknown>, seed: string): Activity[] {
  const raw = o.activities ?? o.activity_list;
  if (!Array.isArray(raw)) return [];
  const out: Activity[] = [];
  for (let j = 0; j < raw.length; j++) {
    const item = raw[j];
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    const name = String(a.name ?? '').trim();
    if (!name) continue;
    const progress = Math.min(100, Math.max(0, Math.round(Number(a.progress) || 0)));
    const scopeRaw = String(a.scope ?? '').trim().toLowerCase();
    const scope =
      scopeRaw === 'personal' || scopeRaw === '个人'
        ? 'personal'
        : scopeRaw === 'collective' || scopeRaw === '集体'
          ? 'collective'
          : undefined;
    out.push({
      id: String(a.id ?? '').trim() || `a_${seed}_${j}`,
      name,
      progress,
      phase: normalizeAiActivityPhase(a.phase ?? a.status),
      scope,
    });
  }
  return out;
}

function parseAiPeopleFromRow(o: Record<string, unknown>, seed: string): Person[] {
  const raw = o.people ?? o.在场人员;
  if (!Array.isArray(raw)) return [];
  const out: Person[] = [];
  for (let j = 0; j < raw.length; j++) {
    const item = raw[j];
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const name = String(p.name ?? p.姓名 ?? '').trim();
    if (!name) continue;
    out.push({
      id: String(p.id ?? '').trim() || `p_${seed}_${j}`,
      name,
      role: String(p.role ?? p.身份 ?? '').trim() || '在场',
    });
  }
  return out;
}

/** 模型若漏字段，补最小占位避免侧栏空白（仍建议检查并手改） */
function ensureAiBuildingContentDefaults(b: Building): Building {
  const rooms =
    b.rooms.length > 0
      ? b.rooms
      : [{ id: `${b.id}_room0`, name: '主空间', type: '（模型未输出房间，占位）' }];
  const activities =
    b.activities.length > 0
      ? b.activities
      : [{ id: `a_${b.id}_stub`, name: '待定活动', progress: 0, phase: 'upcoming' as ActivityPhase }];
  const people =
    b.people.length > 0
      ? b.people
      : [{ id: `p_${b.id}_stub`, name: '无名在场者', role: '占位' }];
  return { ...b, rooms, activities, people };
}

function parseAiBuildingsPayload(raw: string): unknown[] | null {
  let t = String(raw ?? '').trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (m) t = m[1].trim();
  try {
    const v = JSON.parse(t) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function applyParsedAiBuildings(region: Region, rows: unknown[], limit: number): Building[] {
  const occ = collectOccupiedCellsGlobal(region.id);
  const created: Building[] = [];
  for (let i = 0; i < rows.length && created.length < limit; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const name = String(o.name ?? '').trim() || `AI建筑 ${created.length + 1}`;
    const description = String(o.description ?? '').trim() || '由 AI 生成。';
    const type = normalizeAiBuildingType(o.type);
    const w = Math.min(2, Math.max(1, Math.round(Number(o.width) || 1)));
    const h = Math.min(2, Math.max(1, Math.round(Number(o.height) || 1)));
    const preferLx = Math.round(Number(o.lx) || 0);
    const preferLy = Math.round(Number(o.ly) || 0);
    const pos = findPlacementInRegion(region, occ, w, h, preferLx, preferLy);
    if (!pos) break;
    const bid = `b_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    const b = ensureAiBuildingContentDefaults({
      id: bid,
      x: pos.gx,
      y: pos.gy,
      width: pos.w,
      height: pos.h,
      name,
      type,
      description,
      people: parseAiPeopleFromRow(o, bid),
      activities: parseAiActivitiesFromRow(o, bid),
      rooms: parseAiRoomsFromRow(o, bid),
      customProperties: [],
      isNew: false,
      regionId: region.id,
    });
    for (let dx = 0; dx < b.width; dx++) {
      for (let dy = 0; dy < b.height; dy++) {
        occ.add(cellKeyTactical(b.x + dx, b.y + dy));
      }
    }
    created.push(b);
  }
  return created;
}

async function onAiCreateBuildingsSubmit() {
  const region = regions.value.find(r => r.id === aiBuildingsRegionId.value);
  if (!region) {
    toastr.warning('请选择有效区域');
    return;
  }
  const cfg = getSecondaryApiConfig();
  const count = Math.min(5, Math.max(1, Math.round(Number(aiBuildingsCount.value)) || 1));
  tacticalAiBusy.value = true;
  try {
    const userPrompt = buildTacticalMapBuildingsUserPrompt({
      world: mapWorld.value,
      mapUiTheme: mapUiTheme.value,
      region,
      count,
      userHint: aiBuildingsPrompt.value,
    });
    const raw = await runTacticalMapSecondaryGenerate(TACTICAL_AI_MAP_BUILDINGS_SYSTEM, userPrompt, cfg, {
      bannerMessage: 'AI 正在生成建筑…',
    });
    const arr = parseAiBuildingsPayload(raw);
    if (!arr || arr.length === 0) {
      if (isProbablyTruncatedJsonArray(raw)) {
        toastr.error(
          '模型回复被截断，JSON 未写完（酒馆日志里常见 finish_reason: length）。本界面已为地图请求单独提高 max_tokens；若仍截断请在聊天/代理预设里再调高「最大回复 tokens」后重试。',
        );
      } else {
        toastr.warning('模型未返回可解析的 JSON 建筑数组，请重试或缩短描述');
      }
      console.warn('[TacticalMapPanel] AI 建筑原始输出（节选）:', String(raw).slice(0, 800));
      return;
    }
    const created = applyParsedAiBuildings(region, arr, count);
    if (!created.length) {
      toastr.warning('解析到了建筑数据，但区域内没有足够空格放置，请缩小已有占地或删建筑后重试');
      return;
    }
    isGlobalEditMode.value = true;
    setBuildings(prev => [...prev, ...created]);
    if (scale.value < ZOOM_THRESHOLD) {
      zoomTo(ZOOM_THRESHOLD);
    }
    navigateToRegion(region);
    showAiBuildingsModal.value = false;
    toastr.success(`已在「${region.name}」生成 ${created.length} 座建筑`);
    flushPersistCurrentScopeToBrowser();
  } catch (e) {
    console.error('[TacticalMapPanel] AI 创建建筑失败:', e);
    toastr.error(`生成失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    tacticalAiBusy.value = false;
  }
}

function dismissPendingTacticalAiInsert() {
  pendingTacticalAiInsert.value = null;
}

function confirmPendingTacticalAiInsert() {
  const p = pendingTacticalAiInsert.value;
  if (!p) return;
  const ops = extractJsonPatchFromTacticalAiBlock(p.fullSend);
  if (!ops?.length) {
    toastr.error('未能从生成结果中解析 JSON Patch，请检查模型输出格式');
    return;
  }
  if (!tryRulesMvuWritable()) return;

  const store = useDataStore();
  const prev = klona(store.data);
  const next = klona(store.data);
  applyJsonPatch(next as Record<string, unknown>, ops);

  let beforeTriple: TacticalMvuMapRecordsSnapshot;
  let afterTriple: TacticalMvuMapRecordsSnapshot;
  try {
    beforeTriple = parseTacticalMvuMapTripleSnapshot({
      区域数据: prev.区域数据,
      建筑数据: prev.建筑数据,
      活动数据: prev.活动数据,
    });
    afterTriple = parseTacticalMvuMapTripleSnapshot({
      区域数据: next.区域数据,
      建筑数据: next.建筑数据,
      活动数据: next.活动数据,
    });
  } catch (e) {
    console.error('[TacticalMapPanel] AI Patch 应用后 MVU 地图三块校验失败:', e);
    toastr.error('补丁应用后无法通过地图变量 Schema，请检查模型输出的区域/建筑/活动形状');
    return;
  }

  const patchOps = buildTacticalMapJsonPatchesForMvuCommit(beforeTriple, afterTriple);

  if (isEditCartEnabled()) {
    const tripleChanged =
      !isEqual(beforeTriple.区域数据, afterTriple.区域数据) ||
      !isEqual(beforeTriple.建筑数据, afterTriple.建筑数据) ||
      !isEqual(beforeTriple.活动数据, afterTriple.活动数据);
    if (patchOps.length === 0) {
      if (tripleChanged) {
        toastr.error('地图语义已变但未能生成变量补丁，无法加入编辑暂存');
        return;
      }
      pendingTacticalAiInsert.value = null;
      flushPersistCurrentScopeToBrowser();
      toastr.info('补丁未改变地图变量语义');
      return;
    }
    useEditCartStore().addOrReplaceItem(buildTacticalMapCartItem(patchOps, '战术地图 AI 补丁'));
    mapWorld.value = normalizeWorld(
      syncWorldFromMvu(normalizeWorld(klona(mapWorld.value)), next, {
        repositionAssignedBuildingsIntoRegion: true,
      }),
    );
    committedMapWorld.value = normalizeWorld(klona(mapWorld.value));
    pendingTacticalAiInsert.value = null;
    flushPersistCurrentScopeToBrowser();
    toastr.success(
      '已将 AI 地图补丁加入编辑暂存；地图已按预览更新。请在购物车确认后写入变量，并于本界面发送时附上 UpdateVariable',
    );
    return;
  }

  store.data.区域数据 = afterTriple.区域数据;
  store.data.建筑数据 = afterTriple.建筑数据;
  store.data.活动数据 = afterTriple.活动数据;
  bumpUpdateTime();

  mapWorld.value = normalizeWorld(
    syncWorldFromMvu(normalizeWorld(klona(mapWorld.value)), store.data, {
      repositionAssignedBuildingsIntoRegion: true,
    }),
  );
  committedMapWorld.value = normalizeWorld(klona(mapWorld.value));

  if (patchOps.length > 0) {
    appendPendingTacticalMapPatches(patchOps);
  }

  void import('../utils/worldLifeFromPatch').then(({ scheduleWorldLifeTriggersFromJsonPatches }) => {
    scheduleWorldLifeTriggersFromJsonPatches(patchOps, store.data as Record<string, unknown>);
  });
  void import('../utils/residentLifePending').then(({ tryFlushPendingResidentLife }) => {
    void tryFlushPendingResidentLife(store.data as Record<string, unknown>);
  });

  pendingTacticalAiInsert.value = null;
  flushPersistCurrentScopeToBrowser();
  toastr.success('已写入变量并刷新地图；变量补丁已暂存，将在下次于本界面发送对话时附在消息末尾');
}

function openAiGenerate() {
  showGenerateModal.value = true;
}

function openAiBuildingsModal() {
  if (!regions.value.length) {
    toastr.warning('请先创建至少一个区域');
    return;
  }
  if (!aiBuildingsRegionId.value || !regions.value.some(r => r.id === aiBuildingsRegionId.value)) {
    aiBuildingsRegionId.value = regions.value[0]?.id ?? '';
  }
  showAiBuildingsModal.value = true;
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

function openAiBuildingsModalMobile() {
  openAiBuildingsModal();
  if (regions.value.length) {
    mobileFabOpen.value = false;
  }
}

function confirmMapDraftMobile() {
  confirmMapDraft();
  mobileFabOpen.value = false;
}

function discardMapDraftMobile() {
  discardMapDraft();
  mobileFabOpen.value = false;
}

function onPullVariablesToMapMobile() {
  onPullVariablesToMap();
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

watch(showAiBuildingsModal, v => {
  if (v && regions.value.length) {
    if (!aiBuildingsRegionId.value || !regions.value.some(r => r.id === aiBuildingsRegionId.value)) {
      aiBuildingsRegionId.value = regions.value[0]!.id;
    }
  }
});

watch(
  [mapWorld, mapUiTheme, panX, panY, scale],
  () => {
    schedulePersistCurrentScopeToBrowser();
  },
  { deep: true },
);

watch(
  () => ({
    区域数据: dataStore.data.区域数据,
    建筑数据: dataStore.data.建筑数据,
    活动数据: dataStore.data.活动数据,
    世界类型: dataStore.data.元信息?.世界类型,
    世界简介: dataStore.data.元信息?.世界简介,
  }),
  () => {
    scheduleApplyMvuToMap();
  },
  { deep: true },
);

onMounted(() => {
  containerRef.value?.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('visibilitychange', onTacticalMapVisibilityChange);
  try {
    if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined') {
      const ret = eventOn(tavern_events.CHAT_CHANGED, (newChatFileName: string) => {
        cancelTacticalMvuMapSyncTimers();
        flushPersistCurrentScopeToBrowser();
        const fromEvent =
          typeof newChatFileName === 'string' && newChatFileName.trim() !== ''
            ? newChatFileName.trim()
            : '';
        const next = fromEvent || getChatScopeId();
        chatScopeTracked.value = next;
        applyPersistedPayload(loadPersisted(next));
        // 若酒馆在回调之后才更新 getCurrentChatId，下一帧对齐，避免串档
        nextTick(() => {
          const live = getChatScopeId();
          if (live !== next) {
            chatScopeTracked.value = live;
            applyPersistedPayload(loadPersisted(live));
          }
        });
      });
      stopTacticalMapChatListener = () => {
        ret.stop?.();
      };
    }
  } catch (e) {
    console.warn('[TacticalMapPanel] 无法监听 CHAT_CHANGED:', e);
  }
  window.addEventListener('pagehide', onTacticalMapPageHide);
});

onUnmounted(() => {
  cancelTacticalMvuMapSyncTimers();
  flushPersistCurrentScopeToBrowser();
  panTween?.kill();
  stopTacticalMapChatListener?.();
  stopTacticalMapChatListener = null;
  window.removeEventListener('pagehide', onTacticalMapPageHide);
  document.removeEventListener('visibilitychange', onTacticalMapVisibilityChange);
  containerRef.value?.removeEventListener('wheel', onWheel);
});

function getMapDraftChangeLines(): string[] {
  return buildTacticalMapDraftChangeLines(mapWorld.value, committedMapWorld.value);
}

defineExpose({
  checkMapDraftDirty: () => tacticalMapDraftDirty.value,
  discardMapDraft,
  confirmMapDraft,
  getMapDraftChangeLines,
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

.tm-map-settings-select {
  width: 100%;
  max-width: 100%;
}

.tm-map-settings-save {
  margin-top: 0.15rem;
  width: 100%;
  justify-content: center;
}

.tm-map-settings-save-hint {
  margin: 0;
  font-size: 0.65rem;
  line-height: 1.45;
  opacity: 0.9;
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
.tm-btn:hover:not(.tm-btn-primary):not(.tm-btn-toggle--on):not(.tm-btn-exit-edit) {
  background: rgba(255, 255, 255, 0.09);
}

.tactical-map--host-light .tm-btn:hover:not(.tm-btn-primary):not(.tm-btn-toggle--on):not(.tm-btn-exit-edit) {
  background: rgba(15, 23, 42, 0.07);
}

/* 主色：悬停整体提亮 */
.tm-btn-primary:hover,
.tm-btn-toggle--on:hover {
  filter: brightness(1.14);
}

.tm-btn-toggle--on {
  color: var(--bg-color);
  background: var(--accent-color);
  border-color: transparent;
}

/** 桌面：退出编辑模式（返回浏览）——醒目红色，与主色「进入编辑」区分 */
.tm-btn-exit-edit {
  color: #fef2f2;
  background: #dc2626;
  border-color: transparent;
}

.tm-btn-exit-edit:hover {
  filter: brightness(1.08);
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
  bottom: -1.85rem;
  padding: 0.2rem 0.45rem;
  font-size: 0.975rem;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
  pointer-events: none;
}

.tm-draft-banner {
  position: absolute;
  top: 0.45rem;
  left: 0.45rem;
  right: 0.45rem;
  z-index: 24;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem;
  font-size: 0.78rem;
  line-height: 1.35;
  pointer-events: auto;
}

.tm-draft-banner-text {
  flex: 1 1 12rem;
  min-width: 0;
}

.tm-draft-banner-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  flex-shrink: 0;
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

.tm-pending-ai-banner {
  position: fixed;
  left: 50%;
  bottom: max(4.75rem, env(safe-area-inset-bottom, 0px) + 3.5rem);
  transform: translateX(-50%);
  z-index: 55;
  width: min(96vw, 44rem);
  max-height: min(72vh, 36rem);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}

.tm-pending-ai-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tm-pending-ai-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.9rem;
  font-weight: 700;
}

.tm-pending-ai-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.06);
}

.tm-pending-ai-scroll {
  flex: 1;
  min-height: 0;
  max-height: min(38vh, 18rem);
  overflow: auto;
  padding-right: 0.15rem;
}

.tm-pending-ai-intro {
  margin: 0 0 0.45rem;
  font-size: 0.74rem;
  line-height: 1.45;
}

.tm-pending-ai-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tm-pending-ai-li {
  margin: 0;
}

.tm-pending-ai-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.2rem;
  padding: 0.45rem 0.55rem;
  text-align: left;
  border-radius: 0.35rem;
  border: 1px solid var(--border-color);
  background: var(--panel-bg);
  cursor: pointer;
  font: inherit;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    border-color: var(--accent-color, #3b82f6);
    background: rgba(59, 130, 246, 0.06);
  }
}

.tm-pending-ai-row-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.5rem;
}

.tm-pending-ai-kind {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.08rem 0.35rem;
  border-radius: 0.25rem;
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent-color, #2563eb);
}

.tm-pending-ai-name {
  flex: 1 1 auto;
  font-size: 0.82rem;
  font-weight: 600;
  min-width: 0;
}

.tm-pending-ai-id {
  flex-shrink: 0;
  font-size: 0.65rem;
  opacity: 0.85;
}

.tm-pending-ai-sub {
  font-size: 0.72rem;
  line-height: 1.35;
}

.tm-pending-ai-meta {
  font-size: 0.7rem;
  line-height: 1.35;
  color: var(--text-muted, #64748b);
}

.tm-pending-ai-fallback {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.45;
}

.tm-pending-ai-raw {
  margin: 0;
  border-radius: 0.35rem;
  border: 1px dashed var(--border-color);
  overflow: hidden;
}

.tm-pending-ai-raw-summary {
  cursor: pointer;
  padding: 0.4rem 0.55rem;
  font-size: 0.78rem;
  font-weight: 600;
  list-style: none;
  user-select: none;

  &::-webkit-details-marker {
    display: none;
  }

  &::before {
    content: '▸ ';
    display: inline-block;
    transition: transform 0.15s ease;
  }
}

.tm-pending-ai-raw[open] .tm-pending-ai-raw-summary::before {
  transform: rotate(90deg);
}

.tm-pending-ai-textarea {
  width: 100%;
  flex: 1;
  min-height: 5.5rem;
  max-height: 14rem;
  resize: vertical;
  font-size: 0.72rem;
  line-height: 1.35;
  font-family: ui-monospace, monospace;
}

.tm-pending-ai-textarea--raw {
  margin: 0;
  border-radius: 0;
  border: none;
  border-top: 1px solid var(--border-color);
  max-height: 12rem;
}

.tm-pending-ai-detail-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.tm-pending-ai-detail-card {
  width: min(96vw, 26rem);
  max-height: min(85vh, 28rem);
  display: flex;
  flex-direction: column;
  padding: 0.65rem 0.75rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}

.tm-pending-ai-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.tm-pending-ai-detail-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
}

.tm-pending-ai-detail-close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0.2rem 0.35rem;
  font-size: 1.1rem;
  line-height: 1;
}

.tm-pending-ai-detail-id {
  margin: 0.2rem 0 0.35rem;
  font-size: 0.72rem;
  opacity: 0.8;
}

.tm-pending-ai-detail-pre {
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.45rem 0.5rem;
  font-size: 0.68rem;
  line-height: 1.4;
  font-family: ui-monospace, monospace;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 0.3rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.tm-pending-ai-hint {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.4;
}

.tm-pending-ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
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
  /* 100%：不超过地图根节点高度，避免父级 overflow:hidden 裁掉抽屉上半截；85vh 在嵌套 iframe 里可能远大于可视区 */
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

.tm-mobile-full {
  width: 100%;
  justify-content: center;
}

.tm-mobile-more {
  border-radius: 0.375rem;
  border-width: 1px;
  padding: 0.1rem 0.3rem 0.4rem;
  background: rgba(0, 0, 0, 0.08);
}

.tactical-map--host-light .tm-mobile-more {
  background: rgba(15, 23, 42, 0.06);
}

.tm-mobile-more-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  list-style: none;
  cursor: pointer;
  padding: 0.45rem 0.4rem;
  font-size: 0.78rem;
  font-weight: 700;
}

.tm-mobile-more-summary::-webkit-details-marker {
  display: none;
}

.tm-mobile-more-chevron {
  font-size: 0.65rem;
  opacity: 0.75;
  transition: transform 0.15s ease;
}

.tm-mobile-more[open] .tm-mobile-more-chevron {
  transform: rotate(180deg);
}

.tm-mobile-more-body {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.1rem 0 0;
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

.tm-act-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.tm-act-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.tm-act-side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
  padding-top: 0.06rem;
}

.tm-act-title-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  width: 100%;
}

.tm-act-name {
  font-weight: 600;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.45;
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
  font-size: 0.75rem;
  line-height: 1.2;
  white-space: nowrap;
}

.tm-progress {
  height: 5px;
  border-radius: 999px;
  overflow: hidden;
}

.tm-progress-bar {
  height: 100%;
  background: currentcolor;
}

.tm-act-quick-join {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.28rem;
  padding: 0.22rem 0.42rem;
  font-size: 0.65rem;
  font-weight: 700;
  border-radius: 0.28rem;
  cursor: pointer;
  background: transparent;
  border-width: 1px;
  white-space: nowrap;
}

.tm-act-quick-join:hover {
  background: rgba(255, 255, 255, 0.07);
}

.tactical-map--host-light .tm-act-quick-join:hover {
  background: rgba(15, 23, 42, 0.06);
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
  /* 高于 App 顶栏第二 API 黄条 (10050)，避免地图弹窗被压在条下 */
  z-index: 10060;
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

.tm-modal-body--region-ai .tm-region-ai-row {
  display: grid;
  grid-template-columns: minmax(7.5rem, auto) 1fr;
  align-items: center;
  gap: 0.35rem 0.75rem;
}

.tm-region-theme-block {
  padding: 0.65rem 0.75rem;
  border-radius: 0.375rem;
  border-width: 1px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tm-region-theme-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tm-btn--compact {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  border-radius: 0.35rem;
}

.tm-region-theme-hint {
  margin: 0;
  line-height: 1.45;
}

.tm-region-theme-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.tm-region-theme-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.4rem 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 0.35rem;
  border-width: 1px;
}

.tm-region-theme-badge {
  font-size: 0.7rem;
  white-space: nowrap;
}

.tm-region-theme-input {
  min-width: 0;
  width: 100%;
  border-radius: 0.3rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.8125rem;
  outline: none;
}

.tm-btn-icon {
  padding: 0.35rem 0.45rem;
  border: none;
  background: transparent;
  border-radius: 0.3rem;
  cursor: pointer;
  line-height: 1;
}

.tm-btn-icon:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.tm-region-theme-empty {
  margin: 0;
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
