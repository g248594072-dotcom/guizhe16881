<template>
  <div class="settings-panel settings-panel--mode-only" :class="{ dark: isDarkMode, light: !isDarkMode }">
    <div class="settings-tab-bar" role="tablist" aria-label="系统设置分类">
      <button
        type="button"
        class="settings-tab-btn"
        :class="{ active: settingsTab === 'output' }"
        role="tab"
        :aria-selected="settingsTab === 'output'"
        @click="settingsTab = 'output'"
      >
        <i class="fa-solid fa-gears"></i>
        输出与 API
      </button>
      <button
        type="button"
        class="settings-tab-btn"
        :class="{ active: settingsTab === 'options' }"
        role="tab"
        :aria-selected="settingsTab === 'options'"
        title="剧情选项点击行为、编辑暂存（购物车）"
        @click="settingsTab = 'options'"
      >
        <i class="fa-solid fa-list-check"></i>
        选项与输入
      </button>
      <button
        type="button"
        class="settings-tab-btn"
        :class="{ active: settingsTab === 'layout' }"
        role="tab"
        :aria-selected="settingsTab === 'layout'"
        @click="settingsTab = 'layout'"
      >
        <i class="fa-solid fa-maximize"></i>
        界面与布局
      </button>
    </div>

    <!-- 输出模式 / 双 API -->
    <div v-show="settingsTab === 'output'" class="settings-tab-panel">
      <!-- 数据库：剧情推进 / 自动填表（独立开关） -->
      <div
        class="shujuku-master-toggle"
        :class="{ dark: isDarkMode, light: !isDarkMode, 'cyber-card': isDarkMode }"
      >
        <div class="shujuku-master-section-head">
          <div class="shujuku-master-icon">
            <i class="fa-solid fa-database"></i>
          </div>
          <div class="shujuku-master-section-titles">
            <span class="shujuku-master-section-title">数据库联动（可选）</span>
            <p class="shujuku-master-section-lead">未安装扩展时不会产生实际调用。</p>
          </div>
        </div>

        <div class="shujuku-toggle-row">
          <div class="shujuku-toggle-label">
            <span class="shujuku-toggle-title">剧情推进</span>
            <span class="shujuku-toggle-hint">发送消息前标记意图，供数据库写入规划数据</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="enableShujukuPlotAdvance"
              @change="persistShujukuPlotAdvance"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="shujuku-toggle-row">
          <div class="shujuku-toggle-label">
            <span class="shujuku-toggle-title">自动填表</span>
            <span class="shujuku-toggle-hint">确认标签并写入楼层后调用「立即手动更新」</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="enableShujukuManualUpdateAfterConfirm"
              @change="persistShujukuManualUpdateOption"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="shujuku-inject-actions">
          <button
            type="button"
            class="btn-api btn-api-secondary"
            :disabled="injectTemplateLoading"
            @click="runInjectBundledTemplate"
          >
            <i class="fa-solid fa-file-import"></i>
            {{ injectTemplateLoading ? '注入中…' : '注入内置表格模板' }}
          </button>
        </div>

        <div class="shujuku-inject-actions trace-download-row">
          <button type="button" class="btn-api btn-api-secondary" @click="emit('downloadGenerationTrace')">
            <i class="fa-solid fa-file-arrow-down"></i>
            下载上一轮 AI 调用追踪（txt）
          </button>
          <p class="trace-download-hint">
            记录本界面发起的 <code>generate</code> / <code>generateRaw</code>：传入参数摘要与模型返回；不含酒馆主进程拼好的完整
            messages。
          </p>
        </div>
      </div>

      <!-- API 模式选择卡片 -->
      <div class="mode-cards mode-cards--standalone">
      <div
        class="mode-card"
        :class="{
          active: outputMode === 'single',
          dark: isDarkMode,
          light: !isDarkMode,
          'cyber-card': isDarkMode,
        }"
        @click="selectMode('single')"
      >
        <div class="mode-header">
          <div class="mode-icon">
            <i class="fa-solid fa-microchip"></i>
          </div>
          <div class="mode-info">
            <h4 class="mode-title">单API模式</h4>
            <span class="mode-badge">默认</span>
          </div>
          <div class="mode-radio">
            <div class="radio-circle" :class="{ checked: outputMode === 'single' }">
              <i v-if="outputMode === 'single'" class="fa-solid fa-check"></i>
            </div>
          </div>
        </div>
        <div class="mode-body">
          <p class="mode-desc">一次输出完整剧情 + 变量更新</p>
          <ul class="mode-features">
            <li><i class="fa-solid fa-check"></i> 简单直接，适合大多数场景</li>
            <li><i class="fa-solid fa-check"></i> 无需额外配置</li>
            <li><i class="fa-solid fa-check"></i> 使用世界书变量规则</li>
          </ul>
        </div>
      </div>

      <div
        class="mode-card"
        :class="{
          active: outputMode === 'dual',
          dark: isDarkMode,
          light: !isDarkMode,
          'cyber-card': isDarkMode,
        }"
        @click="selectMode('dual')"
      >
        <div class="mode-header">
          <div class="mode-icon dual">
            <i class="fa-solid fa-network-wired"></i>
          </div>
          <div class="mode-info">
            <h4 class="mode-title">双API模式</h4>
            <span class="mode-badge advanced">高级</span>
          </div>
          <div class="mode-radio">
            <div class="radio-circle" :class="{ checked: outputMode === 'dual' }">
              <i v-if="outputMode === 'dual'" class="fa-solid fa-check"></i>
            </div>
          </div>
        </div>
        <div class="mode-body">
          <p class="mode-desc">主API输出剧情，第二API单独处理变量</p>
          <ul class="mode-features">
            <li><i class="fa-solid fa-bolt"></i> 变量更新更精准</li>
            <li><i class="fa-solid fa-tachograph"></i> 可使用轻量级模型</li>
            <li><i class="fa-solid fa-clock"></i> 更快响应速度</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 双 API：第二路配置（主 API 只负责剧情；最后一对 &lt;maintext&gt; 闭合后由第二路 generateRaw 单独处理变量，短上下文） -->
    <div
      v-if="outputMode === 'dual'"
      class="dual-api-config"
      :class="{ dark: isDarkMode, light: !isDarkMode }"
    >
      <h3 class="dual-api-title">
        <i class="fa-solid fa-sliders"></i>
        第二 API 配置
      </h3>

      <label class="field-row checkbox-row">
        <input
          v-model="secondaryApi.useTavernMainConnection"
          type="checkbox"
          :disabled="!secondaryApiUrlTrimmed"
          @change="onSecondaryTavernPlugChange"
        />
        <span
          >使用酒馆当前聊天补全连接（与主对话同一插头与<strong>同一模型</strong>，密钥不写入本地；勾选时「输入模型名 / 可用模型」不生效）<template v-if="!secondaryApiUrlTrimmed"
            >— <strong class="secondary-plug-need-url">须先填写下方 API URL</strong> 才可开启</template
          ></span
        >
      </label>

      <template v-if="!secondaryApi.useTavernMainConnection">
        <label class="field-label">API URL（OpenAI 兼容，可填根地址或 /v1 等）</label>
        <input
          v-model="secondaryApi.url"
          class="field-input"
          type="url"
          placeholder="https://api.openai.com/v1"
          autocomplete="off"
          @blur="persistSecondaryApi"
        />

        <label class="field-label">API Key</label>
        <input
          v-model="secondaryApi.key"
          class="field-input"
          type="password"
          placeholder="sk-..."
          autocomplete="new-password"
          @blur="persistSecondaryApi"
        />
      </template>

      <template v-if="!secondaryApi.useTavernMainConnection">
        <label class="field-label" for="secondary-model-text">输入模型名</label>
        <div class="model-row">
          <input
            id="secondary-model-text"
            v-model="secondaryApi.model"
            class="field-input model-input"
            type="text"
            placeholder="可手动输入；或在下方「可用模型」中点选后自动填入"
            autocomplete="off"
            @blur="persistSecondaryApi"
          />
        </div>
        <label class="field-label" for="secondary-model-select">可用模型</label>
        <select
          id="secondary-model-select"
          class="field-input secondary-model-select"
          :value="secondaryModelSelectBinding"
          @change="onSecondaryModelSelectChange"
        >
          <option value="">{{ fetchedModels.length ? '— 从列表选择 —' : '— 请先点击「获取可用模型」—' }}</option>
          <option v-for="m in fetchedModels" :key="m" :value="m">{{ m }}</option>
        </select>
      </template>

      <label class="field-label">最大重试次数（0–10，失败后的额外尝试次数）</label>
      <div class="retry-row">
        <input
          v-model.number="secondaryApi.maxRetries"
          class="field-input retry-input"
          type="number"
          min="0"
          max="10"
          step="1"
          @change="onRetriesChange"
        />
        <span class="retry-note">总尝试次数 = 1 + 该值</span>
      </div>

      <div class="secondary-api-extra-head">
        <div class="secondary-api-extra-head-left">
          <span class="secondary-api-extra-head-title secondary-extra-streamer">第二 API 额外任务</span>
          <div class="secondary-task-info-anchor" data-extra-info-key="intro">
            <button
              type="button"
              class="secondary-task-info-btn"
              :aria-expanded="extraInfoOpen === 'intro'"
              aria-label="本区说明"
              @click.stop="toggleExtraInfo('intro')"
            >
              !
            </button>
          </div>
        </div>
        <div class="secondary-api-extra-head-spacer"></div>
        <div class="secondary-api-extra-head-right">
          <label class="secondary-api-split-inline">
            <input
              :checked="false"
              class="secondary-extra-task-checkbox"
              type="checkbox"
              disabled
            />
            <span class="secondary-split-label secondary-extra-streamer secondary-extra-streamer--soft"
              >额外API执行额外任务（更新中）</span>
          </label>
          <div class="secondary-task-info-anchor" data-extra-info-key="split">
            <button
              type="button"
              class="secondary-task-info-btn"
              :aria-expanded="extraInfoOpen === 'split'"
              aria-label="额外API执行额外任务说明（更新中）"
              @click.stop="toggleExtraInfo('split')"
            >
              !
            </button>
          </div>
        </div>
      </div>

      <div class="field-row checkbox-row secondary-extra-task-row">
        <div class="secondary-extra-task-main">
          <label class="secondary-extra-task-check">
            <input
              v-model="secondaryApi.tasks.includeMaintextBeautification"
              class="secondary-extra-task-checkbox"
              type="checkbox"
              @change="persistSecondaryApi"
            />
            <span class="secondary-extra-task-label secondary-extra-streamer">正文美化</span>
          </label>
          <div class="secondary-task-info-anchor" data-extra-info-key="beautify">
            <button
              type="button"
              class="secondary-task-info-btn"
              :aria-expanded="extraInfoOpen === 'beautify'"
              aria-label="正文美化说明"
              @click.stop="toggleExtraInfo('beautify')"
            >
              !
            </button>
          </div>
        </div>
      </div>
      <div
        v-if="secondaryApi.tasks.includeMaintextBeautification"
        class="beautify-html-chance-block"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
      >
        <label class="field-label" for="beautify-html-chance-range">小前端（&lt;htmlcontent&gt;）生成几率</label>
        <div class="beautify-html-chance-row">
          <input
            id="beautify-html-chance-range"
            v-model.number="secondaryApi.maintextBeautifyHtmlcontentChance"
            class="beautify-html-chance-range"
            type="range"
            min="0"
            max="100"
            step="1"
            @input="persistSecondaryApi"
          />
          <span class="beautify-html-chance-value">{{ clampedBeautifyChance }}%</span>
        </div>
      </div>
      <div class="field-row checkbox-row secondary-extra-task-row">
        <div class="secondary-extra-task-main">
          <label class="secondary-extra-task-check">
            <input
              v-model="secondaryApi.tasks.includeWorldChanges"
              class="secondary-extra-task-checkbox"
              type="checkbox"
              @change="persistSecondaryApi"
            />
            <span class="secondary-extra-task-label secondary-extra-streamer">NPC生活</span>
          </label>
          <div class="secondary-task-info-anchor" data-extra-info-key="world">
            <button
              type="button"
              class="secondary-task-info-btn"
              :aria-expanded="extraInfoOpen === 'world'"
              aria-label="NPC生活说明"
              @click.stop="toggleExtraInfo('world')"
            >
              !
            </button>
          </div>
        </div>
      </div>
      <div class="field-row checkbox-row secondary-extra-task-row">
        <div class="secondary-extra-task-main">
          <label class="secondary-extra-task-check">
            <input
              v-model="secondaryApi.tasks.includeWorldEvolution"
              class="secondary-extra-task-checkbox"
              type="checkbox"
              @change="persistSecondaryApi"
            />
            <span class="secondary-extra-task-label secondary-extra-streamer">世界演化(用处不大)</span>
          </label>
          <div class="secondary-task-info-anchor" data-extra-info-key="evolution">
            <button
              type="button"
              class="secondary-task-info-btn"
              :aria-expanded="extraInfoOpen === 'evolution'"
              aria-label="世界演化(用处不大)说明"
              @click.stop="toggleExtraInfo('evolution')"
            >
              !
            </button>
          </div>
        </div>
      </div>

      <div v-if="!secondaryApi.useTavernMainConnection" class="api-actions">
        <button type="button" class="btn-api" @click="saveSecondaryApiManual">
          <i class="fa-solid fa-floppy-disk"></i>
          保存
        </button>
        <button
          type="button"
          class="btn-api btn-api-secondary"
          :disabled="secondaryModelsLoading"
          @click="runFetchModels"
        >
          <i class="fa-solid fa-list"></i>
          {{ secondaryModelsLoading ? '获取中…' : '获取可用模型' }}
        </button>
      </div>
      <p v-if="secondaryTestMessage" class="api-status" :class="secondaryTestOk ? 'ok' : 'err'">
        {{ secondaryTestMessage }}
      </p>
    </div>
    </div>

    <!-- 点击选项时：直接发送 vs 填入输入框 -->
    <div v-show="settingsTab === 'options'" class="settings-tab-panel">
      <!-- 编辑暂存（购物车）：置顶，便于在系统设置中找到；默认开启见 DEFAULT_OTHER_SETTINGS -->
      <div
        class="edit-staging-cart-toggle"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
      >
        <div class="shujuku-master-section-head">
          <div class="shujuku-master-icon">
            <i class="fa-solid fa-cart-shopping"></i>
          </div>
          <div class="shujuku-master-section-titles">
            <span class="shujuku-master-section-title">编辑暂存（购物车）</span>
            <p class="shujuku-master-section-lead">
              所有的修改暂存购物车，可以统一检视和二次编辑，确认。：建议开启否则修改没有容错。
            </p>
          </div>
        </div>
        <div class="shujuku-toggle-row">
          <div class="shujuku-toggle-label">
            <span class="shujuku-toggle-title">启用编辑暂存</span>
            <span class="shujuku-toggle-hint">关闭前会弹窗确认；若购物车非空会先清空暂存</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="enableEditStagingCart"
              @change="() => void persistEnableEditStagingCart()"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- 修改是否写入对话框：仅保留两行说明 + 开关 -->
      <div
        class="edit-staging-cart-toggle staging-summary-settings-card"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
      >
        <div class="shujuku-master-section-head">
          <div class="shujuku-master-icon staging-summary-settings-card__icon">
            <i class="fa-solid fa-file-lines"></i>
          </div>
          <div class="shujuku-master-section-titles">
            <span class="shujuku-master-section-title">修改是否写入对话框</span>
          </div>
        </div>
        <div class="shujuku-toggle-row">
          <div class="shujuku-toggle-label">
            <span class="shujuku-toggle-hint">
              开启：前端编辑，修改，添加之后写入对话框。<br />
              关闭：前端编辑，修改，添加之后不写入对话框。
            </span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              v-model="copyStagingChangeHintsToInput"
              @change="persistCopyStagingChangeHintsToInput"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- 抢话 / 防抢话：世界书四选一互斥 -->
      <div
        class="edit-staging-cart-toggle speech-intent-wb-card"
        :class="{ dark: isDarkMode, light: !isDarkMode }"
      >
        <div class="shujuku-master-section-head">
          <div class="shujuku-master-icon">
            <i class="fa-solid fa-comments"></i>
          </div>
          <div class="shujuku-master-section-titles">
            <span class="shujuku-master-section-title">抢话与防抢话（世界书）</span>
            <p class="shujuku-master-section-lead">
              下拉选择当前<strong>唯一启用</strong>的意向条目；其余三条会在当前角色卡绑定的<strong>主世界书</strong>中自动关闭。条目名称须与世界书中一致。
            </p>
          </div>
        </div>
        <div class="speech-intent-select-row">
          <label class="speech-intent-select-label" for="speech-intent-wb-select">当前意向</label>
          <select
            id="speech-intent-wb-select"
            v-model="speechIntentWorldbookMode"
            :class="['speech-intent-select', { dark: isDarkMode, light: !isDarkMode }]"
            @change="persistSpeechIntentWorldbook"
          >
            <option v-for="m in speechIntentWorldModes" :key="m" :value="m">
              {{ speechIntentOptionLabel(m) }}
            </option>
          </select>
        </div>
      </div>

      <p class="option-behavior-hint">
        点击剧情选项（A / B / C 等）时，将选项文本<strong>直接发送给 AI</strong>，或
        <strong>仅填入本界面底部输入框</strong>（可再编辑后手动发送），在此选择行为。
      </p>
      <div class="mode-cards mode-cards--standalone">
        <div
          class="mode-card"
          :class="{ active: inputActionMode === 'send', dark: isDarkMode, light: !isDarkMode }"
          @click="selectInputActionMode('send')"
        >
          <div class="mode-header">
            <div class="mode-icon">
              <i class="fa-solid fa-paper-plane"></i>
            </div>
            <div class="mode-info">
              <h4 class="mode-title">直接发送</h4>
              <span class="mode-badge">快捷</span>
            </div>
            <div class="mode-radio">
              <div class="radio-circle" :class="{ checked: inputActionMode === 'send' }">
                <i v-if="inputActionMode === 'send'" class="fa-solid fa-check"></i>
              </div>
            </div>
          </div>
          <div class="mode-body">
            <p class="mode-desc">选项文本填入输入框并立即发送</p>
            <ul class="mode-features">
              <li><i class="fa-solid fa-check"></i> 一键推进剧情</li>
              <li><i class="fa-solid fa-check"></i> 适合信任选项措辞时</li>
            </ul>
          </div>
        </div>

        <div
          class="mode-card"
          :class="{ active: inputActionMode === 'append', dark: isDarkMode, light: !isDarkMode }"
          @click="selectInputActionMode('append')"
        >
          <div class="mode-header">
            <div class="mode-icon dual">
              <i class="fa-solid fa-keyboard"></i>
            </div>
            <div class="mode-info">
              <h4 class="mode-title">填入输入框</h4>
              <span class="mode-badge">默认</span>
            </div>
            <div class="mode-radio">
              <div class="radio-circle" :class="{ checked: inputActionMode === 'append' }">
                <i v-if="inputActionMode === 'append'" class="fa-solid fa-check"></i>
              </div>
            </div>
          </div>
          <div class="mode-body">
            <p class="mode-desc">将选项文本写入前端对话框，不自动发送</p>
            <ul class="mode-features">
              <li><i class="fa-solid fa-check"></i> 可修改、补充后再发送</li>
              <li><i class="fa-solid fa-check"></i> 更安全，避免误点</li>
            </ul>
          </div>
        </div>
      </div>

      <p class="option-behavior-hint shujuku-options-hint" :class="{ dark: isDarkMode, light: !isDarkMode }">
        数据库的<strong>剧情推进</strong>与<strong>自动填表</strong>开关在<strong>输出与 API</strong>页顶部「数据库联动」区域。
      </p>
    </div>

    <!-- 界面缩放与主区域长宽（与开局页、游戏主界面共用 localStorage uiLayout） -->
    <div v-show="settingsTab === 'layout'" class="settings-tab-panel settings-tab-panel--layout">
      <p class="layout-intro-hint">
        调整<strong>整体字号与控件比例</strong>（缩放）、主界面<strong>最大宽度</strong>与<strong>最大高度</strong>。开局表单与进入游戏后的主 UI 会读取同一套设置。
      </p>

      <div class="layout-field-block layout-game-time-toggle-block">
        <div class="layout-field-head">
          <label class="field-label layout-field-label" for="show-game-time-hud">显示游戏时间</label>
          <label class="toggle-switch">
            <input
              id="show-game-time-hud"
              v-model="showGameTimeHud"
              type="checkbox"
              @change="persistShowGameTimeHud"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <p class="layout-field-note">
          主界面正文区顶部的时间条；默认显示。关闭后不占位。与下方缩放、宽高一样<strong>变更后立即生效</strong>（写入杂项设置，无需点底部保存）。
        </p>
      </div>

      <div class="layout-field-block layout-game-time-toggle-block">
        <div class="layout-field-head">
          <label class="field-label layout-field-label" for="rule-ui-dark-mode">深色界面</label>
          <label class="toggle-switch">
            <input
              id="rule-ui-dark-mode"
              v-model="isDarkMode"
              aria-label="深色界面"
              type="checkbox"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <p class="layout-field-note">
          开启为<strong>深色</strong>主题，关闭为<strong>浅色</strong>主题。与左侧栏解耦，仅在此与开局设置中切换；变更立即生效并写入本机。
        </p>
      </div>

      <div class="layout-field-block">
        <div class="layout-field-head">
          <span class="field-label layout-field-label">标签卡全屏 / 半屏</span>
        </div>
        <div class="tab-panel-span-segmented" role="group" aria-label="侧栏标签与游戏正文的布局">
          <button
            type="button"
            class="tab-panel-span-btn"
            :class="{ 'tab-panel-span-btn--active': layoutTabPanelSpan === 'split' }"
            @click="setTabPanelSpan('split')"
          >
            半屏
          </button>
          <button
            type="button"
            class="tab-panel-span-btn"
            :class="{ 'tab-panel-span-btn--active': layoutTabPanelSpan === 'full' }"
            @click="setTabPanelSpan('full')"
          >
            全屏
          </button>
        </div>
        <p class="layout-field-note">
          <strong>半屏</strong>：打开人物/规则/设置等标签时，侧栏为固定宽，右侧仍显示游戏正文。
          <strong>全屏</strong>：打开上述标签时占满主区域，游戏正文区暂时隐藏，关闭标签后恢复。与下方宽高一样变更后立即生效。
          <strong>手机无效</strong>（窄屏下侧栏为全幅抽屉，不区分全屏/半屏）。
        </p>
      </div>

      <div class="layout-field-block">
        <div class="layout-field-head">
          <label class="field-label layout-field-label" for="ui-scale-range">界面缩放</label>
          <span class="layout-value-pill">{{ layoutScaleDisplay }}</span>
        </div>
        <input
          id="ui-scale-range"
          class="layout-range-input"
          type="range"
          min="0.8"
          max="1.3"
          step="0.05"
          :value="layoutScale"
          @input="onLayoutScaleInput"
        />
        <p class="layout-field-note">范围 0.8～1.3，默认 0.8。影响 <code>--ui-scale</code>。</p>
      </div>

      <div class="layout-field-block">
        <div class="layout-field-head">
          <label class="field-label layout-field-label" for="ui-max-width-range">主界面最大宽度（px）</label>
          <span class="layout-value-pill">{{ layoutMaxWidth }} px</span>
        </div>
        <input
          id="ui-max-width-range"
          class="layout-range-input"
          type="range"
          :min="UI_MAIN_WIDTH_MIN_PX"
          :max="UI_MAIN_WIDTH_MAX_PX"
          step="10"
          :value="layoutMaxWidth"
          @input="onLayoutMaxWidthInput"
        />
        <p class="layout-field-note">{{ UI_MAIN_WIDTH_MIN_PX }}～{{ UI_MAIN_WIDTH_MAX_PX }}，默认 900。</p>
      </div>

      <div class="layout-field-block">
        <div class="layout-field-head">
          <label class="field-label layout-field-label" for="ui-max-height-range">主界面最大高度（px）</label>
          <span class="layout-value-pill">{{ layoutMaxHeight }} px</span>
        </div>
        <input
          id="ui-max-height-range"
          class="layout-range-input"
          type="range"
          :min="UI_MAIN_HEIGHT_MIN_PX"
          :max="UI_MAIN_HEIGHT_MAX_PX"
          step="10"
          :value="layoutMaxHeight"
          @input="onLayoutMaxHeightInput"
        />
        <p class="layout-field-note">{{ UI_MAIN_HEIGHT_MIN_PX }}～{{ UI_MAIN_HEIGHT_MAX_PX }}，与 iframe 最小高度对齐。</p>
      </div>

      <p class="layout-field-note layout-field-note--footer">
        「高度模式」仅随存档保留字段，主界面尚未按该选项分支；当前实际高度以「最大高度」数值为准。调整缩放或宽高后会有轻提示。
      </p>
    </div>

    <!-- 第二 API 额外任务说明：挂到 body + fixed，避免侧栏 overflow 裁切 -->
    <Teleport to="body">
      <div
        v-if="extraInfoOpen"
        ref="extraInfoPopoverRoot"
        class="secondary-task-popover secondary-task-popover--teleported"
        :class="isDarkMode ? 'teleported-popover--dark' : 'teleported-popover--light'"
        :style="extraInfoFixedBoxStyle"
        role="tooltip"
        @click.stop
      >
        <template v-if="extraInfoOpen === 'intro'">
          <p class="secondary-task-popover-text">
            变量更新（&lt;UpdateVariable&gt;）为第二 API 的默认行为，无需开关；下方仅控制可选附加任务。
          </p>
        </template>
        <template v-else-if="extraInfoOpen === 'split'">
          <p class="secondary-task-popover-text">
            主 API 一次 → 第二 API 仅变量一次 → 第二 API 附加任务一次（共三调用）。
          </p>
          <p class="secondary-task-popover-text">
            开启后：首轮第二 API 只生成「纯变量」Patch（不含游戏状态/地图等）；再单独调用第二 API，按下方勾选执行正文美化、NPC生活、世界演化(用处不大)，并把 Patch 与正文合并进本回合结果。关闭时附加任务与变量同轮或并行（与旧版一致）。
          </p>
        </template>
        <template v-else-if="extraInfoOpen === 'beautify'">
          <p class="secondary-task-popover-text">
            第二 API 将 HTML 写回 &lt;maintext&gt;；变量仍按美化前正文计算。
          </p>
          <p class="secondary-task-popover-text">
            每回合美化时单独随机：0% 永不出块，100% 每回必出；仅勾选「正文美化」时参与计算。
          </p>
        </template>
        <template v-else-if="extraInfoOpen === 'world'">
          <p class="secondary-task-popover-text">
            「NPC生活」含世界大势与居民生活 / NPC 状态相关说明，一并生成。
          </p>
        </template>
        <template v-else-if="extraInfoOpen === 'evolution'">
          <p class="secondary-task-popover-text">演化地图中的世界。</p>
          <p class="secondary-task-popover-text">
            开启后，第二 API 在本回合「变量更新」生成结束后会再跑一路短上下文：综合正文、元信息、游戏状态（含世界大势等）、角色内心与位置、已有区域/建筑/活动，推断是否需新增或调整地图语义；若有，则生成仅针对
            <strong>区域数据 / 建筑数据 / 活动数据</strong> 的 JSON Patch，并<strong>追加合并</strong>到同一轮
            <code>&lt;UpdateVariable&gt;</code> 的 Patch 数组中（不单独多一轮用户可见延迟）。
          </p>
        </template>
      </div>
    </Teleport>

    <!-- 保存成功提示：挂到 body，避免被侧栏 transform / overflow 裁切 -->
    <Teleport to="body">
      <div v-if="showSaveSuccess" class="save-success-toast save-success-toast--teleported">
        <i class="fa-solid fa-check-circle"></i>
        <span>设置已保存</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onBeforeUnmount, watch } from 'vue';
