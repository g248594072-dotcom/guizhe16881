/**
 * 朋友圈应用组件
 * 【角色朋友圈】私密社交媒体，支持双重视图：
 * 1. 全局动态流（Global Feed）- 类似微信朋友圈首页
 * 2. 角色个人主页（Character Profile）- 单个角色的动态主页
 *
 * 特殊功能：
 * - 主角（玩家）特权视角：可以看到所有"仅本人可见"的阴暗想法
 * - 基于角色关系的评论权限：只有认识的角色才能评论
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Heart, MessageCircle, Send, MoreHorizontal, User, Lock, Sparkles, X, RefreshCw, Globe, Users, Camera, Settings } from 'lucide-react';
import type { Moment, MomentComment, MomentContentType, MomentVisibility } from '../../types/moments';
import {
  getAllMoments,
  getMomentsByCharacter,
  toggleLike,
  addComment,
  saveMoment,
  getMomentsGlobalSettings,
  saveMomentsGlobalSettings,
} from '../../momentsIndexedDb';
import {
  canViewMoment,
  getVisibilityLabel,
  getContentTypeLabel,
} from '../../relationshipValidator';
import { loadCharacterArchive, type PhoneCharacterArchive } from '../../characterArchive/bridge';
import {
  manualGenerateMoment,
  backgroundBatchGenerateMoments,
  onNewMomentsGenerated,
  setCurrentGameDate,
} from '../../momentsScheduler';

interface MomentsAppProps {
  onClose: () => void;
  initialCharacterId?: string; // 可选：初始显示某个角色的主页
  onViewCharacterProfile?: (characterId: string) => void; // 查看角色详情回调
}

/** 视图模式 */
type ViewMode = 'global_feed' | 'character_profile';

