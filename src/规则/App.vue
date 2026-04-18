<template>
  <Teleport to="body">
    <Transition name="secondary-api-banner-tx">
      <div
        v-if="secondaryApiBannerVisible"
        class="secondary-api-banner"
        role="status"
        aria-live="polite"
      >
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        <span>{{ secondaryApiBannerText }}</span>
      </div>
    </Transition>
  </Teleport>

  <!-- 游戏阶段须挂入 #app-root，与标签弹窗等一致；否则 body 上 fixed 层可能被主界面挡住，底部按钮无法点击 -->
  <Teleport :to="gameSurfaceTeleportTarget">
    <Transition name="fade">
      <div
        v-if="editCartPanelOpen && editStagingCartEnabled"
        class="edit-cart-overlay"
        @click.self="editCartPanelOpen = false"
      >
        <div
          class="edit-cart-dialog"
          :class="{ dark: isDarkMode, light: !isDarkMode }"
          role="dialog"
          aria-labelledby="edit-cart-title"
          @click.stop
        >
          <div class="edit-cart-header">
            <h3 id="edit-cart-title">编辑暂存</h3>
            <button type="button" class="close-btn" aria-label="关闭" @click.stop="editCartPanelOpen = false">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <p class="edit-cart-hint">
            以下修改将在你点击「确认提交」后按顺序写入变量，并合并一段说明到输入框。
          </p>
          <ul v-if="editCartSortedForUi.length > 0" class="edit-cart-list">
            <li v-for="it in editCartSortedForUi" :key="it.id" class="edit-cart-row">
              <span class="edit-cart-label">{{ it.label }}</span>
              <div class="edit-cart-row-actions">
                <button type="button" class="edit-cart-edit" @click.stop="onEditCartRowEdit(it)">编辑</button>
                <button type="button" class="edit-cart-remove" @click.stop="onEditCartRemove(it.id)">移除</button>
              </div>
            </li>
          </ul>
          <p v-else class="edit-cart-empty">暂无暂存项</p>
          <p
            v-if="editCartAwaitingClearConfirm && editCartPendingCount > 0"
            class="edit-cart-clear-hint"
            role="status"
          >
            确定清空全部暂存？未提交的修改将丢失。
          </p>
          <div class="edit-cart-footer">
            <div class="edit-cart-footer-left">
              <template v-if="editCartAwaitingClearConfirm && editCartPendingCount > 0">
                <button type="button" class="btn-secondary" @click.stop="onEditCartClearDismiss">取消</button>
                <button type="button" class="edit-cart-clear-confirm-btn" @click.stop="onEditCartClearConfirm">
                  确定清空
                </button>
              </template>
              <button v-else type="button" class="btn-secondary" @click.stop="onEditCartClearAsk">清空</button>
            </div>
            <!-- 勿用原生 disabled：禁用态点击会穿透到下层（如侧栏「设置」），宿主脚本会看到误触 -->
            <button
              type="button"
              class="btn-primary edit-cart-submit-btn"
              :class="{ 'edit-cart-submit-btn--blocked': editCartSubmitBlocked }"
              :aria-disabled="editCartSubmitBlocked"
              @click.stop="onEditCartApply"
            >
              {{ editCartApplying ? '提交中…' : '确认提交' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <EditCartItemEditor
    :teleport-to="gameSurfaceTeleportTarget"
    :open="editCartEditorOpen"
    :item="editCartEditorItem"
    :is-dark-mode="isDarkMode"
    @update:open="onEditCartEditorOpenUpdate"
    @save="onEditCartEditorSave"
  />

  <!-- 开局表单界面 -->
  <OpeningForm
    v-if="gamePhase === GamePhase.OPENING"
    ref="openingFormRef"
    :key="openingFormKey"
    :style="rootStyle"
    @submit="handleOpeningSubmit"
    @open-settings="openingSettingsOpen = true"
  />

  <!-- 开局打开设置时：全屏实色遮罩，避免背后书本与 HUD 透出 -->
  <div
    v-if="gamePhase === GamePhase.OPENING && openingSettingsOpen"
    class="opening-settings-scrim"
    aria-hidden="true"
    @click="openingSettingsOpen = false"
  />

  <!-- 开局阶段：系统设置侧栏（与主界面同一 SettingsPanel，可切换单/双 API） -->
  <aside
    v-if="gamePhase === GamePhase.OPENING && openingSettingsOpen"
    class="middle-panel opening-settings-drawer"
    :class="{ dark: isDarkMode, light: !isDarkMode }"
    @click.stop
  >
    <div class="panel-inner">
      <header class="panel-header">
        <h1>
          系统设置
          <span class="version-badge" :title="appBuildVersion">{{ appBuildVersion }}</span>
        </h1>
        <button type="button" class="close-btn" @click.stop="openingSettingsOpen = false">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </header>
      <div class="panel-content">
        <SettingsPanel
          :is-dark-mode="isDarkMode"
          :ui-layout="uiLayout"
          @mode-change="onOutputModeChange"
          @update-worldbook="onUpdateWorldbook"
          @layout-change="onLayoutChange"
        />
      </div>
    </div>
  </aside>

  <!-- 游戏主界面 -->
  <div
    v-else-if="gamePhase === GamePhase.GAME"
    id="app-root"
    class="rule-modifier cyber-bg"
    :class="{
      dark: isDarkMode,
      light: !isDarkMode,
      'layout-pending': uiLayout.maxHeight === undefined,
      'animate-shake': isShaking,
      'has-mvu-missing-tip': showMvuMissingTip,
      'layout-regional-map-bleed': regionalMapFullBleed,
    }"
    :style="rootStyle"
  >
    <!-- 赛博朋克特效层 -->
    <ParallaxBackground />
    <TerminalSnippets />
    <!-- MVU 变量缺失提示 -->
    <div
      v-if="showMvuMissingTip"
      class="mvu-missing-tip"
      :class="{ 'dark': isDarkMode, 'light': !isDarkMode }"
    >
      <div class="tip-content">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>MVU变量缺失</span>
      </div>
      <button
        type="button"
        class="mvu-missing-tip__close"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
        @click="onCloseMvuMissingTip"
        title="关闭提示"
        aria-label="关闭 MVU 变量缺失提示"
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
    <!-- Sidebar -->
    <nav class="sidebar">
      <SidebarEffects />
      <div class="sidebar-top">
        <div class="logo">
          <i class="fa-solid fa-book-open logo-book-icon"></i>
          <span class="logo-text">规则模拟器</span>
        </div>
        <div class="nav-items">
          <button
            v-for="item in navItems"
            :key="item.id"
            :id="`nav-${item.id}`"
            class="nav-btn"
            :class="{ active: activeTab === item.id }"
            @click.stop="toggleTab(item.id)"
          >
            <span v-if="activeTab === item.id" class="active-indicator"></span>
            <i :class="item.icon"></i>
            <span class="nav-label">{{ item.label }}</span>
          </button>
          <div class="nav-items-bottom-spacer">
            <button
              v-if="editStagingCartEnabled"
              id="nav-edit-cart"
              type="button"
              class="nav-btn nav-btn-cart"
              @click.stop="editCartPanelOpen = true"
            >
              <span
                v-if="editCartPendingCount > 0"
                class="cart-badge"
                aria-hidden="true"
              >{{ editCartPendingCount > 99 ? '99+' : editCartPendingCount }}</span>
              <i class="fa-solid fa-cart-shopping"></i>
              <span class="nav-label">暂存</span>
            </button>
            <button type="button" class="nav-btn nav-btn-theme" @click="isDarkMode = !isDarkMode">
              <i :class="isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
              <span class="nav-label">{{ isDarkMode ? '浅色模式' : '深色模式' }}</span>
            </button>
            <button
              id="nav-settings"
              type="button"
              class="nav-btn"
              :class="{ active: activeTab === 'settings' }"
              @click.stop="toggleTab('settings')"
            >
              <span v-if="activeTab === 'settings'" class="active-indicator"></span>
              <i class="fa-solid fa-gear"></i>
              <span class="nav-label">系统设置</span>
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Middle Content (Collapsible) -->
    <aside v-if="activeTab" class="middle-panel" :class="{ dark: isDarkMode, light: !isDarkMode }">
      <div class="panel-inner">
        <header class="panel-header">
          <h1
            :class="{
              'glitch-text panel-title-cyber': isDarkMode && activeTab !== 'settings',
              'panel-title-cyber': isDarkMode && activeTab === 'settings',
            }"
            :data-text="isDarkMode && activeTab !== 'settings' ? panelTitle : undefined"
          >
            {{ panelTitle }}
            <span v-if="activeTab === 'settings'" class="version-badge" :title="appBuildVersion">{{ appBuildVersion }}</span>
          </h1>
          <button class="close-btn" @click.stop="activeTab = null">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>
        <div class="panel-content" :class="{ 'panel-content--map-bleed': regionalMapFullBleed }">
          <Transition name="fade" mode="out-in">
            <div :key="activeTab" class="panel-tab-page">
              <CharacterPanel
                v-if="activeTab === 'character'"
                :is-dark-mode="isDarkMode"
                @open-modal="openModal"
                @copy-to-input="copyToInput"
              />
              <WorldRulesPanel
                v-else-if="activeTab === 'world_rules'"
                :is-dark-mode="isDarkMode"
                @open-modal="openModal"
              />
              <RegionalRulesHub
                v-else-if="activeTab === 'regional_rules'"
                :is-dark-mode="isDarkMode"
                @open-modal="openModal"
                @sub-tab-change="onRegionalHubSubTabChange"
              />
              <PersonalRulesPanel
                v-else-if="activeTab === 'personal_rules'"
                :is-dark-mode="isDarkMode"
                :expand-group-name="personalRulesExpandGroup"
                @expand-group-consumed="personalRulesExpandGroup = null"
                @open-modal="openModal"
              />
              <SettingsPanel
                v-else-if="activeTab === 'settings'"
                :is-dark-mode="isDarkMode"
                :ui-layout="uiLayout"
                @mode-change="onOutputModeChange"
                @update-worldbook="onUpdateWorldbook"
                @layout-change="onLayoutChange"
              />
              <WorldLifePanel
                v-else-if="activeTab === 'world_life'"
                :is-dark-mode="isDarkMode"
              />
              <RandomRulesPanel
                v-else-if="activeTab === 'random_rules'"
                :is-dark-mode="isDarkMode"
              />
            </div>
          </Transition>
        </div>
      </div>
    </aside>

    <!-- Right Panel: LLM Interaction (Main Area) -->
    <main class="main-panel" :class="{ dark: isDarkMode, light: !isDarkMode }">
      <div class="main-header">
        <HeaderEffects />
        <div class="header-title">
          <i class="fa-solid fa-message"></i>
          <h2>游戏正文</h2>
        </div>
        <div class="header-actions">
          <button
            class="header-btn"
            :class="{ active: viewMode === 'reader' }"
            @click="toggleReaderMode"
            title="阅读模式"
          >
            <i class="fa-solid fa-book-open"></i>
          </button>
          <button
            class="header-btn"
            :class="{ active: viewMode === 'save' }"
            @click="toggleSaveMode"
            title="读档/创建分支"
          >
            <i class="fa-solid fa-floppy-disk"></i>
          </button>
          <button class="header-btn" @click="refreshMessage" title="刷新内容">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
          <button
            v-if="!mainText && !isGenerating && !isRegenerating"
            class="header-btn header-btn-recover"
            type="button"
            title="正文为空时：撤回最后一条用户发言并填入酒馆输入框"
            @click="onRecoverLastUserMessage"
          >
            <i class="fa-solid fa-arrow-rotate-left"></i>
          </button>
          <button class="header-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'">
            <i :class="isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'"></i>
          </button>
        </div>
      </div>

      <!-- 标签确认后写入楼层 / 同步变量时：顶部轻提示，不遮挡正文 -->
      <div
        v-if="isVariablePersistInProgress"
        class="variable-persist-banner"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
        role="status"
        aria-live="polite"
      >
        <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
        <span>正在将本回合写入楼层并同步变量（必要时含额外模型解析），请稍候；暂勿发送新内容。</span>
      </div>

      <!-- 游戏时间显示：固定在正文区域顶部（设置「界面与布局」页首项可关闭） -->
      <div
        v-if="showGameTimeHudEnabled"
        class="game-time-header"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
      >
        <GameTimeDisplay :is-dark-mode="isDarkMode" format="YYYY年MM月DD日 HH:mm" show-week-day />
      </div>

      <div class="game-content">
        <!-- 普通模式：正文 + 选项 -->
        <template v-if="viewMode === 'normal'">
          <!-- 重ROLL：仅尚无正文时遮罩（与发消息一致：流出正文后可读，第二 API 顶栏不挡） -->
          <div
            v-if="isRegenerating && !mainText"
            class="regenerate-overlay"
            :class="{ dark: isDarkMode, light: !isDarkMode }"
          >
            <i class="fa-solid fa-circle-notch fa-spin regenerate-spin"></i>
            <span>正在重ROLL，请稍等...</span>
          </div>
          <div class="turn-layout">
            <!-- 正文滚动区域（重ROLL 仅无正文时虚化；有正文时与首次生成一样先读再等标签） -->
            <div
              class="maintext-area"
              :class="{
                'is-blurred': isRegenerating && !mainText,
                'secondary-api-active': secondaryApiBannerVisible,
              }"
            >
              <!-- 生成中提示 -->
              <div v-if="isGenerating && !mainText" class="generating-indicator">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>{{ isRegenerating ? '正在重ROLL…' : 'AI 正在思考...' }}</span>
              </div>
              <!-- 正文内容（长按显示重roll/编辑） -->
              <div
                v-else-if="mainText"
                class="maintext-container"
                :class="{ dark: isDarkMode, light: !isDarkMode, 'can-long-press': hasValidMessageId() }"
                @mousedown="onMaintextMouseDown"
                @mouseup="onMaintextLongPressEnd"
                @mouseleave="onMaintextLongPressEnd"
                @touchstart="onMaintextTouchStart"
                @touchmove="onMaintextTouchMove"
                @touchend="onMaintextLongPressEnd"
                @touchcancel="onMaintextLongPressEnd"
                @contextmenu.prevent
              >
                <div class="maintext-content" v-html="mainTextForView"></div>
              </div>
              <!-- 空状态 -->
              <div v-else class="maintext-placeholder">
                <p>暂无内容...</p>
                <p class="hint">在下方输入框输入消息或点击选项开始游戏</p>
              </div>
            </div>

            <!-- 选项栏：固定在最底部（输入框上方），不参与正文滚动 -->
            <div v-if="options.length > 0" class="options-area">
              <button class="options-toggle" @click="toggleOptions">
                <i :class="isOptionsExpanded ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'"></i>
                <span>选择你的行动 ({{ options.length }})</span>
              </button>
              <Transition name="slide">
                <div v-show="isOptionsExpanded" class="options-list">
                  <button
                    v-for="option in options"
                    :key="option.id"
                    class="option-btn"
                    :disabled="isGenerating || isVariablePersistInProgress"
                    @click="selectOption(option.id)"
                  >
                    <span class="option-id">{{ option.id }}</span>
                    <span class="option-text">{{ option.text }}</span>
                  </button>
                </div>
              </Transition>
            </div>
          </div>

        </template>

        <!-- 阅读模式：显示所有楼层的 maintext -->
        <template v-else-if="viewMode === 'reader'">
          <div class="reader-mode">
            <div class="mode-header">
              <h3>📚 阅读模式</h3>
              <p>显示所有历史正文内容</p>
            </div>
            <div class="history-list">
              <div
                v-for="item in maintextHistory"
                :key="item.messageId"
                class="history-item"
              >
                <div class="history-meta">
                  <span class="turn-badge" v-if="item.turnNumber !== undefined">回合 {{ item.turnNumber }}</span>
                  <span>楼层 #{{ item.messageId }} · {{ item.timestamp }}</span>
                </div>
                <div class="history-content" v-html="maintextForHtmlDisplay(item.maintext)"></div>
              </div>
              <div v-if="maintextHistory.length === 0" class="empty-state">
                暂无历史正文记录<br>
                <small>（需要 AI 回复包含 &lt;maintext&gt; 标签的消息）</small>
              </div>
            </div>
          </div>
        </template>

        <!-- 读档模式：显示所有楼层的 sum -->
        <template v-else-if="viewMode === 'save'">
          <div class="save-mode">
            <div class="mode-header">
              <h3>💾 读档模式</h3>
              <p>点击回合创建分支，从此处继续游戏</p>
            </div>
            <div class="history-list">
              <div
                v-for="item in saveHistory"
                :key="item.messageId"
                class="history-item save-item"
                @click="createBranch(item.messageId, item.turnNumber)"
              >
                <div class="history-meta">
                  <span class="turn-badge">回合 {{ item.turnNumber }}</span>
                  <span>楼层 #{{ item.messageId }} · {{ item.timestamp }}</span>
                </div>
                <div class="history-content">{{ item.sum }}</div>
                <div class="branch-hint">
                  <i class="fa-solid fa-code-branch"></i>
                  <span>点击从此回合创建分支</span>
                </div>
              </div>
              <div v-if="saveHistory.length === 0" class="empty-state">
                暂无存档记录<br>
                <small>（需要 AI 回复包含 &lt;sum&gt; 标签的消息）</small>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="input-area">
        <div v-if="showAbortGameSendChip" class="game-send-abort-row">
          <button
            type="button"
            class="game-send-abort-btn"
            :class="{ dark: isDarkMode, light: !isDarkMode }"
            :aria-busy="gameSendAbortInFlight"
            @click="void onAbortGameSendBeforeTagConfirm()"
          >
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
            <span class="game-send-abort-label">回到发送前</span>
            <span class="game-send-abort-hint">删除本轮玩家楼层，输入已填回</span>
          </button>
        </div>
        <div class="input-wrapper">
          <textarea
            id="llm-input"
            v-model="userInput"
            placeholder="输入指令或描述..."
            rows="1"
            :disabled="isGenerating || isVariablePersistInProgress"
            @keydown.enter.prevent="sendMessage"
          />
          <button
            id="btn-send-llm"
            class="send-btn"
            :disabled="isGenerating || isVariablePersistInProgress || !userInput.trim()"
            @click="sendMessage"
          >
            <i v-if="isGenerating" class="fa-solid fa-circle-notch fa-spin"></i>
            <span v-else>发送</span>
          </button>
        </div>
      </div>

      <!-- 右下角：变量更新提示（查看当前楼层 UpdateVariable 内容） -->
      <button
        v-if="viewMode === 'normal'"
        ref="fabRef"
        type="button"
        class="variable-fab"
        :class="{ dark: isDarkMode, light: !isDarkMode, 'is-dragging': isDraggingFab }"
        :style="variableFabStyle"
        @mousedown="onFabMouseDown"
        @touchstart="onFabMouseDown"
        @mouseup="onFabClick"
        @touchend.passive="onFabTouchEnd"
        title="查看当前楼层变量更新（UpdateVariable）"
      >
        <i class="fa-solid fa-code"></i>
        <span class="variable-fab-text">变量</span>
        <span class="drag-hint">拖动我</span>
      </button>
    </main>

    <!-- Modals：左上角绿色编辑完成，右上角红色取消 -->
    <Transition name="modal">
      <div v-if="isModalOpen" id="modal-overlay" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content rule-modal-content" :class="{ dark: isDarkMode, light: !isDarkMode }">
          <div class="modal-header rule-modal-header">
            <button type="button" class="btn-complete" aria-label="编辑完成" @click="onModalComplete">
              <i class="fa-solid fa-check" aria-hidden="true"></i>
              <span class="btn-complete-text">编辑完成</span>
            </button>
            <h2>{{ modalTitle }}</h2>
            <button type="button" id="btn-cancel-modal" class="btn-cancel" aria-label="取消" @click="closeModal">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              <span class="btn-cancel-text">取消</span>
            </button>
          </div>
          <div class="modal-body">
            <!-- 新增角色 -->
            <div v-if="modalType === 'add_character'" class="rule-form">
              <label class="form-label">角色名字</label>
              <input
                v-model="modalForm.addCharacterName"
                type="text"
                class="form-input"
                placeholder="输入角色名字"
              />
              <label class="form-label">简单描述角色</label>
              <textarea
                v-model="modalForm.addCharacterDescription"
                class="form-textarea"
                rows="6"
                placeholder="简要描述外貌、身份、性格等..."
              />
              <p class="form-hint">
                确认后仅将请求填入输入框并发消息，不会立刻写入角色档案；新角色在 AI（或第二 API 处理变量）生成变量后才会出现，避免重复。
              </p>
            </div>
            <!-- 新增世界规则 -->
            <div v-else-if="modalType === 'add_world_rule'" class="rule-form">
              <label class="form-label">规则名称</label>
              <input v-model="modalForm.worldRuleName" type="text" class="form-input" placeholder="输入世界规则名称" />
              <label class="form-label">规则细节</label>
              <textarea
                v-model="modalForm.worldRuleDetail"
                class="form-textarea"
                rows="4"
                placeholder="输入规则细节描述..."
              />
            </div>
            <!-- 编辑世界规则 -->
            <div v-else-if="modalType === 'edit_world_rule'" class="rule-form">
              <label class="form-label">规则名称</label>
              <input v-model="modalForm.worldRuleName" type="text" class="form-input" placeholder="输入世界规则名称" />
              <label class="form-label">规则细节</label>
              <textarea
                v-model="modalForm.worldRuleDetail"
                class="form-textarea"
                rows="4"
                placeholder="输入规则细节描述..."
              />
            </div>
            <!-- 新增区域 -->
            <div v-else-if="modalType === 'add_region'" class="rule-form">
              <label class="form-label">区域名称</label>
              <input v-model="modalForm.regionName" type="text" class="form-input" placeholder="输入区域名称" />
              <label class="form-label">规则名字</label>
              <input
                v-model="modalForm.regionFirstRuleName"
                type="text"
                class="form-input"
                placeholder="该区域内一条细分规则的名称（可选；填写后会同步到变量「细分规则」）"
              />
              <label class="form-label">规则细节</label>
              <textarea
                v-model="modalForm.regionDetail"
                class="form-textarea"
                rows="4"
                placeholder="输入该区域的规则细节..."
              />
            </div>
            <!-- 编辑区域 -->
            <div v-else-if="modalType === 'edit_region'" class="rule-form">
              <label class="form-label">区域名称</label>
              <input v-model="modalForm.regionName" type="text" class="form-input" placeholder="输入区域名称" />
              <label class="form-label">规则细节</label>
              <textarea
                v-model="modalForm.regionDetail"
                class="form-textarea"
                rows="4"
                placeholder="输入该区域的规则细节..."
              />
            </div>
            <!-- 新增区域规则 -->
            <div v-else-if="modalType === 'add_region_rule'" class="rule-form">
              <label class="form-label">所属区域</label>
              <input v-model="modalForm.regionName" type="text" class="form-input" disabled />
              <label class="form-label">规则名称</label>
              <input v-model="modalForm.regionRuleName" type="text" class="form-input" placeholder="输入规则名称" />
              <label class="form-label">规则细节</label>
              <textarea
                v-model="modalForm.regionRuleDetail"
                class="form-textarea"
                rows="4"
                placeholder="输入该规则的细节..."
              />
            </div>
            <!-- 编辑区域规则 -->
            <div v-else-if="modalType === 'edit_region_rule'" class="rule-form">
              <label class="form-label">所属区域</label>
              <input v-model="modalForm.regionName" type="text" class="form-input" disabled />
              <label class="form-label">规则名称</label>
              <input v-model="modalForm.regionRuleName" type="text" class="form-input" placeholder="输入规则名称" />
              <label class="form-label">规则细节</label>
              <textarea
                v-model="modalForm.regionRuleDetail"
                class="form-textarea"
                rows="4"
                placeholder="输入该规则的细节..."
              />
            </div>
            <!-- 新增个人规则 -->
            <div v-else-if="modalType === 'add_personal_rule'" class="rule-form">
              <label class="form-label">对象（角色名）</label>
              <PersonalRuleCharacterPicker v-model="modalForm.personalRuleCharacter" />
              <label class="form-label">规则名字</label>
              <input
                v-model="modalForm.personalRuleName"
                type="text"
                class="form-input"
                placeholder="输入本条个人规则的名称"
              />
              <label class="form-label">规则细节</label>
              <textarea
                v-model="modalForm.personalRuleDetail"
                class="form-textarea"
                rows="4"
                placeholder="输入个人规则细节..."
              />
            </div>
            <!-- 编辑个人规则 -->
            <div v-else-if="modalType === 'edit_personal_rule'" class="rule-form">
              <label class="form-label">对象（角色名）</label>
              <PersonalRuleCharacterPicker v-model="modalForm.personalRuleCharacter" />
              <label class="form-label">规则名字</label>
              <input
                v-model="modalForm.personalRuleName"
                type="text"
                class="form-input"
                placeholder="输入本条个人规则的名称"
              />
              <label class="form-label">规则细节</label>
              <textarea
                v-model="modalForm.personalRuleDetail"
                class="form-textarea"
                rows="4"
                placeholder="输入个人规则细节..."
              />
            </div>
            <!-- 编辑心理状态 -->
            <div v-else-if="modalType === 'edit_character_mind'" class="rule-form">
              <label class="form-label">当前内心想法</label>
              <textarea
                v-model="modalForm.characterPsychThought"
                class="form-textarea"
                rows="3"
                placeholder="输入该角色当前的内心想法..."
              />

              <label class="form-label">性格（每行一条「名称：描述」，或单独一行描述）</label>
              <textarea
                v-model="modalForm.characterPsychTraits"
                class="form-textarea"
                rows="3"
                placeholder="例如：&#10;傲娇：口是心非&#10;高自尊：在意他人眼光"
              />
            </div>
            <!-- 编辑性癖与敏感带 -->
            <div v-else-if="modalType === 'edit_character_fetish'" class="rule-form">
              <label class="form-label">敏感点开发（每行一条「部位：反应或敏感描述」；兼容旧变量键「敏感部位」）</label>
              <textarea
                v-model="modalForm.characterPsychSensitiveParts"
                class="form-textarea"
                rows="3"
                placeholder="例如：&#10;耳垂：轻咬会发抖&#10;后颈：怕痒"
              />

              <label class="form-label">性癖（每行一条「名称：开发程度或表现」）</label>
              <textarea
                v-model="modalForm.characterPsychFetishes"
                class="form-textarea"
                rows="3"
                placeholder="例如：&#10;命令：初级&#10;足控：未觉醒"
              />

              <label class="form-label">隐藏性癖</label>
              <textarea
                v-model="modalForm.characterPsychHiddenFetish"
                class="form-textarea"
                rows="3"
                placeholder="输入隐藏性癖描述..."
              />

              <!-- 敏感点开发详情编辑 -->
              <div class="detail-edit-section">
                <button
                  type="button"
                  class="detail-edit-toggle"
                  @click="modalForm.showSensitivePartDetails = !modalForm.showSensitivePartDetails"
                >
                  <i :class="modalForm.showSensitivePartDetails ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
                  <span>编辑敏感点开发详情（等级、生理反应、开发细节）</span>
                </button>
                <div v-if="modalForm.showSensitivePartDetails" class="detail-edit-content">
                  <div
                    v-for="(part, idx) in modalForm.sensitivePartDetails"
                    :key="idx"
                    class="detail-edit-row"
                  >
                    <div class="detail-edit-header">
                      <input
                        v-model="part.name"
                        type="text"
                        class="form-input detail-name-input"
                        placeholder="部位名称"
                      />
                      <button
                        type="button"
                        class="btn-icon btn-danger"
                        @click="modalForm.sensitivePartDetails.splice(idx, 1)"
                        title="删除"
                      >
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                    <div class="detail-edit-fields">
                      <div class="detail-field">
                        <label>敏感等级</label>
                        <input
                          v-model.number="part.level"
                          type="number"
                          class="form-input"
                          min="1"
                          max="10"
                          placeholder="1-10"
                        />
                      </div>
                      <div class="detail-field">
                        <label>生理反应</label>
                        <input
                          v-model="part.reaction"
                          type="text"
                          class="form-input"
                          placeholder="被触碰时的反应"
                        />
                      </div>
                      <div class="detail-field full-width">
                        <label>开发细节</label>
                        <textarea
                          v-model="part.devDetails"
                          class="form-textarea"
                          rows="2"
                          placeholder="部位的开发进度和细节..."
                        ></textarea>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn-secondary"
                    @click="modalForm.sensitivePartDetails.push({ name: '', level: 1, reaction: '', devDetails: '' })"
                  >
                    <i class="fa-solid fa-plus"></i>
                    添加敏感点
                  </button>
                </div>
              </div>

              <!-- 性癖详情编辑 -->
              <div class="detail-edit-section">
                <button
                  type="button"
                  class="detail-edit-toggle"
                  @click="modalForm.showFetishDetails = !modalForm.showFetishDetails"
                >
                  <i :class="modalForm.showFetishDetails ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
                  <span>编辑性癖详情（等级、细节描述、自我合理化）</span>
                </button>
                <div v-if="modalForm.showFetishDetails" class="detail-edit-content">
                  <div
                    v-for="(fetish, idx) in modalForm.fetishDetails"
                    :key="idx"
                    class="detail-edit-row"
                  >
                    <div class="detail-edit-header">
                      <input
                        v-model="fetish.name"
                        type="text"
                        class="form-input detail-name-input"
                        placeholder="性癖名称"
                      />
                      <button
                        type="button"
                        class="btn-icon btn-danger"
                        @click="modalForm.fetishDetails.splice(idx, 1)"
                        title="删除"
                      >
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                    <div class="detail-edit-fields">
                      <div class="detail-field">
                        <label>等级</label>
                        <input
                          v-model.number="fetish.level"
                          type="number"
                          class="form-input"
                          min="1"
                          max="10"
                          placeholder="1-10"
                        />
                      </div>
                      <div class="detail-field">
                        <label>细节描述</label>
                        <input
                          v-model="fetish.description"
                          type="text"
                          class="form-input"
                          placeholder="性癖的具体表现"
                        />
                      </div>
                      <div class="detail-field full-width">
                        <label>自我合理化</label>
                        <textarea
                          v-model="fetish.justification"
                          class="form-textarea"
                          rows="2"
                          placeholder="傲娇的借口或理智与本能的冲突..."
                        ></textarea>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn-secondary"
                    @click="modalForm.fetishDetails.push({ name: '', level: 1, description: '', justification: '' })"
                  >
                    <i class="fa-solid fa-plus"></i>
                    添加性癖
                  </button>
                </div>
              </div>
            </div>
            <div v-else-if="modalType === 'edit_avatar'" class="rule-form edit-avatar-form">
              <label class="form-label">本地上传</label>
              <input
                ref="avatarFileInputRef"
                type="file"
                accept="image/*"
                class="avatar-file-input"
                @change="onAvatarFileSelected"
              />
              <div class="avatar-upload-actions">
                <button type="button" class="btn-secondary" @click="triggerAvatarFilePick">
                  <i class="fa-solid fa-upload"></i>
                  <span>选择本地图片</span>
                </button>
                <button
                  v-if="modalForm.avatarUrl"
                  type="button"
                  class="btn-secondary avatar-clear-btn"
                  @click="modalForm.avatarUrl = ''"
                >
                  清除
                </button>
              </div>
              <p class="avatar-upload-hint">
                头像与 MVU 角色档案里的「头像」字段无关：仅写入本机 localStorage（与小手机微信/档案经壳同步）。支持常见格式，原图建议小于 12MB；将自动缩放并转为 WebP / JPEG。
              </p>

              <label class="form-label">或填写图片 URL（同样仅存浏览器）</label>
              <input
                v-model="modalForm.avatarUrl"
                type="text"
                class="form-input"
                placeholder="粘贴 https 图片链接（留空并确定则清除本机覆盖）"
              />

              <div v-if="isAvatarPreviewable(modalForm.avatarUrl)" class="avatar-edit-preview">
                <img :src="modalForm.avatarUrl" alt="头像预览" />
              </div>
            </div>
            <!-- 编辑身份标签 -->
            <div v-else-if="modalType === 'edit_identity_tags'" class="rule-form identity-tags-form">
              <p class="form-hint">身份标签用于记录角色的核心萌点、招牌口癖等，便于随时口胡设定。</p>
              <div
                v-for="(tag, idx) in modalForm.identityTags"
                :key="idx"
                class="identity-tag-edit-row"
              >
                <input
                  v-model="tag.category"
                  type="text"
                  class="form-input identity-category-input"
                  placeholder="分类（如：核心萌点、招牌口癖）"
                />
                <input
                  v-model="tag.value"
                  type="text"
                  class="form-input identity-value-input"
                  placeholder="标签内容"
                />
                <button
                  type="button"
                  class="btn-icon btn-danger"
                  @click="modalForm.identityTags.splice(idx, 1)"
                  title="删除"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
              <button
                type="button"
                class="btn-secondary"
                @click="modalForm.identityTags.push({ category: '', value: '' })"
              >
                <i class="fa-solid fa-plus"></i>
                添加身份标签
              </button>
            </div>
            <div v-else-if="modalType === 'edit_character_appearance'" class="rule-form character-appearance-form">
              <p class="form-hint">编辑 MVU「服装状态」与「身体部位物理状态」。饰品以<strong>名字</strong>为键，并填写<strong>部位</strong>与<strong>描述</strong>。</p>
              <h4 class="appearance-section-title">服装槽位</h4>
              <div
                v-for="slotKey in appearanceSlotKeys"
                :key="slotKey"
                class="appearance-slot-block"
              >
                <div class="appearance-slot-label">{{ slotKey }}</div>
                <div class="detail-edit-fields">
                  <div class="detail-field">
                    <label>名称</label>
                    <input
                      v-model="modalForm.appearanceClothing[slotKey].名称"
                      type="text"
                      class="form-input"
                      placeholder="名称"
                    />
                  </div>
                  <div class="detail-field">
                    <label>状态</label>
                    <input
                      v-model="modalForm.appearanceClothing[slotKey].状态"
                      type="text"
                      class="form-input"
                      placeholder="如：正常"
                    />
                  </div>
                  <div class="detail-field full-width">
                    <label>描述</label>
                    <textarea
                      v-model="modalForm.appearanceClothing[slotKey].描述"
                      class="form-textarea"
                      rows="2"
                      placeholder="外观或穿着描述"
                    />
                  </div>
                </div>
              </div>
              <h4 class="appearance-section-title">饰品</h4>
              <div
                v-for="(jw, jidx) in modalForm.appearanceJewelryRows"
                :key="'jw-' + jidx"
                class="appearance-jewelry-block"
              >
                <div class="appearance-jewelry-toolbar">
                  <span class="appearance-slot-label">第 {{ jidx + 1 }} 件</span>
                  <button
                    type="button"
                    class="btn-icon btn-danger"
                    @click="modalForm.appearanceJewelryRows.splice(jidx, 1)"
                    title="删除"
                  >
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
                <div class="detail-edit-fields">
                  <div class="detail-field">
                    <label>名字</label>
                    <input
                      v-model="jw.name"
                      type="text"
                      class="form-input"
                      placeholder="如：金丝眼镜"
                    />
                  </div>
                  <div class="detail-field">
                    <label>部位</label>
                    <input
                      v-model="jw.部位"
                      type="text"
                      class="form-input"
                      placeholder="如：鼻梁、手腕"
                    />
                  </div>
                  <div class="detail-field full-width">
                    <label>描述</label>
                    <textarea
                      v-model="jw.描述"
                      class="form-textarea"
                      rows="2"
                      placeholder="外观或佩戴方式等"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="btn-secondary"
                @click="modalForm.appearanceJewelryRows.push({ name: '', 部位: '', 描述: '' })"
              >
                <i class="fa-solid fa-plus"></i>
                添加饰品
              </button>
              <h4 class="appearance-section-title">身体部位物理状态</h4>
              <div
                v-for="(bp, bpidx) in modalForm.appearanceBodyPartRows"
                :key="bpidx"
                class="detail-edit-row"
              >
                <div class="detail-edit-header">
                  <input
                    v-model="bp.key"
                    type="text"
                    class="form-input detail-name-input"
                    placeholder="部位名称"
                  />
                  <button
                    type="button"
                    class="btn-icon btn-danger"
                    @click="modalForm.appearanceBodyPartRows.splice(bpidx, 1)"
                    title="删除"
                  >
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
                <div class="detail-edit-fields">
                  <div class="detail-field full-width">
                    <label>外观描述</label>
                    <textarea
                      v-model="bp.外观描述"
                      class="form-textarea"
                      rows="2"
                      placeholder="形态、颜色等"
                    />
                  </div>
                  <div class="detail-field full-width">
                    <label>当前状态</label>
                    <textarea
                      v-model="bp.当前状态"
                      class="form-textarea"
                      rows="2"
                      placeholder="即时物理/体液状态"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="btn-secondary"
                @click="modalForm.appearanceBodyPartRows.push({ key: '', 外观描述: '', 当前状态: '' })"
              >
                <i class="fa-solid fa-plus"></i>
                添加身体部位
              </button>
            </div>
            <div v-else class="modal-placeholder">
              <p>未配置的弹窗类型：<code>{{ modalType }}</code></p>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 长按正文：上下文菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu"
        class="context-menu maintext-context-menu"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
        :style="contextMenuStyle"
        @click.stop
      >
        <div class="context-menu-header">
          <span>操作</span>
          <button type="button" class="context-menu-close" @click="closeContextMenu">×</button>
        </div>
        <button
          type="button"
          class="context-menu-item"
          :disabled="isGenerating || isVariablePersistInProgress"
          @click="handleRegenerate"
        >
          {{ isGenerating ? '⏳ 处理中...' : '🔄 重roll' }}
        </button>
        <button
          type="button"
          class="context-menu-item"
          :disabled="isGenerating || isVariablePersistInProgress"
          @click="handleRegenerateVariablesOnly"
        >
          {{ isGenerating ? '⏳ 处理中...' : '🎲 单独重roll变量' }}
        </button>
        <button
          type="button"
          class="context-menu-item"
          :disabled="isGenerating || isVariablePersistInProgress"
          @click="handleEdit"
        >
          ✏️ 修改正文
        </button>
      </div>
    </Teleport>

    <!-- 编辑正文模态框 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="editingMessage"
          class="edit-maintext-overlay"
          @click.self="closeEditModal"
        >
          <div class="edit-maintext-modal" :class="{ dark: isDarkMode, light: !isDarkMode }">
            <div class="edit-maintext-header">
              <h2>编辑正文</h2>
              <button type="button" class="close-btn" @click="closeEditModal">×</button>
            </div>
            <div class="edit-maintext-body">
              <textarea
                v-if="editingMessage"
                v-model="editingText"
                class="edit-maintext-textarea"
                rows="16"
                placeholder="正文内容..."
              />
              <div class="edit-maintext-actions">
                <button type="button" class="btn-secondary" @click="closeEditModal">取消</button>
                <button type="button" class="btn-primary" @click="handleSaveEdit">保存</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 单独重roll变量：预览/编辑弹窗（确认后才写回楼层） -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="variableRerollDialogOpen"
          class="edit-maintext-overlay"
          @click.self="closeVariableRerollDialog"
        >
          <div class="edit-maintext-modal" :class="{ dark: isDarkMode, light: !isDarkMode }">
            <div class="edit-maintext-header">
              <h2>单独重roll变量预览</h2>
              <button type="button" class="close-btn" @click="closeVariableRerollDialog">×</button>
            </div>
            <div class="edit-maintext-body">
              <div class="variable-reroll-hint">
                <p>这里是本次重roll生成的 <code>&lt;UpdateVariable&gt;</code> 内容（JSON Patch）。你可以直接修改，确认后才会应用到当前楼层变量。</p>
              </div>
              <textarea
                v-model="variableRerollPatchText"
                class="edit-maintext-textarea"
                rows="16"
                placeholder='例如：[{ "op": "replace", "path": "/元信息/进度", "value": 5 }]'
              />
              <div class="edit-maintext-actions">
                <button type="button" class="btn-secondary" @click="closeVariableRerollDialog">取消</button>
                <button type="button" class="btn-primary" :disabled="isGenerating" @click="confirmVariableRerollApply">
                  {{ isGenerating ? '处理中...' : '确认应用' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 当前楼层：变量更新查看弹窗（只读） -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="variableUpdateDialogOpen"
          class="edit-maintext-overlay"
          @click.self="closeVariableUpdateDialog"
        >
          <div class="edit-maintext-modal" :class="{ dark: isDarkMode, light: !isDarkMode }">
            <div class="edit-maintext-header">
              <h2>本楼层变量更新（UpdateVariable）</h2>
              <button type="button" class="close-btn" @click="closeVariableUpdateDialog">×</button>
            </div>
            <div class="edit-maintext-body">
              <div class="variable-reroll-hint">
                <p>这里展示的是当前楼层消息里 <code>&lt;UpdateVariable&gt;</code> 标签内部的原始内容（通常是 JSON Patch）。</p>
              </div>
              <textarea
                v-model="variableUpdateDialogText"
                class="edit-maintext-textarea"
                rows="16"
                readonly
                placeholder="当前楼层没有 UpdateVariable 内容"
              />
              <div class="edit-maintext-actions">
                <button type="button" class="btn-secondary" @click="closeVariableUpdateDialog">关闭</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>

  <!-- 开场白生成中：始终在 body（开局无 #app-root） -->
  <Teleport to="body">
    <div
      v-if="isGeneratingOpening"
      class="opening-generating-overlay"
      :class="{ 'dark': isDarkMode, 'light': !isDarkMode }"
    >
      <div class="opening-generating-content">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <span class="opening-generating-text">{{
          openingSecondaryApiPhase ? '开场白设计完毕，正在解析变量。' : '正在生成开场白...'
        }}</span>
        <span v-if="!openingSecondaryApiPhase" class="opening-generating-hint">AI 正在根据您的设定创作故事</span>
        <button class="opening-generating-stop-btn" @click="stopOpeningGeneration">
          <i class="fa-solid fa-stop"></i>
          <span>停止生成</span>
        </button>
      </div>
    </div>
  </Teleport>

  <!-- 标签检验 / 末尾玩家楼 / MVU：游戏内全屏时须挂在 #app-root 内；Teleport 需单根，用 contents 避免影响布局 -->
  <Teleport :to="gameSurfaceTeleportTarget">
    <div class="game-surface-teleport-slot">
    <!-- 标签验证弹窗（开局/游戏阶段都可显示） -->
    <Transition name="modal">
      <div v-if="isTagDialogOpen" class="modal-overlay tag-validation-overlay">
        <div
          class="modal-content tag-validation-modal"
          :class="{
            dark: isDarkMode,
            light: !isDarkMode,
            'is-raw-maximized': showAiOutput && tagDialogRawMaximized,
          }"
        >
          <div class="modal-header">
            <h2><i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> 标签验证结果</h2>
            <button class="close-btn" @click="onTagDialogCloseAttempt">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="tag-validation-content">
              <p class="validation-intro">AI 输出标签检核结果：</p>

              <div class="ai-output-time" v-if="lastGenerationDurationLabel">
                本次生成耗时：{{ lastGenerationDurationLabel }}
              </div>

              <div class="validation-duplicate-hint" v-if="tagCheckHasDuplicateOpenWarning(tagCheckResults)">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>黄色表示<strong>多组闭合</strong>或<strong>开比闭多 1 个</strong>（仍按最后一对解析）；绿色仅当<strong>恰好 1 开 1 闭</strong>；红色为未正确闭合或闭标签过多。</span>
              </div>

              <div class="tag-status-list">
                <div
                  v-for="result in tagCheckResults"
                  :key="result.tag"
                  class="tag-status-item"
                  :class="{
                    'is-valid': result.severity === 'ok',
                    'is-warning': result.severity === 'warning',
                    'is-invalid': result.severity === 'error',
                  }"
                >
                  <div class="tag-status-header">
                    <span class="tag-name">
                      {{ tagCheckLabel(result.tag) }}
                      <span class="tag-name-code">{{ tagCheckTagCodeDisplay(result.tag) }}</span>
                    </span>
                    <span
                      class="tag-badge"
                      :class="{
                        'badge-success': result.severity === 'ok',
                        'badge-warning': result.severity === 'warning',
                        'badge-error': result.severity === 'error',
                      }"
                    >
                      {{ tagCheckBadgeLabel(result) }}
                    </span>
                  </div>
                  <p class="tag-message" :title="result.message">{{ result.message }}</p>
                </div>
              </div>

              <div class="validation-warning" v-if="tagCheckHasBlockingInvalid(tagCheckResults)">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>存在格式错误的消息可能无法正常显示。建议回退后重试。</span>
              </div>

              <!-- AI 完整输出内容展示 -->
              <div class="ai-output-section">
                <p
                  v-show="!tagDialogRawMaximized"
                  class="tag-dialog-patch-hint"
                  :class="{ 'tag-dialog-patch-hint--urgent': tagDialogShowPatchHint }"
                  role="button"
                  tabindex="0"
                  @click="openTagDialogPatchEditor"
                  @keydown.enter.prevent="openTagDialogPatchEditor"
                  @keydown.space.prevent="openTagDialogPatchEditor"
                >
                  <template v-if="tagDialogShowPatchHint">
                    检测到正文或选项等标签异常。请点此展开全文，手动补全标签后点「重新检验」，最后在底部「确认」生效。
                  </template>
                  <template v-else>
                    当前标签检核均为正常。仍可点此展开全文核对或微调；若有修改，请点「重新检验」后，在底部「确认」生效。
                  </template>
                </p>
                <button
                  type="button"
                  class="ai-output-toggle"
                  :class="{ 'is-patch-suggested': tagDialogShowPatchHint && !showAiOutput }"
                  @click="toggleTagDialogAiOutput"
                >
                  <i :class="showAiOutput ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'"></i>
                  <span>{{
                    showAiOutput ? '收起正文（显示标签检核）' : '查看 / 手动修补 AI 输出'
                  }}</span>
                  <span class="output-length">({{ tagDialogEditedRaw.length }} 字符)</span>
                </button>
                <p v-show="showAiOutput && !tagDialogRawMaximized" class="tag-dialog-edit-hint">
                  若标签缺失或未闭合，可在下方补全
                  <code>&lt;maintext&gt;</code> / <code>&lt;content&gt;</code> 与
                  <code>&lt;/maintext&gt;</code> / <code>&lt;/content&gt;</code>
                  后点「重新检验」，再「确认」写入本楼层。
                </p>
                <Transition name="slide">
                  <div v-show="showAiOutput" class="ai-output-content tag-dialog-edit-wrap">
                    <textarea
                      ref="tagDialogRawTextareaRef"
                      v-model="tagDialogEditedRaw"
                      class="ai-output-text tag-dialog-raw-textarea"
                      rows="14"
                      spellcheck="false"
                      autocomplete="off"
                      autocorrect="off"
                      autocapitalize="off"
                      @select="syncTagDialogTextareaSelection"
                      @keyup="syncTagDialogTextareaSelection"
                      @click="syncTagDialogTextareaSelection"
                      @blur="syncTagDialogTextareaSelection"
                    />
                    <div class="tag-dialog-edit-actions">
                      <button type="button" class="btn-secondary btn-recheck-tags" @click="recheckTagDialogContent">
                        <i class="fa-solid fa-rotate"></i>
                        重新检验标签
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
          <div class="modal-footer tag-validation-footer">
            <template v-if="showAiOutput && tagDialogRawMaximized">
              <button
                type="button"
                class="btn-secondary btn-insert-maintext-tag"
                title="在光标处插入开始标签"
                @mousedown.prevent
                @click="insertMaintextTagAtCursor('open')"
              >
                &lt;maintext&gt;
              </button>
              <button
                type="button"
                class="btn-secondary btn-insert-maintext-tag"
                title="在光标处插入结束标签"
                @mousedown.prevent
                @click="insertMaintextTagAtCursor('close')"
              >
                &lt;/maintext&gt;
              </button>
            </template>
            <button type="button" class="btn-secondary btn-rollback" @click="onTagDialogRollback">
              <i class="fa-solid fa-rotate-left"></i>
              回退到发送前
            </button>
            <button type="button" class="btn-primary btn-continue" @click="void onTagDialogIgnore()">
              <i class="fa-solid fa-check"></i>
              {{ tagCheckHasBlockingInvalid(tagCheckResults) ? '无视错误确认' : '确认信息' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 末尾为玩家楼层检测（重载/异常时便于删楼重生成） -->
    <Transition name="modal">
      <div
        v-if="orphanUserFloorDialogOpen"
        class="modal-overlay orphan-user-floor-overlay"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
        @click.self="dismissOrphanUserFloorDialog"
      >
        <div class="modal-content orphan-user-floor-modal" :class="{ dark: isDarkMode, light: !isDarkMode }">
          <div class="modal-header">
            <h2><i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> 末尾楼层为玩家发言</h2>
            <button type="button" class="close-btn" @click="dismissOrphanUserFloorDialog">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <p class="orphan-user-floor-intro">
              检测到聊天<strong>最后一楼可见消息</strong>不是 AI 回复（玩家消息）。常见于界面异常、重载后未接上生成等情况。
            </p>
            <p v-if="orphanUserFloorMessageId != null" class="orphan-user-floor-meta">
              将删除楼层：<code>#{{ orphanUserFloorMessageId }}</code>
            </p>
            <p class="orphan-user-floor-hint">
              确认后将删除该条玩家发言并刷新正文；请在<strong>酒馆中点击继续生成</strong>（或使用本界面输入后发送）以重新获取 AI 回复。
            </p>
          </div>
          <div class="modal-footer orphan-user-floor-footer">
            <button type="button" class="btn-secondary" @click="dismissOrphanUserFloorDialog">暂不处理</button>
            <button type="button" class="btn-primary" @click="confirmOrphanUserFloorDelete">确认删除</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div
        v-if="showMvuMissingModal"
        class="mvu-missing-modal-overlay"
        @click.self="showMvuMissingModal = false"
      >
        <div
          class="mvu-missing-modal"
          :class="{ 'dark': isDarkMode, 'light': !isDarkMode }"
        >
          <div class="modal-header">
            <i class="fa-solid fa-circle-exclamation"></i>
            <h3>变量缺失提示</h3>
          </div>

          <div class="modal-body">
            <p>目前 MVU 变量存在缺失，这可能导致界面无法正常工作。</p>
            <p class="suggestion">建议操作：</p>
            <ul>
              <li>重试额外模型解析</li>
              <li>重新处理变量</li>
            </ul>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-primary" @click="confirmMvuMissing">
              确认了解
            </button>
          </div>
        </div>
      </div>
    </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import CharacterPanel from './components/CharacterPanel.vue';
import WorldRulesPanel from './components/WorldRulesPanel.vue';
import RegionalRulesHub from './components/RegionalRulesHub.vue';
import PersonalRulesPanel from './components/PersonalRulesPanel.vue';
import PersonalRuleCharacterPicker from './components/PersonalRuleCharacterPicker.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import OpeningForm from './components/OpeningForm.vue';
import WorldLifePanel from './components/WorldLifePanel.vue';
import RandomRulesPanel from './components/RandomRulesPanel.vue';

// 赛博朋克特效组件
import ParallaxBackground from './components/ParallaxBackground.vue';
import EditCartItemEditor from './components/EditCartItemEditor.vue';
import TerminalSnippets from './components/TerminalSnippets.vue';
import HeaderEffects from './components/HeaderEffects.vue';
import SidebarEffects from './components/SidebarEffects.vue';
// 游戏时间组件
import GameTimeDisplay from './components/GameTimeDisplay.vue';
import {
  loadFromLatestMessage,
  parseMaintext,
  parseOptions,
  validateTags,
  isFilteringComplete,
  extractFilteredContent,
  extractLastSumContent,
  replaceLastMaintextInnerContent,
  formatMaintextForHtmlView,
  type Option,
  type TagCheckResult
} from './utils/messageParser';
import { applyMaintextInlineBeautify } from './utils/maintextInlineBeautify';
import {
  GamePhase,
  CLOTHING_BODY_SLOT_KEYS,
  type JewelryEditRow,
  type OpeningFormData,
  type OutputMode,
} from './types';
import type { EditCartItem, EditCartModalForm } from './types/editCart';
import { klona } from 'klona';
import Swal from 'sweetalert2';
import {
  initializeGameVariables,
  createOpeningStoryMessage,
  isNewGame,
} from './utils/gameInitializer';
import {
  updateWorldbookEntriesByMode,
  isSecondaryApiConfigured,
  SECONDARY_API_END_EVENT,
  SECONDARY_API_START_EVENT,
  type SecondaryApiEndDetail,
  type SecondaryApiStartDetail,
} from './utils/apiSettings';
import {
  formatPersonalRuleKeysSection,
  VARIABLE_JSON_PATCH_RUNTIME_RULES,
} from './utils/variableUpdatePromptExtras';
import { startIframeHeightFix } from './utils/iframeHeightFix';
import type { UiLayoutSettings } from './utils/uiLayoutLimits';
import { clampMainUiHeightPx, clampMainUiWidthPx } from './utils/uiLayoutLimits';
import { loadUiLayout } from './utils/localSettings';
import { runShujukuManualUpdateAfterAssistantSaved } from './utils/shujukuBridge';
import { isRulesMvuLiveHostAtInit, useDataStore } from './store';
import { useEditCartStore } from './stores/editCart';
import { getOtherSettings } from './utils/otherSettings';
import {
  buildArchivePersonalFromPayload,
  buildArchivePersonalRulesGroupItem,
  buildArchiveRegionItem,
  buildArchiveRegionalRuleItem,
  buildArchiveWorldItem,
  buildCartItemFromModal,
  buildDeletePersonalFromPayload,
  buildDeletePersonalRulesGroupItem,
  buildDeleteRegionItem,
  buildDeleteRegionalRuleItem,
  buildDeleteWorldItem,
  isEditCartEnabled,
  stageItem,
} from './utils/editCartFlow';
import {
  applyJewelryRowsToClothing,
  bodyPartRowsFromMvuRaw,
  clothingStateFromMvuRaw,
  defaultEmptyClothingState,
  jewelryRowsFromClothingState,
  normalizeJewelryEditRow,
  submitEditCharacterAppearance,
} from './utils/dialogAndVariable';
import {
  fetishRecordToEditableText,
  getMergedSensitiveDevelopment,
  sensitiveRecordToEditableText,
  tagMapToEditableText,
} from './utils/tagMap';
import {
  PHONE_CHARACTER_AVATAR_MIRROR_REQUEST,
  PHONE_CHARACTER_AVATAR_SYNC_TYPE,
  applyCharacterAvatarOverrideLocal,
} from '../shared/phoneCharacterAvatarStorage';

/** 构建时注入，见 webpack DefinePlugin `__APP_VERSION__` */
const appBuildVersion = __APP_VERSION__;

/** 自增：用于在「放弃本回合」时使进行中的 `sendMessage` 在 await 返回后不再打开标签弹窗 */
let gameSendFlowGeneration = 0;

// 游戏阶段管理
const gamePhase = ref<GamePhase>(GamePhase.OPENING);

/** 全屏只作用于 #app-root；Teleport 到 body 的节点在全屏层外不可见，游戏阶段改挂 #app-root */
const gameSurfaceTeleportTarget = computed(() =>
  gamePhase.value === GamePhase.GAME ? '#app-root' : 'body',
);
const isInitializing = ref(false);
/** 历史楼层 iframe：只读快照（writeBack=false）；用于禁用暂存提交等，不显示顶栏提示 */
const rulesMvuArchiveReadOnly = ref(false);
const isStoreReady = ref(false); // store 数据是否就绪
const showMvuMissingTip = ref(false); // 是否显示 MVU 缺失提示
const mvuMissingTipDismissed = ref(false); // 用户是否已关闭过提示（本次会话）
const isGeneratingOpening = ref(false); // 开场白生成中（显示加载弹窗）
/** 开局生成流程中，第二 API 已开始请求时切换遮罩文案 */
const openingSecondaryApiPhase = ref(false);
/** 开局界面是否打开系统设置（与主界面 SettingsPanel 一致） */
const openingSettingsOpen = ref(false);
const openingGenerationId = ref<string>(''); // 开场白生成的唯一标识符，用于停止生成
/** 标签确认后：写入楼层、MVU 解析、开局第二 API 等进行中；不挡正文，仅顶栏提示并禁止发送 */
const isVariablePersistInProgress = ref(false);
const isOpeningPhase = ref(false); // 标志当前是否处于开局流程（用于标签弹窗区分）
/** 开局第一回合标签确认后已对 1 楼用 `</Cancel>…</Cancel>` 包裹，同一会话内不再执行 */
const openingMessage1CancelWrapDone = ref(false);
const openingFormKey = ref(0);
const isShaking = ref(false); // 震动动画状态 // 强制重置 OpeningForm（用于回退/失败后取消“开始游戏”转圈）
const openingFormRef = ref<InstanceType<typeof import('./components/OpeningForm.vue').default> | null>(null);

// 宿主会反复把同层 iframe 高度改成很小值（如 72px），需要在进入游戏阶段后兜底保持最小高度。
let stopIframeHeightFix: (() => void) | null = null;
/** 避免同值重复 stop/start iframe 兜底导致一帧高度异常 */
let lastIframeMinHeightApplied: number | null = null;

// 界面状态
const activeTab = ref<string | null>(null);
/** 区域规则 →「地图」子标签时桌面端铺满侧栏+原正文区（隐藏主栏） */
const regionalMapFullBleed = ref(false);
/** 与 SettingsPanel 一致：来自 MVU / localStorage，用于显示侧栏「暂存」入口 */
const editStagingCartEnabled = computed(() => getOtherSettings().enableEditStagingCart === true);
/** 主界面顶部游戏时间条：与 SettingsPanel「界面与布局」页开关一致 */
const showGameTimeHudEnabled = computed(() => getOtherSettings().showGameTimeHud);
const editCartStore = useEditCartStore();
// 用 items 派生数量，避免 storeToRefs(pendingCount) 与列表不同步导致「有项仍灰」
const { items: editCartItems } = storeToRefs(editCartStore);
const editCartPendingCount = computed(() => editCartItems.value.length);
const editCartSortedForUi = computed(() => editCartStore.sortedItems());
const editCartPanelOpen = ref(false);
const editCartApplying = ref(false);
const editCartEditorOpen = ref(false);
const editCartEditorItem = ref<EditCartItem | null>(null);
/** 不使用 window.confirm（iframe 内常被禁用），在面板内二次确认清空 */
const editCartAwaitingClearConfirm = ref(false);

watch(editCartPanelOpen, open => {
  if (!open) editCartAwaitingClearConfirm.value = false;
});

watch(editCartPendingCount, n => {
  if (n === 0) editCartAwaitingClearConfirm.value = false;
});

/** 与模板「确认提交」一致：不禁用按钮，仅样式 + 处理函数内早退，避免点击穿透 */
const editCartSubmitBlocked = computed(
  () =>
    editCartPendingCount.value === 0 ||
    editCartApplying.value ||
    rulesMvuArchiveReadOnly.value,
);
/** 打开个人规则面板时要展开的分组名（与 rule.target / 角色名一致）；由子组件消费后清空 */
const personalRulesExpandGroup = ref<string | null>(null);
/** 第二 API 处理变量时顶部黄色提示条（至标签检核弹窗打开为止） */
const secondaryApiBannerVisible = ref(false);
const secondaryApiBannerText = ref('第二 API 正在生成变量更新，可先阅读正文。');
/** 当前顶栏条语义：变量合并路 vs 地图短请求（后者由专用 end 事件收起） */
const secondaryApiBannerScope = ref<'none' | 'variable' | 'tactical'>('none');

function hideSecondaryApiBanner() {
  secondaryApiBannerVisible.value = false;
  secondaryApiBannerScope.value = 'none';
}

const isModalOpen = ref(false);
const modalType = ref('');
const modalPayload = ref<Record<string, any> | null>(null);
/** 编辑头像弹窗内隐藏的 file input */
const avatarFileInputRef = ref<HTMLInputElement | null>(null);
const isDarkMode = ref(true);

// MVU 缺失提示弹窗
const showMvuMissingModal = ref(false);

// 关闭 MVU 缺失提示
function onCloseMvuMissingTip() {
  showMvuMissingTip.value = false;
  mvuMissingTipDismissed.value = true;
  showMvuMissingModal.value = true;
}

// 确认 MVU 缺失提示
function confirmMvuMissing() {
  showMvuMissingModal.value = false;
  console.log('✅ [App] 用户已确认 MVU 变量缺失提示');
}

// 布局/缩放设置（来自系统设置）
// 默认 maxHeight: undefined 避免首帧硬编码 600 闪现；CSS 会用 auto 过渡，等数据水合后再固定
const uiLayout = ref<Partial<UiLayoutSettings>>({
  scale: 0.8,
  maxWidth: 900,
  heightMode: 'fit',
  maxHeight: undefined,
});

const rootStyle = computed(() => {
  const scale = Number(uiLayout.value.scale) || 1;

  // 全屏时使用视口尺寸，非全屏时使用用户设置
  const isFS = isFullscreen.value;
  const w = clampMainUiWidthPx(uiLayout.value.maxWidth);
  const maxWidth = isFS
    ? '100vw' // 全屏时占满视口宽度
    : `min(${w}px, 100vw)`; // 窄屏（如 300 宽）不超过视口

  // 若尚未水合（undefined），CSS 用 auto 避免闪现；水合后用固定值
  const rawMaxHeight = uiLayout.value.maxHeight;
  const maxHeight = isFS
    ? '100vh'
    : rawMaxHeight === undefined
      ? 'auto'
      : `${clampMainUiHeightPx(rawMaxHeight)}px`;

  return {
    '--ui-scale': String(scale),
    '--ui-max-width': maxWidth,
    '--ui-max-height': maxHeight,
  } as Record<string, string>;
});

// 弹窗表单数据（按类型复用）
const modalForm = ref({
  addCharacterName: '',
  addCharacterDescription: '',
  worldRuleName: '',
  worldRuleDetail: '',
  regionName: '',
  regionDetail: '',
  /** 新增区域：中间项「规则名字」，对应首条细分规则的键名 */
  regionFirstRuleName: '',
  regionRuleName: '',
  regionRuleDetail: '',
  personalRuleCharacter: '',
  personalRuleName: '',
  personalRuleDetail: '',
  characterPsychThought: '',
  characterPsychTraits: '',
  characterPsychFetishes: '',
  characterPsychSensitiveParts: '',
  characterPsychHiddenFetish: '',
  // 性癖详情编辑
  showFetishDetails: false,
  fetishDetails: [] as Array<{ name: string; level: number; description: string; justification: string }>,
  // 敏感部位详情编辑
  showSensitivePartDetails: false,
  sensitivePartDetails: [] as Array<{ name: string; level: number; reaction: string; devDetails: string }>,
  // 身份标签编辑
  identityTags: [] as Array<{ category: string; value: string }>,
  avatarUrl: '',
  appearanceClothing: defaultEmptyClothingState(),
  appearanceJewelryRows: [] as JewelryEditRow[],
  appearanceBodyPartRows: [] as Array<{ key: string; 外观描述: string; 当前状态: string }>,
});

const appearanceSlotKeys = CLOTHING_BODY_SLOT_KEYS;

// 同层界面状态
const userInput = ref('');
const isGenerating = ref(false);
const isRegenerating = ref(false); // 全文重 roll 中；遮罩/虚化仅在尚无正文时启用（流出正文后与发消息一致可先读）
/** 长按重 ROLL 生成完成后：在标签弹窗「确认」写入楼层后强制刷新一次（避免 messageId 未变导致 loadMessageContent 跳过） */
const refreshFromRerollAfterTagConfirm = ref(false);
/** 单独重roll变量模式：只更新变量，不修改正文/选项/sum，更新现有消息而不是创建新消息 */
const isVariableRerollOnly = ref(false);
const streamTextBuffer = ref('');

// 游戏消息相关状态
const mainText = ref('');
/** 正文只读展示：去注释/空行 + **心理**、「」/“”对白 本地 class 替换（不写回楼层） */
function maintextForHtmlDisplay(raw: string): string {
  return applyMaintextInlineBeautify(formatMaintextForHtmlView(raw));
}
const mainTextForView = computed(() => maintextForHtmlDisplay(mainText.value));
const options = ref<Option[]>([]);
const currentMessageId = ref<number | undefined>(undefined);
const isOptionsExpanded = ref(false); // 选项列表是否展开

// 视图模式
const viewMode = ref<'normal' | 'reader' | 'save'>('normal'); // 正常 | 阅读模式 | 读档模式
const isFullscreen = ref(false); // 是否全屏

// 阅读模式数据
const maintextHistory = ref<Array<{ messageId: number; maintext: string; turnNumber?: number; timestamp?: string }>>([]);

// 读档模式数据
const saveHistory = ref<Array<{ messageId: number; sum: string; turnNumber?: number; timestamp?: string }>>([]);

// 标签验证弹窗状态
const isTagDialogOpen = ref(false);
const tagCheckResults = ref<TagCheckResult[]>([]);
const lastGenerationRaw = ref('');
const lastGenerationDurationLabel = ref('');
/** 本次 AI 请求开始时刻（含主 generate + 双 API 第二段），用于弹窗显示耗时 */
const aiGenerationStartMs = ref(0);
const lastUserInputSnapshot = ref('');
const lastMaintextSnapshot = ref('');
const lastOptionsSnapshot = ref<Option[]>([]);
const lastMessageIdSnapshot = ref<number | undefined>(undefined);
const pendingUserMessageId = ref<number | null>(null);

/** 同 `sendMessage` 注册的流式监听 stop；便于中途取消时与 `sendMessage` 共用清理 */
const pendingGameStreamUnsub = ref<(() => void) | null>(null);

function clearPendingGameStreamSubscription() {
  const stop = pendingGameStreamUnsub.value;
  if (stop) {
    try {
      stop();
    } catch {
      /* 忽略 */
    }
    pendingGameStreamUnsub.value = null;
  }
}

/** 当前是否处于「已点发送、尚未打开标签检核」的主线生成（不含重 ROLL / 开局 / 单独重 roll 变量） */
const gameSendInProgressBeforeTag = ref(false);
const gameSendAbortInFlight = ref(false);

const showAbortGameSendChip = computed(
  () =>
    gamePhase.value === GamePhase.GAME &&
    viewMode.value === 'normal' &&
    isGenerating.value &&
    !isTagDialogOpen.value &&
    !isRegenerating.value &&
    !isGeneratingOpening.value &&
    !isVariablePersistInProgress.value &&
    gameSendInProgressBeforeTag.value,
);

async function onAbortGameSendBeforeTagConfirm() {
  if (gameSendAbortInFlight.value) return;
  if (!showAbortGameSendChip.value) return;

  gameSendAbortInFlight.value = true;
  try {
    gameSendFlowGeneration += 1;
    gameSendInProgressBeforeTag.value = false;
    clearPendingGameStreamSubscription();
    hideSecondaryApiBanner();
    await rollbackToSnapshot();
    isGenerating.value = false;
    streamTextBuffer.value = '';
    toastr.info('已回到发送前：本轮玩家楼层已移除，输入内容已填回输入框');
  } catch (e) {
    console.error('❌ [App] 放弃本回合失败:', e);
    toastr.error('放弃本回合失败: ' + String(e));
  } finally {
    gameSendAbortInFlight.value = false;
  }
}

const showAiOutput = ref(false); // 是否展开显示AI完整输出
/** 展开正文编辑时是否在弹窗内铺满（隐藏上方检核列表，textarea 占满剩余高度） */
const tagDialogRawMaximized = ref(false);
/** 标签检验弹窗内可编辑的完整 AI 输出（确认时写回 lastGenerationRaw） */
const tagDialogEditedRaw = ref('');
const tagDialogRawTextareaRef = ref<HTMLTextAreaElement | null>(null);
/** 正文框失焦前选区（用于 Tab 点到插入按钮时仍能插到原光标处） */
const tagDialogTextareaLastSel = ref({ start: 0, end: 0 });

function syncTagDialogTextareaSelection() {
  const el = tagDialogRawTextareaRef.value;
  if (!el) return;
  tagDialogTextareaLastSel.value = {
    start: el.selectionStart,
    end: el.selectionEnd,
  };
}

/** 末尾为玩家楼层：弹窗与本次会话内「已忽略」的 message_id */
const orphanUserFloorDialogOpen = ref(false);
const orphanUserFloorMessageId = ref<number | null>(null);
const orphanUserFloorDismissedMid = ref<number | null>(null);

// 长按正文：上下文菜单与编辑
const contextMenu = ref<{ x: number; y: number } | null>(null);
const editingMessage = ref<{
  messageId: number;
  fullMessage: string;
} | null>(null);
const editingText = ref(''); // 编辑中的正文，单独 ref 保证 v-model 响应
const currentMessageInfo = ref<{
  messageId?: number;
  userMessageId?: number;
  fullMessage?: string;
}>({});
const longPressTimerRef = ref<ReturnType<typeof setTimeout> | null>(null);
const maintextTouchStartPos = ref<{ x: number; y: number } | null>(null);

// 单独重roll变量：预览/编辑与待提交数据
const variableRerollDialogOpen = ref(false);
const variableRerollPatchText = ref('');
const pendingVariableReroll = ref<{
  messageId: number;
  filteredMessage: string;
  baseData: any;
  updatedMessage: string;
} | null>(null);

// 当前楼层：变量更新查看弹窗
const variableUpdateDialogOpen = ref(false);
const variableUpdateDialogText = ref('');

// 变量FAB按钮拖动功能
const variableFabPosition = ref({ x: 0, y: 0 });
const isDraggingFab = ref(false);
const hasFabDragged = ref(false);
const fabDragOffset = ref({ x: 0, y: 0 });
const fabDragStartPos = ref({ x: 0, y: 0 });
const fabRef = ref<HTMLElement | null>(null);

function onFabMouseDown(e: MouseEvent | TouchEvent) {
  // 左键或触摸开始拖动
  if (e instanceof MouseEvent && e.button !== 0) return;

  isDraggingFab.value = true;
  hasFabDragged.value = false;
  const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
  const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
  fabDragStartPos.value = { x: clientX, y: clientY };
  fabDragOffset.value = {
    x: clientX - variableFabPosition.value.x,
    y: clientY - variableFabPosition.value.y
  };

  // 添加全局事件监听（注意：touchend在按钮元素上处理，不在document上）
  document.addEventListener('mousemove', onFabMouseMove);
  document.addEventListener('mouseup', onFabMouseUp);
  document.addEventListener('touchmove', onFabTouchMove, { passive: false });
  // touchend在按钮的@touchend事件上处理
}

function onFabMouseMove(e: MouseEvent) {
  if (!isDraggingFab.value) return;
  e.preventDefault();

  const newX = e.clientX - fabDragOffset.value.x;
  const newY = e.clientY - fabDragOffset.value.y;

  // 判断是否实际拖动了（超过5像素认为是拖动而非点击）
  if (!hasFabDragged.value) {
    const dragDistance = Math.sqrt(
      Math.pow(e.clientX - fabDragStartPos.value.x, 2) +
      Math.pow(e.clientY - fabDragStartPos.value.y, 2)
    );
    if (dragDistance > 5) {
      hasFabDragged.value = true;
    }
  }

  variableFabPosition.value = { x: newX, y: newY };
}

function onFabTouchMove(e: TouchEvent) {
  if (!isDraggingFab.value) return;
  e.preventDefault();
  const touch = e.touches[0];

  const newX = touch.clientX - fabDragOffset.value.x;
  const newY = touch.clientY - fabDragOffset.value.y;

  // 判断是否实际拖动了
  if (!hasFabDragged.value) {
    const dragDistance = Math.sqrt(
      Math.pow(touch.clientX - fabDragStartPos.value.x, 2) +
      Math.pow(touch.clientY - fabDragStartPos.value.y, 2)
    );
    if (dragDistance > 5) {
      hasFabDragged.value = true;
    }
  }

  variableFabPosition.value = { x: newX, y: newY };
}

function onFabMouseUp() {
  isDraggingFab.value = false;
  document.removeEventListener('mousemove', onFabMouseMove);
  document.removeEventListener('mouseup', onFabMouseUp);
  document.removeEventListener('touchmove', onFabTouchMove);
  // 注意：touchend在按钮元素上处理，不在这里移除
}

// 处理FAB点击事件（区分点击和拖动）
function onFabClick(e: MouseEvent) {
  // 如果已经拖动了，阻止点击事件
  if (hasFabDragged.value) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  // 真正的点击，打开对话框（不检查 isDraggingFab，避免与 onFabMouseUp 的时序竞争）
  openVariableUpdateDialog();
}

// 触摸结束处理
function onFabTouchEnd(e: TouchEvent) {
  // 先结束拖动状态并清理document上的事件监听
  isDraggingFab.value = false;
  document.removeEventListener('mousemove', onFabMouseMove);
  document.removeEventListener('mouseup', onFabMouseUp);
  document.removeEventListener('touchmove', onFabTouchMove);

  // 如果已经拖动了，阻止点击行为
  if (hasFabDragged.value) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  // 真正的点击，打开对话框
  openVariableUpdateDialog();
}

// 计算FAB按钮样式
const variableFabStyle = computed(() => ({
  transform: `translate(${variableFabPosition.value.x}px, ${variableFabPosition.value.y}px)`,
  cursor: isDraggingFab.value ? 'grabbing' : 'grab'
}));

// 调试：监听 activeTab 的变化
watch(activeTab, (newVal, oldVal) => {
  console.log(`[调试] activeTab 变化: ${oldVal} -> ${newVal}`);
  if (newVal !== 'personal_rules') personalRulesExpandGroup.value = null;
  if (newVal !== 'regional_rules') regionalMapFullBleed.value = false;
}, { immediate: true });

function onRegionalHubSubTabChange(tab: 'rules' | 'map') {
  regionalMapFullBleed.value = tab === 'map';
}

watch(
  [gamePhase, () => uiLayout.value.maxHeight],
  () => {
    if (gamePhase.value !== GamePhase.GAME) {
      lastIframeMinHeightApplied = null;
      stopIframeHeightFix?.();
      stopIframeHeightFix = null;
      return;
    }
    const px = clampMainUiHeightPx(uiLayout.value.maxHeight);
    if (lastIframeMinHeightApplied === px && stopIframeHeightFix) return;
    lastIframeMinHeightApplied = px;
    stopIframeHeightFix?.();
    stopIframeHeightFix = startIframeHeightFix({ minHeightPx: px });
  },
  { immediate: true },
);

// 输出模式变更处理
function onOutputModeChange(mode: OutputMode) {
  console.log(`🔄 [App] 输出模式变更为: ${mode}`);
}

const TAG_CHECK_LABELS: Record<string, string> = {
  thinking: '思考',
  maintext: '正文',
  option: '选项',
  sum: '摘要',
  UpdateVariable: '变量',
};

function tagCheckLabel(tag: string): string {
  return TAG_CHECK_LABELS[tag] ?? tag;
}

/** 标签检验卡片上的标签名展示（正文含 <content> 别名） */
function tagCheckTagCodeDisplay(tag: string): string {
  if (tag === 'maintext') return '<maintext> / <content>';
  if (tag === 'option') return '<option> / <choice>';
  if (tag === 'UpdateVariable') return '<UpdateVariable>';
  return `<${tag}>`;
}

/** 仅 severity 为 error 的正文/思考/选项算阻塞；存疑（warning）不阻塞 */
function tagCheckHasBlockingInvalid(results: TagCheckResult[]): boolean {
  return results.some(
    (r) =>
      r.severity === 'error' &&
      r.tag !== 'sum' &&
      r.tag !== 'UpdateVariable',
  );
}

/** 折叠条处红色提示：阻塞性错误，或正文标签非「绿」 */
function tagCheckNeedsManualEditHint(results: TagCheckResult[]): boolean {
  if (tagCheckHasBlockingInvalid(results)) return true;
  const mt = results.find(r => r.tag === 'maintext');
  return mt != null && mt.severity !== 'ok';
}

function openTagDialogPatchEditor() {
  showAiOutput.value = true;
  tagDialogRawMaximized.value = true;
}

/** 点击「查看/手动修补」：展开并进入弹窗内最大化编辑；收起时恢复检核列表布局 */
function toggleTagDialogAiOutput() {
  if (showAiOutput.value) {
    showAiOutput.value = false;
    tagDialogRawMaximized.value = false;
  } else {
    showAiOutput.value = true;
    tagDialogRawMaximized.value = true;
  }
}

const tagDialogShowPatchHint = computed(() => tagCheckNeedsManualEditHint(tagCheckResults.value));

function tagCheckHasDuplicateOpenWarning(results: TagCheckResult[]): boolean {
  return results.some((r) => r.severity === 'warning');
}

function tagCheckBadgeLabel(result: TagCheckResult): string {
  if (result.severity === 'ok') return '✓ 绿';
  if (result.severity === 'warning') return '⚠ 黄';
  return '✗ 红';
}

function formatGenerationDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return '不足 1 秒';
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} 秒`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m} 分 ${String(rs).padStart(2, '0')} 秒`;
}