import type { OutputMode, SecondaryApiConfig, InputActionMode, SpeechIntentWorldbookMode } from '../types';
import {
  SPEECH_INTENT_WORLD_MODES,
  SPEECH_INTENT_WORLDBOOK_NAME_VARIANTS,
} from '../types';
import {
  DEFAULT_SECONDARY_API_CONFIG,
  fetchSecondaryApiModelList,
  clampSecondaryApiRetries,
} from '../utils/apiSettings';
import type { TabPanelSpan, UiLayoutSettings } from '../utils/uiLayoutLimits';
import {
  UI_MAIN_HEIGHT_MIN_PX,
  UI_MAIN_HEIGHT_MAX_PX,
  UI_MAIN_WIDTH_MIN_PX,
  UI_MAIN_WIDTH_MAX_PX,
  clampMainUiHeightPx,
  clampMainUiWidthPx,
} from '../utils/uiLayoutLimits';
import {
  loadOutputMode,
  saveOutputMode,
  loadSecondaryApiConfig,
  saveSecondaryApiConfig,
  saveUiLayout,
} from '../utils/localSettings';
import { getOtherSettings, saveOtherSettings } from '../utils/otherSettings';
import { applySpeechIntentWorldbookMode } from '../utils/speechIntentWorldbook';
import { injectBundledTavernDbTemplate } from '../utils/shujukuBridge';
/** 内置注入用表格模板：与 `src/规则/data/tavernDbBundledTemplate.json` 同源，构建时打包；改表后请同步该文件并重建前端。 */
import tavernDbBundledTemplate from '../data/tavernDbBundledTemplate.json';
import Swal from 'sweetalert2';
import { useEditCartStore } from '../stores/editCart';
import {
  loadFontSettings,
  applyFont,
  DEFAULT_FONT_SETTINGS,
  type FontSettings,
} from '../utils/fontManager';

