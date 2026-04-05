import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, MessageSquare, Eye, ThumbsUp, Send, Loader2, Plus, User, AtSign, Crown, Ghost } from 'lucide-react';
import type { ForumPost, ForumComment, ForumTag, ForumIdentityType } from '../../types/forum';
import {
  getCommentsByPostId,
  addForumComment,
  togglePostLike,
  toggleCommentLike,
  incrementPostViews,
} from '../../forumIndexedDb';
import {
  generateForumComment,
  generateRandomUserComment,
  getRandomLanguageStyle,
  type LanguageStyle,
} from '../../forumGenerator';
import { loadCharacterArchive } from '../../characterArchive/bridge';

interface ForumPostDetailProps {
  post: ForumPost;
  onBack: () => void;
}

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
  anonymous: <Ghost size={14} className="text-gray-500" />,
  username: <User size={14} className="text-blue-500" />,
  real_name: <AtSign size={14} className="text-green-500" />,
  role_title: <Crown size={14} className="text-purple-500" />,
};

const IDENTITY_LABELS: Record<ForumIdentityType, string> = {
  anonymous: '匿名',
  username: '网名',
  real_name: '真名',
  role_title: '身份',
};

const IDENTITY_TOOLTIPS: Record<ForumIdentityType, string> = {
  anonymous: '用户选择匿名发帖',
  username: '用户使用特征网名发帖',
  real_name: '用户使用真实姓名发帖',
  role_title: '用户使用身份头衔发帖',
};

/** 格式化时间 */
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

