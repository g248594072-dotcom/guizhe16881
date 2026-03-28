import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Smartphone } from 'lucide-react';
import { TAVERN_PHONE_UI_LABEL, TAVERN_PHONE_UI_VERSION } from '../../tavernPhoneVersion';
import {
  loadTavernPhoneApiConfig,
  saveTavernPhoneApiConfig,
  type TavernPhoneApiConfig,
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
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  useEffect(() => {
    saveTavernPhoneApiConfig(cfg);
  }, [cfg]);

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
    const r = await testOpenAiCompatibleConnection(cfg.apiBaseUrl, cfg.apiKey);
    setTestMessage(r.message);
    setTestState(r.ok ? 'success' : 'error');
  };

  const handleFetchModels = async () => {
    setModelsLoading(true);
    setModelsError('');
    try {
      if (!cfg.apiBaseUrl.trim()) {
        throw new Error('请先填写 API URL');
      }
      if (!cfg.apiKey.trim()) {
        throw new Error('请先填写 API Key');
      }
      const ids = await fetchOpenAiCompatibleModelIds(cfg.apiBaseUrl, cfg.apiKey);
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
            <label className="block">
              <span className="text-[13px] text-[#8E8E93]">API URL</span>
              <input
                type="url"
                autoComplete="off"
                placeholder="https://api.openai.com/v1"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F2F2F7] px-3 py-2 text-[15px] text-black outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                value={cfg.apiBaseUrl}
                onChange={e => setField('apiBaseUrl', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[13px] text-[#8E8E93]">API Key</span>
              <input
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F2F2F7] px-3 py-2 text-[15px] text-black outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                value={cfg.apiKey}
                onChange={e => setField('apiKey', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[13px] text-[#8E8E93]">模型</span>
              <input
                type="text"
                list="tavern-phone-model-datalist"
                autoComplete="off"
                placeholder="手动输入或先获取列表后选择"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-[#F2F2F7] px-3 py-2 text-[15px] text-black outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                value={cfg.model}
                onChange={e => setField('model', e.target.value)}
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