const props = defineProps<{
  /** 由 App 唯一水合，避免本组件再 readGameData 合并布局导致闪动 */
  uiLayout: UiLayoutSettings;
}>();

/** 与 App 根级深浅色一致，双向绑定 */
const isDarkMode = defineModel<boolean>('isDarkMode', { required: true });

const emit = defineEmits<{
  (e: 'modeChange', mode: OutputMode): void;
  (e: 'updateWorldbook', mode: OutputMode): void;
  (e: 'layoutChange', layout: UiLayoutSettings): void;
  (e: 'downloadGenerationTrace'): void;
}>();

const settingsTab = ref<'output' | 'options' | 'layout'>('output');

const outputMode = ref<OutputMode>('dual');

const inputActionMode = ref<InputActionMode>('append');

/** 发送前是否标记意图以触发数据库剧情推进 */
const enableShujukuPlotAdvance = ref(true);

/** 标签确认写入楼层后是否调用数据库 manualUpdate（默认开；未装插件时静默跳过） */
const enableShujukuManualUpdateAfterConfirm = ref(true);

/** 编辑暂存（购物车）：先入队再统一提交（默认开启，与 OtherSettings 一致） */
const enableEditStagingCart = ref(true);

/** 「修改是否写入对话框」：是否把修改说明写入本界面输入框（与是否启用购物车无关） */
const copyStagingChangeHintsToInput = ref(true);

