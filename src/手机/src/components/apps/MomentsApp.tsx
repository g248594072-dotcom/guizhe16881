import React from 'react';
import { ChevronLeft, Camera, Heart, MessageCircle } from 'lucide-react';

export default function MomentsApp({ onClose }: { onClose: () => void }) {
  const posts = [
    {
      id: 1,
      author: 'Alice',
      avatar: 'https://i.pravatar.cc/150?u=alice',
      content: 'Beautiful sunset today! 🌅',
      image: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&q=80&w=600&h=400',
      time: '1 hour ago',
      likes: ['Bob', 'Charlie'],
      comments: [
        { user: 'Bob', text: 'Wow, amazing colors!' }
      ]
    },
    {
      id: 2,
      author: 'Charlie',
      avatar: 'https://i.pravatar.cc/150?u=charlie',
      content: 'Just finished my first marathon! Exhausted but happy. 🏃‍♂️💨',
      image: null,
      time: '3 hours ago',
      likes: ['Alice', 'Dave', 'Eve'],
      comments: [
        { user: 'Alice', text: 'Congratulations!!' },
        { user: 'Dave', text: 'So proud of you man' }
      ]
    },
    {
      id: 3,
      author: 'Eve',
      avatar: 'https://i.pravatar.cc/150?u=eve',
      content: 'Coffee time ☕️',
      image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=600&h=600',
      time: '5 hours ago',
      likes: ['Alice'],
      comments: []
    }
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-[#EDEDED] pt-12 pb-3 px-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2 w-1/3">
          <button onClick={onClose} className="p-1 -ml-1 text-gray-900">
            <ChevronLeft size={28} />
          </button>
        </div>
        <div className="w-1/3 text-center">
          <h1 className="text-[17px] font-semibold text-gray-900">朋友圈</h1>
        </div>
        <div className="flex items-center justify-end gap-4 text-gray-900 w-1/3">
          <Camera size={24} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {/* Cover Photo */}
        <div className="relative h-[300px] mb-12">
          <img 
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800&h=600" 
            alt="Cover" 
            className="w-full h-full object-cover"
          />
          <div className="absolute -bottom-6 right-4 flex items-end gap-4">
            <span className="text-white font-bold text-lg drop-shadow-md mb-2">My Profile</span>
            <img 
              src="https://i.pravatar.cc/150?u=me" 
              alt="My Avatar" 
              className="w-[72px] h-[72px] rounded-xl border-2 border-white object-cover shadow-sm bg-white"
            />
          </div>
        </div>

        {/* Feed */}
        <div className="flex flex-col">
          {posts.map((post, index) => (
            <div key={post.id} className={`flex gap-3 px-4 py-4 ${index !== posts.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-[#576B95] mb-1">{post.author}</h3>
                <p className="text-[15px] text-gray-900 mb-2 leading-snug">{post.content}</p>
                
                {post.image && (
                  <img src={post.image} alt="Post content" className="max-w-[80%] max-h-48 object-cover mb-2" />
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>{post.time}</span>
                  <div className="bg-gray-100 rounded px-2 py-1 flex items-center gap-1">
                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  </div>
                </div>

                {/* Interactions */}
                {(post.likes.length > 0 || post.comments.length > 0) && (
                  <div className="bg-[#F7F7F7] rounded text-[13px] mt-2">
                    {post.likes.length > 0 && (
                      <div className="px-2 py-1.5 flex items-start gap-1 text-[#576B95] border-b border-gray-200/50 last:border-0">
                        <Heart size={14} className="mt-0.5 shrink-0" />
                        <span className="font-medium">{post.likes.join(', ')}</span>
                      </div>
                    )}
                    {post.comments.length > 0 && (
                      <div className="px-2 py-1.5 flex flex-col gap-1">
                        {post.comments.map((comment, i) => (
                          <div key={i}>
                            <span className="font-medium text-[#576B95]">{comment.user}: </span>
                            <span className="text-gray-900">{comment.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
