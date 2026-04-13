import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Hexagon, 
  Shield, 
  Store, 
  Sparkles, 
  Wrench, 
  Users, 
  Activity as ActivityIcon,
  Settings,
  X,
  Plus,
  Map as MapIcon,
  Trash2,
  Save,
  LayoutGrid,
  Wand2,
  Edit3,
  Eye,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

// --- Constants ---
const CELL_SIZE = 64;
const ZOOM_THRESHOLD = 0.5; // Scale below which buildings are hidden

// --- Types ---

type BuildingType = 'core' | 'military' | 'commercial' | 'research' | 'industrial';
type MapStyle = 'sci_fi' | 'western_medieval' | 'eastern_medieval' | 'future' | 'modern';

interface Person {
  id: string;
  name: string;
  role: string;
}

interface Activity {
  id: string;
  name: string;
  progress: number; // 0-100
}

interface CustomProperty {
  id: string;
  key: string;
  value: string;
}

interface Room {
  id: string;
  name: string;
  type: string;
}

interface Building {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  type: BuildingType;
  description: string;
  people: Person[];
  activities: Activity[];
  rooms: Room[];
  customProperties: CustomProperty[];
}

interface Region {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Initial Data & Config ---

const INITIAL_REGIONS: Region[] = [
  {
    id: 'r_init',
    name: '初始营地',
    description: '最初建立的定居点，设施基础但功能齐全。',
    x: 6,
    y: 6,
    width: 10,
    height: 10
  }
];

const INITIAL_BUILDINGS: Building[] = [
  {
    id: 'b1',
    x: 10,
    y: 10,
    width: 2,
    height: 2,
    name: '核心枢纽',
    type: 'core',
    description: '聚落的核心建筑，控制主要功能和后勤调度。',
    people: [
      { id: 'p1', name: '林指挥官', role: '领袖' },
      { id: 'p2', name: '艾拉', role: '顾问' }
    ],
    activities: [
      { id: 'a1', name: '同步核心数据/能量', progress: 75 },
      { id: 'a2', name: '升级防御系统', progress: 30 }
    ],
    rooms: [
      { id: 'r1', name: '主控室', type: '控制' },
      { id: 'r2', name: '能源室', type: '能源' }
    ],
    customProperties: [
      { id: 'cp1', key: '能量等级', value: '高' },
      { id: 'cp2', key: '科技/魔法层级', value: '3' }
    ]
  },
  {
    id: 'b2',
    x: 13,
    y: 8,
    width: 1,
    height: 2,
    name: '外围卫戍区',
    type: 'military',
    description: '用于训练和防御的军事哨所。',
    people: [
      { id: 'p3', name: '新兵 凯尔', role: '受训者' }
    ],
    activities: [
      { id: 'a3', name: '战斗演练', progress: 50 }
    ],
    rooms: [
      { id: 'r3', name: '兵营', type: '居住' }
    ],
    customProperties: [
      { id: 'cp3', key: '安全评级', value: 'Alpha' }
    ]
  },
  {
    id: 'b3',
    x: 8,
    y: 12,
    width: 2,
    height: 1,
    name: '交易集市',
    type: 'commercial',
    description: '商品、物资和遗物交易的中心。',
    people: [],
    activities: [],
    rooms: [],
    customProperties: []
  }
];

const TYPE_CONFIG: Record<BuildingType, { icon: React.ElementType, label: string }> = {
  core: { icon: Hexagon, label: '核心枢纽' },
  military: { icon: Shield, label: '军事防卫' },
  commercial: { icon: Store, label: '商业贸易' },
  research: { icon: Sparkles, label: '研究探索' },
  industrial: { icon: Wrench, label: '工业生产' }
};

const THEMES: Record<MapStyle, { name: string, className: string }> = {
  sci_fi: { name: '科幻 (Sci-Fi)', className: '' }, // Default
  western_medieval: { name: '西方中世纪 (Western Fantasy)', className: 'theme-western' },
  eastern_medieval: { name: '东方中世纪 (Eastern Fantasy)', className: 'theme-eastern' },
  future: { name: '未来 (Cyberpunk)', className: 'theme-future' },
  modern: { name: '现代 (Modern)', className: 'theme-modern' }
};

// --- Main Component ---

export default function App() {
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_BUILDINGS);
  const [regions, setRegions] = useState<Region[]>(INITIAL_REGIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('sci_fi');
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
  const [scale, setScale] = useState(1);
  
  // AI Generation State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedBuilding = buildings.find(b => b.id === selectedId);
  const showBuildings = scale >= ZOOM_THRESHOLD;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale(prev => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        return Math.min(Math.max(0.1, prev + delta), 3);
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMapClick = (e: React.MouseEvent) => {
    if (e.target === mapRef.current) {
      setSelectedId(null);
      setIsEditingPanel(false);
    }
  };

  const handleAddBuilding = () => {
    if (!isGlobalEditMode) return;
    const newBuilding: Building = {
      id: `b_${Date.now()}`,
      x: 10 + Math.floor(Math.random() * 5) - 2,
      y: 10 + Math.floor(Math.random() * 5) - 2,
      width: 1,
      height: 1,
      name: '新建模块',
      type: 'core',
      description: '一个刚刚建立的新建筑模块。',
      people: [],
      activities: [],
      rooms: [],
      customProperties: []
    };
    setBuildings([...buildings, newBuilding]);
    setSelectedId(newBuilding.id);
    setIsEditingPanel(true);
    // Auto zoom in if zoomed out too much when adding a building
    if (scale < ZOOM_THRESHOLD) {
      setScale(1);
    }
  };

  const updateBuilding = (id: string, updates: Partial<Building>) => {
    setBuildings(buildings.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBuilding = (id: string) => {
    setBuildings(buildings.filter(b => b.id !== id));
    setSelectedId(null);
    setIsEditingPanel(false);
  };

  const handleAIGenerate = async (promptInput: string) => {
    if (!process.env.GEMINI_API_KEY) {
      alert("未找到 GEMINI_API_KEY，请在环境变量中配置。");
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const themeName = THEMES[mapStyle].name;
      
      const existingRegionsInfo = regions.map(r => `[${r.name}: x=${r.x}, y=${r.y}, 宽=${r.width}, 高=${r.height}]`).join(', ');

      const prompt = `你是一个游戏地图设计专家。当前地图风格是【${themeName}】。
      请生成一个全新的【区域 (Region)】，以及该区域内的 3 到 6 个【建筑 (Buildings)】。
      
      用户要求生成这样的区域：${promptInput ? promptInput : '随机生成一个符合世界观的特色区域'}
      
      当前地图上已经有以下区域，请避开这些坐标范围：${existingRegionsInfo || '无'}
      
      要求：
      1. 区域的坐标 x 和 y 请在 2 到 40 之间选择一个空旷位置（避开已有区域）。
      2. 区域的宽度(width)和高度(height)大约在 8 到 15 之间。
      3. 建筑的坐标必须在区域的范围内（即建筑的 x >= 区域的 x 且 x + width <= 区域的 x + 区域的 width，y 同理）。
      4. 建筑的 width 和 height 在 1 到 4 之间。
      5. 建筑之间不能互相重叠。
      6. 建筑需要包含生动的名字、描述、内部房间、当前活动和NPC人物。
      7. 全部使用中文。`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              region: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER },
                  width: { type: Type.INTEGER },
                  height: { type: Type.INTEGER }
                },
                required: ["id", "name", "description", "x", "y", "width", "height"]
              },
              buildings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    x: { type: Type.INTEGER },
                    y: { type: Type.INTEGER },
                    width: { type: Type.INTEGER },
                    height: { type: Type.INTEGER },
                    name: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['core', 'military', 'commercial', 'research', 'industrial'] },
                    description: { type: Type.STRING },
                    people: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          name: { type: Type.STRING },
                          role: { type: Type.STRING }
                        }
                      }
                    },
                    activities: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          name: { type: Type.STRING },
                          progress: { type: Type.INTEGER }
                        }
                      }
                    },
                    rooms: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          name: { type: Type.STRING },
                          type: { type: Type.STRING }
                        }
                      }
                    },
                    customProperties: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          key: { type: Type.STRING },
                          value: { type: Type.STRING }
                        }
                      }
                    }
                  },
                  required: ["id", "x", "y", "width", "height", "name", "type", "description", "people", "activities", "rooms", "customProperties"]
                }
              }
            },
            required: ["region", "buildings"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        
        // Ensure unique IDs to prevent React key collisions if AI reuses IDs
        const uniqueSuffix = Date.now().toString();
        const newRegion = { ...data.region, id: `r_${uniqueSuffix}` };
        const newBuildings = data.buildings.map((b: any, i: number) => ({
          ...b,
          id: `b_${uniqueSuffix}_${i}`
        }));

        setRegions(prev => [...prev, newRegion]);
        setBuildings(prev => [...prev, ...newBuildings]);
        setShowGenerateModal(false);
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("AI 生成失败，请检查控制台或 API Key。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`w-screen h-screen overflow-hidden font-sans flex dynamic-bg ${THEMES[mapStyle].className}`}>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-16 dynamic-panel z-10 flex items-center justify-between px-6 border-b dynamic-border shadow-md">
        <div className="flex items-center gap-3">
          <MapIcon className="w-6 h-6 dynamic-accent" />
          <h1 className="text-lg font-semibold tracking-wide dynamic-text">多重宇宙地图编辑器</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value as MapStyle)}
            className="dynamic-input border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent"
          >
            {Object.entries(THEMES).map(([key, theme]) => (
              <option key={key} value={key}>{theme.name}</option>
            ))}
          </select>

          <div className="h-6 w-px bg-current opacity-20 dynamic-text"></div>

          <button
            onClick={() => {
              setIsGlobalEditMode(!isGlobalEditMode);
              setIsEditingPanel(false);
            }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors text-sm font-medium border ${
              isGlobalEditMode 
                ? 'bg-current dynamic-accent text-white border-transparent' 
                : 'dynamic-border dynamic-text hover:bg-black/5'
            }`}
            style={isGlobalEditMode ? { color: 'var(--bg-color)', backgroundColor: 'var(--accent-color)' } : {}}
          >
            {isGlobalEditMode ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isGlobalEditMode ? '编辑模式' : '浏览模式'}
          </button>

          {isGlobalEditMode && (
            <>
              <button 
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors text-sm font-medium border dynamic-border dynamic-accent hover:bg-black/5"
              >
                <Wand2 className="w-4 h-4" />
                AI 生成区域
              </button>

              <button 
                onClick={handleAddBuilding}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors text-sm font-medium border dynamic-border dynamic-accent hover:bg-black/5"
              >
                <Plus className="w-4 h-4" />
                建造模块
              </button>
            </>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
      >
        <motion.div 
          drag 
          dragConstraints={{ left: -2000, right: 2000, top: -2000, bottom: 2000 }}
          className="absolute w-[4000px] h-[4000px] dynamic-grid left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center"
          style={{ scale }}
          ref={mapRef}
          onPointerDown={handleMapClick}
        >
          {/* Render Regions */}
          {regions.map(region => (
            <div
              key={region.id}
              className="absolute border-2 border-dashed dynamic-border rounded-xl pointer-events-none flex flex-col overflow-hidden transition-all duration-500"
              style={{
                left: region.x * CELL_SIZE,
                top: region.y * CELL_SIZE,
                width: region.width * CELL_SIZE,
                height: region.height * CELL_SIZE,
                backgroundColor: showBuildings ? 'var(--grid-color)' : 'var(--panel-bg)',
                opacity: showBuildings ? 1 : 0.8,
                borderStyle: showBuildings ? 'dashed' : 'solid',
                borderWidth: showBuildings ? '2px' : '4px',
              }}
            >
              <div 
                className={`px-3 py-1.5 backdrop-blur-sm border-b dynamic-border w-fit rounded-br-xl transition-all duration-500 ${showBuildings ? 'border-dashed' : 'border-solid'}`} 
                style={{ backgroundColor: 'var(--panel-bg)' }}
              >
                <h3 className={`font-bold dynamic-text flex items-center gap-2 transition-all duration-500 ${showBuildings ? 'text-sm' : 'text-2xl'}`}>
                  <MapIcon className={`${showBuildings ? 'w-3.5 h-3.5' : 'w-6 h-6'} dynamic-accent`} />
                  {region.name}
                </h3>
                {showBuildings && (
                  <p className="text-xs dynamic-text-muted mt-0.5 max-w-[200px] truncate">{region.description}</p>
                )}
              </div>
              
              {!showBuildings && (
                <div className="flex-1 flex items-center justify-center p-8">
                  <p className="text-xl dynamic-text-muted text-center max-w-md leading-relaxed opacity-70">
                    {region.description}
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Render Buildings */}
          <AnimatePresence>
            {showBuildings && buildings.map(building => (
              <motion.div
                key={building.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <BuildingNode 
                  building={building} 
                  isSelected={selectedId === building.id}
                  isGlobalEditMode={isGlobalEditMode}
                  onClick={() => {
                    setSelectedId(building.id);
                    setIsEditingPanel(false);
                  }}
                  onDragEnd={(x, y) => updateBuilding(building.id, { x, y })}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-10">
        <button 
          onClick={() => setScale(s => Math.min(s + 0.2, 3))} 
          className="p-2 dynamic-panel border dynamic-border rounded-md shadow-md hover:bg-black/5 transition-colors"
          title="放大 (滚轮向上)"
        >
          <ZoomIn className="w-5 h-5 dynamic-text" />
        </button>
        <button 
          onClick={() => setScale(s => Math.max(s - 0.2, 0.1))} 
          className="p-2 dynamic-panel border dynamic-border rounded-md shadow-md hover:bg-black/5 transition-colors"
          title="缩小 (滚轮向下)"
        >
          <ZoomOut className="w-5 h-5 dynamic-text" />
        </button>
        <button 
          onClick={() => setScale(1)} 
          className="p-2 dynamic-panel border dynamic-border rounded-md shadow-md hover:bg-black/5 transition-colors flex items-center justify-center"
          title="重置缩放"
        >
          <Maximize className="w-5 h-5 dynamic-text" />
        </button>
        <div className="mt-1 text-center text-xs font-mono font-bold dynamic-text bg-black/10 rounded px-1 py-0.5 backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {selectedBuilding && showBuildings && (
          <motion.div 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-16 bottom-0 w-96 dynamic-panel border-l dynamic-border flex flex-col z-20 shadow-2xl"
          >
            {isEditingPanel && isGlobalEditMode ? (
              <EditPanel 
                building={selectedBuilding} 
                onUpdate={(updates) => updateBuilding(selectedBuilding.id, updates)}
                onClose={() => setIsEditingPanel(false)}
                onDelete={() => deleteBuilding(selectedBuilding.id)}
              />
            ) : (
              <ViewPanel 
                building={selectedBuilding} 
                isGlobalEditMode={isGlobalEditMode}
                onEdit={() => setIsEditingPanel(true)}
                onClose={() => setSelectedId(null)}
                onAddActivity={() => {
                  if (isGlobalEditMode) {
                    const newActivity = { id: `a_${Date.now()}`, name: '新活动', progress: 0 };
                    updateBuilding(selectedBuilding.id, { activities: [...selectedBuilding.activities, newActivity] });
                    setIsEditingPanel(true);
                  }
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Generation Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <GenerateModal 
            onClose={() => !isGenerating && setShowGenerateModal(false)}
            onGenerate={handleAIGenerate}
            isGenerating={isGenerating}
            themeName={THEMES[mapStyle].name}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Subcomponents ---

function GenerateModal({ 
  onClose, 
  onGenerate, 
  isGenerating,
  themeName
}: { 
  onClose: () => void, 
  onGenerate: (prompt: string) => void, 
  isGenerating: boolean,
  themeName: string
}) {
  const [prompt, setPrompt] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-[480px] dynamic-panel border dynamic-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-5 border-b dynamic-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 dynamic-accent" />
            <h2 className="text-base font-bold dynamic-text">AI 生成新区域</h2>
          </div>
          {!isGenerating && (
            <button onClick={onClose} className="dynamic-text-muted hover:dynamic-text">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm dynamic-text-muted">
            当前世界观：<strong className="dynamic-text">{themeName}</strong><br/>
            AI 将在地图的空旷位置生成一个带有边界框的新区域，并在其中自动放置 3-6 个符合设定的建筑。
          </p>
          
          <div>
            <label className="block text-sm font-medium dynamic-text mb-2">
              你想生成什么类型的区域？(可选)
            </label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：贫民窟、皇家法师塔、星际黑市、废弃的生化实验室... 留空则完全随机生成。"
              rows={3}
              disabled={isGenerating}
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent resize-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="p-4 border-t dynamic-border flex justify-end gap-3 bg-black/10">
          <button 
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-md text-sm font-medium dynamic-text hover:bg-black/5 disabled:opacity-50"
          >
            取消
          </button>
          <button 
            onClick={() => onGenerate(prompt)}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium border border-transparent bg-current dynamic-accent text-white hover:opacity-90 disabled:opacity-70 transition-all"
            style={{ color: 'var(--bg-color)', backgroundColor: 'var(--accent-color)' }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在生成区域与建筑...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                开始生成
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function BuildingNode({ 
  building, 
  isSelected, 
  isGlobalEditMode,
  onClick,
  onDragEnd 
}: { 
  building: Building; 
  isSelected: boolean; 
  isGlobalEditMode: boolean;
  onClick: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const config = TYPE_CONFIG[building.type];
  const Icon = config.icon;

  return (
    <motion.div
      drag={isGlobalEditMode}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (!isGlobalEditMode) return;
        const newX = Math.round((building.x * CELL_SIZE + info.offset.x) / CELL_SIZE);
        const newY = Math.round((building.y * CELL_SIZE + info.offset.y) / CELL_SIZE);
        onDragEnd(newX, newY);
      }}
      className={`absolute flex flex-col items-center justify-center group ${isGlobalEditMode ? 'cursor-move' : 'cursor-pointer'}`}
      style={{
        width: building.width * CELL_SIZE,
        height: building.height * CELL_SIZE,
        left: building.x * CELL_SIZE,
        top: building.y * CELL_SIZE,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className={`relative w-full h-full rounded-lg flex items-center justify-center transition-all duration-300 border-2 dynamic-building ${
        isSelected ? 'dynamic-building-selected' : 'group-hover:border-current'
      }`}>
        <Icon className="w-8 h-8 dynamic-accent opacity-80" />
        
        {/* Activity Indicator */}
        {building.activities.length > 0 && (
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full animate-pulse bg-current dynamic-accent shadow-lg" />
        )}
      </div>
      
      <div className="absolute -bottom-6 px-2 py-1 rounded text-xs font-mono whitespace-nowrap border dynamic-border dynamic-panel dynamic-text shadow-sm pointer-events-none">
        {building.name}
      </div>
    </motion.div>
  );
}

function ViewPanel({ 
  building, 
  isGlobalEditMode, 
  onEdit, 
  onClose,
  onAddActivity
}: { 
  building: Building, 
  isGlobalEditMode: boolean, 
  onEdit: () => void, 
  onClose: () => void,
  onAddActivity: () => void
}) {
  const config = TYPE_CONFIG[building.type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-6 border-b dynamic-border relative">
        <button onClick={onClose} className="absolute top-4 right-4 dynamic-text-muted hover:dynamic-text">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-md border dynamic-border dynamic-building dynamic-accent">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold dynamic-text">{building.name}</h2>
            <p className="text-xs font-mono dynamic-text-muted">{config.label} | {building.width}x{building.height}</p>
          </div>
        </div>
        <p className="text-sm dynamic-text-muted mt-4 leading-relaxed">{building.description}</p>
        
        {isGlobalEditMode && (
          <button 
            onClick={onEdit}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-md transition-colors text-sm border dynamic-border dynamic-text hover:bg-black/5"
          >
            <Settings className="w-4 h-4" />
            编辑建筑
          </button>
        )}
      </div>

      {/* Custom Properties */}
      {building.customProperties.length > 0 && (
        <div className="p-6 border-b dynamic-border">
          <h3 className="text-xs font-bold uppercase tracking-wider dynamic-text-muted mb-3">自定义属性</h3>
          <div className="space-y-2">
            {building.customProperties.map(prop => (
              <div key={prop.id} className="flex justify-between text-sm">
                <span className="dynamic-text-muted">{prop.key}</span>
                <span className="font-mono dynamic-text">{prop.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rooms */}
      <div className="p-6 border-b dynamic-border">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="w-4 h-4 dynamic-accent" />
          <h3 className="text-sm font-bold dynamic-text">内部房间布局</h3>
        </div>
        {building.rooms.length === 0 ? (
          <p className="text-sm dynamic-text-muted italic">暂无划分房间。</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {building.rooms.map(room => (
              <div key={room.id} className="p-2 rounded-md border dynamic-border text-center">
                <div className="text-sm font-medium dynamic-text">{room.name}</div>
                <div className="text-xs dynamic-text-muted">{room.type}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activities */}
      <div className="p-6 border-b dynamic-border">
        <div className="flex items-center gap-2 mb-4">
          <ActivityIcon className="w-4 h-4 dynamic-accent" />
          <h3 className="text-sm font-bold dynamic-text">当前活动</h3>
        </div>
        {building.activities.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm dynamic-text-muted italic mb-3">暂无活动。</p>
            {isGlobalEditMode && (
              <button 
                onClick={onAddActivity}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border dynamic-border dynamic-text hover:bg-black/5 text-xs"
              >
                <Plus className="w-3 h-3" /> 新建活动
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {building.activities.map(act => (
              <div key={act.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="dynamic-text">{act.name}</span>
                  <span className="dynamic-accent font-mono">{act.progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden dynamic-border border">
                  <div 
                    className="h-full bg-current dynamic-accent" 
                    style={{ width: `${act.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* People */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 dynamic-accent" />
          <h3 className="text-sm font-bold dynamic-text">居住/驻扎人员</h3>
        </div>
        {building.people.length === 0 ? (
          <p className="text-sm dynamic-text-muted italic">建筑内空无一人。</p>
        ) : (
          <div className="space-y-3">
            {building.people.map(person => (
              <div key={person.id} className="flex items-center justify-between p-3 rounded-md border dynamic-border">
                <span className="text-sm font-medium dynamic-text">{person.name}</span>
                <span className="text-xs font-mono dynamic-text-muted px-2 py-1 rounded border dynamic-border">{person.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditPanel({ building, onUpdate, onClose, onDelete }: { building: Building, onUpdate: (updates: Partial<Building>) => void, onClose: () => void, onDelete: () => void }) {
  const [formData, setFormData] = useState<Building>(building);

  const handleChange = (field: keyof Building, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(formData);
    onClose();
  };

  const addCustomProperty = () => {
    handleChange('customProperties', [
      ...formData.customProperties, 
      { id: `cp_${Date.now()}`, key: '新属性', value: '值' }
    ]);
  };

  const updateCustomProperty = (id: string, field: 'key' | 'value', val: string) => {
    handleChange('customProperties', formData.customProperties.map(cp => 
      cp.id === id ? { ...cp, [field]: val } : cp
    ));
  };

  const removeCustomProperty = (id: string) => {
    handleChange('customProperties', formData.customProperties.filter(cp => cp.id !== id));
  };

  const addRoom = () => {
    handleChange('rooms', [
      ...formData.rooms,
      { id: `r_${Date.now()}`, name: '新房间', type: '通用' }
    ]);
  };

  const updateRoom = (id: string, field: 'name' | 'type', val: string) => {
    handleChange('rooms', formData.rooms.map(r => 
      r.id === id ? { ...r, [field]: val } : r
    ));
  };

  const removeRoom = (id: string) => {
    handleChange('rooms', formData.rooms.filter(r => r.id !== id));
  };

  const addPerson = () => {
    handleChange('people', [
      ...formData.people,
      { id: `p_${Date.now()}`, name: '未知人员', role: '平民' }
    ]);
  };

  const updatePerson = (id: string, field: 'name' | 'role', val: string) => {
    handleChange('people', formData.people.map(p => 
      p.id === id ? { ...p, [field]: val } : p
    ));
  };

  const removePerson = (id: string) => {
    handleChange('people', formData.people.filter(p => p.id !== id));
  };

  const addActivity = () => {
    handleChange('activities', [
      ...formData.activities,
      { id: `a_${Date.now()}`, name: '新活动', progress: 0 }
    ]);
  };

  const updateActivity = (id: string, field: 'name' | 'progress', val: string | number) => {
    handleChange('activities', formData.activities.map(a => 
      a.id === id ? { ...a, [field]: val } : a
    ));
  };

  const removeActivity = (id: string) => {
    handleChange('activities', formData.activities.filter(a => a.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b dynamic-border flex items-center justify-between">
        <h2 className="text-sm font-bold dynamic-text uppercase tracking-wider">编辑建筑</h2>
        <button onClick={onClose} className="dynamic-text-muted hover:dynamic-text">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium dynamic-text-muted mb-1">名称</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent"
            />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium dynamic-text-muted mb-1">类型</label>
              <select 
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value as BuildingType)}
                className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent"
              >
                {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div className="w-1/3">
              <label className="block text-xs font-medium dynamic-text-muted mb-1">尺寸 (宽x高)</label>
              <div className="flex items-center gap-1">
                <input 
                  type="number" min="1" max="5" value={formData.width}
                  onChange={(e) => handleChange('width', parseInt(e.target.value) || 1)}
                  className="w-full dynamic-input border rounded-md px-2 py-2 text-sm text-center outline-none"
                />
                <span className="dynamic-text-muted">x</span>
                <input 
                  type="number" min="1" max="5" value={formData.height}
                  onChange={(e) => handleChange('height', parseInt(e.target.value) || 1)}
                  className="w-full dynamic-input border rounded-md px-2 py-2 text-sm text-center outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium dynamic-text-muted mb-1">描述</label>
            <textarea 
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent resize-none"
            />
          </div>
        </div>

        {/* Custom Properties */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-bold uppercase tracking-wider dynamic-text-muted">自定义属性</label>
            <button onClick={addCustomProperty} className="dynamic-accent hover:opacity-80 p-1">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {formData.customProperties.map(cp => (
              <div key={cp.id} className="flex gap-2 items-start">
                <input 
                  type="text" value={cp.key} onChange={(e) => updateCustomProperty(cp.id, 'key', e.target.value)}
                  className="flex-1 dynamic-input border rounded px-2 py-1 text-xs outline-none"
                  placeholder="属性名"
                />
                <input 
                  type="text" value={cp.value} onChange={(e) => updateCustomProperty(cp.id, 'value', e.target.value)}
                  className="flex-1 dynamic-input border rounded px-2 py-1 text-xs outline-none font-mono"
                  placeholder="属性值"
                />
                <button onClick={() => removeCustomProperty(cp.id)} className="p-1.5 dynamic-text-muted hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Rooms */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-bold uppercase tracking-wider dynamic-text-muted">内部房间</label>
            <button onClick={addRoom} className="dynamic-accent hover:opacity-80 p-1">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {formData.rooms.map(room => (
              <div key={room.id} className="flex gap-2 items-start">
                <input 
                  type="text" value={room.name} onChange={(e) => updateRoom(room.id, 'name', e.target.value)}
                  className="flex-1 dynamic-input border rounded px-2 py-1 text-xs outline-none"
                  placeholder="房间名称"
                />
                <input 
                  type="text" value={room.type} onChange={(e) => updateRoom(room.id, 'type', e.target.value)}
                  className="w-24 dynamic-input border rounded px-2 py-1 text-xs outline-none"
                  placeholder="用途"
                />
                <button onClick={() => removeRoom(room.id)} className="p-1.5 dynamic-text-muted hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Activities */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-bold uppercase tracking-wider dynamic-text-muted">活动</label>
            <button onClick={addActivity} className="dynamic-accent hover:opacity-80 p-1">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {formData.activities.map(act => (
              <div key={act.id} className="p-3 border dynamic-border rounded-md space-y-2">
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" value={act.name} onChange={(e) => updateActivity(act.id, 'name', e.target.value)}
                    className="flex-1 dynamic-input border rounded px-2 py-1 text-xs outline-none"
                    placeholder="活动名称"
                  />
                  <button onClick={() => removeActivity(act.id)} className="p-1 dynamic-text-muted hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" min="0" max="100" value={act.progress} 
                    onChange={(e) => updateActivity(act.id, 'progress', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono dynamic-accent w-8 text-right">{act.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* People */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-bold uppercase tracking-wider dynamic-text-muted">人员</label>
            <button onClick={addPerson} className="dynamic-accent hover:opacity-80 p-1">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {formData.people.map(person => (
              <div key={person.id} className="flex gap-2 items-start">
                <input 
                  type="text" value={person.name} onChange={(e) => updatePerson(person.id, 'name', e.target.value)}
                  className="flex-1 dynamic-input border rounded px-2 py-1 text-xs outline-none"
                  placeholder="姓名"
                />
                <input 
                  type="text" value={person.role} onChange={(e) => updatePerson(person.id, 'role', e.target.value)}
                  className="w-24 dynamic-input border rounded px-2 py-1 text-xs outline-none"
                  placeholder="身份"
                />
                <button onClick={() => removePerson(person.id)} className="p-1.5 dynamic-text-muted hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t dynamic-border flex gap-3">
        <button 
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors text-sm font-medium border dynamic-border dynamic-text hover:bg-black/5"
        >
          <Save className="w-4 h-4" />
          保存修改
        </button>
        <button 
          onClick={onDelete}
          className="px-4 flex items-center justify-center text-red-500 border border-red-500/30 rounded-md transition-colors hover:bg-red-500/10"
          title="拆除建筑"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
