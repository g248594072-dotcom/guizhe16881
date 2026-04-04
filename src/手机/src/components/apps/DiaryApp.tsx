import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Plus, Search, MoreHorizontal, Sparkles, Calendar, User, Trash2, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import type { DiaryEntry } from '../../diaryIndexedDb';
import {
  getAllDiaries,
  getDiariesByCharacter,
  markDiaryAsRead,
  deleteDiary,
  getUnreadDiaryCount,
  toggleAutoGenerate,
  getDiaryMeta,
} from '../../diaryIndexedDb';
import {
  manualGenerateDiary,
  batchManualGenerateDiaries,
  setCurrentGameDate,
  onNewDiariesGenerated,
} from '../../diaryScheduler';
import { loadCharacterArchive, type PhoneCharacterArchive } from '../../characterArchive/bridge';

interface DiaryAppProps {
  onClose: () => void;
}

/** 日记详情弹窗 */
function DiaryDetailModal({
  entry,
  isOpen,
  onClose,
  onDelete,
}: {
  entry: DiaryEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  if (!isOpen || !entry) return null;

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-100">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <X size={24} className="text-gray-600" />
        </button>
        <span className="text-sm text-gray-500">{entry.gameDate}</span>
        <button
          onClick={() => onDelete(entry.id)}
          className="p-2 -mr-2 rounded-full hover:bg-red-50 transition-colors"
        >
          <Trash2 size={20} className="text-red-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
            {entry.characterName}
          </span>
          {entry.moodTags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-4 leading-tight">
          {entry.title}
        </h2>

        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-[15px]">
            {entry.content}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          这篇日记记录了{entry.characterName}最真实的内心独白
        </p>
      </div>
    </div>
  );
}

/** 生成选项弹窗 */
function GenerateOptionsModal({
  isOpen,
  onClose,
  characters,
  onGenerateSingle,
  onGenerateAll,
  isGenerating,
  progress,
}: {
  isOpen: boolean;
  onClose: () => void;
  characters: PhoneCharacterArchive[];
  onGenerateSingle: (char: PhoneCharacterArchive) => void;
  onGenerateAll: () => void;
  isGenerating: boolean;
  progress: { current: number; total: number; name: string } | null;
}) {
  if (!isOpen) return null;

  const activeChars = characters.filter(c => c.status === '出场中');

  return (
    <div className="absolute inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">生成日记</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Progress */}
        {isGenerating && progress && (
          <div className="px-5 py-4 bg-amber-50">
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className="text-amber-600 animate-spin" />
              <div className="flex-1">
                <p className="text-sm text-amber-800">
                  正在为 {progress.name} 生成日记... ({progress.current}/{progress.total})
                </p>
                <div className="mt-2 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="p-5 space-y-4">
          {/* 批量生成 */}
          <button
            onClick={onGenerateAll}
            disabled={isGenerating || activeChars.length === 0}
            className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={24} />
            <div className="text-left">
              <p className="font-semibold">为所有角色生成</p>
              <p className="text-xs text-white/80">
                将为 {activeChars.length} 个出场中的角色生成今日日记
              </p>
            </div>
          </button>

          {/* 单个生成 */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">单独生成</p>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {activeChars.map(char => (
                <button
                  key={char.id}
                  onClick={() => onGenerateSingle(char)}
                  disabled={isGenerating}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm font-medium">
                    {char.name[0]}
                  </div>
                  <span className="text-sm font-medium text-gray-700 truncate">{char.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DiaryApp({ onClose }: DiaryAppProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DiaryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [characters, setCharacters] = useState<PhoneCharacterArchive[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [filterCharacter, setFilterCharacter] = useState<string>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  /** 加载日记和角色数据 */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [diaries, chars, unread] = await Promise.all([
        getAllDiaries(),
        loadCharacterArchive(),
        getUnreadDiaryCount(),
      ]);
      setEntries(diaries);
      setCharacters(chars);
      setUnreadCount(unread);
    } catch (e) {
      console.error('[DiaryApp] 加载数据失败:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 监听新日记生成 */
  useEffect(() => {
    const unsubscribe = onNewDiariesGenerated(newEntries => {
      setEntries(prev => [...newEntries, ...prev]);
      setUnreadCount(prev => prev + newEntries.length);
    });
    return unsubscribe;
  }, []);

  /** 筛选日记 */
  useEffect(() => {
    let filtered = entries;

    // 角色筛选
    if (filterCharacter !== 'all') {
      filtered = filtered.filter(e => e.characterId === filterCharacter);
    }

    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.content.toLowerCase().includes(query) ||
        e.characterName.toLowerCase().includes(query)
      );
    }

    setFilteredEntries(filtered);
  }, [entries, searchQuery, filterCharacter]);

  /** 打开日记详情 */
  const handleOpenDetail = async (entry: DiaryEntry) => {
    setSelectedEntry(entry);
    setShowDetail(true);
    if (!entry.isRead) {
      await markDiaryAsRead(entry.id);
      setEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, isRead: true } : e
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  /** 删除日记 */
  const handleDelete = async (id: string) => {
    await deleteDiary(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setShowDetail(false);
  };

  /** 批量生成日记 */
  const handleBatchGenerate = async () => {
    setIsGenerating(true);
    setShowGenerate(false);

    try {
      const newEntries = await batchManualGenerateDiaries(undefined, (current, total, name) => {
        setGenerateProgress({ current, total, name });
      });

      if (newEntries.length > 0) {
        setEntries(prev => [...newEntries, ...prev]);
        setUnreadCount(prev => prev + newEntries.length);
      }
    } catch (e) {
      console.error('[DiaryApp] 批量生成失败:', e);
    } finally {
      setIsGenerating(false);
      setGenerateProgress(null);
    }
  };

  /** 单个生成日记 */
  const handleSingleGenerate = async (char: PhoneCharacterArchive) => {
    setIsGenerating(true);
    setShowGenerate(false);

    try {
      const entry = await manualGenerateDiary(char.id, char.name);
      if (entry) {
        setEntries(prev => [entry, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    } catch (e) {
      console.error('[DiaryApp] 单一生成失败:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  /** 切换角色自动生成设置 */
  const toggleCharacterAutoGenerate = async (charId: string) => {
    const meta = await getDiaryMeta(charId);
    const newValue = !(meta?.autoGenerateEnabled ?? true);
    await toggleAutoGenerate(charId, newValue);
  };

  /** 按角色分组统计 */
  const characterStats = useMemo(() => {
    const stats: Record<string, { count: number; unread: number }> = {};
    entries.forEach(e => {
      if (!stats[e.characterId]) {
        stats[e.characterId] = { count: 0, unread: 0 };
      }
      stats[e.characterId].count++;
      if (!e.isRead) {
        stats[e.characterId].unread++;
      }
    });
    return stats;
  }, [entries]);

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-[#F8F9FA] pt-12 pb-3 px-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 -ml-1 text-amber-600 hover:bg-amber-100/50 rounded-full transition-colors">
            <ChevronLeft size={28} />
          </button>
          <span className="text-amber-600 font-medium text-lg">返回</span>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-full text-sm font-medium hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
        >
          {isGenerating ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {isGenerating ? '生成中...' : '生成'}
        </button>
      </div>

      <div className="px-4 pb-2 pt-2">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-[34px] font-bold text-gray-900 tracking-tight">日记</h1>
          {unreadCount > 0 && (
            <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-medium rounded-full">
              {unreadCount} 未读
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">窥探角色最真实、最私密的心灵独白</p>

        {/* Search */}
        <div className="bg-white rounded-[12px] shadow-sm border border-gray-100 flex items-center px-3 py-2.5 mb-4">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="搜索日记内容..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-[15px] w-full placeholder-gray-400 text-gray-800"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 -mr-1">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Character Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
          <button
            onClick={() => setFilterCharacter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filterCharacter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <Calendar size={14} />
            全部 ({entries.length})
          </button>
          {characters.filter(c => c.status === '出场中').map(char => {
            const stats = characterStats[char.id] || { count: 0, unread: 0 };
            return (
              <button
                key={char.id}
                onClick={() => setFilterCharacter(filterCharacter === char.id ? 'all' : char.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterCharacter === char.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                <User size={14} />
                {char.name}
                {stats.count > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs ${
                    filterCharacter === char.id ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    {stats.count}{stats.unread > 0 && `(${stats.unread})`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <RefreshCw size={32} className="animate-spin mb-3" />
            <p className="text-sm">加载日记中...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <BookHeartIcon size={48} className="mb-3 opacity-30" />
            <p className="text-sm">
              {searchQuery ? '没有找到匹配的日记' : entries.length === 0 ? '还没有日记，点击右上角生成' : '筛选后没有日记'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry, index) => (
              <button
                key={entry.id}
                onClick={() => handleOpenDetail(entry)}
                className={`w-full text-left p-4 bg-white rounded-[16px] shadow-sm border transition-all hover:shadow-md active:scale-[0.98] ${
                  entry.isRead ? 'border-gray-100' : 'border-amber-200 bg-amber-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                    entry.isRead ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {entry.characterName[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-[15px]">
                        {entry.characterName}
                      </span>
                      {!entry.isRead && (
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {entry.gameDate}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className={`font-semibold mb-1.5 leading-tight ${
                      entry.isRead ? 'text-gray-700' : 'text-gray-900'
                    }`}>
                      {entry.title}
                    </h3>

                    {/* Preview */}
                    <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed">
                      {entry.content}
                    </p>

                    {/* Mood Tags */}
                    <div className="flex gap-1.5 mt-2.5">
                      {entry.moodTags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-0 inset-x-0 h-20 bg-white/80 backdrop-blur-md border-t border-gray-200 flex items-center justify-between px-6 pb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">
            {entries.length} 篇日记
          </span>
          {unreadCount > 0 && (
            <span className="text-xs text-red-500 font-medium">
              · {unreadCount} 未读
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterCharacter(filterCharacter === 'unread' ? 'all' : 'unread')}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {filterCharacter === 'unread' ? <Eye size={14} /> : <EyeOff size={14} />}
            {filterCharacter === 'unread' ? '显示全部' : '仅未读'}
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      <DiaryDetailModal
        entry={selectedEntry}
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        onDelete={handleDelete}
      />

      {/* Generate Modal */}
      <GenerateOptionsModal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        characters={characters}
        onGenerateSingle={handleSingleGenerate}
        onGenerateAll={handleBatchGenerate}
        isGenerating={isGenerating}
        progress={generateProgress}
      />
    </div>
  );
}

// 自定义图标组件
function BookHeartIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M12 7.5C12 7.5 10 9 10 11C10 12.5 11 13 12 13C13 13 14 12.5 14 11C14 9 12 7.5 12 7.5z" />
    </svg>
  );
}
