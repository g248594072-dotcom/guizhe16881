<template>
  <Teleport to="body">
    <div class="workshop-modal-overlay" @click.self="$emit('close')">
      <div class="workshop-modal">
        <!-- Header -->
        <header class="workshop-header">
          <h2><i class="fa-solid fa-shop"></i> 创意工坊</h2>
          
          <div class="header-actions">
            <!-- Auth status -->
            <template v-if="currentUser">
              <div class="user-info">
                <img v-if="currentUser.avatar" 
                     :src="`https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`"
                     class="avatar" 
                     alt="avatar" />
                <span>{{ currentUser.username }}</span>
                <span v-if="isAdmin" class="admin-badge">管理员</span>
              </div>
              <button @click="logout" class="btn-text">退出</button>
            </template>
            <button v-else @click="login" class="btn-discord">
              <i class="fa-brands fa-discord"></i> 登录
            </button>
            
            <button @click="$emit('close')" class="btn-close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <!-- Tabs -->
        <nav class="workshop-tabs">
          <button 
            v-for="tab in visibleTabs" 
            :key="tab.id"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <i :class="tab.icon"></i>
            {{ tab.label }}
            <span v-if="tab.id === 'review' && pendingCount > 0" class="badge">{{ pendingCount }}</span>
          </button>
        </nav>

        <!-- Content -->
        <main class="workshop-content">
          <!-- Browse Tab -->
          <div v-if="activeTab === 'browse'" class="tab-content">
            <!-- Type filter -->
            <div class="type-filter">
              <button 
                v-for="type in contentTypes" 
                :key="type.value"
                :class="{ active: selectedType === type.value }"
                @click="selectedType = type.value; loadItems()"
              >
                {{ type.label }}
              </button>
            </div>

            <!-- Items list -->
            <div class="items-grid">
              <div 
                v-for="item in items" 
                :key="item.id"
                class="item-card"
              >
                <div class="item-header">
                  <h4>{{ getItemName(item) }}</h4>
                  <span class="downloads"><i class="fa-solid fa-download"></i> {{ item.downloads }}</span>
                </div>
                
                <p class="item-desc">{{ getItemDesc(item) }}</p>
                
                <div class="item-author">
                  <img v-if="item.author.avatar" 
                       :src="`https://cdn.discordapp.com/avatars/${item.author.id}/${item.author.avatar}.png`"
                       class="avatar-small" />
                  <span>{{ item.author.username }}</span>
                </div>

                <button @click="downloadItem(item)" class="btn-download">
                  <i class="fa-solid fa-plus"></i> 添加到本地
                </button>
              </div>
            </div>

            <div v-if="items.length === 0" class="empty-state">
              暂无内容，成为第一个上传者吧！
            </div>
          </div>

          <!-- Upload Tab -->
          <div v-if="activeTab === 'upload'" class="tab-content">
            <div v-if="!currentUser" class="login-prompt">
              <p>请先登录 Discord 才能上传内容</p>
              <button @click="login" class="btn-discord">
                <i class="fa-brands fa-discord"></i> 登录
              </button>
            </div>
            
            <template v-else>
              <div class="upload-section">
                <label>选择类型</label>
                <select v-model="uploadType">
                  <option v-for="type in contentTypes" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </div>

              <div class="upload-section">
                <label>选择本地内容</label>
                <select v-model="selectedLocalItem">
                  <option value="">-- 请选择 --</option>
                  <option v-for="item in localItemsForUpload" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <div v-if="selectedLocalItem" class="preview-section">
                <h4>预览</h4>
                <pre>{{ JSON.stringify(selectedLocalItemData, null, 2) }}</pre>
              </div>

              <button 
                @click="uploadSelected" 
                class="btn-primary"
                :disabled="!selectedLocalItem || isUploading"
              >
                <i class="fa-solid fa-upload"></i>
                {{ isUploading ? '上传中...' : '上传到创意工坊' }}
              </button>
            </template>
          </div>

          <!-- My Uploads Tab -->
          <div v-if="activeTab === 'my-uploads'" class="tab-content">
            <div v-if="!currentUser" class="login-prompt">
              <p>请先登录</p>
              <button @click="login" class="btn-discord">登录</button>
            </div>
            
            <div v-else-if="myUploads.length === 0" class="empty-state">
              你还没有上传过内容
            </div>
            
            <div v-else class="uploads-list">
              <div 
                v-for="item in myUploads" 
                :key="item.id"
                class="upload-item"
                :class="item.status"
              >
                <div class="upload-header">
                  <span class="status-badge" :class="item.status">{{ statusText(item.status) }}</span>
                  <span class="type-badge">{{ typeLabel(item.type) }}</span>
                  <span class="date">{{ formatDate(item.createdAt) }}</span>
                </div>
                
                <h4>{{ getItemName(item) }}</h4>
                
                <p v-if="item.rejectReason" class="reject-reason">
                  <i class="fa-solid fa-circle-exclamation"></i>
                  拒绝原因：{{ item.rejectReason }}
                </p>

                <div v-if="item.status === 'approved'" class="stats">
                  <i class="fa-solid fa-download"></i> {{ item.downloads }} 次下载
                </div>
              </div>
            </div>
          </div>

          <!-- Review Tab (Admin only) -->
          <div v-if="activeTab === 'review'" class="tab-content">
            <div v-if="!isAdmin" class="login-prompt">
              <p>需要管理员权限</p>
            </div>
            
            <div v-else-if="pendingItems.length === 0" class="empty-state">
              暂无待审核内容
            </div>
            
            <div v-else class="review-list">
              <div 
                v-for="item in pendingItems" 
                :key="item.id"
                class="review-item"
              >
                <div class="review-header">
                  <span class="type-badge">{{ typeLabel(item.type) }}</span>
                  <span class="author">{{ item.author.username }}</span>
                  <span class="date">{{ formatDate(item.createdAt) }}</span>
                </div>

                <h4>{{ getItemName(item) }}</h4>
                
                <div class="preview-box">
                  <pre>{{ JSON.stringify(item.content, null, 2) }}</pre>
                </div>

                <div class="review-actions">
                  <button @click="approveItem(item.id)" class="btn-approve">
                    <i class="fa-solid fa-check"></i> 通过
                  </button>
                  <button @click="showRejectDialog(item.id)" class="btn-reject">
                    <i class="fa-solid fa-xmark"></i> 拒绝
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>

    <!-- Reject Dialog -->
    <div v-if="rejectDialogVisible" class="reject-dialog-overlay">
      <div class="reject-dialog">
        <h3>拒绝原因</h3>
        <textarea 
          v-model="rejectReason" 
          placeholder="请输入拒绝原因（会通知上传者）"
          rows="4"
        ></textarea>
        <div class="dialog-actions">
          <button @click="rejectDialogVisible = false">取消</button>
          <button @click="confirmReject" class="btn-reject">确认拒绝</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { 
  WorkshopItem, WorkshopItemType, WorkshopAuthor, AuthData 
} from '../utils/workshopApi';
import {
  workshopLogin, workshopLogout, loadAuth, isAdmin,
  workshopFetchItems, workshopFetchPending, workshopFetchMyUploads,
  workshopUpload, workshopReview, workshopDownload,
} from '../utils/workshopApi';
import {
  loadOpeningStorage, saveOpeningStorage, mergeWorkshopContent,
} from '../utils/openingStorage';

