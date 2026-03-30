import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Smartphone } from 'lucide-react';
import { TAVERN_PHONE_UI_LABEL, TAVERN_PHONE_UI_VERSION } from '../../tavernPhoneVersion';
import {
  loadTavernPhoneApiConfig,
  saveTavernPhoneApiConfig,
  getTavernPhoneApiConfig,
  type TavernPhoneApiConfig,
  type ResolvedTavernPhoneApiConfig,
} from '../../tavernPhoneApiConfig';
import { fetchOpenAiCompatibleModelIds, testOpenAiCompatibleConnection } from '../../openaiCompatible';

export default function SettingsApp({
  onClose,
}: {
  onClose: () => void;
  /** 保留与 App 传参兼容；壁纸改由桌面侧统一处理时可不传 */
  setWallpaper?: (url: string) => void;
}) {
  const [cfg, setCfg] = useState<TavernPhoneApiConfig>(() => loadTavernPhoneApiConfig());
  const [resolvedCfg, setResolvedCfg] = useState<ResolvedTavernPhoneApiConfig>(() => getTavernPhoneApiConfig());
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  useEffect(() => {
    saveTavernPhoneApiConfig(cfg);
    setResolvedCfg(getTavernPhoneApiConfig());
  }, [cfg]);

  useEffect(() => {
    const sync = () => {
      setCfg(loadTavernPhoneApiConfig());
      setResolvedCfg(getTavernPhoneApiConfig());
    };
    window.addEventListener('tavern-phone-api-config-changed', sync);
    return () => window.removeEventListener('tavern-phone-api-config-changed', sync);
  }, []);

  const setField = useCallback(<K extends keyof TavernPhoneApiConfig>(key: K, value: TavernPhoneApiConfig[K]) => {
    setCfg(prev => ({ ...prev, [key]: value }));
  }, []);

  const onMaxRetriesChange = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setField('maxRetries', 0);
      return;
    }
    setField('maxRetries', Math.max(0, Math.min(10, n)));
  };

  const handleTest = async () => {
    setTestState('loading');
    setTestMessage('');
    const resolved = getTavernPhoneApiConfig();
    if (!resolved.apiBaseUrl.trim()) {
      setTestMessage('请先填写 API URL（或开启「使用酒馆插头 API 设置」）');
      setTestState('error');
      return;
    }
    if (!resolved.apiKey.trim()) {
      setTestMessage('请先填写 API Key（或开启「使用酒馆插头 API 设置」）');
      setTestState('error');
      return;
    }
    const r = await testOpenAiCompatibleConnection(resolved.apiBaseUrl, resolved.apiKey);
    setTestMessage(r.message + (resolved.source === 'tavern' ? ' (来自酒馆)' : ''));
    setTestState(r.ok ? 'success' : 'error');
  };

  const handleFetchModels = async () => {
    setModelsLoading(true);
    setModelsError('');
    setModelOptions([]);
    try {
      const resolved = getTavernPhoneApiConfig();
      if (!resolved.apiBaseUrl.trim()) {
        throw new Error('请先填写 API URL（或开启「使用酒馆插头 API 设置」）');
      }
      if (!resolved.apiKey.trim()) {
        throw new Error('请先填写 API Key（或开启「使用酒馆插头 API 设置」）');
      }
      const ids = await fetchOpenAiCompatibleModelIds(resolved.apiBaseUrl, resolved.apiKey);
      setModelOptions(ids);
      if (ids.length === 0) {
        setModelsError('列表为空（接口返回 0 个模型）');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setModelsError(msg.includes('Failed to fetch') ? '网络失败（可能是 CORS）' : msg);
    } finally {
      setModelsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
      <div className="bg-[#F2F2F7] pt-12 pb-3 px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="p-1 -ml-1 text-blue-500">
            <ChevronLeft size={28} />
          </button>
          <span className="text-blue-500 font-medium text-lg">Settings</span>
        </div>
      </div>

      <div className="px-4 pb-2 pt-2 shrink-0">
        <h1 className="text-[28px] font-bold text-black tracking-tight">设置</h1>
        <p className="text-[13px] text-[#8E8E93] mt-1">API（OpenAI 兼容）为小手机各功能统一入口</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
        <div className="bg-white rounded-[10px] overflow-hidden shadow-sm mb-4">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[13px] text-[#8E8E93] font-medium uppercase tracking-wide">API 配置</p>
          </div>
          <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
            <label className="flex items-center justify-between gap-3 py-1">
              <span className="text-[15px] text-black">使用酒馆插头 API 设置</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#007AFF]"
                checked={cfg.useTavernApiSettings}
                onChange={e => setField('useTavernApiSettings', e.target.checked)}
              />
            </label>
            <p className="text-[12px] text-[#8E8E93] -mt-2 leading-relaxed">
              <strong className="text-[#636366] font-medium">开：</strong>
              使用酒馆插头中的 API 地址和模型（由小手机壳脚本提供），无需手动填写。<br />
              <strong className="text-[#636366] font-medium">关：</strong>
              使用下方手动填写的 API 配置。
            </p>

            {cfg.useTavernApiSettings && resolvedCfg.source === 'tavern' && (
              <div className="mt-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-[12px] text-green-700 font-medium mb-1">当前使用酒馆插头配置：</p>
                <p className="text-[11px] text-green-600">
                  <span className="font-medium">API：</span>
                  {resolvedCfg.apiBaseUrl || '（未获取到）'}
                </p>
                <p className="text-[11px] text-green-600">
                  <span className="font-medium">模型：</span>
                  {resolvedCfg.model || '（未获取到）'}
                </p>
              </div>
            )}

            {cfg.useTavernApiSettings && resolvedCfg.source !== 'tavern' && (
              <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-[12px] text-amber-700">
                  正在尝试使用酒馆配置，但尚未获取到。请确保：<br />
                  1. 小手机壳脚本已正确加载<br />
                  2. 已与小手机建立连接
                </p>
              </div>
            )}

            <label className={`block ${cfg.useTavernApiSettings ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-[13px] text-[#8E8E93]">API URL</span>
              <input
                type="url"
                autoComplete="off"
                placeholder="https://api.openai.com/v1"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F2F2F7] px-3 py-2 text-[15px] text-black outline-none focus:ring-2 focus:ring-[#007AFF]/30 disabled:opacity-60"
                value={cfg.apiBaseUrl}
                onChange={e => setField('apiBaseUrl', e.target.value)}
                disabled={cfg.useTavernApiSettings}
              />
            </label>
            <label className={`block ${cfg.useTavernApiSettings ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-[13px] text-[#8E8E93]">API Key</span>
              <input
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F2F2F7] px-3 py-2 text-[15px] text-black outline-none focus:ring-2 focus:ring-[#007AFF]/30 disabled:opacity-60"
                value={cfg.apiKey}
                onChange={e => setField('apiKey', e.target.value)}
                disabled={cfg.useTavernApiSettings}
              />
            </label>
            <label className={`block ${cfg.useTavernApiSettings ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-[13px] text-[#8E8E93]">模型</span>
              <input
                type="text"
                list="tavern-phone-model-datalist"
                autoComplete="off"
                placeholder="手动输入或先获取列表后选择"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F2F2F7] px-3 py-2 text-[15px] text-black outline-none focus:ring-2 focus:ring-[#007AFF]/30 disabled:opacity-60"
                value={cfg.model}
                onChange={e => setField('model', e.target.value)}
                disabled={cfg.useTavernApiSettings}
              />
              <datalist id="tavern-phone-model-datalist">
                {modelOptions.map(id => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="text-[13px] text-[#8E8E93]">最大重试次数（0–10）</span>
              <input
                type="number"
                min={0}
                max={10}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F2F2F7] px-3 py-2 text-[15px] text-black outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                value={cfg.maxRetries}
                onChange={e => onMaxRetriesChange(e.target.value)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 py-1">
              <span className="text-[15px] text-black">注入主剧情与档案摘要</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#007AFF]"
                checked={cfg.injectMainStory}
                onChange={e => setField('injectMainStory', e.target.checked)}
              />
            </label>
            <p className="text-[12px] text-[#8E8E93] -mt-2 leading-relaxed">
              <strong className="text-[#636366] font-medium">开：</strong>
              发微信时会把「主界面最近剧情的一小段」和「角色卡里该角色的剧情摘要」塞进系统提示，对方回复更容易接上你在酒馆里正在演的主线。
              <br />
              <strong className="text-[#636366] font-medium">关：</strong>
              只用当前人设、心理活动、变量等小手机自带的上下文，不读主界面楼层和档案摘要（更省 token，主剧情也不会被大量引用）。
            </p>

            <label className="flex items-center justify-between gap-3 py-1">
              <span className="text-[15px] text-black">回合摘要写入聊天变量</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#007AFF]"
                checked={cfg.phoneMemoryWrite}
                onChange={e => setField('phoneMemoryWrite', e.target.checked)}
              />
            </label>
            <p className="text-[12px] text-[#8E8E93] -mt-2 leading-relaxed">
              <strong className="text-[#636366] font-medium">开：</strong>
              每在微信里聊完一轮，会生成一小段「刚才聊了什么」的摘要，通过<strong className="text-[#636366]">小手机壳脚本</strong>写进<strong className="text-[#636366]">聊天变量</strong>（路径由壳脚本里的{' '}
              <code className="text-[11px] bg-gray-100 px-1 rounded">phone_wechat_memory_path</code> 决定，默认{' '}
              <code className="text-[11px] bg-gray-100 px-1 rounded">stat_data.手机微信记忆</code>
              ），主界面剧情或别的脚本可以读这份记忆。
              <br />
              <strong className="text-[#636366] font-medium">关：</strong>
              不写聊天变量，主界面不会自动记住微信里单独聊过什么。
              <br />
              可选：在壳脚本里配置{' '}
              <code className="text-[11px] bg-gray-100 px-1 rounded">phone_wechat_worldbook_mirror</code>
              ，把同一段摘要再追加到指定世界书条目末尾，方便用世界书喂给模型。
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={testState === 'loading'}
                  onClick={() => void handleTest()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#007AFF] py-2.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
                >
                  {testState === 'loading' ? <Loader2 className="animate-spin" size={18} /> : null}
                  连接测试
                </button>
                <button
                  type="button"
                  disabled={modelsLoading}
                  onClick={() => void handleFetchModels()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-800 py-2.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
                >
                  {modelsLoading ? <Loader2 className="animate-spin" size={18} /> : null}
                  获取可用模型
                </button>
              </div>
              {testState !== 'idle' && testMessage && (
                <p
                  className={`text-[13px] px-1 ${testState === 'success' ? 'text-green-600' : testState === 'error' ? 'text-red-600' : 'text-[#8E8E93]'}`}
                >
                  {testMessage}
                </p>
              )}
              {modelsError ? <p className="text-[13px] text-red-600 px-1">{modelsError}</p> : null}
              {modelOptions.length > 0 && !modelsError && (
                <p className="text-[12px] text-[#8E8E93] px-1">已载入 {modelOptions.length} 个模型，可在上方输入框中从列表选择</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[10px] overflow-hidden shadow-sm">
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
