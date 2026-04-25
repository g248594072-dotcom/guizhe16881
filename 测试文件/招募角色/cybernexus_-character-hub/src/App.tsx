/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  User, 
  Heart, 
  Activity, 
  Brain, 
  MapPin, 
  Shield, 
  Tag as TagIcon,
  Shirt,
  Info,
  Maximize2,
  Trash2,
  Edit2
} from 'lucide-react';
import { characters } from './data';
import { Character } from './types';

// --- Utility Components ---

const GlitchText = ({ children, className = "" }: { children: ReactNode, className?: string }) => {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <span className="absolute top-0 left-0 -z-10 text-cyber-pink translate-x-1 animate-glitch opacity-50 select-none pointer-events-none">
        {children}
      </span>
      <span className="absolute top-0 left-0 -z-10 text-cyber-cyan -translate-x-1 animate-glitch opacity-50 select-none pointer-events-none" style={{ animationDirection: 'reverse' }}>
        {children}
      </span>
    </span>
  );
};

const CyberButton = ({ 
  children, 
  onClick, 
  className = "", 
  variant = 'cyan' 
}: { 
  children: ReactNode, 
  onClick?: () => void, 
  className?: string,
  variant?: 'cyan' | 'pink' | 'yellow' | 'gray'
}) => {
  const colors = {
    cyan: 'border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan/10',
    pink: 'border-cyber-pink text-cyber-pink hover:bg-cyber-pink/10',
    yellow: 'border-cyber-yellow text-cyber-yellow hover:bg-cyber-yellow/10',
    gray: 'border-white/20 text-white/60 hover:bg-white/5'
  };

  return (
    <button 
      onClick={onClick}
      className={`cyber-button border px-4 py-2 uppercase tracking-widest text-xs font-bold transition-all ${colors[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "", title, icon: Icon, action }: { children: ReactNode, className?: string, title?: string, icon?: any, action?: ReactNode }) => (
  <div className={`glass-morphism rounded-lg flex flex-col p-4 relative border-l border-l-cyber-cyan/40 ${className}`}>
    <div className="tech-bracket-tl" />
    <div className="tech-bracket-br" />
    {(title || Icon) && (
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2 relative z-10">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-cyber-cyan" />}
          {title && <h3 className="text-sm font-bold tracking-tighter uppercase">{title}</h3>}
        </div>
        {action}
      </div>
    )}
    <div className="relative z-10">
      {children}
    </div>
  </div>
);

// --- Main Views ---

const CharacterList = ({ onSelect }: { onSelect: (c: Character) => void }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-6 max-w-7xl mx-auto">
      {characters.map((char, idx) => (
        <motion.div
          key={char.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="group relative cursor-pointer"
          onClick={() => onSelect(char)}
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyber-cyan to-cyber-pink opacity-20 group-hover:opacity-100 blur transition duration-500 rounded-lg"></div>
          <div className="relative glass-morphism rounded-lg overflow-hidden h-[500px] flex flex-col bg-cyber-bg/90">
            {/* Image Section */}
            <div className="h-2/3 relative overflow-hidden">
               <img 
                 src={char.avatar} 
                 alt={char.name} 
                 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                 referrerPolicy="no-referrer"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-cyber-bg via-transparent to-transparent" />
               <div className="absolute top-4 right-4 bg-cyber-cyan text-black text-[10px] font-black px-2 py-1 uppercase rounded-sm">
                 {char.isSingle ? 'Single' : 'Occupied'}
               </div>
            </div>

            {/* Info Section */}
            <div className="p-6 flex-1 flex flex-col justify-end">
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-4xl font-black italic tracking-tighter">
                  <GlitchText>{char.name}</GlitchText>
                </h2>
                <div className="text-cyber-cyan font-mono text-sm">AGE: {char.age}</div>
              </div>
              <p className="text-white/60 text-sm line-clamp-2 mb-4 font-light leading-relaxed">
                {char.intro}
              </p>
              <div className="flex flex-wrap gap-2">
                {char.tags.map(tag => (
                  <span key={tag} className="text-[10px] uppercase border border-white/20 px-2 py-0.5 rounded-full text-white/40">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Hover Decor */}
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-6 h-6 text-cyber-cyan animate-pulse" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const CharacterDetail = ({ character, onBack }: { character: Character, onBack: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-cyber-dark p-6"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
           <button 
             onClick={onBack}
             className="flex items-center gap-2 text-white/60 hover:text-cyber-cyan transition-colors group"
           >
             <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
             <span className="uppercase tracking-widest text-xs font-bold">返回角色列表</span>
           </button>
           <div className="flex gap-4">
              <CyberButton variant="pink"><Trash2 className="w-4 h-4 mr-2 inline" />删除角色</CyberButton>
           </div>
        </div>

        {/* Profile Identity */}
        <div className="flex flex-col md:flex-row gap-8 mb-8 relative">
          <div className="w-48 h-64 relative group overflow-hidden border border-cyber-cyan/30 glass-morphism">
             <div className="absolute inset-0 flex items-center justify-center text-cyber-pink/10 text-9xl font-black select-none">0{character.id.split('-')[1]}</div>
             <img src={character.avatar} alt={character.name} className="absolute inset-0 w-full h-full object-cover rounded-none grayscale group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
             <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-cyber-cyan/40 to-transparent" />
             <div className="absolute top-2 right-2 text-[8px] bg-cyber-pink text-black px-1.5 py-0.5 font-bold uppercase animate-pulse">LIVE_FEED</div>
             <div className="tech-bracket-tl scale-75" />
             <div className="tech-bracket-br scale-75" />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-7xl font-black mb-2 italic tracking-tighter text-white">
              <GlitchText>{character.name}</GlitchText>
            </h1>
            <div className="flex items-center gap-4 text-cyber-cyan text-sm tracking-[0.2em] font-bold">
              <span>SPEC: {character.tags[0].toUpperCase()} / AGENT</span>
            </div>
          </div>
        </div>

        {/* GRID LAYOUT FOR DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* 生理指标 */}
          <Card title="生理指标" icon={Activity} action={<button className="text-[10px] text-cyber-cyan uppercase font-bold">编辑</button>}>
            <div className="space-y-4 text-sm">
               {[
                 { label: '年龄', value: character.age },
                 { label: '身高', value: character.details.indicators.height },
                 { label: '体重', value: character.details.indicators.weight },
                 { label: '三围', value: character.details.indicators.bwh },
                 { label: '体质', value: character.details.indicators.constitution },
               ].map(item => (
                 <div key={item.label} className="flex justify-between border-b border-white/5 pb-1">
                   <span className="text-white/40">{item.label}</span>
                   <span className="font-mono text-cyber-cyan">{item.value}</span>
                 </div>
               ))}
               <div className="mt-6">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-white/40 mb-1">
                    <span>好感度 Affection</span>
                    <span>{character.details.indicators.affection} (-100~100)</span>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(character.details.indicators.affection + 100) / 2}%` }}
                      className="h-full bg-cyber-pink"
                    />
                  </div>
               </div>
            </div>
          </Card>

          {/* 心理状态 */}
          <Card title="心理状态" icon={Brain} action={<button className="text-[10px] text-cyber-cyan uppercase font-bold">编辑</button>}>
             <div className="space-y-4">
                <div>
                   <h4 className="text-[10px] text-white/40 uppercase font-black mb-2">当前想法</h4>
                   <p className="text-sm italic text-white/80 leading-relaxed font-light">"{character.details.psychology.currentThought}"</p>
                </div>
                <div>
                  <h4 className="text-[10px] text-white/40 uppercase font-black mb-2">性格特征</h4>
                  <div className="space-y-2">
                    {character.details.psychology.traits.map((trait, i) => (
                      <div key={i} className="text-xs bg-white/5 p-2 border border-white/10 rounded">
                        {trait}
                      </div>
                    ))}
                  </div>
                </div>
             </div>
          </Card>

           {/* 生理数值 - Lust / Fetish */}
           <Card title="生理数值" icon={Heart}>
             <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-[10px] uppercase font-bold text-white/40 mb-1">
                    <span>发情值 Lust</span>
                    <span>{character.details.vitals.lust}/100</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${character.details.vitals.lust}%` }}
                      className="h-full bg-gradient-to-r from-cyber-pink to-red-500"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] uppercase font-bold text-white/40 mb-1">
                    <span>性癖开发值 Fetish</span>
                    <span>{character.details.vitals.fetish}/100</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${character.details.vitals.fetish}%` }}
                      className="h-full bg-gradient-to-r from-purple-500 to-cyber-pink"
                    />
                  </div>
                </div>
                <div>
                   <h4 className="text-[10px] text-white/40 uppercase font-black mb-2">当前综合生理描述</h4>
                   <p className="text-xs text-white/60 leading-relaxed">{character.details.vitals.description}</p>
                </div>
             </div>
          </Card>

          {/* 位置与参与活动 */}
          <Card title="位置与参与活动" icon={MapPin} className="lg:col-span-2">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                   <div>
                      <h4 className="text-[10px] text-white/40 uppercase font-black mb-1">区域 / 建筑 / 活动</h4>
                      <p>{character.details.location.area}</p>
                   </div>
                   <div>
                      <h4 className="text-[10px] text-white/40 uppercase font-black mb-1">当前行为</h4>
                      <p className="text-white/80">{character.details.location.currentAction}</p>
                   </div>
                </div>
                <div>
                   <h4 className="text-[10px] text-white/40 uppercase font-black mb-1">参与活动记录</h4>
                   <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                      <p className="font-bold text-cyber-cyan">{character.details.location.record.split(':')[0]}</p>
                      <p className="text-xs text-white/40 mt-1">{character.details.location.record.split(':')[1]}</p>
                   </div>
                </div>
             </div>
          </Card>

          {/* 性癖与敏感带 */}
          <Card title="性癖与敏感带" icon={Shield} action={<button className="text-[10px] text-cyber-cyan uppercase font-bold">编辑</button>}>
             <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] text-white/40 uppercase font-black mb-2">敏感点开发</h4>
                  <div className="flex flex-wrap gap-2">
                    {character.details.fetishDetails.sensitivePoints.map(p => (
                      <span key={p} className="bg-white text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase">{p}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] text-white/40 uppercase font-black mb-2">性癖</h4>
                  <div className="flex flex-wrap gap-2">
                    {character.details.fetishDetails.fetishes.map(f => (
                      <span key={f} className="border border-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase">{f}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] text-white/40 uppercase font-black mb-1">隐藏性癖</h4>
                  <p className="text-xs text-white/40 italic">{character.details.fetishDetails.hiddenFetishes[0]}</p>
                </div>
             </div>
          </Card>

          {/* 服装与身体状态 */}
          <Card title="服装与身体状态" icon={Shirt} className="lg:col-span-2" action={<button className="text-[10px] text-cyber-cyan uppercase font-bold">编辑</button>}>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                   <h4 className="text-[10px] text-white/40 uppercase font-black">服装槽位</h4>
                   <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {Object.entries(character.details.clothing).map(([key, item]) => (
                        <div key={key} className="bg-white/5 p-3 rounded border border-white/5 group hover:border-cyber-cyan/50 transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] uppercase text-white/40 font-black">{key}</span>
                              <button className="text-[8px] text-cyber-cyan font-bold border border-cyber-cyan/30 px-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">+ 添加</button>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded-full self-start">{item.name}</span>
                              <span className="text-[10px] text-cyber-pink">状态: {item.status}</span>
                              <p className="text-[10px] text-white/40 leading-tight mt-1">{item.description}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
                <div className="space-y-6">
                   <div>
                    <h4 className="text-[10px] text-white/40 uppercase font-black mb-4">饰品</h4>
                    <div className="space-y-3">
                        {character.details.accessories.map(acc => (
                           <div key={acc.id} className="bg-white/5 p-3 rounded border border-white/5 border-l-2 border-l-cyber-pink">
                              <div className="flex gap-2 mb-1">
                                <span className="text-[10px] bg-red-900/30 text-white/80 px-2 py-0.5 rounded">{acc.name}</span>
                                <span className="text-[10px] border border-white/20 text-white/40 px-2 py-0.5 rounded">{acc.name} ({acc.part})</span>
                              </div>
                              <div className="text-[10px] space-x-2">
                                <span className="text-white/60">状态: {acc.status}</span>
                                <span className="text-white/40">描述: {acc.description}</span>
                              </div>
                           </div>
                        ))}
                    </div>
                   </div>
                   <div>
                     <h4 className="text-[10px] text-white/40 uppercase font-black mb-2">身体部位物理状态</h4>
                     <div className="grid grid-cols-2 gap-2">
                        {['脸部', '手部', '乳房', '乳头', '小穴', '脚部'].map(part => (
                          <div key={part} className="bg-white/5 border border-white/10 text-[10px] p-2 rounded text-center text-white/40 hover:text-cyber-cyan hover:border-cyber-cyan/50 cursor-pointer transition-colors">
                            {part}
                          </div>
                        ))}
                     </div>
                   </div>
                </div>
             </div>
          </Card>

          {/* 身份标签 */}
          <Card title="身份标签" icon={TagIcon} className="lg:col-span-1" action={<button className="text-[10px] text-cyber-cyan uppercase font-bold">编辑</button>}>
             <div className="flex flex-col items-center justify-center h-full py-8 text-white/20 italic text-sm">
                暂无身份标签
             </div>
          </Card>

          {/* 当前受影响规则 */}
          <Card title="当前受影响规则" icon={Info} className="lg:col-span-3" action={<button className="text-[10px] text-cyber-cyan uppercase font-bold">管理规则影响</button>}>
             <div className="py-4 text-white/40 text-sm">
                暂无个人规则影响
             </div>
          </Card>
        </div>
        
        {/* Footer actions */}
        <div className="mt-8">
           <button 
             onClick={onBack}
             className="skewed-button w-full"
           >
             CONFIRM_SELECTION.EXE
           </button>
        </div>
        
        {/* Footer spacing */}
        <div className="h-10" />
      </div>
    </motion.div>
  );
};

export default function App() {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  const selectedChar = characters.find(c => c.id === selectedCharId);

  return (
    <div className="relative min-h-screen selection:bg-cyber-cyan selection:text-black overflow-hidden flex flex-col">
      {/* Background Decor */}
      <div className="cyber-grid-bg" />
      <div className="scanline-effect opacity-50" />
      
      {/* Global Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-5 scanline-pattern z-[100]" />

      {/* HUD Header */}
      <header className="relative z-50 p-6 flex justify-between items-start border-b border-cyber-cyan/30 bg-black/40 backdrop-blur-md">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-cyber-pink uppercase shadow-[0_0_15px_rgba(255,0,255,0.4)]">
            <GlitchText>OPERATIVE_SELECTION</GlitchText>
          </h1>
          <p className="text-[10px] opacity-70 tracking-widest font-mono">
            ENCRYPTION: AES-256 | STATUS: LOGGED_IN | NODE: NEON_CITY_04
          </p>
        </div>
        <div className="text-right text-[11px] leading-tight font-mono">
          <div className="text-white/60 uppercase">SYSTEM_UPTIME: 124:59:12</div>
          <div className="text-cyber-pink animate-pulse uppercase">Scanning for neural sync...</div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {!selectedCharId ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12"
            >
              <div className="max-w-7xl mx-auto px-6 mb-8 text-xs uppercase tracking-widest text-white/40 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyber-pink rounded-full animate-pulse"></span> 
                Available_Files
              </div>
              <CharacterList onSelect={(char) => setSelectedCharId(char.id)} />
            </motion.div>
          ) : (
            selectedChar && (
              <div key="detail" className="h-full">
                <CharacterDetail 
                  character={selectedChar} 
                  onBack={() => setSelectedCharId(null)} 
                />
              </div>
            )
          )}
        </AnimatePresence>
      </main>

      {/* HUD Footer */}
      <footer className="relative z-50 p-4 border-t border-cyber-cyan/20 bg-black/60 backdrop-blur-md flex justify-between items-center text-[10px] opacity-50 uppercase tracking-widest font-mono">
        <div>X: 144.22 // Y: 902.11 // Z: 0.00</div>
        <div className="hidden md:block">Peripheral: Synced // Neural: Online // Pulse: 72bpm</div>
        <div>© 2077_CYBER_KERN_RESOURCES</div>
      </footer>
    </div>
  );
}