function onLayoutChange(layout: UiLayoutSettings) {
  const next = { ...uiLayout.value, ...layout };
  if (layout.maxWidth !== undefined) next.maxWidth = clampMainUiWidthPx(layout.maxWidth);
  if (layout.maxHeight !== undefined) next.maxHeight = clampMainUiHeightPx(layout.maxHeight);
  if (layout.scale !== undefined) {
    const s = Number(layout.scale);
    next.scale = Number.isFinite(s) ? Math.min(1.3, Math.max(0.8, s)) : next.scale;
  }
  uiLayout.value = next;
}

// 更新世界书条目
async function onUpdateWorldbook(mode: OutputMode) {
  try {
    console.log(`🔄 [App] 更新世界书条目为 ${mode} 模式`);
    const ok = await updateWorldbookEntriesByMode(mode);
    if (ok) {
      console.log('✅ [App] 世界书条目更新完成');
    } else {
      console.warn('⚠️ [App] 世界书条目未更新（可能未绑定世界书或世界书名为空）');
      toastr.warning('未能同步世界书：请为当前角色卡绑定主世界书，或检查世界书是否存在');
    }
  } catch (error) {
    console.error('❌ [App] 更新世界书条目失败:', error);
    toastr.error('切换失败');
  }
}

// 点击外部关闭长按上下文菜单
let contextMenuCleanup: (() => void) | null = null;

