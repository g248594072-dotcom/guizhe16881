/**
 * 角色分析调度器（AnalysisScheduler）
 * 管理分析任务队列，支持 HIGH（手动）/ NORMAL（自动）优先级
 */

export type TaskPriority = 'HIGH' | 'NORMAL';
export type TaskType = 'ANALYZE_CHARACTER';

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
    while (this.queue.length > 0) {
      const task = this.queue[0];
      task.status = 'running';
      this.notifyListeners();
      try {
        await this.processFn(task);
        task.status = 'done';
      } catch (e) {
        task.status = 'error';
        task.errorMessage = e instanceof Error ? e.message : String(e);
        console.warn('[scheduler] 分析任务失败:', task.errorMessage);
      }
      this.queue.shift();
      this.notifyListeners();
      // 每个任务之间休息 1 秒
      await new Promise(r => setTimeout(r, 1000));
    }
    this.running = false;
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
