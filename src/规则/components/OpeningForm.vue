<template>
  <div class="opening-form cyber-bg" :class="{ 'dark': isDarkMode, 'light': !isDarkMode }">
    <!-- 赛博朋克特效层 -->
    <ParallaxBackground />
    <TerminalSnippets />
    <CoordinateTracker />

    <!-- 书本容器 -->
    <div class="book-container glass-panel chromatic-border" :class="{ 'flipping': isFlipping }">
      <!-- 破碎玻璃效果 -->
      <ShatteredGlassEffect />

      <!-- HUD 边框装饰 -->
      <div class="hud-decoration">
        <!-- 四角标记 -->
        <div class="corner-mark top-left">TL_01</div>
        <div class="corner-mark top-right">TR_03</div>
        <div class="corner-mark bottom-left">BL_02</div>
        <div class="corner-mark bottom-right">BR_04</div>

        <!-- 顶部 HUD -->
        <div class="hud-top">
          <div class="hud-line left"></div>
          <div class="hud-label">
            <span>[</span>
            <span class="purple">SYS.CORE</span>
            <span class="dim">//</span>
            <span class="cyan">OVERRIDE</span>
            <span>]</span>
          </div>
          <div class="hud-line right"></div>
        </div>

        <!-- 底部 HUD -->
        <div class="hud-bottom">
          <div class="data-blocks left">
            <div v-for="i in 5" :key="i" class="data-block"></div>
          </div>
          <div class="hud-range">0x0000 <span class="dim">-</span> 0xFFFF</div>
          <div class="data-blocks right">
            <div v-for="i in 5" :key="i" class="data-block"></div>
          </div>
        </div>

        <!-- 左侧 HUD -->
        <div class="hud-side left">
          <div class="side-line"></div>
          <div class="side-dots">
            <div v-for="i in 3" :key="i" class="side-dot"></div>
          </div>
          <div class="side-text purple">System.Core.Online</div>
          <div class="side-line"></div>
        </div>

        <!-- 右侧 HUD -->
        <div class="hud-side right">
          <div class="side-line cyan"></div>
          <div class="side-text cyan">Rule.Override.Ready</div>
          <div class="side-dots">
            <div v-for="i in 3" :key="i" class="side-dot cyan"></div>
          </div>
          <div class="side-line cyan"></div>
        </div>

        <!-- 底部数据条 -->
        <div class="data-bars left">
          <div v-for="i in 15" :key="i" class="data-bar" :style="{ height: getRandomHeight() + 'px' }"></div>
        </div>
        <div class="data-bars right">
          <div v-for="i in 15" :key="i" class="data-bar cyan" :style="{ height: getRandomHeight() + 'px' }"></div>
        </div>

        <!-- 刻度尺 -->
        <div class="ruler left">
          <div v-for="i in 20" :key="i" class="ruler-mark" :class="{ long: i % 5 === 0 }"></div>
        </div>
        <div class="ruler right">
          <div v-for="i in 20" :key="i" class="ruler-mark" :class="{ long: i % 5 === 0 }"></div>
        </div>
      </div>

      <!-- 封面 -->
      <div v-if="currentPage === 'cover'" class="book-page cover-page">
        <!-- 左侧系统状态面板 -->
        <div class="system-status-panel">
          <div class="panel-section">
            <div class="section-header">
              <i class="fa-solid fa-microchip"></i>
              <span class="chromatic-text">
                <ScrambleText text="System.Status" />
              </span>
            </div>
            <div class="status-list">
              <div class="status-item">
                <div class="status-label-row">
                  <span class="chromatic-text">
                    <ScrambleText text="Neural Sync" />
                  </span>
                  <span class="status-value">99.9%</span>
                </div>
                <BlockProgress :value="100" :total-segments="20" color="bg-purple-500" />
              </div>
              <div class="status-item">
                <div class="status-label-row">
                  <span class="chromatic-text">
                    <ScrambleText text="Reality Distortion" />
                  </span>
                  <span class="status-value">12.4%</span>
                </div>
                <BlockProgress :value="12" :total-segments="20" color="bg-cyan-500" />
              </div>
              <div class="status-item">
                <div class="status-label-row">
                  <span class="chromatic-text">
                    <ScrambleText text="Active Directives" />
                  </span>
                  <span class="status-value">05</span>
                </div>
                <BlockProgress :value="50" :total-segments="20" color="bg-indigo-500" />
              </div>
            </div>
          </div>

          <div class="panel-section">
            <div class="section-header">
              <i class="fa-solid fa-database"></i>
              <span class="chromatic-text">
                <ScrambleText text="Core.Modules" />
              </span>
            </div>
            <div class="module-tags">
              <span v-for="mod in ['SCENE_GEN', 'RULE_ENFORCE', 'LOG_SYNC', 'MEM_DUMP']" :key="mod" class="module-tag chromatic-text">
                <ScrambleText :text="mod" />
              </span>
            </div>
          </div>
        </div>

        <!-- 中央书本卡片 -->
        <div class="center-card-wrapper">
          <div class="glow-border"></div>
          <div class="center-card glass-panel">
            <div class="card-inner-border"></div>
            <div class="card-content">
              <div class="book-icon-wrapper">
                <div class="icon-glow"></div>
                <i class="fa-solid fa-book-open book-icon"></i>
              </div>
              <h1 class="book-title chromatic-text">
                <ScrambleText text="规则之书" />
              </h1>
              <p class="book-subtitle neon-text">
                <ScrambleText text="Rule.Modifier" />
              </p>
              <p class="book-desc chromatic-text">
                <ScrambleText text="在这个世界，规则即是力量" />
              </p>
            </div>
          </div>

          <!-- 开始按钮 -->
          <div class="start-btn-wrapper">
            <div class="btn-pulse-ring"></div>
            <MagneticButton
              custom-class="start-btn glass-panel chromatic-border chromatic-text"
              @click="goToPage('scene')"
            >
              <ScrambleText text="开始阅读" />
              <i class="fa-solid fa-arrow-right"></i>
            </MagneticButton>
          </div>
        </div>

        <!-- 右侧事件日志面板 -->
        <div class="event-logs-panel">
          <div class="panel-section">
            <div class="section-header">
              <i class="fa-solid fa-hexagon"></i>
              <span class="chromatic-text">
                <ScrambleText text="Event.Logs" />
              </span>
            </div>
            <div class="logs-list">
              <div v-for="(log, i) in eventLogs" :key="i" class="log-item">
                <span class="log-time">[{{ log.time }}]</span>
                <span class="log-msg" :class="{ highlight: log.highlight }">
                  <ScrambleText :text="log.msg" />
                </span>
              </div>
            </div>
          </div>

          <div class="panel-section">
            <div class="section-header">
              <i class="fa-solid fa-database"></i>
              <span class="chromatic-text">
                <ScrambleText text="Quick.Stats" />
              </span>
            </div>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value cyan">24</div>
                <div class="stat-label chromatic-text">
                  <ScrambleText text="Scenes" />
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-value purple">128</div>
                <div class="stat-label chromatic-text">
                  <ScrambleText text="Rules" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部工具栏 -->
        <div class="bottom-tools">
          <MagneticButton
            v-for="tool in bottomTools"
            :key="tool.action"
            custom-class="tool-btn glass-panel chromatic-text"
            @click="tool.handler"
          >
            <i :class="tool.icon"></i>
            <ScrambleText :text="tool.label" />
          </MagneticButton>
        </div>

      </div>

      <!-- 场景选择页 -->
      <div v-else-if="currentPage === 'scene'" class="book-page content-page">
        <div class="page-header">
          <button class="nav-btn back-btn" @click="goToPage('cover')">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span class="page-number">场景</span>
          <button class="nav-btn next-btn" @click="goToPage('rules')">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        <div class="page-content">
          <h2 class="chapter-title">场景</h2>
          <p class="chapter-desc">选择故事发生的地点与氛围...</p>

          <div class="scene-grid">
            <div
              v-for="scene in sceneOptions"
              :key="scene.id"
              class="scene-card"
              :class="{ active: selectedScene?.id === scene.id }"
              @click="selectScene(scene)"
            >
              <div class="scene-icon">
                <i :class="scene.icon"></i>
              </div>
              <h3 class="scene-name">{{ scene.name }}</h3>
              <p class="scene-desc">{{ scene.desc }}</p>
            </div>
          </div>

          <div class="library-toolbar">
            <button type="button" class="library-toolbar-btn" @click="sceneSnippetPickerOpen = true">
              <i class="fa-solid fa-map-location-dot"></i>
              从场景库取用
            </button>
            <button type="button" class="library-toolbar-btn" @click="saveNewSceneToLibrary">
              <i class="fa-solid fa-bookmark"></i>
              将当前描述加入场景库
            </button>
          </div>

          <div class="custom-scene">
            <label class="custom-label">或创建自定义场景</label>
            <textarea
              v-model="customSceneDesc"
              class="custom-textarea"
              placeholder="描述你想要的场景（如：一座漂浮在云端的魔法学院，学生们正在上课...）"
              rows="3"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 规则选择页 -->
      <div v-else-if="currentPage === 'rules'" class="book-page content-page">
        <div class="page-header">
          <button class="nav-btn back-btn" @click="goToPage('scene')">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span class="page-number">世界规则</span>
          <button class="nav-btn next-btn" @click="goToPage('characters')">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        <div class="page-content">
          <h2 class="chapter-title">世界规则</h2>
          <p class="chapter-desc">选择将在世界中生效的基础法则...</p>

          <div class="rules-section">
            <h3 class="section-title">预设规则</h3>
            <div class="rules-list">
              <label
                v-for="rule in presetRules"
                :key="rule.id"
                class="rule-item"
                :class="{ checked: selectedRules.includes(rule.id) }"
              >
                <div class="rule-checkbox">
                  <input
                    type="checkbox"
                    :value="rule.id"
                    v-model="selectedRules"
                  />
                  <span class="check-mark">
                    <i class="fa-solid fa-check"></i>
                  </span>
                </div>
                <div class="rule-info">
                  <span class="rule-name">{{ rule.name }}</span>
                  <span class="rule-desc">{{ rule.desc }}</span>
                </div>
              </label>
            </div>
          </div>

          <div class="custom-rules-section">
            <h3 class="section-title">自定义规则</h3>
            <div class="library-toolbar">
              <button type="button" class="library-toolbar-btn" @click="ruleSnippetPickerOpen = true">
                <i class="fa-solid fa-box-archive"></i>
                从规则库添加
              </button>
              <button type="button" class="library-toolbar-btn" @click="saveNewRuleToLibrary">
                <i class="fa-solid fa-bookmark"></i>
                将表单加入规则库
              </button>
            </div>
            <div class="custom-rule-input">
              <input
                v-model="newRuleName"
                type="text"
                placeholder="规则名称"
                class="rule-name-input"
              />
              <textarea
                v-model="newRuleDesc"
                placeholder="规则效果描述"
                rows="2"
                class="rule-desc-input"
              ></textarea>
              <button class="add-rule-btn" @click="addCustomRule">
                <i class="fa-solid fa-plus"></i>
                添加规则
              </button>
            </div>
            <div v-if="customRules.length > 0" class="custom-rules-list">
              <div
                v-for="(rule, index) in customRules"
                :key="index"
                class="custom-rule-item"
              >
                <div class="custom-rule-info">
                  <span class="custom-rule-name">{{ rule.name }}</span>
                  <span class="custom-rule-desc">{{ rule.desc }}</span>
                </div>
                <div class="custom-rule-actions">
                  <button
                    type="button"
                    class="library-mini-btn"
                    title="存入规则库"
                    @click="saveRuleRowToLibrary(rule)"
                  >
                    <i class="fa-solid fa-bookmark"></i>
                  </button>
                  <button type="button" class="remove-btn" @click="removeCustomRule(index)">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 人物添加页 -->
      <div v-else-if="currentPage === 'characters'" class="book-page content-page">
        <div class="page-header">
          <button class="nav-btn back-btn" @click="goToPage('rules')">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span class="page-number">角色</span>
          <button class="nav-btn next-btn" @click="goToPage('opening_detail')">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        <div class="page-content">
          <h2 class="chapter-title">角色</h2>
          <p class="chapter-desc">为你的故事添加一些重要人物...</p>

          <div class="library-toolbar library-toolbar--characters">
            <button type="button" class="library-toolbar-btn" @click="characterSnippetPickerOpen = true">
              <i class="fa-solid fa-box-archive"></i>
              从角色库添加
            </button>
            <button type="button" class="library-toolbar-btn" @click="saveNewCharToLibrary">
              <i class="fa-solid fa-bookmark"></i>
              将表单加入角色库
            </button>
          </div>

          <div class="character-form">
            <div class="form-row">
              <input
                v-model="newCharName"
                type="text"
                placeholder="角色姓名"
                class="char-name-input"
              />
              <select v-model="newCharGender" class="char-gender-select">
                <option value="female">女性</option>
                <option value="male">男性</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div class="form-row">
              <textarea
                v-model="newCharDesc"
                placeholder="角色描述：外貌、性格、身份等..."
                rows="3"
                class="char-desc-input"
              ></textarea>
            </div>
            <div class="form-actions-row">
              <button class="add-char-btn" @click="addCharacter">
                <i class="fa-solid fa-user-plus"></i>
                <span>添加角色</span>
              </button>
            </div>
          </div>

          <div v-if="characters.length > 0" class="characters-list">
            <h3 class="section-title">已添加角色</h3>
            <div class="char-cards">
              <div
                v-for="(char, index) in characters"
                :key="index"
                class="char-card"
              >
                <div class="char-avatar">
                  <i :class="char.gender === 'male' ? 'fa-solid fa-user' : 'fa-solid fa-user-secret'"></i>
                </div>
                <div class="char-info">
                  <span class="char-name">{{ char.name }}</span>
                  <span class="char-desc">{{ char.desc }}</span>
                </div>
                <div class="custom-rule-actions">
                  <button
                    type="button"
                    class="library-mini-btn"
                    title="存入角色库"
                    @click="saveCharRowToLibrary(char)"
                  >
                    <i class="fa-solid fa-bookmark"></i>
                  </button>
                  <button type="button" class="remove-btn" @click="removeCharacter(index)">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-hint">
            <i class="fa-solid fa-users"></i>
            <p>还没有添加角色</p>
            <span>可以直接开始游戏，或添加角色丰富剧情</span>
          </div>
        </div>
      </div>

      <!-- 开场白细化页 -->
      <div v-else-if="currentPage === 'opening_detail'" class="book-page content-page">
        <div class="page-header">
          <button class="nav-btn back-btn" @click="goToPage('characters')">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span class="page-number">开局场景</span>
          <button class="nav-btn next-btn" @click="goToPage('confirm')">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        <div class="page-content">
          <h2 class="chapter-title">开局场景</h2>
          <p class="chapter-desc">你可以在这里补全更详细的开局画面、氛围、镜头与细节（会追加到开局第一句后）。</p>

          <div class="library-toolbar">
            <button type="button" class="library-toolbar-btn" @click="openingSceneSnippetPickerOpen = true">
              <i class="fa-solid fa-clapperboard"></i>
              从开局场景库取用
            </button>
            <button type="button" class="library-toolbar-btn" @click="saveNewOpeningSceneToLibrary">
              <i class="fa-solid fa-bookmark"></i>
              将当前描述加入开局场景库
            </button>
          </div>

          <div class="custom-scene">
            <label class="custom-label">开局场景描述（可选）</label>
            <textarea
              v-model="openingSceneDetail"
              class="custom-textarea"
              placeholder="例如：时间（清晨/雨夜）、光线、气味、背景人群、你希望开局第一幕出现的关键物件/事件..."
              rows="6"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 确认页 -->
      <div v-else-if="currentPage === 'confirm'" class="book-page content-page confirm-page">
        <div class="page-header">
          <button class="nav-btn back-btn" @click="goToPage('opening_detail')">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span class="page-number">开局场景准备开始~</span>
          <div class="nav-btn placeholder"></div>
        </div>
        <div class="page-content confirm-content">
          <h2 class="chapter-title">开局场景准备开始~</h2>
          <p class="chapter-desc">确认你的设定，开启这段旅程...</p>

          <div class="summary-section">
            <div class="summary-item">
              <span class="summary-label">场景</span>
              <span class="summary-value">{{ selectedScene?.name || '自定义场景' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">开局场景细节</span>
              <span class="summary-value">{{ openingSceneDetail.trim() ? '已填写' : '未填写' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">规则数量</span>
              <span class="summary-value">{{ totalRulesCount }} 条</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">角色数量</span>
              <span class="summary-value">{{ characters.length }} 人</span>
            </div>
          </div>

          <div class="confirm-bottom">
            <div class="confirm-presets-bar">
              <button type="button" class="preset-action-btn cyber-preset-btn" @click="savePresetDialogOpen = true">
                <i class="fa-solid fa-floppy-disk"></i>
                <span>保存为开场预设</span>
              </button>
              <button type="button" class="preset-action-btn cyber-preset-btn" @click="presetPickerOpen = true">
                <i class="fa-solid fa-folder-open"></i>
                <span>读取开场预设</span>
              </button>
            </div>
            <div class="confirm-actions">
              <button
                class="confirm-btn cyber-start-btn"
                :disabled="!canSubmit || isSubmitting"
                @click="handleSubmit"
              >
                <span class="btn-glow"></span>
                <span class="btn-content">
                  <i v-if="isSubmitting" class="fa-solid fa-circle-notch fa-spin"></i>
                  <span v-else>
                    <i class="fa-solid fa-play"></i>
                    开始游戏
                  </span>
                </span>
                <span class="btn-particles">
                  <span class="particle"></span>
                  <span class="particle"></span>
                  <span class="particle"></span>
                </span>
              </button>
              <p v-if="!canSubmit" class="hint-text">请选择一个场景或填写自定义场景描述</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 左下角：清理按钮（展开三个选项） -->
    <div class="opening-bottom-left-stack">
      <button type="button" class="chronicle-clear-btn" @click="clearMenuOpen = true">
        <i class="fa-solid fa-broom"></i>
        <span>清理</span>
      </button>
    </div>

    <!-- 系统设置（与主界面一致，可切换单/双 API） -->
    <button
      type="button"
      class="opening-settings-btn"
      title="系统设置"
      aria-label="系统设置"
      @click="emit('open-settings')"
    >
      <i class="fa-solid fa-gear" aria-hidden="true"></i>
    </button>

    <!-- 主题切换按钮 -->
    <button class="theme-toggle" @click="isDarkMode = !isDarkMode">
      <i :class="isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
    </button>

    <!-- 清理菜单（包含三个选项） -->
    <div
      v-if="clearMenuOpen"
      class="chronicle-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-menu-title"
      @click.self="clearMenuOpen = false"
    >
      <div class="chronicle-dialog-panel opening-dialog-panel--wide">
        <h3 id="clear-menu-title" class="chronicle-dialog-title">清理选项</h3>
        <p class="chronicle-dialog-desc">
          选择要清理的内容。这些操作仅影响浏览器缓存和世界书数据，不会删除聊天记录。
        </p>

        <!-- 三个清理选项 -->
        <div class="clear-options-list">
          <!-- 清理头像缓存 -->
          <div class="clear-option-item">
            <div class="clear-option-info">
              <div class="clear-option-title">
                <i class="fa-solid fa-image"></i>
                <span>清理浏览器头像缓存</span>
              </div>
              <div class="clear-option-desc">清除本地保存的角色头像自定义设置</div>
            </div>
            <button
              type="button"
              class="chronicle-dialog-btn danger"
              :disabled="clearCacheLoading"
              @click="onConfirmClearCache"
            >
              <i v-if="clearCacheLoading" class="fa-solid fa-circle-notch fa-spin"></i>
              <span v-else>清理</span>
            </button>
          </div>

          <!-- 清理编年史 -->
          <div class="clear-option-item">
            <div class="clear-option-info">
              <div class="clear-option-title">
                <i class="fa-solid fa-scroll"></i>
                <span>清理编年史</span>
              </div>
              <div class="clear-option-desc">清空世界书中「编年史」条目的全部正文内容</div>
            </div>
            <button
              type="button"
              class="chronicle-dialog-btn danger"
              :disabled="clearChronicleLoading"
              @click="onConfirmClearChronicle"
            >
              <i v-if="clearChronicleLoading" class="fa-solid fa-circle-notch fa-spin"></i>
              <span v-else>清理</span>
            </button>
          </div>

          <!-- 清理额外世界书 -->
          <div class="clear-option-item">
            <div class="clear-option-info">
              <div class="clear-option-title">
                <i class="fa-solid fa-book-open"></i>
                <span>清理额外世界书</span>
              </div>
              <div class="clear-option-desc">删除所有以 ms 结尾的临时世界书（如 规则模拟器V0.7 - ...ms）</div>
            </div>
            <button
              type="button"
              class="chronicle-dialog-btn danger"
              :disabled="clearMsWorldbooksLoading"
              @click="onConfirmClearMsWorldbooks"
            >
              <i v-if="clearMsWorldbooksLoading" class="fa-solid fa-circle-notch fa-spin"></i>
              <span v-else>清理</span>
            </button>
          </div>
        </div>

        <div class="chronicle-dialog-actions">
          <button type="button" class="chronicle-dialog-btn cancel" @click="clearMenuOpen = false">
            关闭
          </button>
        </div>
      </div>
    </div>

    <input
      ref="importFileInputRef"
      type="file"
      accept="application/json,.json"
      class="visually-hidden"
      tabindex="-1"
      @change="onImportFileChange"
    />

    <!-- 选择开场预设 -->
    <div
      v-if="presetPickerOpen"
      class="chronicle-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-picker-title"
      @click.self="presetPickerOpen = false"
    >
      <div class="chronicle-dialog-panel opening-dialog-panel opening-dialog-panel--wide">
        <h3 id="preset-picker-title" class="chronicle-dialog-title">选择开场预设</h3>
        <p class="chronicle-dialog-desc">点击「应用」将覆盖当前表单中的场景、规则与角色。</p>
        <div v-if="presets.length === 0" class="opening-dialog-empty">暂无保存的预设</div>
        <ul v-else class="opening-dialog-list opening-dialog-list--scroll">
          <li v-for="p in presets" :key="p.id" class="opening-dialog-list-item">
            <div class="opening-dialog-list-main">
              <span class="opening-dialog-list-name">{{ p.name }}</span>
              <span class="opening-dialog-list-meta">{{ formatPresetDate(p.createdAt) }}</span>
            </div>
            <div class="opening-dialog-list-actions">
              <button type="button" class="chronicle-dialog-btn" @click="applyOpeningPreset(p)">应用</button>
              <button type="button" class="chronicle-dialog-btn danger" @click="removePreset(p.id)">删除</button>
            </div>
          </li>
        </ul>
        <div class="chronicle-dialog-actions">
          <button type="button" class="chronicle-dialog-btn cancel" @click="presetPickerOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 保存开场预设 -->
    <div
      v-if="savePresetDialogOpen"
      class="chronicle-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-preset-title"
      @click.self="savePresetDialogOpen = false"
    >
      <div class="chronicle-dialog-panel opening-dialog-panel">
        <h3 id="save-preset-title" class="chronicle-dialog-title">保存为开场预设</h3>
        <input
          v-model="presetSaveName"
          type="text"
          class="opening-dialog-input"
          placeholder="预设名称"
          @keydown.enter.prevent="confirmSavePreset"
        />
        <div class="chronicle-dialog-actions">
          <button type="button" class="chronicle-dialog-btn cancel" @click="savePresetDialogOpen = false">取消</button>
          <button type="button" class="chronicle-dialog-btn" @click="confirmSavePreset">保存</button>
        </div>
      </div>
    </div>

    <!-- 规则库 -->
    <div
      v-if="ruleSnippetPickerOpen"
      class="chronicle-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="ruleSnippetPickerOpen = false"
    >
      <div class="chronicle-dialog-panel opening-dialog-panel opening-dialog-panel--wide">
        <h3 class="chronicle-dialog-title">规则库</h3>
        <p class="chronicle-dialog-desc">点击「添加」加入当前自定义规则列表。</p>
        <div v-if="ruleSnippets.length === 0" class="opening-dialog-empty">规则库为空，可先在表单填写后点「将表单加入规则库」</div>
        <ul v-else class="opening-dialog-list opening-dialog-list--scroll">
          <li v-for="s in ruleSnippets" :key="s.id" class="opening-dialog-list-item opening-dialog-list-item--stack">
            <div class="opening-dialog-list-main">
              <span class="opening-dialog-list-name">{{ s.name }}</span>
              <span class="opening-dialog-list-preview">{{ s.desc }}</span>
            </div>
            <div class="opening-dialog-list-actions">
              <button type="button" class="chronicle-dialog-btn" @click="addRuleFromLibrary(s)">添加</button>
              <button type="button" class="chronicle-dialog-btn danger" @click="removeRuleSnippet(s.id)">删除</button>
            </div>
          </li>
        </ul>
        <div class="chronicle-dialog-actions">
          <button type="button" class="chronicle-dialog-btn cancel" @click="ruleSnippetPickerOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 角色库 -->
    <div
      v-if="characterSnippetPickerOpen"
      class="chronicle-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="characterSnippetPickerOpen = false"
    >
      <div class="chronicle-dialog-panel opening-dialog-panel opening-dialog-panel--wide">
        <h3 class="chronicle-dialog-title">角色库</h3>
        <p class="chronicle-dialog-desc">点击「添加」加入当前角色列表。</p>
        <div v-if="characterSnippets.length === 0" class="opening-dialog-empty">角色库为空</div>
        <ul v-else class="opening-dialog-list opening-dialog-list--scroll">
          <li v-for="s in characterSnippets" :key="s.id" class="opening-dialog-list-item opening-dialog-list-item--stack">
            <div class="opening-dialog-list-main">
              <span class="opening-dialog-list-name">{{ s.name }} · {{ genderLabel(s.gender) }}</span>
              <span class="opening-dialog-list-preview">{{ s.desc }}</span>
            </div>
            <div class="opening-dialog-list-actions">
              <button type="button" class="chronicle-dialog-btn" @click="addCharacterFromLibrary(s)">添加</button>
              <button type="button" class="chronicle-dialog-btn danger" @click="removeCharacterSnippet(s.id)">删除</button>
            </div>
          </li>
        </ul>
        <div class="chronicle-dialog-actions">
          <button type="button" class="chronicle-dialog-btn cancel" @click="characterSnippetPickerOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 场景库（故事场景 / 自定义场景描述） -->
    <div
      v-if="sceneSnippetPickerOpen"
      class="chronicle-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="sceneSnippetPickerOpen = false"
    >
      <div class="chronicle-dialog-panel opening-dialog-panel opening-dialog-panel--wide">
        <h3 class="chronicle-dialog-title">场景库</h3>
        <p class="chronicle-dialog-desc">取用后会切换到「自定义场景」并填入下方文案（会取消已选卡片场景）。</p>
        <div v-if="sceneSnippets.length === 0" class="opening-dialog-empty">场景库为空，先在「或创建自定义场景」中写好描述后点「将当前描述加入场景库」</div>
        <ul v-else class="opening-dialog-list opening-dialog-list--scroll">
          <li v-for="s in sceneSnippets" :key="s.id" class="opening-dialog-list-item opening-dialog-list-item--stack">
            <div class="opening-dialog-list-main">
              <span class="opening-dialog-list-name">{{ s.name }}</span>
              <span class="opening-dialog-list-preview">{{ s.desc }}</span>
            </div>
            <div class="opening-dialog-list-actions">
              <button type="button" class="chronicle-dialog-btn" @click="addSceneFromLibrary(s)">取用</button>
              <button type="button" class="chronicle-dialog-btn danger" @click="removeSceneSnippet(s.id)">删除</button>
            </div>
          </li>
        </ul>
        <div class="chronicle-dialog-actions">
          <button type="button" class="chronicle-dialog-btn cancel" @click="sceneSnippetPickerOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 开局场景库 -->
    <div
      v-if="openingSceneSnippetPickerOpen"
      class="chronicle-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="openingSceneSnippetPickerOpen = false"
    >
      <div class="chronicle-dialog-panel opening-dialog-panel opening-dialog-panel--wide">
        <h3 class="chronicle-dialog-title">开局场景库</h3>
        <p class="chronicle-dialog-desc">点击「取用」将替换当前页的开局场景描述。</p>
        <div v-if="openingSceneSnippets.length === 0" class="opening-dialog-empty">开局场景库为空</div>
        <ul v-else class="opening-dialog-list opening-dialog-list--scroll">
          <li v-for="s in openingSceneSnippets" :key="s.id" class="opening-dialog-list-item opening-dialog-list-item--stack">
            <div class="opening-dialog-list-main">
              <span class="opening-dialog-list-name">{{ s.name }}</span>
              <span class="opening-dialog-list-preview">{{ s.desc }}</span>
            </div>
            <div class="opening-dialog-list-actions">
              <button type="button" class="chronicle-dialog-btn" @click="addOpeningSceneFromLibrary(s)">取用</button>
              <button type="button" class="chronicle-dialog-btn danger" @click="removeOpeningSceneSnippet(s.id)">删除</button>
            </div>
          </li>
        </ul>
        <div class="chronicle-dialog-actions">
          <button type="button" class="chronicle-dialog-btn cancel" @click="openingSceneSnippetPickerOpen = false">关闭</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { OpeningFormData } from '../types';

// 赛博朋克特效组件
import ParallaxBackground from './ParallaxBackground.vue';
import TerminalSnippets from './TerminalSnippets.vue';
import CoordinateTracker from './CoordinateTracker.vue';
import ShatteredGlassEffect from './ShatteredGlassEffect.vue';
import MagneticButton from './MagneticButton.vue';
import ScrambleText from './ScrambleText.vue';
import BlockProgress from './BlockProgress.vue';
import { clearChronicle } from '../utils/chronicleUpdater';
import { clearOpeningUiCache } from '../utils/clearUiCache';
import { deleteAllMsWorldbooks } from '../../小手机壳/utils/worldbookMatcher';
import {
  type RuleSnippet,
  type CharacterSnippet,
  type SceneSnippet,
  type OpeningSceneSnippet,
  type OpeningPreset,
  type OpeningPresetPayload,
  createStorageId,
  loadOpeningStorage,
  saveOpeningStorage,
  downloadOpeningStorageJson,
  parseOpeningStorageJson,
} from '../utils/openingStorage';

const emit = defineEmits<{
  (e: 'submit', data: OpeningFormData): void;
  (e: 'open-settings'): void;
}>();

// 主题
const isDarkMode = ref(true);

// 事件日志数据
const eventLogs = [
  { time: '00:00', msg: 'System initialized.', highlight: false },
  { time: '00:01', msg: 'Reality anchor stabilized.', highlight: false },
  { time: '00:03', msg: 'Awaiting user input...', highlight: true },
];

// 底部工具按钮
const bottomTools = [
  { action: 'preset', label: '读取开场预设', icon: 'fa-solid fa-database', handler: () => presetPickerOpen.value = true },
  { action: 'export', label: '导出 JSON', icon: 'fa-solid fa-upload', handler: onExportJson },
  { action: 'import', label: '导入 JSON', icon: 'fa-solid fa-download', handler: onPickImportJson },
];

// 随机高度（数据条动画）
const getRandomHeight = () => Math.floor(Math.random() * 30) + 10;

// 页面状态
const currentPage = ref<'cover' | 'scene' | 'rules' | 'characters' | 'opening_detail' | 'confirm'>('cover');
const isFlipping = ref(false);

// 场景选项
const sceneOptions = [
  { id: 'school', name: '圣华女子学院', desc: '一所 prestigious 的贵族女子学校，学生们都在这里接受精英教育', icon: 'fa-solid fa-school' },
  { id: 'office', name: '未来科技公司', desc: '一家高科技公司，员工们在这里开发着改变世界的技术', icon: 'fa-solid fa-building' },
  { id: 'hospital', name: '圣玛利亚医院', desc: '一家大型综合医院，各种离奇的故事在这里发生', icon: 'fa-solid fa-hospital' },
  { id: 'apartment', name: '樱庄公寓', desc: '一栋普通的公寓楼，住着形形色色的租客', icon: 'fa-solid fa-house-chimney' },
  { id: 'castle', name: '夜之城堡', desc: '一座神秘的古老城堡，传说中住着吸血鬼', icon: 'fa-solid fa-chess-rook' },
];

// 预设规则
const presetRules = [
  { id: 'rule_001', name: '下克上', desc: '上级会无条件的听从下级的指令' },
  { id: 'rule_002', name: '喵喵口癖', desc: '所有女性说话都会以喵结尾。' },
  { id: 'rule_003', name: '真空', desc: '所有人都真空，不穿任何内衣内裤。' },
  { id: 'rule_004', name: '裸足', desc: '所有人都会保持裸足，同时足部不会弄脏。' },
  { id: 'rule_005', name: '反差', desc: '每个人都会有一个反差极大的隐藏性癖' },
  { id: 'rule_006', name: '敏感强化', desc: '所有人的敏感度都会提升三倍。' },
];

// 数据
const selectedScene = ref<typeof sceneOptions[0] | null>(null);
const customSceneDesc = ref('');
const openingSceneDetail = ref('');
const selectedRules = ref<string[]>(['rule_001', 'rule_002']); // 默认选中前两条
const customRules = ref<{ name: string; desc: string }[]>([]);
const characters = ref<{ name: string; gender: string; desc: string }[]>([]);

// 新增数据
const newRuleName = ref('');
const newRuleDesc = ref('');
const newCharName = ref('');
const newCharGender = ref('female');
const newCharDesc = ref('');

// 提交状态
const isSubmitting = ref(false);

const clearMenuOpen = ref(false);
const clearChronicleLoading = ref(false);
const clearCacheLoading = ref(false);
const clearMsWorldbooksLoading = ref(false);

// —— localStorage：规则库 / 角色库 / 场景库 / 开局场景库 / 开场预设 ——
const ruleSnippets = ref<RuleSnippet[]>([]);
const characterSnippets = ref<CharacterSnippet[]>([]);
const sceneSnippets = ref<SceneSnippet[]>([]);
const openingSceneSnippets = ref<OpeningSceneSnippet[]>([]);
const presets = ref<OpeningPreset[]>([]);

const presetPickerOpen = ref(false);
const savePresetDialogOpen = ref(false);
const presetSaveName = ref('');
const ruleSnippetPickerOpen = ref(false);
const characterSnippetPickerOpen = ref(false);
const sceneSnippetPickerOpen = ref(false);
const openingSceneSnippetPickerOpen = ref(false);
const importFileInputRef = ref<HTMLInputElement | null>(null);

function persistOpeningStorage() {
  saveOpeningStorage({
    version: 1,
    ruleSnippets: ruleSnippets.value,
    characterSnippets: characterSnippets.value,
    sceneSnippets: sceneSnippets.value,
    openingSceneSnippets: openingSceneSnippets.value,
    presets: presets.value,
  });
}

onMounted(() => {
  const s = loadOpeningStorage();
  ruleSnippets.value = s.ruleSnippets;
  characterSnippets.value = s.characterSnippets;
  sceneSnippets.value = s.sceneSnippets;
  openingSceneSnippets.value = s.openingSceneSnippets;
  presets.value = s.presets;
});

watch(
  [ruleSnippets, characterSnippets, sceneSnippets, openingSceneSnippets, presets],
  persistOpeningStorage,
  { deep: true },
);

function capturePresetPayload(): OpeningPresetPayload {
  return {
    sceneMode: selectedScene.value ? 'preset' : 'custom',
    sceneId: selectedScene.value?.id ?? null,
    customSceneDesc: customSceneDesc.value,
    selectedRules: [...selectedRules.value],
    customRules: customRules.value.map(r => ({ name: r.name, desc: r.desc })),
    characters: characters.value.map(c => ({ name: c.name, gender: c.gender, desc: c.desc })),
    openingSceneDetail: openingSceneDetail.value,
  };
}

function applyPresetPayload(p: OpeningPresetPayload) {
  openingSceneDetail.value = p.openingSceneDetail ?? '';
  selectedRules.value = [...p.selectedRules];
  customRules.value = p.customRules.map(r => ({ name: r.name, desc: r.desc }));
  characters.value = p.characters.map(c => ({
    name: c.name,
    gender: c.gender,
    desc: c.desc,
  }));

  if (p.sceneMode === 'preset' && p.sceneId) {
    const sc = sceneOptions.find(s => s.id === p.sceneId);
    if (sc) {
      selectedScene.value = sc;
      customSceneDesc.value = '';
    } else {
      selectedScene.value = null;
      customSceneDesc.value = p.customSceneDesc ?? '';
    }
  } else {
    selectedScene.value = null;
    customSceneDesc.value = p.customSceneDesc ?? '';
  }
}

function formatPresetDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function genderLabel(g: string) {
  if (g === 'male') return '男';
  if (g === 'other') return '其他';
  return '女';
}

function ruleSnippetKey(name: string, desc: string) {
  return `${name.trim()}\n${desc.trim()}`;
}

function saveNewRuleToLibrary() {
  const name = newRuleName.value.trim();
  const desc = newRuleDesc.value.trim();
  if (!name || !desc) {
    toastr.warning('请先在表单中填写完整的规则名称和描述');
    return;
  }
  const key = ruleSnippetKey(name, desc);
  if (ruleSnippets.value.some(s => ruleSnippetKey(s.name, s.desc) === key)) {
    toastr.info('规则库中已有相同条目');
    return;
  }
  ruleSnippets.value.push({ id: createStorageId(), name, desc });
  toastr.success('已加入规则库');
}

function saveRuleRowToLibrary(rule: { name: string; desc: string }) {
  const key = ruleSnippetKey(rule.name, rule.desc);
  if (ruleSnippets.value.some(s => ruleSnippetKey(s.name, s.desc) === key)) {
    toastr.info('规则库中已有相同条目');
    return;
  }
  ruleSnippets.value.push({ id: createStorageId(), name: rule.name, desc: rule.desc });
  toastr.success('已加入规则库');
}

function addRuleFromLibrary(s: RuleSnippet) {
  customRules.value.push({ name: s.name, desc: s.desc });
  toastr.success('已添加规则');
}

function removeRuleSnippet(id: string) {
  ruleSnippets.value = ruleSnippets.value.filter(x => x.id !== id);
  toastr.success('已从规则库删除');
}

function charSnippetKey(name: string, gender: string, desc: string) {
  return `${name.trim()}\n${gender}\n${desc.trim()}`;
}

function saveNewCharToLibrary() {
  const name = newCharName.value.trim();
  const desc = newCharDesc.value.trim();
  if (!name || !desc) {
    toastr.warning('请先在表单中填写完整的角色信息');
    return;
  }
  const key = charSnippetKey(name, newCharGender.value, desc);
  if (characterSnippets.value.some(s => charSnippetKey(s.name, s.gender, s.desc) === key)) {
    toastr.info('角色库中已有相同条目');
    return;
  }
  characterSnippets.value.push({
    id: createStorageId(),
    name,
    gender: newCharGender.value,
    desc,
  });
  toastr.success('已加入角色库');
}

function saveCharRowToLibrary(char: { name: string; gender: string; desc: string }) {
  const key = charSnippetKey(char.name, char.gender, char.desc);
  if (characterSnippets.value.some(s => charSnippetKey(s.name, s.gender, s.desc) === key)) {
    toastr.info('角色库中已有相同条目');
    return;
  }
  characterSnippets.value.push({
    id: createStorageId(),
    name: char.name,
    gender: char.gender,
    desc: char.desc,
  });
  toastr.success('已加入角色库');
}

function addCharacterFromLibrary(s: CharacterSnippet) {
  characters.value.push({
    name: s.name,
    gender: s.gender,
    desc: s.desc,
  });
  toastr.success('已添加角色');
}

function removeCharacterSnippet(id: string) {
  characterSnippets.value = characterSnippets.value.filter(x => x.id !== id);
  toastr.success('已从角色库删除');
}

function autoSnippetTitle(text: string, maxLen = 40) {
  const t = text.trim();
  const firstLine = (t.split(/\r?\n/)[0] ?? t).trim();
  if (!firstLine) return '未命名';
  return firstLine.length > maxLen ? `${firstLine.slice(0, maxLen)}…` : firstLine;
}

function sceneBodyKey(body: string) {
  return body.trim();
}

function saveNewSceneToLibrary() {
  const body = customSceneDesc.value.trim();
  if (!body) {
    toastr.warning('请先在「或创建自定义场景」中填写描述');
    return;
  }
  const key = sceneBodyKey(body);
  if (sceneSnippets.value.some(s => sceneBodyKey(s.desc) === key)) {
    toastr.info('场景库中已有相同文案');
    return;
  }
  sceneSnippets.value.push({
    id: createStorageId(),
    name: autoSnippetTitle(body),
    desc: body,
  });
  toastr.success('已加入场景库');
}

function addSceneFromLibrary(s: SceneSnippet) {
  selectedScene.value = null;
  customSceneDesc.value = s.desc;
  sceneSnippetPickerOpen.value = false;
  toastr.success('已取用场景');
}

function removeSceneSnippet(id: string) {
  sceneSnippets.value = sceneSnippets.value.filter(x => x.id !== id);
  toastr.success('已从场景库删除');
}

function saveNewOpeningSceneToLibrary() {
  const body = openingSceneDetail.value.trim();
  if (!body) {
    toastr.warning('请先填写开局场景描述');
    return;
  }
  const key = sceneBodyKey(body);
  if (openingSceneSnippets.value.some(s => sceneBodyKey(s.desc) === key)) {
    toastr.info('开局场景库中已有相同文案');
    return;
  }
  openingSceneSnippets.value.push({
    id: createStorageId(),
    name: autoSnippetTitle(body),
    desc: body,
  });
  toastr.success('已加入开局场景库');
}

function addOpeningSceneFromLibrary(s: OpeningSceneSnippet) {
  openingSceneDetail.value = s.desc;
  openingSceneSnippetPickerOpen.value = false;
  toastr.success('已取用开局场景');
}

function removeOpeningSceneSnippet(id: string) {
  openingSceneSnippets.value = openingSceneSnippets.value.filter(x => x.id !== id);
  toastr.success('已从开局场景库删除');
}

function confirmSavePreset() {
  const name = presetSaveName.value.trim();
  if (!name) {
    toastr.warning('请填写预设名称');
    return;
  }
  presets.value.push({
    id: createStorageId(),
    name,
    createdAt: new Date().toISOString(),
    payload: capturePresetPayload(),
  });
  presetSaveName.value = '';
  savePresetDialogOpen.value = false;
  toastr.success('开场预设已保存');
}

function applyOpeningPreset(p: OpeningPreset) {
  applyPresetPayload(p.payload);
  presetPickerOpen.value = false;
  toastr.success(`已应用预设：${p.name}`);
  // 应用预设后直接跳转到确认页（最后一页）
  goToPage('confirm');
}

function removePreset(id: string) {
  presets.value = presets.value.filter(x => x.id !== id);
  toastr.success('已删除预设');
}

function onExportJson() {
  downloadOpeningStorageJson({
    version: 1,
    ruleSnippets: ruleSnippets.value,
    characterSnippets: characterSnippets.value,
    sceneSnippets: sceneSnippets.value,
    openingSceneSnippets: openingSceneSnippets.value,
    presets: presets.value,
  });
  toastr.success('已开始下载 JSON 文件');
}

function onPickImportJson() {
  importFileInputRef.value?.click();
}

function onImportFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === 'string' ? reader.result : '';
    const parsed = parseOpeningStorageJson(text);
    if (!parsed) {
      toastr.error('JSON 格式无效或版本不匹配');
      return;
    }
    if (
      !window.confirm(
        '将用文件中的规则库、角色库、场景库、开局场景库与开场预设完全替换当前浏览器中的数据，是否继续？',
      )
    ) {
      return;
    }
    ruleSnippets.value = parsed.ruleSnippets;
    characterSnippets.value = parsed.characterSnippets;
    sceneSnippets.value = parsed.sceneSnippets;
    openingSceneSnippets.value = parsed.openingSceneSnippets;
    presets.value = parsed.presets;
    persistOpeningStorage();
    toastr.success('导入完成');
  };
  reader.onerror = () => toastr.error('读取文件失败');
  reader.readAsText(file, 'utf-8');
}

async function onConfirmClearChronicle() {
  if (clearChronicleLoading.value) return;
  clearChronicleLoading.value = true;
  try {
    const ok = await clearChronicle();
    if (ok) {
      toastr.success('编年史已清空');
    } else {
      toastr.error('清除失败：当前角色卡未绑定世界书或无法写入世界书');
    }
  } catch (e) {
    console.error('[OpeningForm] clearChronicle:', e);
    toastr.error('清除失败：' + String(e));
  } finally {
    clearChronicleLoading.value = false;
  }
}

function onConfirmClearCache() {
  if (clearCacheLoading.value) return;
  clearCacheLoading.value = true;
  try {
    clearOpeningUiCache();
    toastr.success('头像缓存已清理');
  } catch (e) {
    console.error('[OpeningForm] clearCache:', e);
    toastr.error('清理失败：' + String(e));
  } finally {
    clearCacheLoading.value = false;
  }
}

async function onConfirmClearMsWorldbooks() {
  if (clearMsWorldbooksLoading.value) return;
  clearMsWorldbooksLoading.value = true;

  try {
    // 通过 postMessage 向父窗口（脚本）请求清理世界书
    const result = await new Promise<{ success: boolean; deleted: string[]; error?: string }>((resolve) => {
      const requestId = `clear_ms_worldbooks_${Date.now()}`;

      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'CLEAR_MS_WORLDBOOKS_RESPONSE' && event.data?.requestId === requestId) {
          window.removeEventListener('message', handler);
          resolve(event.data.payload);
        }
      };

      window.addEventListener('message', handler);

      // 15秒超时（给异步探测足够时间）
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ success: false, deleted: [], error: '请求超时，脚本未响应（可能需要更多时间探测世界书）' });
      }, 15000);

      // 发送请求给父窗口
      window.parent.postMessage({
        type: 'CLEAR_MS_WORLDBOOKS_REQUEST',
        requestId,
        source: '规则-OpeningForm'
      }, '*');
    });

    if (result.success && result.deleted.length > 0) {
      toastr.success(`已清理 ${result.deleted.length} 个额外世界书`);
    } else if (result.success && result.deleted.length === 0) {
      toastr.info('没有找到需要清理的额外世界书');
    } else {
      toastr.error(result.error || '清理失败');
    }
  } catch (e) {
    console.error('[OpeningForm] clearMsWorldbooks:', e);
    toastr.error('清理失败：' + String(e));
  } finally {
    clearMsWorldbooksLoading.value = false;
  }
}

