/**
 * 后台任务管理器
 * 管理所有需要调用API的长时间运行任务（角色分析、日记生成、论坛生成等）
 * 支持最小化到左下角，不影响其他操作
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Minimize2, Maximize2, ChevronDown, ChevronUp, X, Loader2, CheckCircle2, AlertCircle, FileText, MessageSquare, Users, BookOpen, Newspaper } from 'lucide-react';

/** 任务类型 */
export type TaskType = 'character_analysis' | 'diary_generation' | 'forum_generation' | 'chat_generation' | 'moment_generation' | 'news_generation';

/** 任务状态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'error';

/** 后台任务 */
export interface BackgroundTask {
  id: string;
  type: TaskType;
  name: string;
  status: TaskStatus;
  progress?: number;
  total?: number;
  current?: number;
  errorMessage?: string;
  addedAt: number;
  completedAt?: number;
}

/** 任务类型配置 */
const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: React.ReactNode; color: string }> = {
  character_analysis: {
    label: '角色分析',
    icon: <Users size={14} />,
    color: 'text-purple-500',
  },
  diary_generation: {
    label: '日记生成',
    icon: <BookOpen size={14} />,
    color: 'text-green-500',
  },
  forum_generation: {
    label: '论坛生成',
    icon: <MessageSquare size={14} />,
    color: 'text-blue-500',
  },
  chat_generation: {
    label: '群聊生成',
    icon: <FileText size={14} />,
    color: 'text-orange-500',
  },
  moment_generation: {
    label: '朋友圈生成',
    icon: <MessageSquare size={14} />,
    color: 'text-pink-500',
  },
  news_generation: {
    label: '新闻生成',
    icon: <Newspaper size={14} />,
    color: 'text-red-500',
  },
};

/** 任务管理器单例 */
class TaskManager {
  private tasks: BackgroundTask[] = [];
  private listeners: ((tasks: BackgroundTask[]) => void)[] = [];
  private taskIdCounter = 0;

  /** 生成唯一任务ID */
  private generateId(): string {
    return `task_${Date.now()}_${++this.taskIdCounter}`;
  }

  /** 添加任务 */
  addTask(task: Omit<BackgroundTask, 'id' | 'addedAt' | 'status'>): string {
    const id = this.generateId();
    const newTask: BackgroundTask = {
      ...task,
      id,
      status: 'pending',
      addedAt: Date.now(),
    };
    this.tasks.push(newTask);
    this.notifyListeners();
    console.log(`[TaskManager] 添加任务: ${task.name} (${task.type})`);
    return id;
  }

