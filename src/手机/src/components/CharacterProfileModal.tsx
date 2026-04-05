/**
 * 角色详情弹窗组件
 * 点击任何角色头像时弹出，显示角色档案和快速入口
 * - 朋友圈入口：点击查看该角色的朋友圈
 * - 发消息入口：点击打开微信私聊
 */

import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Camera, User, Heart, Hash, Sparkles } from 'lucide-react';
import { loadCharacterArchive, type PhoneCharacterArchive } from '../characterArchive/bridge';
import { getRelationshipBetween, extractRelationshipsFromArchive } from '../relationshipValidator';

interface CharacterProfileModalProps {
  isOpen: boolean;
  characterId: string | null;
  currentViewerId?: string | null; // 当前查看者ID（用于判断关系）
  onClose: () => void;
  onViewMoments: (characterId: string) => void; // 查看朋友圈
  onSendMessage: (characterId: string) => void; // 发消息（打开微信）
}

export default function CharacterProfileModal({
  isOpen,
  characterId,
  currentViewerId,
  onClose,
  onViewMoments,
  onSendMessage,
}: CharacterProfileModalProps) {
  const [character, setCharacter] = useState<PhoneCharacterArchive | null>(null);
  const [allCharacters, setAllCharacters] = useState<PhoneCharacterArchive[]>([]);
  const [loading, setLoading] = useState(false);
  const [relationship, setRelationship] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !characterId) {
      setCharacter(null);
      return;
    }

    setLoading(true);
    loadCharacterArchive().then(characters => {
      setAllCharacters(characters);
      const found = characters.find(c => c.id === characterId);
      setCharacter(found || null);

      if (found && currentViewerId) {
        const viewer = characters.find(c => c.id === currentViewerId);
        if (viewer) {
          const rel = getRelationshipBetween(viewer, found);
          setRelationship(rel);
        }
      }

      setLoading(false);
    });
  }, [isOpen, characterId, currentViewerId]);

  if (!isOpen || !characterId) return null;

  // 解析身份标签
  const identityTags = character?.identityTags || {};
  const relationships = extractRelationshipsFromArchive(character || {
    id: '',
    name: '',
    status: '暂时退场',
    description: '',
    body: { age: 0, height: 0, weight: 0, threeSize: '', physique: '' },
    stats: { affection: 0, lust: 0, fetish: 0 },
    currentThought: '',
    personality: {},
    fetishes: {},
    sensitiveParts: {},
    identityTags: {},
    currentPhysiologicalDescription: '',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">角色资料</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-3" />
              加载中...
            </div>
          ) : !character ? (
            <div className="p-8 text-center text-gray-400">
              <User size={48} className="mx-auto mb-3 opacity-50" />
              未找到角色信息
            </div>
          ) : (
            <div className="pb-6">
              {/* 角色基本信息 */}
              <div className="bg-gradient-to-br from-blue-400 to-purple-500 h-32" />

              <div className="px-5 -mt-12 mb-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-xl bg-white p-1 shadow-lg">
                    <div className="w-full h-full rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 text-2xl font-bold">
                      {character.name[0]}
                    </div>
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${
                    character.status === '出场中' ? 'bg-green-500' : 'bg-gray-400'
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>

                <div className="mt-3">
                  <h2 className="text-2xl font-bold text-gray-900">{character.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-sm px-2 py-0.5 rounded-full ${
                      character.status === '出场中'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {character.status}
                    </span>
                    {relationship && (
                      <span className="text-sm px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        关系: {relationship}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-gray-600 mt-3 text-sm leading-relaxed">
                  {character.description}
                </p>

                {/* 当前内心想法 */}
                {character.currentThought && (
                  <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center gap-1.5 text-purple-600 text-xs font-medium mb-1">
                      <Sparkles size={12} />
                      当前内心想法
                    </div>
                    <p className="text-sm text-purple-800 italic">{character.currentThought}</p>
                  </div>
                )}
              </div>

              {/* 基础信息 */}
              <div className="px-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-semibold text-gray-900">{character.body.age}</p>
                    <p className="text-xs text-gray-500">岁</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-semibold text-gray-900">{character.body.height}</p>
                    <p className="text-xs text-gray-500">cm</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-semibold text-gray-900">{character.body.weight}</p>
                    <p className="text-xs text-gray-500">kg</p>
                  </div>
                </div>

                {/* 数值状态 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">当前状态</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-12">好感度</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pink-400 rounded-full transition-all"
                          style={{ width: `${character.stats.affection}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">{character.stats.affection}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-12">发情值</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full transition-all"
                          style={{ width: `${character.stats.lust}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">{character.stats.lust}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-12">开发值</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-400 rounded-full transition-all"
                          style={{ width: `${character.stats.fetish}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">{character.stats.fetish}</span>
                    </div>
                  </div>
                </div>

                {/* 身份标签 */}
                {Object.keys(identityTags).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">身份标签</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(identityTags).map(([key, value]) => (
                        <span
                          key={key}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1"
                        >
                          <Hash size={10} />
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 性格特点 */}
                {Object.keys(character.personality).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">性格特点</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(character.personality).slice(0, 5).map(([key, value]) => (
                        <span
                          key={key}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full"
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 快速入口按钮 */}
              <div className="px-5 mt-6 space-y-3">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">快速入口</p>

                <div className="grid grid-cols-2 gap-3">
                  {/* 朋友圈入口 */}
                  <button
                    onClick={() => characterId && onViewMoments(characterId)}
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    <Camera size={24} />
                    <div className="text-left">
                      <p className="font-semibold">查看朋友圈</p>
                      <p className="text-xs text-white/80">浏览TA的动态</p>
                    </div>
                  </button>

                  {/* 发消息入口 */}
                  <button
                    onClick={() => characterId && onSendMessage(characterId)}
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    <MessageCircle size={24} />
                    <div className="text-left">
                      <p className="font-semibold">发送消息</p>
                      <p className="text-xs text-white/80">打开私聊窗口</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 关系网络（可选） */}
              {relationships.length > 0 && (
                <div className="px-5 mt-6">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">关系网络</p>
                  <div className="space-y-2">
                    {relationships.slice(0, 5).map((rel, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <Heart size={14} className="text-pink-400" />
                        <span>{rel.type}</span>
                        {rel.details && (
                          <span className="text-gray-400">· {rel.details}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
