import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Battery,
  Wifi,
  Signal,
  MessageCircle,
  Newspaper,
  Users,
  BookHeart,
  Aperture,
  Settings as SettingsIcon,
  X,
  MessageSquare,
  UserCheck,
} from 'lucide-react';
import { postRequestCloseTavernPhone } from './tavernPhoneBridge';
import { loadTheme, saveTheme, getThemeVars, injectThemeVars, THEME_LABELS } from './theme';
import type { PhoneTheme } from './theme';
import TenantArchiveApp from './components/apps/TenantArchiveApp';
import AnalysisQueueWidget from './components/AnalysisQueueWidget';

// Import Apps
import ForumApp from './components/apps/ForumApp';
import NewsApp from './components/apps/NewsApp';
import WeChatApp from './components/apps/WeChatApp';
import DiaryApp from './components/apps/DiaryApp';
import MomentsApp from './components/apps/MomentsApp';
import SettingsApp from './components/apps/SettingsApp';
import GroupChatApp from './components/apps/GroupChatApp';

type AppId = 'wechat' | 'groupchat' | 'moments' | 'diary' | 'news' | 'forum' | 'settings' | 'archive' | null;

interface AppConfig {
  id: AppId;
  name: string;
  icon: React.ReactNode;
  color: string;
  component: React.FC<{
    onClose: () => void,
    setWallpaper?: (url: string) => void,
    switchTheme?: (theme: PhoneTheme) => void,
    currentTheme?: PhoneTheme,
  }>;
}