/** 主界面顶部游戏时间条（默认显示） */
const showGameTimeHud = ref(true);

/** 抢话/防抢话世界书四选一（与 OtherSettings 一致，默认一般防抢话） */
const speechIntentWorldbookMode = ref<SpeechIntentWorldbookMode>('anti_soft');

const speechIntentWorldModes = SPEECH_INTENT_WORLD_MODES;

function speechIntentOptionLabel(mode: SpeechIntentWorldbookMode): string {
  return SPEECH_INTENT_WORLDBOOK_NAME_VARIANTS[mode][0];
}

const secondaryApi = ref<SecondaryApiConfig>({ ...DEFAULT_SECONDARY_API_CONFIG });

/** 有非空 API URL 时才允许勾选「使用酒馆当前聊天补全」；随机规则等也依赖填写地址的直连 */
const secondaryApiUrlTrimmed = computed(() => String(secondaryApi.value.url || '').trim().length > 0);

function onSecondaryTavernPlugChange() {
  if (!secondaryApiUrlTrimmed.value) {
    secondaryApi.value.useTavernMainConnection = false;
  }
  persistSecondaryApi();
}

watch(
  () => String(secondaryApi.value.url ?? '').trim(),
  trimmed => {
    if (!trimmed && secondaryApi.value.useTavernMainConnection) {
      secondaryApi.value.useTavernMainConnection = false;
      persistSecondaryApi();
    }
  },
);

const SECONDARY_API_SYNC_EVENT = 'rule-modifier-secondary-api-updated';
const OUTPUT_MODE_SYNC_EVENT = 'rule-modifier-output-mode-updated';

function reloadOutputModeFromStorage() {
  try {
    outputMode.value = loadOutputMode();
  } catch (e) {
    console.warn('[SettingsPanel] reloadOutputModeFromStorage failed:', e);
  }
}

function reloadSecondaryApiFromStorage() {
  try {
    const loaded = loadSecondaryApiConfig();
    loaded.maxRetries = clampSecondaryApiRetries(loaded.maxRetries);
    secondaryApi.value = loaded;
    if (!String(secondaryApi.value.url || '').trim() && secondaryApi.value.useTavernMainConnection) {
      secondaryApi.value.useTavernMainConnection = false;
      saveSecondaryApiConfig(secondaryApi.value);
    }
  } catch (e) {
    console.warn('[SettingsPanel] reloadSecondaryApiFromStorage failed:', e);
  }
}

/** 「第二 API 额外任务」区：说明气泡当前打开的 key（内容 Teleport 到 body + fixed） */
const extraInfoOpen = ref<string | null>(null);
const extraInfoPopoverRoot = ref<HTMLElement | null>(null);
const extraInfoFixedBoxStyle = ref<Record<string, string>>({});
let extraInfoWindowClickRemove: (() => void) | null = null;

function clearExtraInfoWindowClick() {
  if (extraInfoWindowClickRemove) {
    extraInfoWindowClickRemove();
    extraInfoWindowClickRemove = null;
  }
}

/** 按视口钳制：水平往内收，垂直优先向下、不够则向上，仍超高则 maxHeight+滚动 */
function updateExtraInfoFixedPosition() {
  const key = extraInfoOpen.value;
  if (!key) {
    extraInfoFixedBoxStyle.value = {};
    return;
  }
  const anchor = document.querySelector(`[data-extra-info-key="${key}"]`) as HTMLElement | null;
  const btn = anchor?.querySelector('.secondary-task-info-btn') as HTMLElement | null;
  const root = extraInfoPopoverRoot.value;
  if (!btn || !root) return;

  const pad = 10;
  const gap = 8;
  const br = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.min(360, vw - 2 * pad);

  const rr = root.getBoundingClientRect();
  let pw = rr.width > 4 ? rr.width : maxW;
  let ph = Math.max(rr.height, 24);

  let left = br.left;
  if (left + pw > vw - pad) {
    left = vw - pad - pw;
  }
  if (left < pad) {
    left = pad;
  }
  if (pw > vw - 2 * pad) {
    left = pad;
    pw = vw - 2 * pad;
  }

  const topBelow = br.bottom + gap;
  const topAbove = br.top - gap - ph;
  let top: number;
  if (topBelow + ph <= vh - pad) {
    top = topBelow;
  } else if (topAbove >= pad) {
    top = topAbove;
  } else {
    top = pad;
  }

  if (top + ph > vh - pad) {
    top = Math.max(pad, vh - pad - ph);
  }
  if (top < pad) {
    top = pad;
  }

  const maxH = vh - pad - top;
  const style: Record<string, string> = {
    position: 'fixed',
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    zIndex: '12050',
    maxWidth: `${Math.round(maxW)}px`,
    boxSizing: 'border-box',
  };
  if (pw > 0 && pw <= maxW) {
    style.width = `${Math.round(pw)}px`;
  }
  if (ph > maxH - 1) {
    style.maxHeight = `${Math.max(96, Math.round(maxH))}px`;
    style.overflowY = 'auto';
  }
  extraInfoFixedBoxStyle.value = style;
}

