import React, { useState, useCallback } from 'react';
import { ChevronLeft, MessageSquare, Eye, ThumbsUp, Send, Loader2 } from 'lucide-react';
import type { ForumPostDetail as ForumPostDetailType, ForumComment } from '../../aiService';

interface ForumPostDetailProps {
  post: ForumPostDetailType;
  onBack: () => void;
  onComment: (comment: string, replyTo?: { name: string; time?: string }) => Promise<void>;
  isGenerating: boolean;
}

export default function ForumPostDetail({ post, onBack, onComment, isGenerating }: ForumPostDetailProps) {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ name: string; time?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onComment(newComment.trim(), replyTo || undefined);
      setNewComment('');
      setReplyTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyClick = (comment: ForumComment) => {
    setReplyTo({ name: comment.name, time: comment.time });
    // Focus the input
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white pt-12 pb-3 px-4 flex items-center sticky top-0 z-10 border-b border-gray-200">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-[#007AFF] hover:text-blue-600 transition-colors"
        >
          <ChevronLeft size={28} />
        </button>
        <span className="text-gray-900 font-semibold text-lg ml-2">帖子详情</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Post Content */}
        <div className="bg-white p-4 mb-2">
          <h1 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{post.title}</h1>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span className="font-medium text-[#007AFF]">{post.author}</span>
            <span>{post.date || ''} {post.time || ''}</span>
          </div>

          <div className="text-gray-800 leading-relaxed whitespace-pre-wrap mb-4">
            {post.content}
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Eye size={16} />
              <span>{post.views || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare size={16} />
              <span>{post.commentCount || post.comments?.length || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsUp size={16} />
              <span>{(post as unknown as { likes?: number }).likes || 0}</span>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              评论 ({post.comments?.length || 0})
            </h3>
          </div>

          {isGenerating && (
            <div className="px-4 py-3 flex items-center gap-2 text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">AI 正在回复...</span>
            </div>
          )}

          {post.comments?.map((comment, index) => (
            <div key={index} className="px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
                  {comment.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-[#007AFF]">{comment.name}</span>
                    {comment.time && (
                      <span className="text-xs text-gray-400">{comment.time}</span>
                    )}
                  </div>

                  {comment.reply && (
                    <div className="text-xs text-gray-500 mb-1">
                      回复 <span className="text-[#007AFF]">{comment.reply.name}</span>
                      {comment.reply.time && ` (${comment.reply.time})`}
                    </div>
                  )}

                  <p className="text-gray-800 text-sm">{comment.c}</p>

                  <button
                    onClick={() => handleReplyClick(comment)}
                    className="text-xs text-gray-400 mt-2 hover:text-[#007AFF] transition-colors"
                  >
                    回复
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(!post.comments || post.comments.length === 0) && !isGenerating && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              暂无评论，快来抢沙发吧！
            </div>
          )}
        </div>
      </div>

      {/* Comment Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 px-3 py-1.5 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-600">
              回复 <span className="font-medium">{replyTo.name}</span>
            </span>
            <button
              onClick={cancelReply}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              取消
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyTo ? `回复 ${replyTo.name}...` : "写下你的评论..."}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="p-2 bg-[#007AFF] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