// 计算属性
const totalRulesCount = computed(() => {
  return selectedRules.value.length + customRules.value.length;
});

const canSubmit = computed(() => {
  // 只需要选择场景或填写自定义场景描述即可开始游戏
  return (selectedScene.value || customSceneDesc.value.trim()) && !isSubmitting.value;
});

// 翻页动画
function goToPage(page: typeof currentPage.value) {
  if (currentPage.value === page) return;

  isFlipping.value = true;
  setTimeout(() => {
    currentPage.value = page;
    setTimeout(() => {
      isFlipping.value = false;
    }, 300);
  }, 300);
}

// 选择场景
function selectScene(scene: typeof sceneOptions[0]) {
  selectedScene.value = scene;
  customSceneDesc.value = ''; // 清空自定义场景
}

// 添加自定义规则
function addCustomRule() {
  if (!newRuleName.value.trim() || !newRuleDesc.value.trim()) {
    toastr.warning('请填写完整的规则名称和描述');
    return;
  }
  customRules.value.push({
    name: newRuleName.value.trim(),
    desc: newRuleDesc.value.trim(),
  });
  newRuleName.value = '';
  newRuleDesc.value = '';
  toastr.success('规则已添加');
}

// 移除自定义规则
function removeCustomRule(index: number) {
  customRules.value.splice(index, 1);
}

