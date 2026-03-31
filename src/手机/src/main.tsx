import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TAVERN_PHONE_MSG } from './tavernPhoneBridge';
import { exportWeChatThreadsForScope } from './weChatWorldbookExport';
import { getCharacterAnalyzer } from './characterArchive/characterAnalyzer';
import { getAnalysisScheduler } from './characterArchive/analysisScheduler';
import { getTavernPhoneApiConfig, applyOpenAiDefaultsFromParent } from './tavernPhoneApiConfig';
import { normalizeApiBaseUrl } from './apiUrl';

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
  if (event.data?.type !== TAVERN_PHONE_MSG.REQUEST_EXPORT_THREADS_FOR_WB) {
    return;
  }
  const requestId = event.data?.requestId;
  const chatScopeId = event.data?.chatScopeId;
  if (typeof requestId !== 'string' || typeof chatScopeId !== 'string') {
    return;
  }
  void (async () => {
    try {
      const threads = await exportWeChatThreadsForScope(chatScopeId);
      window.parent.postMessage(
        { type: TAVERN_PHONE_MSG.EXPORT_THREADS_FOR_WB_RESULT, requestId, threads },
        '*',
      );
    } catch (e) {
      window.parent.postMessage(
        {
          type: TAVERN_PHONE_MSG.EXPORT_THREADS_FOR_WB_RESULT,
          requestId,
          error: e instanceof Error ? e.message : String(e),
        },
        '*',
      );
    }
  })();
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
      max_tokens: 2048,
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

// 监听父窗口下发的 API 默认值
window.addEventListener('message', (e: MessageEvent) => {
  if (e.source !== window.parent) {
    return;
  }
  const data = e.data as { type?: string; payload?: { openAiDefaults?: { apiBaseUrl?: string | null; model?: string | null } } };
  if (data?.type === TAVERN_PHONE_MSG.CONTEXT && data?.payload?.openAiDefaults) {
    applyOpenAiDefaultsFromParent(data.payload.openAiDefaults);
    initPhoneApiConfig();
  }
});

// 初始化
initPhoneApiConfig();
void initCharacterAnalyzer();
initAutoSchedule();