  /** 更新任务状态 */
  updateTask(taskId: string, updates: Partial<BackgroundTask>) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    Object.assign(task, updates);
    if (updates.status === 'completed' || updates.status === 'error') {
      task.completedAt = Date.now();
    }
    this.notifyListeners();
  }

  /** 设置任务进度 */
  setTaskProgress(taskId: string, current: number, total: number) {
    this.updateTask(taskId, {
      current,
      total,
      progress: Math.round((current / total) * 100),
    });
  }

  /** 完成任务 */
  completeTask(taskId: string) {
    this.updateTask(taskId, { status: 'completed' });
    console.log(`[TaskManager] 任务完成: ${taskId}`);
  }

  /** 标记任务错误 */
  errorTask(taskId: string, errorMessage: string) {
    this.updateTask(taskId, { status: 'error', errorMessage });
    console.log(`[TaskManager] 任务错误: ${taskId} - ${errorMessage}`);
  }

  /** 移除任务 */
  removeTask(taskId: string) {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.notifyListeners();
  }

  /** 清空已完成任务 */
  clearCompleted() {
    this.tasks = this.tasks.filter(t => t.status !== 'completed' && t.status !== 'error');
    this.notifyListeners();
  }

  /** 获取所有任务 */
  getTasks(): BackgroundTask[] {
    return [...this.tasks];
  }

  /** 获取进行中的任务数 */
  getRunningCount(): number {
    return this.tasks.filter(t => t.status === 'running' || t.status === 'pending').length;
  }

  /** 订阅任务变化 */
  onTasksChange(listener: (tasks: BackgroundTask[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.getTasks()); // 立即通知当前状态
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** 通知所有监听器 */
  private notifyListeners() {
    const tasks = this.getTasks();
    this.listeners.forEach(l => l(tasks));
  }
}

// 全局单例
const taskManager = new TaskManager();

/** 获取任务管理器实例 */
export function getTaskManager(): TaskManager {
  return taskManager;
}

/** 后台任务管理器组件 */
export default function BackgroundTaskManager() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);
  const [showPanel, setShowPanel] = useState(true);

  // 订阅任务变化
  useEffect(() => {
    const unsubscribe = taskManager.onTasksChange(setTasks);
    return unsubscribe;
  }, []);

  // 当有新的进行中的任务时，短暂展开提示
  useEffect(() => {
    const runningCount = tasks.filter(t => t.status === 'running' || t.status === 'pending').length;
    if (runningCount > 0 && isMinimized) {
      // 可以在这里添加闪烁提示效果
    }
  }, [tasks, isMinimized]);

  const handleClearCompleted = useCallback(() => {
    taskManager.clearCompleted();
  }, []);

  const handleRemoveTask = useCallback((taskId: string) => {
    taskManager.removeTask(taskId);
  }, []);

  // 统计
  const runningCount = tasks.filter(t => t.status === 'running' || t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const errorCount = tasks.filter(t => t.status === 'error').length;

  // 如果没有任务，不显示
  if (tasks.length === 0) return null;

  return (
    <>
      {/* 最小化状态 - 左下角浮动按钮 */}
      {isMinimized && (
        <div className="fixed bottom-4 left-4 z-50 max-w-[calc(100%-2rem)]">
          <button
            onClick={() => setIsMinimized(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all hover:scale-105 min-w-0 ${
              runningCount > 0
                ? 'bg-[#007AFF] text-white animate-pulse'
                : 'bg-white text-gray-700'
            }`}
            title={`${runningCount}个进行中, ${completedCount}个已完成, ${errorCount}个错误`}
          >
            {runningCount > 0 ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} className="text-green-500" />
            )}
            <span className="text-sm font-medium truncate max-w-[11rem]">
              {runningCount > 0 ? `${runningCount}进行中` : `${tasks.length}个任务`}
            </span>
            {completedCount > 0 && !runningCount && (
              <span className="shrink-0 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                完成
              </span>
            )}
            {errorCount > 0 && (
              <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                {errorCount}错误
              </span>
            )}
          </button>
        </div>
      )}

      {/* 展开状态 - 任务列表面板 */}
      {!isMinimized && (
        <div className="fixed bottom-4 left-4 z-50 w-80 max-w-[calc(100%-2rem)] max-h-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">后台任务</span>
              {runningCount > 0 && (
                <span className="text-xs bg-[#007AFF] text-white px-2 py-0.5 rounded-full">
                  {runningCount}进行中
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                title="最小化"
              >
                <Minimize2 size={16} />
              </button>
              <button
                onClick={() => setShowPanel(!showPanel)}
                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                type="button"
                title={showPanel ? '收起任务列表' : '展开任务列表'}
              >
                {showPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {/* 任务列表 */}
          {showPanel && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-64">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">暂无任务</div>
            ) : (
              tasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 p-2.5 rounded-xl transition-colors ${
                    task.status === 'running'
                      ? 'bg-blue-50 border border-blue-100'
                      : task.status === 'completed'
                      ? 'bg-green-50'
                      : task.status === 'error'
                      ? 'bg-red-50'
                      : 'bg-gray-50'
                  }`}
                >
                  {/* 图标 */}
                  <div className={`shrink-0 ${TASK_TYPE_CONFIG[task.type].color}`}>
                    {task.status === 'running' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : task.status === 'completed' ? (
                      <CheckCircle2 size={16} className="text-green-500" />
                    ) : task.status === 'error' ? (
                      <AlertCircle size={16} className="text-red-500" />
                    ) : (
                      TASK_TYPE_CONFIG[task.type].icon
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-gray-500">
                        {TASK_TYPE_CONFIG[task.type].label}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-600 truncate">{task.name}</span>
                    </div>

                    {/* 进度条 */}
                    {task.status === 'running' && task.total && task.total > 1 && (
                      <div className="mt-1">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#007AFF] rounded-full transition-all duration-300"
                            style={{ width: `${task.progress || 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            {task.current}/{task.total}
                          </span>
                          <span className="text-[10px] text-gray-400">{task.progress || 0}%</span>
                        </div>
                      </div>
                    )}

                    {task.status === 'running' && (!task.total || task.total <= 1) && (
                      <div className="mt-1 text-xs text-[#007AFF]">进行中...</div>
                    )}

                    {task.status === 'error' && task.errorMessage && (
                      <div className="mt-0.5 text-[10px] text-red-500 truncate" title={task.errorMessage}>
                        {task.errorMessage}
                      </div>
                    )}

                    {task.status === 'completed' && (
                      <div className="mt-0.5 text-[10px] text-green-600">已完成</div>
                    )}
                  </div>

                  {/* 删除按钮 */}
                  {(task.status === 'completed' || task.status === 'error') && (
                    <button
                      onClick={() => handleRemoveTask(task.id)}
                      className="shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="移除"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          )}

          {/* 底部操作 */}
          {showPanel && tasks.some(t => t.status === 'completed' || t.status === 'error') && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <button
                onClick={handleClearCompleted}
                className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                清空已完成任务
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