watch(contextMenu, (menu) => {
  // 清理之前的事件监听
  if (contextMenuCleanup) {
    contextMenuCleanup();
    contextMenuCleanup = null;
  }
  
  if (!menu) return;
  
  // 延迟添加事件监听，避免立即触发
  const timer = setTimeout(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.maintext-context-menu') || target.closest('.maintext-container')) return;
      closeContextMenu();
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };
    
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    
    contextMenuCleanup = () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, 100);
  
  return () => {
    clearTimeout(timer);
  };
});

const navItems = [
  { id: 'character', icon: 'fa-solid fa-user', label: '人物属性' },
  { id: 'world_rules', icon: 'fa-solid fa-globe', label: '世界规则' },
  { id: 'regional_rules', icon: 'fa-solid fa-map', label: '区域规则' },
  { id: 'personal_rules', icon: 'fa-solid fa-user-circle', label: '个人规则' },
  { id: 'phone', icon: 'fa-solid fa-mobile-screen-button', label: '手机' },
  {
    id: 'world_life',
    icon: 'fa-solid fa-earth-americas',
    label: 'NPC生活',
  },
  {
    id: 'random_rules',
    icon: 'fa-solid fa-dice',
    label: '随机规则生成',
  },
];

const panelTitles: Record<string, string> = {
  character: '人物属性编辑',
  world_rules: '世界规则管理',
  regional_rules: '区域规则管理',
  personal_rules: '个人规则管理',
  phone: '手机',
  world_life: 'NPC生活',
  random_rules: '随机规则生成器',
  settings: '系统设置',
};

const panelTitle = computed(() => panelTitles[activeTab.value || ''] || '');

const modalTitles: Record<string, string> = {
  add_character: '新增角色',
  add_world_rule: '新增世界规则',
  edit_world_rule: '编辑世界规则',
  add_region: '新增区域',
  edit_region: '编辑区域',
  add_region_rule: '新增区域规则',
  edit_region_rule: '编辑区域规则',
  add_personal_rule: '新增个人规则',
  edit_personal_rule: '编辑个人规则',
  edit_character_mind: '编辑心理状态',
  edit_character_fetish: '编辑性癖与敏感带',
  edit_identity_tags: '编辑身份标签',
  edit_character_appearance: '编辑服装与身体状态',
  edit_avatar: '编辑角色头像',
};
const modalTitle = computed(() => modalTitles[modalType.value] || (modalType.value.includes('add') ? '新增条目' : '编辑条目'));

// 防抖：防止短时间内重复点击
let lastClickTime = 0;

/** 小手机壳脚本挂在酒馆页面 window.TavernPhone，由 iframe 内通过 parent 调用 */
function toggleTavernPhone() {
  const tp = window.parent.TavernPhone;
  if (!tp) {
    toastr.warning('请先启用「小手机壳」脚本，并在脚本变量中配置 phone_ui_url');
    return;
  }
  tp.toggle();
}

function toggleTab(tabId: string) {
  const now = Date.now();
  if (now - lastClickTime < 150) {
    // 150ms 内的重复点击忽略
    return;
  }
  lastClickTime = now;

  if (tabId === 'phone') {
    toggleTavernPhone();
    return;
  }

  if (activeTab.value === tabId) {
    // 再次点击同一个 tab，关闭面板
    activeTab.value = null;
  } else {
    // 点击不同的 tab，切换到新面板
    activeTab.value = tabId;
  }
}

async function confirmRuleDestructive(title: string, html: string): Promise<boolean> {
  const r = await Swal.fire({
    title,
    html,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    confirmButtonColor: '#dc2626',
  });
  return r.isConfirmed;
}

async function openModal(type: string, payload?: Record<string, any>) {
  if (type === 'manage_rules') {
    activeTab.value = 'personal_rules';
    personalRulesExpandGroup.value =
      (payload?.expandGroupName && String(payload.expandGroupName).trim()) ||
      (payload?.characterName && String(payload.characterName).trim()) ||
      (payload?.characterId && String(payload.characterId).trim()) ||
      null;
    toastr.info('已切换到个人规则管理');
    return;
  }

  // 归档 vs 删除（不可混用）：
  // - 归档：仅把条目标为「已归档」，变量里仍保留；走 archive_* / submitArchive* / buildArchive*。
  // - 删除：从 MVU 对象上删掉对应键，不可复原；走 delete_* / submitDelete* / buildDelete*（破坏性操作先 confirmRuleDestructive）。
  // 以上不打开表单弹窗；开启编辑暂存时先入队。
  if (type === 'archive_world_rule' && payload?.title) {
    try {
      if (isEditCartEnabled()) {
        stageItem(buildArchiveWorldItem(String(payload.title)));
      } else {
        const { submitArchiveWorldRule } = await import('./utils/dialogAndVariable');
        await submitArchiveWorldRule(payload.title);
      }
    } catch (e) {
      console.error('归档世界规则失败', e);
      toastr.error('归档失败');
    }
    return;
  }
  if (type === 'delete_world_rule' && payload?.title) {
    const title = String(payload.title);
    const ok = await confirmRuleDestructive(
      '确认删除世界规则？',
      `将<strong>从变量中永久删除</strong>「${title}」，不可恢复。`,
    );
    if (!ok) return;
    try {
      if (isEditCartEnabled()) {
        stageItem(buildDeleteWorldItem(title));
      } else {
        const { submitDeleteWorldRule } = await import('./utils/dialogAndVariable');
        await submitDeleteWorldRule(title);
      }
    } catch (e) {
      console.error('删除世界规则失败', e);
      toastr.error('删除失败');
    }
    return;
  }

  if (type === 'archive_region' && payload?.name) {
    try {
      if (isEditCartEnabled()) {
        stageItem(buildArchiveRegionItem(String(payload.name)));
      } else {
        const { submitArchiveRegion } = await import('./utils/dialogAndVariable');
        await submitArchiveRegion(payload.name);
      }
    } catch (e) {
      console.error('归档区域失败', e);
      toastr.error('归档失败');
    }
    return;
  }
  if (type === 'delete_region' && payload?.name) {
    const name = String(payload.name);
    const ok = await confirmRuleDestructive(
      '确认删除区域？',
      `将<strong>从变量中永久删除</strong>区域「${name}」及其下<strong>全部细分规则</strong>，不可恢复。`,
    );
    if (!ok) return;
    try {
      if (isEditCartEnabled()) {
        stageItem(buildDeleteRegionItem(name));
      } else {
        const { submitDeleteRegion } = await import('./utils/dialogAndVariable');
        await submitDeleteRegion(name);
      }
    } catch (e) {
      console.error('删除区域失败', e);
      toastr.error('删除失败');
    }
    return;
  }

  if (
    type === 'archive_region_rule' &&
    payload?.regionName &&
    (payload?.rule?.id ?? payload?.rule?.title)
  ) {
    const regionName = String(payload.regionName);
    const ruleId = String(payload.rule.id ?? payload.rule.title);
    const ruleSummary =
      payload.ruleSummary != null ? String(payload.ruleSummary) : undefined;
    try {
      if (isEditCartEnabled()) {
        stageItem(buildArchiveRegionalRuleItem(regionName, ruleId, ruleSummary));
      } else {
        const { submitArchiveRegionalRule } = await import('./utils/dialogAndVariable');
        await submitArchiveRegionalRule(regionName, ruleId, ruleSummary);
      }
    } catch (e) {
      console.error('归档区域规则失败', e);
      toastr.error('归档失败');
    }
    return;
  }
  if (
    type === 'delete_region_rule' &&
    payload?.regionName &&
    (payload?.rule?.id ?? payload?.rule?.title)
  ) {
    const regionName = String(payload.regionName);
    const ruleId = String(payload.rule.id ?? payload.rule.title);
    const ruleSummary =
      payload.ruleSummary != null ? String(payload.ruleSummary) : undefined;
    const label = ruleSummary || ruleId;
    const ok = await confirmRuleDestructive(
      '确认删除区域规则？',
      `将<strong>从变量中永久删除</strong>区域「${regionName}」下的规则「${label}」，不可恢复。`,
    );
    if (!ok) return;
    try {
      if (isEditCartEnabled()) {
        stageItem(buildDeleteRegionalRuleItem(regionName, ruleId, ruleSummary));
      } else {
        const { submitDeleteRegionalRule } = await import('./utils/dialogAndVariable');
        await submitDeleteRegionalRule(regionName, ruleId, ruleSummary);
      }
    } catch (e) {
      console.error('删除区域规则失败', e);
      toastr.error('删除失败');
    }
    return;
  }

  if (type === 'archive_personal_rule' && (payload?.id ?? payload?.title ?? payload?.character)) {
    try {
      if (isEditCartEnabled()) {
        stageItem(buildArchivePersonalFromPayload(payload as Record<string, unknown>));
      } else {
        const { submitArchivePersonalRule } = await import('./utils/dialogAndVariable');
        await submitArchivePersonalRule(
          payload.id ?? payload.title ?? payload.character,
          payload.character ?? payload.title,
          payload.title !== payload.character ? String(payload.title) : undefined,
        );
      }
    } catch (e) {
      console.error('归档个人规则失败', e);
      toastr.error('归档失败');
    }
    return;
  }
  if (type === 'delete_personal_rule' && (payload?.id ?? payload?.title ?? payload?.character)) {
    const id = String(payload.id ?? payload.title ?? payload.character);
    const ch = payload.character != null ? String(payload.character) : '';
    const ok = await confirmRuleDestructive(
      '确认删除个人规则？',
      `将<strong>从变量中永久删除</strong>该条个人规则（${ch || id}），不可恢复。`,
    );
    if (!ok) return;
    try {
      if (isEditCartEnabled()) {
        stageItem(buildDeletePersonalFromPayload(payload as Record<string, unknown>));
      } else {
        const { submitDeletePersonalRule } = await import('./utils/dialogAndVariable');
        await submitDeletePersonalRule(
          payload.id ?? payload.title ?? payload.character,
          payload.character ?? payload.title,
          payload.title !== payload.character ? String(payload.title) : undefined,
        );
      }
    } catch (e) {
      console.error('删除个人规则失败', e);
      toastr.error('删除失败');
    }
    return;
  }

  if (type === 'archive_personal_rules_group' && payload?.groupName) {
    const g = String(payload.groupName).trim();
    if (!g) return;
    try {
      if (isEditCartEnabled()) {
        stageItem(buildArchivePersonalRulesGroupItem(g));
      } else {
        const { submitArchivePersonalRulesForGroup } = await import('./utils/dialogAndVariable');
        await submitArchivePersonalRulesForGroup(g);
      }
    } catch (e) {
      console.error('归档个人规则（分组）失败', e);
      toastr.error('归档失败');
    }
    return;
  }
  if (type === 'delete_personal_rules_group' && payload?.groupName) {
    const g = String(payload.groupName).trim();
    if (!g) return;
    const ok = await confirmRuleDestructive(
      '确认删除该对象下全部个人规则？',
      `将<strong>从变量中永久删除</strong>对象「${g}」下的<strong>全部</strong>个人规则条目，不可恢复。`,
    );
    if (!ok) return;
    try {
      if (isEditCartEnabled()) {
        stageItem(buildDeletePersonalRulesGroupItem(g));
      } else {
        const { submitDeletePersonalRulesForGroup } = await import('./utils/dialogAndVariable');
        await submitDeletePersonalRulesForGroup(g);
      }
    } catch (e) {
      console.error('删除个人规则（分组）失败', e);
      toastr.error('删除失败');
    }
    return;
  }

  modalType.value = type;
  modalPayload.value = payload ?? null;
  modalForm.value = {
    addCharacterName: '',
    addCharacterDescription: '',
    worldRuleName: payload?.title ?? '',
    worldRuleDetail: payload?.desc ?? '',
    regionName: payload?.name ?? '',
    regionDetail: payload?.description ?? '',
    regionFirstRuleName: '',
    regionRuleName: payload?.rule?.title ?? '',
    regionRuleDetail: payload?.rule?.desc ?? '',
    personalRuleCharacter: String(payload?.target ?? payload?.character ?? '').trim(),
    personalRuleName: String(payload?.ruleName ?? '').trim(),
    personalRuleDetail: payload?.desc ?? '',
    characterPsychThought: '',
    characterPsychTraits: '',
    characterPsychFetishes: '',
    characterPsychSensitiveParts: '',
    characterPsychHiddenFetish: '',
    showFetishDetails: false,
    fetishDetails: [],
    showSensitivePartDetails: false,
    sensitivePartDetails: [],
    identityTags: [],
    avatarUrl: '',
    appearanceClothing: defaultEmptyClothingState(),
    appearanceJewelryRows: [],
    appearanceBodyPartRows: [],
  };

  if (type === 'edit_avatar' && payload?.characterId) {
    try {
      const { resolveCharacterAvatarFromBrowserOnly, loadCharacterAvatarOverrides } = await import('../shared/phoneCharacterAvatarStorage');
      const store = useDataStore();
      const raw = store.data.角色档案?.[payload.characterId] as Record<string, unknown> | undefined;
      const displayName = String(raw?.姓名 ?? raw?.name ?? '').trim();
      modalForm.value.avatarUrl = resolveCharacterAvatarFromBrowserOnly(
        payload.characterId,
        loadCharacterAvatarOverrides(),
        displayName,
      );
    } catch (e) {
      console.warn('预填头像失败', e);
    }
  }

  if ((type === 'edit_character_mind' || type === 'edit_character_fetish') && payload?.characterId) {
    try {
      const { useCharacters } = await import('./store');
      const characters = useCharacters();
      const c: any = (characters.value || []).find((x: any) => x?.id === payload.characterId);
      if (c) {
        const store = useDataStore();
        const rawChar = store.data.角色档案?.[payload.characterId] as Record<string, unknown> | undefined;
        modalForm.value.characterPsychThought = String(c.currentThought ?? '');
        modalForm.value.characterPsychTraits = tagMapToEditableText(c.traits);
        modalForm.value.characterPsychFetishes = fetishRecordToEditableText(
          rawChar?.性癖 ?? rawChar?.fetishes ?? {},
        );
        modalForm.value.characterPsychSensitiveParts = sensitiveRecordToEditableText(
          getMergedSensitiveDevelopment(rawChar ?? {}),
        );
        modalForm.value.characterPsychHiddenFetish = String(c.hiddenFetish ?? '');

        // 预填性癖详情
        if (c.fetishDetails && typeof c.fetishDetails === 'object') {
          modalForm.value.showFetishDetails = true;
          modalForm.value.fetishDetails = Object.entries(c.fetishDetails).map(([name, detail]: [string, any]) => ({
            name,
            level: detail?.level ?? detail?.等级 ?? 1,
            description: detail?.description ?? detail?.细节描述 ?? '',
            justification: detail?.justification ?? detail?.自我合理化 ?? '',
          }));
        }

        // 预填敏感部位详情
        if (c.sensitivePartDetails && typeof c.sensitivePartDetails === 'object') {
          modalForm.value.showSensitivePartDetails = true;
          modalForm.value.sensitivePartDetails = Object.entries(c.sensitivePartDetails).map(([name, detail]: [string, any]) => ({
            name,
            level: detail?.level ?? detail?.敏感等级 ?? 1,
            reaction: detail?.reaction ?? detail?.生理反应 ?? '',
            devDetails: detail?.devDetails ?? detail?.开发细节 ?? '',
          }));
        }
      }
    } catch (e) {
      console.warn('预填角色心理字段失败', e);
    }
  }

  if (type === 'edit_character_appearance' && payload?.characterId) {
    try {
      const store = useDataStore();
      const rawChar = store.data.角色档案?.[payload.characterId] as Record<string, unknown> | undefined;
      const cloth = clothingStateFromMvuRaw(rawChar?.服装状态);
      modalForm.value.appearanceClothing = cloth;
      modalForm.value.appearanceJewelryRows = jewelryRowsFromClothingState(cloth);
      modalForm.value.appearanceBodyPartRows = bodyPartRowsFromMvuRaw(rawChar?.身体部位物理状态);
    } catch (e) {
      console.warn('预填外观与身体状态失败', e);
    }
  }

  // 预填身份标签
  if (type === 'edit_identity_tags' && payload?.characterId) {
    try {
      const { useCharacters } = await import('./store');
      const characters = useCharacters();
      const c: any = (characters.value || []).find((x: any) => x?.id === payload.characterId);
      if (c && c.identityTags && typeof c.identityTags === 'object') {
        modalForm.value.identityTags = Object.entries(c.identityTags).map(([category, value]: [string, any]) => ({
          category,
          value: String(value ?? ''),
        }));
      }
    } catch (e) {
      console.warn('预填身份标签失败', e);
    }
  }
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  modalPayload.value = null;
}

function isAvatarPreviewable(url: string): boolean {
  const u = String(url ?? '').trim();
  if (!u) return false;
  return u.startsWith('data:image/') || /^https?:\/\//i.test(u) || u.startsWith('blob:');
}

function triggerAvatarFilePick() {
  avatarFileInputRef.value?.click();
}

async function onAvatarFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toastr.warning('请选择图片文件');
    input.value = '';
    return;
  }
  const maxRawBytes = 12 * 1024 * 1024;
  if (file.size > maxRawBytes) {
    toastr.warning('原图请小于 12MB');
    input.value = '';
    return;
  }
  input.value = '';
  try {
    const { compressImageFileToDataUrl } = await import('./utils/imageCompress');
    const dataUrl = await compressImageFileToDataUrl(file, {
      maxEdgePx: 512,
      maxOutputBytes: 220 * 1024,
    });
    modalForm.value.avatarUrl = dataUrl;
    const approxKb = Math.round((dataUrl.length * 3) / 4 / 1024);
    const kind = dataUrl.startsWith('data:image/webp') ? 'WebP' : dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : '图片';
    toastr.success(`已压缩为 ${kind}（约 ${approxKb} KB）`);
  } catch (e) {
    console.error('压缩头像失败', e);
    toastr.error('处理图片失败，请换一张重试');
  }
}

/**
 * 将文本复制到输入框
 * @param text 要复制的文本
 * @param mode 模式：'replace' 替换，'append' 追加（默认）
 */
function copyToInput(text: string, mode: 'replace' | 'append' = 'append') {
  const messageText = String(text ?? '').trim();
  if (!messageText) return;

  const currentInput = userInput.value.trim();

  if (mode === 'replace' || !currentInput) {
    // 替换模式：直接替换现有内容
    userInput.value = messageText;
  } else {
    // 追加模式：在现有内容后添加，用换行分隔
    userInput.value = currentInput + '\n\n' + messageText;
  }

  toastr.success('修改信息已复制进入对话框');
}

function onEditCartRemove(id: string) {
  editCartStore.removeItem(id);
}

function onEditCartRowEdit(it: EditCartItem) {
  editCartEditorItem.value = klona(it);
  editCartEditorOpen.value = true;
}

function onEditCartEditorOpenUpdate(open: boolean) {
  editCartEditorOpen.value = open;
  if (!open) {
    editCartEditorItem.value = null;
  }
}

function onEditCartEditorSave(item: EditCartItem) {
  editCartStore.replaceItemAfterEdit(item);
  editCartEditorItem.value = null;
  toastr.success('已更新暂存项');
}

function onEditCartClearAsk() {
  if (editCartPendingCount.value === 0) return;
  editCartAwaitingClearConfirm.value = true;
}

function onEditCartClearDismiss() {
  editCartAwaitingClearConfirm.value = false;
}

function onEditCartClearConfirm() {
  if (editCartPendingCount.value === 0) {
    editCartAwaitingClearConfirm.value = false;
    return;
  }
  editCartStore.clear();
  editCartAwaitingClearConfirm.value = false;
  toastr.info('已清空暂存');
}

async function onEditCartApply() {
  if (editCartPendingCount.value === 0 || editCartApplying.value) return;
  editCartApplying.value = true;
  try {
    const ok = await editCartStore.applyAll((text, mode) => copyToInput(text, mode));
    if (ok) {
      editCartPanelOpen.value = false;
      toastr.success('已批量提交暂存');
    }
  } finally {
    editCartApplying.value = false;
  }
}

function onCopyToInputEvent(event: Event) {
  const customEvent = event as CustomEvent<{ message?: string }>;
  const messageText = String(customEvent.detail?.message ?? '').trim();
  if (!messageText) return;
  copyToInput(messageText, 'append'); // 使用追加模式，不影响现有内容
}

async function onModalComplete() {
  const type = modalType.value;
  const form = modalForm.value;
  const payload = modalPayload.value;
  let messageText = '';
  try {
    if (isEditCartEnabled()) {
      const item = buildCartItemFromModal(
        type,
        form as EditCartModalForm,
        (payload as Record<string, unknown> | null) ?? null,
      );
      if (item) {
        stageItem(item);
        closeModal();
        return;
      }
    }

    if (type === 'add_character') {
      // 只生成 [新增角色] 消息，不预写角色档案（与 editCartApply.runModalCommit 一致）
      const { submitAddCharacter } = await import('./utils/dialogAndVariable');
      messageText = await submitAddCharacter(form.addCharacterName, form.addCharacterDescription);
    } else if (type === 'add_world_rule') {
      const { submitAddWorldRule } = await import('./utils/dialogAndVariable');
      messageText = await submitAddWorldRule(form.worldRuleName, form.worldRuleDetail);
    } else if (type === 'edit_world_rule' && (payload?.id ?? payload?.title)) {
      const { submitEditWorldRule } = await import('./utils/dialogAndVariable');
      messageText = await submitEditWorldRule(payload.id ?? payload.title, form.worldRuleName, form.worldRuleDetail);
    } else if (type === 'add_region') {
      const { submitAddRegion } = await import('./utils/dialogAndVariable');
      messageText = await submitAddRegion(form.regionName, form.regionDetail, form.regionFirstRuleName);
    } else if (type === 'edit_region' && (payload?.id ?? payload?.name)) {
      const { submitEditRegion } = await import('./utils/dialogAndVariable');
      messageText = await submitEditRegion(payload.id ?? payload.name, form.regionName, form.regionDetail);
    } else if (type === 'add_region_rule' && (payload?.id ?? payload?.name ?? payload?.regionId ?? payload?.regionName)) {
      const { submitAddRegionalRule } = await import('./utils/dialogAndVariable');
      const regionId = payload.id ?? payload.name ?? payload.regionId ?? payload.regionName;
      const regionName = payload.name ?? payload.regionName ?? form.regionName;
      messageText = await submitAddRegionalRule(regionId, regionName, form.regionRuleName, form.regionRuleDetail);
    } else if (type === 'edit_region_rule' && (payload?.regionId ?? payload?.regionName) && (payload?.rule?.id ?? payload?.rule?.title)) {
      const { submitEditRegionalRule } = await import('./utils/dialogAndVariable');
      messageText = await submitEditRegionalRule(
        payload.regionId ?? payload.regionName,
        payload.regionName,
        payload.rule.id ?? payload.rule.title,
        form.regionRuleName,
        form.regionRuleDetail,
      );
    } else if (type === 'add_personal_rule') {
      const { submitAddPersonalRule } = await import('./utils/dialogAndVariable');
      messageText = await submitAddPersonalRule(
        form.personalRuleCharacter,
        form.personalRuleName,
        form.personalRuleDetail,
      );
    } else if (type === 'edit_personal_rule' && (payload?.id ?? payload?.title ?? payload?.character)) {
      const { submitEditPersonalRule } = await import('./utils/dialogAndVariable');
      messageText = await submitEditPersonalRule(
        payload.id ?? payload.title ?? payload.character,
        form.personalRuleCharacter,
        form.personalRuleName,
        form.personalRuleDetail,
      );
    } else if (type === 'edit_character_mind' && payload?.characterId) {
      const { submitEditCharacterPsych } = await import('./utils/dialogAndVariable');
      messageText = await submitEditCharacterPsych(payload.characterId, {
        thought: form.characterPsychThought,
        traitsText: form.characterPsychTraits,
      });
    } else if (type === 'edit_character_fetish' && payload?.characterId) {
      const { submitEditCharacterPsych, updateCharacterFetishDetails, updateCharacterSensitivePartDetails, formatFetishDetailMessage, formatSensitivePartDetailMessage } = await import('./utils/dialogAndVariable');
      messageText = await submitEditCharacterPsych(payload.characterId, {
        fetishesText: form.characterPsychFetishes,
        sensitivePartsText: form.characterPsychSensitiveParts,
        hiddenFetish: form.characterPsychHiddenFetish,
      });

      // 保存性癖详情
      const validFetishDetails = form.fetishDetails?.filter(f => f.name?.trim()) ?? [];
      if (validFetishDetails.length > 0) {
        updateCharacterFetishDetails(payload.characterId, validFetishDetails.map(f => ({
          name: f.name.trim(),
          level: f.level ?? 1,
          description: f.description ?? '',
          justification: f.justification ?? '',
        })));
        messageText += '\n\n' + formatFetishDetailMessage(payload.characterId, validFetishDetails.map(f => ({
          name: f.name.trim(),
          level: f.level ?? 1,
          description: f.description ?? '',
          justification: f.justification ?? '',
        })));
      }

      // 保存敏感部位详情
      const validSensitivePartDetails = form.sensitivePartDetails?.filter(p => p.name?.trim()) ?? [];
      if (validSensitivePartDetails.length > 0) {
        updateCharacterSensitivePartDetails(payload.characterId, validSensitivePartDetails.map(p => ({
          name: p.name.trim(),
          level: p.level ?? 1,
          reaction: p.reaction ?? '',
          devDetails: p.devDetails ?? '',
        })));
        messageText += '\n\n' + formatSensitivePartDetailMessage(payload.characterId, validSensitivePartDetails.map(p => ({
          name: p.name.trim(),
          level: p.level ?? 1,
          reaction: p.reaction ?? '',
          devDetails: p.devDetails ?? '',
        })));
      }
    } else if (type === 'edit_character_appearance' && payload?.characterId) {
      const base = form.appearanceClothing ?? defaultEmptyClothingState();
      const jewelryRows = (form.appearanceJewelryRows ?? []).map(normalizeJewelryEditRow);
      const clothing = applyJewelryRowsToClothing(base, jewelryRows);
      const body: Record<string, { 外观描述: string; 当前状态: string }> = {};
      for (const row of form.appearanceBodyPartRows ?? []) {
        const k = String(row.key ?? '').trim();
        if (!k) continue;
        body[k] = {
          外观描述: String(row.外观描述 ?? ''),
          当前状态: String(row.当前状态 ?? ''),
        };
      }
      messageText = await submitEditCharacterAppearance(payload.characterId, {
        服装状态: clothing,
        身体部位物理状态: body,
      });
    } else if (type === 'edit_identity_tags' && payload?.characterId) {
      const { updateCharacterIdentityTags, formatIdentityTagsMessage } = await import('./utils/dialogAndVariable');
      const validTags = form.identityTags?.filter(t => t.category?.trim() && t.value?.trim()) ?? [];
      const tagsObj: Record<string, string> = {};
      for (const t of validTags) {
        tagsObj[t.category.trim()] = t.value.trim();
      }
      updateCharacterIdentityTags(payload.characterId, tagsObj);
      messageText = formatIdentityTagsMessage(payload.characterId, tagsObj);
    } else if (type === 'edit_avatar' && payload?.characterId) {
      const { submitEditCharacterAvatar } = await import('./utils/dialogAndVariable');
      const store = useDataStore();
      const raw = store.data.角色档案?.[payload.characterId] as Record<string, unknown> | undefined;
      const displayName = String(raw?.姓名 ?? raw?.name ?? '').trim();
      messageText = await submitEditCharacterAvatar(payload.characterId, form.avatarUrl, displayName || null);
    } else {
      toastr.warning('未知的弹窗类型或缺少数据');
      return;
    }

    // 将生成的文本放入前端输入框（追加模式，不影响现有内容）；头像编辑不写对话框
    if (messageText && type !== 'edit_avatar') {
      copyToInput(messageText, 'append');

      // 角色心理/性癖编辑：同时写入对话框（创建一条 user 消息）
      if (type === 'edit_character_mind' || type === 'edit_character_fetish' || type === 'edit_character_appearance') {
        try {
          const { sendToDialog } = await import('./utils/dialogAndVariable');
          await sendToDialog(messageText);
        } catch (e) {
          console.warn('写入对话框失败', e);
        }
      }
    }
    closeModal();
  } catch (e) {
    console.error('弹窗提交失败', e);
    toastr.error('操作失败');
  }
}