// 添加角色
function addCharacter() {
  if (!newCharName.value.trim() || !newCharDesc.value.trim()) {
    toastr.warning('请填写完整的角色信息');
    return;
  }
  characters.value.push({
    name: newCharName.value.trim(),
    gender: newCharGender.value,
    desc: newCharDesc.value.trim(),
  });
  newCharName.value = '';
  newCharDesc.value = '';
  toastr.success('角色已添加');
}

// 移除角色
function removeCharacter(index: number) {
  characters.value.splice(index, 1);
}

// 提交
async function handleSubmit() {
  if (isSubmitting.value || !canSubmit.value) return;

  isSubmitting.value = true;

  // 第一次开始时尝试进入全屏（如果浏览器允许）
  try {
    if (!document.fullscreenElement && typeof document.documentElement?.requestFullscreen === 'function') {
      await document.documentElement.requestFullscreen();
    }
  } catch (e) {
    // 忽略失败（可能被浏览器策略/权限阻止）
  }

  // 构建场景描述
  let sceneDescription = '';
  if (selectedScene.value) {
    sceneDescription = `${selectedScene.value.name}：${selectedScene.value.desc}`;
  } else {
    sceneDescription = customSceneDesc.value.trim();
  }

  // 构建规则列表
  const rules = [
    ...selectedRules.value.map(id => {
      const rule = presetRules.find(r => r.id === id);
      return rule ? { name: rule.name, desc: rule.desc } : null;
    }).filter(Boolean),
    ...customRules.value,
  ];

  const formData: OpeningFormData = {
    playerName: '玩家',
    gameDifficulty: 'normal',
    enableWorldRules: true,
    enableRegionalRules: true,
    enablePersonalRules: true,
    sceneDescription,
    openingSceneDetail: openingSceneDetail.value.trim(),
    selectedRules: rules,
    characters: characters.value,
  };

  console.log('🎮 [OpeningForm] 提交:', formData);
  emit('submit', formData);
}

