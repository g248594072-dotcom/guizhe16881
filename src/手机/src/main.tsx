import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TAVERN_PHONE_MSG, initExportThreadsListener } from './tavernPhoneBridge';
import { exportWeChatThreadsForScope } from './weChatWorldbookExport';
import { getCharacterAnalyzer } from './characterArchive/characterAnalyzer';
import { getAnalysisScheduler } from './characterArchive/analysisScheduler';
import { getTavernPhoneApiConfig } from './tavernPhoneApiConfig';
import { normalizeApiBaseUrl } from './apiUrl';
import { migrateLegacyPhoneCharacterAvatars } from './phoneCharacterAvatars';
import {
  PHONE_CHARACTER_AVATAR_MIRROR_REQUEST,
  PHONE_CHARACTER_AVATAR_SYNC_TYPE,
  applyCharacterAvatarOverrideLocal,
} from '../../shared/phoneCharacterAvatarStorage';
import { initDiaryScheduler } from './diaryScheduler';
import { initForumScheduler } from './forumScheduler';

migrateLegacyPhoneCharacterAvatars();

if (typeof window !== 'undefined' && window.parent !== window) {
  try {
    window.parent.postMessage({ type: PHONE_CHARACTER_AVATAR_MIRROR_REQUEST }, '*');
  } catch {
    /* */
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

window.parent.postMessage({ type: TAVERN_PHONE_MSG.READY }, '*');

window.addEventListener('message', event => {
  if (event.source !== window.parent) {
    return;
  }
  if (event.data?.type === PHONE_CHARACTER_AVATAR_SYNC_TYPE) {
    const roleId = typeof event.data?.roleId === 'string' ? event.data.roleId.trim() : '';
    if (roleId) {
      applyCharacterAvatarOverrideLocal(
        roleId,
        typeof event.data?.avatarUrl === 'string' ? event.data.avatarUrl : '',
      );
    }
    return;
  }
  // 注：微信线程导出监听已移至 tavernPhoneBridge.ts 的 initExportThreadsListener()
  // 由 WeChatApp.tsx 在组件挂载时统一初始化，避免重复监听
});

// ==================== 初始化 ====================

function initPhoneApiConfig(): void {
  const cfg = getTavernPhoneApiConfig();
  const w = window as unknown as Record<string, string>;
  w.__PHONE_API_BASE__ = cfg.apiBaseUrl;
  w.__PHONE_API_KEY__ = cfg.apiKey;
  w.__PHONE_API_MODEL__ = cfg.model;
}

async function initCharacterAnalyzer(): Promise<void> {
  const analyzer = getCharacterAnalyzer();

  analyzer.setApiCaller(async (prompt, opts) => {
    const url = `${normalizeApiBaseUrl(opts.apiBaseUrl)}/chat/completions`;
    const body = {
      model: opts.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text ? `${res.status}: ${text.slice(0, 400)}` : `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('响应中无 assistant 正文');
    }
    return content.trim();
  });
}

function initAutoSchedule(): void {
  const scheduler = getAnalysisScheduler();
  scheduler.startAutoSchedule(20);
}

// 初始化
initPhoneApiConfig();
void initCharacterAnalyzer();
initAutoSchedule();
// 全局初始化微信线程导出监听，确保壳脚本发起世界书同步时无论当前在哪个 App 都能响应
initExportThreadsListener();
// 初始化日记自动生成调度器
const cleanupDiaryScheduler = initDiaryScheduler();
// 初始化论坛自动生成调度器
const cleanupForumScheduler = initForumScheduler();
// 卸载时清理
window.addEventListener('beforeunload', () => {
  cleanupDiaryScheduler();
  cleanupForumScheduler();
});
