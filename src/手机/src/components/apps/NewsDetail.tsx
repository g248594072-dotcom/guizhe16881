import React from 'react';
import { ChevronLeft, Eye, Calendar, ThumbsUp, MessageCircle, Share, Bookmark } from 'lucide-react';
import type { NewsArticle } from '../../aiService';

interface NewsDetailProps {
  article: NewsArticle;
  onBack: () => void;
}

export default function NewsDetail({ article, onBack }: NewsDetailProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-white pt-12 pb-3 px-4 flex items-center sticky top-0 z-10 border-b border-gray-100">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-[#FF2D55] hover:text-red-600 transition-colors"
        >
          <ChevronLeft size={28} />
        </button>
        <span className="text-gray-900 font-semibold text-lg ml-2">新闻详情</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Article Header */}
        <div className="px-4 py-4">
          <span className="inline-block px-2 py-1 bg-red-100 text-[#FF2D55] text-xs font-bold rounded mb-3">
            {article.source}
          </span>

          <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-4">
            {article.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>{article.publishDate}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye size={14} />
              <span>{article.views?.toLocaleString() || 0} 阅读</span>
            </div>
          </div>
        </div>

        {/* Featured Image Placeholder */}
        <div className="mx-4 mb-6">
          <div className="bg-linear-to-br from-gray-100 to-gray-200 rounded-xl aspect-video flex items-center justify-center">
            <span className="text-gray-400 text-sm">📰 新闻配图</span>
          </div>
        </div>

        {/* Article Content */}
        <div className="px-4 pb-6">
          <p className="text-gray-800 leading-relaxed text-lg whitespace-pre-wrap mb-6">
            {article.content}
          </p>

          {/* Key Data */}
          {article.keyData && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-2">关键数据</h4>
              <p className="text-blue-700 text-sm">{article.keyData}</p>
            </div>
          )}
        </div>

        {/* Engagement Stats */}
        <div className="border-t border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <ThumbsUp size={16} />
                {article.likes || 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle size={16} />
                {article.comments || 0}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-400 hover:text-[#FF2D55] transition-colors">
                <Bookmark size={20} />
              </button>
              <button className="p-2 text-gray-400 hover:text-[#FF2D55] transition-colors">
                <Share size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}