// 暴露重置方法供父组件调用
defineExpose({
  resetSubmitState: () => {
    isSubmitting.value = false;
    console.log('🎮 [OpeningForm] 提交状态已重置');
  },
});
</script>

<style lang="scss" scoped>
@use '../styles/cyber-effects' as *;

// ===== 赛博朋克风格封面页 =====
// 与主界面 #app-root.rule-modifier 一致：由 App 注入 --ui-scale、--ui-max-width、--ui-max-height（localStorage uiLayout）
.opening-form {
  font-size: calc(14px * var(--ui-scale, 1));
  line-height: 1.5;
  --space-xs: calc(4px * var(--ui-scale, 1));
  --space-sm: calc(8px * var(--ui-scale, 1));
  --space-md: calc(12px * var(--ui-scale, 1));
  --space-lg: calc(16px * var(--ui-scale, 1));
  --space-xl: calc(24px * var(--ui-scale, 1));
  --radius-sm: calc(6px * var(--ui-scale, 1));
  --radius-md: calc(8px * var(--ui-scale, 1));
  --radius-lg: calc(12px * var(--ui-scale, 1));
  --radius-xl: calc(16px * var(--ui-scale, 1));

  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(32px * var(--ui-scale, 1));
  position: relative;
  overflow: hidden;

  &.dark {
    background: #050508;
  }
}