const APPS: AppConfig[] = [
  { id: 'archive', name: '档案', icon: <UserCheck size={34} color="white" strokeWidth={1.5} />, color: 'bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe]', component: TenantArchiveApp },
  { id: 'wechat', name: '微信', icon: <MessageCircle size={34} color="white" strokeWidth={1.5} />, color: 'bg-[#07C160]', component: WeChatApp },
  { id: 'groupchat', name: '群聊', icon: <MessageSquare size={34} color="white" strokeWidth={1.5} />, color: 'bg-[#5856D6]', component: GroupChatApp },
  { id: 'diary', name: '日记', icon: <BookHeart size={34} color="#f59e0b" strokeWidth={1.5} />, color: 'bg-white', component: DiaryApp },
  { id: 'forum', name: '论坛', icon: <Users size={34} color="white" strokeWidth={1.5} />, color: 'bg-[#007AFF]', component: ForumApp },
  { id: 'moments', name: '朋友圈', icon: <Aperture size={34} color="white" strokeWidth={1.5} />, color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500', component: MomentsApp },
  { id: 'news', name: '新闻', icon: <Newspaper size={34} color="white" strokeWidth={1.5} />, color: 'bg-[#FF2D55]', component: NewsApp },
  { id: 'settings', name: '设置', icon: <SettingsIcon size={34} color="white" strokeWidth={1.5} />, color: 'bg-[#8E8E93]', component: SettingsApp },
];

/** 未实现完整功能的应用：显示「待更新」遮罩，微信、群聊、设置与档案除外 */
function isPlaceholderApp(id: AppId): boolean {
  return id !== null && id !== 'wechat' && id !== 'groupchat' && id !== 'settings' && id !== 'archive';
}

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeApp, setActiveApp] = useState<AppId>(null);
  const [wallpaper, setWallpaper] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop');
  const [currentTheme, setCurrentTheme] = useState<PhoneTheme>(() => loadTheme());

  useEffect(() => {
    // 初始化时注入主题变量
    injectThemeVars(getThemeVars(currentTheme));
  }, []);

  /** 切换主题并保存 */
  const switchTheme = (theme: PhoneTheme) => {
    setCurrentTheme(theme);
    saveTheme(theme);
    injectThemeVars(getThemeVars(theme));
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });

  const activeConfig = APPS.find(app => app.id === activeApp);
  const ActiveAppComponent = activeConfig?.component;
  const showPlaceholder = Boolean(activeApp && ActiveAppComponent && isPlaceholderApp(activeApp));

  /** 设计稿 375×812；无边框：尽量贴满 iframe，仅圆角 + 极轻阴影 */
  const phoneShellStyle: React.CSSProperties = {
    aspectRatio: '375 / 812',
    width: 'min(375px, 100vw, calc(100dvh * 375 / 812))',
    maxHeight: 'min(812px, 100dvh)',
    height: 'auto',
  };

  return (
    <div className="relative box-border flex h-dvh w-full max-w-[100vw] flex-col items-center justify-center overflow-hidden bg-black p-0 font-sans">
      <button
        type="button"
        className="absolute right-2 top-2 z-100 flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80"
        style={{ backgroundColor: 'var(--close-btn-bg)', color: 'var(--status-text, white)' }}
        title="关闭小手机"
        aria-label="关闭小手机"
        onClick={() => postRequestCloseTavernPhone()}
      >
        <X size={18} strokeWidth={2.5} />
      </button>
      {/* Phone Frame：无边框观感 — 无描边/无 ring，仅圆角裁剪 + 轻外阴影 */}
      <div
        className="relative shrink-0 overflow-hidden rounded-[40px] shadow-[0_2px_20px_rgba(0,0,0,0.35)]"
        style={phoneShellStyle}
      >
        {/* Screen Content：底层渐变防止壁纸加载失败时整屏纯黑；渐变色跟随主题 */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, var(--phone-bg-from, #778899), var(--phone-bg-via, #2c3e50), var(--phone-bg-to, #1a252f))' }}>
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-500"
            style={{ backgroundImage: `url(${wallpaper})` }}
          />
          <div className="absolute inset-0 flex flex-col">
          {/* Status Bar */}
          <div className="absolute top-0 inset-x-0 z-50 flex h-14 items-center justify-between px-7 text-[15px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" style={{ color: 'var(--status-text, white)', textShadow: 'var(--status-shadow)' }}>
            <span className="mt-1">{timeString}</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Signal size={17} strokeWidth={2.5} />
              <Wifi size={17} strokeWidth={2.5} />
              <Battery size={22} strokeWidth={2} />
            </div>
          </div>

          {/* Dynamic Island / Notch */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[35px] rounded-[24px] z-50 flex items-center justify-between px-2 shadow-sm" style={{ backgroundColor: 'var(--dynamic-island-bg, #000)' }}>
            <div className="w-2.5 h-2.5 rounded-full ml-1 shadow-inner" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
            <div className="w-2.5 h-2.5 rounded-full mr-1 shadow-inner" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
          </div>

          {/* Home Screen */}
          <div className="pt-20 px-6 h-full flex flex-col">
            <div className="grid grid-cols-4 gap-x-4 gap-y-7">
              {APPS.slice(0, 7).map((app) => (
                <button 
                  key={app.id} 
                  onClick={() => setActiveApp(app.id)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={`w-[62px] h-[62px] rounded-[18px] flex items-center justify-center shadow-sm group-active:scale-90 transition-transform duration-200 ${app.color} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-linear-to-b from-white/20 to-transparent opacity-50"></div>
                    {app.icon}
                  </div>
                  <span className="text-white text-[11px] font-medium tracking-wide drop-shadow-md">{app.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dock */}
          <div className="absolute bottom-5 inset-x-4 h-[88px] bg-white/25 backdrop-blur-2xl rounded-[34px] flex items-center justify-center gap-6 px-4 border border-white/10 shadow-xl">
             {APPS.slice(7, 8).map((app) => (
                <button
                  key={app.id}
                  onClick={() => setActiveApp(app.id)}
                  className="flex flex-col items-center group"
                >
                  <div className={`w-[62px] h-[62px] rounded-[18px] flex items-center justify-center shadow-sm group-active:scale-90 transition-transform duration-200 ${app.color} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-linear-to-b from-white/20 to-transparent opacity-50"></div>
                    {app.icon}
                  </div>
                </button>
              ))}
          </div>

          {/* Home Indicator */}
          <div className="absolute bottom-1.5 left-1/2 z-50 h-1 w-1/3 -translate-x-1/2 rounded-full bg-white/90 shadow-sm"></div>

          {/* Active App Overlay */}
          <AnimatePresence>
            {activeApp && ActiveAppComponent && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.8 }}
                className={`absolute inset-0 z-40 overflow-hidden flex flex-col rounded-[38px] ${showPlaceholder ? 'bg-neutral-100' : 'bg-white'}`}
              >
                {showPlaceholder ? (
                  <>
                    {/* 底层：原应用界面虚化 */}
                    <div className="absolute inset-0 overflow-hidden rounded-[38px]">
                      <div className="h-full w-full origin-center scale-[1.06] blur-[10px] opacity-[0.88] pointer-events-none select-none">
                        <ActiveAppComponent
                          onClose={() => setActiveApp(null)}
                          setWallpaper={undefined}
                        />
                      </div>
                    </div>
                    {/* 点击任意处返回桌面 */}
                    <button
                      type="button"
                      className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-white/25 backdrop-blur-[6px] border-0 p-0"
                      onClick={() => setActiveApp(null)}
                      aria-label="返回桌面"
                    >
                      <span className="pointer-events-none rounded-lg bg-red-600 px-8 py-3 text-center text-[15px] font-semibold tracking-wide text-white shadow-lg">
                        待更新中.....
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <ActiveAppComponent
                      onClose={() => setActiveApp(null)}
                      setWallpaper={activeApp === 'settings' ? setWallpaper : undefined}
                      switchTheme={activeApp === 'settings' ? switchTheme : undefined}
                      currentTheme={currentTheme}
                    />
                    <div
                      className="absolute bottom-0 inset-x-0 z-50 flex h-8 cursor-pointer items-end justify-center bg-linear-to-t from-white/80 to-transparent pb-1.5"
                      onClick={() => setActiveApp(null)}
                    >
                      <div className="h-1 w-1/3 rounded-full bg-black" />
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 分析队列悬浮小组件 */}
          <AnalysisQueueWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