function scheduleExtraInfoFixedPosition() {
  nextTick(() => {
    requestAnimationFrame(() => {
      updateExtraInfoFixedPosition();
      requestAnimationFrame(() => {
        updateExtraInfoFixedPosition();
      });
    });
  });
}

function onExtraInfoResizeOrScroll() {
  if (extraInfoOpen.value) {
    updateExtraInfoFixedPosition();
  }
}

function closeExtraInfoPopover() {
  extraInfoOpen.value = null;
  extraInfoFixedBoxStyle.value = {};
  clearExtraInfoWindowClick();
  window.removeEventListener('resize', onExtraInfoResizeOrScroll);
  window.removeEventListener('scroll', onExtraInfoResizeOrScroll, true);
}

function toggleExtraInfo(key: string) {
  if (extraInfoOpen.value === key) {
    closeExtraInfoPopover();
    return;
  }
  closeExtraInfoPopover();
  extraInfoOpen.value = key;
  scheduleExtraInfoFixedPosition();
  nextTick(() => {
    setTimeout(() => {
      const handler = (e: MouseEvent) => {
        const el = e.target as HTMLElement | null;
        if (el?.closest?.('.secondary-task-info-anchor') || el?.closest?.('.secondary-task-popover--teleported')) {
          return;
        }
        closeExtraInfoPopover();
      };
      window.addEventListener('click', handler);
      window.addEventListener('resize', onExtraInfoResizeOrScroll);
      window.addEventListener('scroll', onExtraInfoResizeOrScroll, true);
      extraInfoWindowClickRemove = () => {
        window.removeEventListener('click', handler);
        window.removeEventListener('resize', onExtraInfoResizeOrScroll);
        window.removeEventListener('scroll', onExtraInfoResizeOrScroll, true);
      };
    }, 0);
  });
}

onBeforeUnmount(() => {
  closeExtraInfoPopover();
  if (typeof window !== 'undefined') {
    window.removeEventListener(SECONDARY_API_SYNC_EVENT, reloadSecondaryApiFromStorage);
    window.removeEventListener(OUTPUT_MODE_SYNC_EVENT, reloadOutputModeFromStorage);
  }
});

/** 小前端生成几率 0–100（展示用，与 persist 时 clamp 一致） */
const clampedBeautifyChance = computed(() => {
  const v = Math.round(Number(secondaryApi.value.maintextBeautifyHtmlcontentChance));
  if (Number.isNaN(v)) return DEFAULT_SECONDARY_API_CONFIG.maintextBeautifyHtmlcontentChance;
  return Math.min(100, Math.max(0, v));
});

/** 当前模型 id 若在已拉取的列表中则与下拉同步，否则下拉显示占位项 */
const secondaryModelSelectBinding = computed(() => {
  const m = String(secondaryApi.value.model || '').trim();
  return fetchedModels.value.includes(m) ? m : '';
});

const fontSettings = ref<FontSettings>({ ...DEFAULT_FONT_SETTINGS });

const showSaveSuccess = ref(false);

const fetchedModels = ref<string[]>([]);
const secondaryModelsLoading = ref(false);
const secondaryTestMessage = ref('');
const secondaryTestOk = ref(false);

const injectTemplateLoading = ref(false);

const lastErrorToastTime = ref(0);
const ERROR_TOAST_THROTTLE = 5000;

/** 布局滑块连续拖动时限制 toastr 频率 */
const lastLayoutToastTime = ref(0);
const LAYOUT_TOAST_THROTTLE_MS = 400;

function normalizedLayout(): UiLayoutSettings {
  return {
    scale: Math.min(1.3, Math.max(0.8, Number(props.uiLayout.scale) || 0.8)),
    maxWidth: clampMainUiWidthPx(props.uiLayout.maxWidth ?? 900),
    maxHeight: clampMainUiHeightPx(props.uiLayout.maxHeight ?? 600),
    heightMode: props.uiLayout.heightMode === 'custom' ? 'custom' : 'fit',
    tabPanelSpan: props.uiLayout.tabPanelSpan === 'full' ? 'full' : 'split',
  };
}

function commitLayout(patch: Partial<UiLayoutSettings>) {
  const base = normalizedLayout();
  const next: UiLayoutSettings = { ...base, ...patch };
  if (patch.scale !== undefined) {
    next.scale = Math.min(1.3, Math.max(0.8, Number(patch.scale)));
  }
  if (patch.maxWidth !== undefined) {
    next.maxWidth = clampMainUiWidthPx(patch.maxWidth);
  }
  if (patch.maxHeight !== undefined) {
    next.maxHeight = clampMainUiHeightPx(patch.maxHeight);
  }
  if (patch.heightMode !== undefined) {
    next.heightMode = patch.heightMode === 'custom' ? 'custom' : 'fit';
  }
  if (patch.tabPanelSpan !== undefined) {
    next.tabPanelSpan = patch.tabPanelSpan === 'full' ? 'full' : 'split';
  }
  emit('layoutChange', next);
  saveUiLayout(next);
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);

  const now = Date.now();
  if (now - lastLayoutToastTime.value >= LAYOUT_TOAST_THROTTLE_MS) {
    lastLayoutToastTime.value = now;
    toastr.success('界面布局已应用');
  }
}

const layoutScale = computed(() => normalizedLayout().scale);

const layoutScaleDisplay = computed(() => `${layoutScale.value.toFixed(2)}×`);

const layoutMaxWidth = computed(() => normalizedLayout().maxWidth);

const layoutMaxHeight = computed(() => normalizedLayout().maxHeight);

function onLayoutScaleInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value);
  commitLayout({ scale: raw });
}

function onLayoutMaxWidthInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (!Number.isFinite(v)) return;
  commitLayout({ maxWidth: v });
}

function onLayoutMaxHeightInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (!Number.isFinite(v)) return;
  commitLayout({ maxHeight: v });
}

const layoutTabPanelSpan = computed<TabPanelSpan>(() => normalizedLayout().tabPanelSpan);

function setTabPanelSpan(mode: TabPanelSpan) {
  if (layoutTabPanelSpan.value === mode) return;
  commitLayout({ tabPanelSpan: mode });
}

function throttledErrorToast(message: string) {
  const now = Date.now();
  if (now - lastErrorToastTime.value >= ERROR_TOAST_THROTTLE) {
    lastErrorToastTime.value = now;
    toastr.error(message);
  }
}

onMounted(() => {
  loadSettings();
  if (typeof window !== 'undefined') {
    window.addEventListener(SECONDARY_API_SYNC_EVENT, reloadSecondaryApiFromStorage);
    window.addEventListener(OUTPUT_MODE_SYNC_EVENT, reloadOutputModeFromStorage);
  }
});

function loadSettings() {
  try {
    outputMode.value = loadOutputMode();
    const loaded = loadSecondaryApiConfig();
    loaded.maxRetries = clampSecondaryApiRetries(loaded.maxRetries);
    secondaryApi.value = loaded;
    if (!String(secondaryApi.value.url || '').trim() && secondaryApi.value.useTavernMainConnection) {
      secondaryApi.value.useTavernMainConnection = false;
      saveSecondaryApiConfig(secondaryApi.value);
    }
    const other = getOtherSettings();
    inputActionMode.value = other.inputActionMode;
    enableShujukuPlotAdvance.value = other.enableShujukuPlotAdvance;
    enableShujukuManualUpdateAfterConfirm.value = other.enableShujukuManualUpdateAfterConfirm;
    enableEditStagingCart.value = other.enableEditStagingCart;
    copyStagingChangeHintsToInput.value = other.copyStagingChangeHintsToInput;
    showGameTimeHud.value = other.showGameTimeHud;
    speechIntentWorldbookMode.value = other.speechIntentWorldbookMode;
    fontSettings.value = loadFontSettings();
    applyFont(fontSettings.value.currentFontId);
    console.log('✅ [SettingsPanel] 设置从 localStorage 加载成功:', {
      outputMode: outputMode.value,
      secondaryApi: { ...secondaryApi.value, key: '***' },
      inputActionMode: inputActionMode.value,
      enableShujukuPlotAdvance: enableShujukuPlotAdvance.value,
      enableShujukuManualUpdateAfterConfirm: enableShujukuManualUpdateAfterConfirm.value,
      fontSettings: fontSettings.value,
    });
  } catch (error) {
    console.warn('⚠️ [SettingsPanel] 从 localStorage 加载设置失败:', error);
  }
}

