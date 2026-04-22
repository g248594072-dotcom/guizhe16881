/**
 * 角色档案 App（TenantArchiveApp）
 * 显示规则 App 中的角色档案列表和详情，支持角色分析触发
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  User,
  Heart,
  Brain,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Settings2,
  Pencil,
} from 'lucide-react';
import { loadCharacterArchive, type PhoneCharacterArchive } from '../../characterArchive/bridge';
import { getAnalysisScheduler } from '../../characterArchive/analysisScheduler';
import { getCharacterAnalyzer } from '../../characterArchive/characterAnalyzer';
import { requestTavernPhoneContext, saveAutoAnalyzeInterval, subscribeAutoAnalyzeAll } from '../../tavernPhoneBridge';
import { resolveChatScopeId } from '../../weChatScope';
import { pinArchivesToWeChatIfMissing } from '../../weChatPinnedContacts';
import {
  resolveCharacterAvatarFromBrowserOnly,
  setCharacterAvatarOverride,
  usePhoneCharacterAvatarOverrides,
} from '../../phoneCharacterAvatars';
import { fileToAvatarDataUrl } from '../../weChatAvatarFile';

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(128,128,128,0.2)' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[12px]" style={{ color: 'var(--settings-desc)' }}>{label}</span>
        <span className="text-[12px] font-semibold tabular-nums" style={{ color }}>{value}</span>
      </div>
      <ProgressBar value={value} color={color} />
    </div>
  );
}

interface DetailCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function DetailCard({ title, icon, children }: DetailCardProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 transition-colors"
        style={{ borderBottom: open ? '1px solid var(--card-border)' : 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <span className="text-[15px] font-semibold" style={{ color: 'var(--settings-title)' }}>{title}</span>
        <span className="ml-auto" style={{ color: 'var(--settings-desc)' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}

/** 列表/详情共用：点击上传角色头像（与微信同一套 localStorage + 壳同步） */
function ArchiveRoleAvatarButton({
  avatarSrc,
  size,
  onPickClick,
}: {
  avatarSrc: string;
  size: 'list' | 'detail';
  onPickClick: () => void;
}) {
  const dim = size === 'list' ? 'h-12 w-12' : 'h-20 w-20';
  const iconSize = size === 'list' ? 22 : 36;
  const pencilSize = size === 'list' ? 11 : 14;
  return (
    <button
      type="button"
      title="上传或更换角色头像（本机，与微信、规则页一致）"
      className={`relative shrink-0 rounded-full ${dim} flex items-center justify-center text-white overflow-hidden active:opacity-90`}
      style={{
        background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
        boxShadow: '0 0 0 2px rgba(255,255,255,0.2)',
      }}
      onClick={e => {
        e.stopPropagation();
        onPickClick();
      }}
    >
      {avatarSrc ? (
        <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        <User size={iconSize} />
      )}
      <span
        className="pointer-events-none absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55"
        aria-hidden
      >
        <Pencil size={pencilSize} className="text-white" />
      </span>
    </button>
  );
}

function CharacterCard({
  char,
  avatarOverrides,
  onClick,
  onAvatarPick,
}: {
  char: PhoneCharacterArchive;
  avatarOverrides: Record<string, string>;
  onClick: () => void;
  onAvatarPick: (id: string, name: string) => void;
}) {
  const avatarSrc = resolveCharacterAvatarFromBrowserOnly(char.id, avatarOverrides, char.name);
  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
      style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}
      onClick={onClick}
    >
      <ArchiveRoleAvatarButton
        size="list"
        avatarSrc={avatarSrc}
        onPickClick={() => onAvatarPick(char.id, char.name)}
      />
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-semibold truncate" style={{ color: 'var(--settings-title)' }}>{char.name}</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: char.status === '出场中' ? 'rgba(0,200,83,0.15)' : 'rgba(255,145,0,0.15)',
              color: char.status === '出场中' ? '#00c853' : '#ff9100',
            }}
          >
            {char.status}
          </span>
        </div>
        {char.description && (
          <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--settings-desc)' }}>{char.description}</p>
        )}
        <div className="mt-2">
          <ProgressBar value={char.stats.affection} color="#e74c3c" />
        </div>
        <div className="flex gap-3 mt-1">
          <span className="text-[10px]" style={{ color: '#e74c3c' }}>❤ {char.stats.affection}</span>
          <span className="text-[10px]" style={{ color: '#e67e22' }}>欲望 {char.stats.lust}</span>
          <span className="text-[10px]" style={{ color: '#9b59b6' }}>性癖 {char.stats.fetish}</span>
        </div>
      </div>
    </button>
  );
}