// 加载最新消息内容
function loadMessageContent() {
  try {
    const result = loadFromLatestMessage();
    if (result.messageId !== currentMessageId.value) {
      // 只有消息 ID 变化时才更新，避免重复渲染
      mainText.value = result.maintext;
      options.value = result.options;
      currentMessageId.value = result.messageId;
      // 保存当前消息信息（用于长按重roll/编辑）
      currentMessageInfo.value = {
        messageId: result.messageId,
        userMessageId: result.userMessageId,
        fullMessage: result.fullMessage,
      };
      console.log('✅ [App] 已加载最新消息:', result.messageId);
    }
  } catch (error) {
    console.error('❌ [App] 加载消息失败:', error);
  }
}

// 手动刷新消息
function refreshMessage() {
  currentMessageId.value = undefined; // 重置 ID 强制刷新
  loadMessageContent();
  maybeOfferOrphanUserFloorFix();
}

/**
 * 若最后一楼可见消息为玩家发言，则视为异常末端（便于重载后修复）
 */
function getOrphanUserLatestFloor(): { messageId: number } | null {
  try {
    if (typeof getChatMessages !== 'function' || typeof getLastMessageId !== 'function') return null;
    const lastId = getLastMessageId();
    if (lastId < 1) return null;
    const list = getChatMessages(-1, { hide_state: 'unhidden' });
    const latest = list[0];
    if (!latest || latest.role !== 'user') return null;
    if (latest.message_id < 1) return null;
    return { messageId: latest.message_id };
  } catch (e) {
    console.warn('⚠️ [App] 检测末尾玩家楼层失败:', e);
    return null;
  }
}

function maybeOfferOrphanUserFloorFix() {
  if (gamePhase.value !== GamePhase.GAME) return;
  if (
    isGenerating.value ||
    isRegenerating.value ||
    isGeneratingOpening.value ||
    isInitializing.value ||
    isVariablePersistInProgress.value
  ) {
    return;
  }
  if (
    isTagDialogOpen.value ||
    isModalOpen.value ||
    variableRerollDialogOpen.value ||
    variableUpdateDialogOpen.value ||
    editingMessage.value
  ) {
    return;
  }
  if (contextMenu.value || orphanUserFloorDialogOpen.value) return;

  const info = getOrphanUserLatestFloor();
  if (!info) return;
  if (orphanUserFloorDismissedMid.value === info.messageId) return;

  orphanUserFloorMessageId.value = info.messageId;
  orphanUserFloorDialogOpen.value = true;
  console.info('📋 [App] 已提示：末尾楼层为玩家发言 #', info.messageId);
}

function dismissOrphanUserFloorDialog() {
  if (orphanUserFloorMessageId.value != null) {
    orphanUserFloorDismissedMid.value = orphanUserFloorMessageId.value;
  }
  orphanUserFloorDialogOpen.value = false;
}

async function confirmOrphanUserFloorDelete() {
  const mid = orphanUserFloorMessageId.value;
  if (mid == null) {
    orphanUserFloorDialogOpen.value = false;
    return;
  }
  if (typeof deleteChatMessages !== 'function') {
    toastr.error('deleteChatMessages 不可用');
    return;
  }
  try {
    await deleteChatMessages([mid], { refresh: 'affected' });
    orphanUserFloorDismissedMid.value = null;
    orphanUserFloorDialogOpen.value = false;
    orphanUserFloorMessageId.value = null;
    currentMessageId.value = undefined;
    loadMessageContent();
    toastr.success('已删除该玩家楼层；请在酒馆中继续生成以获取 AI 回复');
  } catch (e) {
    console.error('❌ [App] 删除末尾玩家楼层失败:', e);
    toastr.error('删除失败: ' + String(e));
  }
}

/**
 * 正文为空时：删除最后一条用户发言；若其后紧跟一条 AI 回复则一并删除；将其内容写入酒馆对话框（供重新发送）
 */
async function onRecoverLastUserMessage() {
  const ok = window.confirm(
    '这将删除最后一次的用户发言；若其后紧跟 AI 回复也会一并删除，并把该用户发言放入对话框。是否执行？',
  );
  if (!ok) return;

  try {
    if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') {
      toastr.error('当前环境无法访问聊天消息接口');
      return;
    }
    const lastId = getLastMessageId();
    if (lastId < 1) {
      toastr.warning('没有可恢复的用户发言');
      return;
    }

    const range = `0-${lastId}`;
    const all = getChatMessages(range, { hide_state: 'unhidden' });
    const users = all.filter(m => m.role === 'user');
    if (!users.length) {
      toastr.warning('没有可恢复的用户发言');
      return;
    }

    const lastUser = users[users.length - 1]!;
    const text = String(lastUser.message ?? '').trim();
    if (!text) {
      toastr.warning('最后一条用户发言为空');
      return;
    }

    const idx = all.findIndex(m => m.message_id === lastUser.message_id);
    const idsToDelete: number[] = [lastUser.message_id];
    if (idx >= 0 && idx + 1 < all.length) {
      const next = all[idx + 1];
      if (next.role === 'assistant') {
        idsToDelete.push(next.message_id);
      }
    }
    idsToDelete.sort((a, b) => b - a);

    if (typeof deleteChatMessages !== 'function') {
      toastr.error('deleteChatMessages 不可用');
      return;
    }
    await deleteChatMessages(idsToDelete, { refresh: 'all' });

    const { sendToDialog } = await import('./utils/dialogAndVariable');
    await sendToDialog(text);

    refreshMessage();
    toastr.success(
      idsToDelete.length > 1
        ? '已删除该条用户发言与对应 AI 楼层，内容已填入对话框'
        : '已删除该条用户发言，内容已填入对话框',
    );
  } catch (e) {
    console.error('❌ [App] 恢复用户发言失败:', e);
    toastr.error('操作失败: ' + String(e));
  }
}

/**
 * 从 UpdateVariable 块中提取 JSON Patch 内容
 */
function extractJsonPatchFromUpdateVariable(message: string): Array<{op: string; path: string; value?: any; from?: string}> | null {
  const match = message.match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
  if (!match) return null;

  try {
    const jsonStr = match[1].trim();
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.warn('⚠️ [App] JSON Patch 解析失败:', e);
    return null;
  }
}

/** JSON Patch 成功写入 stat_data 后：异步生成「世界大势」；个人规则变更仅打标，居民生活在下方统一刷新 */
function scheduleWorldLifeAfterJsonPatchIfNeeded(
  patches: ReturnType<typeof extractJsonPatchFromUpdateVariable>,
  statData: unknown,
): void {
  if (!patches?.length || !statData || typeof statData !== 'object') return;
  void import('./utils/worldLifeFromPatch').then(({ scheduleWorldLifeTriggersFromJsonPatches }) => {
    scheduleWorldLifeTriggersFromJsonPatches(patches, statData as Record<string, unknown>);
  });
}

/** 变量已提交到楼层后：若有个规待刷新或已进入新游戏日，则统一调用第二 API 更新居民生活 */
function scheduleResidentLifeFlushAfterStatCommit(statData: unknown): void {
  if (!statData || typeof statData !== 'object') return;
  void import('./utils/residentLifePending').then(({ tryFlushPendingResidentLife }) => {
    void tryFlushPendingResidentLife(statData as Record<string, unknown>);
  });
}

/** 模型偶发把对象/数组二次编码成 JSON 字符串，写入前尝试解析 */
function coerceJsonPatchValue(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (
    (s.startsWith('{') && s.endsWith('}')) ||
    (s.startsWith('[') && s.endsWith(']'))
  ) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return v;
}

/**
 * 应用 JSON Patch 到对象（支持 replace, add, remove, move, copy）
 */
function applyJsonPatch(target: any, patches: Array<{op: string; path: string; value?: any; from?: string}>): void {
  for (const patch of patches) {
    const pathParts = patch.path.replace(/^\//, '').split('/');

    switch (patch.op) {
      case 'replace':
      case 'add': {
        let current = target;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!(part in current)) {
            current[part] = {};
          }
          current = current[part];
        }
        const lastPart = pathParts[pathParts.length - 1];
        current[lastPart] = coerceJsonPatchValue(patch.value);
        break;
      }
      case 'remove': {
        let current = target;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!(part in current)) break;
          current = current[part];
        }
        const lastPart = pathParts[pathParts.length - 1];
        delete current[lastPart];
        break;
      }
      case 'move': {
        if (!patch.from) break;
        const fromParts = patch.from.replace(/^\//, '').split('/');
        let source = target;
        for (let i = 0; i < fromParts.length - 1; i++) {
          const part = fromParts[i];
          if (!(part in source)) break;
          source = source[part];
        }
        const value = source[fromParts[fromParts.length - 1]];
        // 设置目标路径
        let current = target;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!(part in current)) {
            current[part] = {};
          }
          current = current[part];
        }
        current[pathParts[pathParts.length - 1]] = value;
        // 删除源
        delete source[fromParts[fromParts.length - 1]];
        break;
      }
    }
  }
}

/**
 * 若消息文本含 &lt;UpdateVariable&gt;，以 baseMvu 为基线解析并写入指定楼层（与 assistant 解析路径一致）。
 * 用于用户消息内自带的变量补丁（例如开局说明里附带的 JSON Patch）。
 */
async function applyMvuParseToMessageFloor(
  messageText: string,
  baseMvu: Mvu.MvuData,
  messageId: number,
): Promise<void> {
  if (!/<UpdateVariable>/i.test(messageText)) return;
  try {
    await waitGlobalInitialized('Mvu');
    let baseForParse: Mvu.MvuData;
    try {
      baseForParse = structuredClone(baseMvu);
    } catch {
      baseForParse = JSON.parse(JSON.stringify(baseMvu)) as Mvu.MvuData;
    }

    let parsed: Mvu.MvuData | null = null;

    // 首先尝试解析 <JSONPatch> 格式
    const jsonPatches = extractJsonPatchFromUpdateVariable(messageText);
    if (jsonPatches) {
      console.log('✅ [App] 用户消息检测到 <JSONPatch> 格式，手动应用变量更新...');
      parsed = JSON.parse(JSON.stringify(baseForParse));
      if (!parsed.stat_data) parsed.stat_data = {};
      applyJsonPatch(parsed.stat_data, jsonPatches);
      console.log('✅ [App] 用户消息 JSON Patch 已手动应用');
    } else if (typeof Mvu?.parseMessage === 'function') {
      // 回退到 MVU 的 parseMessage（处理 _.set() 格式）
      parsed = await Mvu.parseMessage(messageText, baseForParse);
    }

    if (!parsed) {
      console.log('ℹ️ [App] 消息含 <UpdateVariable> 但 parseMessage 未产生新数据，楼层:', messageId);
      return;
    }
    try {
      await Mvu.replaceMvuData(parsed, { type: 'message', message_id: messageId });
      console.log('✅ [App] 已解析消息中 <UpdateVariable> 并写入 MVU，楼层:', messageId);
    } catch (e) {
      console.warn('⚠️ [App] replaceMvuData 失败，尝试合并写入消息变量:', e);
      await updateVariablesWith(
        existing =>
          Object.assign({}, existing && typeof existing === 'object' ? existing : {}, parsed as object),
        { type: 'message', message_id: messageId },
      );
      console.log('✅ [App] MVU 已合并写入楼层变量:', messageId);
    }
    scheduleWorldLifeAfterJsonPatchIfNeeded(jsonPatches, parsed.stat_data);
    scheduleResidentLifeFlushAfterStatCommit(parsed.stat_data);
  } catch (e) {
    console.warn('⚠️ [App] 解析消息中 <UpdateVariable> 失败:', e);
  }
}

// 发送消息（同层前端界面核心功能）
async function sendMessage() {
  const content = userInput.value.trim();
  if (!content || isGenerating.value || isVariablePersistInProgress.value) return;

  console.log('🎮 [App] 发送消息:', content.substring(0, 50) + '...');

  // 保存状态快照（用于错误回退）
  saveGameSnapshot(content);

  // 清空输入框
  userInput.value = '';
  isGenerating.value = true;
  gameSendInProgressBeforeTag.value = true;
  streamTextBuffer.value = '';

  // 清空当前显示，准备流式接收
  mainText.value = '';
  options.value = [];

  let unsubscribeStream: any = null;
  let streamSubscriptionSuccess = false;
  let isThinkingComplete = false; // 标记是否已完成 thinking 标签的过滤
  let myFlowGen = 0;

  // 检测当前输出模式（正常游戏使用）
  let isDualMode = false;
  let secondaryApiConfig: any = null;
  try {
    const { getCurrentOutputMode, getSecondaryApiConfig } = await import('./utils/apiSettings');
    isDualMode = getCurrentOutputMode() === 'dual';
    if (isDualMode) {
      secondaryApiConfig = getSecondaryApiConfig();
      console.log(`🔄 [App] 双API模式已启用，第二API配置: ${secondaryApiConfig ? '已配置' : '未配置'}`);
    }
  } catch (error) {
    console.warn('⚠️ [App] 检测输出模式失败，使用单API模式:', error);
  }

  try {
    myFlowGen = ++gameSendFlowGeneration;

    // 检查 generate 函数是否存在
    if (typeof generate !== 'function') {
      throw new Error('generate 函数不可用');
    }

    // 注册流式监听（在调用 generate 之前）
    if (typeof eventOn === 'function' && typeof iframe_events !== 'undefined') {
      // 监听流式传输事件
      if (iframe_events.STREAM_TOKEN_RECEIVED_FULLY) {
        const streamHandler = (text: string) => {
          if (myFlowGen !== gameSendFlowGeneration) {
            return;
          }
          streamTextBuffer.value = text;

          // 过滤机制：检查是否所有过滤标签都已闭合
          if (!isThinkingComplete) {
            isThinkingComplete = isFilteringComplete(text);
            if (!isThinkingComplete) {
              // 仍在 thinking 标签内，显示 "AI 思考中..."
              mainText.value = 'AI 正在思考...';
              return;
            }
          }

          // 提取过滤后的内容进行实时显示
          const filteredText = extractFilteredContent(text);
          const parsed = parseMaintext(filteredText);
          if (parsed) {
            mainText.value = parsed;
          }
        };

        try {
          const result = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, streamHandler);
          if (result && typeof result === 'object' && typeof result.stop === 'function') {
            unsubscribeStream = result.stop;
            pendingGameStreamUnsub.value = unsubscribeStream;
            streamSubscriptionSuccess = true;
            console.log('✅ [App] 流式事件监听已注册（带过滤机制）');
          } else if (result === undefined || result === null) {
            console.warn('⚠️ [App] eventOn 返回了 undefined/null，流式监听可能未正确注册');
          } else {
            console.warn('⚠️ [App] eventOn 返回了非函数值:', typeof result);
          }
        } catch (err) {
          console.error('❌ [App] 注册流式事件监听失败:', err);
        }
      } else {
        console.warn('⚠️ [App] iframe_events.STREAM_TOKEN_RECEIVED_FULLY 不可用');
      }
    } else {
      console.warn('⚠️ [App] eventOn 或 iframe_events 不可用');
    }

    // 先将用户输入写入聊天楼层，便于重 roll 时找到对应的 userMessageId
    // 发送完整 MVU 格式，统一数据格式
    if (typeof createChatMessages === 'function') {
      let mvuData = { stat_data: {}, display_data: {}, delta_data: {} };
      try {
        const baseData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        if (baseData) {
          mvuData = baseData;
        }
      } catch (e) {
        // 忽略
      }
      const userMessageBaseMvu = mvuData as Mvu.MvuData;
      await createChatMessages(
        [{ role: 'user', message: content, data: mvuData }],
        { refresh: 'none' },
      );
      // 短暂等待再取 lastMessageId，避免酒馆未同步导致拿到旧 id
      await new Promise(r => setTimeout(r, 50));
      pendingUserMessageId.value = getLastMessageId();
      console.log('✅ [App] 已写入 user 消息，message_id:', pendingUserMessageId.value);

      // 主动通知小手机壳触发世界书同步（App.vue 走的不是酒馆助手生成流程，不会触发 GENERATE_BEFORE_COMBINE_PROMPTS）
      // 使用 REQUEST_TRIGGER_GAME_STORY_SYNC 让小手机壳路由到剧情摘要同步流程
      try {
        window.parent.postMessage({ type: 'tavern-phone:request-trigger-game-story-sync' }, '*');
        console.log('📡 [App] 已发送剧情摘要同步请求给小手机壳');
      } catch (e) {
        console.warn('⚠️ [App] 通知小手机壳失败:', e);
      }

      const uid = pendingUserMessageId.value;
      if (uid != null) {
        await applyMvuParseToMessageFloor(content, userMessageBaseMvu, uid);
      }
    }

    if (myFlowGen !== gameSendFlowGeneration) {
      clearPendingGameStreamSubscription();
      return;
    }

    // ===== 触发数据库剧情推进 =====
    // 通过触发数据库的 capture 阶段监听器来标记用户发送意图
    // 数据库会在 generate() 调用时自动运行剧情推进流程
    try {
      const { notifyShujukuUserSendIntent } = await import('./utils/shujukuBridge');
      const notified = notifyShujukuUserSendIntent();
      if (notified) {
        console.log('[App] ✅ 数据库用户发送意图已通知，剧情推进将在 generate() 时自动触发');
      }
    } catch (e) {
      console.warn('[App] ⚠️ 通知数据库用户发送意图失败:', e);
    }
    // ===== 剧情推进触发结束 =====

    // 调用 generate 生成 AI 回复
    console.log('⏳ [App] 调用 generate...');
    aiGenerationStartMs.value = Date.now();
    let result = await generate({
      user_input: content,
      should_stream: true,
    });
    console.log('✅ [App] generate 完成，结果长度:', result?.length || 0);

    if (myFlowGen !== gameSendFlowGeneration) {
      clearPendingGameStreamSubscription();
      return;
    }

    // 双API模式：第二 API 变量 + 可选正文美化（并行）
    if (isDualMode && result) {
      try {
        const { mergeSecondaryPipelineIntoAssistantText, isSecondaryApiConfigured } = await import(
          './utils/apiSettings',
        );
        if (isSecondaryApiConfigured(secondaryApiConfig)) {
          console.log('🔄 [App] 双API模式：第二 API（变量 / 正文美化）…');
          const statMid =
            pendingUserMessageId.value != null && pendingUserMessageId.value !== undefined
              ? pendingUserMessageId.value
              : 'latest';
          result = await mergeSecondaryPipelineIntoAssistantText(result, secondaryApiConfig, {
            statDataMessageId: statMid,
          });
          console.log('✅ [App] 第二 API 合并完成');
        }
      } catch (error) {
        console.error('❌ [App] 第二API处理失败:', error);
        // 第二API失败不影响主流程，继续使用主API结果
      }
    }

    if (myFlowGen !== gameSendFlowGeneration) {
      clearPendingGameStreamSubscription();
      return;
    }

    // 清理流式监听（确保即使 generate 失败也能清理）
    clearPendingGameStreamSubscription();
    console.log('✅ [App] 流式事件监听已清理');

    // 验证结果是否为空或无效
    if (!result || result.trim().length === 0) {
      console.error('❌ [App] 生成结果为空');
      throw new Error('生成结果为空');
    }

    // 去除过滤标签后的内容
    const filteredResult = extractFilteredContent(result);
    const parsedMaintext = parseMaintext(filteredResult);
    const parsedOptions = parseOptions(filteredResult);

    // 兜底：有时 AI 只返回了被过滤标签，过滤后等于空回
    if (!filteredResult.trim() || (!parsedMaintext && parsedOptions.length === 0)) {
      if (myFlowGen !== gameSendFlowGeneration) {
        return;
      }
      console.error('❌ [App] AI 返回为空（过滤后无正文和选项）');
      toastr.error('AI 本次返回为空，请重试');
      await rollbackToSnapshot();
      return;
    }

    if (myFlowGen !== gameSendFlowGeneration) {
      return;
    }

    // 每次生成完成后都打开标签验证弹窗，由用户确认或回退
    openTagValidationDialog(filteredResult);
    return; // 等待用户点击确认或回退

  } catch (error) {
    clearPendingGameStreamSubscription();
    if (myFlowGen !== gameSendFlowGeneration) {
      return;
    }
    console.error('❌ [App] 生成失败:', error);
    hideSecondaryApiBanner();
    toastr.error('生成失败: ' + String(error));

    // 回退到快照状态
    await rollbackToSnapshot();

  } finally {
    gameSendInProgressBeforeTag.value = false;
    // 只有在标签验证弹窗未打开时才重置生成状态
    if (!isTagDialogOpen.value) {
      isGenerating.value = false;
      streamTextBuffer.value = '';
    }
  }
}

// 选择选项并发送
async function selectOption(optionId: string) {
  const option = options.value.find(o => o.id === optionId);
  if (!option) return;
  if (isVariablePersistInProgress.value) return;

  console.log('📝 [App] 选择选项:', optionId, option.text);

  // 获取输入行为模式设置
  const { getInputActionMode } = await import('./utils/otherSettings');
  const inputActionMode = await getInputActionMode();

  if (inputActionMode === 'send') {
    // 直接发送模式：替换输入框内容并立即发送
    userInput.value = option.text;
    await sendMessage();
  } else {
    // 追加到输入框模式（默认）：追加到现有内容
    const currentInput = userInput.value.trim();
    if (currentInput) {
      userInput.value = currentInput + '\n\n' + option.text;
    } else {
      userInput.value = option.text;
    }
    toastr.success('选项已追加到输入框');
  }
}

// 切换选项列表展开/折叠
function toggleOptions() {
  isOptionsExpanded.value = !isOptionsExpanded.value;
}

// 切换阅读模式
async function toggleReaderMode() {
  if (viewMode.value === 'reader') {
    viewMode.value = 'normal';
  } else {
    viewMode.value = 'reader';
    console.log('📚 [App] 切换到阅读模式，开始加载历史...');
    await loadMaintextHistory();
    console.log('📚 [App] 阅读模式加载完成，条目数:', maintextHistory.value.length);
  }
}

// 切换读档模式
async function toggleSaveMode() {
  if (viewMode.value === 'save') {
    viewMode.value = 'normal';
  } else {
    viewMode.value = 'save';
    console.log('💾 [App] 切换到读档模式，开始加载存档...');
    await loadSaveHistory();
    console.log('💾 [App] 读档模式加载完成，条目数:', saveHistory.value.length);
  }
}

// 切换全屏 - 使用 Fullscreen API
async function toggleFullscreen() {
  try {
    const app = document.getElementById('app-root');
    if (!app) return;

    if (!document.fullscreenElement) {
      // 进入全屏
      await app.requestFullscreen();
      isFullscreen.value = true;
      console.log('🔲 [App] 进入全屏模式');
    } else {
      // 退出全屏
      await document.exitFullscreen();
      isFullscreen.value = false;
      console.log('🔲 [App] 退出全屏模式');
    }
  } catch (error) {
    console.error('❌ [App] 全屏切换失败:', error);
    // 降级方案：尝试使用父窗口的全屏
    try {
      if (window.parent && window.parent !== window) {
        const parentDoc = window.parent.document;
        const iframe = parentDoc.querySelector('iframe#' + getIframeName());
        if (iframe) {
          if (!parentDoc.fullscreenElement) {
            await iframe.requestFullscreen();
            isFullscreen.value = true;
          } else {
            await parentDoc.exitFullscreen();
            isFullscreen.value = false;
          }
        }
      }
    } catch (e) {
      console.error('❌ [App] 降级全屏也失败:', e);
    }
  }
}

// 监听全屏变化事件
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
  console.log('🔲 [App] 全屏状态变化:', isFullscreen.value);
}

// ---------- 长按正文：重roll / 编辑 ----------
function hasValidMessageId(): boolean {
  const id = currentMessageInfo.value.messageId;
  const valid = id !== undefined && id !== null;
  console.log('[长按] 检查 messageId:', id, '有效:', valid);
  return valid;
}

function onMaintextLongPressStart(e: MouseEvent | TouchEvent) {
  console.log('[长按] 开始检测', { hasMenu: !!contextMenu.value, hasText: !!mainText.value, hasValidId: hasValidMessageId(), isGenerating: isGenerating.value });

  if (
    contextMenu.value ||
    !mainText.value ||
    !hasValidMessageId() ||
    isGenerating.value ||
    isVariablePersistInProgress.value
  ) {
    console.log('[长按] 条件不满足，取消', { contextMenu: contextMenu.value, mainText: mainText.value, hasValidId: hasValidMessageId(), isGenerating: isGenerating.value });
    return;
  }

  // 桌面端：阻止文本选择/上下文菜单等默认行为
  // 移动端：不要在 touchstart 阶段 preventDefault，否则会直接影响滚动手势
  const isTouchEvent = 'touches' in e;
  if (!isTouchEvent && e.cancelable) {
    e.preventDefault();
  }
  e.stopPropagation();

  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

  console.log('[长按] 启动定时器', { x: clientX, y: clientY });

  longPressTimerRef.value = setTimeout(() => {
    console.log('[长按] 触发菜单', { x: clientX, y: clientY });
    contextMenu.value = { x: clientX, y: clientY };
    longPressTimerRef.value = null;
  }, 500);
}

function onMaintextLongPressEnd() {
  if (longPressTimerRef.value) {
    clearTimeout(longPressTimerRef.value);
    longPressTimerRef.value = null;
  }
  maintextTouchStartPos.value = null;
}

function onMaintextMouseDown(e: MouseEvent) {
  console.log('[长按] 鼠标按下', { hasMenu: !!contextMenu.value });
  if (contextMenu.value) return;
  e.stopPropagation();
  if (hasValidMessageId()) {
    onMaintextLongPressStart(e);
  }
}

function onMaintextTouchStart(e: TouchEvent) {
  console.log('[长按] 触摸开始', { hasMenu: !!contextMenu.value, hasValidId: hasValidMessageId() });
  if (contextMenu.value) return;
  if (hasValidMessageId()) {
    const touch = e.touches[0] ?? e.changedTouches[0];
    if (touch) {
      maintextTouchStartPos.value = { x: touch.clientX, y: touch.clientY };
    }
    onMaintextLongPressStart(e);
  }
}

function onMaintextTouchMove(e: TouchEvent) {
  if (!longPressTimerRef.value) return;
  const startPos = maintextTouchStartPos.value;
  if (!startPos) return;

  const touch = e.touches[0];
  if (!touch) return;

  const dx = Math.abs(touch.clientX - startPos.x);
  const dy = Math.abs(touch.clientY - startPos.y);

  // 手指明显移动则认为是滚动操作，取消长按计时
  const cancelDistancePx = 10;
  if (Math.hypot(dx, dy) >= cancelDistancePx) {
    onMaintextLongPressEnd();
  }
}

async function handleRegenerate() {
  const info = currentMessageInfo.value;
  if (info.messageId === undefined || info.messageId === null) {
    toastr.warning('无法重新生成：缺少必要的数据');
    contextMenu.value = null;
    return;
  }
  if (info.userMessageId === undefined || info.userMessageId === null) {
    toastr.warning('当前消息没有对应的用户输入，无法重 roll（首条剧情不支持重 roll）');
    contextMenu.value = null;
    return;
  }

  let unsubscribeStreamReroll: (() => void) | null = null;
  let streamSubscriptionSuccessReroll = false;

  try {
    isGenerating.value = true;
    isRegenerating.value = true;
    contextMenu.value = null;

    // 检测当前输出模式
    let isDualMode = false;
    let secondaryApiConfig: any = null;
    try {
      const { getCurrentOutputMode, getSecondaryApiConfig } = await import('./utils/apiSettings');
      isDualMode = getCurrentOutputMode() === 'dual';
      if (isDualMode) {
        secondaryApiConfig = getSecondaryApiConfig();
      }
    } catch (error) {
      console.warn('⚠️ [App] 检测输出模式失败:', error);
    }

    const userMessages = getChatMessages(info.userMessageId, { role: 'user' });
    if (!userMessages || userMessages.length === 0) {
      throw new Error('无法找到用户消息');
    }
    const userMessageText = userMessages[0].message || '';

    await deleteChatMessages([info.messageId], { refresh: 'none' });

    if (typeof generate !== 'function') {
      throw new Error('generate 函数不可用');
    }

    // 与 sendMessage 一致：流式更新正文，便于重 ROLL 过程中先阅读再进第二 API / 标签检核
    mainText.value = '';
    options.value = [];
    streamTextBuffer.value = '';
    let isThinkingCompleteReroll = false;
    if (typeof eventOn === 'function' && typeof iframe_events !== 'undefined' && iframe_events.STREAM_TOKEN_RECEIVED_FULLY) {
      const streamHandlerReroll = (text: string) => {
        streamTextBuffer.value = text;
        if (!isThinkingCompleteReroll) {
          isThinkingCompleteReroll = isFilteringComplete(text);
          if (!isThinkingCompleteReroll) {
            mainText.value = 'AI 正在思考...';
            return;
          }
        }
        const filteredText = extractFilteredContent(text);
        const parsed = parseMaintext(filteredText);
        if (parsed) {
          mainText.value = parsed;
        }
      };
      try {
        const sub = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, streamHandlerReroll);
        if (sub && typeof sub === 'object' && typeof sub.stop === 'function') {
          unsubscribeStreamReroll = sub.stop;
          streamSubscriptionSuccessReroll = true;
        }
      } catch (err) {
        console.error('❌ [App] 重 ROLL 注册流式监听失败:', err);
      }
    }

    aiGenerationStartMs.value = Date.now();
    let result = await generate({
      user_input: userMessageText,
      should_stream: true,
    });

    if (streamSubscriptionSuccessReroll && unsubscribeStreamReroll) {
      try {
        unsubscribeStreamReroll();
      } catch (err) {
        console.error('❌ [App] 重 ROLL 清理流式监听失败:', err);
      }
      unsubscribeStreamReroll = null;
      streamSubscriptionSuccessReroll = false;
    }

    // 双API模式：第二 API 变量 + 可选正文美化
    if (isDualMode && result && isSecondaryApiConfigured(secondaryApiConfig)) {
      try {
        const { mergeSecondaryPipelineIntoAssistantText } = await import('./utils/apiSettings');
        result = await mergeSecondaryPipelineIntoAssistantText(result, secondaryApiConfig, {
          statDataMessageId: info.userMessageId,
        });
      } catch (error) {
        console.error('❌ [App] 第二API处理失败:', error);
      }
    }

    if (!result || result.trim().length === 0) {
      throw new Error('生成结果为空');
    }

    const filteredResult = extractFilteredContent(result);
    mainText.value = parseMaintext(filteredResult);
    options.value = parseOptions(filteredResult);
    refreshFromRerollAfterTagConfirm.value = true;
    openTagValidationDialog(filteredResult);
  } catch (error) {
    console.error('❌ [App] 重 roll 失败:', error);
    hideSecondaryApiBanner();
    refreshFromRerollAfterTagConfirm.value = false;
    toastr.error('重 roll 失败: ' + String(error));
    loadMessageContent();
  } finally {
    if (streamSubscriptionSuccessReroll && unsubscribeStreamReroll) {
      try {
        unsubscribeStreamReroll();
      } catch {
        /* 忽略 */
      }
    }
    isGenerating.value = false;
    isRegenerating.value = false;
  }
}

function extractLastTagContent(text: string, tag: string): string {
  if (!text) return '';
  // 从后往前找：先找最后一个闭合标签，再找它前面最近的开标签
  const closeTag = `</${tag}>`;
  const closeIdx = text.toLowerCase().lastIndexOf(closeTag.toLowerCase());
  if (closeIdx === -1) return '';

  const openTagPattern = new RegExp(`<${tag}(\\s+[^>]*)?>`, 'i');
  const textBeforeClose = text.slice(0, closeIdx);
  // 从 closeIdx 往前找最后一个开标签
  const lastOpenMatch = textBeforeClose.match(new RegExp(`<${tag}(\\s+[^>]*)?>`, 'gi'));
  if (!lastOpenMatch || lastOpenMatch.length === 0) return '';

  const lastOpenTag = lastOpenMatch[lastOpenMatch.length - 1];
  const openIdx = textBeforeClose.lastIndexOf(lastOpenTag);
  if (openIdx === -1) return '';

  return text.slice(openIdx + lastOpenTag.length, closeIdx).trim();
}