const emit = defineEmits<{
  close: [];
}>();

// ===== State =====
const activeTab = ref('browse');
const currentUser = ref<WorkshopAuthor | null>(null);
const isAdminUser = ref(false);

const selectedType = ref<WorkshopItemType>('rule');
const items = ref<WorkshopItem[]>([]);

const uploadType = ref<WorkshopItemType>('rule');
const selectedLocalItem = ref('');
const isUploading = ref(false);

const myUploads = ref<WorkshopItem[]>([]);
const pendingItems = ref<WorkshopItem[]>([]);
const pendingCount = computed(() => pendingItems.value.length);

const rejectDialogVisible = ref(false);
const rejectReason = ref('');
const rejectItemId = ref('');

// ===== Config =====
const contentTypes = [
  { value: 'rule' as WorkshopItemType, label: '规则' },
  { value: 'character' as WorkshopItemType, label: '角色' },
  { value: 'scene' as WorkshopItemType, label: '场景' },
  { value: 'openingScene' as WorkshopItemType, label: '开局场景' },
  { value: 'preset' as WorkshopItemType, label: '完整预设' },
];

const tabs = [
  { id: 'browse', label: '浏览', icon: 'fa-solid fa-compass' },
  { id: 'upload', label: '上传', icon: 'fa-solid fa-upload' },
  { id: 'my-uploads', label: '我的上传', icon: 'fa-solid fa-folder-open' },
  { id: 'review', label: '审核', icon: 'fa-solid fa-shield-halved' },
];