// 书本容器
.book-container {
  width: 100%;
  max-width: min(1400px, var(--ui-max-width, 100%));
  height: 85vh;
  max-height: min(85vh, calc(900px * var(--ui-scale, 1)));
  position: relative;
  border-radius: calc(28px * var(--ui-scale, 1));
  overflow: hidden;
  margin: 0 auto;
}

// HUD 装饰
.hud-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;

  // 四角标记
  .corner-mark {
    position: absolute;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: rgba(168, 85, 247, 0.5);

    &.top-left {
      top: 24px;
      left: 24px;

      &::before {
        content: '';
        position: absolute;
        top: -8px;
        left: -8px;
        width: 32px;
        height: 32px;
        border-top: 2px solid rgba(168, 85, 247, 0.4);
        border-left: 2px solid rgba(168, 85, 247, 0.4);
        border-top-left-radius: 8px;
      }
    }

    &.top-right {
      top: 24px;
      right: 24px;
      color: rgba(6, 182, 212, 0.5);

      &::before {
        content: '';
        position: absolute;
        top: -8px;
        right: -8px;
        width: 32px;
        height: 32px;
        border-top: 2px solid rgba(6, 182, 212, 0.4);
        border-right: 2px solid rgba(6, 182, 212, 0.4);
        border-top-right-radius: 8px;
      }
    }

    &.bottom-left {
      bottom: 24px;
      left: 24px;

      &::before {
        content: '';
        position: absolute;
        bottom: -8px;
        left: -8px;
        width: 32px;
        height: 32px;
        border-bottom: 2px solid rgba(168, 85, 247, 0.4);
        border-left: 2px solid rgba(168, 85, 247, 0.4);
        border-bottom-left-radius: 8px;
      }
    }

    &.bottom-right {
      bottom: 24px;
      right: 24px;
      color: rgba(6, 182, 212, 0.5);

      &::before {
        content: '';
        position: absolute;
        bottom: -8px;
        right: -8px;
        width: 32px;
        height: 32px;
        border-bottom: 2px solid rgba(6, 182, 212, 0.4);
        border-right: 2px solid rgba(6, 182, 212, 0.4);
        border-bottom-right-radius: 8px;
      }
    }
  }

  // 顶部 HUD
  .hud-top {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    opacity: 0.6;

    .hud-line {
      height: 1px;
      width: 120px;
      background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.5));

      &.right {
        background: linear-gradient(90deg, rgba(6, 182, 212, 0.5), transparent);
      }
    }

    .hud-label {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      letter-spacing: 0.3em;
      display: flex;
      gap: 4px;
      color: rgba(255, 255, 255, 0.5);

      .purple { color: rgba(168, 85, 247, 0.8); }
      .cyan { color: rgba(6, 182, 212, 0.8); }
      .dim { color: rgba(255, 255, 255, 0.3); }
    }
  }

  // 底部 HUD
  .hud-bottom {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 32px;
    opacity: 0.6;

    .data-blocks {
      display: flex;
      gap: 4px;

      .data-block {
        width: 8px;
        height: 4px;
        background: rgba(168, 85, 247, 0.4);

        &.right .data-block {
          background: rgba(6, 182, 212, 0.4);
        }
      }
    }

    .hud-range {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 0.1em;

      .dim { color: rgba(6, 182, 212, 0.5); }
    }
  }

  // 侧边 HUD
  .hud-side {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    opacity: 0.6;

    &.left { left: 24px; }
    &.right { right: 24px; }

    .side-line {
      width: 1px;
      height: 120px;
      background: linear-gradient(to bottom, transparent, rgba(168, 85, 247, 0.5), rgba(168, 85, 247, 0.8));

      &.cyan {
        background: linear-gradient(to bottom, transparent, rgba(6, 182, 212, 0.5), rgba(6, 182, 212, 0.8));
      }
    }

    .side-dots {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .side-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(168, 85, 247, 0.6);
        box-shadow: 0 0 8px rgba(168, 85, 247, 0.8);
        animation: pulse-dot 2s ease-in-out infinite;

        @for $i from 1 through 3 {
          &:nth-child(#{$i}) {
            animation-delay: #{$i * 0.3}s;
          }
        }

        &.cyan {
          background: rgba(6, 182, 212, 0.6);
          box-shadow: 0 0 8px rgba(6, 182, 212, 0.8);
        }
      }
    }

    .side-text {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      letter-spacing: 0.4em;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      padding: 16px 0;

      &.purple {
        color: rgba(168, 85, 247, 0.6);
        transform: rotate(180deg);
      }

      &.cyan {
        color: rgba(6, 182, 212, 0.6);
      }
    }
  }

  // 数据条
  .data-bars {
    position: absolute;
    bottom: 64px;
    display: flex;
    gap: 4px;
    opacity: 0.3;

    &.left { left: 48px; }
    &.right { right: 48px; }

    .data-bar {
      width: 4px;
      background: rgba(168, 85, 247, 0.6);
      border-radius: 2px 2px 0 0;
      animation: data-bar-pulse 2s ease-in-out infinite;

      &.cyan { background: rgba(6, 182, 212, 0.6); }

      @for $i from 1 through 15 {
        &:nth-child(#{$i}) {
          animation-delay: #{$i * 0.1}s;
        }
      }
    }
  }

  // 刻度尺
  .ruler {
    position: absolute;
    top: 25%;
    bottom: 25%;
    width: 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    opacity: 0.2;

    &.left { left: 16px; }
    &.right { right: 16px; align-items: flex-end; }

    .ruler-mark {
      height: 1px;
      background: rgba(255, 255, 255, 0.5);
      width: 50%;

      &.long { width: 100%; }
    }
  }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

@keyframes data-bar-pulse {
  0%, 100% { height: 10px; }
  50% { height: 40px; }
}

// 封面页布局 - 三列等宽对称布局
.cover-page {
  display: grid;
  grid-template-columns: 1fr 420px 1fr;
  grid-template-rows: 1fr auto;
  gap: 40px;
  padding: 48px 40px 40px;
  height: 100%;
  position: relative;
  z-index: 10;
  align-items: center;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

// 系统状态面板（左侧）
.system-status-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  opacity: 0.8;
  max-width: 320px;
  justify-self: end;

  .panel-section {
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 12px;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(168, 85, 247, 0.3);
      font-family: 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(168, 85, 247, 0.8);

      i { font-size: 12px; }
    }

    .status-list {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .status-item {
        .status-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          font-size: 11px;
          font-family: 'Courier New', monospace;
          text-transform: uppercase;
          letter-spacing: 0.1em;

          .status-value {
            color: rgba(255, 255, 255, 0.8);
            font-weight: 500;
          }
        }
      }
    }

    .module-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .module-tag {
        font-family: 'Courier New', monospace;
        font-size: 10px;
        padding: 4px 8px;
        background: rgba(168, 85, 247, 0.1);
        border: 1px solid rgba(168, 85, 247, 0.2);
        border-radius: 4px;
        color: rgba(168, 85, 247, 0.8);
      }
    }
  }
}

// 中央卡片区域
.center-card-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0 6px;

  .glow-border {
    position: absolute;
    inset: -4px;
    background: linear-gradient(90deg, rgba(168, 85, 247, 0.3), rgba(6, 182, 212, 0.3));
    border-radius: 28px;
    filter: blur(12px);
    opacity: 0.5;
    transition: opacity 0.3s;

    &:hover { opacity: 0.8; }
  }

  .center-card {
    position: relative;
    // 必须可随窄屏收缩；勿用固定 380px（会覆盖媒体查询里单独的 .center-card）
    width: min(100%, 380px);
    max-width: 100%;
    min-height: 320px;
    height: auto;
    box-sizing: border-box;
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    .card-inner-border {
      position: absolute;
      inset: 16px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      pointer-events: none;

      &::before {
        content: '';
        position: absolute;
        inset: 16px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
      }
    }

    .card-content {
      text-align: center;
      z-index: 1;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      padding: 0 4px;
      box-sizing: border-box;
      word-break: break-word;
      overflow-wrap: anywhere;

      .book-icon-wrapper {
        position: relative;
        margin-bottom: 32px;

        .icon-glow {
          position: absolute;
          inset: -20px;
          background: rgba(6, 182, 212, 0.2);
          border-radius: 50%;
          filter: blur(20px);
        }

        .book-icon {
          position: relative;
          font-size: 64px;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }
      }

      .book-title {
        font-size: 40px;
        font-weight: 700;
        margin: 0 0 8px;
        letter-spacing: 0.05em;
      }

      .book-subtitle {
        font-size: 12px;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        margin: 0 0 32px;
        font-weight: 600;
      }

      .book-desc {
        font-size: 14px;
        letter-spacing: 0.1em;
        margin: 0;
        opacity: 0.7;
      }
    }
  }

  // 开始按钮
  .start-btn-wrapper {
    position: relative;
    margin-top: 40px;
    width: 100%;
    max-width: 100%;
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    padding: 0 4px;

    .btn-pulse-ring {
      position: absolute;
      inset: -8px;
      border-radius: 50px;
      background: linear-gradient(90deg, rgba(168, 85, 247, 0.4), rgba(6, 182, 212, 0.4));
      filter: blur(8px);
      opacity: 0.5;
      animation: pulse-ring 3s ease-out infinite;
    }

    .start-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      max-width: min(100%, 320px);
      padding: 16px 40px;
      border-radius: 50px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid rgba(168, 85, 247, 0.3);
      background: rgba(0, 0, 0, 0.4);
      transition: all 0.3s;
      box-sizing: border-box;

      &:hover {
        border-color: rgba(168, 85, 247, 0.6);
        box-shadow: 0 0 30px rgba(168, 85, 247, 0.3);
      }

      i {
        transition: transform 0.3s;
      }

      &:hover i {
        transform: translateX(4px);
      }
    }
  }
}

@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.3); opacity: 0; }
}

// 事件日志面板（右侧）
.event-logs-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  opacity: 0.8;
  max-width: 320px;
  justify-self: start;

  .panel-section {
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 12px;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(6, 182, 212, 0.3);
      font-family: 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(6, 182, 212, 0.8);

      i { font-size: 12px; }
    }

    .logs-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .log-item {
        display: flex;
        gap: 12px;
        font-family: 'Courier New', monospace;
        font-size: 11px;

        .log-time {
          color: rgba(255, 255, 255, 0.4);
        }

        .log-msg {
          color: rgba(255, 255, 255, 0.6);

          &.highlight {
            color: rgba(6, 182, 212, 0.9);
            text-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
          }
        }
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;

      .stat-card {
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 16px;
        text-align: center;

        .stat-value {
          font-size: 28px;
          font-family: 'Courier New', monospace;
          font-weight: bold;
          margin-bottom: 4px;

          &.cyan { color: rgba(6, 182, 212, 0.9); }
          &.purple { color: rgba(168, 85, 247, 0.9); }
        }

        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.6;
        }
      }
    }
  }
}

// 底部工具栏
.bottom-tools {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  align-content: center;
  gap: 12px 10px;
  margin-top: auto;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 0 6px 4px;
  position: relative;
  z-index: 12;

  .tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 24px;
    border-radius: 12px;
    font-size: 13px;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    transition: all 0.3s;
    color: rgba(255, 255, 255, 0.7);
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    justify-content: center;
    box-sizing: border-box;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.9);
    }

    i {
      font-size: 14px;
      opacity: 0.8;
    }
  }
}

// 原有样式（保留其他页面）
.opening-form {
  --bg-0: #0b0c0f;
  --bg-1: #151820;
  --glass: rgba(255, 255, 255, 0.06);
  --glass-strong: rgba(255, 255, 255, 0.1);
  --line: rgba(255, 255, 255, 0.14);
  --text: rgba(255, 255, 255, 0.92);
  --text-soft: rgba(255, 255, 255, 0.68);
  --text-faint: rgba(255, 255, 255, 0.48);
  --accent: #c7ccd4;
  --danger: #ff6b6b;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(32px * var(--ui-scale, 1));
  font-size: calc(14px * var(--ui-scale, 1));
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif;
  color: var(--text);
  background:
    radial-gradient(1200px 700px at 8% -10%, rgba(255, 255, 255, 0.12), transparent 60%),
    radial-gradient(900px 500px at 108% 110%, rgba(255, 255, 255, 0.08), transparent 60%),
    linear-gradient(160deg, var(--bg-0) 0%, var(--bg-1) 100%);

  &.light {
    --bg-0: #eef1f6;
    --bg-1: #dee3ea;
    --glass: rgba(255, 255, 255, 0.62);
    --glass-strong: rgba(255, 255, 255, 0.82);
    --line: rgba(17, 24, 39, 0.12);
    --text: rgba(17, 24, 39, 0.92);
    --text-soft: rgba(17, 24, 39, 0.68);
    --text-faint: rgba(17, 24, 39, 0.48);
    --accent: #3a4352;
    --danger: #dc3c3c;
  }
}

