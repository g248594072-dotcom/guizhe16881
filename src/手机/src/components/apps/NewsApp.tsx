import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  Search,
  RefreshCw,
  Clock,
  Eye,
  Newspaper,
  Building,
  Star,
  TrendingUp,
  FlaskConical,
  PenTool,
  AlertCircle,
  X,
  Zap,
  Settings,
} from 'lucide-react';
import type {
  NewsArticle,
  NewsCategory,
  NewsStyle,
  NewsTone,
  NewsGlobalSettings,
} from '../../types/news';
import {
  NEWS_CATEGORY_CONFIG,
  NEWS_TONE_CONFIG,
  NEWS_STYLE_CONFIG,
} from '../../types/news';
import {
  getAllNewsArticles,
  getLatestHeadline,
  markNewsAsRead,
  deleteNewsArticle,
  clearAllNews,
  getNewsGlobalSettings,
  saveNewsGlobalSettings,
  getNewsMeta,
  getUnreadNewsCount,
} from '../../newsIndexedDb';
import {
  manualGenerateNews,
  manualBatchGenerateNews,
  backgroundBatchGenerateNews,
  onNewsGenerated,
  getCurrentGameDate,
} from '../../newsScheduler';
import { getTaskManager } from '../BackgroundTaskManager';

interface NewsAppProps {
  onClose: () => void;
}