async function handleRegenerateVariablesOnly() {
  const info = currentMessageInfo.value;
  if (info.messageId === undefined || info.messageId === null) {
    toastr.warning('无法重roll变量：缺少楼层 ID');
    contextMenu.value = null;
    return;
  }
  if (!info.fullMessage) {
    toastr.warning('无法重roll变量：缺少楼层内容');
    contextMenu.value = null;
    return;
  }

  const filtered = extractFilteredContent(info.fullMessage);
  const maintext = parseMaintext(filtered);
  if (!maintext) {
    toastr.warning('无法重roll变量：未找到 <maintext> 内容');
    contextMenu.value = null;
    return;
  }

  try {
    isGenerating.value = true;
    contextMenu.value = null;

    // 读取输出模式与第二 API 配置（不置 isRegenerating：保留当前正文可读，仅顶栏第二 API 提示）
    let mode: OutputMode = 'single';
    let secondaryApiConfig: any = null;
    try {
      const { getCurrentOutputMode, getSecondaryApiConfig } = await import('./utils/apiSettings');
      mode = getCurrentOutputMode();
      secondaryApiConfig = getSecondaryApiConfig();
    } catch (e) {
      console.warn('⚠️ [App] 获取输出模式/第二API配置失败，将按单API回退:', e);
    }

    const buildVariableOnlyPrompt = async (): Promise<string> => {
      let currentVariables: Record<string, any> = {};
      try {
        await waitGlobalInitialized('Mvu');
        const layerData = Mvu.getMvuData({ type: 'message', message_id: info.messageId! });
        currentVariables = (layerData?.stat_data ?? {}) as Record<string, any>;
      } catch (e) {
        console.warn('⚠️ [App] 获取本楼层 MVU stat_data 失败:', e);
      }

      // 读取世界书中“变量相关条目”的内容（即使双API模式下这些条目被关闭，也能读取 content）
      let variableUpdateRule = '';
      let variableList = '';
      let variableOutputFormat = '';
      let mvuPrefixedEntriesFull = '';
      try {
        const { collectVariableWorldbookContentsFromEntries, joinAllMvUPrefixedEntryBlocks } = await import(
          './utils/apiSettings',
        );
        const worldbookName = ((SillyTavern as any).getCharacterInfo?.()?.worldbook_name) || '规则系统';
        const entries = await getWorldbook(worldbookName);
        const sections = collectVariableWorldbookContentsFromEntries(entries);
        variableUpdateRule = sections.variableUpdateRule;
        variableList = sections.variableList;
        variableOutputFormat = sections.variableOutputFormat;
        mvuPrefixedEntriesFull = joinAllMvUPrefixedEntryBlocks(entries);
      } catch (e) {
        console.warn('⚠️ [App] 读取世界书变量条目失败，将使用默认格式:', e);
      }

      const outputFormat = variableOutputFormat || `[
  { "op": "replace", "path": "/路径", "value": 值 },
  { "op": "add", "path": "/路径", "value": 值 }
]`;

      // 分析现有角色的空缺字段
      const characterArchives = currentVariables?.角色档案 || {};
      const characterGaps: string[] = [];
      for (const [charId, charData] of Object.entries(characterArchives)) {
        const gaps: string[] = [];
        const c = charData as any;
        if (!c.性格 || Object.keys(c.性格).length === 0) gaps.push('性格（空对象，需填充）');
        if (!c.性癖 || Object.keys(c.性癖).length === 0) gaps.push('性癖（空对象，需填充）');
        if (Object.keys(getMergedSensitiveDevelopment(c)).length === 0) {
          gaps.push('敏感点开发（空对象，需填充；兼容旧键「敏感部位」）');
        }
        if (!c.隐藏性癖 || c.隐藏性癖 === '') gaps.push('隐藏性癖（空字符串，需填充）');
        if (!c.当前内心想法 || c.当前内心想法 === '') gaps.push('当前内心想法（空，需基于正文推断）');
        const loc = c.当前位置;
        const locBad =
          loc == null ||
          typeof loc !== 'object' ||
          Array.isArray(loc) ||
          (String((loc as Record<string, unknown>).区域ID ?? '').trim() === '' &&
            String((loc as Record<string, unknown>).建筑ID ?? '').trim() === '');
        if (locBad) {
          gaps.push('当前位置（须为对象且含区域ID、建筑ID；与区域数据/建筑数据 id 对齐；活动ID可空）');
        }
        if (!c.当前综合生理描述 || c.当前综合生理描述 === '') gaps.push('当前综合生理描述（空，需基于正文推断）');
        if (gaps.length > 0) {
          characterGaps.push(`- ${c.姓名 || charId}: ${gaps.join('、')}`);
        }
      }

      const characterGapSection = characterGaps.length > 0
        ? `## ⚠️ 现有角色档案空缺检测\n以下角色存在空缺的字段，请**务必基于正文内容**进行推断和填充：\n${characterGaps.join('\n')}\n\n`
        : '';

      const mvuFullSection =
        (mvuPrefixedEntriesFull || '').trim().length > 0
          ? `## 世界书：以 [mvu] / [mvu_update] 开头的全部条目（变量工作时必读，勿遗漏；与下文「变量列表 / 更新规则」互补）\n${mvuPrefixedEntriesFull.trim()}\n\n`
          : '';

      return `你是一位专门负责游戏变量更新的AI助手。你的任务是根据提供的游戏正文和当前变量数据，生成变量更新指令。

## 当前变量数据（JSON格式）
\`\`\`json
${JSON.stringify(currentVariables, null, 2)}
\`\`\`

## 变量快照来源
以下 JSON 取自：**当前长按所在消息楼层 #${info.messageId} 的 stat_data**。请在该快照基础上输出 JSON Patch。

${mvuFullSection}${formatPersonalRuleKeysSection(currentVariables)}${variableList ? `## 变量列表\n${variableList}\n\n` : ''}${variableUpdateRule ? `## 变量更新规则\n${variableUpdateRule}\n\n` : ''}${characterGapSection}${VARIABLE_JSON_PATCH_RUNTIME_RULES}
## 变量输出格式
请严格按照以下 JSON Patch 格式输出变量更新：
\`\`\`json
${outputFormat}
\`\`\`

## 正文内容（请据此分析变量变化）
<maintext>
${maintext}
</maintext>

## 核心任务（优先级从高到低）
1. **补足现有角色空缺**：检查上述"现有角色档案空缺检测"中的角色，基于正文推断并填充所有空缺字段（性格、性癖、敏感点开发、隐藏性癖、当前内心想法、**当前位置**、当前综合生理描述；**敏感点开发**为新键名，与旧 **敏感部位** 同形）
2. **更新现有角色数值**：根据正文中的互动，更新好感度、发情值、性癖开发值等数值
3. **创建新角色**：如果正文出现新角色，生成完整的角色档案（不得遗漏任何字段）
4. **更新世界规则**：如有新规则生效或规则状态变化

## 重要原则
- **优先使用 replace 操作更新现有角色**，而非 insert 创建新条目
- **绝对禁止**：让性格、性癖、敏感点开发保持为空对象 {}；让隐藏性癖、当前内心想法保持为空白字符串
- **基于正文推断**：即使没有直接描述，也要根据上下文合理推断角色的心理和生理状态

## 输出要求
1. 只输出 <UpdateVariable> 标签及其内容
2. 不要输出正文、解释或任何其他内容
3. 使用标准的 JSON Patch 格式（op: 仅 replace / add / remove / move；**禁止 delta**）
4. 确保 JSON 格式正确无误
5. 检查确认：所有现有角色的空缺字段都已被填充

请输出：
<UpdateVariable>...</UpdateVariable>`;
    };

    // 生成新的 UpdateVariable
    let updateVariable = '';
    if (mode === 'dual' && isSecondaryApiConfigured(secondaryApiConfig)) {
      // 双API：优先走第二 API（generateRaw + 短上下文；若开启分轮则含附加任务合并）
      const { runSecondaryApiForMaintextPipeline } = await import('./utils/apiSettings');
      const { variableUpdate } = await runSecondaryApiForMaintextPipeline(maintext, secondaryApiConfig, {
        statDataMessageId: info.messageId!,
      });
      updateVariable = variableUpdate;
    } else if (isSecondaryApiConfigured(secondaryApiConfig)) {
      // 单API但配置了第二 API：同样可以走第二 API 来“只重roll变量”
      const { runSecondaryApiForMaintextPipeline } = await import('./utils/apiSettings');
      const { variableUpdate } = await runSecondaryApiForMaintextPipeline(maintext, secondaryApiConfig, {
        statDataMessageId: info.messageId!,
      });
      updateVariable = variableUpdate;
    } else {
      // 单API且未配置第二 API：用主 API 按“第二 API 的任务格式”生成变量
      if (typeof generate !== 'function') throw new Error('generate 函数不可用');
      const prompt = await buildVariableOnlyPrompt();
      const r = await generate({ user_input: prompt, should_stream: false });
      updateVariable = extractLastTagContent(String(r || ''), 'UpdateVariable');
    }

    if (!updateVariable) {
      throw new Error('未能生成有效的 <UpdateVariable> 内容');
    }

    // 直接应用变量更新（像“重试额外模型解析”一样，不需要弹窗确认）
    console.log('🔄 [App] 直接应用变量更新到楼层:', info.messageId);

    // 构建完整消息：保留原正文、选项、sum，只替换变量部分
    const withoutOldVariable = filtered.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>\s*/gi, '').trim();
    const updatedMessage = `${withoutOldVariable}\n\n<UpdateVariable>\n${updateVariable.trim()}\n</UpdateVariable>`;

    // 保存到快照，设置标记，打开标签验证弹窗（与handleRegenerate保持一致）
    lastGenerationRaw.value = updatedMessage;
    refreshFromRerollAfterTagConfirm.value = true;
    isVariableRerollOnly.value = true; // 标记这是单独重roll变量模式
    openTagValidationDialog(extractFilteredContent(updatedMessage));

    console.log('✅ [App] 单独重roll变量：已生成新变量并打开标签验证弹窗');
  } catch (error) {
    console.error('❌ [App] 单独重roll变量失败:', error);
    toastr.error('单独重roll变量失败: ' + String(error));
    refreshFromRerollAfterTagConfirm.value = false;
    isVariableRerollOnly.value = false;
    loadMessageContent();
  } finally {
    isGenerating.value = false;
  }
}

function closeVariableRerollDialog() {
  variableRerollDialogOpen.value = false;
  variableRerollPatchText.value = '';
  pendingVariableReroll.value = null;
}

async function confirmVariableRerollApply() {
  const pending = pendingVariableReroll.value;
  if (!pending) {
    closeVariableRerollDialog();
    return;
  }
  const patchText = (variableRerollPatchText.value || '').trim();
  if (!patchText) {
    toastr.warning('变量更新内容为空，无法应用');
    return;
  }

  try {
    isGenerating.value = true;
    console.log('🔄 [App] 开始应用变量更新到楼层:', pending.messageId);

    // 构建包含新 UpdateVariable 的消息内容
    const withoutOld = pending.filteredMessage.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>\s*/gi, '').trim();
    const updatedMessage = `${withoutOld}\n\n<UpdateVariable>\n${patchText}\n</UpdateVariable>`;
    const jsonPatchesForWorldLife = extractJsonPatchFromUpdateVariable(updatedMessage);

    // 使用 MVU 方式直接更新变量数据（不修改消息内容，避免楼层重新渲染）
    let appliedParsed: Mvu.MvuData | null = null;
    try {
      await waitGlobalInitialized('Mvu');
      const base = pending.baseData ?? Mvu.getMvuData({ type: 'message', message_id: Math.max(pending.messageId - 1, 0) });

      // 首先尝试手动解析 <JSONPatch> 格式
      let parsed: Mvu.MvuData | null = null;
      if (jsonPatchesForWorldLife && base) {
        console.log('🔄 [App] 检测到 <JSONPatch> 格式，手动应用变量更新...');
        parsed = JSON.parse(JSON.stringify(base));
        if (!parsed.stat_data) parsed.stat_data = {};
        applyJsonPatch(parsed.stat_data, jsonPatchesForWorldLife);
        console.log('✅ [App] JSON Patch 已手动应用');
      } else if (typeof Mvu?.parseMessage === 'function') {
        // 回退到 MVU 的 parseMessage
        console.log('🔄 [App] 使用 Mvu.parseMessage 解析变量更新...');
        parsed = await Mvu.parseMessage(updatedMessage, base);
      }

      if (parsed) {
        console.log('✅ [App] MVU 解析成功，准备使用 replaceMvuData 写回变量...');
        // 关键修改：使用 Mvu.replaceMvuData 直接替换变量数据，不修改消息内容
        await Mvu.replaceMvuData(parsed, { type: 'message', message_id: pending.messageId });
        console.log('✅ [App] 变量已通过 Mvu.replaceMvuData 应用到楼层:', pending.messageId);
        appliedParsed = parsed;
      } else {
        console.warn('⚠️ [App] MVU 解析返回空，跳过写回变量');
      }
    } catch (e) {
      console.warn('⚠️ [App] MVU 方式更新变量失败，尝试降级到合并写入:', e);
      // 降级方案：合并写入，保留楼层上非 MVU 标准顶层键
      try {
        await waitGlobalInitialized('Mvu');
        const base = pending.baseData ?? Mvu.getMvuData({ type: 'message', message_id: Math.max(pending.messageId - 1, 0) });

        // 降级方案也先尝试 JSON Patch
        let parsed: Mvu.MvuData | null = null;
        if (jsonPatchesForWorldLife && base) {
          parsed = JSON.parse(JSON.stringify(base));
          if (!parsed.stat_data) parsed.stat_data = {};
          applyJsonPatch(parsed.stat_data, jsonPatchesForWorldLife);
        } else if (typeof Mvu?.parseMessage === 'function') {
          parsed = await Mvu.parseMessage(updatedMessage, base);
        }

        if (parsed) {
          await updateVariablesWith(
            existing =>
              Object.assign({}, existing && typeof existing === 'object' ? existing : {}, parsed as object),
            { type: 'message', message_id: pending.messageId },
          );
          console.log('✅ [App] 变量已通过合并写入降级方案应用到楼层');
          appliedParsed = parsed;
        }
      } catch (e2) {
        console.error('❌ [App] 降级方案也失败:', e2);
        throw e2;
      }
    }

    scheduleWorldLifeAfterJsonPatchIfNeeded(jsonPatchesForWorldLife, appliedParsed?.stat_data);
    scheduleResidentLifeFlushAfterStatCommit(appliedParsed?.stat_data);

    closeVariableRerollDialog();
    // 使用轻量级刷新，避免界面闪烁
    currentMessageId.value = undefined;
    await loadMessageContent();
    toastr.success('变量已应用到当前楼层');
  } catch (e) {
    console.error('❌ [App] 应用变量更新失败:', e);
    toastr.error('应用失败: ' + String(e));
  } finally {
    isGenerating.value = false;
  }
}

async function openVariableUpdateDialog() {
  try {
    // 优先使用当前缓存的 fullMessage
    const info = currentMessageInfo.value;
    let messageText = info.fullMessage || '';

    // 兜底：如果没有 fullMessage，尝试按 messageId 拉取一次
    if (!messageText && info.messageId !== undefined && info.messageId !== null) {
      try {
        const ms = getChatMessages(info.messageId);
        if (ms && ms.length > 0) {
          messageText = ms[0].message || '';
        }
      } catch (e) {
        // 忽略
      }
    }

    const filtered = extractFilteredContent(messageText);
    const patch = extractLastTagContent(filtered, 'UpdateVariable');

    variableUpdateDialogText.value = patch || '';
    variableUpdateDialogOpen.value = true;
  } catch (e) {
    console.warn('⚠️ [App] 打开变量更新弹窗失败:', e);
    variableUpdateDialogText.value = '';
    variableUpdateDialogOpen.value = true;
  }
}

function closeVariableUpdateDialog() {
  variableUpdateDialogOpen.value = false;
  variableUpdateDialogText.value = '';
}

function handleEdit() {
  const info = currentMessageInfo.value;
  if (
    info.messageId === undefined ||
    info.messageId === null ||
    !info.fullMessage
  ) {
    toastr.warning('无法编辑：缺少必要的数据');
    contextMenu.value = null;
    return;
  }

  const maintextInner = parseMaintext(info.fullMessage);
  if (!maintextInner) {
    toastr.warning('无法提取要编辑的正文内容');
    contextMenu.value = null;
    return;
  }

  editingMessage.value = {
    messageId: info.messageId,
    fullMessage: info.fullMessage,
  };
  editingText.value = maintextInner;
  contextMenu.value = null;
}

function closeEditModal() {
  editingMessage.value = null;
  editingText.value = '';
}

function closeContextMenu() {
  contextMenu.value = null;
  onMaintextLongPressEnd();
}

// 上下文菜单样式（计算属性确保边界安全）
const contextMenuStyle = computed((): any => {
  if (!contextMenu.value) return {};
  const menuWidth = 200;
  const menuHeight = 140;
  const padding = 8;
  
  // 确保在视口范围内
  const maxX = Math.max(window.innerWidth - menuWidth - padding, padding);
  const maxY = Math.max(window.innerHeight - menuHeight - padding, padding);
  
  const x = Math.min(Math.max(contextMenu.value.x, padding), maxX);
  const y = Math.min(Math.max(contextMenu.value.y, padding), maxY);
  
  return {
    left: `${x}px`,
    top: `${y}px`,
    position: 'fixed',
  };
});

async function handleSaveEdit() {
  if (!editingMessage.value) return;

  try {
    const { messageId, fullMessage } = editingMessage.value;
    const currentText = editingText.value;
    const updatedMessage = replaceLastMaintextInnerContent(fullMessage, currentText);
    await setChatMessages(
      [{ message_id: messageId, message: updatedMessage }],
      { refresh: 'affected' }
    );
    editingMessage.value = null;
    editingText.value = '';
    // 同楼层编辑后 messageId 不变，loadMessageContent 会跳过更新，需强制刷新
    refreshMessage();
    toastr.success('正文已保存');
  } catch (error) {
    console.error('❌ [App] 保存编辑失败:', error);
    toastr.error('保存失败: ' + String(error));
  }
}

// 加载 maintext 历史（阅读模式）
async function loadMaintextHistory() {
  try {
    // 直接从聊天消息读取（简单可靠）
    const lastMessageId = getLastMessageId();
    if (lastMessageId < 0) {
      maintextHistory.value = [];
      console.log('📚 [App] 没有可用的消息记录');
      return;
    }

    // 获取所有 assistant 消息
    const messages = getChatMessages(`0-${lastMessageId}`, { role: 'assistant' });
    if (!messages || messages.length === 0) {
      maintextHistory.value = [];
      console.log('📚 [App] 没有可用的消息记录');
      return;
    }

    // 按楼层顺序构建阅读历史（从旧到新）
    maintextHistory.value = messages
      .map(msg => ({
        messageId: msg.message_id,
        maintext: parseMaintext(msg.message || ''),
        timestamp: new Date(msg.data?.timestamp || Date.now()).toLocaleString(),
        turnNumber: Math.floor(msg.message_id / 2),
      }))
      .filter(item => item.maintext.length > 0);

    console.log('📚 [App] 从消息加载阅读历史:', maintextHistory.value.length, '条');
  } catch (error) {
    console.error('❌ [App] 加载阅读历史失败:', error);
    maintextHistory.value = [];
  }
}

// 加载存档历史（读档模式）
async function loadSaveHistory() {
  try {
    // 直接从聊天消息读取（简单可靠）
    const lastMessageId = getLastMessageId();
    if (lastMessageId < 0) {
      saveHistory.value = [];
      console.log('💾 [App] 没有可用的存档记录');
      return;
    }

    // 获取所有 assistant 消息
    const messages = getChatMessages(`0-${lastMessageId}`, { role: 'assistant' });
    if (!messages || messages.length === 0) {
      saveHistory.value = [];
      console.log('💾 [App] 没有可用的存档记录');
      return;
    }

    // 按楼层顺序构建存档历史（从旧到新），只显示有 <sum> 的楼层
    saveHistory.value = messages
      .map(msg => {
        const message = msg.message || '';
        // 提取 <sum> 标签内容
        const sumText = extractLastSumContent(message);
        return {
          messageId: msg.message_id,
          turnNumber: Math.floor(msg.message_id / 2),
          sum: sumText,
          timestamp: new Date(msg.data?.timestamp || Date.now()).toLocaleString()
        };
      })
      .filter(item => item.sum.length > 0);

    console.log('💾 [App] 从消息加载存档历史:', saveHistory.value.length, '条');
  } catch (error) {
    console.error('❌ [App] 加载存档历史失败:', error);
    saveHistory.value = [];
  }
}

// 创建分支
function createBranch(messageId: number, turnNumber?: number) {
  try {
    triggerSlash(`/branch-create ${messageId}`);
    console.log('🌿 [App] 创建分支: 楼层', messageId, turnNumber !== undefined ? `(回合 ${turnNumber})` : '');
    toastr.success(`已从回合 ${turnNumber !== undefined ? turnNumber : '?'} 创建分支`);
    // 切换回普通模式
    viewMode.value = 'normal';
  } catch (error) {
    console.error('❌ [App] 创建分支失败:', error);
    toastr.error('创建分支失败');
  }
}

// 保存游戏状态快照（用于错误回退）
function saveGameSnapshot(userInput: string) {
  lastUserInputSnapshot.value = userInput;
  lastMaintextSnapshot.value = mainText.value;
  lastOptionsSnapshot.value = [...options.value];
  lastMessageIdSnapshot.value = currentMessageId.value;
  pendingUserMessageId.value = null;
  console.log('📸 [App] 游戏状态快照已保存');
}

/**
 * 回退完成后：若当前聊天中可见的 user 至多 1 条、且仍无任何 assistant 楼层（仅有开局 user、第一回合 AI 尚未落层），则回到开始界面。
 * 若已有 assistant（例如开局已成功生成过第一回合），即使 user 只有 1 条，也说明对局已开始，回退后须留在游戏界面并仅恢复快照 UI。
 */
function maybeReturnToOpeningAfterRollback(): boolean {
  if (gamePhase.value !== GamePhase.GAME) return false;
  try {
    if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') return false;
    const last = getLastMessageId();
    if (last < 0) return false;

    const all = getChatMessages(`0-${last}`, { hide_state: 'unhidden' });
    const userCount = all.filter(m => m.role === 'user').length;
    const assistantCount = all.filter(m => m.role === 'assistant').length;
    if (userCount > 1) return false;
    if (assistantCount >= 1) return false;

    console.log('🏠 [App] 回退后检测到无玩家后续楼层（仅开局 user、尚无 AI 楼层），返回开始界面');
    gamePhase.value = GamePhase.OPENING;
    isOpeningPhase.value = false;
    viewMode.value = 'normal';
    mainText.value = '';
    options.value = [];
    streamTextBuffer.value = '';
    currentMessageId.value = undefined;
    currentMessageInfo.value = {};
    userInput.value = '';
    showAiOutput.value = false;
    tagDialogRawMaximized.value = false;
    lastGenerationRaw.value = '';
    tagDialogEditedRaw.value = '';
    lastGenerationDurationLabel.value = '';
    pendingUserMessageId.value = null;
    lastUserInputSnapshot.value = '';
    lastMaintextSnapshot.value = '';
    lastOptionsSnapshot.value = [];
    lastMessageIdSnapshot.value = undefined;
    if (openingFormRef.value) {
      openingFormRef.value.resetSubmitState();
    }
    toastr.info('已回到开始界面（当前聊天仅含开局相关楼层）');
    return true;
  } catch (e) {
    console.warn('⚠️ [App] 检测是否仅剩开局楼层失败:', e);
    return false;
  }
}

// 回退到上次快照状态
async function rollbackToSnapshot() {
  console.log('⏮️ [App] 开始回退到上次快照状态...');

  try {
    const toDelete: number[] = [];

    // 1. 删除 pending 的 user 消息（如果存在）
    if (pendingUserMessageId.value !== null) {
      toDelete.push(pendingUserMessageId.value);
    }

    // 2. 兜底：若快照后多出了楼层且当前最后一条是 user，也删掉（避免 pendingUserMessageId 记错导致玩家楼层残留）
    const snapshotId = lastMessageIdSnapshot.value;
    if (snapshotId !== undefined && snapshotId !== null && typeof getLastMessageId === 'function') {
      const currentLast = getLastMessageId();
      if (currentLast > snapshotId) {
        try {
          const atLast = getChatMessages(currentLast);
          if (atLast && atLast.length > 0 && atLast[0].role === 'user') {
            if (!toDelete.includes(currentLast)) toDelete.push(currentLast);
          }
        } catch (_) {
          // 查询失败则只依赖 toDelete 中已有的 id
        }
      }
    }

    for (const id of toDelete) {
      try {
        await deleteChatMessages([id], { refresh: 'none' });
        console.log('✅ [App] 已删除 user 消息:', id);
      } catch (e) {
        console.warn('⚠️ [App] 删除 user 消息失败:', id, e);
        toastr.warning('回退时删除玩家消息失败，请检查是否有多余的玩家楼层');
      }
    }

    // 3. 恢复 UI 状态
    mainText.value = lastMaintextSnapshot.value;
    options.value = [...lastOptionsSnapshot.value];
    currentMessageId.value = lastMessageIdSnapshot.value;
    userInput.value = lastUserInputSnapshot.value;

    // 4. 清理临时状态
    hideSecondaryApiBanner();
    lastGenerationRaw.value = '';
    tagDialogEditedRaw.value = '';
    lastGenerationDurationLabel.value = '';
    pendingUserMessageId.value = null;
    isTagDialogOpen.value = false;
    showAiOutput.value = false; // 重置展开状态
    tagDialogRawMaximized.value = false;

    if (maybeReturnToOpeningAfterRollback()) {
      console.log('✅ [App] 回退完成，已切换至开始界面');
    } else {
      console.log('✅ [App] 回退完成，输入框已还原');
      toastr.info('已回退到发送前的状态');
    }
  } catch (error) {
    console.error('❌ [App] 回退失败:', error);
    toastr.error('回退失败');
  }
}

// 打开标签验证弹窗
function openTagValidationDialog(rawText: string) {
  hideSecondaryApiBanner();
  lastGenerationRaw.value = rawText;
  tagDialogEditedRaw.value = rawText;
  const elapsed =
    aiGenerationStartMs.value > 0 ? Date.now() - aiGenerationStartMs.value : NaN;
  lastGenerationDurationLabel.value = formatGenerationDurationMs(elapsed);
  tagCheckResults.value = validateTags(rawText);
  isTagDialogOpen.value = true;
  showAiOutput.value = false; // 默认折叠“AI 完整输出”
  tagDialogRawMaximized.value = false;
  tagDialogTextareaLastSel.value = { start: rawText.length, end: rawText.length };
  console.log('🔍 [App] 打开标签验证弹窗:', tagCheckResults.value);
}

/** 标签弹窗内：按当前编辑区文本重新跑标签检核 */
function recheckTagDialogContent() {
  const text = tagDialogEditedRaw.value;
  tagCheckResults.value = validateTags(text);
  console.log('🔍 [App] 重新检验标签:', tagCheckResults.value);
  if (tagCheckHasBlockingInvalid(tagCheckResults.value)) {
    toastr.warning('仍有标红项，可继续修补或选择「无视错误确认」');
  } else {
    toastr.success('标签检验已更新');
  }
}

/** 在正文编辑框光标处插入 maintext 开/闭标签（未展开编辑区时追加到全文末尾） */
function insertMaintextTagAtCursor(which: 'open' | 'close') {
  const tag = which === 'open' ? '<maintext>' : '</maintext>';
  const el = tagDialogRawTextareaRef.value;
  const full = tagDialogEditedRaw.value;

  if (showAiOutput.value && el) {
    let start = typeof el.selectionStart === 'number' ? el.selectionStart : full.length;
    let end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
    if (document.activeElement !== el) {
      start = Math.min(tagDialogTextareaLastSel.value.start, full.length);
      end = Math.min(tagDialogTextareaLastSel.value.end, full.length);
      if (end < start) end = start;
    }
    tagDialogEditedRaw.value = full.slice(0, start) + tag + full.slice(end);
    const caret = start + tag.length;
    tagDialogTextareaLastSel.value = { start: caret, end: caret };
    void nextTick(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
    return;
  }

  tagDialogEditedRaw.value = full + tag;
}

function onTagDialogCloseAttempt() {
  toastr.info('请使用下方按钮选择“回退到发送前”或“确认信息”');
}

// 处理标签验证弹窗 - 无视错误继续
async function onTagDialogIgnore() {
  console.log('⚠️ [App] 用户选择无视标签错误，继续本回合');

  // 采用弹窗内编辑后的全文（含手动补标签）
  lastGenerationRaw.value = tagDialogEditedRaw.value;

  // 解析最终结果
  const finalMaintext = parseMaintext(lastGenerationRaw.value);
  const finalOptions = parseOptions(lastGenerationRaw.value);

  // 兜底：确认前再次检查，防止界面出现“空白无提示”
  if (!finalMaintext && finalOptions.length === 0) {
    console.warn('⚠️ [App] 标签确认时检测到空回，自动回退');
    refreshFromRerollAfterTagConfirm.value = false;
    toastr.error('AI 返回内容为空，已回退到发送前状态');
    await rollbackToSnapshot();
    isTagDialogOpen.value = false;
    isGenerating.value = false;
    showAiOutput.value = false;
    tagDialogRawMaximized.value = false;
    return;
  }

  mainText.value = finalMaintext;
  options.value = finalOptions;

  const snapshotRaw = lastGenerationRaw.value;
  const wasOpeningPhase = isOpeningPhase.value;

  // 开局：立刻进入主界面以便阅读正文；标签弹窗立即关闭，后续用顶栏轻提示
  if (wasOpeningPhase) {
    gamePhase.value = GamePhase.GAME;
  }
  isTagDialogOpen.value = false;
  isVariablePersistInProgress.value = true;

  try {
    // 单独重roll变量模式：更新现有消息而不是创建新消息
    if (isVariableRerollOnly.value && currentMessageInfo.value.messageId !== undefined) {
      const messageId = currentMessageInfo.value.messageId;
      console.log('🔄 [App] 单独重roll变量模式：更新现有楼层消息:', messageId);

      // 1. 更新消息内容
      if (typeof setChatMessages === 'function') {
        await setChatMessages([{ message_id: messageId, message: snapshotRaw }], { refresh: 'none' });
        console.log('✅ [App] 已更新楼层消息内容');
      }

      // 2. 应用变量更新（使用MVU方式）
      try {
        await waitGlobalInitialized('Mvu');
        const baseId = Math.max(messageId - 1, 0);
        const base = Mvu.getMvuData({ type: 'message', message_id: baseId });

        let parsed: Mvu.MvuData | null = null;
        const jsonPatches = extractJsonPatchFromUpdateVariable(snapshotRaw);
        if (jsonPatches && base) {
          console.log('🔄 [App] 检测到 <JSONPatch> 格式，手动应用变量更新...');
          parsed = JSON.parse(JSON.stringify(base));
          if (!parsed.stat_data) parsed.stat_data = {};
          applyJsonPatch(parsed.stat_data, jsonPatches);
          console.log('✅ [App] JSON Patch 已手动应用');
        } else if (typeof Mvu?.parseMessage === 'function') {
          parsed = await Mvu.parseMessage(snapshotRaw, base);
        }

        if (parsed) {
          await Mvu.replaceMvuData(parsed, { type: 'message', message_id: messageId });
          console.log('✅ [App] 变量已通过 Mvu.replaceMvuData 应用到楼层:', messageId);
          scheduleWorldLifeAfterJsonPatchIfNeeded(jsonPatches, parsed.stat_data);
          scheduleResidentLifeFlushAfterStatCommit(parsed.stat_data);
        }
      } catch (e) {
        console.warn('⚠️ [App] 单独重roll变量时应用变量更新失败:', e);
      }

      // 3. 更新编年史
      try {
        const { checkAndUpdateChronicle } = await import('./utils/chronicleUpdater');
        await checkAndUpdateChronicle();
      } catch (e) {
        console.warn('⚠️ [App] 更新编年史失败:', e);
      }
    } else {
      // 正常模式：创建新消息
      await recordAssistantMessage(snapshotRaw);
      await normalizeLatestChineseStatData();
      await runShujukuManualUpdateAfterAssistantSaved();
      if (wasOpeningPhase && !openingMessage1CancelWrapDone.value) {
        const wrapOk = await wrapOpeningMessage1WithCancelDelimiters();
        if (wrapOk) {
          openingMessage1CancelWrapDone.value = true;
        }
      }
    }
  } finally {
    isVariablePersistInProgress.value = false;
  }

  // 清理状态
  lastGenerationRaw.value = '';
  tagDialogEditedRaw.value = '';
  lastGenerationDurationLabel.value = '';
  pendingUserMessageId.value = null;
  lastUserInputSnapshot.value = '';
  lastMaintextSnapshot.value = '';
  lastOptionsSnapshot.value = [];
  lastMessageIdSnapshot.value = undefined;
  isGenerating.value = false;
  showAiOutput.value = false; // 重置展开状态
  tagDialogRawMaximized.value = false;
  isVariableRerollOnly.value = false; // 重置单独重roll变量标记

  // 如果是开局流程，结束初始化并刷新楼层元数据
  if (wasOpeningPhase) {
    console.log('🎮 [App] 开局确认，进入游戏主界面...');
    isOpeningPhase.value = false;
    isInitializing.value = false;

    setTimeout(() => {
      loadMessageContent();
    }, 500);

    toastr.success('游戏初始化完成！');
  } else if (refreshFromRerollAfterTagConfirm.value) {
    refreshFromRerollAfterTagConfirm.value = false;
    refreshMessage();
    toastr.success('已确认，继续游戏');
  } else {
    loadMessageContent();
    toastr.success('已确认，继续游戏');
  }
}

// 停止开局生成（与生成失败一致：删掉本回合 user 楼层并回到开局界面）
async function stopOpeningGeneration() {
  console.log('🛑 [App] 用户点击停止开局生成');
  hideSecondaryApiBanner();
  if (openingGenerationId.value) {
    stopGenerationById(openingGenerationId.value);
  } else {
    stopAllGeneration();
  }
  if (pendingUserMessageId.value != null && typeof deleteChatMessages === 'function') {
    try {
      await deleteChatMessages([pendingUserMessageId.value], { refresh: 'none' });
      console.log('✅ [App] 已删除停止生成时的开局 user 楼层:', pendingUserMessageId.value);
    } catch (e) {
      console.warn('⚠️ [App] 删除开局 user 楼层失败:', e);
    }
  }
  pendingUserMessageId.value = null;
  isGeneratingOpening.value = false;
  isGenerating.value = false;
  isInitializing.value = false;
  isOpeningPhase.value = false;
  openingGenerationId.value = '';
  streamTextBuffer.value = '';
  mainText.value = '';
  options.value = [];
  gamePhase.value = GamePhase.OPENING;
  if (openingFormRef.value) {
    openingFormRef.value.resetSubmitState();
  }
  toastr.info('已停止生成，已回到开局界面');
}

// 处理标签验证弹窗 - 回退
async function onTagDialogRollback() {
  console.log('⏮️ [App] 用户选择回退');
  refreshFromRerollAfterTagConfirm.value = false;
  isVariableRerollOnly.value = false; // 重置单独重roll变量标记

  // 如果是开局流程，删除已创建的 user 消息并回到开局表单
  if (isOpeningPhase.value) {
    console.log('🎮 [App] 开局回退，返回开局表单...');

    // 删除已写入的 user 消息
    if (pendingUserMessageId.value !== null) {
      try {
        await deleteChatMessages([pendingUserMessageId.value], { refresh: 'none' });
        console.log('✅ [App] 已删除开局 user 消息:', pendingUserMessageId.value);
      } catch (e) {
        console.warn('⚠️ [App] 删除开局 user 消息失败:', e);
      }
    }

    // 清理状态
    pendingUserMessageId.value = null;
    lastGenerationRaw.value = '';
    tagDialogEditedRaw.value = '';
    lastGenerationDurationLabel.value = '';
    isTagDialogOpen.value = false;
    isGenerating.value = false;
    isGeneratingOpening.value = false; // 确保重置开局生成状态，避免按钮一直转圈
    isInitializing.value = false;
    isOpeningPhase.value = false;
    showAiOutput.value = false;
    tagDialogRawMaximized.value = false;
    mainText.value = '';
    options.value = [];
    streamTextBuffer.value = '';

    // 保持在开局表单（不进入游戏阶段）
    gamePhase.value = GamePhase.OPENING;
    // 重置开局表单提交状态，保留表单内容（避免“开始游戏”一直转圈）
    if (openingFormRef.value) { openingFormRef.value.resetSubmitState(); }
    toastr.info('已回退到开局表单，可以重新设置并生成');
    return;
  }

  // 正常流程：回退到快照状态
  await rollbackToSnapshot();
  isGenerating.value = false;
  showAiOutput.value = false; // 重置展开状态
  tagDialogRawMaximized.value = false;
}

/**
 * 开局确认、首条 assistant 已写入后：基于当前楼层已解析的 MVU 再请求一次第二 API，刷新 &lt;UpdateVariable&gt;。
 * 与进游戏后手动「单独重roll变量」/ 在 MVU 里重试额外模型解析类似，在开局阶段自动完成一轮。
 */
async function refineOpeningAssistantWithSecondaryApi(
  fullMessageUsedForRecord: string,
  assistantMessageId: number,
): Promise<void> {
  try {
    const { getSecondaryApiConfig, runSecondaryApiForMaintextPipeline, isSecondaryApiConfigured } = await import(
      './utils/apiSettings',
    );
    const secondaryApiConfig = getSecondaryApiConfig();
    if (!isSecondaryApiConfigured(secondaryApiConfig)) return;

    if (typeof getChatMessages === 'function') {
      const msgs = getChatMessages(assistantMessageId);
      if (!msgs?.[0] || msgs[0].role !== 'assistant') {
        console.warn('⚠️ [App] 开局精炼变量：目标楼层不是 assistant，跳过');
        return;
      }
    }

    const filtered = extractFilteredContent(fullMessageUsedForRecord);
    const maintext = extractLastTagContent(filtered, 'maintext');
    if (!maintext.trim()) {
      console.log('ℹ️ [App] 开局精炼变量：无 maintext，跳过');
      return;
    }

    const { variableUpdate: updateVariable } = await runSecondaryApiForMaintextPipeline(
      maintext,
      secondaryApiConfig,
      {
        statDataMessageId: assistantMessageId,
      },
    );
    if (!updateVariable?.trim()) return;

    const oldPatch = extractLastTagContent(filtered, 'UpdateVariable');
    if (oldPatch.trim() === updateVariable.trim()) {
      console.log('ℹ️ [App] 开局精炼变量：第二 API 与首轮 patch 相同，跳过写回');
      return;
    }

    if (typeof setChatMessages !== 'function') return;

    const withoutOld = filtered.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>\s*/gi, '').trim();
    const updatedMessage = `${withoutOld}\n\n<UpdateVariable>\n${updateVariable.trim()}\n</UpdateVariable>`;

    await setChatMessages([{ message_id: assistantMessageId, message: updatedMessage }], { refresh: 'affected' });

    await waitGlobalInitialized('Mvu');
    const baseId = Math.max(assistantMessageId - 1, 0);
    const base = Mvu.getMvuData({ type: 'message', message_id: baseId });

    // 首先尝试手动解析 <JSONPatch> 格式
    let parsed: Mvu.MvuData | null = null;
    const jsonPatches = extractJsonPatchFromUpdateVariable(updatedMessage);
    if (jsonPatches && base) {
      console.log('✅ [App] 开局精炼变量：检测到 <JSONPatch> 格式，手动应用变量更新...');
      parsed = JSON.parse(JSON.stringify(base));
      if (!parsed.stat_data) parsed.stat_data = {};
      applyJsonPatch(parsed.stat_data, jsonPatches);
      console.log('✅ [App] 开局精炼变量：JSON Patch 已手动应用');
    } else if (typeof Mvu?.parseMessage === 'function') {
      // 回退到 MVU 的 parseMessage
      parsed = await Mvu.parseMessage(updatedMessage, base);
    }

    if (parsed) {
      await updateVariablesWith(
        existing =>
          Object.assign({}, existing && typeof existing === 'object' ? existing : {}, parsed as object),
        { type: 'message', message_id: assistantMessageId },
      );
      scheduleWorldLifeAfterJsonPatchIfNeeded(jsonPatches, parsed.stat_data);
      scheduleResidentLifeFlushAfterStatCommit(parsed.stat_data);
    }
    console.log('✅ [App] 开局精炼变量：已应用第二遍第二 API');
  } catch (e) {
    console.warn('⚠️ [App] 开局精炼变量失败，保留首轮解析结果:', e);
  }
}

