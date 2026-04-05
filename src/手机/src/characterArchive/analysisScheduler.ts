/**
 * 角色分析调度器（AnalysisScheduler）
 * 管理分析任务队列，支持 HIGH（手动）/ NORMAL（自动）优先级
 */

import { getTaskManager } from '../components/BackgroundTaskManager';

export type TaskPriority = 'HIGH' | 'NORMAL';
export type TaskType = 'ANALYZE_CHARACTER' | 'ANALYZE_DYNAMICS';

export interface AnalysisTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  characterId: string;
  characterName: string;
  addedAt: number;
  status: 'pending' | 'running' | 'done' | 'error';
  errorMessage?: string;
}

type QueueListener = (queue: AnalysisTask[]) => void;

class AnalysisScheduler {
  private queue: AnalysisTask[] = [];
  private running = false;
  private listeners: QueueListener[] = [];
  private processFn: ((task: AnalysisTask) => Promise<void>) | null = null;
  private autoTimerId: ReturnType<typeof setInterval> | null = null;
  private autoIntervalMinutes = 20;

  /** 设置任务处理器（由 characterAnalyzer 调用） */
  setProcessor(fn: (task: AnalysisTask) => Promise<void>): void {
    this.processFn = fn;
  }

  /** 添加分析任务 */
  addTask(input: Omit<AnalysisTask, 'id' | 'addedAt' | 'status'>): string {
    const task: AnalysisTask = {
      ...input,
      id: crypto.randomUUID(),
      addedAt: Date.now(),
      status: 'pending',
    };
    if (input.priority === 'HIGH') {
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }
    this.notifyListeners();
    void this.process();
    return task.id;
  }

  /** 启动定时自动分析（每 N 分钟检查并添加 NORMAL 任务） */
  startAutoSchedule(minutes = 20): void {
    this.stopAutoSchedule();
    this.autoIntervalMinutes = minutes;
    this.autoTimerId = setInterval(() => {
      void this.triggerAutoAnalyze();
    }, minutes * 60 * 1000);
  }

  /** 停止定时分析 */
  stopAutoSchedule(): void {
    if (this.autoTimerId !== null) {
      clearInterval(this.autoTimerId);
      this.autoTimerId = null;
    }
  }

  /** 子类实现：触发自动分析任务（由 characterAnalyzer 提供） */
  protected async triggerAutoAnalyze(): Promise<void> {
    // 由外部注入
  }

  /** 设置自动分析触发器 */
  setAutoAnalyzer(fn: () => Promise<void>): void {
    this.triggerAutoAnalyze = fn;
  }

  /** 内部处理循环 */
  private async process(): Promise<void> {
    if (this.running || this.queue.length === 0 || !this.processFn) return;
    this.running = true;

    // 持续处理直到没有 pending 任务
    while (true) {
      const nextTask = this.queue.find(t => t.status === 'pending');
      if (!nextTask) break;

      const pending = this.queue.filter(t => t.status === 'pending');
      console.log(`[scheduler] 处理任务: ${nextTask.characterName} (${nextTask.type})，队列中还有 ${pending.length} 个待处理`);

      nextTask.status = 'running';
      this.notifyListeners();

      // 同步到全局任务管理器
      const taskManager = getTaskManager();
      let bgTaskId: string | undefined;

      try {
        // 创建全局后台任务
        bgTaskId = taskManager.addTask({
          type: 'character_analysis',
          name: `分析角色: ${nextTask.characterName}`,
          progress: 0,
          current: 0,
          total: 1,
          status: 'running',
        });

        await this.processFn(nextTask);
        nextTask.status = 'done';
        console.log(`[scheduler] 任务完成: ${nextTask.characterName}`);

        // 更新全局任务状态
        if (bgTaskId) {
          taskManager.completeTask(bgTaskId);
        }
      } catch (e) {
        nextTask.status = 'error';
        nextTask.errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`[scheduler] 任务失败: ${nextTask.characterName}, 错误:`, nextTask.errorMessage);

        // 更新全局任务状态
        if (bgTaskId) {
          taskManager.errorTask(bgTaskId, nextTask.errorMessage);
        }
      }

      this.notifyListeners();

      // 检查是否还有待处理任务，有则休息 1 秒后继续
      if (this.queue.some(t => t.status === 'pending')) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log('[scheduler] 所有任务处理完成');
    // 清理已完成的任务
    this.queue = [];
    this.running = false;
    this.notifyListeners();
  }

  /** 获取当前队列快照 */
  getQueueStatus(): AnalysisTask[] {
    return [...this.queue];
  }

  /** 获取运行中的任务 */
  getRunningTask(): AnalysisTask | null {
    return this.queue.find(t => t.status === 'running') ?? null;
  }

  /** 监听队列变化 */
  on(callback: QueueListener): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getQueueStatus();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (e) {
        console.warn('[scheduler] 队列监听器异常:', e);
      }
    }
  }
}

/** 全局单例 */
const analysisScheduler = new AnalysisScheduler();
export function getAnalysisScheduler(): AnalysisScheduler {
  return analysisScheduler;
}