/** 角色选择器弹窗 */
function CharacterSelectorModal({
  isOpen,
  onClose,
  characters,
  selectedId,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  characters: PhoneCharacterArchive[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">选择视角</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* 主角视角 */}
          <button
            onClick={() => {
              onSelect(null);
              onClose();
            }}
            className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
              selectedId === null
                ? 'bg-blue-50 border-2 border-blue-500'
                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
              主
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-900">主角（玩家）视角</p>
              <p className="text-xs text-gray-500">可以看到所有动态，包括"仅本人可见"的阴暗想法</p>
            </div>
            {selectedId === null && <Sparkles size={20} className="text-blue-500" />}
          </button>

          <div className="border-t border-gray-100 my-3" />

          {/* 角色列表 */}
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">角色视角</p>
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
            {characters.map(char => (
              <button
                key={char.id}
                onClick={() => {
                  onSelect(char.id);
                  onClose();
                }}
                className={`flex items-center gap-2 p-3 rounded-xl transition-all text-left ${
                  selectedId === char.id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
                  {char.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{char.name}</p>
                  <p className="text-xs text-gray-400">{char.status}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
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
}: {
  isOpen: boolean;
  onClose: () => void;
  characters: PhoneCharacterArchive[];
  onGenerateSingle: (char: PhoneCharacterArchive) => void;
  onGenerateAll: () => void;
}) {
  if (!isOpen) return null;

  const activeChars = characters.filter(c => c.status === '出场中');

  return (
    <div className="absolute inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">生成朋友圈</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-800 flex items-center gap-2">
            <Sparkles size={16} />
            任务将在后台运行，可在右下角查看进度
          </p>
        </div>

        <div className="p-5 space-y-4">
          <button
            onClick={onGenerateAll}
            disabled={activeChars.length === 0}
            className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={24} />
            <div className="text-left">
              <p className="font-semibold">为所有角色生成</p>
              <p className="text-xs text-white/80">
                将为 {activeChars.length} 个出场中的角色生成朋友圈动态
              </p>
            </div>
          </button>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">单独生成</p>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {activeChars.map(char => (
                <button
                  key={char.id}
                  onClick={() => onGenerateSingle(char)}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
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

/** 设置弹窗 */
function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: import('../../types/moments').MomentsGlobalSettings | null;
  onSave: (settings: import('../../types/moments').MomentsGlobalSettings) => void;
}) {
  const [form, setForm] = useState({
    enableMessageTrigger: true,
    enableGameTimeTrigger: true,
    msgMin: 5,
    msgMax: 10,
    timeMin: 120,
    timeMax: 240,
  });

  // 加载设置到表单
  useEffect(() => {
    if (settings) {
      setForm({
        enableMessageTrigger: settings.enableMessageTrigger,
        enableGameTimeTrigger: settings.enableGameTimeTrigger,
        msgMin: settings.intervalMessages.min,
        msgMax: settings.intervalMessages.max,
        timeMin: settings.intervalGameMinutes.min,
        timeMax: settings.intervalGameMinutes.max,
      });
    }
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!settings) return;
    onSave({
      ...settings,
      enableMessageTrigger: form.enableMessageTrigger,
      enableGameTimeTrigger: form.enableGameTimeTrigger,
      intervalMessages: { min: form.msgMin, max: form.msgMax },
      intervalGameMinutes: { min: form.timeMin, max: form.timeMax },
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">自动发送设置</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* 消息楼层触发 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-gray-900">按消息楼层触发</span>
                <span className="text-xs text-gray-500">（酒馆聊天楼层）</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enableMessageTrigger}
                  onChange={e => setForm(f => ({ ...f, enableMessageTrigger: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#07c160]"></div>
              </label>
            </div>

            {form.enableMessageTrigger && (
              <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                <p className="text-sm text-gray-600">每发送多少条消息后，随机触发角色发朋友圈</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">最小楼层</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={form.msgMin}
                      onChange={e => setForm(f => ({ ...f, msgMin: parseInt(e.target.value) || 1 }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#07c160]"
                    />
                  </div>
                  <span className="text-gray-400 pt-4">~</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">最大楼层</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.msgMax}
                      onChange={e => setForm(f => ({ ...f, msgMax: parseInt(e.target.value) || 10 }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#07c160]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 游戏时间触发 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-gray-900">按游戏时间触发</span>
                <span className="text-xs text-gray-500">（游戏内时间流逝）</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enableGameTimeTrigger}
                  onChange={e => setForm(f => ({ ...f, enableGameTimeTrigger: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#07c160]"></div>
              </label>
            </div>

            {form.enableGameTimeTrigger && (
              <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                <p className="text-sm text-gray-600">每过多少游戏时间（分钟），随机触发角色发朋友圈</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">最短时间（分钟）</label>
                    <input
                      type="number"
                      min={10}
                      step={10}
                      value={form.timeMin}
                      onChange={e => setForm(f => ({ ...f, timeMin: parseInt(e.target.value) || 60 }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#07c160]"
                    />
                  </div>
                  <span className="text-gray-400 pt-4">~</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">最长时间（分钟）</label>
                    <input
                      type="number"
                      min={10}
                      step={10}
                      value={form.timeMax}
                      onChange={e => setForm(f => ({ ...f, timeMax: parseInt(e.target.value) || 240 }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#07c160]"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">例如：120-240分钟 = 游戏内2-4小时触发一次</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-[#07c160] text-white rounded-xl font-medium hover:bg-[#06ad56] transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}

/** 评论输入组件 */
function CommentInput({
  onSubmit,
  placeholder = "发表评论...",
  compact = false,
}: {
  onSubmit: (content: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim());
      setContent('');
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-white rounded px-3 py-1.5 text-sm border border-gray-200 focus:outline-none focus:border-gray-400"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="px-3 py-1.5 bg-[#07c160] text-white rounded text-sm hover:bg-[#06ad56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          发送
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50">
      <input
        type="text"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-white rounded-full px-4 py-2 text-sm border border-gray-200 focus:outline-none focus:border-blue-400"
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />
      <button
        onClick={handleSubmit}
        disabled={!content.trim()}
        className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send size={16} />
      </button>
    </div>
  );
}

/** 动态卡片组件 - 微信风格 */
function MomentCard({
  moment,
  currentViewerId,
  isMainCharacter,
  allCharacters,
  onLike,
  onAddComment,
  onViewProfile,
  expanded,
  onToggleExpand,
}: {
  moment: Moment;
  currentViewerId: string | null;
  isMainCharacter: boolean;
  allCharacters: PhoneCharacterArchive[];
  onLike: (momentId: string) => void;
  onAddComment: (momentId: string, content: string) => void;
  onViewProfile: (characterId: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [animatingLike, setAnimatingLike] = useState(false);

  const isLiked = moment.likes?.some(l => l.characterId === (currentViewerId || 'main_character'));
  const likeCount = moment.likes?.length || 0;
  const commentCount = moment.comments?.length || 0;

  const handleLike = () => {
    setAnimatingLike(true);
    onLike(moment.id);
    setTimeout(() => setAnimatingLike(false), 300);
    setShowActions(false);
  };

  // 判断是否是"仅本人可见"的动态且主角在查看（特权视角）
  const isPrivilegedView = isMainCharacter && moment.visibility === 'main_character';

  // 获取角色头像
  const authorChar = allCharacters.find(c => c.id === moment.characterId);

  return (
    <div className="bg-white px-4 py-4 border-b border-gray-100">
      <div className="flex gap-3">
        {/* 左侧头像 */}
        <button
          onClick={() => onViewProfile(moment.characterId)}
          className="w-10 h-10 rounded bg-gray-200 flex-shrink-0 overflow-hidden"
        >
          {authorChar?.avatarUrl ? (
            <img src={authorChar.avatarUrl} alt={moment.characterName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 font-medium text-lg">
              {moment.characterName[0]}
            </div>
          )}
        </button>

        {/* 右侧内容区 */}
        <div className="flex-1 min-w-0">
          {/* 昵称 */}
          <button
            onClick={() => onViewProfile(moment.characterId)}
            className="text-[#576b95] font-semibold text-[15px] hover:underline text-left"
          >
            {moment.characterName}
          </button>

          {/* 特权标识（仅主角可见） */}
          {isPrivilegedView && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
              私密
            </span>
          )}

          {/* 动态内容 */}
          <div className="mt-1 text-[15px] text-gray-800 leading-relaxed">
            <span className={`whitespace-pre-wrap ${!expanded && moment.content.length > 150 ? 'line-clamp-3' : ''}`}>
              {moment.content}
            </span>
            {moment.content.length > 150 && !expanded && (
              <button
                onClick={onToggleExpand}
                className="text-gray-500 text-sm ml-1"
              >
                ...全文
              </button>
            )}
          </div>

          {/* 自我辩解（仅主角可见） */}
          {isMainCharacter && moment.selfJustification && expanded && (
            <div className="mt-2 p-2 bg-purple-50 rounded text-sm">
              <span className="text-purple-600 font-medium">内心独白：</span>
              <span className="text-purple-800 italic">{moment.selfJustification}</span>
            </div>
          )}

          {/* 时间和操作行 */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{moment.gameDate} {moment.gameTime}</span>
              {moment.location && (
                <span className="text-[#576b95]">{moment.location}</span>
              )}
            </div>

            {/* 微信风格的两点按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="px-2 py-1 bg-[#f7f7f7] rounded hover:bg-gray-200 transition-colors"
              >
                <MoreHorizontal size={16} className="text-[#576b95]" />
              </button>

              {/* 点赞评论弹窗 */}
              {showActions && (
                <div className="absolute right-0 top-0 bg-[#4c4c4c] rounded flex items-center overflow-hidden z-10">
                  <button
                    onClick={handleLike}
                    className="px-4 py-2 text-white text-sm flex items-center gap-1 hover:bg-[#5c5c5c] border-r border-white/20"
                  >
                    <Heart size={14} className={isLiked ? 'fill-current' : ''} />
                    {isLiked ? '取消' : '赞'}
                  </button>
                  <button
                    onClick={() => {
                      setShowActions(false);
                      // 滚动到评论输入框
                    }}
                    className="px-4 py-2 text-white text-sm flex items-center gap-1 hover:bg-[#5c5c5c]"
                  >
                    <MessageCircle size={14} />
                    评论
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 点赞列表（微信风格） */}
          {(likeCount > 0 || commentCount > 0) && (
            <div className="mt-2 bg-[#f7f7f7] rounded p-2 text-sm">
              {/* 点赞 */}
              {likeCount > 0 && (
                <div className="flex items-start gap-1 text-[#576b95]">
                  <Heart size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {moment.likes?.map(l => l.characterName).join('，')}
                  </span>
                </div>
              )}

              {/* 分隔线 */}
              {likeCount > 0 && commentCount > 0 && (
                <div className="border-t border-gray-200 my-1" />
              )}

              {/* 评论列表 */}
              {commentCount > 0 && (
                <div className="space-y-1">
                  {moment.comments?.map(comment => (
                    <div key={comment.id} className="text-sm">
                      <span className="text-[#576b95] font-medium">{comment.authorName}</span>
                      <span className="text-gray-600">：{comment.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 评论输入 */}
          <div className="mt-2">
            <CommentInput
              onSubmit={content => {
                onAddComment(moment.id, content);
                setShowActions(false);
              }}
              placeholder="评论"
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 主应用组件 */
export default function MomentsApp({
  onClose,
  initialCharacterId,
  onViewCharacterProfile,
}: MomentsAppProps) {
  // 状态
  const [viewMode, setViewMode] = useState<ViewMode>(initialCharacterId ? 'character_profile' : 'global_feed');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(initialCharacterId || null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [filteredMoments, setFilteredMoments] = useState<Moment[]>([]);
  const [characters, setCharacters] = useState<PhoneCharacterArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMoments, setExpandedMoments] = useState<Set<string>>(new Set());

  // UI状态
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // 设置状态
  const [settings, setSettings] = useState<import('../../types/moments').MomentsGlobalSettings | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allMoments, allCharacters, globalSettings] = await Promise.all([
        getAllMoments(100),
        loadCharacterArchive(),
        getMomentsGlobalSettings(),
      ]);

      setMoments(allMoments);
      setCharacters(allCharacters);
      setSettings(globalSettings);
    } catch (e) {
      console.error('[MomentsApp] 加载数据失败:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 保存设置
  const handleSaveSettings = useCallback(async (newSettings: import('../../types/moments').MomentsGlobalSettings) => {
    try {
      await saveMomentsGlobalSettings(newSettings);
      setSettings(newSettings);

      // 通知调度器设置已更新，重新计算触发阈值
      const { updateSettingsAndReinit } = await import('../../momentsScheduler');
      await updateSettingsAndReinit();

      toastr.success('设置已保存');
    } catch (e) {
      console.error('[MomentsApp] 保存设置失败:', e);
      toastr.error('保存设置失败');
    }
  }, []);

  useEffect(() => {
    loadData();

    // 订阅新动态生成事件
    const unsubscribe = onNewMomentsGenerated(newMoments => {
      setMoments(prev => [...newMoments, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // 过滤可见性（主角特权视角）
  useEffect(() => {
    const filterMoments = async () => {
      const isMainCharacter = selectedCharacterId === null;
      const currentViewerArchive = selectedCharacterId
        ? characters.find(c => c.id === selectedCharacterId)
        : undefined;

      const filtered = moments.filter(moment => {
        return canViewMoment(
          selectedCharacterId,
          moment,
          characters,
          isMainCharacter,
          currentViewerArchive
        );
      });

      // 如果是角色个人主页视图，只显示该角色的动态
      if (viewMode === 'character_profile' && selectedCharacterId) {
        setFilteredMoments(filtered.filter(m => m.characterId === selectedCharacterId));
      } else {
        setFilteredMoments(filtered);
      }
    };

    filterMoments();
  }, [moments, selectedCharacterId, characters, viewMode]);

  // 获取当前选中角色的信息
  const selectedCharacter = useMemo(() => {
    return characters.find(c => c.id === selectedCharacterId);
  }, [characters, selectedCharacterId]);

  // 处理点赞
  const handleLike = async (momentId: string) => {
    const viewerId = selectedCharacterId || 'main_character';
    const viewerName = selectedCharacter?.name || '主角';

    await toggleLike(momentId, viewerId, viewerName);

    // 更新本地状态
    setMoments(prev => prev.map(m => {
      if (m.id !== momentId) return m;

      const likes = m.likes || [];
      const existingIndex = likes.findIndex(l => l.characterId === viewerId);

      if (existingIndex >= 0) {
        likes.splice(existingIndex, 1);
      } else {
        likes.push({
          characterId: viewerId,
          characterName: viewerName,
          timestamp: Date.now(),
        });
      }

      return { ...m, likes };
    }));
  };

  // 处理添加评论
  const handleAddComment = async (momentId: string, content: string) => {
    const moment = moments.find(m => m.id === momentId);
    if (!moment) return;

    const viewerId = selectedCharacterId || 'main_character';
    const viewerName = selectedCharacter?.name || '主角';

    const newComment: MomentComment = {
      id: crypto.randomUUID(),
      momentId,
      authorId: viewerId,
      authorName: viewerName,
      content,
      timestamp: Date.now(),
      gameDate: moment.gameDate,
      likes: [],
    };

    await addComment(newComment);

    // 更新本地状态
    setMoments(prev => prev.map(m => {
      if (m.id !== momentId) return m;
      return {
        ...m,
        comments: [...(m.comments || []), newComment],
      };
    }));
  };

  // 处理生成单条动态
  const handleSingleGenerate = async (char: PhoneCharacterArchive) => {
    setShowGenerateModal(false);
    await backgroundBatchGenerateMoments({
      characterIds: [char.id],
    }, newMoments => {
      if (newMoments.length > 0) {
        setMoments(prev => [...newMoments, ...prev]);
      }
    });
  };

  // 处理批量生成
  const handleBatchGenerate = async () => {
    setShowGenerateModal(false);
    await backgroundBatchGenerateMoments({}, newMoments => {
      if (newMoments.length > 0) {
        setMoments(prev => [...newMoments, ...prev]);
      }
    });
  };

  // 切换动态展开状态
  const toggleExpand = (momentId: string) => {
    setExpandedMoments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(momentId)) {
        newSet.delete(momentId);
      } else {
        newSet.add(momentId);
      }
      return newSet;
    });
  };

  // 查看角色个人主页
  const handleViewProfile = (characterId: string) => {
    setSelectedCharacterId(characterId);
    setViewMode('character_profile');
    onViewCharacterProfile?.(characterId);
  };

  // 渲染头部 - 微信风格（预留刘海屏空间）
  const renderHeader = () => (
    <div className="sticky top-0 z-20 bg-[#1a1a1a] text-white">
      {/* 刘海屏安全区域占位 */}
      <div className="h-[32px]" />
      {/* 实际导航栏 */}
      <div className="px-4 py-2 flex items-center justify-between h-12">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={onClose}
            className="p-1 -ml-1 flex items-center text-white/90 hover:text-white"
          >
            <ChevronLeft size={24} />
            <span className="text-base">发现</span>
          </button>
        </div>

        <h1 className="text-lg font-medium absolute left-1/2 -translate-x-1/2">
          朋友圈
        </h1>

        <div className="flex items-center gap-1">
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-white/80 hover:text-white"
            title="自动发送设置"
          >
            <Settings size={20} />
          </button>

          {/* 视角切换 */}
          <button
            onClick={() => setShowCharacterSelector(true)}
            className="p-2 text-white/80 hover:text-white"
            title="切换视角"
          >
            <User size={20} />
          </button>

          {/* 生成动态 - 相机图标 */}
          <button
            onClick={() => setShowGenerateModal(true)}
            className="p-2 text-white/80 hover:text-white"
            title="生成动态"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染朋友圈封面 - 微信风格
  const renderCover = () => {
    if (viewMode === 'character_profile' && selectedCharacter) {
      return (
        <div className="relative h-72 bg-gradient-to-br from-[#576b95] to-[#2c3e5c]">
          {/* 个人主页封面 */}
          <div className="absolute bottom-4 right-4 flex items-end gap-3">
            <div className="text-right text-white mb-2">
              <h2 className="text-xl font-semibold">{selectedCharacter.name}</h2>
              <p className="text-xs text-white/70">{selectedCharacter.status}</p>
            </div>
            <div className="w-20 h-20 rounded-lg bg-white p-0.5 shadow-lg">
              {selectedCharacter.avatarUrl ? (
                <img src={selectedCharacter.avatarUrl} alt={selectedCharacter.name} className="w-full h-full rounded-lg object-cover" />
              ) : (
                <div className="w-full h-full rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 text-2xl font-bold">
                  {selectedCharacter.name[0]}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 全局动态流封面
    return (
      <div className="relative h-72 bg-gradient-to-br from-[#576b95] to-[#2c3e5c]">
        {/* 默认封面图 */}
        <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')]" />

        {/* 主角信息 */}
        <div className="absolute bottom-4 right-4 flex items-end gap-3">
          <div className="text-right text-white mb-2">
            <h2 className="text-xl font-semibold">主角</h2>
            <p className="text-xs text-white/70">玩家视角</p>
          </div>
          <div className="w-20 h-20 rounded-lg bg-white p-0.5 shadow-lg overflow-hidden">
            <div className="w-full h-full rounded-lg bg-[#07c160] flex items-center justify-center text-white text-2xl font-bold">
              主
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 渲染角色个人主页头部（保留兼容）
  const renderProfileHeader = () => {
    if (!selectedCharacter) return null;

    return (
      <div className="bg-white">
        {/* 封面区域已由 renderCover 处理 */}
        {/* 角色信息简要 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-500">{selectedCharacter.description}</p>
          {/* 统计 */}
          <div className="flex items-center gap-6 mt-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-900">{filteredMoments.length}</span>
              <span className="text-gray-500">动态</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {renderHeader()}

      {/* 主内容区 - 微信风格 */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-gray-400">
              <RefreshCw size={20} className="animate-spin" />
              <span>加载中...</span>
            </div>
          </div>
        ) : (
          <>
            {/* 封面区域 - 微信风格 */}
            {renderCover()}

            {/* 动态列表 */}
            <div className="bg-white">
              {viewMode === 'character_profile' && renderProfileHeader()}

              {filteredMoments.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white">
                  <p className="text-sm">暂无朋友圈动态</p>
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    className="mt-3 px-4 py-2 bg-[#07c160] text-white rounded text-sm hover:bg-[#06ad56] transition-colors"
                  >
                    去生成
                  </button>
                </div>
              ) : (
                filteredMoments.map(moment => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    currentViewerId={selectedCharacterId}
                    isMainCharacter={selectedCharacterId === null}
                    allCharacters={characters}
                    onLike={handleLike}
                    onAddComment={handleAddComment}
                    onViewProfile={handleViewProfile}
                    expanded={expandedMoments.has(moment.id)}
                    onToggleExpand={() => toggleExpand(moment.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* 角色选择器弹窗 */}
      <CharacterSelectorModal
        isOpen={showCharacterSelector}
        onClose={() => setShowCharacterSelector(false)}
        characters={characters}
        selectedId={selectedCharacterId}
        onSelect={(id) => {
          setSelectedCharacterId(id);
          if (id === null) {
            setViewMode('global_feed');
          }
        }}
      />

      {/* 生成选项弹窗 */}
      <GenerateOptionsModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        characters={characters}
        onGenerateSingle={handleSingleGenerate}
        onGenerateAll={handleBatchGenerate}
      />

      {/* 设置弹窗 */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
