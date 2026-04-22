import React, { useCallback, useEffect, useState } from 'react';
import { PHONE_AI_DEBUG_TRAFFIC_EVENT, type PhoneAiDebugTrafficDetail } from '../phoneAiDebugTraffic';

function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * 监听 AI 调试事件并排队弹窗；挂载在 App 内、盖在小手机内容之上。
 */
export default function PhoneAiDebugOverlay() {
  const [queue, setQueue] = useState<PhoneAiDebugTrafficDetail[]>([]);

  useEffect(() => {
    const onTraffic = (e: Event) => {
      const ce = e as CustomEvent<PhoneAiDebugTrafficDetail>;
      if (ce.detail && typeof ce.detail.at === 'number') {
        setQueue(q => [...q, ce.detail]);
      }
    };
    window.addEventListener(PHONE_AI_DEBUG_TRAFFIC_EVENT, onTraffic);
    return () => window.removeEventListener(PHONE_AI_DEBUG_TRAFFIC_EVENT, onTraffic);
  }, []);

  const dismiss = useCallback(() => {
    setQueue(q => q.slice(1));
  }, []);

  const current = queue[0];
  if (!current) {
    return null;
  }

  const pending = queue.length - 1;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-500 flex items-center justify-center bg-black/55 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="AI 调试"
    >
      <div
        className="flex max-h-[88%] w-full max-w-[min(100%,360px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--card-bg, #fff)' }}
      >
        <div className="shrink-0 border-b px-3 py-2.5" style={{ borderColor: 'var(--card-border, #e5e5e5)' }}>
          <h2 className="text-[16px] font-bold" style={{ color: 'var(--settings-title, #111)' }}>
            AI 请求调试
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--settings-desc, #666)' }}>
            {new Date(current.at).toLocaleString('zh-CN')} · HTTP {current.httpStatus}
            {current.httpOk ? ' · 成功' : ' · 失败'}
            {pending > 0 ? ` · 队列中还有 ${pending} 条` : ''}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {current.errorMessage ? (
            <div className="rounded-lg bg-red-50 px-2 py-1.5 text-[12px] text-red-800">{current.errorMessage}</div>
          ) : null}

          <section>
            <p className="mb-0.5 text-[12px] font-semibold" style={{ color: 'var(--settings-title, #111)' }}>
              请求 URL
            </p>
            <pre
              className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg p-2 text-[10px] leading-snug"
              style={{ backgroundColor: 'var(--app-content-bg, #f5f5f5)', color: 'var(--settings-title, #111)' }}
            >
              {current.requestUrl}
            </pre>
          </section>

          <section>
            <p className="mb-0.5 text-[12px] font-semibold" style={{ color: 'var(--settings-title, #111)' }}>
              发送给接口的 body（JSON）
            </p>
            <pre
              className="max-h-[28vh] overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg p-2 text-[10px] leading-snug"
              style={{ backgroundColor: 'var(--app-content-bg, #f5f5f5)', color: 'var(--settings-title, #111)' }}
            >
              {formatJson(current.requestPayload)}
            </pre>
          </section>

          <section>
            <p className="mb-0.5 text-[12px] font-semibold" style={{ color: 'var(--settings-title, #111)' }}>
              接口原始响应
            </p>
            <pre
              className="max-h-[22vh] overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg p-2 text-[10px] leading-snug"
              style={{ backgroundColor: 'var(--app-content-bg, #f5f5f5)', color: 'var(--settings-title, #111)' }}
            >
              {current.rawResponseText || '（空）'}
            </pre>
          </section>

          <section>
            <p className="mb-0.5 text-[12px] font-semibold" style={{ color: 'var(--settings-title, #111)' }}>
              解析后的 assistant 正文
            </p>
            <pre
              className="max-h-[22vh] overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg p-2 text-[10px] leading-snug"
              style={{ backgroundColor: 'var(--app-content-bg, #f5f5f5)', color: 'var(--settings-title, #111)' }}
            >
              {current.assistantContent || '（无）'}
            </pre>
          </section>
        </div>

        <div className="shrink-0 flex gap-2 border-t p-3" style={{ borderColor: 'var(--card-border, #e5e5e5)' }}>
          <button
            type="button"
            className="flex-1 rounded-xl py-2.5 text-[14px] font-semibold text-white"
            style={{ backgroundColor: 'var(--accent, #6c5ce7)' }}
            onClick={dismiss}
          >
            {pending > 0 ? '关闭本条' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  );
}
