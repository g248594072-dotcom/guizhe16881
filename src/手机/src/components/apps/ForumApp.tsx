import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  MessageSquare,
  ThumbsUp,
  Eye,
  MoreHorizontal,
  Search,
  Plus,
  Settings,
  Loader2,
  Trash2,
  RefreshCw,
  Filter,
  User,
  Users,
  AtSign,
  Ghost,
  Crown,
  Sparkles,
  Bot,
  MessageCircle,
} from 'lucide-react';
import type { ForumPost, ForumTag, ForumIdentityType } from '../../types/forum';
import {
  getAllForumPosts,
  getForumPostsByTag,
  searchForumPosts,
  markPostAsRead,
  togglePostLike,
  deleteForumPost,
  getUnreadForumPostCount,
  toggleForumAutoUpdate,
  setForumAutoUpdateIntervalDays,
  getForumGlobalSettings,
  saveForumPost,
  addForumComment,
} from '../../forumIndexedDb';
import {
  manualGenerateForumPost,
  backgroundBatchGenerateForumPosts,
} from '../../forumScheduler';
import { loadCharacterArchive } from '../../characterArchive/bridge';
import { getTaskManager } from '../BackgroundTaskManager';
import {
  LANGUAGE_STYLES,
  getRandomLanguageStyle,
  generateRandomUserPost,
  type LanguageStyle,
} from '../../forumGenerator';
import ForumPostDetail from './ForumPostDetail';

interface ForumAppProps {
  onClose: () => void;
}

const TAGS: ForumTag[] = ['全部', '树洞', '求助', '吐槽', '八卦', '暴论', '反差'];

const TAG_COLORS: Record<ForumTag, string> = {
  全部: 'bg-gray-100 text-gray-700',
  树洞: 'bg-green-100 text-green-700',
  求助: 'bg-blue-100 text-blue-700',
  吐槽: 'bg-red-100 text-red-700',
  八卦: 'bg-purple-100 text-purple-700',
  暴论: 'bg-orange-100 text-orange-700',
  反差: 'bg-pink-100 text-pink-700',
};

const IDENTITY_ICONS: Record<ForumIdentityType, React.ReactNode> = {
  anonymous: <Ghost size={12} className="text-gray-500" />,
  username: <User size={12} className="text-blue-500" />,
  real_name: <AtSign size={12} className="text-green-500" />,
  role_title: <Crown size={12} className="text-purple-500" />,
};

const IDENTITY_LABELS: Record<ForumIdentityType, string> = {
  anonymous: '匿名',
  username: '网友',
  real_name: '实名',
  role_title: '身份',
};

const STYLE_OPTIONS: { value: LanguageStyle | 'random'; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'random', label: '随机风格', icon: <Sparkles size={16} />, desc: '自动混合多种风格' },
  { value: 'tieba', label: '贴吧风', icon: <MessageSquare size={16} />, desc: '老哥稳、前排围观' },
  { value: 'xiaohongshu', label: '小红书', icon: <Sparkles size={16} />, desc: '姐妹们、绝绝子' },
  { value: 'weibo', label: '微博风', icon: <MessageCircle size={16} />, desc: '吃瓜、热搜预定' },
  { value: 'zhihu', label: '知乎风', icon: <User size={16} />, desc: '谢邀、理性分析' },
  { value: 'douyin', label: '抖音风', icon: <Bot size={16} />, desc: '家人们、破防了' },
];