.book-container {
  width: 100%;
  max-width: min(880px, var(--ui-max-width, 100%));
  min-height: calc(690px * var(--ui-scale, 1));
  position: relative;
  border-radius: calc(28px * var(--ui-scale, 1));
  overflow: hidden;
  background: var(--glass);
  border: 1px solid var(--line);
  box-shadow:
    0 calc(30px * var(--ui-scale, 1)) calc(80px * var(--ui-scale, 1)) rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(20px) saturate(140%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0.02) 24%,
      rgba(255, 255, 255, 0.05) 100%
    );
  }

  &.flipping .book-page {
    animation: pageSwitch 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  }
}

@keyframes pageSwitch {
  0% {
    opacity: 0.65;
    transform: translateY(8px) scale(0.99);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.book-page {
  position: relative;
  width: 100%;
  min-height: calc(690px * var(--ui-scale, 1));
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
}

// 与上方 .cover-page 合并：勿再写第二段 .cover-page，否则会打乱响应式 padding

.book-cover {
  width: 100%;
  max-width: 460px;
}

.cover-decoration {
  border-radius: 24px;
  padding: 22px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
}

.cover-border {
  border-radius: 18px;
  border: 1px solid var(--line);
  padding: 18px;
}

.cover-inner {
  border-radius: 14px;
  padding: 40px 22px;
  background: rgba(255, 255, 255, 0.03);
}

.book-icon {
  font-size: 58px;
  color: var(--accent);
  margin-bottom: 20px;
}

.book-title {
  margin: 0 0 8px;
  font-size: 40px;
  line-height: 1.1;
  letter-spacing: 0.02em;
  font-weight: 700;
}

.book-subtitle {
  margin: 0 0 20px;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.cover-divider {
  width: 72%;
  height: 1px;
  margin: 0 auto 18px;
  background: linear-gradient(90deg, transparent, var(--line), transparent);
}

.book-desc {
  margin: 0 0 30px;
  font-size: 15px;
  color: var(--text-soft);
}

.start-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 34px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.22) 0%,
    rgba(255, 255, 255, 0.08) 100%
  );
  color: var(--text);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.28);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
  }

  &:active {
    transform: scale(0.98);
  }
}

.cover-tools {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.cover-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: var(--text);
    border-color: rgba(255, 255, 255, 0.26);
    background: rgba(255, 255, 255, 0.08);
  }
}

.visually-hidden {
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

.library-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.library-toolbar--characters {
  margin-bottom: 16px;
}

.library-toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(168, 85, 247, 0.3);
  background: rgba(168, 85, 247, 0.08);
  color: rgba(168, 85, 247, 0.9);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  animation: toolbar-btn-pulse 3s ease-in-out infinite;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(6, 182, 212, 0.2));
    opacity: 0;
    transition: opacity 0.3s;
  }

  &:hover {
    color: #fff;
    border-color: rgba(6, 182, 212, 0.5);
    transform: translateY(-2px);
    box-shadow:
      0 8px 20px rgba(168, 85, 247, 0.2),
      0 0 15px rgba(6, 182, 212, 0.2);

    &::before {
      opacity: 1;
    }
  }

  i {
    position: relative;
    z-index: 1;
    font-size: 14px;
  }

}

@keyframes toolbar-btn-pulse {
  0%, 100% {
    box-shadow:
      0 0 5px rgba(168, 85, 247, 0.2),
      inset 0 0 10px rgba(168, 85, 247, 0.05);
  }
  50% {
    box-shadow:
      0 0 15px rgba(168, 85, 247, 0.3),
      0 0 25px rgba(6, 182, 212, 0.2),
      inset 0 0 15px rgba(168, 85, 247, 0.1);
  }
}

.custom-rule-actions {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-shrink: 0;
}

.library-mini-btn {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.18s ease;

  &:hover {
    color: var(--accent);
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
  }
}

.preset-action-btn-old {
  display: none;
}

.preset-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-soft);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: var(--text);
    border-color: rgba(255, 255, 255, 0.26);
  }
}

.opening-dialog-panel--wide {
  max-width: min(520px, var(--ui-max-width, 100%));
  max-height: min(80vh, calc(640px * var(--ui-scale, 1)));
  display: flex;
  flex-direction: column;
}

.opening-dialog-input {
  width: 100%;
  margin-bottom: var(--space-lg, 16px);
  padding: calc(12px * var(--ui-scale, 1)) calc(14px * var(--ui-scale, 1));
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-size: calc(14px * var(--ui-scale, 1));

  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.3);
  }
}

.opening-dialog-empty {
  margin: var(--space-sm, 8px) 0 var(--space-lg, 16px);
  padding: calc(20px * var(--ui-scale, 1));
  text-align: center;
  font-size: calc(14px * var(--ui-scale, 1));
  color: var(--text-faint);
  border-radius: calc(14px * var(--ui-scale, 1));
  border: 1px dashed var(--line);
}

.opening-dialog-list {
  list-style: none;
  margin: 0 0 var(--space-lg, 16px);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: calc(10px * var(--ui-scale, 1));
}

.opening-dialog-list--scroll {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: calc(360px * var(--ui-scale, 1));
  padding-right: calc(4px * var(--ui-scale, 1));
}

.opening-dialog-list-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: calc(12px * var(--ui-scale, 1));
  padding: calc(12px * var(--ui-scale, 1)) calc(14px * var(--ui-scale, 1));
  border-radius: calc(14px * var(--ui-scale, 1));
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
}

.opening-dialog-list-item--stack {
  flex-direction: column;
}

.opening-dialog-list-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.opening-dialog-list-name {
  font-size: calc(14px * var(--ui-scale, 1));
  font-weight: 600;
  color: var(--text);
}

.opening-dialog-list-meta {
  font-size: calc(12px * var(--ui-scale, 1));
  color: var(--text-faint);
}

.opening-dialog-list-preview {
  font-size: calc(12px * var(--ui-scale, 1));
  line-height: 1.45;
  color: var(--text-soft);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.opening-dialog-list-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

.opening-dialog-list-item--stack .opening-dialog-list-actions {
  align-self: flex-end;
}

.content-page {
  display: grid;
  grid-template-rows: auto 1fr;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
}

.nav-btn {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.1);
  color: rgba(168, 85, 247, 0.9);
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  animation: nav-pulse 2s ease-in-out infinite;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(6, 182, 212, 0.2));
    opacity: 0;
    transition: opacity 0.3s;
  }

  &:hover {
    color: #fff;
    border-color: rgba(6, 182, 212, 0.6);
    transform: translateY(-2px) scale(1.05);
    box-shadow:
      0 0 20px rgba(168, 85, 247, 0.4),
      0 0 40px rgba(6, 182, 212, 0.2);

    &::before {
      opacity: 1;
    }
  }

  &:active {
    transform: scale(0.96);
  }

  i {
    position: relative;
    z-index: 1;
    font-size: 16px;
  }
}

@keyframes nav-pulse {
  0%, 100% {
    box-shadow:
      0 0 5px rgba(168, 85, 247, 0.3),
      inset 0 0 10px rgba(168, 85, 247, 0.1);
  }
  50% {
    box-shadow:
      0 0 20px rgba(168, 85, 247, 0.5),
      0 0 30px rgba(6, 182, 212, 0.3),
      inset 0 0 15px rgba(168, 85, 247, 0.2);
  }
}

.placeholder {
  visibility: hidden;
}

.page-number {
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 600;
  background: linear-gradient(90deg, rgba(168, 85, 247, 0.8), rgba(6, 182, 212, 0.8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow:
    0 0 20px rgba(168, 85, 247, 0.4),
    0 0 40px rgba(6, 182, 212, 0.2);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 2px;
    background: linear-gradient(90deg, rgba(168, 85, 247, 0.6), rgba(6, 182, 212, 0.6));
    border-radius: 1px;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
  }
}

.page-content {
  padding: 28px 30px 30px;
  overflow-y: auto;
  max-height: 610px;
}

.chapter-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, #fff 0%, rgba(168, 85, 247, 0.9) 50%, rgba(6, 182, 212, 0.9) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow:
    0 0 30px rgba(168, 85, 247, 0.3),
    0 0 60px rgba(6, 182, 212, 0.2);
  position: relative;
  display: inline-block;

  &::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 0;
    width: 60px;
    height: 3px;
    background: linear-gradient(90deg, rgba(168, 85, 247, 0.8), rgba(6, 182, 212, 0.8));
    border-radius: 2px;
    box-shadow: 0 0 15px rgba(168, 85, 247, 0.6);
  }
}

.chapter-desc {
  margin: 0 0 24px;
  color: var(--text-soft);
  font-size: 14px;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.scene-card,
.rule-item,
.custom-rule-item,
.char-card,
.custom-rules-section,
.character-form,
.summary-section {
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease, box-shadow 0.2s ease;
}

.scene-card {
  padding: 16px;
  cursor: pointer;
  text-align: left;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--glass);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
  }

  &.active {
    transform: translateY(-2px);
    border-color: rgba(6, 182, 212, 0.6);
    box-shadow:
      0 8px 32px rgba(6, 182, 212, 0.2),
      0 0 20px rgba(168, 85, 247, 0.15),
      inset 0 0 20px rgba(6, 182, 212, 0.05);

    // 霓虹跑马灯光带
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(168, 85, 247, 0.8),
        rgba(6, 182, 212, 0.8),
        rgba(168, 85, 247, 0.8),
        transparent
      );
      animation: neon-scan 3s linear infinite;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: -100%;
      width: 100%;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(6, 182, 212, 0.8),
        rgba(168, 85, 247, 0.8),
        rgba(6, 182, 212, 0.8),
        transparent
      );
      animation: neon-scan-reverse 3s linear infinite;
    }

    .scene-icon {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(6, 182, 212, 0.3));
      box-shadow:
        0 0 15px rgba(168, 85, 247, 0.4),
        0 0 30px rgba(6, 182, 212, 0.2);
      animation: icon-pulse 2s ease-in-out infinite;
    }

    .scene-name {
      color: #fff;
      text-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
    }
  }
}

@keyframes neon-scan {
  0% { left: -100%; }
  50% { left: 100%; }
  100% { left: 100%; }
}

@keyframes neon-scan-reverse {
  0% { right: -100%; }
  50% { right: 100%; }
  100% { right: 100%; }
}

@keyframes icon-pulse {
  0%, 100% {
    box-shadow:
      0 0 15px rgba(168, 85, 247, 0.4),
      0 0 30px rgba(6, 182, 212, 0.2);
  }
  50% {
    box-shadow:
      0 0 25px rgba(168, 85, 247, 0.6),
      0 0 50px rgba(6, 182, 212, 0.4);
  }
}

.scene-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  margin-bottom: 10px;
  font-size: 20px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--accent);
}

.scene-name {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.scene-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-soft);
}

.custom-scene {
  margin-top: 20px;
}

.custom-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-soft);
}

.custom-textarea,
.rule-name-input,
.rule-desc-input,
.char-name-input,
.char-gender-select,
.char-desc-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 14px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;

  &::placeholder {
    color: var(--text-faint);
  }

  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.34);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.05);
  }
}

.custom-textarea,
.rule-desc-input,
.char-desc-input {
  resize: vertical;
  min-height: 86px;
}

.rules-section {
  margin-bottom: 22px;
}

.section-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 700;
}

.rules-list {
  display: grid;
  gap: 10px;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--glass);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(168, 85, 247, 0.4);
    transform: translateY(-1px);
  }

  &.checked {
    border-color: rgba(6, 182, 212, 0.6);
    background: var(--glass-strong);
    transform: translateY(-1px);
    box-shadow:
      0 8px 32px rgba(6, 182, 212, 0.15),
      0 0 20px rgba(168, 85, 247, 0.1),
      inset 0 0 20px rgba(6, 182, 212, 0.05);

    // 霓虹跑马灯光带
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(168, 85, 247, 0.8),
        rgba(6, 182, 212, 0.8),
        rgba(168, 85, 247, 0.8),
        transparent
      );
      animation: neon-scan 3s linear infinite;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: -100%;
      width: 100%;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(6, 182, 212, 0.8),
        rgba(168, 85, 247, 0.8),
        rgba(6, 182, 212, 0.8),
        transparent
      );
      animation: neon-scan-reverse 3s linear infinite;
    }

    .check-mark {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(6, 182, 212, 0.3));
      border-color: rgba(6, 182, 212, 0.6);
      box-shadow:
        0 0 15px rgba(168, 85, 247, 0.4),
        inset 0 0 10px rgba(6, 182, 212, 0.2);
      animation: icon-pulse 2s ease-in-out infinite;

      i {
        color: #fff;
        text-shadow: 0 0 10px rgba(6, 182, 212, 0.8);
      }
    }

    .rule-name {
      color: #fff;
      text-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
    }
  }
}