export default function ForumPostDetail({ post: initialPost, onBack }: ForumPostDetailProps) {
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingComments, setIsGeneratingComments] = useState(false);
  const [replyTo, setReplyTo] = useState<ForumComment | null>(null);
  const [showIdentityTooltip, setShowIdentityTooltip] = useState(false);

  // 加载评论
  useEffect(() => {
    loadComments();
    incrementViews();
  }, []);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const data = await getCommentsByPostId(post.id);
      setComments(data);
    } catch (e) {
      console.error('[ForumPostDetail] 加载评论失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const incrementViews = async () => {
    try {
      await incrementPostViews(post.id);
      setPost(prev => ({ ...prev, views: prev.views + 1 }));
    } catch (e) {
      console.error('[ForumPostDetail] 增加浏览数失败:', e);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 这里使用一个默认的匿名身份提交评论
      // 实际应用中可能需要一个选择身份的UI
      const comment = await addForumComment({
        postId: post.id,
        authorName: '匿名用户',
        identityType: 'anonymous',
        content: newComment.trim(),
        gameDate: post.gameDate,
        replyTo: replyTo
          ? {
              commentId: replyTo.id,
              authorName: replyTo.authorName,
            }
          : undefined,
      });

      setComments(prev => [...prev, comment]);
      setNewComment('');
      setReplyTo(null);
      setPost(prev => ({ ...prev, comments: prev.comments + 1 }));
    } catch (e) {
      console.error('[ForumPostDetail] 提交评论失败:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    try {
      const newLiked = await togglePostLike(post.id);
      setPost(prev => ({
        ...prev,
        isLiked: newLiked,
        likes: newLiked ? prev.likes + 1 : Math.max(0, prev.likes - 1),
      }));
    } catch (e) {
      console.error('[ForumPostDetail] 点赞失败:', e);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    try {
      const newLiked = await toggleCommentLike(commentId);
      setComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? {
                ...c,
                isLiked: newLiked,
                likes: newLiked ? c.likes + 1 : Math.max(0, c.likes - 1),
              }
            : c,
        ),
      );
    } catch (e) {
      console.error('[ForumPostDetail] 评论点赞失败:', e);
    }
  };

  const handleReplyClick = (comment: ForumComment) => {
    setReplyTo(comment);
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  // 生成AI评论（混合角色 + 随机网友）
  const handleGenerateComments = async () => {
    try {
      setIsGeneratingComments(true);
      const chars = await loadCharacterArchive();
      const activeChars = chars.filter(c => c.status === '出场中').map(c => c.id);

      // 生成策略：1-2个角色评论 + 2-3个随机网友评论
      const charCount = Math.min(2, activeChars.length);
      const randomUserCount = 2 + Math.floor(Math.random() * 2); // 2-3个

      // 角色评论
      if (activeChars.length > 0) {
        const shuffledChars = activeChars.sort(() => 0.5 - Math.random()).slice(0, charCount);

        for (const charId of shuffledChars) {
          const char = chars.find(c => c.id === charId);
          if (!char) continue;

          const style = getRandomLanguageStyle();
          const replyToComment =
            comments.length > 0 && Math.random() > 0.7
              ? comments[Math.floor(Math.random() * comments.length)]
              : undefined;

          const commentData = await generateForumComment(
            {
              post,
              characterId: charId,
              characterName: char.name,
              gameDate: post.gameDate,
              replyTo: replyToComment,
            },
            style,
          );

          if (commentData) {
            const comment = await addForumComment(commentData);
            setComments(prev => [...prev, comment]);
            setPost(prev => ({ ...prev, comments: prev.comments + 1 }));
          }
        }
      }

      // 随机网友评论
      for (let i = 0; i < randomUserCount; i++) {
        try {
          const style = getRandomLanguageStyle();
          const commentData = await generateRandomUserComment(post, post.gameDate, style);
          const comment = await addForumComment(commentData);
          setComments(prev => [...prev, comment]);
          setPost(prev => ({ ...prev, comments: prev.comments + 1 }));
        } catch (e) {
          console.warn('[ForumPostDetail] 生成随机评论失败:', e);
        }
      }
    } catch (e) {
      console.error('[ForumPostDetail] 生成评论失败:', e);
      alert('生成评论失败，请检查API设置');
    } finally {
      setIsGeneratingComments(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white pt-12 pb-3 px-4 flex items-center sticky top-0 z-10 border-b border-gray-200">
        <button onClick={onBack} className="p-1 -ml-1 text-[#007AFF] hover:text-blue-600 transition-colors">
          <ChevronLeft size={28} />
        </button>
        <span className="text-gray-900 font-semibold text-lg ml-2">帖子详情</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Post Content */}
        <div className="bg-white p-4 mb-2">
          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-12 h-12 rounded-full ${getAvatarColor(post.authorName)} flex items-center justify-center text-white text-lg font-bold`}
            >
              {getInitial(post.authorName)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{post.authorName}</span>
                <div
                  className="relative"
                  onMouseEnter={() => setShowIdentityTooltip(true)}
                  onMouseLeave={() => setShowIdentityTooltip(false)}
                >
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600 cursor-help">
                    {IDENTITY_ICONS[post.identityType]}
                    <span>{IDENTITY_LABELS[post.identityType]}</span>
                  </div>
                  {showIdentityTooltip && (
                    <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10">
                      {IDENTITY_TOOLTIPS[post.identityType]}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400">
                {formatTimeAgo(post.createdAt)} · {post.gameDate}
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{post.title}</h1>

          {/* Tags */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {post.tags.map(tag => (
              <span key={tag} className={`px-2 py-0.5 rounded text-xs ${TAG_COLORS[tag]}`}>
                {tag}
              </span>
            ))}
          </div>

          {/* Content */}
          <div className="text-gray-800 leading-relaxed whitespace-pre-wrap mb-4">{post.content}</div>

          {/* Stats & Actions */}
          <div className="flex items-center gap-6 text-sm text-gray-500 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-1">
              <Eye size={18} />
              <span>{post.views || 0}</span>
            </div>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 ${post.isLiked ? 'text-[#007AFF]' : 'hover:text-[#007AFF]'}`}
            >
              <ThumbsUp size={18} className={post.isLiked ? 'fill-current' : ''} />
              <span>{post.likes || 0}</span>
            </button>
            <div className="flex items-center gap-1">
              <MessageSquare size={18} />
              <span>{post.comments || 0}</span>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">评论 ({comments.length})</h3>
            <button
              onClick={handleGenerateComments}
              disabled={isGeneratingComments}
              className="flex items-center gap-1 text-xs text-[#007AFF] hover:bg-blue-50 px-2 py-1 rounded"
            >
              {isGeneratingComments ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              生成AI评论
            </button>
          </div>

          {/* AI Generating Indicator */}
          {isGeneratingComments && (
            <div className="px-4 py-3 flex items-center gap-2 text-gray-500 border-b border-gray-100">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">AI 正在回复...</span>
            </div>
          )}

          {/* Comments List */}
          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                <span className="text-sm">加载中...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                暂无评论，快来抢沙发吧！
              </div>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-full ${getAvatarColor(comment.authorName)} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                    >
                      {getInitial(comment.authorName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900">{comment.authorName}</span>
                        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-gray-50 rounded text-xs text-gray-500">
                          {IDENTITY_ICONS[comment.identityType]}
                        </div>
                        {comment.time && <span className="text-xs text-gray-400">{formatTimeAgo(comment.createdAt)}</span>}
                      </div>

                      {/* Reply Indicator */}
                      {comment.replyTo && (
                        <div className="text-xs text-gray-500 mb-1 bg-gray-50 px-2 py-1 rounded">
                          回复 <span className="text-[#007AFF]">{comment.replyTo.authorName}</span>
                        </div>
                      )}

                      <p className="text-gray-800 text-sm mb-2">{comment.content}</p>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleReplyClick(comment)}
                          className="text-xs text-gray-400 hover:text-[#007AFF] transition-colors"
                        >
                          回复
                        </button>
                        <button
                          onClick={() => handleCommentLike(comment.id)}
                          className={`flex items-center gap-1 text-xs ${
                            comment.isLiked ? 'text-[#007AFF]' : 'text-gray-400 hover:text-[#007AFF]'
                          }`}
                        >
                          <ThumbsUp size={12} className={comment.isLiked ? 'fill-current' : ''} />
                          <span>{comment.likes || 0}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Comment Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 px-3 py-1.5 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-600">
              回复 <span className="font-medium">{replyTo.authorName}</span>
            </span>
            <button onClick={cancelReply} className="text-xs text-gray-400 hover:text-gray-600">
              取消
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={replyTo ? `回复 ${replyTo.authorName}...` : '写下你的评论...'}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
            className="p-2.5 bg-[#007AFF] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
