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
  Maximize,
  Compass,
  Mountain, Trees, Castle, Tent, Factory, Building2, Home, Landmark, 
  MapPin, Flag, Anchor, Rocket, Zap, Flame, Droplets, Wind, 
  Sun, Moon, Star, Cloud, Snowflake, Skull, Heart, Gem, 
  Swords, Crown, Key, Book, Scroll, Music
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { useMotionValue, useMotionValueEvent, animate } from 'motion/react';

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
  name: string;
  description: string;
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
  isNew?: boolean;
  icon?: string;
  regionId?: string;
}

interface Region {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  icon?: string;
  color?: string;
}

const REGION_COLORS = [
  { name: '默认', value: '' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '红色', value: '#ef4444' },
  { name: '绿色', value: '#10b981' },
  { name: '黄色', value: '#f59e0b' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
  { name: '青色', value: '#14b8a6' },
  { name: '橙色', value: '#f97316' },
];

const AVAILABLE_ICONS: Record<string, React.ElementType> = {
  Mountain, Trees, Castle, Tent, Factory, Building2, Home, Landmark, 
  MapPin, Flag, Anchor, Rocket, Zap, Flame, Droplets, Wind, 
  Sun, Moon, Star, Cloud, Snowflake, Skull, Heart, Gem, 
  Swords, Crown, Key, Book, Scroll, Music, Hexagon, Shield, Store, Sparkles, Wrench
};

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
      { id: 'cp1', name: '能量等级', description: '当前建筑的能量储备等级', value: '高' },
      { id: 'cp2', name: '科技/魔法层级', description: '建筑的科技或魔法发展阶段', value: '3' }
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
      { id: 'cp3', name: '安全评级', description: '该区域的安全防卫级别', value: 'Alpha' }
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

interface World {
  id: string;
  name: string;
  theme: MapStyle;
  buildings: Building[];
  regions: Region[];
}

const INITIAL_WORLDS: World[] = [
  {
    id: 'w_default',
    name: '默认世界',
    theme: 'sci_fi',
    buildings: INITIAL_BUILDINGS,
    regions: INITIAL_REGIONS
  }
];

// --- Main Component ---

export default function App() {
  const [worlds, setWorlds] = useState<World[]>(INITIAL_WORLDS);
  const [currentWorldId, setCurrentWorldId] = useState<string>('w_default');
  const [showCreateWorldModal, setShowCreateWorldModal] = useState(false);

  const currentWorld = worlds.find(w => w.id === currentWorldId) || worlds[0] || { buildings: [], regions: [], theme: 'sci_fi' };
  const buildings = currentWorld.buildings || [];
  const regions = currentWorld.regions || [];
  const mapStyle = currentWorld.theme || 'sci_fi';

  const setBuildings = (newBuildings: Building[] | ((prev: Building[]) => Building[])) => {
    setWorlds(prev => prev.map(w => {
      if (w.id === currentWorldId) {
        return { ...w, buildings: typeof newBuildings === 'function' ? newBuildings(w.buildings) : newBuildings };
      }
      return w;
    }));
  };

  const setRegions = (newRegions: Region[] | ((prev: Region[]) => Region[])) => {
    setWorlds(prev => prev.map(w => {
      if (w.id === currentWorldId) {
        return { ...w, regions: typeof newRegions === 'function' ? newRegions(w.regions) : newRegions };
      }
      return w;
    }));
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
  const [scale, setScale] = useState(1);
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'toggle_mode' | 'close_panel' | null>(null);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showEventNavModal, setShowEventNavModal] = useState(false);
  
  const [pendingNextSelectedId, setPendingNextSelectedId] = useState<string | null>(null);

  const mapX = useMotionValue(0);
  const mapY = useMotionValue(0);
  
  // AI Generation State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedBuilding = buildings.find(b => b.id === selectedId);
  const showBuildings = scale >= ZOOM_THRESHOLD;

  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const zoomTo = (newScale: number) => {
    const currentScale = scaleRef.current;
    const clampedScale = Math.min(Math.max(0.1, newScale), 3);
    if (clampedScale === currentScale) return;
    const ratio = clampedScale / currentScale;
    mapX.set(mapX.get() * ratio);
    mapY.set(mapY.get() * ratio);
    setScale(clampedScale);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      zoomTo(scaleRef.current + delta);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMapClick = (e: React.MouseEvent) => {
    if (e.target === mapRef.current) {
      if (selectedBuilding?.isNew) {
        setPendingAction('close_panel');
      } else {
        setSelectedId(null);
        setIsEditingPanel(false);
      }
    }
  };

  const navigateToRegion = (region: Region) => {
    const regionCenterX = (region.x + region.width / 2) * CELL_SIZE;
    const regionCenterY = (region.y + region.height / 2) * CELL_SIZE;
    const targetX = 2000 - regionCenterX;
    const targetY = 2000 - regionCenterY;
    
    animate(mapX, targetX, { type: 'spring', stiffness: 80, damping: 20 });
    animate(mapY, targetY, { type: 'spring', stiffness: 80, damping: 20 });
    setScale(1);
  };

  const handleAddBuildingAt = (regionId: string, x: number, y: number) => {
    const newBuilding: Building = {
      id: `b_${Date.now()}`,
      x,
      y,
      width: 1,
      height: 1,
      name: '',
      type: 'core',
      description: '',
      people: [],
      activities: [],
      rooms: [],
      customProperties: [],
      isNew: true,
      regionId
    };
    setBuildings(prev => [...prev, newBuilding]);
    setSelectedId(newBuilding.id);
    setIsEditingPanel(true);
  };

  const handleAddBuildingToRegion = (regionId: string) => {
    const region = regions.find(r => r.id === regionId);
    if (!region) return;

    const x = region.x + Math.floor(Math.random() * Math.max(1, region.width - 1));
    const y = region.y + Math.floor(Math.random() * Math.max(1, region.height - 1));
    handleAddBuildingAt(regionId, x, y);
    setEditingRegionId(null); // Close region modal
    if (scale < ZOOM_THRESHOLD) {
      setScale(1);
    }
  };

  const handleAddRegion = () => {
    if (!isGlobalEditMode) return;
    const newRegion: Region = {
      id: `r_${Date.now()}`,
      name: '新建区域',
      description: '一个刚刚建立的新区域。',
      x: 10 + Math.floor(Math.random() * 5) - 2,
      y: 10 + Math.floor(Math.random() * 5) - 2,
      width: 10,
      height: 10,
      icon: 'MapPin',
      color: ''
    };
    setRegions([...regions, newRegion]);
    setEditingRegionId(newRegion.id);
  };

  const handleRegionDragEnd = (regionId: string, deltaX: number, deltaY: number) => {
    // Update region position
    setRegions(prev => prev.map(r => 
      r.id === regionId ? { ...r, x: r.x + deltaX, y: r.y + deltaY } : r
    ));

    // Update bound buildings positions
    setBuildings(prev => prev.map(b => 
      b.regionId === regionId ? { ...b, x: b.x + deltaX, y: b.y + deltaY } : b
    ));
  };

  const updateBuilding = (id: string, updates: Partial<Building>) => {
    setBuildings(buildings.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBuilding = (id: string) => {
    setBuildings(buildings.filter(b => b.id !== id));
    setSelectedId(null);
    setIsEditingPanel(false);
  };

  const updateRegion = (id: string, updates: Partial<Region>) => {
    setRegions(regions.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteRegion = (id: string) => {
    setRegions(regions.filter(r => r.id !== id));
    setEditingRegionId(null);
  };

  const handleToggleEditMode = () => {
    if (isGlobalEditMode && isEditingPanel && selectedBuilding?.isNew) {
      setPendingAction('toggle_mode');
    } else {
      setIsGlobalEditMode(!isGlobalEditMode);
      setIsEditingPanel(false);
    }
  };

  const handleClosePanel = () => {
    if (selectedBuilding?.isNew) {
      setPendingAction('close_panel');
    } else {
      setIsEditingPanel(false);
    }
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
      6. 建筑需要包含生动的名字、描述、内部房间、事件/活动和NPC人物。
      7. 【事件/活动】(activities) 请生成正在进行或即将举办的事件，例如：大型会议、社团聚会、射击比赛、烟火大会、新生欢迎会等集体活动，或者是个人事件（如：某个迷路的人正在寻求帮助、某人正在秘密交易）。
      8. 全部使用中文。`;

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
          id: `b_${uniqueSuffix}_${i}`,
          regionId: newRegion.id
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
          <h1 className="text-lg font-semibold tracking-wide dynamic-text hidden md:block">多重宇宙地图编辑器</h1>
          
          <div className="h-6 w-px bg-current opacity-20 dynamic-text mx-2"></div>
          
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border dynamic-border dynamic-text hover:bg-black/5 text-sm font-medium">
              <Compass className="w-4 h-4" />
              区域导航
            </button>
            <div className="absolute top-full left-0 mt-1 w-48 dynamic-panel border dynamic-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {regions.map(r => (
                  <button 
                    key={r.id}
                    onClick={() => navigateToRegion(r)}
                    className="w-full text-left px-4 py-2 text-sm dynamic-text hover:bg-black/5 border-b dynamic-border last:border-0 truncate"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setShowEventNavModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border dynamic-border dynamic-text hover:bg-black/5 text-sm font-medium"
          >
            <ActivityIcon className="w-4 h-4" />
            活动导航
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          {!isGlobalEditMode && (
            <button 
              onClick={() => setShowCreateEventModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors text-sm font-medium border border-transparent bg-current dynamic-accent text-white hover:opacity-90"
              style={{ color: 'var(--bg-color)', backgroundColor: 'var(--accent-color)' }}
            >
              <Sparkles className="w-4 h-4" />
              创建活动
            </button>
          )}
          <select 
            value={currentWorldId}
            onChange={(e) => {
              if (e.target.value === 'new_world') {
                setShowCreateWorldModal(true);
              } else {
                setCurrentWorldId(e.target.value);
                setSelectedId(null);
                setIsEditingPanel(false);
              }
            }}
            className="dynamic-input border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent"
          >
            {worlds.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({THEMES[w.theme].name})</option>
            ))}
            <option value="new_world">+ 自定义新世界...</option>
          </select>

          <div className="h-6 w-px bg-current opacity-20 dynamic-text"></div>

          <button
            onClick={handleToggleEditMode}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors text-sm font-medium border ${
              isGlobalEditMode 
                ? 'bg-current dynamic-accent text-white border-transparent' 
                : 'dynamic-border dynamic-text hover:bg-black/5'
            }`}
            style={isGlobalEditMode ? { color: 'var(--bg-color)', backgroundColor: 'var(--accent-color)' } : {}}
          >
            {isGlobalEditMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {isGlobalEditMode ? '进入浏览模式' : '进入编辑模式'}
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
                onClick={handleAddRegion}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors text-sm font-medium border dynamic-border dynamic-accent hover:bg-black/5"
              >
                <Plus className="w-4 h-4" />
                新建区域
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
          style={{ x: mapX, y: mapY, scale }}
          ref={mapRef}
          onPointerDown={handleMapClick}
        >
          {/* Render Regions and their buildings */}
          {regions?.map(region => (
            <RegionNode
              key={region.id}
              region={region}
              regionBuildings={buildings?.filter(b => b.regionId === region.id) || []}
              showBuildings={showBuildings}
              isGlobalEditMode={isGlobalEditMode}
              scale={scale}
              selectedId={selectedId}
              selectedBuilding={selectedBuilding}
              setPendingNextSelectedId={setPendingNextSelectedId}
              setPendingAction={setPendingAction}
              setSelectedId={setSelectedId}
              setIsEditingPanel={setIsEditingPanel}
              updateBuilding={updateBuilding}
              onEdit={() => setEditingRegionId(region.id)}
              onDragEnd={(deltaX, deltaY) => handleRegionDragEnd(region.id, deltaX, deltaY)}
              onAddBuildingAt={(x, y) => handleAddBuildingAt(region.id, x, y)}
            />
          ))}

          {/* Render Buildings that are NOT in any region (legacy or free-floating) */}
          <AnimatePresence>
            {showBuildings && buildings?.filter(b => !b.regionId).map(building => {
              const region = regions?.find(r => building.x >= r.x && building.x < r.x + r.width && building.y >= r.y && building.y < r.y + r.height);
              const regionColor = region?.color;
              return (
                <BuildingNode 
                  key={building.id}
                  building={building} 
                  isSelected={selectedId === building.id}
                  isGlobalEditMode={isGlobalEditMode}
                  regionColor={regionColor}
                  onClick={() => {
                    if (selectedBuilding?.isNew && selectedBuilding.id !== building.id) {
                      setPendingNextSelectedId(building.id);
                      setPendingAction('close_panel');
                    } else {
                      setSelectedId(building.id);
                      setIsEditingPanel(false);
                    }
                  }}
                  onDragEnd={(x, y) => updateBuilding(building.id, { x, y })}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Region Indicators */}
      {regions?.map(region => (
        <RegionIndicator key={`ind_${region.id}`} region={region} mapX={mapX} mapY={mapY} scale={scale} />
      ))}

      {/* Zoom Controls */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-10">
        <button 
          onClick={() => zoomTo(scale + 0.2)} 
          className="p-2 dynamic-panel border dynamic-border rounded-md shadow-md hover:bg-black/5 transition-colors"
          title="放大 (滚轮向上)"
        >
          <ZoomIn className="w-5 h-5 dynamic-text" />
        </button>
        <button 
          onClick={() => zoomTo(scale - 0.2)} 
          className="p-2 dynamic-panel border dynamic-border rounded-md shadow-md hover:bg-black/5 transition-colors"
          title="缩小 (滚轮向下)"
        >
          <ZoomOut className="w-5 h-5 dynamic-text" />
        </button>
        <button 
          onClick={() => {
            mapX.set(0);
            mapY.set(0);
            setScale(1);
          }} 
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
            {(() => {
              const region = regions.find(r => selectedBuilding.x >= r.x && selectedBuilding.x < r.x + r.width && selectedBuilding.y >= r.y && selectedBuilding.y < r.y + r.height);
              const regionColor = region?.color;
              
              return isEditingPanel && isGlobalEditMode ? (
                <EditPanel 
                  building={selectedBuilding} 
                  regionColor={regionColor}
                  onChange={(updates) => updateBuilding(selectedBuilding.id, updates)}
                  onUpdate={(updates) => updateBuilding(selectedBuilding.id, updates)}
                  onClose={handleClosePanel}
                  onDelete={() => deleteBuilding(selectedBuilding.id)}
                />
              ) : (
                <ViewPanel 
                  building={selectedBuilding} 
                  isGlobalEditMode={isGlobalEditMode}
                  regionColor={regionColor}
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
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Region Edit Modal */}
      <AnimatePresence>
        {editingRegionId && (
          <RegionEditModal 
            region={regions.find(r => r.id === editingRegionId)!}
            onClose={() => setEditingRegionId(null)}
            onUpdate={(updates) => updateRegion(editingRegionId, updates)}
            onDelete={() => deleteRegion(editingRegionId)}
            onAddBuilding={() => handleAddBuildingToRegion(editingRegionId)}
          />
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

      {/* Unsaved Modal */}
      <AnimatePresence>
        {pendingAction && selectedBuilding && (
          <UnsavedModal
            building={selectedBuilding}
            onSave={() => {
              updateBuilding(selectedBuilding.id, { isNew: false });
              setPendingAction(null);
              if (pendingAction === 'toggle_mode') {
                setIsGlobalEditMode(false);
                setIsEditingPanel(false);
              } else {
                if (pendingNextSelectedId) {
                  setSelectedId(pendingNextSelectedId);
                  setPendingNextSelectedId(null);
                } else {
                  setSelectedId(null);
                }
                setIsEditingPanel(false);
              }
            }}
            onDiscard={() => {
              deleteBuilding(selectedBuilding.id);
              setPendingAction(null);
              if (pendingAction === 'toggle_mode') {
                setIsGlobalEditMode(false);
                setIsEditingPanel(false);
              } else {
                if (pendingNextSelectedId) {
                  setSelectedId(pendingNextSelectedId);
                  setPendingNextSelectedId(null);
                } else {
                  setSelectedId(null);
                }
                setIsEditingPanel(false);
              }
            }}
            onCancel={() => {
              setPendingAction(null);
              setPendingNextSelectedId(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Create Event Modal */}
      <AnimatePresence>
        {showCreateEventModal && (
          <CreateEventModal
            regions={regions}
            buildings={buildings}
            onClose={() => setShowCreateEventModal(false)}
            onGenerate={(newEvents) => {
              setBuildings(prev => prev.map(b => {
                const eventsForBuilding = newEvents.filter((e: any) => e.buildingId === b.id);
                if (eventsForBuilding.length > 0) {
                  return {
                    ...b,
                    activities: [
                      ...b.activities,
                      ...eventsForBuilding.map((e: any) => ({ id: `a_${Date.now()}_${Math.random()}`, name: e.name, progress: e.progress }))
                    ]
                  };
                }
                return b;
              }));
              setShowCreateEventModal(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Event Nav Modal */}
      <AnimatePresence>
        {showEventNavModal && (
          <EventNavModal
            regions={regions}
            buildings={buildings}
            onClose={() => setShowEventNavModal(false)}
            onNavigate={(building) => {
              setShowEventNavModal(false);
              setSelectedId(building.id);
              setIsEditingPanel(false);
              // Calculate region center and navigate
              const region = regions.find(r => building.x >= r.x && building.x <= r.x + r.width && building.y >= r.y && building.y <= r.y + r.height);
              if (region) navigateToRegion(region);
            }}
          />
        )}
      </AnimatePresence>

      {/* Create World Modal */}
      <AnimatePresence>
        {showCreateWorldModal && (
          <CreateWorldModal
            onClose={() => setShowCreateWorldModal(false)}
            onCreate={(name, theme) => {
              const newWorld: World = {
                id: `w_${Date.now()}`,
                name,
                theme,
                buildings: [],
                regions: []
              };
              setWorlds(prev => [...prev, newWorld]);
              setCurrentWorldId(newWorld.id);
              setSelectedId(null);
              setIsEditingPanel(false);
              setShowCreateWorldModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Subcomponents ---

function RegionEditModal({ 
  region, 
  onClose, 
  onUpdate,
  onDelete,
  onAddBuilding
}: { 
  region: Region, 
  onClose: () => void, 
  onUpdate: (updates: Partial<Region>) => void,
  onDelete: () => void,
  onAddBuilding: () => void
}) {
  const [name, setName] = useState(region.name);
  const [description, setDescription] = useState(region.description);
  const [icon, setIcon] = useState(region.icon || 'MapPin');
  const [color, setColor] = useState(region.color || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-[500px] dynamic-panel border dynamic-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b dynamic-border flex items-center justify-between">
          <h2 className="text-base font-bold dynamic-text">编辑区域</h2>
          <button onClick={onClose} className="dynamic-text-muted hover:dynamic-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div>
            <button
              onClick={() => {
                onAddBuilding();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-colors text-sm font-medium border-2 border-dashed dynamic-border dynamic-accent hover:bg-black/5"
            >
              <Plus className="w-4 h-4" />
              在此区域建造新建筑
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium dynamic-text mb-2">区域名称</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium dynamic-text mb-2">区域描述</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium dynamic-text mb-2">区域颜色</label>
            <div className="flex flex-wrap gap-2">
              {REGION_COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c.value ? 'scale-110 border-current dynamic-text' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value || 'var(--grid-color)' }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium dynamic-text mb-2">区域图标</label>
            <div className="grid grid-cols-8 gap-2">
              {Object.entries(AVAILABLE_ICONS).map(([key, IconComponent]) => (
                <button
                  key={key}
                  onClick={() => setIcon(key)}
                  className={`p-2 rounded-md border flex items-center justify-center transition-colors ${
                    icon === key 
                      ? 'border-current dynamic-accent bg-black/5' 
                      : 'border-transparent hover:bg-black/5 dynamic-text-muted'
                  }`}
                  title={key}
                >
                  <IconComponent className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t dynamic-border flex justify-between gap-3 bg-black/10">
          <button 
            onClick={onDelete}
            className="px-4 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            删除区域
          </button>
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium dynamic-text hover:bg-black/5"
            >
              取消
            </button>
            <button 
              onClick={() => {
                onUpdate({ name, description, icon, color });
                onClose();
              }}
              className="px-4 py-2 rounded-md text-sm font-medium border border-transparent bg-current dynamic-accent text-white hover:opacity-90 transition-all"
              style={{ color: 'var(--bg-color)', backgroundColor: 'var(--accent-color)' }}
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

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

function RegionNode({
  region,
  regionBuildings,
  showBuildings,
  isGlobalEditMode,
  scale,
  selectedId,
  selectedBuilding,
  setPendingNextSelectedId,
  setPendingAction,
  setSelectedId,
  setIsEditingPanel,
  updateBuilding,
  onEdit,
  onDragEnd,
  onAddBuildingAt
}: {
  region: Region;
  regionBuildings: Building[];
  showBuildings: boolean;
  isGlobalEditMode: boolean;
  scale: number;
  selectedId: string | null;
  selectedBuilding: Building | undefined;
  setPendingNextSelectedId: (id: string | null) => void;
  setPendingAction: (action: 'toggle_mode' | 'close_panel' | null) => void;
  setSelectedId: (id: string | null) => void;
  setIsEditingPanel: (isEditing: boolean) => void;
  updateBuilding: (id: string, updates: Partial<Building>) => void;
  onEdit: () => void;
  onDragEnd: (deltaX: number, deltaY: number) => void;
  onAddBuildingAt: (x: number, y: number) => void;
  key?: React.Key;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const color = region.color || '';
  const borderColor = color || 'var(--border-color)';
  const accentColor = color || 'var(--accent-color)';
  const bgColor = color ? `${color}20` : 'var(--grid-color)';

  return (
    <motion.div
      drag={isGlobalEditMode}
      dragMomentum={false}
      style={{
        x, y,
        left: region.x * CELL_SIZE,
        top: region.y * CELL_SIZE,
        width: region.width * CELL_SIZE,
        height: region.height * CELL_SIZE,
        backgroundColor: showBuildings ? bgColor : 'var(--panel-bg)',
        opacity: showBuildings ? 1 : 0.8,
        borderStyle: showBuildings ? 'dashed' : 'solid',
        borderWidth: showBuildings ? '2px' : '4px',
        borderColor: showBuildings ? borderColor : borderColor,
      }}
      onDragEnd={(_, info) => {
        if (!isGlobalEditMode) return;
        const deltaX = Math.round(x.get() / CELL_SIZE);
        const deltaY = Math.round(y.get() / CELL_SIZE);
        
        if (deltaX !== 0 || deltaY !== 0) {
          onDragEnd(deltaX, deltaY);
        }
        x.set(0);
        y.set(0);
      }}
      onPointerDown={(e) => {
        if (isGlobalEditMode) {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        if (isGlobalEditMode && showBuildings) {
          const rect = e.currentTarget.getBoundingClientRect();
          const localX = Math.floor((e.clientX - rect.left) / scale / CELL_SIZE);
          const localY = Math.floor((e.clientY - rect.top) / scale / CELL_SIZE);
          if (localX >= 0 && localX < region.width && localY >= 0 && localY < region.height) {
            onAddBuildingAt(region.x + localX, region.y + localY);
          }
        }
      }}
      className={`absolute rounded-xl flex flex-col overflow-hidden transition-all duration-500 ${isGlobalEditMode ? 'cursor-move' : 'pointer-events-none'}`}
    >
      <div 
        className={`pointer-events-auto px-3 py-1.5 backdrop-blur-sm border-b w-fit rounded-br-xl transition-all duration-500 ${showBuildings ? 'border-dashed' : 'border-solid'} ${isGlobalEditMode ? 'cursor-pointer hover:bg-black/10' : ''}`} 
        style={{ backgroundColor: 'var(--panel-bg)', borderColor: borderColor }}
        onClick={(e) => {
          if (isGlobalEditMode) {
            e.stopPropagation();
            onEdit();
          }
        }}
      >
        <h3 className={`font-bold flex items-center gap-2 transition-all duration-500 ${showBuildings ? 'text-sm' : 'text-2xl'}`} style={{ color: accentColor }}>
          {(() => {
            const IconComponent = region.icon && AVAILABLE_ICONS[region.icon] ? AVAILABLE_ICONS[region.icon] : MapIcon;
            return <IconComponent className={`${showBuildings ? 'w-3.5 h-3.5' : 'w-6 h-6'}`} />;
          })()}
          {region.name}
          {isGlobalEditMode && <Edit3 className="w-3 h-3 ml-1 opacity-50" />}
        </h3>
        {showBuildings && (
          <p className="text-xs mt-0.5 max-w-[200px] truncate" style={{ color: accentColor, opacity: 0.8 }}>{region.description}</p>
        )}
      </div>
      
      {!showBuildings && (
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-xl text-center max-w-md leading-relaxed opacity-70" style={{ color: accentColor }}>
            {region.description}
          </p>
        </div>
      )}

      <AnimatePresence>
        {showBuildings && regionBuildings.map(building => (
          <BuildingNode 
            key={building.id}
            building={building} 
            isSelected={selectedId === building.id}
            isGlobalEditMode={isGlobalEditMode}
            regionColor={color}
            offsetX={region.x}
            offsetY={region.y}
            bounds={{ width: region.width, height: region.height }}
            onClick={() => {
              if (selectedBuilding?.isNew && selectedBuilding.id !== building.id) {
                setPendingNextSelectedId(building.id);
                setPendingAction('close_panel');
              } else {
                setSelectedId(building.id);
                setIsEditingPanel(false);
              }
            }}
            onDragEnd={(x, y) => updateBuilding(building.id, { x, y })}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function BuildingNode({ 
  building, 
  isSelected, 
  isGlobalEditMode,
  regionColor,
  offsetX = 0,
  offsetY = 0,
  bounds,
  onClick,
  onDragEnd 
}: { 
  building: Building; 
  isSelected: boolean; 
  isGlobalEditMode: boolean;
  regionColor?: string;
  offsetX?: number;
  offsetY?: number;
  bounds?: { width: number; height: number };
  onClick: () => void;
  onDragEnd: (x: number, y: number) => void;
  key?: React.Key;
}) {
  const config = TYPE_CONFIG[building.type];
  const Icon = building.icon && AVAILABLE_ICONS[building.icon] ? AVAILABLE_ICONS[building.icon] : config.icon;
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const accentColor = regionColor || 'var(--accent-color)';
  const borderColor = regionColor || (isSelected ? 'var(--accent-color)' : 'var(--border-color)');

  const left = (building.x - offsetX) * CELL_SIZE;
  const top = (building.y - offsetY) * CELL_SIZE;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      drag={isGlobalEditMode}
      dragMomentum={false}
      dragConstraints={bounds ? {
        left: -left,
        top: -top,
        right: bounds.width * CELL_SIZE - left - building.width * CELL_SIZE,
        bottom: bounds.height * CELL_SIZE - top - building.height * CELL_SIZE
      } : undefined}
      onDragEnd={(_, info) => {
        if (!isGlobalEditMode) return;
        const newX = Math.round((building.x * CELL_SIZE + x.get()) / CELL_SIZE);
        const newY = Math.round((building.y * CELL_SIZE + y.get()) / CELL_SIZE);
        onDragEnd(newX, newY);
        x.set(0);
        y.set(0);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`absolute flex flex-col items-center justify-center group ${isGlobalEditMode ? 'cursor-move' : 'cursor-pointer'}`}
      style={{
        x, y,
        width: building.width * CELL_SIZE,
        height: building.height * CELL_SIZE,
        left,
        top,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div 
        className={`relative w-full h-full rounded-lg flex items-center justify-center transition-all duration-300 border-2 dynamic-building ${
          isSelected ? 'shadow-lg scale-105' : 'group-hover:border-current'
        }`}
        style={{ borderColor: borderColor }}
      >
        <Icon className="w-8 h-8 opacity-80" style={{ color: accentColor }} />
        
        {/* Activity Indicator */}
        {building.activities.length > 0 && (
          <div 
            className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full animate-pulse shadow-lg" 
            style={{ backgroundColor: accentColor }}
          />
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
  regionColor,
  onEdit, 
  onClose,
  onAddActivity
}: { 
  building: Building, 
  isGlobalEditMode: boolean, 
  regionColor?: string;
  onEdit: () => void, 
  onClose: () => void,
  onAddActivity: () => void
}) {
  const config = TYPE_CONFIG[building.type];
  const Icon = building.icon && AVAILABLE_ICONS[building.icon] ? AVAILABLE_ICONS[building.icon] : config.icon;
  const accentColor = regionColor || 'var(--accent-color)';

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-6 border-b dynamic-border relative">
        <button onClick={onClose} className="absolute top-4 right-4 dynamic-text-muted hover:dynamic-text">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-md border dynamic-border dynamic-building" style={{ color: accentColor }}>
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
          <h3 className="text-xs font-bold uppercase tracking-wider dynamic-text-muted mb-3">特殊数值</h3>
          <div className="space-y-2">
            {building.customProperties?.map(prop => (
              <div key={prop.id} className="flex justify-between text-sm">
                <span className="dynamic-text-muted">{prop.name}</span>
                <span className="font-mono dynamic-text">{prop.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rooms */}
      <div className="p-6 border-b dynamic-border">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="w-4 h-4" style={{ color: accentColor }} />
          <h3 className="text-sm font-bold dynamic-text">内部房间布局</h3>
        </div>
        {building.rooms.length === 0 ? (
          <p className="text-sm dynamic-text-muted italic">暂无划分房间。</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {building.rooms?.map(room => (
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
          <ActivityIcon className="w-4 h-4" style={{ color: accentColor }} />
          <h3 className="text-sm font-bold dynamic-text">事件 / 活动 (进行中或即将举办)</h3>
        </div>
        {building.activities.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm dynamic-text-muted italic mb-3">暂无正在进行或即将举办的事件。</p>
            {isGlobalEditMode && (
              <button 
                onClick={onAddActivity}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border dynamic-border dynamic-text hover:bg-black/5 text-xs"
              >
                <Plus className="w-3 h-3" /> 新建事件
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {building.activities.map(act => (
              <div key={act.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="dynamic-text">{act.name}</span>
                  <span className="font-mono" style={{ color: accentColor }}>{act.progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden dynamic-border border">
                  <div 
                    className="h-full bg-current" 
                    style={{ width: `${act.progress}%`, backgroundColor: accentColor }}
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
          <Users className="w-4 h-4" style={{ color: accentColor }} />
          <h3 className="text-sm font-bold dynamic-text">居住/驻扎人员</h3>
        </div>
        {building.people.length === 0 ? (
          <p className="text-sm dynamic-text-muted italic">建筑内空无一人。</p>
        ) : (
          <div className="space-y-3">
            {building.people?.map(person => (
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

function EditPanel({ building, regionColor, onChange, onUpdate, onClose, onDelete }: { building: Building, regionColor?: string, onChange: (updates: Partial<Building>) => void, onUpdate: (updates: Partial<Building>) => void, onClose: () => void, onDelete: () => void }) {
  const [formData, setFormData] = useState<Building>(building);
  const accentColor = regionColor || 'var(--accent-color)';

  useEffect(() => {
    setFormData(building);
  }, [building.id]);

  const handleChange = (field: keyof Building, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    onChange(newFormData);
  };

  const handleSave = () => {
    onUpdate(formData);
    onClose();
  };

  const addCustomProperty = () => {
    handleChange('customProperties', [
      ...formData.customProperties, 
      { id: `cp_${Date.now()}`, name: '新属性', description: '', value: '值' }
    ]);
  };

  const updateCustomProperty = (id: string, field: 'name' | 'description' | 'value', val: string) => {
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
            <div className="w-full">
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
            <label className="block text-xs font-medium dynamic-text-muted mb-1">描述 (介绍建筑用途)</label>
            <textarea 
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium dynamic-text-muted mb-2">建筑图标</label>
            <div className="grid grid-cols-8 gap-1.5">
              {Object.entries(AVAILABLE_ICONS).map(([key, IconComponent]) => (
                <button
                  key={key}
                  onClick={() => handleChange('icon', key)}
                  className={`p-1.5 rounded-md border flex items-center justify-center transition-colors ${
                    (formData.icon === key) || (!formData.icon && TYPE_CONFIG[formData.type].icon === IconComponent)
                      ? 'border-current dynamic-accent bg-black/5' 
                      : 'border-transparent hover:bg-black/5 dynamic-text-muted'
                  }`}
                  title={key}
                >
                  <IconComponent className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Properties */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-bold uppercase tracking-wider dynamic-text-muted">特殊数值</label>
            <button onClick={addCustomProperty} className="dynamic-accent hover:opacity-80 p-1">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {formData.customProperties?.map(cp => (
              <div key={cp.id} className="flex gap-2 items-start">
                <input 
                  type="text" value={cp.name} onChange={(e) => updateCustomProperty(cp.id, 'name', e.target.value)}
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
            {formData.rooms?.map(room => (
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
            <label className="block text-xs font-bold uppercase tracking-wider dynamic-text-muted">事件 / 活动</label>
            <button onClick={addActivity} className="dynamic-accent hover:opacity-80 p-1">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {formData.activities?.map(act => (
              <div key={act.id} className="p-3 border dynamic-border rounded-md space-y-2">
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" value={act.name} onChange={(e) => updateActivity(act.id, 'name', e.target.value)}
                    className="flex-1 dynamic-input border rounded px-2 py-1 text-xs outline-none"
                    placeholder="事件名称"
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
            {formData.people?.map(person => (
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
          disabled={!formData.name.trim() || !formData.description.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors text-sm font-medium border dynamic-border dynamic-text hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
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

function RegionIndicator({ region, mapX, mapY, scale }: { region: Region, mapX: any, mapY: any, scale: number, key?: React.Key }) {
  const indicatorX = useMotionValue(0);
  const indicatorY = useMotionValue(0);
  const opacity = useMotionValue(0);
  const rotation = useMotionValue(0);

  const updatePosition = () => {
    const regionCenterX = (region.x + region.width / 2) * CELL_SIZE;
    const regionCenterY = (region.y + region.height / 2) * CELL_SIZE;
    
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    const cx = screenW / 2 + mapX.get() + (regionCenterX - 2000) * scale;
    const cy = screenH / 2 + mapY.get() + (regionCenterY - 2000) * scale;
    
    const margin = 50; 
    
    if (cx >= 0 && cx <= screenW && cy >= 0 && cy <= screenH) {
      opacity.set(0);
      return;
    }
    
    opacity.set(1);
    
    const scx = screenW / 2;
    const scy = screenH / 2;
    
    const dx = cx - scx;
    const dy = cy - scy;
    
    const angle = Math.atan2(dy, dx);
    rotation.set(angle * 180 / Math.PI);
    
    let ix = cx;
    let iy = cy;
    
    if (Math.abs(dx) > 0.001) {
      const slope = dy / dx;
      if (dx > 0) {
        ix = screenW - margin;
        iy = scy + (ix - scx) * slope;
      } else {
        ix = margin;
        iy = scy + (ix - scx) * slope;
      }
      
      if (iy < margin || iy > screenH - margin) {
        if (dy > 0) {
          iy = screenH - margin;
          ix = scx + (iy - scy) / slope;
        } else {
          iy = margin;
          ix = scx + (iy - scy) / slope;
        }
      }
    } else {
      ix = scx;
      iy = dy > 0 ? screenH - margin : margin;
    }
    
    ix = Math.max(margin, Math.min(screenW - margin, ix));
    iy = Math.max(margin, Math.min(screenH - margin, iy));
    
    indicatorX.set(ix);
    indicatorY.set(iy);
  };

  useMotionValueEvent(mapX, "change", updatePosition);
  useMotionValueEvent(mapY, "change", updatePosition);
  
  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [scale, region]);

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        x: indicatorX,
        y: indicatorY,
        opacity,
        translateX: '-50%',
        translateY: '-50%',
        zIndex: 40
      }}
      className="pointer-events-none flex flex-col items-center justify-center"
    >
      <div className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap mb-1 border border-white/10 shadow-lg">
        {region.name}
      </div>
      <motion.div style={{ rotate: rotation }}>
        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-current dynamic-accent" />
      </motion.div>
    </motion.div>
  );
}

function UnsavedModal({ building, onSave, onDiscard, onCancel }: { building: Building, onSave: () => void, onDiscard: () => void, onCancel: () => void }) {
  const canSave = building.name.trim() !== '' && building.description.trim() !== '';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="dynamic-panel border dynamic-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b dynamic-border flex items-center justify-between">
          <h2 className="text-lg font-bold dynamic-text">未保存的建筑</h2>
          <button onClick={onCancel} className="dynamic-text-muted hover:dynamic-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm dynamic-text mb-2">您有一个新建的建筑尚未保存。如果退出，该建筑将会丢失。是否保存？</p>
          {!canSave && (
            <p className="text-xs text-red-500 mt-2">请先在编辑面板中填写建筑名称和描述才能保存。</p>
          )}
        </div>
        <div className="p-4 border-t dynamic-border flex justify-end gap-3 bg-black/5">
          <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium dynamic-text hover:bg-black/5">
            取消
          </button>
          <button onClick={onDiscard} className="px-4 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-500/10">
            放弃更改
          </button>
          <button 
            onClick={onSave} 
            disabled={!canSave}
            className="px-4 py-2 rounded-md text-sm font-medium text-white dynamic-accent transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            保存建筑
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CreateEventModal({ regions, buildings, onClose, onGenerate }: { regions: Region[], buildings: Building[], onClose: () => void, onGenerate: (events: any[]) => void }) {
  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!process.env.GEMINI_API_KEY) {
      alert("未找到 GEMINI_API_KEY，请在环境变量中配置。");
      return;
    }

    setIsGenerating(true);
    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const targetBuildings = selectedRegionId === 'all' 
        ? buildings 
        : buildings.filter(b => {
            const r = regions.find(r => r.id === selectedRegionId);
            if (!r) return false;
            return b.x >= r.x && b.x <= r.x + r.width && b.y >= r.y && b.y <= r.y + r.height;
          });

      if (targetBuildings.length === 0) {
        alert("所选区域没有建筑。");
        setIsGenerating(false);
        return;
      }

      const prompt = `为以下建筑生成正在进行或即将举办的事件/活动。
要求：
1. 结合建筑的名称、描述和当前人员，生成符合逻辑的生动事件。
2. 每个建筑生成 1 到 2 个事件。
3. 进度(progress)在 0 到 100 之间。
4. 全部使用中文。
5. 返回 JSON 格式：{ "events": [{ "buildingId": "...", "name": "...", "progress": 50 }] }

建筑列表：
${targetBuildings.map(b => `- ID: ${b.id}, 名称: ${b.name}, 描述: ${b.description}, 人员: ${b.people.map(p => p.name).join(', ')}`).join('\n')}`;

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              events: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    buildingId: { type: Type.STRING },
                    name: { type: Type.STRING },
                    progress: { type: Type.NUMBER }
                  },
                  required: ["buildingId", "name", "progress"]
                }
              }
            },
            required: ["events"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        onGenerate(data.events);
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("AI 生成失败，请检查控制台或 API Key。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="dynamic-panel border dynamic-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b dynamic-border flex items-center justify-between">
          <h2 className="text-lg font-bold dynamic-text flex items-center gap-2">
            <Sparkles className="w-5 h-5 dynamic-accent" />
            随机创建活动
          </h2>
          <button onClick={onClose} className="dynamic-text-muted hover:dynamic-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium dynamic-text-muted mb-2">选择目标区域</label>
            <select 
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent"
            >
              <option value="all">所有区域</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs dynamic-text-muted">AI 将根据所选区域内建筑的用途和人员，自动生成符合逻辑的事件或活动。</p>
        </div>
        <div className="p-4 border-t dynamic-border flex justify-end gap-3 bg-black/5">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium dynamic-text hover:bg-black/5">
            取消
          </button>
          <button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white dynamic-accent transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {isGenerating ? '生成中...' : '开始生成'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EventNavModal({ regions, buildings, onClose, onNavigate }: { regions: Region[], buildings: Building[], onClose: () => void, onNavigate: (building: Building) => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="dynamic-panel border dynamic-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b dynamic-border flex items-center justify-between">
          <h2 className="text-lg font-bold dynamic-text flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 dynamic-accent" />
            活动导航
          </h2>
          <button onClick={onClose} className="dynamic-text-muted hover:dynamic-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {regions.map(region => {
            const regionBuildings = buildings.filter(b => 
              b.x >= region.x && b.x <= region.x + region.width && 
              b.y >= region.y && b.y <= region.y + region.height &&
              b.activities.length > 0
            );

            if (regionBuildings.length === 0) return null;

            return (
              <div key={region.id} className="space-y-4">
                <h3 className="text-md font-bold dynamic-text border-b dynamic-border pb-2 flex items-center gap-2">
                  <MapIcon className="w-4 h-4 dynamic-accent" />
                  {region.name}
                </h3>
                <div className="grid gap-4">
                  {regionBuildings.map(building => (
                    <div 
                      key={building.id} 
                      className="border dynamic-border rounded-lg p-4 hover:bg-black/5 transition-colors cursor-pointer"
                      onClick={() => onNavigate(building)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold dynamic-text text-sm">{building.name}</h4>
                        <span className="text-xs dynamic-text-muted px-2 py-1 rounded bg-black/5">
                          预计参与: {building.people.length > 0 ? building.people.map(p => p.name).join(', ') : '无特定人员'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {building.activities.map(act => (
                          <div key={act.id} className="bg-black/5 rounded p-2">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="dynamic-text">{act.name}</span>
                              <span className="dynamic-accent font-mono text-xs">{act.progress}%</span>
                            </div>
                            <div className="h-1 w-full rounded-full overflow-hidden dynamic-border border">
                              <div 
                                className="h-full bg-current dynamic-accent" 
                                style={{ width: `${act.progress}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {buildings.every(b => b.activities.length === 0) && (
            <div className="text-center py-12">
              <p className="text-sm dynamic-text-muted italic">当前没有任何活动。您可以在上方点击“创建活动”来生成。</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CreateWorldModal({ onClose, onCreate }: { onClose: () => void, onCreate: (name: string, theme: MapStyle) => void }) {
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<MapStyle>('sci_fi');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="dynamic-panel border dynamic-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b dynamic-border flex items-center justify-between">
          <h2 className="text-lg font-bold dynamic-text">自定义新世界</h2>
          <button onClick={onClose} className="dynamic-text-muted hover:dynamic-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium dynamic-text mb-2">世界名称</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：废土新城"
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium dynamic-text mb-2">基础风格</label>
            <select 
              value={theme}
              onChange={(e) => setTheme(e.target.value as MapStyle)}
              className="w-full dynamic-input border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-current dynamic-accent"
            >
              {Object.entries(THEMES).map(([key, t]) => (
                <option key={key} value={key}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-4 border-t dynamic-border flex justify-end gap-3 bg-black/5">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium dynamic-text hover:bg-black/5">
            取消
          </button>
          <button 
            onClick={() => onCreate(name || '未命名世界', theme)} 
            disabled={!name.trim()}
            className="px-4 py-2 rounded-md text-sm font-medium text-white dynamic-accent transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            创建
          </button>
        </div>
      </motion.div>
    </div>
  );
}