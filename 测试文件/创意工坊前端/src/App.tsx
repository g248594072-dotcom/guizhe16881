/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, Home, Grid, Download, Star, Upload, Cloud, 
  ChevronDown, Filter, User, Minus, Square, X, 
  Hexagon, Zap, Cpu, Map, Users, Building, Activity, Shield, Box,
  TerminalSquare
} from 'lucide-react';

const CATEGORIES = [
  { id: 'world', label: '世界规则', icon: Hexagon },
  { id: 'region-rule', label: '区域规则', icon: Map },
  { id: 'personal', label: '个人规则', icon: Shield },
  { id: 'region', label: '区域', icon: Box },
  { id: 'character', label: '角色', icon: Users },
  { id: 'building', label: '建筑', icon: Building },
  { id: 'activity', label: '活动', icon: Zap },
];

const RECOMMENDED_WORKS = [
  { id: 1, title: '夜城漫游指南', type: '区域规则', rating: 4.8, downloads: '12.5k', author: 'NetRunner_89', color: 'cyan' },
  { id: 2, title: '霓虹义体改造基础', type: '个人规则', rating: 4.9, downloads: '8.4k', author: 'Doc_Chrome', color: 'pink' },
  { id: 3, title: '废土黑市贸易网', type: '世界规则', rating: 4.6, downloads: '5.2k', author: 'Wastelander', color: 'yellow' },
  { id: 4, title: '深潜者协议 v2', type: '世界规则', rating: 4.7, downloads: '9.1k', author: 'GhostInShell', color: 'cyan' },
];