/** 格式化时间显示 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/** 随机头像颜色 */
function getAvatarColor(name: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** 头像首字母 */
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export default function ForumApp({ onClose }: ForumAppProps) {
  // 状态管理
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<ForumPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [activeTag, setActiveTag] = useState<ForumTag>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  // 点赞动画状态
  const [animatingLikes, setAnimatingLikes] = useState<Set<string>>(new Set());

  // 设置弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [intervalDays, setIntervalDays] = useState(1);

  // 生成弹窗状态
  const [showGenerate, setShowGenerate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [todayEvents, setTodayEvents] = useState('');
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  // 新增生成选项
  const [selectedStyle, setSelectedStyle] = useState<LanguageStyle | 'random'>('random');
  const [generateMode, setGenerateMode] = useState<'character' | 'random' | 'mixed'>('mixed');
  const [randomUserCount, setRandomUserCount] = useState(3);

  // 初始化加载
  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  // 筛选和搜索
  useEffect(() => {
    let result = posts;
    if (activeTag !== '全部') {
      result = result.filter(p => p.tags.includes(activeTag));
    }
    if (searchQuery.trim()) {
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.authorName.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    setFilteredPosts(result);
  }, [posts, activeTag, searchQuery]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allPosts, count] = await Promise.all([getAllForumPosts(), getUnreadForumPostCount()]);
      setPosts(allPosts);
      setUnreadCount(count);
    } catch (e) {
      console.error('[ForumApp] 加载帖子失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await getForumGlobalSettings();
      setAutoUpdate(settings.autoUpdateEnabled);
      setIntervalDays(settings.intervalDays);
    } catch (e) {
      console.error('[ForumApp] 加载设置失败:', e);
    }
  };

  const handleRefresh = async () => {
    await loadData();
  };

  const handlePostClick = async (post: ForumPost) => {
    if (!post.isRead) {
      await markPostAsRead(post.id);
      setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, isRead: true } : p)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    // 增加浏览量（本地显示）
    setPosts(prev =>
      prev.map(p => (p.id === post.id ? { ...p, views: (p.views || 0) + 1 } : p))
    );
    setSelectedPost(post);
  };

  const handleLike = async (post: ForumPost, e: React.MouseEvent) => {
    e.stopPropagation();
    // 添加动画效果
    setAnimatingLikes(prev => new Set(prev).add(post.id));
    setTimeout(() => {
      setAnimatingLikes(prev => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }, 300);

    // 触觉反馈（如果设备支持）
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }

    try {
      const newLiked = await togglePostLike(post.id);
      setPosts(prev =>
        prev.map(p =>
          p.id === post.id
            ? { ...p, isLiked: newLiked, likes: newLiked ? p.likes + 1 : Math.max(0, p.likes - 1) }
            : p,
        ),
      );
    } catch (e) {
      console.error('[ForumApp] 点赞失败:', e);
    }
  };

  const handleDelete = async (post: ForumPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要删除「${post.title}」吗？`)) return;
    try {
      await deleteForumPost(post.id);
      setPosts(prev => prev.filter(p => p.id !== post.id));
    } catch (e) {
      console.error('[ForumApp] 删除失败:', e);
    }
  };

  const openGenerateModal = async () => {
    try {
      const chars = await loadCharacterArchive();
      const activeChars = chars.filter(c => c.status === '出场中').map(c => ({ id: c.id, name: c.name }));
      setCharacters(activeChars);
      if (activeChars.length > 0) {
        setSelectedCharacter(activeChars[0].id);
      }
      setShowGenerate(true);
    } catch (e) {
      console.error('[ForumApp] 加载角色失败:', e);
    }
  };

  // 处理生成 - 使用后台任务
  const handleGenerate = async () => {
    const charIds: string[] = [];
    if (selectedCharacter && (generateMode === 'character' || generateMode === 'mixed')) {
      charIds.push(selectedCharacter);
    }

    // 计算总任务数
    let totalCount = 0;
    if (generateMode === 'character' && selectedCharacter) totalCount = 1;
    else if (generateMode === 'random') totalCount = randomUserCount;
    else if (generateMode === 'mixed') {
      totalCount = (selectedCharacter ? 1 : 0) + randomUserCount;
    }

    if (totalCount === 0) {
      alert('请选择至少一个角色或设置网友数量');
      return;
    }

    // 提交后台任务
    await backgroundBatchGenerateForumPosts(
      {
        characterIds: charIds,
        randomUserCount: generateMode === 'random' || generateMode === 'mixed' ? randomUserCount : 0,
        todayEvents: todayEvents || undefined,
        forcedStyle: selectedStyle === 'random' ? undefined : selectedStyle,
        generateMode,
      },
      (newPosts) => {
        // 完成后刷新列表
        if (newPosts.length > 0) {
          setPosts(prev => [...newPosts, ...prev]);
        }
      },
    );

    // 关闭弹窗，任务已在后台运行
    setShowGenerate(false);
    setTodayEvents('');
    setIsGenerating(false);
  };

  // 批量生成 - 使用后台任务
  const handleBatchGenerate = async () => {
    const charIds = characters.map(c => c.id);

    // 提交后台任务（为所有角色生成）
    await backgroundBatchGenerateForumPosts(
      {
        characterIds: charIds,
        randomUserCount,
        todayEvents: todayEvents || undefined,
        forcedStyle: selectedStyle === 'random' ? undefined : selectedStyle,
        generateMode: 'mixed',
      },
      (newPosts) => {
        // 完成后刷新列表
        if (newPosts.length > 0) {
          setPosts(prev => [...newPosts, ...prev]);
        }
      },
    );

    // 关闭弹窗，任务在后台运行
    setShowGenerate(false);
    setTodayEvents('');
    setIsGenerating(false);
  };

  const handleSaveSettings = async () => {
    try {
      await toggleForumAutoUpdate(autoUpdate);
      await setForumAutoUpdateIntervalDays(intervalDays);
      setShowSettings(false);
    } catch (e) {
      console.error('[ForumApp] 保存设置失败:', e);
    }
  };

  // 返回帖子详情时刷新
  const handleBackFromDetail = () => {
    setSelectedPost(null);
    loadData();
  };

  // 如果选中帖子，显示详情
  if (selectedPost) {
    return <ForumPostDetail post={selectedPost} onBack={handleBackFromDetail} />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white pt-12 pb-2 px-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 -ml-1 text-[#007AFF]">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-[28px] font-bold text-black tracking-tight">论坛</h1>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}未读</span>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索帖子..."
            className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>

      {/* Tag Filter */}
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTag === tag ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Posts List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-[#007AFF]" size={32} />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <MessageSquare size={48} className="mb-4 opacity-50" />
            <p className="text-sm">暂无帖子</p>
            <p className="text-xs mt-1">点击右下角按钮生成</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-2">
            {filteredPosts.map(post => (
              <div
                key={post.id}
                onClick={() => handlePostClick(post)}
                className={`bg-white p-4 rounded-lg shadow-sm cursor-pointer transition-all ${!post.isRead ? 'border-l-4 border-l-[#007AFF]' : ''}`}
              >
                {/* Author Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-full ${getAvatarColor(post.authorName)} flex items-center justify-center text-white text-sm font-bold`}
                    >
                      {getInitial(post.authorName)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{post.authorName}</span>
                      <div className="flex items-center gap-1">
                        {IDENTITY_ICONS[post.identityType]}
                        <span className="text-xs text-gray-400">{IDENTITY_LABELS[post.identityType]}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatTimeAgo(post.createdAt)}</span>
                    <button onClick={e => handleDelete(post, e)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-base font-semibold text-gray-900 mb-2">{post.title}</h2>

                {/* Content Preview */}
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">{post.content}</p>

                {/* Tags */}
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {post.tags.map(tag => (
                    <span key={tag} className={`px-2 py-0.5 rounded text-xs ${TAG_COLORS[tag]}`}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-gray-500 text-sm">
                  <div className="flex items-center gap-1" title={`${post.views || 0}次浏览`}>
                    <Eye size={16} />
                    <span className="tabular-nums">{post.views || 0}</span>
                  </div>
                  <button
                    onClick={e => handleLike(post, e)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-200 active:scale-95 ${
                      post.isLiked
                        ? 'text-[#007AFF] bg-blue-50'
                        : 'hover:text-[#007AFF] hover:bg-gray-50'
                    } ${animatingLikes.has(post.id) ? 'scale-125' : ''}`}
                    title={post.isLiked ? '已点赞' : '点赞'}
                  >
                    <ThumbsUp
                      size={16}
                      className={`transition-transform duration-200 ${post.isLiked ? 'fill-current' : ''} ${animatingLikes.has(post.id) ? 'animate-pulse' : ''}`}
                    />
                    <span className="tabular-nums font-medium">{post.likes || 0}</span>
                  </button>
                  <div className="flex items-center gap-1.5" title={`${post.comments || 0}条评论`}>
                    <MessageSquare size={16} />
                    <span className="tabular-nums font-medium">{post.comments || 0}</span>
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{post.gameDate}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={openGenerateModal}
        className="absolute bottom-6 right-6 w-14 h-14 bg-[#007AFF] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors z-20"
      >
        <Plus size={28} />
      </button>

      {/* Refresh Button */}
      <button
        onClick={handleRefresh}
        className="absolute bottom-6 left-6 w-12 h-12 bg-white text-gray-600 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors z-20"
      >
        <RefreshCw size={20} />
      </button>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-[90%] max-w-md max-h-[85%] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold">生成帖子</h3>
              <button onClick={() => setShowGenerate(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <div className="space-y-5">
                  {/* 生成模式选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">生成模式</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setGenerateMode('character')}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                          generateMode === 'character'
                            ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <User size={20} className="mx-auto mb-1" />
                        仅角色
                      </button>
                      <button
                        onClick={() => setGenerateMode('random')}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                          generateMode === 'random'
                            ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Bot size={20} className="mx-auto mb-1" />
                        仅网友
                      </button>
                      <button
                        onClick={() => setGenerateMode('mixed')}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                          generateMode === 'mixed'
                            ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Users size={20} className="mx-auto mb-1" />
                        混合
                      </button>
                    </div>
                  </div>

                  {/* 角色选择（仅角色/混合模式显示） */}
                  {(generateMode === 'character' || generateMode === 'mixed') && characters.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">选择角色</label>
                      <select
                        value={selectedCharacter}
                        onChange={e => setSelectedCharacter(e.target.value)}
                        className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-sm outline-none"
                      >
                        <option value="">不选角色</option>
                        {characters.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {generateMode === 'mixed' && !selectedCharacter && (
                        <p className="text-xs text-orange-500 mt-1">混合模式下不选角色将只生成网友帖子</p>
                      )}
                    </div>
                  )}

                  {/* 网友数量（仅网友/混合模式显示） */}
                  {(generateMode === 'random' || generateMode === 'mixed') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        随机网友数量: {randomUserCount}
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={randomUserCount}
                        onChange={e => setRandomUserCount(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-400 mt-1">生成 {randomUserCount} 个随机网友的帖子</p>
                    </div>
                  )}

                  {/* 语言风格选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">语言风格</label>
                    <div className="grid grid-cols-2 gap-2">
                      {STYLE_OPTIONS.map(style => (
                        <button
                          key={style.value}
                          onClick={() => setSelectedStyle(style.value)}
                          className={`p-2.5 rounded-xl border-2 text-left transition-colors ${
                            selectedStyle === style.value
                              ? 'border-[#007AFF] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={selectedStyle === style.value ? 'text-[#007AFF]' : 'text-gray-600'}>
                              {style.icon}
                            </span>
                            <span
                              className={`text-sm font-medium ${
                                selectedStyle === style.value ? 'text-[#007AFF]' : 'text-gray-700'
                              }`}
                            >
                              {style.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 pl-6">{style.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 今日事件 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">剧情事件（可选）</label>
                    <textarea
                      value={todayEvents}
                      onChange={e => setTodayEvents(e.target.value)}
                      placeholder="描述今天发生的事，AI会参考生成帖子内容..."
                      rows={4}
                      className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">留空则AI自动根据风格生成随机内容</p>
                  </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowGenerate(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
                disabled={isGenerating}
              >
                取消
              </button>
              {characters.length > 0 && (
                <button
                  onClick={handleBatchGenerate}
                  disabled={isGenerating}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  批量
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || (generateMode === 'character' && !selectedCharacter)}
                className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                后台生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-[90%] max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold">设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">自动生成帖子</h4>
                  <p className="text-xs text-gray-500">按游戏日期自动为角色生成帖子</p>
                </div>
                <button
                  onClick={() => setAutoUpdate(!autoUpdate)}
                  className={`w-14 h-8 rounded-full transition-colors relative ${autoUpdate ? 'bg-[#007AFF]' : 'bg-gray-300'}`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      autoUpdate ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              {autoUpdate && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">生成间隔（天）</h4>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={7}
                      value={intervalDays}
                      onChange={e => setIntervalDays(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600 w-8">{intervalDays}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">每隔{intervalDays}天为每个角色自动生成一篇帖子</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl text-sm font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