.rule-checkbox {
  position: relative;
  flex-shrink: 0;

  input {
    display: none;
  }
}

.check-mark {
  width: 22px;
  height: 22px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  place-items: center;
  color: var(--accent);
  transition: all 0.18s ease;

  i {
    font-size: 12px;
    opacity: 0;
    transform: scale(0.85);
    transition: all 0.18s ease;
  }

  input:checked + & {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.34);

    i {
      opacity: 1;
      transform: scale(1);
    }
  }
}

.rule-info,
.custom-rule-info,
.char-info {
  display: grid;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.rule-name,
.custom-rule-name,
.char-name {
  font-size: 14px;
  font-weight: 600;
}

.rule-desc,
.custom-rule-desc,
.char-desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-soft);
}

.custom-rules-section,
.character-form,
.summary-section {
  padding: 18px;
}

.custom-rule-input {
  display: grid;
  gap: 10px;
}

.form-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.char-name-input {
  flex: 1;
}

.char-gender-select {
  width: 110px;
  flex-shrink: 0;
}

.form-actions-row {
  display: flex;
  justify-content: flex-end;
}

.add-rule-btn,
.add-char-btn,
.confirm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08));
  color: var(--text);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.32);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }
}

.add-rule-btn,
.add-char-btn {
  min-width: 112px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
}

.custom-rules-list,
.char-cards {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.custom-rule-item,
.char-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
}

.char-avatar {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.12);
  color: var(--accent);
}

.remove-btn {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: var(--danger);
    border-color: rgba(255, 107, 107, 0.35);
    background: rgba(255, 107, 107, 0.08);
  }
}

.empty-hint {
  margin-top: 6px;
  text-align: center;
  padding: 30px 18px;
  border-radius: 18px;
  border: 1px dashed var(--line);
  color: var(--text-soft);

  i {
    display: block;
    margin-bottom: 10px;
    font-size: 36px;
    color: var(--text-faint);
  }

  p {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-soft);
  }

  span {
    font-size: 12px;
    color: var(--text-faint);
  }
}

.summary-section {
  margin: 18px 0 24px;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);

  &:last-child {
    border-bottom: none;
  }
}

.summary-label {
  font-size: 13px;
  color: var(--text-soft);
}

.summary-value {
  font-size: 13px;
  font-weight: 700;
}

.confirm-page {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
}

.confirm-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

// 摘要在上，底部为「小预设按钮 + 开始游戏」成组贴底，避免预设条单独占一行挡住主按钮
.confirm-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding-top: 8px;
}

.confirm-actions {
  display: grid;
  justify-items: center;
  width: 100%;
  padding: 0 0 12px;
}

// 炫酷开始游戏按钮
.cyber-start-btn {
  position: relative;
  min-width: 280px;
  padding: 18px 32px;
  font-size: 18px;
  font-weight: 700;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(6, 182, 212, 0.2));
  color: #fff;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
  animation: start-btn-pulse 2s ease-in-out infinite;

  .btn-glow {
    position: absolute;
    inset: -2px;
    border-radius: 18px;
    background: linear-gradient(135deg, #a855f7, #06b6d4, #a855f7);
    background-size: 200% 200%;
    z-index: -1;
    animation: gradient-rotate 3s ease infinite;
    filter: blur(8px);
    opacity: 0.6;
  }

  .btn-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    letter-spacing: 0.1em;

    i {
      font-size: 20px;
      transition: transform 0.3s;
    }
  }

  .btn-particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;

    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      background: rgba(6, 182, 212, 0.8);
      border-radius: 50%;
      animation: particle-float 2s ease-out infinite;

      &:nth-child(1) {
        left: 20%;
        bottom: -10px;
        animation-delay: 0s;
      }

      &:nth-child(2) {
        left: 50%;
        bottom: -10px;
        animation-delay: 0.5s;
      }

      &:nth-child(3) {
        left: 80%;
        bottom: -10px;
        animation-delay: 1s;
      }
    }
  }

  &:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow:
      0 20px 40px rgba(168, 85, 247, 0.3),
      0 0 60px rgba(6, 182, 212, 0.2);

    .btn-glow {
      opacity: 1;
      filter: blur(12px);
    }

    .btn-content i {
      transform: translateX(4px);
    }
  }

  &:active {
    transform: translateY(-1px) scale(0.98);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    animation: none;

    .btn-glow {
      animation: none;
      opacity: 0.2;
    }

    .btn-particles {
      display: none;
    }
  }
}

@keyframes start-btn-pulse {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(168, 85, 247, 0.3),
      0 0 40px rgba(6, 182, 212, 0.2),
      inset 0 0 20px rgba(168, 85, 247, 0.1);
  }
  50% {
    box-shadow:
      0 0 30px rgba(168, 85, 247, 0.5),
      0 0 60px rgba(6, 182, 212, 0.3),
      inset 0 0 30px rgba(168, 85, 247, 0.2);
  }
}

@keyframes gradient-rotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes particle-float {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-60px) scale(0);
    opacity: 0;
  }
}

// 开场预设：与文字行高接近的小按钮，横向并排，置于「开始游戏」正上方
.confirm-presets-bar {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px 10px;
  width: 100%;
  padding: 0;
  border-top: none;
  background: transparent;
}

.cyber-preset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  min-height: 0;
  line-height: 1.35;
  border-radius: 999px;
  border: 1px solid rgba(168, 85, 247, 0.35);
  background: rgba(168, 85, 247, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  flex: 0 1 auto;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(6, 182, 212, 0.2));
    opacity: 0;
    transition: opacity 0.3s;
  }

  &:hover {
    color: #fff;
    border-color: rgba(6, 182, 212, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.18);

    &::before {
      opacity: 1;
    }
  }

  i {
    position: relative;
    z-index: 1;
    font-size: 11px;
    color: rgba(168, 85, 247, 0.95);
  }

  span {
    position: relative;
    z-index: 1;
    white-space: nowrap;
  }
}

.hint-text {
  margin-top: 10px;
  color: var(--text-faint);
  font-size: 12px;
}

.opening-bottom-left-stack {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.chronicle-clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: all 0.18s ease;

  i {
    font-size: 14px;
    opacity: 0.9;
  }

  &:hover {
    color: var(--text);
    border-color: rgba(255, 255, 255, 0.28);
    transform: translateY(-1px);
  }
}

// 清理菜单选项列表
.clear-options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
}

.clear-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
  }
}

.clear-option-info {
  flex: 1;
  min-width: 0;
}

.clear-option-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;

  i {
    font-size: 16px;
    color: var(--accent);
    opacity: 0.9;
  }
}

.clear-option-desc {
  font-size: 12px;
  color: var(--text-soft);
  line-height: 1.4;
}

// 清理菜单使用更宽的对话框
.opening-dialog-panel--wide {
  max-width: min(520px, var(--ui-max-width, 100%)) !important;
}

.chronicle-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(24px * var(--ui-scale, 1));
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
}

.chronicle-dialog-panel {
  width: 100%;
  max-width: min(400px, var(--ui-max-width, 100%));
  padding: calc(22px * var(--ui-scale, 1)) calc(22px * var(--ui-scale, 1)) calc(18px * var(--ui-scale, 1));
  border-radius: calc(18px * var(--ui-scale, 1));
  border: 1px solid var(--line);
  background: var(--glass-strong);
  color: var(--text);
  box-shadow: 0 calc(24px * var(--ui-scale, 1)) calc(64px * var(--ui-scale, 1)) rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(16px);
}

.chronicle-dialog-title {
  margin: 0 0 var(--space-md, 12px);
  font-size: calc(18px * var(--ui-scale, 1));
  font-weight: 600;
}

.chronicle-dialog-desc {
  margin: 0 0 calc(20px * var(--ui-scale, 1));
  font-size: calc(14px * var(--ui-scale, 1));
  line-height: 1.55;
  color: var(--text-soft);
}

.chronicle-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: calc(10px * var(--ui-scale, 1));
}

.chronicle-dialog-btn {
  min-width: calc(88px * var(--ui-scale, 1));
  padding: calc(10px * var(--ui-scale, 1)) calc(16px * var(--ui-scale, 1));
  border-radius: var(--radius-lg, 12px);
  font-size: calc(14px * var(--ui-scale, 1));
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease;

  &.cancel:hover {
    border-color: rgba(255, 255, 255, 0.22);
  }

  &.danger {
    border-color: rgba(220, 60, 60, 0.45);
    background: rgba(220, 60, 60, 0.18);
    color: var(--danger);

    &:hover:not(:disabled) {
      background: rgba(220, 60, 60, 0.28);
    }
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.opening-form.light .chronicle-dialog-btn.danger {
  border-color: rgba(220, 60, 60, 0.35);
  background: rgba(220, 60, 60, 0.12);
}

.opening-settings-btn {
  position: fixed;
  right: 20px;
  bottom: 76px;
  z-index: 50;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--text-soft);
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: all 0.18s ease;
  display: grid;
  place-items: center;
  padding: 0;

  &:hover {
    color: var(--text);
    border-color: rgba(255, 255, 255, 0.28);
    transform: translateY(-1px);
  }

  i {
    font-size: 18px;
  }
}

.theme-toggle {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 50;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--text-soft);
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: all 0.18s ease;

  &:hover {
    color: var(--text);
    border-color: rgba(255, 255, 255, 0.28);
    transform: translateY(-1px);
  }
}

.page-content {
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
  }
}

// ===== 响应式适配 =====

/* 大屏幕适配 (1400px 以下) */
@media (max-width: 1400px) {
  .book-container {
    max-width: 1200px;
    height: 88vh;
  }

  .cover-page {
    gap: 24px;
    padding: 40px 32px 32px;
  }

  .center-card-wrapper .center-card {
    width: min(100%, 340px);
    height: auto;
    min-height: 360px;

    .card-content {
      .book-icon {
        font-size: 56px;
      }

      .book-title {
        font-size: 36px;
      }
    }
  }
}

/* 中等屏幕适配 (1200px 以下) */
@media (max-width: 1200px) {
  .book-container {
    max-width: 1000px;
    height: 90vh;
    max-height: 800px;
  }

  .cover-page {
    grid-template-columns: 1fr 360px 1fr;
    gap: 20px;
    padding: 36px 28px 28px;
  }

  .center-card-wrapper .center-card {
    width: min(100%, 320px);
    height: auto;
    min-height: 340px;

    .card-content {
      .book-icon-wrapper {
        margin-bottom: 24px;
      }

      .book-icon {
        font-size: 52px;
      }

      .book-title {
        font-size: 32px;
      }

      .book-subtitle {
        font-size: 11px;
        margin-bottom: 24px;
      }

      .book-desc {
        font-size: 13px;
      }
    }
  }

  .center-card-wrapper .start-btn-wrapper {
    margin-top: 32px;

    .start-btn {
      padding: 14px 36px;
      font-size: 15px;
    }
  }

  .system-status-panel,
  .event-logs-panel {
    max-width: 280px;
  }
}

/* 平板和小屏幕适配 (1024px 以下) */
@media (max-width: 1024px) {
  .opening-form {
    padding: 20px;
  }

  .book-container {
    max-width: 100%;
    height: 92vh;
    max-height: none;
    border-radius: 24px;
  }

  // 封面页改为上下布局
  .cover-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    gap: 24px;
    padding: 32px 24px 24px;
    overflow-y: auto;

    // 隐藏左右面板在封面页
    .system-status-panel,
    .event-logs-panel {
      display: none;
    }
  }

  .center-card-wrapper {
    order: 1;
  }

  .center-card-wrapper .center-card {
    width: 100%;
    max-width: 400px;
    height: auto;
    min-height: 300px;
    padding: 40px 24px;

    .card-content {
      .book-icon-wrapper {
        margin-bottom: 20px;
      }

      .book-icon {
        font-size: 48px;
      }

      .book-title {
        font-size: 36px;
      }

      .book-subtitle {
        font-size: 12px;
        margin-bottom: 20px;
      }

      .book-desc {
        font-size: 14px;
      }
    }
  }

  .center-card-wrapper .start-btn-wrapper {
    order: 2;
    margin-top: 24px;

    .start-btn {
      padding: 16px 40px;
      font-size: 16px;
    }
  }

  .bottom-tools {
    order: 3;
    margin-top: 20px;
    flex-wrap: wrap;

    .tool-btn {
      padding: 10px 20px;
      font-size: 12px;
    }
  }

  // HUD 装饰简化
  .hud-decoration {
    .hud-side {
      display: none;
    }

    .data-bars {
      opacity: 0.15;
    }

    .ruler {
      opacity: 0.1;
    }
  }
}