/**
 * 仅修改第 1 楼：在全文两侧加上 `</Cancel>`…`</Cancel>`（便于你在 ST 正则里自行处理）；不写 0 楼、不做 /hide。
 */
async function wrapOpeningMessage1WithCancelDelimiters(): Promise<boolean> {
  if (typeof setChatMessages !== 'function' || typeof getChatMessages !== 'function') {
    console.warn('[App] wrapOpeningMessage1Cancel：setChatMessages / getChatMessages 不可用');
    return false;
  }
  const rows = getChatMessages(1);
  if (rows.length === 0) {
    console.warn('[App] wrapOpeningMessage1Cancel：楼层 1 不存在，跳过');
    return false;
  }
  const original = String(rows[0].message ?? '');
  const wrapped = `</Cancel>${original}</Cancel>`;
  try {
    await setChatMessages([{ message_id: 1, message: wrapped }], { refresh: 'affected' });
    try {
      if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.saveChat === 'function') {
        await SillyTavern.saveChat();
      }
    } catch (saveErr) {
      console.warn('[App] wrapOpeningMessage1Cancel：saveChat 失败（1 楼已写入）:', saveErr);
    }
    console.info('[App] 开局第一回合：已对楼层 1 用 </Cancel>…</Cancel> 包裹');
    return true;
  } catch (e) {
    console.warn('[App] wrapOpeningMessage1Cancel：setChatMessages 失败:', e);
    return false;
  }
}

// 静默记录 assistant 消息到酒馆楼层
async function recordAssistantMessage(message: string) {
  try {
    if (typeof createChatMessages === 'function') {
      // 准备数据 - 使用完整 MVU 格式
      let finalData: Mvu.MvuData = { initialized_lorebooks: {}, stat_data: {}, display_data: {}, delta_data: {} };
      let baseData: Mvu.MvuData | null = null;
      try {
        baseData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        if (baseData) {
          finalData = JSON.parse(JSON.stringify(baseData));
        }
      } catch (e) {
        // 忽略错误
      }

      // 关键：解析 <UpdateVariable>，把 JSONPatch 应用到 MVU 数据中
      const jsonPatchesForAssistantRecord = extractJsonPatchFromUpdateVariable(message);
      try {
        await waitGlobalInitialized('Mvu');

        // 首先尝试解析 <JSONPatch> 格式（本界面使用的格式）
        if (jsonPatchesForAssistantRecord && baseData) {
          console.log('✅ [App] 检测到 <JSONPatch> 格式，手动应用变量更新...');
          // 确保 stat_data 结构存在
          if (!finalData.stat_data) finalData.stat_data = {};
          // 应用 JSON Patch 到 stat_data
          applyJsonPatch(finalData.stat_data, jsonPatchesForAssistantRecord);
          console.log('✅ [App] JSON Patch 已手动应用到变量数据');
        } else if (typeof Mvu?.parseMessage === 'function' && baseData) {
          // 回退到 MVU 的 parseMessage（处理 _.set() 格式）
          const parsed = await Mvu.parseMessage(message, baseData);
          if (parsed && typeof parsed === 'object') {
            finalData = parsed;  // 使用解析后的完整 MVU 数据
          }
        }
      } catch (e) {
        console.warn('⚠️ [App] 解析 <UpdateVariable> 失败，将使用原始变量数据写入:', e);
      }

      if (jsonPatchesForAssistantRecord?.length && baseData && finalData.stat_data) {
        scheduleWorldLifeAfterJsonPatchIfNeeded(jsonPatchesForAssistantRecord, finalData.stat_data);
      }
      scheduleResidentLifeFlushAfterStatCommit(finalData.stat_data);

      await createChatMessages(
        [
          {
            role: 'assistant',
            message: message,
            data: finalData,  // 发送完整 MVU 格式
          },
        ],
        { refresh: 'none' },
      );
      console.log('✅ [App] 已静默记录到酒馆楼层');

      // 更新编年史
      try {
        const { checkAndUpdateChronicle } = await import('./utils/chronicleUpdater');
        await checkAndUpdateChronicle();
      } catch (e) {
        console.warn('⚠️ [App] 更新编年史失败:', e);
      }
    }
  } catch (e) {
    console.warn('⚠️ [App] 记录到酒馆楼层失败:', e);
  }
}

/** 挂载时唯一入口：从 localStorage 加载 uiLayout */
function loadUiLayoutFromStorage(): void {
  try {
    const saved = loadUiLayout();
    uiLayout.value = {
      ...uiLayout.value,
      ...saved,
    };

    // 数值安全校验
    const safeScale = Number(uiLayout.value.scale);
    const safeMaxWidth = Number(uiLayout.value.maxWidth);
    const safeMaxHeight = Number(uiLayout.value.maxHeight);
    uiLayout.value.scale = Number.isFinite(safeScale) ? Math.min(1.3, Math.max(0.8, safeScale)) : 0.8;
    uiLayout.value.maxWidth = Number.isFinite(safeMaxWidth) ? clampMainUiWidthPx(safeMaxWidth) : 900;
    uiLayout.value.maxHeight = clampMainUiHeightPx(safeMaxHeight);

    console.log('✅ [App] uiLayout 从 localStorage 加载成功:', uiLayout.value);
  } catch (e) {
    console.warn('⚠️ [App] 从 localStorage 读取 uiLayout 失败:', e);
    uiLayout.value.maxHeight = 600; // 出错也给个兜底值，避免 auto 无限撑高
  }
}

// 检查游戏阶段
async function checkGamePhase() {
  try {
    loadUiLayoutFromStorage();

    const lastMessageId = getLastMessageId();
    console.log('📊 [App] 当前楼层数:', lastMessageId);

    if (lastMessageId === 0 || isNewGame()) {
      // 新游戏，显示开局表单
      console.log('🎮 [App] 检测到新游戏，显示开局表单');
      gamePhase.value = GamePhase.OPENING;
    } else {
      // 已有游戏进度，直接进入游戏
      console.log('🎮 [App] 检测到已有游戏，进入游戏界面');
      gamePhase.value = GamePhase.GAME;

      // 修正历史遗留的变量套娃：stat_data.stat_data -> stat_data
      await normalizeLatestChineseStatData();
      // 加载最新消息内容
      const result = loadFromLatestMessage();
      if (result.maintext) {
        mainText.value = result.maintext;
        options.value = result.options;
        currentMessageId.value = result.messageId;
        currentMessageInfo.value = {
          messageId: result.messageId,
          userMessageId: result.userMessageId,
          fullMessage: result.fullMessage,
        };
        console.log('✅ [App] 已加载最新消息:', result.messageId);
      }
    }
  } catch (error) {
    console.error('❌ [App] 检测游戏阶段失败，默认显示开局表单:', error);
    gamePhase.value = GamePhase.OPENING;
  }
}

/**
 * 兼容修正：把 stat_data.stat_data 里的中文结构提升到 stat_data 根下
 * 解决「变量套娃导致前端不显示」的问题。
 */
async function normalizeLatestChineseStatData(): Promise<void> {
  try {
    const vars = getVariables({ type: 'message', message_id: 'latest' }) as any;
    if (!vars || typeof vars !== 'object') return;
    if (!vars.stat_data || typeof vars.stat_data !== 'object') return;

    const nested = vars.stat_data.stat_data;
    if (!nested || typeof nested !== 'object') return;

    const keys = ['游戏状态', '世界规则', '区域规则', '个人规则', '角色档案', '元信息'] as const;
    let moved = 0;

    for (const k of keys) {
      if (nested[k] == null) continue;

      const rootVal = vars.stat_data[k];
      const nestedVal = nested[k];

      if (rootVal == null) {
        vars.stat_data[k] = nestedVal;
        moved += 1;
      } else if (typeof rootVal === 'object' && rootVal && typeof nestedVal === 'object' && nestedVal) {
        // 根已存在则合并，避免覆盖已有字段
        vars.stat_data[k] = { ...nestedVal, ...rootVal };
        moved += 1;
      }
    }

    delete vars.stat_data.stat_data;

    if (moved > 0) {
      await updateVariablesWith(
        existing => Object.assign({}, existing && typeof existing === 'object' ? existing : {}, vars),
        { type: 'message', message_id: 'latest' },
      );
      console.log(`✅ [App] 已修正最新楼层变量套娃，提升字段数: ${moved}`);
    }
  } catch (e) {
    console.warn('⚠️ [App] 修正最新楼层变量套娃失败:', e);
  }
}

// 处理开局表单提交（改为和正常发消息一样的标签校验流程）
async function handleOpeningSubmit(formData: OpeningFormData) {
  if (isInitializing.value) return;

  let unsubscribeStream: (() => void) | null = null;
  const releaseOpeningStream = () => {
    if (unsubscribeStream) {
      try {
        unsubscribeStream();
      } catch {
        /* 流式监听已释放或宿主不支持 */
      }
      unsubscribeStream = null;
    }
  };

  /** 开场白流程失败：删本回合 user 楼层、回到开局界面，避免只剩玩家楼层却被判为「已在游戏中」 */
  const abortOpeningInit = async (toastMessage: string, logError?: unknown) => {
    releaseOpeningStream();
    hideSecondaryApiBanner();
    if (pendingUserMessageId.value != null && typeof deleteChatMessages === 'function') {
      try {
        await deleteChatMessages([pendingUserMessageId.value], { refresh: 'none' });
        console.log('✅ [App] 已删除失败的开局 user 楼层:', pendingUserMessageId.value);
      } catch (e) {
        console.warn('⚠️ [App] 删除开局 user 楼层失败:', e);
      }
    }
    pendingUserMessageId.value = null;
    isOpeningPhase.value = false;
    isGenerating.value = false;
    isGeneratingOpening.value = false;
    isInitializing.value = false;
    openingGenerationId.value = '';
    streamTextBuffer.value = '';
    mainText.value = '';
    options.value = [];
    gamePhase.value = GamePhase.OPENING;
    if (openingFormRef.value) {
      openingFormRef.value.resetSubmitState();
    }
    if (logError !== undefined) {
      console.error('❌ [App] 游戏初始化失败:', logError);
    }
    toastr.error(toastMessage);
  };

  isInitializing.value = true;
  openingMessage1CancelWrapDone.value = false; // 新开局允许第一回合标签确认后再包裹一次 1 楼
  isOpeningPhase.value = true; // 标记为开局流程
  console.log('🎮 [App] 开始初始化游戏...', formData);

  // 检测当前输出模式
  let isDualMode = false;
  let secondaryApiConfig: any = null;
  try {
    const { getCurrentOutputMode, getSecondaryApiConfig } = await import('./utils/apiSettings');
    isDualMode = getCurrentOutputMode() === 'dual';
    if (isDualMode) {
      secondaryApiConfig = getSecondaryApiConfig();
      console.log(`🔄 [App] 开局流程：双API模式已启用`);
    }
  } catch (error) {
    console.warn('⚠️ [App] 检测输出模式失败:', error);
  }

  try {
    // 1. 初始化游戏变量（写入0层）
    console.log('🎮 [App] 步骤1: 初始化游戏变量...');
    const initSuccess = await initializeGameVariables(formData);
    if (!initSuccess) {
      console.error('❌ [App] 初始化游戏变量失败，但继续进入游戏');
    } else {
      console.log('✅ [App] 游戏变量初始化成功');
    }

    // 2. 获取开局提示词内容（由 App 单独写入 user 楼层，不在 gameInitializer 重复创建）
    console.log('🎮 [App] 步骤2: 准备开局提示词...');
    const storyResult = await createOpeningStoryMessage(formData);
    if (!storyResult.success || !String(storyResult.promptContent ?? '').trim()) {
      console.error('❌ [App] 开局提示词准备失败');
      await abortOpeningInit('开局提示词准备失败，请检查后重试');
      return;
    }
    console.log('✅ [App] 开局提示词准备完成');

    if (typeof generate !== 'function') {
      await abortOpeningInit('当前环境无法调用 AI 生成，请检查酒馆助手');
      return;
    }

    // 3. 触发 AI 生成开场白（和正常发消息一样的流程）
    console.log('🎮 [App] 步骤3: 触发 AI 生成开场白...');
    isGenerating.value = true;
    isGeneratingOpening.value = true;
    openingSecondaryApiPhase.value = false;
    openingGenerationId.value = `opening-${Date.now()}`;

    const userPrompt = storyResult.promptContent || '';
    console.log('📝 [App] 发送给 AI 的提示词:', userPrompt.substring(0, 300) + '...');

    // 注册流式监听（和 sendMessage 一样）
    if (typeof eventOn === 'function' && typeof iframe_events !== 'undefined') {
      const streamHandler = (text: string) => {
        streamTextBuffer.value = text;
        let isThinkingComplete = false;
        const isFilteringComplete = (t: string) => {
          const thinkingOpen = (t.match(/<thinking>/gi) || []).length;
          const thinkingClose = (t.match(/<\/thinking>/gi) || []).length;
          return thinkingOpen > 0 && thinkingOpen === thinkingClose;
        };
        if (!isThinkingComplete) {
          isThinkingComplete = isFilteringComplete(text);
          if (!isThinkingComplete) {
            mainText.value = 'AI 正在思考...';
            return;
          }
        }
        const filteredText = extractFilteredContent(text);
        const parsed = parseMaintext(filteredText);
        if (parsed) {
          mainText.value = parsed;
        }
      };
      try {
        const result = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, streamHandler);
        if (result && typeof result === 'object' && typeof result.stop === 'function') {
          unsubscribeStream = result.stop;
        }
      } catch (err) {
        console.error('❌ [App] 注册流式事件监听失败:', err);
      }
    }

    // 先将用户输入写入聊天楼层（便于重 roll）
    // 发送完整 MVU 格式，统一数据格式
    if (typeof createChatMessages === 'function') {
      let mvuData = { stat_data: {}, display_data: {}, delta_data: {} };
      try {
        const baseData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        if (baseData) {
          mvuData = baseData;
        }
      } catch (e) { /* 忽略 */ }
      const openingUserBaseMvu = mvuData as Mvu.MvuData;
      await createChatMessages(
        [{ role: 'user', message: userPrompt, data: mvuData }],
        { refresh: 'none' },
      );
      await new Promise(r => setTimeout(r, 50));
      pendingUserMessageId.value = getLastMessageId();
      console.log('✅ [App] 已写入开局 user 消息，message_id:', pendingUserMessageId.value);
      // 主动通知小手机壳触发剧情摘要同步
      try {
        window.parent.postMessage({ type: 'tavern-phone:request-trigger-game-story-sync' }, '*');
      } catch (e) {
        console.warn('⚠️ [App] 通知小手机壳失败:', e);
      }
      const ouid = pendingUserMessageId.value;
      if (ouid != null) {
        await applyMvuParseToMessageFloor(userPrompt, openingUserBaseMvu, ouid);
      }
    }

    // 调用 generate
    aiGenerationStartMs.value = Date.now();
    let result = await generate({
      user_input: userPrompt,
      should_stream: true,
      generation_id: openingGenerationId.value,
    });
    console.log('✅ [App] generate 完成，结果长度:', result?.length || 0);

    // 双API模式：第二 API 变量 + 可选正文美化
    if (isDualMode && result && isSecondaryApiConfigured(secondaryApiConfig)) {
      try {
        const { mergeSecondaryPipelineIntoAssistantText } = await import('./utils/apiSettings');
        const openingStatMid =
          pendingUserMessageId.value != null && pendingUserMessageId.value !== undefined
            ? pendingUserMessageId.value
            : 'latest';
        result = await mergeSecondaryPipelineIntoAssistantText(result, secondaryApiConfig, {
          statDataMessageId: openingStatMid,
        });
        console.log('✅ [App] 开局流程：第二 API 合并完成');
      } catch (error) {
        console.error('❌ [App] 开局流程：第二API处理失败:', error);
      }
    }

    // 清理流式监听（generate 已结束，避免 abort 时重复 unsubscribe）
    releaseOpeningStream();

    // 验证结果
    if (!result || result.trim().length === 0) {
      throw new Error('生成结果为空');
    }

    // 关闭 loading 弹窗，避免遮挡标签验证弹窗
    isGeneratingOpening.value = false;
    isGenerating.value = false;

    // 打开标签验证弹窗（和正常发消息一样）
    const filteredResult = extractFilteredContent(result);
    openTagValidationDialog(filteredResult);
    return; // 等待用户点击确认或回退，不立即进入游戏
  } catch (error) {
    await abortOpeningInit('游戏初始化失败: ' + String(error), error);
  } finally {
    // 正常流程（弹出标签验证窗）时，由弹窗按钮处理状态重置
    if (!isTagDialogOpen.value) {
      isGeneratingOpening.value = false;
      isGenerating.value = false;
      isInitializing.value = false;
    }
  }
}

// 组件挂载时加载消息并监听事件
let unsubscribeMessageUpdate: any = null;
let unsubscribeChatChange: (() => void) | null = null;
let unsubscribeGameStorySync: (() => void) | null = null;

watch(
  () => gamePhase.value,
  (phase) => {
    if (phase === GamePhase.GAME) {
      setTimeout(() => maybeOfferOrphanUserFloorFix(), 500);
    }
    if (phase !== GamePhase.OPENING) {
      openingSettingsOpen.value = false;
    }
  },
);

watch(isGeneratingOpening, (v) => {
  if (!v) openingSecondaryApiPhase.value = false;
});

/**
 * 监听小手机壳转发的剧情摘要同步触发消息
 * 当规则 App 发送消息后，小手机壳会通过 GAME_STORY_WB_SYNC_TRIGGERED 消息通知规则 App
 * 触发剧情摘要同步到世界书「编年史」
 */
function onGameStorySyncMessage(event: MessageEvent) {
  const msg = event.data;
  if (msg?.type === 'tavern-phone:game-story-wb-sync-triggered') {
    console.info('📡 [App] 收到小手机壳转发的剧情同步触发，开始同步剧情到世界书...');
    void (async () => {
      const { syncGameStoryToWorldbook } = await import('./utils/dialogAndVariable');
      await syncGameStoryToWorldbook();
    })();
  }
}

/** 小手机壳中继：与 Vite 手机页跨端口同步浏览器头像覆盖 */
function onCharacterAvatarParentMessage(event: MessageEvent) {
  if (event.source !== window.parent) {
    return;
  }
  const msg = event.data;
  if (msg?.type === PHONE_CHARACTER_AVATAR_SYNC_TYPE) {
    const roleId = typeof msg.roleId === 'string' ? msg.roleId.trim() : '';
    if (!roleId) {
      return;
    }
    applyCharacterAvatarOverrideLocal(roleId, typeof msg.avatarUrl === 'string' ? msg.avatarUrl : '');
  }
}

function onPageShowStaleUserCheck() {
  if (gamePhase.value === GamePhase.GAME) {
    setTimeout(() => maybeOfferOrphanUserFloorFix(), 400);
  }
}

function onSecondaryApiStartEvent(ev: Event) {
  const custom = ev as CustomEvent<SecondaryApiStartDetail>;
  const detail = custom.detail ?? {};
  const attempt = detail.attempt;
  const scope = detail.scope ?? 'variable_update';
  if (isGeneratingOpening.value) {
    openingSecondaryApiPhase.value = true;
    // 开局全屏遮罩已提示「正在解析变量」，不再叠顶栏横幅
    return;
  }
  if (scope === 'tactical_map') {
    secondaryApiBannerScope.value = 'tactical';
    secondaryApiBannerText.value = detail.message?.trim() || 'AI 正在处理地图请求…';
  } else {
    secondaryApiBannerScope.value = 'variable';
    const customMsg = detail.message?.trim();
    secondaryApiBannerText.value =
      customMsg ||
      (attempt != null && attempt > 1
        ? `第二 API 重试中（第 ${attempt} 次），可先阅读正文。`
        : '第二 API 正在生成变量更新，可先阅读正文。');
  }
  secondaryApiBannerVisible.value = true;
}

function onSecondaryApiEndEvent(ev: Event) {
  const custom = ev as CustomEvent<SecondaryApiEndDetail>;
  const scope = custom.detail?.scope ?? 'tactical_map';
  if (scope === 'tactical_map' && secondaryApiBannerScope.value === 'tactical') {
    hideSecondaryApiBanner();
  }
}

onMounted(() => {
  // 等待 store 数据就绪
  const store = useDataStore();
  rulesMvuArchiveReadOnly.value = !isRulesMvuLiveHostAtInit();
  let unwatch: (() => void) | null = null;

  // 先检查一次数据
  const checkData = () => {
    const newData = store.data;
    const hasData = newData && (
      (newData.角色档案 && Object.keys(newData.角色档案).length > 0) ||
      (newData.世界规则 && Object.keys(newData.世界规则).length > 0) ||
      (newData.openingConfig?.selectedRules?.length > 0)
    );
    if (hasData) {
      isStoreReady.value = true;
      showMvuMissingTip.value = false;
      if (unwatch) {
        unwatch();
        unwatch = null;
      }
      console.log('✅ [App] Store 数据就绪');
      return true;
    } else {
      // 数据缺失，显示提示（除非用户已关闭）
      if (!mvuMissingTipDismissed.value) {
        showMvuMissingTip.value = true;
      }
      return false;
    }
  };

  // 立即检查一次
  if (!checkData()) {
    // 如果数据还没准备好，启动 watch 监听变化
    unwatch = watch(
      () => store.data,
      () => {
        checkData();
      },
      { deep: true }
    );
  }

  // 检查游戏阶段并加载内容（内含唯一一次 loadUiLayoutFromStorage）
  void checkGamePhase();

  // 监听全屏变化事件
  document.addEventListener('fullscreenchange', onFullscreenChange);
  // 监听工具层发来的“写入前端对话框”事件
  window.addEventListener('th:copy-to-input', onCopyToInputEvent as EventListener);
  window.addEventListener(SECONDARY_API_START_EVENT, onSecondaryApiStartEvent);
  window.addEventListener(SECONDARY_API_END_EVENT, onSecondaryApiEndEvent);

  // 监听酒馆消息更新事件（用于检测外部消息变化，如分支切换）
  try {
    if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined') {
      unsubscribeMessageUpdate = eventOn(tavern_events.MESSAGE_RECEIVED, () => {
        console.log('📨 [App] 收到新消息事件，刷新内容...');
        // 如果不在生成中，才刷新（避免覆盖正在流式显示的内容）
        if (!isGenerating.value) {
          loadMessageContent();
          maybeOfferOrphanUserFloorFix();
        }
      });
    }
  } catch (e) {
    console.warn('⚠️ [App] 无法监听消息事件:', e);
  }

  // 切换聊天文件后重新检测末尾楼层
  try {
    if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined') {
      unsubscribeChatChange = eventOn(tavern_events.CHAT_CHANGED, () => {
        orphanUserFloorDismissedMid.value = null;
        orphanUserFloorDialogOpen.value = false;
        setTimeout(() => maybeOfferOrphanUserFloorFix(), 500);
      });
    }
  } catch (e) {
    console.warn('⚠️ [App] 无法监听 CHAT_CHANGED:', e);
  }

  // 监听小手机壳转发的剧情摘要同步触发消息
  window.addEventListener('message', onGameStorySyncMessage);
  window.addEventListener('message', onCharacterAvatarParentMessage);
  if (window.parent !== window) {
    try {
      window.parent.postMessage({ type: PHONE_CHARACTER_AVATAR_MIRROR_REQUEST }, '*');
    } catch {
      /* */
    }
  }

  window.addEventListener('pageshow', onPageShowStaleUserCheck);

  console.log('✅ [App] 同层前端界面挂载完成');
});

onUnmounted(() => {
  // 清理事件监听
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  window.removeEventListener('th:copy-to-input', onCopyToInputEvent as EventListener);
  window.removeEventListener(SECONDARY_API_START_EVENT, onSecondaryApiStartEvent);
  window.removeEventListener(SECONDARY_API_END_EVENT, onSecondaryApiEndEvent);
  window.removeEventListener('pageshow', onPageShowStaleUserCheck);
  window.removeEventListener('message', onCharacterAvatarParentMessage);
  hideSecondaryApiBanner();
  if (typeof unsubscribeMessageUpdate === 'function') {
    unsubscribeMessageUpdate();
  }
  if (typeof unsubscribeChatChange === 'function') {
    unsubscribeChatChange();
  }
  if (typeof unsubscribeGameStorySync === 'function') {
    unsubscribeGameStorySync();
  }
  stopIframeHeightFix?.();
  stopIframeHeightFix = null;
  lastIframeMinHeightApplied = null;
});
</script>

<style lang="scss" scoped>
// 导入赛博朋克全局样式
@use './styles/cyber-effects' as *;
@use './styles/cyber-neon-mixins' as *;

// 第二 API 处理变量：全宽黄色提示条（游戏内保持至标签检核弹窗打开）
.secondary-api-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px;
  min-height: 44px;
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #422006;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
  background: linear-gradient(90deg, #fcd34d 0%, #fbbf24 42%, #f59e0b 100%);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
  border-bottom: 1px solid rgba(120, 53, 15, 0.22);
  pointer-events: none;
}

.secondary-api-banner-tx-enter-active,
.secondary-api-banner-tx-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}

.secondary-api-banner-tx-enter-from,
.secondary-api-banner-tx-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

// MVU 缺失提示条：全宽置顶、实心底、关闭按钮高对比
.mvu-missing-tip {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px calc(16px * var(--ui-scale, 1));
  min-height: 44px;
  box-sizing: border-box;
  border-radius: 0;
  font-size: calc(13px * var(--ui-scale, 1));
  line-height: 1.4;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  animation: slideDown 0.25s ease;

  .tip-content {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;

    i {
      flex-shrink: 0;
      font-size: calc(16px * var(--ui-scale, 1));
    }
  }

  // 深色模式：实心琥珀底
  &.dark {
    background: #854d0e;
    border: none;
    border-bottom: 2px solid #ca8a04;
    color: #fffbeb;

    .tip-content i {
      color: #fde047;
    }
  }

  // 浅色模式：实心浅琥珀底
  &.light {
    background: #fef3c7;
    border: none;
    border-bottom: 2px solid #f59e0b;
    color: #713f12;

    .tip-content i {
      color: #b45309;
    }
  }
}