function persistSecondaryApi() {
  secondaryApi.value.splitSecondaryVariablePassAndExtras = false;
  secondaryApi.value.maxRetries = clampSecondaryApiRetries(secondaryApi.value.maxRetries);
  let c = Math.round(Number(secondaryApi.value.maintextBeautifyHtmlcontentChance));
  if (Number.isNaN(c)) {
    c = DEFAULT_SECONDARY_API_CONFIG.maintextBeautifyHtmlcontentChance;
  }
  secondaryApi.value.maintextBeautifyHtmlcontentChance = Math.min(100, Math.max(0, c));
  saveSecondaryApiConfig(secondaryApi.value);
}

function onRetriesChange() {
  secondaryApi.value.maxRetries = clampSecondaryApiRetries(secondaryApi.value.maxRetries);
  persistSecondaryApi();
}

/** 手动保存第二 API（自定义 URL 时；勾选酒馆插头时无此按钮，配置随各控件变更已自动保存） */
function saveSecondaryApiManual() {
  persistSecondaryApi();
  secondaryTestOk.value = true;
  secondaryTestMessage.value = '第二 API 配置已保存。';
  toastr.success('第二 API 已保存');
}

function onSecondaryModelSelectChange(e: Event) {
  const v = String((e.target as HTMLSelectElement).value || '').trim();
  if (!v) return;
  secondaryApi.value.model = v;
  persistSecondaryApi();
}

async function runFetchModels() {
  secondaryTestMessage.value = '';
  secondaryModelsLoading.value = true;
  try {
    const list = await fetchSecondaryApiModelList(secondaryApi.value);
    fetchedModels.value = list.slice(0, 500);
    secondaryTestOk.value = true;
    secondaryTestMessage.value = `已获取 ${list.length} 个模型（可在下方「可用模型」中选择）。`;
    toastr.success(`已获取 ${list.length} 个模型`);
  } catch (e) {
    secondaryTestOk.value = false;
    const msg = e instanceof Error ? e.message : String(e);
    secondaryTestMessage.value = `获取模型失败：${msg}`;
    toastr.error('获取模型列表失败');
  } finally {
    secondaryModelsLoading.value = false;
  }
}

async function runInjectBundledTemplate() {
  injectTemplateLoading.value = true;
  try {
    const { ok, message } = await injectBundledTavernDbTemplate(tavernDbBundledTemplate);
    if (ok) {
      toastr.success(message?.trim() ? message : '表格模板已注入');
    } else {
      toastr.error(message?.trim() ? message : '注入失败');
    }
  } catch (e) {
    toastr.error(e instanceof Error ? e.message : '注入失败');
  } finally {
    injectTemplateLoading.value = false;
  }
}

function saveSettings(layoutSnapshot?: UiLayoutSettings) {
  const layout = layoutSnapshot ?? normalizedLayout();
  try {
    saveOutputMode(outputMode.value);
    secondaryApi.value.maxRetries = clampSecondaryApiRetries(secondaryApi.value.maxRetries);
    saveSecondaryApiConfig(secondaryApi.value);
    saveUiLayout(layout);
    saveOtherSettings({
      inputActionMode: inputActionMode.value,
      enableShujukuPlotAdvance: enableShujukuPlotAdvance.value,
      enableShujukuManualUpdateAfterConfirm: enableShujukuManualUpdateAfterConfirm.value,
      enableEditStagingCart: enableEditStagingCart.value,
      copyStagingChangeHintsToInput: copyStagingChangeHintsToInput.value,
      showGameTimeHud: showGameTimeHud.value,
      speechIntentWorldbookMode: speechIntentWorldbookMode.value,
    });
    showSaveSuccess.value = true;
    setTimeout(() => {
      showSaveSuccess.value = false;
    }, 2000);
  } catch (error) {
    console.error('保存设置失败:', error);
    throttledErrorToast('设置保存失败');
  }
}

function persistShujukuPlotAdvance() {
  saveOtherSettings({
    enableShujukuPlotAdvance: enableShujukuPlotAdvance.value,
  });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(
    enableShujukuPlotAdvance.value ? '已开启：剧情推进' : '已关闭：剧情推进',
  );
}

function persistShujukuManualUpdateOption() {
  saveOtherSettings({
    enableShujukuManualUpdateAfterConfirm: enableShujukuManualUpdateAfterConfirm.value,
  });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(
    enableShujukuManualUpdateAfterConfirm.value
      ? '已开启：自动填表（确认标签后 manualUpdate）'
      : '已关闭：自动填表',
  );
}

async function persistSpeechIntentWorldbook() {
  const mode = speechIntentWorldbookMode.value;
  const prev = getOtherSettings().speechIntentWorldbookMode;
  if (!saveOtherSettings({ speechIntentWorldbookMode: mode })) {
    speechIntentWorldbookMode.value = prev;
    throttledErrorToast('变量不可写，抢话意向未保存');
    return;
  }
  const r = await applySpeechIntentWorldbookMode(mode);
  if (!r.ok) {
    toastr.warning(r.message || '世界书未更新');
  } else {
    toastr.success('抢话/防抢话世界书已同步');
  }
}

function persistShowGameTimeHud() {
  saveOtherSettings({ showGameTimeHud: showGameTimeHud.value });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(showGameTimeHud.value ? '已开启：主界面游戏时间条' : '已关闭：主界面游戏时间条');
}

function persistCopyStagingChangeHintsToInput() {
  saveOtherSettings({ copyStagingChangeHintsToInput: copyStagingChangeHintsToInput.value });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(
    copyStagingChangeHintsToInput.value
      ? '已开启：修改说明将写入本界面对话框'
      : '已关闭：修改说明仅在发送时写入玩家楼（与变量块合并）',
  );
}

async function persistEnableEditStagingCart() {
  if (!enableEditStagingCart.value) {
    const cart = useEditCartStore();
    const n = cart.pendingCount;
    const html =
      n > 0
        ? `<p>购物车中有 <strong>${n}</strong> 条未提交项，确认关闭后将<strong>清空暂存</strong>。</p><p>关闭「编辑暂存」后：<strong>本界面所有修改会立即写入变量</strong>，且<strong>无法再通过侧栏暂存统一检视或撤回</strong>（只能逐项改回）。</p>`
        : `<p>关闭「编辑暂存」后：<strong>本界面所有修改会立即写入变量</strong>，且<strong>无法再通过侧栏暂存统一检视或撤回</strong>（只能逐项改回）。</p>`;

    const result = await Swal.fire({
      title: '关闭「编辑暂存（购物车）」？',
      html,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '确认关闭',
      cancelButtonText: '保留开启',
      confirmButtonColor: '#ca8a04',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) {
      enableEditStagingCart.value = true;
      return;
    }
    if (n > 0) {
      cart.clear();
    }
  }

  saveOtherSettings({ enableEditStagingCart: enableEditStagingCart.value });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(
    enableEditStagingCart.value ? '已开启：编辑暂存（购物车）' : '已关闭：编辑暂存（立即生效，无法再经暂存撤回）',
  );
}

function selectInputActionMode(mode: InputActionMode) {
  if (inputActionMode.value === mode) return;
  inputActionMode.value = mode;
  saveOtherSettings({ inputActionMode: mode });
  showSaveSuccess.value = true;
  setTimeout(() => {
    showSaveSuccess.value = false;
  }, 2000);
  toastr.success(mode === 'send' ? '已设为：点击选项直接发送' : '已设为：点击选项填入输入框');
}

async function selectMode(mode: OutputMode) {
  if (outputMode.value === mode) return;

  const oldMode = outputMode.value;
  outputMode.value = mode;

  await saveSettings();

  emit('modeChange', mode);

  if (mode === 'dual') {
    try {
      emit('updateWorldbook', mode);
      toastr.success('已切换到双API模式');
    } catch (error) {
      console.error('更新世界书失败:', error);
      toastr.error('切换失败');
    }
  } else if (oldMode === 'dual' && mode === 'single') {
    try {
      emit('updateWorldbook', mode);
      toastr.success('已切换到单API模式');
    } catch (error) {
      console.error('更新世界书失败:', error);
      toastr.error('切换失败');
    }
  }
}
</script>

<style lang="scss" scoped>
.settings-panel {
  padding: 24px;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.settings-panel--mode-only {
  justify-content: flex-start;
  overflow-y: auto;
}

.settings-tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: -4px 0 16px;
  flex-shrink: 0;
}

.settings-tab-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.dark .settings-tab-btn {
  background: #2d2d33;
  color: #d4d4d8;
  border-color: rgba(255, 255, 255, 0.12);
}

.dark .settings-tab-btn:hover {
  background: #3f3f46;
}

.dark .settings-tab-btn.active {
  background: #1e3a5f;
  border-color: #60a5fa;
  color: #f8fafc;
}

.light .settings-tab-btn {
  background: #fff;
  color: #3f3f46;
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.light .settings-tab-btn:hover {
  border-color: rgba(0, 0, 0, 0.12);
}

.light .settings-tab-btn.active {
  background: rgba(59, 130, 246, 0.08);
  border-color: #3b82f6;
  color: #1e40af;
}

.settings-tab-panel {
  flex: 1;
  min-height: 0;
}

.shujuku-bridge-block {
  margin-top: 20px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.dark .shujuku-bridge-block {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);
}

.light .shujuku-bridge-block {
  background: rgba(255, 255, 255, 0.6);
}

/* 数据库联动区域 */
.shujuku-master-toggle {
  margin-bottom: 20px;
  padding: 14px 16px;
  border-radius: 12px;
}

.shujuku-master-toggle:not(.cyber-card) {
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.dark .shujuku-master-toggle:not(.cyber-card) {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.25);
}

.shujuku-master-toggle.cyber-card {
  border: 1px solid rgba(0, 243, 255, 0.25);
}

.light .shujuku-master-toggle:not(.cyber-card) {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.2);
}

.shujuku-master-section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.shujuku-master-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  color: white;
  font-size: 16px;
}

