import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TAVERN_PHONE_MSG } from './tavernPhoneBridge';
import { exportWeChatThreadsForScope } from './weChatWorldbookExport';

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