export default function TenantArchiveApp({
  onClose,
}: {
  onClose: () => void;
}) {
  const avatarOverrides = usePhoneCharacterAvatarOverrides();
  const [characters, setCharacters] = useState<PhoneCharacterArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedFetish, setExpandedFetish] = useState<string | null>(null);
  const [expandedSensitive, setExpandedSensitive] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoAnalyzeInterval, setAutoAnalyzeInterval] = useState(0); // 0 表示关闭
  const [showSettings, setShowSettings] = useState(false);
  const [intervalInput, setIntervalInput] = useState('20');

  const selected = characters.find(c => c.id === selectedId) ?? null;

  const archiveAvatarPickRef = useRef<{ id: string; name: string } | null>(null);
  const archiveAvatarFileRef = useRef<HTMLInputElement>(null);
  /** 「分析全部」本次新入队的角色 id；队列清空前消费，用于完成后自动钉选到微信 */
  const bulkPinIdsAfterQueueRef = useRef<string[] | null>(null);

  const startArchiveAvatarPick = useCallback((id: string, name: string) => {
    archiveAvatarPickRef.current = { id, name };
    archiveAvatarFileRef.current?.click();
  }, []);

  const onArchiveAvatarFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const pending = archiveAvatarPickRef.current;
    archiveAvatarPickRef.current = null;
    if (!file?.type.startsWith('image/') || !pending) {
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setCharacterAvatarOverride(pending.id, dataUrl, { displayName: pending.name });
      setCharacters(prev =>
        prev.map(c => (c.id === pending.id ? { ...c, avatarUrl: dataUrl } : c)),
      );
    } catch (err) {
      console.warn('[TenantArchiveApp] 头像上传失败', err);
    }
  }, []);

  const archiveAvatarFileInput = (
    <input
      ref={archiveAvatarFileRef}
      type="file"
      accept="image/*"
      className="hidden"
      aria-hidden
      onChange={onArchiveAvatarFileChange}
    />
  );

  // 从 localStorage 读取自动分析间隔
  useEffect(() => {
    const saved = localStorage.getItem('phone_auto_analyze_interval');
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 0) {
        setAutoAnalyzeInterval(num);
        setIntervalInput(String(num));
      }
    }
  }, []);

  // 订阅壳脚本的自动触发事件
  useEffect(() => {
    const unsubscribe = subscribeAutoAnalyzeAll(() => {
      console.info('[TenantArchiveApp] 收到自动触发分析全部角色');
      void handleAnalyzeAll();
    });
    return unsubscribe;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadCharacterArchive();
      setCharacters(data);
    } catch (e) {
      setError('加载角色档案失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 监听分析队列状态变化
  useEffect(() => {
    const scheduler = getAnalysisScheduler();
    const update = (queue: typeof import('../../characterArchive/analysisScheduler').AnalysisTask[]) => {
      const hasActive = queue.some(t => t.status === 'pending' || t.status === 'running');
      const hasError = queue.some(t => t.status === 'error');
      const total = queue.length;
      const done = queue.filter(t => t.status === 'done').length;

      console.log(`[TenantArchive] 队列状态: 总计=${total}, 完成=${done}, 进行中=${hasActive ? '是' : '否'}, 错误=${hasError ? '是' : '否'}`);

      if (!hasActive && total > 0) {
        // 所有任务已完成（或有错误）；此时队列仍为「全 done」快照，随后 scheduler 会清空队列
        console.log('[TenantArchive] 所有分析任务已完成');
        setAnalyzing(false);
        const bulkPinIds = bulkPinIdsAfterQueueRef.current;
        bulkPinIdsAfterQueueRef.current = null;
        void (async () => {
          try {
            const data = await loadCharacterArchive();
            setCharacters(data);
            if (bulkPinIds?.length) {
              let scope = resolveChatScopeId(null);
              try {
                const c = await requestTavernPhoneContext();
                scope = resolveChatScopeId(c.chatScopeId);
              } catch {
                /* 与微信一致：无 CONTEXT 时用 offline scope */
              }
              const toPin = data.filter(a => bulkPinIds.includes(a.id));
              const added = pinArchivesToWeChatIfMissing(scope, toPin);
              if (added > 0) {
                console.info(`[TenantArchive] 分析全部完成，已将 ${added} 位角色加入当前聊天的微信会话列表`);
              }
            }
          } catch (e) {
            console.warn('[TenantArchive] 完成后刷新/钉选微信失败', e);
          }
        })();
      }
    };
    const unsub = scheduler.on(update);
    return unsub;
  }, [load]);

  const handleAnalyze = useCallback(() => {
    if (!selected) return;
    setAnalyzing(true);
    const scheduler = getAnalysisScheduler();
    scheduler.addTask({
      type: 'ANALYZE_CHARACTER',
      priority: 'HIGH',
      characterId: selected.id,
      characterName: selected.name,
    });
  }, [selected]);

  /** 分析角色动态 */
  const handleAnalyzeDynamics = useCallback(() => {
    if (!selected) return;
    setAnalyzing(true);
    const scheduler = getAnalysisScheduler();
    scheduler.addTask({
      type: 'ANALYZE_DYNAMICS',
      priority: 'HIGH',
      characterId: selected.id,
      characterName: selected.name,
    });
  }, [selected]);

  /** 一键分析全部角色 */
  const handleAnalyzeAll = useCallback(() => {
    if (characters.length === 0) return;
    console.log(`[TenantArchive] 开始批量分析 ${characters.length} 个角色`);
    const scheduler = getAnalysisScheduler();

    // 检查队列中是否已有这些角色的任务，避免重复添加
    const existingQueue = scheduler.getQueueStatus();
    const existingIds = new Set(existingQueue.map(t => t.characterId));

    // 只添加尚未在队列中的角色
    let addedCount = 0;
    const newIds: string[] = [];
    for (const char of characters) {
      if (existingIds.has(char.id)) {
        console.log(`[TenantArchive] 跳过已在队列中的角色: ${char.name}`);
        continue;
      }
      console.log(`[TenantArchive] 添加分析任务: ${char.name} (${char.id})`);
      scheduler.addTask({
        type: 'ANALYZE_CHARACTER',
        priority: 'HIGH',
        characterId: char.id,
        characterName: char.name,
      });
      newIds.push(char.id);
      addedCount++;
    }

    if (addedCount === 0) {
      console.log('[TenantArchive] 所有角色都已在分析队列中');
      setAnalyzing(false);
      bulkPinIdsAfterQueueRef.current = null;
    } else {
      setAnalyzing(true);
      bulkPinIdsAfterQueueRef.current = newIds;
      console.log(`[TenantArchive] 已添加 ${addedCount} 个新分析任务到队列`);
    }
  }, [characters]);

  /** 保存自动分析间隔 */
  const handleSaveInterval = useCallback(() => {
    const val = parseInt(intervalInput, 10);
    if (isNaN(val) || val < 0) {
      return;
    }
    setAutoAnalyzeInterval(val);
    localStorage.setItem('phone_auto_analyze_interval', String(val));
    saveAutoAnalyzeInterval(val);
    setShowSettings(false);
  }, [intervalInput]);

  if (loading) {
    return (
      <>
        {archiveAvatarFileInput}
        <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--app-content-bg, #fff)' }}>
          <div className="pt-12 pb-3 px-4 flex items-center gap-2 shrink-0" style={{ backgroundColor: 'var(--app-content-bg, #fff)' }}>
            <button type="button" onClick={onClose} className="p-1 -ml-1" style={{ color: 'var(--accent)' }}>
              <ChevronLeft size={28} />
            </button>
            <span className="font-medium text-lg" style={{ color: 'var(--accent)' }}>角色档案</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
              <p className="text-[14px]" style={{ color: 'var(--settings-desc)' }}>加载中...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {archiveAvatarFileInput}
        <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--app-content-bg, #fff)' }}>
          <div className="pt-12 pb-3 px-4 flex items-center gap-2 shrink-0" style={{ backgroundColor: 'var(--app-content-bg, #fff)' }}>
            <button type="button" onClick={onClose} className="p-1 -ml-1" style={{ color: 'var(--accent)' }}>
              <ChevronLeft size={28} />
            </button>
            <span className="font-medium text-lg" style={{ color: 'var(--accent)' }}>角色档案</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <AlertCircle size={40} style={{ color: '#e74c3c' }} />
              <p className="text-[14px]" style={{ color: 'var(--settings-desc)' }}>{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="px-6 py-2 rounded-full text-[14px] font-semibold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                重试
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (selected) {
    const detailAvatarSrc = resolveCharacterAvatarFromBrowserOnly(
      selected.id,
      avatarOverrides,
      selected.name,
    );
    return (
      <>
        {archiveAvatarFileInput}
        <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--app-content-bg, #fff)' }}>
          {/* Header */}
          <div className="pt-12 pb-3 px-4 flex items-center gap-2 shrink-0 z-10" style={{ backgroundColor: 'var(--app-content-bg, #fff)' }}>
            <button type="button" onClick={() => setSelectedId(null)} className="p-1 -ml-1" style={{ color: 'var(--accent)' }}>
              <ChevronLeft size={28} />
            </button>
            <span className="font-medium text-lg truncate" style={{ color: 'var(--accent)' }}>{selected.name}</span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0 space-y-3">
            {/* 基本信息卡片 */}
            <DetailCard title="基本信息" icon={<User size={18} />}>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div className="col-span-2 flex flex-col items-center pb-2 gap-1">
                  <ArchiveRoleAvatarButton
                    size="detail"
                    avatarSrc={detailAvatarSrc}
                    onPickClick={() => startArchiveAvatarPick(selected.id, selected.name)}
                  />
                  <p className="text-[11px]" style={{ color: 'var(--settings-desc)' }}>
                    角色头像 · 点击更换（与微信共用）
                  </p>
                </div>
              <div>
                <span style={{ color: 'var(--settings-desc)' }}>年龄</span>
                <p style={{ color: 'var(--settings-title)' }}>{selected.body.age}岁</p>
              </div>
              <div>
                <span style={{ color: 'var(--settings-desc)' }}>身高/体重</span>
                <p style={{ color: 'var(--settings-title)' }}>{selected.body.height}cm / {selected.body.weight}kg</p>
              </div>
              <div>
                <span style={{ color: 'var(--settings-desc)' }}>三围</span>
                <p style={{ color: 'var(--settings-title)' }}>{selected.body.threeSize}</p>
              </div>
              <div>
                <span style={{ color: 'var(--settings-desc)' }}>体质</span>
                <p style={{ color: 'var(--settings-title)' }}>{selected.body.physique}</p>
              </div>
            </div>
            {selected.description && (
              <p className="mt-3 text-[13px]" style={{ color: 'var(--settings-desc)' }}>
                {selected.description}
              </p>
            )}
          </DetailCard>

          {/* 数值状态 */}
          <DetailCard title="数值状态" icon={<Heart size={18} />}>
            <div className="space-y-3">
              <StatBar label="好感度" value={selected.stats.affection} color="#e74c3c" />
              <StatBar label="发情值" value={selected.stats.lust} color="#e67e22" />
              <StatBar label="性癖开发值" value={selected.stats.fetish} color="#9b59b6" />
            </div>
          </DetailCard>

          {/* 心理状态 */}
          <DetailCard title="心理状态" icon={<Brain size={18} />}>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--settings-title)' }}>
              {selected.currentThought || '（暂无内心想法）'}
            </p>
            {Object.keys(selected.personality).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.entries(selected.personality).map(([k, v]) => (
                  <span
                    key={k}
                    className="text-[11px] px-2 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: 0.9 }}
                  >
                    {k}：{typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')}
                  </span>
                ))}
              </div>
            )}
          </DetailCard>

          {/* 性癖 */}
          {Object.keys(selected.fetishes).length > 0 && (
            <DetailCard title="性癖" icon={<Sparkles size={18} />}>
              <div className="space-y-2">
                {Object.entries(selected.fetishes).map(([name, fetish]) => (
                  <div key={name}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between py-1"
                      onClick={() => setExpandedFetish(expandedFetish === name ? null : name)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium" style={{ color: 'var(--settings-title)' }}>{name}</span>
                        <span className="text-[11px] px-1.5 rounded-full" style={{ backgroundColor: 'rgba(155,89,182,0.15)', color: '#9b59b6' }}>
                          Lv.{fetish.level}
                        </span>
                      </div>
                      {expandedFetish === name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedFetish === name && (
                      <div className="pl-4 pb-2 text-[12px] space-y-1">
                        {fetish.description && (
                          <p style={{ color: 'var(--settings-desc)' }}>细节：{fetish.description}</p>
                        )}
                        {fetish.justification && (
                          <p style={{ color: 'var(--settings-desc)' }}>自我合理化：{fetish.justification}</p>
                        )}
                      </div>
                    )}
                    <div className="mt-1">
                      <ProgressBar value={(fetish.level / 10) * 100} color="#9b59b6" />
                    </div>
                  </div>
                ))}
              </div>
            </DetailCard>
          )}

          {/* 敏感部位 */}
          {Object.keys(selected.sensitiveParts).length > 0 && (
            <DetailCard title="敏感部位" icon={<Sparkles size={18} />}>
              <div className="space-y-2">
                {Object.entries(selected.sensitiveParts).map(([name, part]) => (
                  <div key={name}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between py-1"
                      onClick={() => setExpandedSensitive(expandedSensitive === name ? null : name)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium" style={{ color: 'var(--settings-title)' }}>{name}</span>
                        <span className="text-[11px] px-1.5 rounded-full" style={{ backgroundColor: 'rgba(230,126,34,0.15)', color: '#e67e22' }}>
                          敏感 Lv.{part.level}
                        </span>
                      </div>
                      {expandedSensitive === name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedSensitive === name && (
                      <div className="pl-4 pb-2 text-[12px] space-y-1">
                        {part.reaction && (
                          <p style={{ color: 'var(--settings-desc)' }}>反应：{part.reaction}</p>
                        )}
                        {part.devDetails && (
                          <p style={{ color: 'var(--settings-desc)' }}>开发：{part.devDetails}</p>
                        )}
                      </div>
                    )}
                    <div className="mt-1">
                      <ProgressBar value={(part.level / 10) * 100} color="#e67e22" />
                    </div>
                  </div>
                ))}
              </div>
            </DetailCard>
          )}

          {/* 身份标签 */}
          {Object.keys(selected.identityTags).length > 0 && (
            <DetailCard title="身份标签" icon={<User size={18} />}>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selected.identityTags).map(([k, v]) => (
                  <span
                    key={k}
                    className="text-[12px] px-3 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: 0.85 }}
                  >
                    {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v || k)}
                  </span>
                ))}
              </div>
            </DetailCard>
          )}

          {/* 分析按钮 */}
          <button
            type="button"
            disabled={analyzing}
            onClick={() => void handleAnalyze()}
            className="w-full py-3 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
              boxShadow: '0 4px 15px rgba(108,92,231,0.3)',
            }}
          >
            {analyzing ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Sparkles size={18} />
            )}
            {analyzing ? '分析中...' : '触发角色分析'}
          </button>

          {/* 角色动态分析按钮 */}
          <button
            type="button"
            disabled={analyzing}
            onClick={() => void handleAnalyzeDynamics()}
            className="w-full py-3 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #00c853, #00a344)',
              boxShadow: '0 4px 15px rgba(0,200,83,0.3)',
            }}
          >
            {analyzing ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Brain size={18} />
            )}
            {analyzing ? '分析中...' : '分析角色动态'}
          </button>
        </div>
      </div>
      </>
    );
  }

  // List view
  return (
    <>
      {archiveAvatarFileInput}
      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--app-content-bg, #fff)' }}>
      <div className="pt-12 pb-3 px-4 flex items-center gap-2 shrink-0" style={{ backgroundColor: 'var(--app-content-bg, #fff)' }}>
        <button type="button" onClick={onClose} className="p-1 -ml-1" style={{ color: 'var(--accent)' }}>
          <ChevronLeft size={28} />
        </button>
        <span className="font-medium text-lg" style={{ color: 'var(--accent)' }}>角色档案</span>
        <button
          type="button"
          onClick={() => setShowSettings(v => !v)}
          className="ml-auto p-1"
          style={{ color: 'var(--settings-desc)' }}
        >
          <Settings2 size={22} />
        </button>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="px-4 pb-3 shrink-0">
          <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-[14px] font-medium" style={{ color: 'var(--settings-title)' }}>自动分析设置</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px]" style={{ color: 'var(--settings-desc)' }}>每</span>
              <input
                type="number"
                min="1"
                max="999"
                value={intervalInput}
                onChange={e => setIntervalInput(e.target.value)}
                className="w-16 px-2 py-1 rounded-lg text-[14px] text-center"
                style={{
                  backgroundColor: 'var(--app-content-bg)',
                  color: 'var(--settings-title)',
                  border: '1px solid var(--card-border)',
                }}
              />
              <span className="text-[13px]" style={{ color: 'var(--settings-desc)' }}>楼自动分析全部角色</span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--settings-desc)' }}>
              设为 0 或留空则关闭自动分析
            </p>
            <button
              type="button"
              onClick={() => void handleSaveInterval()}
              className="w-full py-2 rounded-xl text-[14px] font-medium text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              保存设置
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pb-2 shrink-0">
        <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--settings-title, #000)' }}>角色档案</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--settings-desc)' }}>
          {characters.length > 0 ? `${characters.length} 个角色` : '暂无角色，请先开始游戏'}
          {autoAnalyzeInterval > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: 'var(--accent)' }}>
              每 {autoAnalyzeInterval} 楼自动分析
            </span>
          )}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0 space-y-3">
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--card-bg)' }}
            >
              <User size={40} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-[15px] font-medium" style={{ color: 'var(--settings-title)' }}>暂无角色</p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--settings-desc)' }}>请先在规则 App 中创建角色</p>
            </div>
          </div>
        ) : (
          <>
            {characters.map(char => (
              <CharacterCard
                key={char.id}
                char={char}
                avatarOverrides={avatarOverrides}
                onClick={() => setSelectedId(char.id)}
                onAvatarPick={startArchiveAvatarPick}
              />
            ))}
            {/* 一键分析全部角色按钮 */}
            <button
              type="button"
              disabled={analyzing}
              onClick={() => void handleAnalyzeAll()}
              className="w-full py-3 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                boxShadow: '0 4px 15px rgba(108,92,231,0.3)',
              }}
            >
              {analyzing ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              {analyzing ? '分析全部角色中...' : `分析全部角色 (${characters.length})`}
            </button>
          </>
        )}
      </div>
    </div>
    </>
  );
}