.shujuku-master-section-titles {
  flex: 1;
  min-width: 0;
}

.shujuku-master-section-title {
  display: block;
  font-size: 15px;
  font-weight: 600;
}

.shujuku-master-section-lead {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.45;
  opacity: 0.85;
}

.dark .shujuku-master-section-lead {
  color: #a1a1aa;
}

.light .shujuku-master-section-lead {
  color: #52525b;
}

.edit-staging-cart-toggle {
  margin: 0 0 20px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(234, 179, 8, 0.35);
}

.dark .edit-staging-cart-toggle {
  background: rgba(234, 179, 8, 0.1);
}

.light .edit-staging-cart-toggle {
  background: rgba(234, 179, 8, 0.06);
}

.edit-staging-cart-toggle .shujuku-master-icon {
  background: linear-gradient(135deg, #ca8a04, #eab308);
}

/* 与购物车卡片区分：「修改是否写入对话框」独立成块 */
.staging-summary-settings-card {
  border-color: rgba(59, 130, 246, 0.35);
}

.dark .staging-summary-settings-card {
  background: rgba(59, 130, 246, 0.12);
}

.light .staging-summary-settings-card {
  background: rgba(59, 130, 246, 0.06);
}

.staging-summary-settings-card__icon {
  background: linear-gradient(135deg, #2563eb, #60a5fa) !important;
}

.shujuku-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.dark .shujuku-toggle-row {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.shujuku-master-section-head + .shujuku-toggle-row {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.shujuku-toggle-label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shujuku-toggle-title {
  font-size: 14px;
  font-weight: 600;
}

.shujuku-toggle-hint {
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.8;
}

.dark .shujuku-toggle-hint {
  color: #a1a1aa;
}

.light .shujuku-toggle-hint {
  color: #52525b;
}

.shujuku-inject-actions {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.trace-download-row {
  flex-direction: column;
  align-items: flex-start;
}

.trace-download-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  max-width: 42rem;
  opacity: 0.9;
}

.trace-download-hint code {
  font-size: 11px;
}

.dark .trace-download-hint {
  color: #a1a1aa;
}

.light .trace-download-hint {
  color: #52525b;
}

.shujuku-options-hint {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}

.dark .shujuku-options-hint {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #d4d4d8;
}

.light .shujuku-options-hint {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #3f3f46;
}

/* 开关样式 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.25);
  border-radius: 24px;
  transition: 0.2s;
}

.dark .toggle-slider {
  background-color: rgba(255, 255, 255, 0.2);
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

input:checked + .toggle-slider {
  background-color: #3b82f6;
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* 禁用的子选项 */
.checkbox-row.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-row .muted {
  color: #71717a;
}

.shujuku-bridge-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.shujuku-bridge-lead {
  margin-bottom: 12px !important;
}

.shujuku-bridge-lead code {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
}

.dark .shujuku-bridge-lead code {
  background: rgba(255, 255, 255, 0.08);
}

.light .shujuku-bridge-lead code {
  background: rgba(0, 0, 0, 0.06);
}

.option-behavior-hint {
  font-size: 13px;
  line-height: 1.55;
  margin: 0 0 16px;
  opacity: 0.92;
}

.dark .option-behavior-hint {
  color: #d4d4d8;
}

.light .option-behavior-hint {
  color: #52525b;
}

.dark.settings-panel {
  background: #1f1f23;
}

.light.settings-panel {
  background: #f4f4f5;
}

.mode-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mode-cards--standalone {
  flex: 0 0 auto;
}

.mode-card {
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

.mode-card:not(.cyber-card) {
  border: 2px solid transparent;

  &.active {
    border-color: #3b82f6;
  }
}

.dark .mode-card:not(.cyber-card) {
  background: #2d2d33;
  border-color: rgba(255, 255, 255, 0.18);

  &:hover {
    background: #3f3f46;
    border-color: rgba(255, 255, 255, 0.28);
  }

  &.active {
    background: #1e40af;
    border-color: #93c5fd;
  }
}

.mode-card.cyber-card {
  border: 2px solid rgba(51, 51, 51, 0.6);

  &.active {
    border-color: var(--color-neon-cyan);
    box-shadow: 0 0 18px rgba(0, 243, 255, 0.2);
  }
}

.light .mode-card:not(.cyber-card) {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  &:hover {
    border-color: rgba(0, 0, 0, 0.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &.active {
    background: rgba(59, 130, 246, 0.05);
    border-color: #3b82f6;
  }
}

.mode-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.mode-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;

  &.dual {
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }
}

.mode-info {
  flex: 1;
}

.mode-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.dark .mode-title {
  color: #fafafa;
}

.light .mode-title {
  color: #18181b;
}

.mode-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #a1a1aa;

  &.advanced {
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }
}

.light .mode-badge {
  background: rgba(0, 0, 0, 0.05);
  color: #71717a;
}

.mode-radio {
  .radio-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    i {
      font-size: 12px;
    }
  }
}

.dark .mode-radio .radio-circle {
  border-color: rgba(255, 255, 255, 0.2);
  color: #3b82f6;

  &.checked {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }
}

.light .mode-radio .radio-circle {
  border-color: rgba(0, 0, 0, 0.2);
  color: #3b82f6;

  &.checked {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }
}

.mode-body {
  .mode-desc {
    font-size: 14px;
    margin-bottom: 12px;
    line-height: 1.5;
  }
}

.dark .mode-body .mode-desc {
  color: #d4d4d8;
}

.light .mode-body .mode-desc {
  color: #71717a;
}

.mode-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;

    i {
      font-size: 12px;
      width: 16px;
      text-align: center;
    }
  }
}

.dark .mode-features li {
  color: #e4e4e7;

  i {
    color: #4ade80;
  }
}

.light .mode-features li {
  color: #71717a;

  i {
    color: #16a34a;
  }
}

.save-success-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  animation: slideUp 0.3s ease;
  z-index: 20000;

  i {
    font-size: 16px;
  }
}

/* Teleport 到 body 后仍需压住侧栏 z-index:110 */
.save-success-toast--teleported {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.dark .save-success-toast {
  background: rgba(34, 197, 94, 0.9);
  color: #fff;
}

.light .save-success-toast {
  background: #22c55e;
  color: #fff;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.dual-api-config {
  margin-top: 20px;
  padding: 18px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.light .dual-api-config {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.6);
}

.dark .dual-api-config {
  background: rgba(0, 0, 0, 0.2);
}

.dual-api-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 14px;
}

.dark .dual-api-title {
  color: #fafafa;
}

.light .dual-api-title {
  color: #18181b;
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin: 10px 0 6px;
  opacity: 0.9;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
}

.light .field-input {
  border-color: rgba(0, 0, 0, 0.12);
  background: #fff;
  color: #18181b;
}

.field-row.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0;
  font-size: 13px;
  cursor: pointer;
}

.field-row.checkbox-row input {
  margin-top: 3px;
}

.model-row {
  width: 100%;
}

.model-input {
  font-family: ui-monospace, monospace;
}

.secondary-model-select {
  width: 100%;
  margin-top: 2px;
  cursor: pointer;
}

/* 可用模型下拉：黑底白字 / 亮底深字（与 dark 同节点 .dual-api-config.dark） */
.dual-api-config.dark .secondary-model-select {
  color-scheme: dark;
  background-color: #0a0a0a;
  color: #fafafa;
  border-color: rgba(255, 255, 255, 0.28);
}

.dual-api-config.dark .secondary-model-select option {
  background-color: #0a0a0a;
  color: #fafafa;
}

.dual-api-config.light .secondary-model-select {
  color-scheme: light;
  background-color: #fff;
  color: #18181b;
  border-color: rgba(0, 0, 0, 0.15);
}

.dual-api-config.light .secondary-model-select option {
  background-color: #fff;
  color: #18181b;
}

.retry-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.retry-input {
  width: 88px;
  max-width: 100%;
}

.retry-note {
  font-size: 12px;
  opacity: 0.75;
}

.beautify-html-chance-block {
  margin: 4px 0 14px 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.18);
}

.beautify-html-chance-block.light {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.04);
}

.beautify-html-chance-block .field-label {
  margin-bottom: 8px;
  font-size: 12px;
}

.beautify-html-chance-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.beautify-html-chance-range {
  flex: 1;
  min-width: 0;
  height: 6px;
  accent-color: #3b82f6;
}