export default function NewsApp({ onClose }: NewsAppProps) {
  // 状态管理
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [activeCategory, setActiveCategory] = useState<NewsCategory | 'all'>('all');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<NewsGlobalSettings | null>(null);
  const [meta, setMeta] = useState<{ totalArticles: number; unreadCount: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGenerateOptions, setShowGenerateOptions] = useState(false);
  const [generationMode, setGenerationMode] = useState<'single' | 'batch'>('batch');
  const [generationCount, setGenerationCount] = useState(3);

  // 初始化
  useEffect(() => {
    void loadData();
    void loadSettings();

    // 订阅新闻生成事件
    const unsubscribe = onNewsGenerated((newArticles) => {
      setArticles(prev => [...newArticles, ...prev]);
      void updateMeta();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 加载数据
  const loadData = async () => {
    try {
      setRefreshing(true);
      const data = await getAllNewsArticles();
      setArticles(data);
      await updateMeta();
    } catch (e) {
      console.error('[NewsApp] 加载新闻失败:', e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // 加载设置
  const loadSettings = async () => {
    try {
      const s = await getNewsGlobalSettings();
      setSettings(s);
    } catch (e) {
      console.error('[NewsApp] 加载设置失败:', e);
    }
  };

  // 更新元数据
  const updateMeta = async () => {
    try {
      const m = await getNewsMeta();
      const unread = await getUnreadNewsCount();
      setMeta({
        totalArticles: m.totalArticles,
        unreadCount: unread,
      });
    } catch (e) {
      console.error('[NewsApp] 更新元数据失败:', e);
    }
  };

  // 获取头条新闻
  const getHeadline = (): NewsArticle | null => {
    if (activeCategory !== 'all') return null;
    return articles.find(a => a.category === 'headline') || articles[0] || null;
  };

  // 获取分类新闻
  const getFilteredArticles = (): NewsArticle[] => {
    if (activeCategory === 'all') {
      // 排除头条（已单独显示）
      return articles.filter((_, i) => i !== 0);
    }
    return articles.filter(a => a.category === activeCategory);
  };

  // 阅读新闻
  const handleRead = async (article: NewsArticle) => {
    if (!article.isRead) {
      await markNewsAsRead(article.id);
      setArticles(prev =>
        prev.map(a => (a.id === article.id ? { ...a, isRead: true, views: a.views + 1 } : a))
      );
      await updateMeta();
    }
    setSelectedArticle(article);
  };

  // 删除新闻
  const handleDelete = async (id: string) => {
    await deleteNewsArticle(id);
    setArticles(prev => prev.filter(a => a.id !== id));
    await updateMeta();
  };

  // 清空所有新闻
  const handleClearAll = async () => {
    if (confirm('确定要清空所有新闻吗？')) {
      await clearAllNews();
      setArticles([]);
      await updateMeta();
    }
  };

  // 生成单条新闻
  const handleSingleGenerate = async (category: NewsCategory) => {
    setShowGenerateOptions(false);

    const taskManager = getTaskManager();
    const taskId = taskManager.addTask({
      type: 'news_generation',
      name: `生成${NEWS_CATEGORY_CONFIG[category].label}新闻`,
      progress: 0,
      current: 0,
      total: 1,
    });

    try {
      taskManager.updateTask(taskId, { status: 'running' });

      const article = await manualGenerateNews(category);

      if (article) {
        setArticles(prev => [article, ...prev]);
        await updateMeta();
        taskManager.updateTask(taskId, { status: 'completed', progress: 100 });
      } else {
        taskManager.updateTask(taskId, { status: 'error', error: '生成失败' });
      }
    } catch (e) {
      console.error('[NewsApp] 生成新闻失败:', e);
      taskManager.updateTask(taskId, { status: 'error', error: String(e) });
    }
  };

  // 批量生成
  const handleBatchGenerate = () => {
    setShowGenerateOptions(false);

    const categories: NewsCategory[] = ['headline', 'society', 'entertainment', 'column'];

    void backgroundBatchGenerateNews(
      {
        count: generationCount,
        categories,
      },
      (newArticles) => {
        if (newArticles.length > 0) {
          void loadData();
        }
      }
    );
  };

  // 切换自动更新设置
  const toggleAutoGenerate = async () => {
    if (!settings) return;
    const newSettings = {
      ...settings,
      autoGenerateEnabled: !settings.autoGenerateEnabled,
    };
    await saveNewsGlobalSettings(newSettings);
    setSettings(newSettings);
  };

  // 切换事件触发设置
  const toggleEventTrigger = async () => {
    if (!settings) return;
    const newSettings = {
      ...settings,
      eventTriggerEnabled: !settings.eventTriggerEnabled,
    };
    await saveNewsGlobalSettings(newSettings);
    setSettings(newSettings);
  };

  // 渲染分类图标
  const renderCategoryIcon = (category: NewsCategory, size = 16) => {
    switch (category) {
      case 'headline':
        return <Newspaper size={size} />;
      case 'society':
        return <Building size={size} />;
      case 'entertainment':
        return <Star size={size} />;
      case 'finance':
        return <TrendingUp size={size} />;
      case 'science':
        return <FlaskConical size={size} />;
      case 'column':
        return <PenTool size={size} />;
      default:
        return <Newspaper size={size} />;
    }
  };

  // 渲染基调标签
  const renderToneBadge = (tone: NewsTone) => {
    const config = NEWS_TONE_CONFIG[tone];
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={{ backgroundColor: `${config.color}20`, color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  // 分类Tab配置
  const categoryTabs: { id: NewsCategory | 'all'; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: '全部', icon: <Newspaper size={14} /> },
    { id: 'headline', label: '头条', icon: <Zap size={14} /> },
    { id: 'society', label: '社会', icon: <Building size={14} /> },
    { id: 'entertainment', label: '娱乐', icon: <Star size={14} /> },
    { id: 'finance', label: '财经', icon: <TrendingUp size={14} /> },
    { id: 'science', label: '科学', icon: <FlaskConical size={14} /> },
    { id: 'column', label: '专栏', icon: <PenTool size={14} /> },
  ];

  const headline = getHeadline();
  const filteredArticles = getFilteredArticles();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="pt-12 pb-2 px-4 flex items-center justify-between sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 -ml-1 text-[#FF2D55]">
            <ChevronLeft size={28} />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-[32px] font-bold text-black tracking-tight">新闻</h1>
            {meta && meta.unreadCount > 0 && (
              <span className="bg-[#FF2D55] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {meta.unreadCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void loadData()}
            className={`p-2 text-gray-600 ${refreshing ? 'animate-spin' : ''}`}
            disabled={refreshing}
          >
            <RefreshCw size={20} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-gray-600">
            <Settings size={20} />
          </button>
          <button
            onClick={() => setShowGenerateOptions(true)}
            className="ml-2 px-3 py-1.5 bg-[#FF2D55] text-white text-sm font-medium rounded-lg"
          >
            生成
          </button>
        </div>
      </div>

      {/* 分类Tab */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {categoryTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === tab.id
                  ? 'bg-[#FF2D55] text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF2D55]"></div>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Newspaper size={48} className="mb-4 text-gray-300" />
            <p className="text-base">暂无新闻报道</p>
            <button
              onClick={() => setShowGenerateOptions(true)}
              className="mt-4 px-4 py-2 bg-[#FF2D55] text-white text-sm font-medium rounded-lg"
            >
              生成新闻
            </button>
          </div>
        ) : (
          <>
            {/* 头条区域 */}
            {headline && activeCategory === 'all' && (
              <div className="px-4 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-[#FF2D55]" />
                  <span className="text-[12px] font-bold text-[#FF2D55] uppercase tracking-wider">
                    头条新闻
                  </span>
                  {!headline.isRead && (
                    <span className="bg-[#FF2D55] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      NEW
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRead(headline)}
                  className="w-full text-left"
                >
                  <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-4 flex items-center justify-center">
                    <Newspaper size={48} className="text-gray-400" />
                  </div>
                  <h2 className="text-[20px] font-bold leading-tight mb-2 text-black">
                    {headline.title}
                  </h2>
                  {headline.subtitle && (
                    <p className="text-[15px] text-gray-500 mb-2">{headline.subtitle}</p>
                  )}
                  <p className="text-[14px] text-gray-600 mb-3 line-clamp-2">{headline.summary}</p>
                  <div className="flex items-center justify-between text-[12px] text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-black">{headline.source}</span>
                      <span>•</span>
                      <span>{headline.reporter}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {renderToneBadge(headline.tone)}
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {headline.views}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* 新闻列表 */}
            <div className="px-4">
              {filteredArticles.map((article, index) => (
                <button
                  key={article.id}
                  onClick={() => handleRead(article)}
                  className="w-full text-left py-4 border-b border-gray-100 last:border-0"
                >
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: NEWS_CATEGORY_CONFIG[article.category].color }}
                          >
                            {renderCategoryIcon(article.category, 12)}
                            {NEWS_CATEGORY_CONFIG[article.category].label}
                          </span>
                          {!article.isRead && (
                            <span className="bg-[#FF2D55] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              NEW
                            </span>
                          )}
                          {article.hasNSFWContent && (
                            <span className="bg-red-100 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              NSFW
                            </span>
                          )}
                        </div>
                        <h3 className="text-[15px] font-semibold leading-snug mb-2 line-clamp-2 text-black">
                          {article.title}
                        </h3>
                        <p className="text-[13px] text-gray-500 line-clamp-2 mb-2">
                          {article.summary}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <span className="font-medium">{article.source}</span>
                          <span>•</span>
                          <span>{article.reporter}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatTime(article.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderToneBadge(article.tone)}
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Eye size={10} />
                            {article.views}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedArticle && (
        <div className="absolute inset-0 bg-black/50 z-30 flex items-end">
          <div className="w-full h-[85%] bg-white rounded-t-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* 弹窗Header */}
            <div className="pt-4 pb-2 px-4 flex items-center justify-between border-b border-gray-100">
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-2 -ml-2 text-gray-600"
              >
                <ChevronLeft size={24} />
              </button>
              <span className="text-[15px] font-semibold">新闻详情</span>
              <button
                onClick={() => void handleDelete(selectedArticle.id)}
                className="p-2 -mr-2 text-red-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold"
                  style={{
                    backgroundColor: `${NEWS_CATEGORY_CONFIG[selectedArticle.category].color}15`,
                    color: NEWS_CATEGORY_CONFIG[selectedArticle.category].color,
                  }}
                >
                  {renderCategoryIcon(selectedArticle.category, 14)}
                  {NEWS_CATEGORY_CONFIG[selectedArticle.category].label}
                </span>
                {renderToneBadge(selectedArticle.tone)}
                {selectedArticle.hasNSFWContent && (
                  <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full">
                    NSFW
                  </span>
                )}
              </div>

              <h1 className="text-[22px] font-bold text-black mb-2 leading-tight">
                {selectedArticle.title}
              </h1>

              {selectedArticle.subtitle && (
                <p className="text-[16px] text-gray-500 mb-4">{selectedArticle.subtitle}</p>
              )}

              <div className="flex items-center gap-2 text-[12px] text-gray-500 mb-4 pb-4 border-b border-gray-100">
                <span className="font-medium text-black">{selectedArticle.source}</span>
                <span>•</span>
                <span>{selectedArticle.reporter}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {selectedArticle.gameDate}
                  {selectedArticle.gameTime && ` ${selectedArticle.gameTime}`}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Eye size={12} />
                  {selectedArticle.views}次阅读
                </span>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="text-[15px] text-gray-700 leading-relaxed font-medium">
                  {selectedArticle.summary}
                </p>
              </div>

              <div className="prose prose-sm max-w-none">
                <p className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedArticle.content}
                </p>
              </div>

              {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-[11px] rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettings && settings && (
        <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center">
          <div className="w-[85%] max-w-md bg-white rounded-2xl p-4 animate-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">新闻设置</h2>
              <button onClick={() => setShowSettings(false)} className="p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">自动生成</p>
                  <p className="text-xs text-gray-500">按游戏时间自动触发</p>
                </div>
                <button
                  onClick={toggleAutoGenerate}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.autoGenerateEnabled ? 'bg-[#FF2D55]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.autoGenerateEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">事件触发</p>
                  <p className="text-xs text-gray-500">剧情重大变化时自动生成</p>
                </div>
                <button
                  onClick={toggleEventTrigger}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.eventTriggerEnabled ? 'bg-[#FF2D55]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.eventTriggerEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">
                  当前游戏日期: {getCurrentGameDate() || '未知'}
                </p>
                <p className="text-xs text-gray-500">
                  已存储新闻: {meta?.totalArticles || 0}条 (未读: {meta?.unreadCount || 0})
                </p>
              </div>

              <button
                onClick={handleClearAll}
                className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium"
              >
                清空所有新闻
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 生成选项弹窗 */}
      {showGenerateOptions && (
        <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center">
          <div className="w-[90%] max-w-md bg-white rounded-2xl p-4 animate-in zoom-in duration-200 max-h-[80%] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">生成新闻</h2>
              <button onClick={() => setShowGenerateOptions(false)} className="p-1">
                <X size={20} />
              </button>
            </div>

            {/* 生成模式切换 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setGenerationMode('batch')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  generationMode === 'batch'
                    ? 'bg-[#FF2D55] text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                批量生成
              </button>
              <button
                onClick={() => setGenerationMode('single')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  generationMode === 'single'
                    ? 'bg-[#FF2D55] text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                单条生成
              </button>
            </div>

            {generationMode === 'batch' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">生成数量</label>
                  <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setGenerationCount(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                        generationCount === n
                          ? 'bg-[#FF2D55] text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {n}条
                    </button>
                  ))}
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600">
                    批量生成将在后台执行，您可以在任务管理器中查看进度
                  </p>
                </div>

                <button
                  onClick={handleBatchGenerate}
                  className="w-full py-3 bg-[#FF2D55] text-white rounded-xl font-medium"
                >
                  开始生成 {generationCount} 条新闻
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-2">选择新闻分类：</p>
                {(Object.keys(NEWS_CATEGORY_CONFIG) as NewsCategory[]).map(category => (
                  <button
                    key={category}
                    onClick={() => void handleSingleGenerate(category)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: `${NEWS_CATEGORY_CONFIG[category].color}20`,
                        color: NEWS_CATEGORY_CONFIG[category].color,
                      }}
                    >
                      {renderCategoryIcon(category, 20)}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{NEWS_CATEGORY_CONFIG[category].label}</p>
                      <p className="text-xs text-gray-500">
                        {NEWS_CATEGORY_CONFIG[category].description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 格式化时间显示
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else {
    return `${Math.floor(diff / day)}天前`;
  }
}