.mvu-missing-tip__close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
  font-size: calc(16px * var(--ui-scale, 1));

  &:active {
    transform: scale(0.96);
  }

  &.dark {
    border: 2px solid rgba(255, 255, 255, 0.65);
    background: rgba(0, 0, 0, 0.35);
    color: #fff;

    &:hover {
      background: rgba(0, 0, 0, 0.5);
      border-color: #fff;
    }
  }

  &.light {
    border: 2px solid #b45309;
    background: #fff;
    color: #78350f;

    &:hover {
      background: #fff7ed;
      border-color: #92400e;
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

// MVU 缺失弹窗
.mvu-missing-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 10000;
}

.mvu-missing-modal {
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  animation: modalPop 0.3s ease;

  &.dark {
    background: #1a1a1f;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e4e4e7;

    .modal-header {
      background: rgba(234, 179, 8, 0.15);
      border-bottom: 1px solid rgba(234, 179, 8, 0.2);

      i {
        color: #fbbf24;
      }
    }

    .suggestion {
      color: #fbbf24;
    }

    .btn-primary {
      background: linear-gradient(135deg, #a855f7, #06b6d4);
      color: #fff;

      &:hover {
        opacity: 0.9;
      }
    }
  }

  &.light {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #18181b;

    .modal-header {
      background: rgba(251, 191, 36, 0.2);
      border-bottom: 1px solid rgba(251, 191, 36, 0.3);

      i {
        color: #d97706;
      }
    }

    .suggestion {
      color: #d97706;
    }

    .btn-primary {
      background: linear-gradient(135deg, #a855f7, #06b6d4);
      color: #fff;

      &:hover {
        opacity: 0.9;
      }
    }
  }
}

@keyframes modalPop {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.mvu-missing-modal .modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;

  i {
    font-size: 20px;
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
}

.mvu-missing-modal .modal-body {
  padding: 20px;

  p {
    margin: 0 0 12px 0;
    line-height: 1.6;
    font-size: 14px;
  }

  .suggestion {
    font-weight: 600;
    margin-bottom: 8px;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
    line-height: 1.8;

    li {
      margin-bottom: 4px;
    }
  }
}

.mvu-missing-modal .modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(128, 128, 128, 0.2);

  button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &.btn-primary {
      background: linear-gradient(135deg, #a855f7, #06b6d4);
      color: #fff;

      &:hover {
        opacity: 0.9;
      }
    }
  }
}

.rule-modifier {
  display: flex;
  width: 100%;
  height: var(--ui-max-height, 100%);
  max-width: var(--ui-max-width, 900px);
  max-height: var(--ui-max-height, 100%);
  margin: 0 auto;
  overflow: hidden;
  // MVU 顶栏占位，避免正文与侧栏被 fixed 条挡住（与 .mvu-missing-tip min-height 一致）
  &.has-mvu-missing-tip {
    padding-top: 44px;
    box-sizing: border-box;
  }
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: calc(14px * var(--ui-scale, 1));
  line-height: 1.5;
  // 布局水合前给个平滑过渡，避免从 auto 到固定值的硬跳
  transition: opacity 120ms ease, height 120ms ease;

  // 全局CSS变量，用于整体UI缩放
  --space-xs: calc(4px * var(--ui-scale, 1));
  --space-sm: calc(8px * var(--ui-scale, 1));
  --space-md: calc(12px * var(--ui-scale, 1));
  --space-lg: calc(16px * var(--ui-scale, 1));
  --space-xl: calc(24px * var(--ui-scale, 1));
  --space-2xl: calc(32px * var(--ui-scale, 1));
  --radius-sm: calc(6px * var(--ui-scale, 1));
  --radius-md: calc(8px * var(--ui-scale, 1));
  --radius-lg: calc(12px * var(--ui-scale, 1));
  --radius-xl: calc(16px * var(--ui-scale, 1));
  --sidebar-width: calc(80px * var(--ui-scale, 1));
  --sidebar-width-wide: calc(240px * var(--ui-scale, 1));
  --middle-panel-width: calc(700px * var(--ui-scale, 1));

  @media (min-width: 1024px) {
    --sidebar-width: var(--sidebar-width-wide);
  }

  &.dark {
    background: var(--color-cyber-bg);
    color: #e4e4e7;
    font-family: var(--font-cyber-sans);
  }

  &.light {
    background: #f4f4f5;
    color: #18181b;
  }

  // 布局尚未水合：先用最小高度撑住，并微微透明减少视觉存在感
  &.layout-pending {
    min-height: 600px;
    opacity: 0.85;
  }

  // 区域规则「地图」：中间栏占满侧栏右侧全部宽度，正文区暂隐以腾出画布
  &.layout-regional-map-bleed {
    .main-panel {
      display: none !important;
    }

    .middle-panel {
      flex: 1 1 auto !important;
      width: auto !important;
      min-width: 0;
      max-width: none;
      height: 100%;
      max-height: none;
      align-self: stretch;
    }

    .panel-inner {
      width: 100% !important;
      max-width: none;
    }
  }
}

// Sidebar
.sidebar {
  position: relative;
  width: var(--sidebar-width);
  height: 100%;
  max-height: var(--ui-max-height, 600px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}

.dark .sidebar {
  border-color: rgba(0, 243, 255, 0.12);
  background: linear-gradient(180deg, rgba(17, 17, 17, 0.58) 0%, rgba(5, 5, 5, 0.82) 100%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: inset -1px 0 0 rgba(176, 38, 255, 0.08);
}

.light .sidebar {
  border-color: rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.6);
}

.sidebar-top {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .logo {
    position: relative;
    z-index: 1;
    height: calc(80px * var(--ui-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    gap: var(--space-md);
    padding: 0 var(--space-xl);

    i {
      font-size: calc(24px * var(--ui-scale, 1));
    }

    .logo-text {
      display: none;
      font-weight: 600;
      letter-spacing: 0.15em;
      font-size: calc(16px * var(--ui-scale, 1));

      @media (min-width: 1024px) {
        display: block;
      }
    }
  }

  .nav-items {
    position: relative;
    z-index: 1;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    gap: var(--space-sm);

    .nav-items-bottom-spacer {
      margin-top: auto;
      padding-top: var(--space-md);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }
  }
}

.dark .sidebar-top .logo {
  border-color: rgba(255, 255, 255, 0.05);
  color: #f4f4f5;
}

.light .sidebar-top .logo {
  border-color: rgba(0, 0, 0, 0.05);
  color: #18181b;
}

.light .sidebar-top .nav-items .nav-items-bottom-spacer {
  border-top-color: rgba(0, 0, 0, 0.05);
}

.nav-btn {
  display: flex;
  align-items: center;
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  transition: all 0.3s ease;
  position: relative;
  background: transparent;
  border: none;
  cursor: pointer;
  gap: var(--space-md);
  width: 100%;

  i {
    font-size: calc(18px * var(--ui-scale, 1));
    width: calc(24px * var(--ui-scale, 1));
    text-align: center;
  }

  .nav-label {
    display: none;
    font-size: calc(14px * var(--ui-scale, 1));
    font-weight: 500;

    @media (min-width: 1024px) {
      display: block;
    }
  }

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    background: rgba(255, 255, 255, 0.1);

    .active-indicator {
      position: absolute;
      left: 0;
      width: calc(4px * var(--ui-scale, 1));
      height: calc(32px * var(--ui-scale, 1));
      background: currentColor;
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    }
  }
}

.dark .nav-btn {
  color: #a1a1aa;

  &:hover {
    color: #e4e4e7;
    background: rgba(0, 243, 255, 0.06);
  }

  &.active {
    color: #fff;
    background: rgba(0, 243, 255, 0.08);
    box-shadow: 0 0 18px rgba(0, 243, 255, 0.12);

    .active-indicator {
      background: linear-gradient(180deg, var(--color-neon-cyan), var(--color-neon-purple));
      box-shadow: 0 0 12px rgba(0, 243, 255, 0.45);
    }
  }
}

.light .nav-btn {
  color: #71717a;

  &:hover {
    color: #18181b;
    background: rgba(0, 0, 0, 0.05);
  }

  &.active {
    color: #000;
    background: rgba(0, 0, 0, 0.05);
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.05);
  }
}

// Middle Panel
.middle-panel {
  width: var(--middle-panel-width);
  height: 100%;
  max-height: var(--ui-max-height, 600px);
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 0 calc(40px * var(--ui-scale, 1)) rgba(0, 0, 0, 0.3);
  z-index: 20;
  animation: slideIn 0.3s ease;
}

.opening-settings-scrim {
  position: fixed;
  inset: 0;
  /* 低于 .opening-settings-drawer(110)，否则会挡住侧栏、点击穿透关闭 */
  z-index: 85;
  /* 轻压暗即可；过深时在深色开局页上会像整屏全黑 */
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: none;
}

// 开局界面无 #app-root 侧栏时，设置抽屉固定于视口左侧（与主界面中间面板同宽）
// 用 top/bottom 拉满 iframe 视口，勿用 100vh/100dvh（嵌套 iframe 里 vh 常错位导致超长滚动）
.opening-settings-drawer {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  right: auto;
  /* 高于 scrim(85) 与手机端 .middle-panel(60)，保证可点击 */
  z-index: 110;
  height: auto;
  max-height: none;
  width: min(calc(700px * var(--ui-scale, 1)), 92vw);
  --middle-panel-width: min(calc(700px * var(--ui-scale, 1)), 92vw);
  backdrop-filter: none;
  pointer-events: auto;
  /* 覆盖 .middle-panel 的 slideIn（transform 与 fixed 同元素易出怪相） */
  animation: none;

  &.dark {
    @include cyber-card-surface;
    border-right: 1px solid rgba(0, 243, 255, 0.1);
    box-shadow:
      8px 0 28px rgba(0, 0, 0, 0.45),
      0 0 32px rgba(176, 38, 255, 0.08);
    /* mixin 含 position:relative，会盖掉外层 fixed，侧栏会掉进文档流排到页面底部 */
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    right: auto;
    z-index: 110;
  }

  &.light {
    background: #f4f4f5;
    box-shadow: 8px 0 32px rgba(0, 0, 0, 0.12);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.dark .middle-panel {
  @include cyber-card-surface;
  border-right: 1px solid rgba(0, 243, 255, 0.1);
  box-shadow:
    0 0 calc(40px * var(--ui-scale, 1)) rgba(0, 0, 0, 0.45),
    0 0 28px rgba(176, 38, 255, 0.07);
}

.light .middle-panel {
  background: #f4f4f5;
  border-color: rgba(0, 0, 0, 0.08);
}

.panel-inner {
  width: var(--middle-panel-width);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  height: calc(80px * var(--ui-scale, 1));
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 calc(40px * var(--ui-scale, 1));
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: sticky;
  top: 0;
  z-index: 10;

  h1 {
    font-size: calc(24px * var(--ui-scale, 1));
    font-weight: 300;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: calc(8px * var(--ui-scale, 1));

    .version-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: calc(11px * var(--ui-scale, 1));
      font-weight: 600;
      min-width: calc(20px * var(--ui-scale, 1));
      max-width: min(200px, 40vw);
      min-height: calc(20px * var(--ui-scale, 1));
      padding: 0 calc(6px * var(--ui-scale, 1));
      border-radius: 4px;
      background: linear-gradient(135deg, #a855f7, #06b6d4);
      color: #fff;
      letter-spacing: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .close-btn {
    padding: var(--space-sm);
    border-radius: 50%;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
}

.dark .panel-header {
  background: #1f1f23;
  border-color: rgba(255, 255, 255, 0.14);
  color: #fafafa;

  h1 {
    font-weight: 500;
  }

  .close-btn {
    color: #a1a1aa;

    &:hover {
      color: #fff;
    }
  }
}

.light .panel-header {
  border-color: rgba(0, 0, 0, 0.08);
  color: #18181b;
  background: #f4f4f5;

  .close-btn {
    color: #71717a;

    &:hover {
      color: #18181b;
    }
  }
}

.panel-content {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-xl) calc(40px * var(--ui-scale, 1));
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;

  /* 嵌套的面板组件应该占满高度并处理滚动 */
  & > * {
    flex: 1 1 auto;
    min-height: 0;
    max-height: 100%;
  }

  &.panel-content--map-bleed {
    padding: 0.5rem calc(12px * var(--ui-scale, 1)) 0.75rem;
    overflow: hidden;
  }
}

.panel-tab-page {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dark .panel-content {
  background:
    radial-gradient(ellipse 100% 45% at 50% 0%, rgba(0, 243, 255, 0.06) 0%, transparent 55%),
    linear-gradient(168deg, #26262e 0%, #1c1c22 38%, #141418 100%);
  box-shadow: inset 0 1px 0 rgba(0, 243, 255, 0.06);
}

.light .panel-content {
  background: #f4f4f5;
}

.phone-placeholder-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 200px;
}

.phone-placeholder-text {
  font-size: calc(16px * var(--ui-scale, 1));
  font-weight: 500;
  margin: 0;
  letter-spacing: 0.02em;
}

.dark .phone-placeholder-text {
  color: #a1a1aa;
}

.light .phone-placeholder-text {
  color: #71717a;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(15px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-15px);
}

// Main Panel
.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
  overflow: hidden;
  height: 100%;
  max-height: var(--ui-max-height, 600px);
}

.dark .main-panel {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-left: 1px solid rgba(0, 243, 255, 0.08);
  background: linear-gradient(160deg, rgba(17, 17, 17, 0.45) 0%, rgba(5, 5, 5, 0.92) 50%, var(--color-cyber-bg) 100%);
  box-shadow: inset 0 0 80px rgba(0, 243, 255, 0.04);
}

.light .main-panel {
  background: #fafafa;
}

.main-header {
  position: relative;
  height: calc(80px * var(--ui-scale, 1));
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 calc(32px * var(--ui-scale, 1));
  overflow: hidden;

  .header-title {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--space-md);

    i {
      font-size: calc(24px * var(--ui-scale, 1));
    }

    h2 {
      font-size: calc(18px * var(--ui-scale, 1));
      font-weight: 500;
      letter-spacing: 0.05em;
    }
  }
}

.dark .main-header {
  @include cyber-card-surface;
  border-bottom-color: rgba(0, 243, 255, 0.15);
  background: linear-gradient(90deg, rgba(17, 17, 17, 0.5) 0%, rgba(5, 5, 5, 0.65) 100%);

  .header-title {
    i { color: var(--color-neon-cyan); }
    h2 {
      color: #fff;
      font-family: var(--font-cyber-display);
      letter-spacing: 0.08em;
    }
  }
}

.light .main-header {
  border-color: rgba(0, 0, 0, 0.05);

  .header-title {
    i { color: #52525b; }
    h2 { color: #18181b; }
  }
}

.variable-persist-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) calc(20px * var(--ui-scale, 1));
  font-size: calc(12px * var(--ui-scale, 1));
  line-height: 1.45;
  border-bottom: 1px solid transparent;

  i {
    flex-shrink: 0;
    font-size: calc(14px * var(--ui-scale, 1));
  }
}

.variable-persist-banner.dark {
  background: rgba(234, 179, 8, 0.12);
  border-bottom-color: rgba(250, 204, 21, 0.25);
  color: #fde68a;
}

.variable-persist-banner.light {
  background: rgba(251, 191, 36, 0.18);
  border-bottom-color: rgba(245, 158, 11, 0.35);
  color: #92400e;
}

.header-btn {
  background: transparent;
  border: none;
  font-size: calc(20px * var(--ui-scale, 1));
  cursor: pointer;
  transition: color 0.2s;
}

.dark .header-btn {
  color: #71717a;

  &:hover { color: #fff; }
}

.light .header-btn {
  color: #a1a1aa;

  &:hover { color: #18181b; }
}

.header-actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: var(--space-sm);
}

.header-btn.active {
  color: #3b82f6;
}

.dark .header-btn.active {
  color: #60a5fa;
}

.light .header-btn.active {
  color: #2563eb;
}

.header-btn-recover {
  color: #f59e0b;
}

.dark .header-btn-recover {
  color: #fbbf24;

  &:hover {
    color: #fde68a;
  }
}

.light .header-btn-recover {
  color: #d97706;

  &:hover {
    color: #b45309;
  }
}

// 游戏内容区域
.game-content {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: var(--space-xl) calc(32px * var(--ui-scale, 1));
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  overflow: hidden;
}

.turn-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// 重ROLL 遮罩：仅覆盖主内容，不挡侧边栏
.regenerate-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  border-radius: 8px;

  .regenerate-spin {
    font-size: 32px;
    opacity: 0.9;
  }

  span {
    font-size: 15px;
    font-weight: 500;
  }

  &.dark {
    background: rgba(3, 3, 3, 0.75);
    color: #e4e4e7;

    .regenerate-spin {
      color: #a1a1aa;
    }
  }

  &.light {
    background: rgba(250, 250, 250, 0.85);
    color: #27272a;

    .regenerate-spin {
      color: #71717a;
    }
  }
}

// 开场白生成中弹窗
.opening-generating-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;

  &.dark {
    background: rgba(3, 3, 3, 0.9);

    .opening-generating-content {
      i {
        color: #60a5fa;
      }

      .opening-generating-text {
        color: #e4e4e7;
      }

      .opening-generating-hint {
        color: #71717a;
      }

      .opening-generating-stop-btn {
        color: #f87171;
        background: rgba(248, 113, 113, 0.15);
        border-color: rgba(248, 113, 113, 0.4);

        &:hover {
          background: rgba(248, 113, 113, 0.25);
          border-color: rgba(248, 113, 113, 0.6);
        }
      }
    }
  }

  &.light {
    background: rgba(250, 250, 250, 0.9);

    .opening-generating-content {
      i {
        color: #2563eb;
      }

      .opening-generating-text {
        color: #18181b;
      }

      .opening-generating-hint {
        color: #71717a;
      }

      .opening-generating-stop-btn {
        color: #dc2626;
        background: rgba(220, 38, 38, 0.1);
        border-color: rgba(220, 38, 38, 0.3);

        &:hover {
          background: rgba(220, 38, 38, 0.2);
          border-color: rgba(220, 38, 38, 0.5);
        }
      }
    }
  }
}

.opening-generating-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  border-radius: 16px;

  i {
    font-size: 48px;
  }

  .opening-generating-text {
    font-size: 20px;
    font-weight: 600;
  }

  .opening-generating-hint {
    font-size: 14px;
  }

  .opening-generating-stop-btn {
    margin-top: 16px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.5);
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }

    i {
      font-size: 14px;
    }
  }
}

// 正文区域（重ROLL 时虚化）
.maintext-area {
  flex: 1;
  min-height: 0;
  transition: filter 0.2s ease;
  overflow-y: auto;
  padding-right: calc(6px * var(--ui-scale, 1));

  &.is-blurred {
    filter: blur(calc(4px * var(--ui-scale, 1)));
    pointer-events: none;
  }
}

.maintext-container {
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;

  &.can-long-press {
    cursor: pointer;
  }
}

.maintext-content {
  font-size: calc(16px * var(--ui-scale, 1));
  line-height: 1.8;
  color: #e4e4e7;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.dark .maintext-content {
  color: #e4e4e7;
}

/* 第二 API 合并的正文常带 .th-root 或 @media (prefers-color-scheme: light) 黑字，在深色壳里看不清 */
.dark .maintext-content :deep(.th-root) {
  color: #eceff4 !important;
}

.dark .maintext-content :deep(p),
.dark .maintext-content :deep(li) {
  color: #e8eaed;
}

/* 顶栏「第二 API 进行中」时进一步提高可读性 */
.dark .maintext-area.secondary-api-active .maintext-content {
  color: #f1f5f9 !important;
}

.dark .maintext-area.secondary-api-active .maintext-content :deep(.th-root) {
  color: #f8fafc !important;
}

.dark .maintext-area.secondary-api-active .maintext-content :deep(p),
.dark .maintext-area.secondary-api-active .maintext-content :deep(li) {
  color: #f1f5f9 !important;
}

.light .maintext-content {
  color: #27272a;
}

/* 对白：蓝色系流光渐变（<span class="th-dialog-shimmer">），勿与 p 字色冲突 */
@keyframes th-dialog-shimmer-flow {
  0% {
    background-position: 0% 50%;
  }

  100% {
    background-position: 200% 50%;
  }
}

.dark .maintext-content :deep(.th-dialog-shimmer),
.dark .maintext-area.secondary-api-active .maintext-content :deep(.th-dialog-shimmer) {
  display: inline;
  font-weight: 600;
  font-size: 1.06em;
  letter-spacing: 0.03em;
  line-height: inherit;
  background: linear-gradient(
    100deg,
    #38bdf8 0%,
    #7dd3fc 18%,
    #bae6fd 38%,
    #e0f2fe 50%,
    #7dd3fc 62%,
    #60a5fa 82%,
    #3b82f6 100%
  );
  background-size: 240% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: th-dialog-shimmer-flow 3.2s linear infinite;
}

.light .maintext-content :deep(.th-dialog-shimmer) {
  display: inline;
  font-weight: 600;
  font-size: 1.06em;
  letter-spacing: 0.02em;
  line-height: inherit;
  background: linear-gradient(
    100deg,
    #1d4ed8 0%,
    #2563eb 22%,
    #3b82f6 45%,
    #1e40af 55%,
    #2563eb 78%,
    #172554 100%
  );
  background-size: 240% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: th-dialog-shimmer-flow 3.2s linear infinite;
}

.dark .history-item .history-content :deep(.th-dialog-shimmer) {
  display: inline;
  font-weight: 600;
  font-size: 1.05em;
  letter-spacing: 0.03em;
  background: linear-gradient(
    100deg,
    #38bdf8 0%,
    #7dd3fc 18%,
    #bae6fd 38%,
    #e0f2fe 50%,
    #7dd3fc 62%,
    #60a5fa 82%,
    #3b82f6 100%
  );
  background-size: 240% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: th-dialog-shimmer-flow 3.2s linear infinite;
}

.light .history-item .history-content :deep(.th-dialog-shimmer) {
  display: inline;
  font-weight: 600;
  font-size: 1.05em;
  letter-spacing: 0.02em;
  background: linear-gradient(
    100deg,
    #1d4ed8 0%,
    #2563eb 22%,
    #3b82f6 45%,
    #1e40af 55%,
    #2563eb 78%,
    #172554 100%
  );
  background-size: 240% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: th-dialog-shimmer-flow 3.2s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .dark .maintext-content :deep(.th-dialog-shimmer),
  .dark .maintext-area.secondary-api-active .maintext-content :deep(.th-dialog-shimmer),
  .dark .history-item .history-content :deep(.th-dialog-shimmer) {
    animation: none;
    -webkit-text-fill-color: #93c5fd;
    color: #93c5fd;
    background: none;
  }

  .light .maintext-content :deep(.th-dialog-shimmer),
  .light .history-item .history-content :deep(.th-dialog-shimmer) {
    animation: none;
    -webkit-text-fill-color: #2563eb;
    color: #2563eb;
    background: none;
  }

  .dark .maintext-content :deep(.th-thought-inline),
  .dark .maintext-area.secondary-api-active .maintext-content :deep(.th-thought-inline),
  .dark .history-item .history-content :deep(.th-thought-inline) {
    color: #ddd6fe;
  }

  .light .maintext-content :deep(.th-thought-inline),
  .light .history-item .history-content :deep(.th-thought-inline) {
    color: #4c1d95;
  }
}

/* **心理活动**：与对白流光区分，静态偏色、斜体、细左边线 */
.dark .maintext-content :deep(.th-thought-inline),
.dark .maintext-area.secondary-api-active .maintext-content :deep(.th-thought-inline) {
  display: inline;
  font-style: italic;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #c4b5fd;
  border-left: 2px solid rgba(167, 139, 250, 0.55);
  padding-left: 0.4em;
  margin-left: 0.05em;
  line-height: inherit;
}

.light .maintext-content :deep(.th-thought-inline) {
  display: inline;
  font-style: italic;
  font-weight: 500;
  letter-spacing: 0.015em;
  color: #5b21b6;
  border-left: 2px solid rgba(91, 33, 182, 0.35);
  padding-left: 0.4em;
  margin-left: 0.05em;
  line-height: inherit;
}

.dark .history-item .history-content :deep(.th-thought-inline) {
  display: inline;
  font-style: italic;
  font-weight: 500;
  color: #c4b5fd;
  border-left: 2px solid rgba(167, 139, 250, 0.55);
  padding-left: 0.4em;
  margin-left: 0.05em;
}

.light .history-item .history-content :deep(.th-thought-inline) {
  display: inline;
  font-style: italic;
  font-weight: 500;
  color: #5b21b6;
  border-left: 2px solid rgba(91, 33, 182, 0.35);
  padding-left: 0.4em;
  margin-left: 0.05em;
}

/* 第二 API 注入的 <htmlcontent> 小前端：随正文区宽度、避免窄条漂在左侧；移动端可读 */
.maintext-content :deep(htmlcontent) {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0.85em 0;
  white-space: normal;
}

.maintext-content :deep(htmlcontent > *) {
  box-sizing: border-box;
  max-width: 100%;
}

.maintext-content :deep(htmlcontent > div) {
  width: 100% !important;
  max-width: 100% !important;
}

.dark .maintext-content :deep(htmlcontent) {
  color: #cbd5e1;
}

.dark .maintext-content :deep(htmlcontent small),
.dark .maintext-content :deep(htmlcontent .muted),
.dark .maintext-content :deep(htmlcontent [class*='muted']),
.dark .maintext-content :deep(htmlcontent [class*='label']) {
  color: #94a3b8 !important;
}

@media (max-width: 768px) {
  .maintext-content :deep(htmlcontent) {
    margin-left: 0;
    margin-right: 0;
  }

  .maintext-content :deep(htmlcontent table) {
    display: block;
    width: 100% !important;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}

@media (max-width: 480px) {
  .maintext-content :deep(htmlcontent) {
    font-size: calc(14px * var(--ui-scale, 1));
  }

  .maintext-content :deep(htmlcontent [style*='flex']) {
    flex-direction: column !important;
    align-items: stretch !important;
  }
}

.maintext-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: #71717a;
  text-align: center;

  .hint {
    font-size: 12px;
    margin-top: 8px;
    color: #52525b;
  }
}

.light .maintext-placeholder {
  color: #a1a1aa;

  .hint {
    color: #d4d4d8;
  }
}

// 游戏时间显示条：固定在正文区域顶部
.game-time-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  justify-content: center;
  padding: 8px 0;
  background: rgba(10, 10, 15, 0.6);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  // 适配深色模式
  &.dark {
    background: rgba(10, 10, 15, 0.6);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  // 适配浅色模式
  &.light {
    background: rgba(245, 245, 250, 0.8);
    border-bottom-color: rgba(0, 0, 0, 0.08);
  }

  // 实际内容容器
  :deep(.game-time-display) {
    position: relative;
    background: rgba(20, 20, 30, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);

    // 适配深色模式
    &.dark {
      background: rgba(20, 20, 30, 0.85);
      border-color: rgba(255, 255, 255, 0.12);
    }

    // 适配浅色模式
    &.light {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.08);

      .time-main {
        color: #333;
      }
    }
  }
}

// 长按正文：上下文菜单
.context-menu.maintext-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  overflow: hidden;

  .context-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
  }

  .context-menu-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
    opacity: 0.8;

    &:hover {
      opacity: 1;
    }
  }

  .context-menu-item {
    display: block;
    width: 100%;
    padding: 10px 16px;
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.15s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.maintext-context-menu.dark {
  background: rgba(24, 24, 27, 0.98);
  border: 1px solid rgba(63, 63, 70, 0.8);

  .context-menu-header,
  .context-menu-item {
    color: #e4e4e7;
  }
}

.maintext-context-menu.light {
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(0, 0, 0, 0.1);

  .context-menu-header,
  .context-menu-item {
    color: #27272a;
  }

  .context-menu-item:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.06);
  }
}

// 编辑正文模态框
.edit-maintext-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}

.edit-maintext-modal {
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.edit-maintext-modal.dark {
  background: #18181b;
  border: 1px solid rgba(63, 63, 70, 0.8);
}

.edit-maintext-modal.light {
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.edit-maintext-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 24px;
    line-height: 1;
    padding: 0 4px;
    opacity: 0.8;

    &:hover {
      opacity: 1;
    }
  }
}

.edit-maintext-modal.dark .edit-maintext-header {
  color: #e4e4e7;
  border-color: rgba(255, 255, 255, 0.1);

  .close-btn {
    color: #e4e4e7;
  }
}

.edit-maintext-modal.light .edit-maintext-header {
  color: #27272a;
  border-color: rgba(0, 0, 0, 0.1);

  .close-btn {
    color: #27272a;
  }
}

.edit-maintext-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.edit-maintext-textarea {
  width: 100%;
  min-height: 320px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  font-family: inherit;
}

.variable-reroll-hint {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.9;

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(127, 127, 127, 0.15);
  }
}

// 右下角变量按钮
.variable-fab {
  position: fixed;
  right: var(--space-xl);
  bottom: calc(120px * var(--ui-scale, 1));
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: calc(10px * var(--ui-scale, 1)) var(--space-md);
  border-radius: 999px;
  border: 1px solid transparent;
  cursor: grab;
  transition:
    box-shadow 0.3s ease,
    background 0.3s ease,
    border-color 0.3s ease,
    opacity 0.2s ease;
  font-size: calc(13px * var(--ui-scale, 1));
  user-select: none;
  touch-action: none;

  &:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  &:active {
    cursor: grabbing;
  }

  &.is-dragging {
    cursor: grabbing;
    opacity: 0.9;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    transition:
      box-shadow 0.3s ease,
      background 0.3s ease,
      border-color 0.3s ease,
      opacity 0.2s ease;

    .drag-hint {
      opacity: 1;
    }
  }

  i {
    font-size: calc(14px * var(--ui-scale, 1));
  }

  .drag-hint {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    opacity: 0;
    transition: opacity 0.3s ease;
    white-space: nowrap;
    pointer-events: none;
  }
}

.variable-fab-text {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.variable-fab.dark {
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.15) 0%,
    rgba(30, 30, 35, 0.9) 50%,
    rgba(168, 85, 247, 0.15) 100%
  );
  border-color: rgba(6, 182, 212, 0.3);
  color: #e4e4e7;
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.3),
    0 0 15px rgba(6, 182, 212, 0.1);

  &:hover {
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.25) 0%,
      rgba(40, 40, 45, 0.95) 50%,
      rgba(168, 85, 247, 0.25) 100%
    );
    border-color: rgba(6, 182, 212, 0.5);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(6, 182, 212, 0.2);
  }

  &:active {
    box-shadow:
      0 2px 10px rgba(0, 0, 0, 0.3),
      0 0 25px rgba(6, 182, 212, 0.3);
  }

  &.is-dragging {
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.3) 0%,
      rgba(50, 50, 55, 1) 50%,
      rgba(168, 85, 247, 0.3) 100%
    );
    border-color: rgba(6, 182, 212, 0.7);
    box-shadow:
      0 8px 30px rgba(0, 0, 0, 0.5),
      0 0 30px rgba(6, 182, 212, 0.3);
  }

  .drag-hint {
    color: rgba(6, 182, 212, 0.8);
    text-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
  }
}

.variable-fab.light {
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.1) 0%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(168, 85, 247, 0.1) 100%
  );
  border-color: rgba(6, 182, 212, 0.25);
  color: #27272a;
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.1),
    0 0 12px rgba(6, 182, 212, 0.08);

  &:hover {
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.18) 0%,
      rgba(255, 255, 255, 1) 50%,
      rgba(168, 85, 247, 0.18) 100%
    );
    border-color: rgba(6, 182, 212, 0.4);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.15),
      0 0 18px rgba(6, 182, 212, 0.15);
  }

  &:active {
    box-shadow:
      0 2px 10px rgba(0, 0, 0, 0.1),
      0 0 20px rgba(6, 182, 212, 0.2);
  }

  &.is-dragging {
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.25) 0%,
      rgba(250, 250, 252, 1) 50%,
      rgba(168, 85, 247, 0.25) 100%
    );
    border-color: rgba(6, 182, 212, 0.6);
    box-shadow:
      0 8px 30px rgba(0, 0, 0, 0.2),
      0 0 25px rgba(6, 182, 212, 0.2);
  }

  .drag-hint {
    color: rgba(6, 182, 212, 0.7);
  }
}

// =========================
// 响应式布局（手机/平板）
// =========================

// 平板及以下：去掉桌面端固定高度限制
@media (max-width: 1024px) {
  // 平板及以下：宽度自适应，但保留用户设置的高度
  .rule-modifier {
    max-width: 100%;
  }

  .sidebar,
  .middle-panel,
  .main-panel {
    max-height: var(--ui-max-height, none);
  }

  .middle-panel {
    width: min(90vw, 520px);
  }

  .panel-inner {
    width: 100%;
  }
}

// 手机端：底部导航 + 中间面板全屏抽屉 + 适配视口高度
@media (max-width: 768px) {
  .rule-modifier {
    max-width: 100%;
    width: 100%;
    margin: 0;
    // 手机端高度使用 CSS 变量，支持自定义高度
    height: var(--ui-max-height, 100dvh);
    max-height: var(--ui-max-height, 100dvh);
    // 底部栏可多行换行，预留足够空间（含安全区）；用 vh 避免窄宽度下 vmin 过小
    padding-bottom: calc(env(safe-area-inset-bottom) + clamp(72px, 22vh, 260px));
  }

  // Sidebar 变成底部栏（图标 flex-wrap，一行放不下自动多行）
  .sidebar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: auto;
    min-height: 56px;
    // 图标极多时允许内部滚动，避免占满整屏
    max-height: min(48vh, 320px);
    overflow-y: auto;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-end;
    border-right: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 50;
  }

  .light .sidebar {
    border-top-color: rgba(0, 0, 0, 0.08);
  }

  // 底部栏不显示 logo 区；导航项同一 flex 容器内换行
  .sidebar-top .logo {
    display: none;
  }

  .sidebar-top {
    flex: 0 0 auto;
    min-height: 0;
    width: 100%;
    padding: 0;
    border: none;
  }

  .sidebar-top .nav-items {
    flex: 0 1 auto;
    min-height: 0;
    max-height: none;
    overflow-y: visible;
    overflow-x: hidden;
    padding: 8px 10px;
    flex-direction: row;
    flex-wrap: wrap;
    row-gap: 8px;
    column-gap: 10px;
    align-items: center;
    align-content: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;

    .nav-items-bottom-spacer {
      display: contents;
      margin-top: 0;
      padding-top: 0;
      border-top: none;
    }
  }

  // 底部栏按钮：仅图标为主，文字隐藏；宽度随内容，便于多行排列
  .nav-btn {
    width: auto;
    flex: 0 0 auto;
    min-width: 44px;
    justify-content: center;
    padding: 10px 12px;
    border-radius: 14px;
  }

  .nav-label {
    display: none;
  }

  // Middle panel 变成全屏抽屉（覆盖正文）
  .middle-panel {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100dvh;
    max-height: none;
    z-index: 60;
    border-left: none;
    border-right: none;
    border-radius: 0;
  }

  // 开局系统设置：不得用 z-index:60，否则低于全屏 scrim(85)，点击会穿透关闭
  .opening-settings-drawer.middle-panel {
    z-index: 110;
    width: 100%;
    max-width: 100%;
    --middle-panel-width: 100%;
    /* 覆盖上方 .middle-panel 的 height:100dvh，改由 inset 贴合 iframe */
    height: auto;
    max-height: none;
    inset: 0;
  }

  .panel-inner {
    width: 100%;
  }

  .panel-content {
    padding: 16px 16px;
  }

  .panel-content.panel-content--map-bleed {
    padding: 6px 8px 10px;
  }

  .panel-header {
    padding: 0 16px;
  }

  // 主面板占满宽度；输入区避免被底部导航遮挡
  .main-panel {
    max-height: none;
  }

  // 地图全幅时抽屉内仍铺满可视区（底栏由 rule-modifier padding-bottom 预留）
  .rule-modifier.layout-regional-map-bleed .middle-panel {
    height: 100%;
    max-height: none;
  }

  .input-area {
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
  }

  // 选项列表：为底栏 + 输入区预留空间，超出则在列表内纵向滑动（避免第 4 条被裁切）
  .options-list {
    max-height: min(56dvh, calc(100dvh - 300px));
  }

  // 正文 + 选项整体过高时，允许主内容区滚动兜底（避免选项区被父级 overflow 裁掉）
  .game-content {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }

  // 右下角浮动按钮：随多行底栏抬高，避免与底部导航重叠
  .variable-fab {
    bottom: calc(
      (env(safe-area-inset-bottom) + clamp(100px, 24vh, 240px)) * var(--ui-scale, 1)
    );
    right: var(--space-lg);
    // 手机端也保持fixed定位，支持拖动
  }
}

// 极窄屏（约 300×800 等）：再压缩边距与字号，避免横向溢出
@media (max-width: 300px) {
  .rule-modifier {
    font-size: calc(12px * var(--ui-scale, 1));
  }

  .main-header {
    padding: 0 8px;
    gap: 4px;
  }

  .header-title h2 {
    font-size: 14px;
  }

  .header-actions .header-btn {
    padding: 6px 8px;
    min-width: 0;
  }

  .panel-content {
    padding: 12px 10px;
  }

  .panel-header {
    padding: 0 10px;
  }

  .input-area {
    padding-left: 10px;
    padding-right: 10px;
  }

  .option-btn {
    padding: 8px 10px;
    font-size: 12px;
  }

  .options-toggle {
    padding: 8px 10px;
    font-size: 12px;
  }

  .variable-persist-banner {
    font-size: 11px;
    padding: 6px 8px;
  }
}

// 拖动时的全局样式
body.has-dragging-fab {
  cursor: grabbing !important;

  * {
    cursor: grabbing !important;
  }
}

.edit-maintext-modal.dark .edit-maintext-textarea {
  background: rgba(39, 39, 42, 0.8);
  border: 1px solid rgba(63, 63, 70, 0.8);
  color: #e4e4e7;
}

.edit-maintext-modal.light .edit-maintext-textarea {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  color: #27272a;
}

.edit-maintext-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-shrink: 0;
}

// 选项区域（与正文共用 turn-layout 高度；列表过高时由 .options-list 内部滚动）
.options-area {
  z-index: 12;
  margin-top: 0;
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: var(--space-md);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(calc(10px * var(--ui-scale, 1)));
}

.dark .options-area {
  border-color: rgba(255, 255, 255, 0.1);
  background: linear-gradient(
    to top,
    rgba(3, 3, 3, 0.92) 0%,
    rgba(3, 3, 3, 0.75) 65%,
    rgba(3, 3, 3, 0) 100%
  );
}

.light .options-area {
  border-color: rgba(0, 0, 0, 0.1);
  background: linear-gradient(
    to top,
    rgba(250, 250, 250, 0.96) 0%,
    rgba(250, 250, 250, 0.82) 65%,
    rgba(250, 250, 250, 0) 100%
  );
}

.options-title {
  font-size: calc(14px * var(--ui-scale, 1));
  font-weight: 500;
  color: #a1a1aa;
  margin-bottom: var(--space-md);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dark .options-title {
  color: #a1a1aa;
}

.light .options-title {
  color: #71717a;
}

.options-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  flex-shrink: 0;
  padding: calc(10px * var(--ui-scale, 1)) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid rgba(6, 182, 212, 0.2);
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.08) 0%,
    rgba(0, 0, 0, 0.4) 50%,
    rgba(168, 85, 247, 0.08) 100%
  );
  color: #e4e4e7;
  font-size: calc(14px * var(--ui-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: var(--space-sm);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(6, 182, 212, 0.2) 50%,
      transparent 100%
    );
    transition: left 0.5s ease;
  }

  &:hover {
    border-color: rgba(6, 182, 212, 0.5);
    box-shadow:
      0 0 15px rgba(6, 182, 212, 0.2),
      inset 0 0 20px rgba(6, 182, 212, 0.05);
    transform: translateY(-1px);

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(0);
  }

  i {
    font-size: calc(12px * var(--ui-scale, 1));
    transition: transform 0.3s ease;
    color: rgba(6, 182, 212, 0.8);
  }
}

.dark .options-toggle {
  border-color: rgba(6, 182, 212, 0.25);
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.1) 0%,
    rgba(10, 10, 12, 0.8) 50%,
    rgba(168, 85, 247, 0.1) 100%
  );
  color: #e4e4e7;

  &:hover {
    border-color: rgba(6, 182, 212, 0.5);
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.15) 0%,
      rgba(15, 15, 18, 0.9) 50%,
      rgba(168, 85, 247, 0.15) 100%
    );
    box-shadow:
      0 0 20px rgba(6, 182, 212, 0.25),
      inset 0 0 30px rgba(6, 182, 212, 0.08);
  }
}

.light .options-toggle {
  border-color: rgba(6, 182, 212, 0.3);
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.05) 0%,
    rgba(250, 250, 252, 0.9) 50%,
    rgba(168, 85, 247, 0.05) 100%
  );
  color: #27272a;

  &:hover {
    border-color: rgba(6, 182, 212, 0.5);
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.1) 0%,
      rgba(255, 255, 255, 1) 50%,
      rgba(168, 85, 247, 0.1) 100%
    );
    box-shadow:
      0 0 15px rgba(6, 182, 212, 0.15),
      inset 0 0 20px rgba(6, 182, 212, 0.05);
  }

  i {
    color: rgba(6, 182, 212, 0.9);
  }
}

