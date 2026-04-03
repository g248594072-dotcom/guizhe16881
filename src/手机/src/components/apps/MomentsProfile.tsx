import React from 'react';
import { ChevronLeft, Heart, MessageCircle, UserPlus, Users } from 'lucide-react';
import type { DynamicHomeData, DynamicPost } from '../../aiService';
import { resolveCharacterAvatarFromBrowserOnly } from '../../phoneCharacterAvatars';

interface MomentsProfileProps {
  profile: DynamicHomeData;
  onBack: () => void;
  onPostClick: (post: DynamicPost) => void;
}

export default function MomentsProfile({ profile, onBack, onPostClick }: MomentsProfileProps) {
  const avatar = resolveCharacterAvatarFromBrowserOnly(profile.name, {});

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-[#EDEDED]">
      {/* Header */}
      <div className="bg-[#EDEDED] pt-12 pb-3 px-4 flex items-center sticky top-0 z-20">
        <button
          onClick={onBack}
          className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft size={28} />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-[17px] font-semibold text-gray-900">{profile.name}</h1>
        </div>
        <div className="w-8" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Cover & Profile */}
        <div className="relative h-[280px] mb-16">
          {/* Cover Image */}
          <div className="absolute inset-0 bg-linear-to-b from-blue-400 via-purple-400 to-pink-400">
            <div className="absolute inset-0 bg-black/10" />
          </div>

          {/* Profile Info */}
          <div className="absolute -bottom-12 left-4 right-4 flex items-end justify-between">
            <div className="flex items-end gap-4">
              {/* Avatar */}
              <div className="relative">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={profile.name}
                    className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg object-cover bg-white"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
                    {getInitials(profile.name)}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="mb-2">
                <h2 className="text-xl font-bold text-white drop-shadow-md">{profile.name}</h2>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white mx-4 rounded-xl p-4 mb-3 shadow-sm">
          <p className="text-gray-600 text-sm mb-3">{profile.signature || '这个人很懒，什么都没有写~'}</p>
          <div className="flex items-center justify-around border-t border-gray-100 pt-3">
            <div className="text-center">
              <div className="font-bold text-gray-900">{profile.following || 0}</div>
              <div className="text-xs text-gray-500">关注</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">{profile.followers || 0}</div>
              <div className="text-xs text-gray-500">粉丝</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">{profile.likes || 0}</div>
              <div className="text-xs text-gray-500">获赞</div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="bg-white mx-4 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">动态</h3>
          </div>

          {profile.posts?.map((post, index) => (
            <div
              key={index}
              onClick={() => onPostClick(post)}
              className="px-4 py-4 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex gap-3">
                {/* Avatar */}
                {avatar ? (
                  <img
                    src={avatar}
                    alt={profile.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold shrink-0">
                    {getInitials(profile.name)}
                  </div>
                )}

                <div className="flex-1">
                  <h4 className="text-[15px] font-semibold text-[#576B95] mb-1">{post.name}</h4>
                  <p className="text-[15px] text-gray-900 mb-2 leading-snug whitespace-pre-wrap">{post.content}</p>

                  {/* Image placeholder - could be generated */}
                  {post.image && (
                    <div className="mb-2">
                      <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-500">
                        📷 {post.image}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>刚刚</span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Heart size={12} /> {post.likes || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} /> {post.commentCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Comments */}
                  {(post.comments?.length || 0) > 0 && (
                    <div className="bg-[#F7F7F7] rounded-lg p-2 mt-2">
                      {post.comments?.map((comment, i) => (
                        <div key={i} className="text-[13px]">
                          <span className="text-[#576B95] font-medium">{comment.name}: </span>
                          <span className="text-gray-900">{comment.c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {(!profile.posts || profile.posts.length === 0) && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              暂无动态
            </div>
          )}
        </div>

        {/* Footer spacing */}
        <div className="h-4" />
      </div>
    </div>
  );
}