.beautify-html-chance-value {
  min-width: 3.25rem;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 600;
  opacity: 0.9;
}

@keyframes secondary-extra-streamer-shift {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

@keyframes secondary-extra-checkbox-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.45));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(125, 211, 252, 0.85));
  }
}

.secondary-api-extra-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  margin: 10px 0 8px;
}

.secondary-api-extra-head-left,
.secondary-api-extra-head-right {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.secondary-api-extra-head-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.secondary-api-extra-head-spacer {
  flex: 1 1 12px;
  min-width: 8px;
}

@media (max-width: 640px) {
  .secondary-api-extra-head {
    flex-direction: column;
    align-items: stretch;
  }

  .secondary-api-extra-head-spacer {
    display: none;
  }

  .secondary-api-extra-head-left {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .secondary-api-extra-head-right {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

.secondary-api-split-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  cursor: pointer;
  user-select: none;
}

.secondary-split-label {
  line-height: 1.2;
}

.secondary-extra-task-row {
  align-items: center;
}

.secondary-extra-task-row .secondary-extra-task-main {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.secondary-extra-task-check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  cursor: pointer;
  user-select: none;
}

.secondary-extra-task-label {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.25;
}

.dual-api-config.dark .secondary-extra-streamer {
  background-image: linear-gradient(
    105deg,
    #a1a1aa 0%,
    #e4e4e7 20%,
    #fafafa 38%,
    #7dd3fc 50%,
    #fafafa 62%,
    #e4e4e7 80%,
    #a1a1aa 100%
  );
  background-size: 240% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: secondary-extra-streamer-shift 4.2s linear infinite;
}

.dual-api-config.light .secondary-extra-streamer {
  background-image: linear-gradient(
    105deg,
    #71717a 0%,
    #27272a 22%,
    #18181b 40%,
    #3b82f6 50%,
    #18181b 60%,
    #27272a 78%,
    #71717a 100%
  );
  background-size: 240% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: secondary-extra-streamer-shift 4.2s linear infinite;
}

.secondary-extra-streamer--soft {
  font-size: 14px;
  font-weight: 700;
  animation-duration: 5.8s;
}

.secondary-extra-task-checkbox {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin: 0;
  border-radius: 5px;
  cursor: pointer;
  accent-color: #38bdf8;
  transition:
    transform 0.2s ease,
    filter 0.25s ease,
    box-shadow 0.25s ease;
}

.secondary-extra-task-checkbox:hover {
  transform: scale(1.1);
  filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.55));
}

.secondary-extra-task-checkbox:checked {
  filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.65));
  animation: secondary-extra-checkbox-pulse 2.4s ease-in-out infinite;
}

.field-row.checkbox-row.secondary-extra-task-row input.secondary-extra-task-checkbox {
  margin-top: 0;
}

.secondary-task-info-anchor {
  position: relative;
  flex-shrink: 0;
}

.secondary-task-info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.92);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    box-shadow 0.25s ease,
    background 0.2s ease,
    transform 0.15s ease;
}

.light .secondary-task-info-btn {
  border-color: rgba(24, 24, 27, 0.75);
  color: #18181b;
  background: rgba(0, 0, 0, 0.04);
}

.secondary-task-info-btn:hover {
  opacity: 1;
  transform: scale(1.06);
  box-shadow: 0 0 14px rgba(125, 211, 252, 0.45);
}

.light .secondary-task-info-btn:hover {
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.35);
}

.secondary-task-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  width: min(320px, calc(100vw - 48px));
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.secondary-task-popover.secondary-task-popover--teleported {
  margin: 0;
  width: auto;
  min-width: 0;
}

.teleported-popover--dark {
  background: #27272a;
  color: #f4f4f5;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.teleported-popover--light {
  background: #fafafa;
  color: #18181b;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

@media (prefers-reduced-motion: reduce) {
  .dual-api-config.dark .secondary-extra-streamer {
    animation: none;
    background: none;
    -webkit-background-clip: unset;
    background-clip: unset;
    color: #e4e4e7;
  }

  .dual-api-config.light .secondary-extra-streamer {
    animation: none;
    background: none;
    -webkit-background-clip: unset;
    background-clip: unset;
    color: #18181b;
  }

  .secondary-extra-task-checkbox:checked {
    animation: none;
  }
}

.dark .secondary-task-popover {
  background: #27272a;
  color: #f4f4f5;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.light .secondary-task-popover {
  background: #fafafa;
  color: #18181b;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.secondary-task-popover-text {
  margin: 0 0 8px;
}

.secondary-task-popover-text:last-child {
  margin-bottom: 0;
}

.api-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.btn-api {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: #3b82f6;
  color: #fff;
}

.btn-api:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-api-secondary {
  background: #64748b;
}

.dark .btn-api-secondary {
  background: #52525b;
}

.api-status {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.45;
}

.api-status.ok {
  color: #4ade80;
}

.api-status.err {
  color: #f87171;
}

.light .api-status.ok {
  color: #15803d;
}

.light .api-status.err {
  color: #b91c1c;
}

/* —— 界面与布局 标签页 —— */
.layout-intro-hint {
  font-size: 13px;
  line-height: 1.55;
  margin: 0 0 18px;
  opacity: 0.92;
}

.dark .layout-intro-hint {
  color: #d4d4d8;
}

.light .layout-intro-hint {
  color: #52525b;
}

.layout-field-block {
  margin-bottom: 4px;
}

/* 「界面与布局」：每项独立背景框，层次更清晰 */
.settings-panel.dark .settings-tab-panel--layout .layout-field-block {
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 2px 10px rgba(0, 0, 0, 0.25);
}

.settings-panel.light .settings-tab-panel--layout .layout-field-block {
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  box-sizing: border-box;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.settings-panel .settings-tab-panel--layout .layout-field-block .layout-field-note:last-child {
  margin-bottom: 0;
}

.layout-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tab-panel-span-segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.tab-panel-span-btn {
  flex: 1 1 120px;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #a1a1aa;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.tab-panel-span-btn:hover {
  color: #e4e4e7;
  background: rgba(255, 255, 255, 0.08);
}

.tab-panel-span-btn--active {
  color: #fff;
  border-color: rgba(6, 182, 212, 0.55);
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(168, 85, 247, 0.15));
  box-shadow: 0 0 0 1px rgba(6, 182, 212, 0.15);
}

.light .tab-panel-span-btn {
  border-color: rgba(0, 0, 0, 0.1);
  background: #f4f4f5;
  color: #71717a;
}

.light .tab-panel-span-btn:hover {
  color: #18181b;
  background: #e4e4e7;
}

.light .tab-panel-span-btn--active {
  color: #18181b;
  border-color: rgba(6, 182, 212, 0.45);
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(168, 85, 247, 0.1));
}

.layout-field-label {
  margin: 0 !important;
}

.layout-value-pill {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.dark .layout-value-pill {
  background: rgba(255, 255, 255, 0.08);
  color: #e4e4e7;
}

.light .layout-value-pill {
  background: rgba(0, 0, 0, 0.06);
  color: #3f3f46;
}

.layout-range-input {
  display: block;
  width: 100%;
  margin: 0 0 6px;
  accent-color: #3b82f6;
}

.layout-field-note {
  font-size: 12px;
  margin: 0 0 14px;
  opacity: 0.78;
  line-height: 1.45;
}

.dark .layout-field-note {
  color: #a1a1aa;
}

.light .layout-field-note {
  color: #71717a;
}

.layout-field-note code {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
}

.dark .layout-field-note code {
  background: rgba(255, 255, 255, 0.08);
}

.light .layout-field-note code {
  background: rgba(0, 0, 0, 0.06);
}

.layout-field-note--footer {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.light .layout-field-note--footer {
  border-top-color: rgba(0, 0, 0, 0.08);
}

/* 底部说明：同页内单独一框，与上方选项块一致 */
.settings-panel.dark .settings-tab-panel--layout .layout-field-note--footer {
  margin-top: 4px;
  margin-bottom: 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset;
}

.settings-panel.light .settings-tab-panel--layout .layout-field-note--footer {
  margin-top: 4px;
  margin-bottom: 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: #f4f4f5;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.settings-tab-panel--layout .field-label:first-of-type {
  margin-top: 0;
}

.layout-game-time-toggle-block .layout-field-head {
  align-items: center;
}

.speech-intent-wb-card .speech-intent-select-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.speech-intent-select-label {
  font-size: 13px;
  font-weight: 600;
}

.dark .speech-intent-select-label {
  color: #67e8f9;
}

.light .speech-intent-select-label {
  color: #0369a1;
}

.speech-intent-select {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.dark .speech-intent-select {
  background: rgba(8, 15, 30, 0.75);
  border: 1px solid rgba(34, 211, 238, 0.55);
  color: #ecfeff;
}

.dark .speech-intent-select:focus {
  border-color: rgba(103, 232, 249, 0.95);
  box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.2);
}

.light .speech-intent-select {
  background: #fff;
  border: 1px solid #0ea5e9;
  color: #0c4a6e;
}

.light .speech-intent-select:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
}
</style>
