import React from 'react';
import { ChevronLeft, ChevronRight, Search, Wifi, Bluetooth, Battery, Image as ImageIcon, Smartphone } from 'lucide-react';
import { TAVERN_PHONE_UI_LABEL, TAVERN_PHONE_UI_VERSION } from '../../tavernPhoneVersion';

export default function SettingsApp({ onClose, setWallpaper }: { onClose: () => void, setWallpaper?: (url: string) => void }) {
  const wallpapers = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop', // Default
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop', // Gradient
    'https://images.unsplash.com/photo-1506744626753-eba7bc368f8e?q=80&w=2070&auto=format&fit=crop', // Nature
    'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2342&auto=format&fit=crop', // Space
  ];

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
      {/* Header */}
      <div className="bg-[#F2F2F7] pt-12 pb-3 px-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 -ml-1 text-blue-500">
            <ChevronLeft size={28} />
          </button>
          <span className="text-blue-500 font-medium text-lg">Settings</span>
        </div>
      </div>

      <div className="px-4 pb-2 pt-4">
        <h1 className="text-[34px] font-bold text-black mb-2 tracking-tight">设置</h1>
        
        {/* Search */}
        <div className="bg-[#E3E3E8] rounded-[10px] flex items-center px-2 py-1.5 mb-6">
          <Search size={18} className="text-[#8E8E93] mr-1.5 ml-1" />
          <input 
            type="text" 
            placeholder="Search" 
            className="bg-transparent border-none outline-none text-[17px] w-full placeholder-[#8E8E93]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        
        {/* Apple ID */}
        <div className="bg-white rounded-[10px] p-4 flex items-center gap-4 mb-6 shadow-sm">
          <div className="w-[60px] h-[60px] bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden">
            <img src="https://i.pravatar.cc/150?u=me" alt="User" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h2 className="text-[20px] font-normal text-black">User Name</h2>
            <p className="text-[13px] text-black/60 mt-0.5">Apple ID, iCloud, Media & Purchases</p>
          </div>
          <ChevronRight size={20} className="text-[#C7C7CC]" />
        </div>

        {/* Network Settings */}
        <div className="bg-white rounded-[10px] overflow-hidden mb-6 shadow-sm">
          <div className="flex items-center justify-between p-3 border-b border-gray-100 ml-10">
            <div className="flex items-center gap-3 -ml-10">
              <div className="w-[28px] h-[28px] bg-[#007AFF] rounded-md flex items-center justify-center text-white">
                <Wifi size={16} />
              </div>
              <span className="text-[17px] text-black">Wi-Fi</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[17px] text-[#8E8E93]">Home_Network</span>
              <ChevronRight size={20} className="text-[#C7C7CC]" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 ml-10">
            <div className="flex items-center gap-3 -ml-10">
              <div className="w-[28px] h-[28px] bg-[#007AFF] rounded-md flex items-center justify-center text-white">
                <Bluetooth size={16} />
              </div>
              <span className="text-[17px] text-black">Bluetooth</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[17px] text-[#8E8E93]">On</span>
              <ChevronRight size={20} className="text-[#C7C7CC]" />
            </div>
          </div>
        </div>

        {/* Wallpaper Settings */}
        <div className="bg-white rounded-[10px] overflow-hidden mb-6 shadow-sm">
          <div className="p-3 border-b border-gray-100 ml-10">
            <div className="flex items-center gap-3 -ml-10 mb-3">
              <div className="w-[28px] h-[28px] bg-[#5AC8FA] rounded-md flex items-center justify-center text-white">
                <ImageIcon size={16} />
              </div>
              <span className="text-[17px] text-black">Wallpaper</span>
            </div>
            
            <p className="text-[13px] text-[#8E8E93] mb-3 -ml-10">Choose a new wallpaper for your Home Screen.</p>
            
            <div className="grid grid-cols-2 gap-3 -ml-10 pb-2">
              {wallpapers.map((url, index) => (
                <button 
                  key={index}
                  onClick={() => setWallpaper && setWallpaper(url)}
                  className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-transparent focus:border-[#007AFF] transition-colors"
                >
                  <img src={url} alt={`Wallpaper ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Battery */}
        <div className="bg-white rounded-xl overflow-hidden mb-6 shadow-sm">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
                <Battery size={18} />
              </div>
              <span className="text-base text-black">Battery</span>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>

        {/* 小手机版本：与 tavernPhoneVersion.ts 同步，便于确认是否已更新构建 */}
        <div className="bg-white rounded-[10px] overflow-hidden mb-6 shadow-sm">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[13px] text-[#8E8E93] font-medium uppercase tracking-wide">关于小手机</p>
          </div>
          <div className="flex items-center justify-between p-3 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-800 rounded-lg flex items-center justify-center text-white">
                <Smartphone size={18} />
              </div>
              <div>
                <span className="text-[17px] text-black block">{TAVERN_PHONE_UI_LABEL}</span>
                <span className="text-[13px] text-[#8E8E93]">界面版本</span>
              </div>
            </div>
            <span className="text-[17px] font-semibold text-[#007AFF] tabular-nums">v{TAVERN_PHONE_UI_VERSION}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