// 选项列表展开/折叠动画（max-height 须大于多行长选项总高，否则展开阶段会被裁切）
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: min(3200px, 88dvh);
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex: 0 1 auto;
  min-height: 0;
  max-height: min(68dvh, calc(100svh - 260px));
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px solid rgba(6, 182, 212, 0.15);
  background: linear-gradient(
    90deg,
    rgba(6, 182, 212, 0.05) 0%,
    rgba(0, 0, 0, 0.3) 30%,
    rgba(0, 0, 0, 0.3) 70%,
    rgba(168, 85, 247, 0.05) 100%
  );
  color: #e4e4e7;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(
      180deg,
      rgba(6, 182, 212, 0.8) 0%,
      rgba(168, 85, 247, 0.8) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 20% 50%,
      rgba(6, 182, 212, 0.1) 0%,
      transparent 50%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    border-color: rgba(6, 182, 212, 0.4);
    background: linear-gradient(
      90deg,
      rgba(6, 182, 212, 0.1) 0%,
      rgba(15, 15, 18, 0.8) 30%,
      rgba(15, 15, 18, 0.8) 70%,
      rgba(168, 85, 247, 0.1) 100%
    );
    transform: translateX(calc(4px * var(--ui-scale, 1)));
    box-shadow:
      -5px 0 20px rgba(6, 182, 212, 0.15),
      5px 0 20px rgba(168, 85, 247, 0.1);

    &::before {
      opacity: 1;
    }

    &::after {
      opacity: 1;
    }
  }

  &:active {
    transform: translateX(calc(2px * var(--ui-scale, 1)));
  }
}

.dark .option-btn {
  border-color: rgba(6, 182, 212, 0.2);
  background: linear-gradient(
    90deg,
    rgba(6, 182, 212, 0.08) 0%,
    rgba(18, 18, 22, 0.9) 25%,
    rgba(18, 18, 22, 0.9) 75%,
    rgba(168, 85, 247, 0.08) 100%
  );
  color: #e4e4e7;

  &::before {
    background: linear-gradient(
      180deg,
      rgba(6, 182, 212, 1) 0%,
      rgba(168, 85, 247, 0.8) 100%
    );
    box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
  }

  &:hover {
    background: linear-gradient(
      90deg,
      rgba(6, 182, 212, 0.15) 0%,
      rgba(25, 25, 30, 0.95) 25%,
      rgba(25, 25, 30, 0.95) 75%,
      rgba(168, 85, 247, 0.15) 100%
    );
    border-color: rgba(6, 182, 212, 0.5);
    box-shadow:
      -5px 0 25px rgba(6, 182, 212, 0.2),
      5px 0 25px rgba(168, 85, 247, 0.15),
      inset 0 0 30px rgba(6, 182, 212, 0.05);

    &::before {
      opacity: 1;
      box-shadow:
        0 0 15px rgba(6, 182, 212, 0.8),
        0 0 30px rgba(6, 182, 212, 0.4);
    }
  }

  &:disabled {
    opacity: 0.4;
    border-color: rgba(255, 255, 255, 0.05);
    background: rgba(30, 30, 35, 0.5);
    cursor: not-allowed;

    &::before {
      display: none;
    }

    &:hover {
      transform: none;
      box-shadow: none;
    }
  }
}

.light .option-btn {
  border-color: rgba(6, 182, 212, 0.25);
  background: linear-gradient(
    90deg,
    rgba(6, 182, 212, 0.06) 0%,
    rgba(252, 252, 254, 0.95) 25%,
    rgba(252, 252, 254, 0.95) 75%,
    rgba(168, 85, 247, 0.06) 100%
  );
  color: #27272a;

  &::before {
    background: linear-gradient(
      180deg,
      rgba(6, 182, 212, 0.9) 0%,
      rgba(168, 85, 247, 0.7) 100%
    );
    box-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
  }

  &:hover {
    background: linear-gradient(
      90deg,
      rgba(6, 182, 212, 0.12) 0%,
      rgba(255, 255, 255, 1) 25%,
      rgba(255, 255, 255, 1) 75%,
      rgba(168, 85, 247, 0.12) 100%
    );
    border-color: rgba(6, 182, 212, 0.5);
    box-shadow:
      -5px 0 20px rgba(6, 182, 212, 0.12),
      5px 0 20px rgba(168, 85, 247, 0.08);

    &::before {
      opacity: 1;
    }
  }

  &:disabled {
    opacity: 0.5;
    border-color: rgba(0, 0, 0, 0.1);
    background: rgba(240, 240, 245, 0.6);

    &::before {
      display: none;
    }

    &:hover {
      transform: none;
      box-shadow: none;
    }
  }
}

.option-id {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(28px * var(--ui-scale, 1));
  height: calc(28px * var(--ui-scale, 1));
  border-radius: var(--radius-sm);
  font-size: calc(12px * var(--ui-scale, 1));
  font-weight: 600;
  flex-shrink: 0;
  position: relative;
  transition: all 0.3s ease;
  border: 1px solid transparent;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-sm);
    padding: 1px;
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.6) 0%,
      rgba(168, 85, 247, 0.6) 100%
    );
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0.5;
    transition: opacity 0.3s ease;
  }
}

.dark .option-id {
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.15) 0%,
    rgba(168, 85, 247, 0.15) 100%
  );
  color: rgba(6, 182, 212, 0.9);
  text-shadow: 0 0 10px rgba(6, 182, 212, 0.5);

  &::before {
    opacity: 0.6;
  }
}

.dark .option-btn:hover .option-id {
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.25) 0%,
    rgba(168, 85, 247, 0.25) 100%
  );
  color: #fff;
  text-shadow:
    0 0 10px rgba(6, 182, 212, 0.8),
    0 0 20px rgba(6, 182, 212, 0.4);
  box-shadow:
    0 0 15px rgba(6, 182, 212, 0.3),
    inset 0 0 10px rgba(6, 182, 212, 0.1);

  &::before {
    opacity: 1;
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 1) 0%,
      rgba(168, 85, 247, 0.8) 100%
    );
  }
}

.light .option-id {
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.1) 0%,
    rgba(168, 85, 247, 0.1) 100%
  );
  color: rgba(6, 182, 212, 0.8);

  &::before {
    opacity: 0.4;
  }
}

.light .option-btn:hover .option-id {
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.2) 0%,
    rgba(168, 85, 247, 0.2) 100%
  );
  color: rgba(6, 182, 212, 1);
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);

  &::before {
    opacity: 0.8;
  }
}

.option-text {
  flex: 1;
  min-width: 0;
  font-size: calc(14px * var(--ui-scale, 1));
  line-height: 1.5;
  word-break: break-word;
}

// 阅读模式和读档模式
.reader-mode,
.save-mode {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.mode-header {
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 16px;

  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  p {
    font-size: 13px;
    color: #a1a1aa;
  }
}

.dark .mode-header {
  border-color: rgba(255, 255, 255, 0.1);

  h3 { color: #f4f4f5; }
  p { color: #a1a1aa; }
}

.light .mode-header {
  border-color: rgba(0, 0, 0, 0.1);

  h3 { color: #18181b; }
  p { color: #71717a; }
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);

  .history-meta {
    font-size: 12px;
    color: #71717a;
    margin-bottom: 8px;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 8px;

    .turn-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: rgba(96, 165, 250, 0.15);
      color: #60a5fa;
    }
  }

  .history-content {
    font-size: 14px;
    line-height: 1.6;
    color: #e4e4e7;
    white-space: pre-wrap;
  }
}

.dark .history-item {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);

  .history-meta { color: #71717a; }
  .history-content { color: #e4e4e7; }
}

.light .history-item {
  border-color: rgba(0, 0, 0, 0.1);
  background: #fff;

  .history-meta {
    color: #a1a1aa;

    .turn-badge {
      background: rgba(37, 99, 235, 0.1);
      color: #2563eb;
    }
  }
  .history-content { color: #27272a; }
}

/* 阅读模式历史条内的 htmlcontent 与正文区一致：全宽、可滚动 */
.history-item .history-content :deep(htmlcontent) {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0.75em 0;
  white-space: normal;
}

.history-item .history-content :deep(htmlcontent > div) {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box;
}

.save-item {
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    border-color: rgba(59, 130, 246, 0.5);
    background: rgba(59, 130, 246, 0.1);
  }

  .branch-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding-top: var(--space-md);
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
    font-size: 12px;
    color: #3b82f6;

    i {
      font-size: 14px;
    }
  }
}

.dark .save-item {
  &:hover {
    border-color: rgba(96, 165, 250, 0.5);
    background: rgba(96, 165, 250, 0.1);
  }

  .branch-hint {
    border-color: rgba(255, 255, 255, 0.1);
    color: #60a5fa;
  }
}

.light .save-item {
  &:hover {
    border-color: rgba(37, 99, 235, 0.5);
    background: rgba(37, 99, 235, 0.1);
  }

  .branch-hint {
    border-color: rgba(0, 0, 0, 0.1);
    color: #2563eb;
  }
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #71717a;
  font-size: 14px;
  line-height: 1.6;

  small {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    opacity: 0.8;
  }
}

.dark .empty-state {
  color: #71717a;

  small {
    color: #52525b;
  }
}

.light .empty-state {
  color: #a1a1aa;

  small {
    color: #d4d4d8;
  }
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.input-area {
  padding: var(--space-lg) calc(32px * var(--ui-scale, 1));
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.game-send-abort-row {
  max-width: calc(1000px * var(--ui-scale, 1));
  margin: 0 auto var(--space-sm);
  display: flex;
  justify-content: center;
}

.game-send-abort-btn {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px 14px;
  border-radius: var(--radius-lg);
  font-size: calc(13px * var(--ui-scale, 1));
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.15s ease;

  &:hover {
    background: rgba(153, 27, 27, 0.5);
    border-color: rgba(252, 165, 165, 0.65);
  }

  &:active {
    transform: scale(0.98);
  }
}

.game-send-abort-btn.dark {
  box-shadow: 0 0 12px rgba(248, 113, 113, 0.15);
}

.game-send-abort-btn.light {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(254, 226, 226, 0.95);
  color: #991b1b;

  &:hover {
    background: #fecaca;
    border-color: rgba(185, 28, 28, 0.45);
  }
}

.game-send-abort-label {
  white-space: nowrap;
}

.game-send-abort-hint {
  font-size: calc(11px * var(--ui-scale, 1));
  font-weight: 500;
  opacity: 0.88;
  flex: 1 1 100%;
  text-align: center;
}

@media (min-width: 520px) {
  .game-send-abort-hint {
    flex: 0 1 auto;
    text-align: left;
  }
}

.dark .input-area {
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.05);
}

.light .input-area {
  background: rgba(255, 255, 255, 0.5);
  border-color: rgba(0, 0, 0, 0.05);
}

// 输入框 + 发送：一体条（flex），避免按钮浮在框内产生缝隙
.input-wrapper {
  display: flex;
  align-items: stretch;
  max-width: calc(1000px * var(--ui-scale, 1));
  margin: 0 auto;
  border-radius: var(--radius-xl);
  overflow: hidden;
  border: 1px solid rgba(6, 182, 212, 0.2);
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.05) 0%,
    rgba(15, 15, 18, 0.8) 25%,
    rgba(15, 15, 18, 0.8) 75%,
    rgba(168, 85, 247, 0.05) 100%
  );
  transition: all 0.3s ease;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: calc(var(--radius-xl) + 1px);
    padding: 1px;
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.4) 0%,
      transparent 30%,
      transparent 70%,
      rgba(168, 85, 247, 0.4) 100%
    );
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  &:focus-within {
    border-color: rgba(6, 182, 212, 0.5);
    box-shadow:
      0 0 20px rgba(6, 182, 212, 0.15),
      inset 0 0 30px rgba(6, 182, 212, 0.05);

    &::before {
      opacity: 1;
    }
  }

  textarea {
    flex: 1;
    min-width: 0;
    width: auto;
    border: none;
    border-radius: 0;
    padding: var(--space-md) var(--space-md) var(--space-md) var(--space-xl);
    font-size: calc(15px * var(--ui-scale, 1));
    line-height: 1.5;
    resize: none;
    outline: none;
    background: transparent;
    color: inherit;
    transition: color 0.2s, opacity 0.2s;

    &::placeholder {
      color: #52525b;
    }

    &:disabled {
      opacity: 0.75;
      cursor: not-allowed;
    }
  }
}

.dark .input-wrapper {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;

  &:focus-within {
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.22);
  }

  textarea {
    &::placeholder {
      color: #52525b;
    }

    &:disabled {
      color: #71717a;
    }
  }
}

.light .input-wrapper {
  border-color: rgba(0, 0, 0, 0.1);
  background: #fff;
  color: #18181b;

  &:focus-within {
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
    border-color: rgba(0, 0, 0, 0.18);
  }

  textarea {
    &::placeholder {
      color: #a1a1aa;
    }

    &:disabled {
      color: #a1a1aa;
    }
  }
}

// 发送按钮：贴在输入条右侧，与框共用外轮廓
.send-btn {
  position: static;
  transform: none;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  min-width: calc(72px * var(--ui-scale, 1));
  padding: 0 var(--space-lg);
  margin: 0;
  border: none;
  border-radius: 0;
  border-left: 1px solid rgba(6, 182, 212, 0.2);
  cursor: pointer;
  font-size: calc(14px * var(--ui-scale, 1));
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(6, 182, 212, 0.3) 50%,
      transparent 100%
    );
    transition: left 0.5s ease;
  }

  &:hover:not(:disabled) {
    &::before {
      left: 100%;
    }
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    background: rgba(30, 30, 35, 0.6) !important;
    color: #71717a !important;
    border-left-color: rgba(255, 255, 255, 0.05) !important;

    &::before {
      display: none;
    }
  }
}

.main-panel.dark .send-btn {
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.15) 0%,
    rgba(25, 28, 35, 0.9) 50%,
    rgba(168, 85, 247, 0.15) 100%
  );
  color: rgba(6, 182, 212, 0.8);
  border-left-color: rgba(6, 182, 212, 0.25);

  &:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.25) 0%,
      rgba(30, 35, 42, 0.95) 50%,
      rgba(168, 85, 247, 0.25) 100%
    );
    color: #fff;
    text-shadow: 0 0 10px rgba(6, 182, 212, 0.6);
    box-shadow:
      inset 0 0 20px rgba(6, 182, 212, 0.1),
      -5px 0 15px rgba(6, 182, 212, 0.15);
    border-left-color: rgba(6, 182, 212, 0.5);
  }

  &:disabled {
    background: rgba(25, 28, 35, 0.6) !important;
    color: #71717a !important;
  }
}

.main-panel.light .send-btn {
  background: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.1) 0%,
    rgba(240, 240, 245, 0.9) 50%,
    rgba(168, 85, 247, 0.1) 100%
  );
  color: rgba(6, 182, 212, 0.8);
  border-left-color: rgba(6, 182, 212, 0.2);

  &:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.2) 0%,
      rgba(255, 255, 255, 1) 50%,
      rgba(168, 85, 247, 0.2) 100%
    );
    color: rgba(6, 182, 212, 1);
    box-shadow:
      inset 0 0 15px rgba(6, 182, 212, 0.08),
      -5px 0 12px rgba(6, 182, 212, 0.1);
    border-left-color: rgba(6, 182, 212, 0.4);
  }

  &:disabled {
    background: rgba(240, 240, 245, 0.6) !important;
    color: #9ca3af !important;
    border-left-color: rgba(0, 0, 0, 0.05) !important;
  }
}

// 生成中动画提示
.generating-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  font-size: calc(14px * var(--ui-scale, 1));
  color: #60a5fa;

  i {
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 游戏阶段 Teleport 单根包裹：display:contents 使子节点等效挂在 #app-root 下，全屏时仍在上层
.game-surface-teleport-slot {
  display: contents;
}

// Modal（需高于 .middle-panel 手机抽屉 z-index: 60，否则点「编辑」弹窗在抽屉下方看不见）
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
}

.modal-content {
  width: 100%;
  max-width: 600px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);

  &.modal-enter-active,
  &.modal-leave-active {
    transition: all 0.3s ease;
  }

  &.modal-enter-from,
  &.modal-leave-to {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
}

.dark .modal-content {
  @include cyber-card-surface;
  border-color: rgba(0, 243, 255, 0.28);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.65),
    0 0 36px rgba(176, 38, 255, 0.18);
}

.light .modal-content {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);

  h2 {
    font-size: 18px;
    font-weight: 500;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 20px;
    cursor: pointer;
    transition: color 0.2s;
  }
}

.dark .modal-header {
  border-color: rgba(255, 255, 255, 0.05);
  color: #fff;

  .close-btn {
    color: #71717a;

    &:hover { color: #fff; }
  }
}

.light .modal-header {
  border-color: rgba(0, 0, 0, 0.05);
  color: #18181b;

  .close-btn {
    color: #a1a1aa;

    &:hover { color: #18181b; }
  }
}

.rule-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h2 {
    flex: 1;
    text-align: center;
    margin: 0;
  }
}

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
  flex-shrink: 0;

  &:hover {
    background: #16a34a;
  }
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
  flex-shrink: 0;

  &:hover {
    background: #dc2626;
  }
}

// 规则类弹窗：设置最大高度和滚动
.rule-modal-content {
  display: flex;
  flex-direction: column;
  max-height: min(90vh, 800px);
  width: 100%;
}

// 规则类弹窗：窄屏标题独占一行（正文区 min-height 见 .modal-body 后的覆盖）
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }

  .rule-modal-content {
    max-height: min(92dvh, 100vh);
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: 8px;
  }

  .rule-modal-header {
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px 12px;
    align-items: stretch;

    h2 {
      order: -1;
      flex: 0 0 100%;
      width: 100%;
      min-width: 0;
      text-align: center;
      font-size: 1rem;
      line-height: 1.35;
      white-space: normal;
    }
  }

  .btn-complete,
  .btn-cancel {
    flex: 1 1 calc(50% - 6px);
    justify-content: center;
    min-width: 0;
  }
}

@media (max-width: 360px) {
  .btn-complete-text,
  .btn-cancel-text {
    display: none;
  }

  .btn-complete,
  .btn-cancel {
    padding: 10px 12px;
  }
}

.rule-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.avatar-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.avatar-upload-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.avatar-upload-hint {
  margin: -4px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #71717a;
}

.dark .avatar-upload-hint {
  color: #a1a1aa;
}

.avatar-edit-preview {
  display: flex;
  justify-content: center;
  padding: 8px 0 0;
}

.avatar-edit-preview img {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.light .avatar-edit-preview img {
  border-color: rgba(0, 0, 0, 0.12);
}

// 详情编辑区域样式
.detail-edit-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.light .detail-edit-section {
  border-top-color: rgba(0, 0, 0, 0.1);
}

.detail-edit-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: #a1a1aa;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #d4d4d8;
  }

  i {
    transition: transform 0.2s;
  }
}

.light .detail-edit-toggle {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.02);
  color: #71717a;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #3f3f46;
  }
}

.detail-edit-content {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}

.detail-edit-row {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.light .detail-edit-row {
  border-color: rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.01);
}

.detail-edit-header {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.detail-name-input {
  flex: 1;
  font-weight: 500;
}

.detail-edit-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.full-width {
    grid-column: 1 / -1;
  }

  label {
    font-size: 11px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .form-input,
  .form-textarea {
    font-size: 13px;
  }
}

.light .detail-field {
  label {
    color: #71717a;
  }
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;

  &.btn-danger {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;

    &:hover {
      background: rgba(239, 68, 68, 0.2);
    }
  }
}

.light .btn-icon.btn-danger {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;

  &:hover {
    background: rgba(239, 68, 68, 0.15);
  }
}

// 身份标签编辑样式
.identity-tags-form {
  .form-hint {
    font-size: 12px;
    color: #71717a;
    margin-bottom: 16px;
    line-height: 1.5;
  }
}

.character-appearance-form {
  .appearance-jewelry-block {
    margin-bottom: 18px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .appearance-jewelry-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .appearance-slot-label {
    font-size: 13px;
    font-weight: 600;
    color: #a1a1aa;
  }
}

.light .character-appearance-form {
  .appearance-jewelry-block {
    border-bottom-color: rgba(0, 0, 0, 0.08);
  }

  .appearance-slot-label {
    color: #52525b;
  }
}

.identity-tag-edit-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.identity-category-input {
  flex: 1;
  min-width: 0;
}

.identity-value-input {
  flex: 2;
  min-width: 0;
}

.light .identity-tags-form .form-hint {
  color: #71717a;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #a1a1aa;
}

.dark .form-label {
  color: #a1a1aa;
}

.light .form-label {
  color: #71717a;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.dark .form-input,
.dark .form-textarea {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;

  &::placeholder {
    color: #71717a;
  }
}

.light .form-input,
.light .form-textarea {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  color: #18181b;

  &::placeholder {
    color: #a1a1aa;
  }
}

.modal-body {
  padding: 24px;
  min-height: 300px;
}

.rule-modal-content .modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: calc(min(90vh, 800px) - 80px); // 减去 header 高度
}

@media (max-width: 768px) {
  .rule-modal-content .modal-body {
    min-height: 0;
    max-height: none;
    padding: 16px 14px;
  }
}

.modal-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
  height: 100%;

  .spin-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.1);

    i {
      font-size: 32px;
      color: #52525b;
    }
  }

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: #e4e4e7;
  }

  p {
    font-size: 14px;
    color: #71717a;
    max-width: 300px;

    code {
      color: #d4d4d8;
      font-family: monospace;
    }
  }
}

.light .modal-placeholder {
  .spin-icon i { color: #a1a1aa; }
  h3 { color: #27272a; }
  p {
    color: #71717a;
    code { color: #52525b; }
  }
}

.modal-footer {
  padding: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dark .modal-footer {
  border-color: rgba(255, 255, 255, 0.05);
}

.light .modal-footer {
  border-color: rgba(0, 0, 0, 0.05);
  background: rgba(0, 0, 0, 0.02);
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  color: #a1a1aa;
  background: transparent;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
  }
}

.light .btn-secondary {
  color: #71717a;

  &:hover {
    color: #18181b;
    background: rgba(0, 0, 0, 0.05);
  }
}

.btn-primary {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.light .btn-primary {
  color: #fff;
  background: #18181b;

  &:hover {
    background: #27272a;
  }
}

.dark .btn-primary {
  color: #fff;
  background: linear-gradient(135deg, rgba(176, 38, 255, 0.9), rgba(0, 243, 255, 0.55));
  border: 1px solid rgba(0, 243, 255, 0.35);
  box-shadow: 0 0 20px rgba(0, 243, 255, 0.2);
  font-family: var(--font-cyber-display);
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &:hover {
    background: linear-gradient(135deg, rgba(176, 38, 255, 1), rgba(0, 243, 255, 0.75));
    box-shadow: 0 0 26px rgba(176, 38, 255, 0.35);
  }
}

// 编辑暂存（购物车）
.edit-cart-overlay {
  position: fixed;
  inset: 0;
  z-index: 200000;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: auto;
}

.edit-cart-dialog {
  width: 100%;
  max-width: 480px;
  max-height: min(80vh, 640px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}

.edit-cart-submit-btn--blocked {
  opacity: 0.45;
  cursor: not-allowed;
}

.edit-cart-dialog.dark {
  background: #18181b;
  color: #e4e4e7;
}

.edit-cart-dialog.light {
  background: #fafafa;
  color: #18181b;
  border-color: rgba(0, 0, 0, 0.1);
}

.edit-cart-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.light .edit-cart-header {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}

.edit-cart-hint {
  flex-shrink: 0;
  margin: 0;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.45;
  opacity: 0.85;
}

.edit-cart-list {
  list-style: none;
  margin: 0;
  padding: 0 14px 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.edit-cart-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
}

.light .edit-cart-row {
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

.edit-cart-label {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.edit-cart-row-actions {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  gap: 8px;
}

.edit-cart-edit {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgba(59, 130, 246, 0.55);
  background: transparent;
  color: #60a5fa;
  cursor: pointer;
}

.light .edit-cart-edit {
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.45);
}

.edit-cart-remove {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.5);
  background: transparent;
  color: #f87171;
  cursor: pointer;
}

.edit-cart-empty {
  margin: 0;
  padding: 16px 14px;
  text-align: center;
  font-size: 13px;
  opacity: 0.7;
}

.edit-cart-clear-hint {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 14px 0;
  font-size: 12px;
  line-height: 1.45;
  color: #fbbf24;
}

.light .edit-cart-clear-hint {
  color: #b45309;
}

.edit-cart-footer {
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.edit-cart-footer-left {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.edit-cart-clear-confirm-btn {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(239, 68, 68, 0.55);
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  transition: background 0.2s;

  &:hover {
    background: rgba(239, 68, 68, 0.22);
  }
}

.light .edit-cart-clear-confirm-btn {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.45);
}

.light .edit-cart-footer {
  border-top-color: rgba(0, 0, 0, 0.08);
}

.nav-btn-cart {
  position: relative;
}

.cart-badge {
  position: absolute;
  top: 4px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  pointer-events: none;
}

// 末尾玩家楼层提示（叠在标签弹窗之上，避免被挡）
.orphan-user-floor-overlay {
  z-index: 10002;
}

.orphan-user-floor-modal {
  max-width: 440px;
  width: 100%;
}

.orphan-user-floor-intro,
.orphan-user-floor-hint {
  font-size: 14px;
  line-height: 1.55;
  margin: 0 0 12px;
  color: #a1a1aa;
}

.light .orphan-user-floor-intro,
.light .orphan-user-floor-hint {
  color: #52525b;
}

.orphan-user-floor-meta {
  font-size: 13px;
  margin: 0 0 12px;
  color: #e4e4e7;

  code {
    font-family: ui-monospace, monospace;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
  }
}

.light .orphan-user-floor-meta {
  color: #27272a;

  code {
    background: rgba(0, 0, 0, 0.06);
  }
}

.orphan-user-floor-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

// 标签验证弹窗样式 - 紧凑设计
.tag-validation-overlay {
  z-index: 10001;
  align-items: flex-start;
  justify-content: center;
  padding: 8px 10px;
  padding-top: calc(48px * var(--ui-scale, 1));
}

.tag-validation-modal {
  max-width: 440px;
  width: 100%;
  max-height: min(78vh, calc(100dvh - 88px));
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tag-validation-modal.is-raw-maximized {
  max-width: min(920px, 96vw);
  max-height: min(92vh, calc(100dvh - 20px));
  height: min(92vh, calc(100dvh - 20px));
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tag-validation-modal.is-raw-maximized .modal-header,
.tag-validation-modal.is-raw-maximized .modal-footer {
  flex-shrink: 0;
}

.tag-validation-modal.is-raw-maximized .modal-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-top: 8px;
}

.tag-validation-modal.is-raw-maximized .tag-validation-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tag-validation-modal.is-raw-maximized .tag-validation-content > *:not(.ai-output-section) {
  display: none !important;
}

.tag-validation-modal.is-raw-maximized .ai-output-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 0;
  padding-top: 0;
  border-top: none;
  overflow: hidden;
}

.tag-validation-modal.is-raw-maximized .ai-output-toggle {
  flex-shrink: 0;
  margin-bottom: 8px;
}

.tag-validation-modal.is-raw-maximized .ai-output-content.tag-dialog-edit-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-top: 0;
}

.tag-validation-modal.is-raw-maximized textarea.tag-dialog-raw-textarea {
  flex: 1;
  min-height: 160px;
  max-height: none !important;
  height: auto;
  resize: none;
}

.tag-validation-modal.is-raw-maximized .tag-dialog-edit-actions {
  flex-shrink: 0;
  padding: 8px 8px 0;
}

.tag-validation-overlay:has(.tag-validation-modal.is-raw-maximized) {
  align-items: stretch;
  padding: 8px 10px;
  padding-top: calc(36px * var(--ui-scale, 1));
}

.tag-validation-modal .modal-header {
  flex-shrink: 0;
  padding: 10px 14px;

  h2 {
    font-size: 15px;
  }
}

.tag-validation-modal .modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 10px 14px;
  min-height: auto;
}

.tag-validation-modal .modal-footer {
  flex-shrink: 0;
  padding: 10px 14px;
  padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
}

.tag-validation-content {
  .validation-intro {
    font-size: 12px;
    color: #a1a1aa;
    margin: 0 0 4px;
    line-height: 1.35;
  }

  .ai-output-time {
    font-size: 11px;
    margin-bottom: 8px;
    font-family: ui-monospace, monospace;
    opacity: 0.95;
    color: #a1a1aa;
  }

  .tag-status-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;

    @media (max-width: 380px) {
      grid-template-columns: 1fr;
    }
  }

  .tag-status-item {
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.02);
    min-width: 0;

    &.is-valid {
      border-color: rgba(34, 197, 94, 0.3);
      background: rgba(34, 197, 94, 0.05);
    }

    &.is-invalid {
      border-color: rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.05);
    }

    &.is-warning {
      border-color: rgba(234, 179, 8, 0.45);
      background: rgba(234, 179, 8, 0.08);
    }
  }

  .tag-status-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 2px;
  }

  .tag-name {
    font-size: 12px;
    font-weight: 600;
    color: #e4e4e7;
    line-height: 1.25;
    min-width: 0;
  }

  .tag-name-code {
    display: block;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    font-weight: 500;
    opacity: 0.75;
    margin-top: 2px;
    word-break: break-all;
  }

  .tag-badge {
    flex-shrink: 0;
    font-size: 10px;
    padding: 2px 5px;
    border-radius: 4px;
    font-weight: 500;

    &.badge-success {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    &.badge-error {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    &.badge-warning {
      background: rgba(234, 179, 8, 0.18);
      color: #eab308;
    }
  }

  .tag-message {
    font-size: 11px;
    color: #71717a;
    margin: 0;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .validation-duplicate-hint {
    margin-bottom: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(234, 179, 8, 0.12);
    border: 1px solid rgba(234, 179, 8, 0.35);
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 11px;
    color: #eab308;
    line-height: 1.4;

    i {
      font-size: 11px;
      margin-top: 2px;
      flex-shrink: 0;
    }
  }

  .validation-warning {
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 11px;
    color: #f59e0b;

    i {
      font-size: 11px;
      margin-top: 1px;
    }
  }

  .ai-output-section {
    margin-top: 8px;
  }

  .ai-output-toggle {
    font-size: 12px;
    padding: 6px 0;
  }
}

.dark .tag-validation-content {
  .validation-intro { color: #a1a1aa; }
  .ai-output-time { color: #a1a1aa; }
  .tag-name { color: #e4e4e7; }
  .tag-message { color: #71717a; }
}

.light .tag-validation-content {
  .validation-intro { color: #71717a; }
  .ai-output-time { color: #71717a; }
  .tag-name { color: #27272a; }
  .tag-message { color: #a1a1aa; }

  .tag-status-item {
    border-color: rgba(0, 0, 0, 0.1);
    background: #fff;

    &.is-valid {
      border-color: rgba(34, 197, 94, 0.3);
      background: rgba(34, 197, 94, 0.05);
    }

    &.is-invalid {
      border-color: rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.05);
    }

    &.is-warning {
      border-color: rgba(234, 179, 8, 0.45);
      background: rgba(254, 251, 231, 0.95);
    }
  }
}

.tag-validation-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;

  button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px; // 减小按钮 padding
    font-size: 13px; // 减小字体
  }
}

.btn-insert-maintext-tag {
  padding: 6px 10px !important;
  font-size: 12px !important;
  font-family: ui-monospace, 'Consolas', monospace;
}

.btn-rollback {
  background: rgba(239, 68, 68, 0.1) !important;
  color: #ef4444 !important;

  &:hover {
    background: rgba(239, 68, 68, 0.2) !important;
  }
}

.btn-continue {
  background: rgba(245, 158, 11, 0.15) !important;
  color: #f59e0b !important;

  &:hover {
    background: rgba(245, 158, 11, 0.25) !important;
  }
}

// AI 完整输出展示区域
.ai-output-section {
  margin-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: var(--space-md);
}

.tag-dialog-patch-hint {
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  color: #a1a1aa;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.18);
    color: #e4e4e7;
  }

  &:focus-visible {
    outline: 2px solid rgba(161, 161, 170, 0.6);
    outline-offset: 2px;
  }

  &--urgent {
    color: #fecaca;
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(239, 68, 68, 0.45);

    &:hover {
      background: rgba(239, 68, 68, 0.22);
      border-color: rgba(248, 113, 113, 0.55);
      color: #fff;
    }

    &:focus-visible {
      outline-color: rgba(248, 113, 113, 0.7);
    }
  }
}

.light .tag-dialog-patch-hint {
  color: #52525b;
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);

  &:hover {
    background: rgba(0, 0, 0, 0.07);
    border-color: rgba(0, 0, 0, 0.14);
    color: #27272a;
  }
}

.light .tag-dialog-patch-hint.tag-dialog-patch-hint--urgent {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(220, 38, 38, 0.35);

  &:hover {
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(220, 38, 38, 0.5);
    color: #991b1b;
  }
}

.dark .ai-output-section {
  border-color: rgba(255, 255, 255, 0.1);
}

.light .ai-output-section {
  border-color: rgba(0, 0, 0, 0.1);
}

.ai-output-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #a1a1aa;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e4e4e7;
  }

  i {
    font-size: 10px;
    transition: transform 0.2s;
  }

  .output-length {
    margin-left: auto;
    font-size: 11px;
    color: #71717a;
    font-family: monospace;
  }

  &.is-patch-suggested {
    border-color: rgba(239, 68, 68, 0.45);
    color: #fecaca;

    .output-length {
      color: #fca5a5;
    }
  }
}

.dark .ai-output-toggle {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #a1a1aa;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e4e4e7;
  }

  .output-length {
    color: #71717a;
  }
}

.dark .ai-output-toggle.is-patch-suggested {
  border-color: rgba(239, 68, 68, 0.5);
  color: #fecaca;

  .output-length {
    color: #fca5a5;
  }

  &:hover {
    border-color: rgba(248, 113, 113, 0.6);
    color: #fff;
  }
}

.light .ai-output-toggle {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.05);
  color: #71717a;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #27272a;
  }

  .output-length {
    color: #a1a1aa;
  }

  &.is-patch-suggested {
    border-color: rgba(220, 38, 38, 0.4);
    color: #991b1b;

    .output-length {
      color: #b91c1c;
    }
  }
}

.ai-output-content {
  margin-top: 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.dark .ai-output-content {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.light .ai-output-content {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.05);
}

.tag-dialog-edit-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #a1a1aa;
  code {
    font-size: 11px;
  }
}

.light .tag-dialog-edit-hint {
  color: #71717a;
}

.tag-dialog-edit-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-dialog-raw-textarea {
  display: block;
  width: 100%;
  min-height: 200px;
  max-height: min(50vh, 420px);
  box-sizing: border-box;
  border: none;
  border-radius: 0;
  background: transparent;
  resize: vertical;
}

.tag-dialog-edit-actions {
  padding: 0 8px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.btn-recheck-tags {
  font-size: 12px;
}

.ai-output-text {
  margin: 0;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #d4d4d8;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;

  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}

.dark .ai-output-text {
  color: #d4d4d8;

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}

.light .ai-output-text {
  color: #52525b;

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }
}

textarea.ai-output-text.tag-dialog-raw-textarea {
  max-height: min(50vh, 420px);
  min-height: 200px;
}
</style>
