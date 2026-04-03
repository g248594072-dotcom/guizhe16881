import React, { useState } from 'react';
import { ChevronLeft, Send, Loader2, Image as ImageIcon, X } from 'lucide-react';

interface MomentsNewPostProps {
  userName: string;
  userAvatar?: string;
  onClose: () => void;
  onSubmit: (content: string, imageDesc: string | null) => Promise<void>;
  isSubmitting: boolean;
}

export default function MomentsNewPost({ userName, userAvatar, onClose, onSubmit, isSubmitting }: MomentsNewPostProps) {
  const [content, setContent] = useState('');
  const [imageDesc, setImageDesc] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('请输入内容');
      return;
    }

    setError('');
    try {
      await onSubmit(content.trim(), showImageInput && imageDesc.trim() ? imageDesc.trim() : null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败');
    }
  };

  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-[#EDEDED]">
      {/* Header */}
      <div className="bg-[#EDEDED] pt-12 pb-3 px-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
          <span className="text-gray-900 font-semibold text-lg">发布动态</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !content.trim()}
          className="flex items-center gap-1 bg-[#07C160] text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
        >
          {isSubmitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          发布
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* User Info */}
        <div className="flex items-center gap-3 mb-4">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
              {getInitials(userName)}
            </div>
          )}
          <span className="font-medium text-gray-900">{userName}</span>
        </div>

        {/* Content Input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="分享新鲜事..."
          className="w-full bg-transparent border-none outline-none text-[17px] text-gray-900 resize-none min-h-[150px] placeholder-gray-400"
          maxLength={500}
          autoFocus
        />

        {/* Character count */}
        <div className="text-right text-sm text-gray-400 mb-4">
          {content.length}/500
        </div>

        {/* Image Description */}
        {showImageInput ? (
          <div className="bg-white rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-gray-600">
                <ImageIcon size={18} />
                <span className="text-sm font-medium">图片描述（AI生成）</span>
              </div>
              <button
                onClick={() => setShowImageInput(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={imageDesc}
              onChange={(e) => setImageDesc(e.target.value)}
              placeholder="描述你想要的配图，AI会根据描述生成图片..."
              className="w-full bg-gray-50 rounded-lg p-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-green-300 resize-none"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-gray-400 mt-1">
              {imageDesc.length}/200 · 描述越详细，生成的图片越符合预期
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowImageInput(true)}
            className="flex items-center gap-2 text-[#07C160] text-sm font-medium mb-4"
          >
            <ImageIcon size={18} />
            添加图片描述
          </button>
        )}

        {/* Tips */}
        <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700">
          <p className="font-medium mb-1">💡 发布提示</p>
          <ul className="text-green-600 space-y-1 list-disc list-inside">
            <li>分享你的生活点滴、心情感悟</li>
            <li>添加图片描述，AI会自动生成配图</li>
            <li>发布后，AI角色会为你点赞评论</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
