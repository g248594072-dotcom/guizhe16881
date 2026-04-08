import React, { useState } from 'react';
import { BookOpen, User, Globe, Map, UserCircle, Smartphone, Globe2, Dices, Settings, X, Plus, Edit2, Trash2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type Tab = 'characters' | 'world' | 'area' | 'personal' | 'changes' | 'random' | 'staging' | 'settings';

// --- Mock Data ---
const characters = [
  { id: 'CHR-001', name: '白梦梦', affection: 30, lust: 20 }
];

const worldRules = [
  { id: 1, title: '下克上', status: '生效中', desc: '上级会无条件的听从下级的指令' },
  { id: 2, title: '喵喵口癖', status: '生效中', desc: '所有女性说话都会以喵结尾。' }
];

const areaRules = [
  { id: 1, area: '圣华女子学院', count: 1, rules: ['1'] }
];

const personalRules = [
  { id: 1, person: '白梦梦', count: 1, rules: ['必须真空真空'] }
];

const changes = [
  { id: 1, type: 'world', title: '喵喵口癖', time: '3分钟前', desc: '全球范围内所有生理性别为女性的人群及其参与的所有语言社交场景。' },
  { id: 2, type: 'world', title: '下克上', time: '3分钟前', desc: '全球范围内所有存在明确职级、辈分或从属关系的社会组织、家庭机构及行政体系。' }
];

// --- Components ---

const TopBar = ({ title, desc, action }: { title: string, desc?: string, action?: React.ReactNode }) => (
  <div className="mb-8 border-b border-cyber-border pb-4">
    <div className="flex justify-between items-center mb-4">
      <h1 className="text-2xl font-display font-bold glitch-text" data-text={title}>{title}</h1>
      <button className="text-gray-400 hover:text-neon-cyan transition-colors">
        <X size={24} />
      </button>
    </div>
    {(desc || action) && (
      <div className="flex justify-between items-center">
        {desc && <p className="text-gray-400 text-sm">{desc}</p>}
        {action && action}
      </div>
    )}
  </div>
);

const CharacterPanel = () => {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selectedChar, setSelectedChar] = useState(characters[0]);

  if (view === 'edit') {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="h-full flex flex-col">
        <TopBar 
          title="人物属性编辑" 
          action={
            <button 
              onClick={() => setView('list')}
              className="text-gray-400 hover:text-neon-cyan transition-colors flex items-center gap-2 text-sm"
            >
              ← 返回角色列表
            </button>
          }
        />
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20">
          {/* Header Info */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-32 h-32 rounded-2xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-gray-600 shrink-0">
              <User size={64} />
            </div>
            <div className="flex-1">
              <h2 className="text-4xl font-display font-bold text-white mb-2 tracking-widest">{selectedChar.name}</h2>
              <div className="text-gray-400 font-mono text-sm space-y-1 mb-4">
                <p>ID: {selectedChar.id} | 状态: 出场中</p>
              </div>
              <div className="flex gap-4">
                <button className="cyber-button px-4 py-2 text-sm flex items-center gap-2 border-neon-red text-neon-red hover:bg-neon-red/10 hover:shadow-[0_0_10px_rgba(255,0,60,0.3)]">
                  <Trash2 size={16} /> 删除角色
                </button>
                <button className="cyber-button px-4 py-2 text-sm flex items-center gap-2 border-gray-500 text-gray-300 hover:border-neon-cyan hover:text-neon-cyan">
                  <Edit2 size={16} /> 编辑基础信息
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 生理指标 */}
            <div className="cyber-card p-5 rounded-xl">
              <div className="flex justify-between items-center mb-4 border-b border-cyber-border pb-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-neon-cyan">📈</span> 生理指标
                </h3>
              </div>
              <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">年龄</span>
                  <span className="text-white">18</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">身高</span>
                  <span className="text-white">165</span>
                </div>
                
                <div className="pt-4 border-t border-cyber-border/50 space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">好感度 AFFECTION</span>
                      <span className="text-neon-cyan">30 <span className="text-gray-600 text-xs">(-100~100)</span></span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-neon-cyan shadow-[0_0_5px_#00f3ff]" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">发情值 LUST</span>
                      <span className="text-neon-magenta">20/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-neon-magenta shadow-[0_0_5px_#ff00ff]" style={{ width: '20%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">性癖开发值 FETISH</span>
                      <span className="text-neon-purple">10/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-neon-purple shadow-[0_0_5px_#b026ff]" style={{ width: '10%' }}></div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-cyber-border/50">
                  <p className="text-gray-500 text-xs mb-1">当前综合生理描述</p>
                  <p className="text-gray-300">处于普通的无聊放松状态。</p>
                </div>
              </div>
            </div>

            {/* 心理状态 */}
            <div className="cyber-card p-5 rounded-xl">
              <div className="flex justify-between items-center mb-4 border-b border-cyber-border pb-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-neon-yellow">🧠</span> 心理状态
                </h3>
                <button className="text-xs text-gray-500 hover:text-neon-cyan">编辑</button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">当前想法</p>
                  <p className="text-gray-300 italic">班长好严格喵......</p>
                </div>
              </div>
            </div>

            {/* 性癖与敏感带 */}
            <div className="cyber-card p-5 rounded-xl">
              <div className="flex justify-between items-center mb-4 border-b border-cyber-border pb-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-neon-magenta">♥</span> 性癖与敏感带
                </h3>
                <button className="text-xs text-gray-500 hover:text-neon-cyan">编辑</button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 text-xs mb-2">敏感部位</p>
                  <div className="p-2 border border-cyber-border rounded bg-black/30 text-sm text-gray-300">
                    指尖：被碰到时会下意识瑟缩
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-2">性癖</p>
                  <div className="p-2 border border-cyber-border rounded bg-black/30 text-sm text-gray-300">
                    被关注：喜欢被人看着，会感到轻微的愉悦
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">隐藏性癖</p>
                  <p className="text-gray-400 text-sm">暂无</p>
                </div>
              </div>
            </div>

            {/* 身份标签 */}
            <div className="cyber-card p-5 rounded-xl">
              <div className="flex justify-between items-center mb-4 border-b border-cyber-border pb-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-neon-cyan">🏷</span> 身份标签
                </h3>
                <button className="text-xs text-gray-500 hover:text-neon-cyan">编辑</button>
              </div>
              <div className="text-gray-500 text-sm">
                暂无身份标签
              </div>
            </div>
            
            {/* 当前受影响规则 */}
            <div className="cyber-card p-5 rounded-xl md:col-span-2">
              <div className="flex justify-between items-center mb-4 border-b border-cyber-border pb-2">
                <h3 className="text-lg font-bold text-white">当前受影响规则</h3>
                <button className="text-xs text-gray-500 hover:text-neon-cyan">管理规则影响</button>
              </div>
              <div className="flex justify-between items-center p-3 cyber-flowing-border">
                <span className="text-sm text-gray-300">必须真空真空</span>
                <div className="flex gap-2">
                  <button className="p-1.5 text-neon-cyan hover:bg-neon-cyan/20 rounded transition-colors"><Edit2 size={16} /></button>
                  <button className="p-1.5 text-neon-yellow hover:bg-neon-yellow/20 rounded transition-colors"><BookOpen size={16} /></button>
                  <button className="p-1.5 text-neon-red hover:bg-neon-red/20 rounded transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
      <TopBar 
        title="人物属性编辑" 
        desc="管理当前世界中的所有角色实体。" 
        action={
          <button className="cyber-button cyber-button-cyan px-4 py-2 flex items-center gap-2 text-sm font-bold">
            <Plus size={16} /> 新增角色
          </button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map(char => (
          <div 
            key={char.id} 
            className="cyber-card p-4 rounded-lg cursor-pointer hover:-translate-y-1 transition-transform"
            onClick={() => {
              setSelectedChar(char);
              setView('edit');
            }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-neon-purple/20 border border-neon-purple flex items-center justify-center text-neon-purple">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{char.name}</h3>
                <p className="text-xs text-gray-400 font-mono">角色 | {char.id}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">好感度 AFFECTION</span>
                <span className="text-neon-cyan">{char.affection}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">发情值 LUST</span>
                <span className="text-neon-magenta">{char.lust}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const WorldRulesPanel = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
    <TopBar 
      title="世界规则管理" 
      desc="影响整个世界所有实体的基础法则。" 
      action={
        <button className="cyber-button px-4 py-2 flex items-center gap-2 text-sm font-bold">
          <Plus size={16} /> 新增世界规则
        </button>
      }
    />
    <div className="space-y-4">
      {worldRules.map(rule => (
        <div key={rule.id} className="cyber-card p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-white">{rule.title}</h3>
            <span className="px-2 py-0.5 text-xs border border-gray-600 text-gray-300 rounded font-mono bg-gray-800/50">
              {rule.status}
            </span>
          </div>
          <p className="text-gray-400 text-sm">{rule.desc}</p>
        </div>
      ))}
    </div>
  </motion.div>
);

const AreaRulesPanel = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
    <TopBar 
      title="区域规则管理" 
      desc="仅在特定地理区域或建筑内生效的规则。" 
      action={
        <button className="cyber-button px-4 py-2 flex items-center gap-2 text-sm font-bold">
          <Plus size={16} /> 新增区域
        </button>
      }
    />
    <div className="space-y-4">
      {areaRules.map(area => (
        <div key={area.id} className="cyber-card p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-neon-yellow">
              <Map size={18} />
              <h3 className="text-lg font-bold text-white">{area.area}</h3>
            </div>
            <span className="text-xs text-gray-500 font-mono">{area.count}/{area.count} 条 ^</span>
          </div>
          <div className="space-y-2">
            {area.rules.map((rule, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 cyber-flowing-border">
                <span className="text-sm">{rule}</span>
                <div className="flex gap-2">
                  <button className="p-1 text-neon-cyan hover:bg-neon-cyan/20 rounded"><Edit2 size={14} /></button>
                  <button className="p-1 text-neon-yellow hover:bg-neon-yellow/20 rounded"><BookOpen size={14} /></button>
                </div>
              </div>
            ))}
            <button className="w-full py-2 mt-2 cyber-dashed-btn text-gray-500 hover:text-neon-cyan transition-colors rounded text-sm flex items-center justify-center gap-2">
              <Plus size={14} /> 在该区域新增细分规则
            </button>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

const PersonalRulesPanel = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
    <TopBar 
      title="个人规则管理" 
      desc="针对特定个体的专属规则与设定。" 
      action={
        <button className="cyber-button px-4 py-2 flex items-center gap-2 text-sm font-bold">
          <Plus size={16} /> 新增个人规则
        </button>
      }
    />
    <div className="space-y-4">
      {personalRules.map(person => (
        <div key={person.id} className="cyber-card p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-neon-purple">
              <UserCircle size={18} />
              <h3 className="text-lg font-bold text-white">{person.person}</h3>
            </div>
            <span className="text-xs text-gray-500 font-mono">{person.count}/{person.count} 条 ^</span>
          </div>
          <div className="space-y-2">
            {person.rules.map((rule, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 cyber-flowing-border">
                <span className="text-sm">{rule}</span>
                <div className="flex gap-2">
                  <button className="p-1 text-neon-cyan hover:bg-neon-cyan/20 rounded"><Edit2 size={14} /></button>
                  <button className="p-1 text-neon-yellow hover:bg-neon-yellow/20 rounded"><BookOpen size={14} /></button>
                  <button className="p-1 text-neon-red hover:bg-neon-red/20 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

const ChangesPanel = () => {
  const [activeTab, setActiveTab] = useState<'world'|'personal'>('world');
  
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
      <TopBar title="世界和生活的变化" />
      
      <div className="flex gap-4 mb-6 border-b border-cyber-border pb-2">
        <button 
          className={`flex items-center gap-2 pb-2 px-2 font-bold transition-colors relative ${activeTab === 'world' ? 'text-neon-cyan' : 'text-gray-500 hover:text-gray-300'}`}
          onClick={() => setActiveTab('world')}
        >
          <Globe size={16} /> 世界 <span className="bg-neon-red text-white text-[10px] px-1.5 rounded-full">3</span>
          {activeTab === 'world' && <motion.div layoutId="tab-indicator" className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-neon-cyan shadow-[0_0_5px_#00f3ff]" />}
        </button>
        <button 
          className={`flex items-center gap-2 pb-2 px-2 font-bold transition-colors relative ${activeTab === 'personal' ? 'text-neon-cyan' : 'text-gray-500 hover:text-gray-300'}`}
          onClick={() => setActiveTab('personal')}
        >
          <User size={16} /> 个人
          {activeTab === 'personal' && <motion.div layoutId="tab-indicator" className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-neon-cyan shadow-[0_0_5px_#00f3ff]" />}
        </button>
      </div>

      <div className="space-y-6">
        <div className="cyber-card p-4 rounded-lg border-l-2 border-l-neon-red">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-white">1</h3>
            <div className="flex gap-2">
              <span className="text-xs border border-neon-yellow text-neon-yellow px-2 py-0.5 rounded">区域</span>
              <span className="text-xs bg-neon-red text-white px-2 py-0.5 rounded">新</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-4">影响范围：圣华女子学院全体师生及行政人员，以及该校区范围内的所有勤务人员。</p>
          <p className="text-sm text-gray-300">规则1生效后，圣华女子学院原本自由的校园氛围被一种诡异的“绝对同步”所取代。清晨6:00，全校三千名学生会如精密零件般同时睁眼，洗漱间不再有嬉闹声，取而代之的是整齐划一的刷牙频率和毛巾拧干声。食堂内，...</p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">历史记录</h4>
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-cyber-border before:to-transparent">
            {changes.map((change, idx) => (
              <div key={change.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-4 h-4 rounded-full border border-neon-cyan bg-cyber-bg shadow-[0_0_5px_#00f3ff] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] cyber-card p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500 font-mono">{change.time}</span>
                    <span className="text-xs border border-neon-red text-neon-red px-1.5 rounded bg-neon-red/10">世界</span>
                    <h4 className="font-bold text-white ml-2">{change.title}</h4>
                  </div>
                  <p className="text-sm text-gray-400">{change.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const RandomRulePanel = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col">
    <TopBar title="随机规则生成器" />
    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
      <div className="mb-6 text-neon-purple">
        <Zap size={48} className="mx-auto mb-4 drop-shadow-[0_0_10px_rgba(176,38,255,0.8)]" />
        <h2 className="text-xl font-bold mb-2 glitch-text" data-text="使用 AI 生成随机暧昧规则，为游戏增添情色变数">使用 AI 生成随机暧昧规则，为游戏增添情色变数</h2>
      </div>
      <p className="text-sm text-gray-400 mb-8">规则聚焦于带有暧昧暗示的日常行为习惯、身体接触、羞耻感与亲密行为的约束与改变；新生成会追加到列表，刷新页面前一直保留</p>
      <button className="cyber-button px-8 py-4 text-lg font-bold flex items-center gap-2">
        <Dices size={24} /> 生成随机规则
      </button>
    </div>
  </motion.div>
);

const StagingPanel = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col">
    <TopBar title="编辑暂存" />
    <div className="flex-1 flex flex-col">
      <p className="text-sm text-gray-400 mb-8">以下修改将在你点击「确认提交」后按顺序写入变量，并合并一段说明到输入框。</p>
      
      <div className="flex-1 flex items-center justify-center border-y border-cyber-border/30 bg-black/20">
        <span className="text-gray-500 font-mono tracking-widest">暂无暂存项</span>
      </div>
      
      <div className="pt-6 flex justify-between items-center">
        <button className="text-gray-500 hover:text-neon-red transition-colors text-sm">清空</button>
        <button className="cyber-button px-6 py-2 text-sm text-gray-500 border-gray-600 hover:bg-transparent hover:box-shadow-none cursor-not-allowed opacity-50">
          确认提交
        </button>
      </div>
    </div>
  </motion.div>
);

const SettingsPanel = () => {
  const [activeTab, setActiveTab] = useState<'api' | 'input' | 'layout'>('input');
  
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col">
      <div className="mb-8 border-b border-cyber-border pb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold glitch-text" data-text="系统设置">系统设置</h1>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-neon-purple/20 text-neon-purple border border-neon-purple rounded">v0.0.43-1-gde37b4e-dirty</span>
          </div>
          <button className="text-gray-400 hover:text-neon-cyan transition-colors">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button 
          className={`flex-1 py-2 rounded border transition-all flex items-center justify-center gap-2 text-sm font-bold ${activeTab === 'api' ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10 shadow-[0_0_10px_rgba(0,243,255,0.2)]' : 'border-cyber-border text-gray-400 hover:border-gray-500'}`}
          onClick={() => setActiveTab('api')}
        >
          <Settings size={16} /> 输出与 API
        </button>
        <button 
          className={`flex-1 py-2 rounded border transition-all flex items-center justify-center gap-2 text-sm font-bold ${activeTab === 'input' ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10 shadow-[0_0_10px_rgba(0,243,255,0.2)]' : 'border-cyber-border text-gray-400 hover:border-gray-500'}`}
          onClick={() => setActiveTab('input')}
        >
          <BookOpen size={16} /> 选项与输入
        </button>
        <button 
          className={`flex-1 py-2 rounded border transition-all flex items-center justify-center gap-2 text-sm font-bold ${activeTab === 'layout' ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10 shadow-[0_0_10px_rgba(0,243,255,0.2)]' : 'border-cyber-border text-gray-400 hover:border-gray-500'}`}
          onClick={() => setActiveTab('layout')}
        >
          <Map size={16} /> 界面与布局
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20">
        {activeTab === 'input' && (
          <>
            <div className="cyber-card p-5 rounded-xl border-neon-yellow/50 bg-gradient-to-br from-neon-yellow/5 to-transparent">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-neon-yellow/20 rounded text-neon-yellow">
                  <BookOpen size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">编辑暂存 (购物车)</h3>
                  <p className="text-xs text-gray-400">默认开启。开启后修改世界/区域/个人规则与角色等先入队，在侧栏「暂存」统一检视后再写入变量；关闭后每次操作立即生效。</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-cyber-border/50">
                <div>
                  <h4 className="text-sm text-white mb-1">启用编辑暂存</h4>
                  <p className="text-xs text-gray-500">关闭时若购物车非空将询问是否清空暂存</p>
                </div>
                <div className="w-12 h-6 bg-neon-cyan/20 rounded-full relative cursor-pointer border border-neon-cyan shadow-[0_0_5px_rgba(0,243,255,0.3)]">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-neon-cyan rounded-full shadow-[0_0_5px_#00f3ff]"></div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-sm text-gray-400 mb-4">点击剧情选项 (A / B / C 等) 时，将选项文本直接发送给 AI，或仅填入本界面底部输入框 (可再编辑后手动发送)，在此选择行为。</p>
              
              <div className="space-y-4">
                <div className="cyber-card p-5 rounded-xl cursor-pointer hover:border-gray-500 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-cyber-surface rounded-lg text-neon-cyan border border-cyber-border">
                      <Zap size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">直接发送</h3>
                          <span className="px-2 py-0.5 text-[10px] bg-cyber-surface border border-cyber-border text-gray-400 rounded">快捷</span>
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 border-gray-600"></div>
                      </div>
                      <p className="text-sm text-gray-400 mb-4">选项文本填入输入框并立即发送</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-neon-green"><span className="text-neon-cyan">✓</span> 一键推进剧情</div>
                        <div className="flex items-center gap-2 text-neon-green"><span className="text-neon-cyan">✓</span> 适合信任选项措辞时</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cyber-card p-5 rounded-xl border-neon-cyan bg-neon-cyan/5 shadow-[0_0_15px_rgba(0,243,255,0.1)] cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-neon-cyan/20 rounded-lg text-neon-cyan border border-neon-cyan shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                      <Edit2 size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">填入输入框</h3>
                          <span className="px-2 py-0.5 text-[10px] bg-neon-cyan/20 border border-neon-cyan text-neon-cyan rounded">默认</span>
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 border-neon-cyan bg-neon-cyan flex items-center justify-center shadow-[0_0_5px_#00f3ff]">
                          <span className="text-black text-xs font-bold">✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'api' && (
          <>
            <div className="cyber-card p-5 rounded-xl border-cyber-border bg-gradient-to-br from-cyber-surface to-transparent">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-cyber-surface border border-cyber-border rounded text-gray-300">
                  <Globe size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white">数据库联动 (可选)</h3>
                  </div>
                  <p className="text-xs text-gray-400">未安装扩展时不会产生实际调用。</p>
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-cyber-border/50">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm text-white mb-1">剧情推进</h4>
                    <p className="text-xs text-gray-500">发送消息前标记意图，供数据库写入规划数据</p>
                  </div>
                  <div className="w-12 h-6 bg-neon-cyan/20 rounded-full relative cursor-pointer border border-neon-cyan shadow-[0_0_5px_rgba(0,243,255,0.3)]">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-neon-cyan rounded-full shadow-[0_0_5px_#00f3ff]"></div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-cyber-border/30">
                  <div>
                    <h4 className="text-sm text-white mb-1">自动填表</h4>
                    <p className="text-xs text-gray-500">确认标签并写入楼层后调用「立即手动更新」</p>
                  </div>
                  <div className="w-12 h-6 bg-neon-cyan/20 rounded-full relative cursor-pointer border border-neon-cyan shadow-[0_0_5px_rgba(0,243,255,0.3)]">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-neon-cyan rounded-full shadow-[0_0_5px_#00f3ff]"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="cyber-card p-5 rounded-xl cursor-pointer hover:border-gray-500 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-cyber-surface rounded-lg text-gray-400 border border-cyber-border">
                    <Settings size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">单API模式</h3>
                        <span className="px-2 py-0.5 text-[10px] bg-cyber-surface border border-cyber-border text-gray-400 rounded">默认</span>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 border-gray-600"></div>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">一次输出完整剧情 + 变量更新</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-300"><span className="text-neon-cyan">✓</span> 简单直接，适合大多数场景</div>
                      <div className="flex items-center gap-2 text-gray-300"><span className="text-neon-cyan">✓</span> 无需额外配置</div>
                      <div className="flex items-center gap-2 text-gray-300"><span className="text-neon-cyan">✓</span> 使用世界书变量规则</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cyber-card p-5 rounded-xl border-neon-purple bg-neon-purple/5 shadow-[0_0_15px_rgba(176,38,255,0.1)] cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-neon-purple/20 rounded-lg text-neon-purple border border-neon-purple shadow-[0_0_10px_rgba(176,38,255,0.2)]">
                    <Globe2 size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">双API模式</h3>
                        <span className="px-2 py-0.5 text-[10px] bg-neon-purple/20 border border-neon-purple text-neon-purple rounded">高级</span>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 border-neon-purple bg-neon-purple flex items-center justify-center shadow-[0_0_5px_#b026ff]">
                        <span className="text-black text-xs font-bold">✓</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'layout' && (
          <>
            <p className="text-sm text-gray-400 mb-6">调整整体字号与控件比例 (缩放)、主界面最大宽度与最大高度。开局表单与进入游戏后的主 UI 会读取同一套设置。</p>
            
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-white">界面缩放</h4>
                  <span className="text-xs font-mono bg-cyber-surface border border-cyber-border px-2 py-1 rounded">0.80×</span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full mb-2">
                  <div className="absolute left-0 top-0 bottom-0 w-[20%] bg-neon-cyan shadow-[0_0_5px_#00f3ff] rounded-l-full"></div>
                  <div className="absolute left-[20%] top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_#00f3ff] border border-neon-cyan cursor-pointer"></div>
                </div>
                <p className="text-xs text-gray-500">范围 0.8 ~ 1.3，默认 0.8。影响 <code className="bg-black/50 px-1 rounded">--ui-scale</code>。</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-white">主界面最大宽度 (px)</h4>
                  <span className="text-xs font-mono bg-cyber-surface border border-cyber-border px-2 py-1 rounded">300 px</span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full mb-2">
                  <div className="absolute left-0 top-0 bottom-0 w-[10%] bg-neon-cyan shadow-[0_0_5px_#00f3ff] rounded-l-full"></div>
                  <div className="absolute left-[10%] top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_#00f3ff] border border-neon-cyan cursor-pointer"></div>
                </div>
                <p className="text-xs text-gray-500">300 ~ 2400，默认 900。</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-white">主界面最大高度 (px)</h4>
                  <span className="text-xs font-mono bg-cyber-surface border border-cyber-border px-2 py-1 rounded">700 px</span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full mb-2">
                  <div className="absolute left-0 top-0 bottom-0 w-[40%] bg-neon-cyan shadow-[0_0_5px_#00f3ff] rounded-l-full"></div>
                  <div className="absolute left-[40%] top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_#00f3ff] border border-neon-cyan cursor-pointer"></div>
                </div>
                <p className="text-xs text-gray-500">600 ~ 1000，与 iframe 最小高度对齐。</p>
              </div>
            </div>

            <div className="mt-8 p-4 border border-cyber-border/50 bg-black/20 rounded text-xs text-gray-500 leading-relaxed">
              「高度模式」仅随存档保留字段，主界面尚未按该选项分支；当前实际高度以「最大高度」数值为准。调整缩放或宽高后会有轻提示。
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('characters');

  const navItems = [
    { id: 'characters', icon: BookOpen },
    { id: 'personal', icon: User },
    { id: 'world', icon: Globe },
    { id: 'area', icon: Map },
    { id: 'changes', icon: Globe2 },
    { id: 'random', icon: Dices },
  ];

  return (
    <div className="min-h-screen bg-cyber-bg text-gray-200 flex overflow-hidden relative">
      {/* Background Layers */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 blur-[3px]"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2070&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 to-[#050505]/95" />
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(0, 243, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 243, 255, 0.04) 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }} />
      </div>

      <div className="scanline z-50"></div>
      
      {/* Sidebar */}
      <div className="w-16 md:w-20 bg-cyber-surface/60 backdrop-blur-md border-r border-cyber-border flex flex-col items-center py-6 z-10 relative">
        <div className="mb-8 text-neon-cyan">
          <BookOpen size={28} className="drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]" />
        </div>
        
        <div className="flex-1 flex flex-col gap-4 w-full">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`relative w-full flex justify-center py-3 transition-colors ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-neon-cyan shadow-[0_0_10px_#00f3ff]"
                  />
                )}
                <div className={`p-2 rounded-lg ${isActive ? 'bg-white/10 shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]' : ''}`}>
                  <Icon size={22} className={isActive ? 'drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]' : ''} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-4 w-full">
          <button 
            onClick={() => setActiveTab('staging')}
            className={`w-full flex justify-center py-3 transition-colors ${activeTab === 'staging' ? 'text-neon-cyan drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]' : 'text-gray-500 hover:text-neon-cyan'}`}
          >
            <BookOpen size={22} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex justify-center py-3 transition-colors ${activeTab === 'settings' ? 'text-neon-cyan drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]' : 'text-gray-500 hover:text-neon-cyan'}`}
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto relative z-10">
        <div className="max-w-5xl mx-auto h-full">
          <AnimatePresence mode="wait">
            {activeTab === 'characters' && <CharacterPanel key="characters" />}
            {activeTab === 'world' && <WorldRulesPanel key="world" />}
            {activeTab === 'area' && <AreaRulesPanel key="area" />}
            {activeTab === 'personal' && <PersonalRulesPanel key="personal" />}
            {activeTab === 'changes' && <ChangesPanel key="changes" />}
            {activeTab === 'random' && <RandomRulePanel key="random" />}
            {activeTab === 'staging' && <StagingPanel key="staging" />}
            {activeTab === 'settings' && <SettingsPanel key="settings" />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