export default function App() {
  const [activeView, setActiveView] = useState<'explore' | 'workspace'>('explore');
  const [activeCategory, setActiveCategory] = useState('all');
  
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');

  const handleCategoryClick = (id: string) => {
    setActiveCategory(id);
    setActiveView('explore');
  };

  return (
    <div className="min-h-screen p-2 md:p-8 flex items-center justify-center font-sans overflow-hidden select-none bg-cyber-black text-cyber-text">
      
      {/* Main OS Window */}
      <div className="w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden border-2 border-cyber-gray bg-cyber-black relative scanlines">
        
        {/* Window Header */}
        <div className="h-10 bg-cyber-panel border-b border-cyber-cyan/30 flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-cyber-magenta shadow-[0_0_8px_#ff00ff]"></div>
            <span className="text-[11px] font-mono tracking-[0.2em] text-cyber-cyan uppercase font-bold italic">SYS_CORE // 规则创意工坊_v1.0.4</span>
          </div>
          <div className="flex gap-4">
            <button className="text-[14px] font-mono cursor-pointer hover:text-cyber-cyan transition-colors text-cyber-muted">[ — ]</button>
            <button className="text-[14px] font-mono cursor-pointer hover:text-cyber-cyan transition-colors text-cyber-muted">[ □ ]</button>
            <button className="text-[14px] font-mono cursor-pointer hover:text-cyber-pink transition-colors text-cyber-muted">[ × ]</button>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="h-16 border-b border-cyber-border bg-cyber-gray/50 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex-1 w-full max-w-xl relative flex items-center">
            <Search className="w-5 h-5 text-cyber-cyan absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="搜索规则 / 区域 / 建筑 / 角色 [搜索终端]..."
              className="w-full bg-cyber-black border border-cyber-cyan/30 text-cyber-cyan px-10 py-2.5 font-mono text-sm focus:outline-none focus:border-cyber-cyan shadow-[inset_0_0_10px_rgba(0,243,255,0.05)] clip-corner-sm transition-all"
            />
            <div className="absolute right-2 px-2 py-0.5 bg-cyber-cyan/20 text-cyber-cyan text-[10px] font-display border border-cyber-cyan/50 backdrop-blur-sm">ENTER</div>
          </div>
          
          <div className="flex items-center gap-4 ml-6">
            <button className="flex items-center gap-2 px-4 py-2 border border-cyber-border bg-cyber-panel hover-glow text-cyber-cyan text-sm font-medium clip-corner-sm transition-all">
              <Filter className="w-4 h-4" />
              标签筛选
              <ChevronDown className="w-4 h-4 ml-1" />
            </button>
            <button 
              onClick={() => setActiveView(activeView === 'workspace' ? 'explore' : 'workspace')}
              className={`flex items-center gap-2 px-4 py-2 border clip-corner-sm transition-all text-sm font-medium ${
                activeView === 'workspace'
                ? 'border-cyber-cyan bg-cyber-cyan/10 text-cyber-cyan shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                : 'border-cyber-border bg-cyber-panel hover-glow text-cyber-cyan'
              }`}
            >
              <User className="w-4 h-4" />
              {activeView === 'workspace' ? '返回探索' : '我的工作站'}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden z-10">
          
          {/* Sidebar */}
          <div className="w-48 bg-cyber-sidebar border-r border-cyber-cyan/20 flex flex-col p-4 gap-1 shrink-0 z-20">
            <div className="mb-6 px-2">
              <div className="text-[10px] uppercase text-cyber-muted mb-4 tracking-widest border-b border-cyber-muted/20 pb-1">Categories</div>
              <div className="flex flex-col gap-2">
                <SidebarItem icon={Grid} label="查看全部 / ALL" id="all" active={activeView === 'explore' && activeCategory === 'all'} onClick={() => handleCategoryClick('all')} />
                {CATEGORIES.map(cat => (
                  <SidebarItem key={cat.id} icon={cat.icon} label={cat.label} id={cat.id} active={activeView === 'explore' && activeCategory === cat.id} onClick={() => handleCategoryClick(cat.id)} />
                ))}
              </div>
            </div>
            
            <div className="mt-auto border-t border-cyber-magenta/20 pt-4">
              <button className="w-full flex items-center justify-between py-2 px-3 text-[10px] transition-colors border bg-transparent border-transparent text-cyber-muted hover:bg-cyber-gray hover:text-cyber-text active:bg-cyber-magenta/10 active:text-cyber-magenta active:border-cyber-magenta/30">
                <div className="flex items-center gap-2">
                  <Cloud className="w-3.5 h-3.5" />
                  <span>同步 / SYNC</span>
                </div>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-cyber-dark relative">
            {activeView === 'workspace' ? (
              <div className="w-full max-w-4xl mx-auto flex flex-col pt-4 z-10 animate-in fade-in duration-300 relative">
                
                <div className="flex items-center gap-3 mb-8 border-b border-cyber-gray pb-4">
                  <Upload className="w-6 h-6 text-cyber-magenta" />
                  <h2 className="text-2xl font-display font-medium text-cyber-text tracking-wide">
                    数据上传链路 <span className="text-cyber-magenta/50 text-sm ml-2 font-mono">// UPLOAD_LINK</span>
                  </h2>
                </div>

                <div className="bg-cyber-panel border border-cyber-border p-6 flex flex-col gap-8 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                  {/* Step 1 */}
                  <div>
                    <h3 className="text-xs font-mono tracking-widest text-cyber-cyan mb-4 flex items-center gap-2">
                      <span className="w-1 h-3 bg-cyber-cyan"></span> [ 1 ] 选择类别 / SELECT TAG
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setUploadCategory(cat.id)}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border transition-all ${
                            uploadCategory === cat.id
                            ? 'bg-cyber-cyan text-cyber-black border-cyber-cyan shadow-[0_0_10px_rgba(0,243,255,0.3)]'
                            : 'bg-cyber-gray border-cyber-muted/40 text-cyber-muted hover:text-cyber-text hover:border-cyber-cyan/50 hover:bg-cyber-cyan/5'
                          }`}
                        >
                          <cat.icon className="w-3.5 h-3.5" />
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className={`transition-opacity duration-500 flex flex-col gap-6 ${uploadCategory ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <h3 className="text-xs font-mono tracking-widest text-cyber-yellow flex items-center gap-2">
                      <span className="w-1 h-3 bg-cyber-yellow"></span> [ 2 ] 核心数据录入 / DATA PREPARATION
                    </h3>
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-mono text-cyber-muted">项目代号_TITLE</label>
                        <input 
                          type="text" 
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          className="bg-cyber-black border border-cyber-border focus:border-cyber-cyan text-cyber-text px-4 py-3 outline-none font-mono text-sm transition-colors" 
                          placeholder="输入规则名称或标题..." 
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-mono text-cyber-muted">数据载荷_CONTENT</label>
                        <textarea 
                          value={uploadContent}
                          onChange={(e) => setUploadContent(e.target.value)}
                          rows={8} 
                          className="bg-cyber-black border border-cyber-border focus:border-cyber-cyan text-cyber-text px-4 py-3 outline-none font-sans text-sm transition-colors resize-none" 
                          placeholder="输入详细规则参数或具体描述内容..." 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-6 border-t border-cyber-border flex justify-end gap-4 mt-2">
                    <button 
                      onClick={() => setActiveView('explore')}
                      className="px-6 py-2 border border-cyber-muted text-cyber-muted hover:text-cyber-text hover:border-cyber-border transition-colors font-mono text-xs cursor-pointer"
                    >
                      ABORT // 取消
                    </button>
                    <button 
                      className={`px-6 py-2 font-bold font-mono text-xs shadow-[0_0_15px_rgba(255,0,255,0.4)] transition-all ${
                        uploadCategory && uploadTitle && uploadContent
                        ? 'bg-cyber-magenta text-cyber-black border border-cyber-magenta hover:brightness-110 cursor-pointer'
                        : 'bg-cyber-gray text-cyber-muted border border-cyber-muted pointer-events-none shadow-none'
                      }`}
                    >
                      TRANSMIT // 开始同步
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-8 relative z-10 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-mono tracking-widest text-cyber-purple flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-cyber-purple"></span> 📦 推荐作品 / RECOMMENDED
                  </h3>
                  <div className="h-[1px] flex-1 bg-cyber-border mx-4"></div>
                  <div className="flex gap-2 text-[10px] text-cyber-muted">
                    <span className="text-cyber-cyan">#现代</span>
                    <span>#西幻</span>
                    <span>#赛博朋克</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {RECOMMENDED_WORKS.map(work => (
                    <WorkCard key={work.id} work={work} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Terminal Bar Footer */}
        <div className="h-8 flex items-center justify-between text-[9px] font-mono text-cyber-muted px-4 border-t border-cyber-gray bg-cyber-dark z-20 shrink-0">
          <div>SYSTEM STATUS: <span className="text-cyber-green">OPTIMAL</span></div>
          <div>BANDWIDTH: 1.4 GB/S</div>
          <div>LATENCY: 14MS</div>
          <div className="text-cyber-magenta">SECURED_LINE_0142</div>
        </div>
      </div>
    </div>
  );
}

// Side Navigation Component
function SidebarItem({ icon: Icon, label, id, active, onClick }: { icon: any, label: string, id: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 py-2 px-3 text-sm transition-colors ${
        active 
        ? 'text-cyber-cyan bg-cyber-cyan/10 border-l-2 border-cyber-cyan font-medium' 
        : 'text-cyber-muted hover:bg-cyber-gray hover:text-cyber-text border-l-2 border-transparent'
      }`}
    >
      <Icon className="w-4 h-4" /> 
      {label}
    </button>
  );
}

// Work Card Component
function WorkCard({ work }: { work: any }) {
  return (
    <div className="bg-cyber-panel border border-cyber-border group hover:border-cyber-cyan/40 transition-all flex flex-col h-full relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-cyber-cyan/20 group-hover:bg-cyber-cyan transition-all duration-300"></div>
      <div className="p-4 flex flex-col flex-1 pt-5">
        <div className="flex justify-between items-start mb-2">
          <span className={`text-[9px] font-mono border px-1.5 py-0.5 bg-black/50 ${
            work.color === 'pink' ? 'text-cyber-pink border-cyber-pink/50' : 
            work.color === 'yellow' ? 'text-cyber-yellow border-cyber-yellow/50' : 
            'text-cyber-cyan border-cyber-cyan/50'
          }`}>
            {work.type}
          </span>
        </div>
        <div className="text-sm font-bold mb-2 text-cyber-text group-hover:text-cyber-cyan transition-colors">{work.title}</div>
        <p className="text-[10px] text-cyber-muted font-mono mb-4 line-clamp-2">
          // AUTHOR: {work.author}
          <br/>
          // STATUS: VERIFIED
        </p>
        <div className="flex items-center gap-1 mb-3 mt-auto">
          <span className="text-[10px] text-cyber-yellow">
            {'★'.repeat(Math.floor(work.rating))}{'☆'.repeat(5 - Math.floor(work.rating))}
          </span>
          <span className="text-[9px] text-cyber-muted ml-auto">DL: {work.downloads}</span>
        </div>
        <div className="pt-3 border-t border-cyber-gray">
          <button className="w-full bg-transparent border border-cyber-cyan/30 text-cyber-cyan py-1 text-[9px] uppercase hover:bg-cyber-cyan/10 transition-colors font-bold tracking-widest">Download</button>
        </div>
      </div>
    </div>
  );
}
