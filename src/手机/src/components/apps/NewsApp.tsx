import React from 'react';
import { ChevronLeft, Search, Bookmark, Share } from 'lucide-react';

export default function NewsApp({ onClose }: { onClose: () => void }) {
  const news = [
    {
      id: 1,
      title: 'Global Markets Rally as Tech Stocks Surge',
      source: 'Financial Times',
      time: '1h ago',
      image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=400&h=300',
      category: 'Finance'
    },
    {
      id: 2,
      title: 'New Breakthrough in Quantum Computing Announced',
      source: 'TechCrunch',
      time: '3h ago',
      image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=400&h=300',
      category: 'Technology'
    },
    {
      id: 3,
      title: 'Sustainable Energy Initiatives Gain Momentum Worldwide',
      source: 'Reuters',
      time: '5h ago',
      image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&q=80&w=400&h=300',
      category: 'Environment'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="pt-12 pb-2 px-4 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 -ml-1 text-[#FF2D55]">
            <ChevronLeft size={28} />
          </button>
        </div>
        <button className="p-1 text-[#FF2D55]">
          <Search size={24} />
        </button>
      </div>

      <div className="px-4 pb-2">
        <h1 className="text-[34px] font-bold text-black tracking-tight">News</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {/* Featured Article */}
        <div className="px-4 py-4 border-b border-gray-100">
          <img 
            src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800&h=500" 
            alt="Featured" 
            className="w-full h-48 object-cover rounded-xl mb-4"
          />
          <span className="text-[11px] font-bold text-[#FF2D55] uppercase tracking-wider mb-2 block">Top Story</span>
          <h2 className="text-[22px] font-bold leading-tight mb-2 text-black">The Future of AI: What to Expect in the Next Decade</h2>
          <p className="text-[15px] text-gray-600 mb-3 line-clamp-2">Experts predict massive shifts in how we interact with technology, from personalized AI assistants to autonomous systems.</p>
          <div className="flex items-center justify-between text-[13px] text-gray-500">
            <span className="font-medium text-black">Wired • 2h ago</span>
            <div className="flex gap-3">
              <button><Bookmark size={16} /></button>
              <button><Share size={16} /></button>
            </div>
          </div>
        </div>

        {/* List Articles */}
        <div className="px-4 py-2">
          {news.map(item => (
            <div key={item.id} className="flex gap-4 py-4 border-b border-gray-100 last:border-0">
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">{item.category}</span>
                  <h3 className="text-base font-semibold leading-snug mb-2 line-clamp-3">{item.title}</h3>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{item.source} • {item.time}</span>
                  <button><Bookmark size={14} /></button>
                </div>
              </div>
              <img src={item.image} alt={item.title} className="w-24 h-24 object-cover rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
