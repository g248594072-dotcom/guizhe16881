/**
 * 分析队列悬浮小组件
 * 固定在 App 桌面右下角（ Dock 上方），显示当前分析任务状态
 */

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getAnalysisScheduler, type AnalysisTask } from '../characterArchive/analysisScheduler';

export default function AnalysisQueueWidget() {
  const [queue, setQueue] = useState<AnalysisTask[]>([]);
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const scheduler = getAnalysisScheduler();
    const update = (newQueue: AnalysisTask[]) => {
      setQueue(newQueue);
      const hasActive = newQueue.some(t => t.status === 'pending' || t.status === 'running');
      setVisible(hasActive);
    };
    update(scheduler.getQueueStatus());
    const unsub = scheduler.on(update);
    return unsub;
  }, []);

  if (!visible) return null;

  const running = queue.find(t => t.status === 'running');
  const pending = queue.filter(t => t.status === 'pending').length;
  const label = running
    ? `分析中: ${running.characterName}`
    : pending > 0
    ? `队列: ${pending} 项`
    : null;

  if (minimized) {
    return (
      <button
        type="button"
        className="fixed bottom-[100px] right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg"
        style={{
          background: 'linear-gradient(135deg, var(--accent, #6c5ce7), var(--accent-light, #a29bfe))',
          boxShadow: '0 4px 15px rgba(108,92,231,0.4)',
        }}
        onClick={() => setMinimized(false)}
        title="分析队列"
      >
        {running ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-[100px] right-4 z-50 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md min-w-[200px] max-w-[260px]"
      style={{
        backgroundColor: 'rgba(45,27,105,0.85)',
        border: '1px solid rgba(162,155,254,0.3)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(108,92,231,0.3)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RefreshCw
            size={16}
            className={running ? 'animate-spin' : ''}
            style={{ color: '#a29bfe' }}
          />
          <span className="text-[13px] text-white font-medium truncate">{label || '队列空闲'}</span>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="text-white/60 hover:text-white text-xs transition-colors shrink-0"
        >
          −
        </button>
      </div>
      {pending > 1 && (
        <p className="text-[11px] text-white/50 mt-1 ml-6">
          还有 {pending} 个任务等待中
        </p>
      )}
    </div>
  );
}