const visibleTabs = computed(() => {
  return tabs.filter(t => t.id !== 'review' || isAdminUser.value);
});

// ===== Helpers =====
function getItemName(item: WorkshopItem): string {
  const c = item.content as any;
  return c.name || c.metadata?.name || '未命名';
}

function getItemDesc(item: WorkshopItem): string {
  const c = item.content as any;
  return c.desc || c.metadata?.description || '';
}

function typeLabel(type: WorkshopItemType): string {
  return contentTypes.find(t => t.value === type)?.label || type;
}

function statusText(status: string): string {
  const map: Record<string, string> = {
    pending: '审核中',
    approved: '已通过',
    rejected: '已拒绝',
  };
  return map[status] || status;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ===== Local Storage Access =====
const localStorage = computed(() => loadOpeningStorage());

const localItemsForUpload = computed(() => {
  const storage = localStorage.value;
  switch (uploadType.value) {
    case 'rule': return storage.ruleSnippets;
    case 'character': return storage.characterSnippets;
    case 'scene': return storage.sceneSnippets;
    case 'openingScene': return storage.openingSceneSnippets;
    case 'preset': return storage.presets;
    default: return [];
  }
});

const selectedLocalItemData = computed(() => {
  return localItemsForUpload.value.find(i => i.id === selectedLocalItem.value);
});

// ===== Auth =====
async function login() {
  const auth = await workshopLogin();
  if (auth) {
    currentUser.value = auth.user;
    isAdminUser.value = auth.isAdmin;
    if (auth.isAdmin) {
      loadPending();
    }
  }
}

function logout() {
  workshopLogout();
  currentUser.value = null;
  isAdminUser.value = false;
}

function checkAuth() {
  const auth = loadAuth();
  if (auth) {
    currentUser.value = auth.user;
    isAdminUser.value = auth.isAdmin;
  }
}

// ===== Data Loading =====
async function loadItems() {
  items.value = await workshopFetchItems(selectedType.value);
}

async function loadMyUploads() {
  if (!currentUser.value) return;
  myUploads.value = await workshopFetchMyUploads();
}

async function loadPending() {
  if (!isAdminUser.value) return;
  pendingItems.value = await workshopFetchPending();
}

// ===== Actions =====
async function uploadSelected() {
  if (!selectedLocalItemData.value) return;
  
  isUploading.value = true;
  const result = await workshopUpload(uploadType.value, selectedLocalItemData.value);
  isUploading.value = false;
  
  if (result.success) {
    selectedLocalItem.value = '';
    // Refresh my uploads
    loadMyUploads();
  }
}

async function downloadItem(item: WorkshopItem) {
  const downloaded = await workshopDownload(item.id);
  if (!downloaded) return;

  // Merge into local storage using helper
  const storage = loadOpeningStorage();
  const result = mergeWorkshopContent(storage, item.type, downloaded.content);
  
  if (result.merged) {
    saveOpeningStorage(storage);
    toastr.success(result.message);
  } else {
    toastr.warning(result.message);
  }
}

async function approveItem(id: string) {
  const success = await workshopReview(id, 'approved');
  if (success) {
    pendingItems.value = pendingItems.value.filter(i => i.id !== id);
  }
}

function showRejectDialog(id: string) {
  rejectItemId.value = id;
  rejectReason.value = '';
  rejectDialogVisible.value = true;
}

async function confirmReject() {
  const success = await workshopReview(rejectItemId.value, 'rejected', rejectReason.value);
  if (success) {
    pendingItems.value = pendingItems.value.filter(i => i.id !== rejectItemId.value);
    rejectDialogVisible.value = false;
  }
}

// ===== Lifecycle =====
onMounted(() => {
  checkAuth();
  loadItems();
  if (currentUser.value) {
    loadMyUploads();
    if (isAdminUser.value) {
      loadPending();
    }
  }
});
</script>

<style scoped>
.workshop-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.workshop-modal {
  width: 90%;
  max-width: 1000px;
  height: 80vh;
  background: #1a1a2e;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

/* Header */
.workshop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.workshop-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid white;
}

.admin-badge {
  background: #fbbf24;
  color: #000;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.btn-discord {
  background: #5865F2;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-text {
  background: transparent;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-close {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
}

/* Tabs */
.workshop-tabs {
  display: flex;
  background: #252540;
  border-bottom: 1px solid #333;
}

.workshop-tabs button {
  flex: 1;
  padding: 1rem;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.workshop-tabs button:hover {
  color: #fff;
  background: rgba(102, 126, 234, 0.1);
}

.workshop-tabs button.active {
  color: #fff;
  background: #667eea;
}

.badge {
  background: #f87171;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  font-size: 0.75rem;
}

/* Content */
.workshop-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.tab-content {
  height: 100%;
}

/* Type Filter */
.type-filter {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.type-filter button {
  padding: 0.5rem 1rem;
  background: #252540;
  border: 1px solid #444;
  color: #aaa;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.875rem;
}

.type-filter button.active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

/* Items Grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.item-card {
  background: #252540;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.item-header h4 {
  margin: 0;
  color: white;
  font-size: 1rem;
}

.downloads {
  color: #888;
  font-size: 0.75rem;
}

.item-desc {
  color: #aaa;
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #888;
  font-size: 0.75rem;
}

.avatar-small {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.btn-download {
  background: #4ade80;
  color: #000;
  border: none;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  margin-top: auto;
}

/* Upload Section */
.upload-section {
  margin-bottom: 1.5rem;
}

.upload-section label {
  display: block;
  color: #888;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.upload-section select {
  width: 100%;
  padding: 0.75rem;
  background: #252540;
  border: 1px solid #444;
  color: white;
  border-radius: 6px;
  font-size: 0.875rem;
}

.preview-section {
  background: #1a1a2e;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.preview-section h4 {
  margin: 0 0 0.5rem 0;
  color: #888;
}

.preview-section pre {
  margin: 0;
  color: #aaa;
  font-size: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  width: 100%;
}

.btn-primary:disabled {
  background: #444;
  cursor: not-allowed;
}

/* Uploads List */
.uploads-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.upload-item {
  background: #252540;
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid #667eea;
}

.upload-item.rejected {
  border-left-color: #f87171;
}

.upload-item.approved {
  border-left-color: #4ade80;
}

.upload-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.status-badge.pending {
  background: #fbbf24;
  color: #000;
}

.status-badge.approved {
  background: #4ade80;
  color: #000;
}

.status-badge.rejected {
  background: #f87171;
  color: white;
}

.type-badge {
  background: #444;
  color: #aaa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.date {
  color: #666;
  font-size: 0.75rem;
}

.reject-reason {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* Review List */
.review-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.review-item {
  background: #252540;
  border-radius: 8px;
  padding: 1rem;
}

.review-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.author {
  color: #888;
  font-size: 0.875rem;
}

.preview-box {
  background: #1a1a2e;
  padding: 1rem;
  border-radius: 6px;
  margin: 1rem 0;
  max-height: 300px;
  overflow-y: auto;
}

.preview-box pre {
  margin: 0;
  color: #aaa;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.review-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-approve {
  background: #4ade80;
  color: #000;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}

.btn-reject {
  background: #f87171;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}

/* Reject Dialog */
.reject-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.reject-dialog {
  background: #1a1a2e;
  padding: 1.5rem;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
}

.reject-dialog h3 {
  margin: 0 0 1rem 0;
  color: white;
}

.reject-dialog textarea {
  width: 100%;
  padding: 0.75rem;
  background: #252540;
  border: 1px solid #444;
  color: white;
  border-radius: 6px;
  font-size: 0.875rem;
  resize: vertical;
  box-sizing: border-box;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.dialog-actions button:first-child {
  background: transparent;
  color: #888;
  border: 1px solid #444;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.login-prompt {
  text-align: center;
  padding: 3rem;
  color: #888;
}

.login-prompt p {
  margin-bottom: 1rem;
}

.stats {
  color: #888;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
</style>