/* 手机横屏和中等移动设备 (768px 以下) */
@media (max-width: 768px) {
  .opening-form {
    padding: 12px;
  }

  .book-container {
    height: 95vh;
    border-radius: 20px;
  }

  .cover-page {
    gap: 16px;
    padding: 24px 16px 16px;
  }

  .center-card-wrapper .center-card {
    min-height: 260px;
    padding: 32px 20px;
    border-radius: 20px;

    .card-content {
      .book-icon-wrapper {
        margin-bottom: 16px;
      }

      .book-icon {
        font-size: 42px;
      }

      .book-title {
        font-size: 30px;
      }

      .book-subtitle {
        font-size: 11px;
        letter-spacing: 0.2em;
        margin-bottom: 16px;
      }

      .book-desc {
        font-size: 13px;
      }
    }
  }

  .center-card-wrapper .start-btn-wrapper {
    margin-top: 20px;

    .start-btn {
      padding: 14px 32px;
      font-size: 15px;
    }
  }

  .bottom-tools {
    gap: 10px;

    .tool-btn {
      padding: 8px 16px;
      font-size: 12px;
      border-radius: 10px;
    }
  }

  // HUD 进一步简化
  .hud-decoration {
    .corner-mark {
      font-size: 8px;

      &.top-left,
      &.top-right,
      &.bottom-left,
      &.bottom-right {
        &::before {
          width: 20px;
          height: 20px;
        }
      }
    }

    .hud-top {
      gap: 10px;

      .hud-line {
        width: 60px;
      }

      .hud-label {
        font-size: 9px;
        letter-spacing: 0.2em;
      }
    }

    .hud-bottom {
      gap: 16px;

      .data-blocks {
        gap: 3px;

        .data-block {
          width: 6px;
        }
      }

      .hud-range {
        font-size: 9px;
      }
    }

    .data-bars {
      display: none;
    }
  }

  // 页面内容调整
  .page-content {
    padding: 20px 16px;
  }

  .chapter-title {
    font-size: 24px;

    &::after {
      width: 40px;
      height: 2px;
    }
  }

  .chapter-desc {
    font-size: 13px;
    margin-bottom: 16px;
  }

  // 确认页按钮调整
  .cyber-start-btn {
    min-width: 240px;
    padding: 16px 28px;
    font-size: 16px;
  }

  .confirm-bottom {
    gap: 14px;
  }

  .confirm-presets-bar {
    gap: 8px;
  }
}

/* 小屏手机 (480px 以下) */
@media (max-width: 480px) {
  .opening-form {
    padding: 8px;
    // 为右下角主题/设置与左下角按钮栈留出空间，避免与封面底栏重叠
    padding-bottom: calc(130px + env(safe-area-inset-bottom, 0px));
  }

  .book-container {
    height: 96vh;
    border-radius: 16px;
    min-width: 0;
  }

  .cover-page {
    gap: 12px;
    padding: 20px 12px 12px;
  }

  .center-card-wrapper .center-card {
    min-height: 220px;
    padding: 24px 16px;
    border-radius: 16px;

    .card-content {
      .book-icon-wrapper {
        margin-bottom: 12px;

        .icon-glow {
          inset: -12px;
          filter: blur(12px);
        }
      }

      .book-icon {
        font-size: 36px;
      }

      .book-title {
        font-size: 26px;
      }

      .book-subtitle {
        font-size: 10px;
        letter-spacing: 0.15em;
        margin-bottom: 12px;
      }

      .book-desc {
        font-size: 12px;
        letter-spacing: 0.05em;
      }
    }

    .card-inner-border {
      inset: 12px;
      border-radius: 12px;

      &::before {
        inset: 12px;
        border-radius: 8px;
      }
    }
  }

  .center-card-wrapper .start-btn-wrapper {
    margin-top: 16px;

    .btn-pulse-ring {
      display: none;
    }

    .start-btn {
      padding: 12px 28px;
      font-size: 14px;
      border-radius: 40px;
    }
  }

  .bottom-tools {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;

    .tool-btn {
      padding: 10px 14px;
      font-size: 11px;
      gap: 6px;
      flex: 0 0 auto;
      max-width: 100%;
      width: 100%;

      i {
        font-size: 12px;
      }
    }
  }

  // HUD 最小化
  .hud-decoration {
    .corner-mark {
      display: none;
    }

    .hud-top {
      top: 12px;

      .hud-line {
        width: 40px;
      }

      .hud-label {
        font-size: 8px;
        letter-spacing: 0.15em;
      }
    }

    .hud-bottom {
      bottom: 12px;

      .hud-range {
        font-size: 8px;
      }
    }
  }

  // 页面头部简化
  .page-header {
    padding: 16px 20px;

    .nav-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;

      i {
        font-size: 14px;
      }
    }

    .page-number {
      font-size: 11px;
    }
  }

  .page-content {
    padding: 16px 12px;
  }

  .chapter-title {
    font-size: 22px;
    margin-bottom: 6px;

    &::after {
      width: 32px;
      bottom: -4px;
    }
  }

  // 表单元素调整
  .scene-card {
    padding: 14px;

    .scene-icon {
      width: 36px;
      height: 36px;
      font-size: 18px;
      margin-bottom: 8px;
    }

    .scene-name {
      font-size: 14px;
    }

    .scene-desc {
      font-size: 11px;
    }
  }

  .rule-item {
    padding: 12px;
    gap: 10px;
  }

  .library-toolbar-btn {
    padding: 8px 14px;
    font-size: 12px;
  }

  // 确认页调整
  .cyber-start-btn {
    min-width: 200px;
    padding: 14px 24px;
    font-size: 15px;
    border-radius: 14px;
  }

  // 底部按钮调整
  .opening-bottom-left-stack .chronicle-clear-btn,
  .theme-toggle {
    height: 40px;
    padding: 0 12px;
  }

  .theme-toggle {
    width: 40px;
  }
}

/* 超小屏手机 (360px 以下) */
@media (max-width: 360px) {
  .book-container {
    border-radius: 12px;
  }

  .cover-page {
    padding: 16px 10px 10px;
  }

  .center-card-wrapper .center-card {
    min-height: 200px;
    padding: 20px 12px;

    .card-content {
      .book-icon {
        font-size: 32px;
      }

      .book-title {
        font-size: 22px;
      }

      .book-subtitle {
        font-size: 9px;
      }

      .book-desc {
        font-size: 11px;
      }
    }
  }

  .center-card-wrapper .start-btn-wrapper .start-btn {
    padding: 10px 24px;
    font-size: 13px;
  }

  .bottom-tools {
    .tool-btn {
      padding: 6px 12px;
      font-size: 10px;
    }
  }
}

/* 极窄屏（≤300px 宽，如 300×800 设备） */
@media (max-width: 300px) {
  .opening-form {
    padding: 4px;
    padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  }

  .book-container {
    border-radius: 10px;
    max-width: 100%;
    min-width: 0;
  }

  .cover-page {
    padding: 12px 8px 8px;
  }

  .center-card-wrapper .center-card {
    min-height: 180px;
    padding: 16px 10px;

    .card-content {
      .book-icon {
        font-size: 28px;
      }

      .book-title {
        font-size: 20px;
      }

      .book-subtitle {
        font-size: 8px;
      }

      .book-desc {
        font-size: 10px;
      }
    }
  }

  .center-card-wrapper .start-btn-wrapper .start-btn {
    padding: 8px 18px;
    font-size: 12px;
  }

  .bottom-tools .tool-btn {
    padding: 5px 8px;
    font-size: 9px;
  }

  .chapter-title {
    font-size: 18px;
  }

  .rule-item,
  .scene-card {
    padding: 10px;
  }
}

/* 高度限制适配 (短屏幕) */
@media (max-height: 700px) {
  .book-container {
    height: 94vh;
  }

  .cover-page {
    padding-top: 20px;
    padding-bottom: 16px;
  }

  .center-card-wrapper .center-card {
    min-height: auto;
    padding: 24px 20px;

    .card-content {
      .book-icon-wrapper {
        margin-bottom: 12px;
      }

      .book-title {
        font-size: 28px;
      }

      .book-subtitle {
        margin-bottom: 12px;
      }
    }
  }

  .center-card-wrapper .start-btn-wrapper {
    margin-top: 16px;
  }
}

/* 超短屏幕 (600px 以下高度) */
@media (max-height: 600px) {
  .opening-form {
    padding: 8px;
  }

  .book-container {
    height: 96vh;
  }

  // 封面页改为横向滚动或压缩
  .cover-page {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
  }

  .center-card-wrapper .center-card {
    padding: 20px 16px;

    .card-content {
      .book-icon-wrapper {
        margin-bottom: 8px;
      }

      .book-icon {
        font-size: 32px;
      }

      .book-title {
        font-size: 24px;
      }

      .book-subtitle {
        margin-bottom: 8px;
      }

      .book-desc {
        font-size: 11px;
      }
    }
  }

  // 底部工具栏横向排列
  .bottom-tools {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    overflow-x: visible;
    gap: 8px;
    padding-bottom: 8px;

    .tool-btn {
      flex: 0 1 auto;
      flex-shrink: 0;
      padding: 6px 12px;
      font-size: 11px;
    }
  }

  // 隐藏部分HUD元素
  .hud-decoration {
    .hud-top,
    .hud-bottom {
      display: none;
    }
  }

  // 页面内容可滚动
  .page-content {
    max-height: calc(96vh - 60px);
    overflow-y: auto;
  }
}

/* 原有响应式规则整合 */
@media (max-width: 900px) {
  .opening-form {
    padding: 16px;
  }

  .book-container {
    min-height: 620px;
    border-radius: 22px;
  }

  .book-page {
    min-height: 620px;
  }

  .page-content {
    padding: 20px;
    max-height: 560px;
  }

  .chapter-title {
    font-size: 24px;
  }
}

@media (max-width: 640px) {
  .scene-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .form-row {
    flex-direction: column;
    gap: 8px;
  }

  .char-gender-select {
    width: 100%;
  }

  .opening-settings-btn {
    right: 12px;
    bottom: 60px;
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }

  .theme-toggle {
    right: 12px;
    bottom: 12px;
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }

  .opening-bottom-left-stack {
    left: 12px;
    bottom: 12px;
    gap: 8px;
  }

  .opening-bottom-left-stack .chronicle-clear-btn {
    padding: 0 12px;
    height: 40px;
    font-size: 12px;
    border-radius: 12px;
  }

  // 确认页调整
  .confirm-content {
    padding: 20px 16px;
  }

  .summary-section {
    margin: 12px 0 20px;
    padding: 14px;
  }

  .summary-item {
    padding: 8px 0;

    .summary-label,
    .summary-value {
      font-size: 12px;
    }
  }

  .confirm-actions {
    padding: 20px 0;
  }

  // 弹窗适配
  .chronicle-dialog-backdrop {
    padding: 12px 10px;
  }

  .chronicle-dialog-panel {
    padding: 18px;
    border-radius: 16px;
    max-height: min(88dvh, 800px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
  }

  .opening-dialog-panel--wide {
    max-width: min(calc(100vw - 20px), var(--ui-max-width, 100%));
  }

  .opening-dialog-list--scroll {
    max-height: min(48vh, calc(320px * var(--ui-scale, 1)));
  }

  .opening-dialog-list-item {
    padding: 10px 12px;
  }

  .chronicle-dialog-actions {
    gap: 8px;

    .chronicle-dialog-btn {
      min-width: 76px;
      padding: 8px 14px;
      font-size: 13px;
    }
  }
}

/* 窄手机：规则/角色表单与工具条纵向铺满，避免横向挤压 */
@media (max-width: 420px) {
  .library-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .library-toolbar-btn {
    width: 100%;
    justify-content: center;
    box-sizing: border-box;
  }

  .add-rule-btn,
  .add-char-btn {
    width: 100%;
    justify-content: center;
    box-sizing: border-box;
  }

  .custom-rules-section,
  .character-form {
    padding: 12px 10px;
  }

  .custom-rule-input {
    gap: 8px;
  }

  .chronicle-dialog-backdrop {
    padding: 8px;
  }

  .chronicle-dialog-panel {
    padding: 14px 14px 12px;
  }

  .chronicle-dialog-title {
    font-size: 16px;
  }

  .chronicle-dialog-desc {
    font-size: 13px;
    margin-bottom: 14px;
  }

  .opening-dialog-list-item {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .opening-dialog-list-item--stack .opening-dialog-list-actions {
    align-self: stretch;
    justify-content: flex-end;
  }
}
</style>