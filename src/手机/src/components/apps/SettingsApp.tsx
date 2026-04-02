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
import { THEME_LABELS, type PhoneTheme } from '../../theme';

export default function SettingsApp({
  onClose,
  setWallpaper,
  switchTheme,
  currentTheme = 'modern',
}: {
  onClose: () => void;
  setWallpaper?: (url: string) => void;
  switchTheme?: (theme: PhoneTheme) => void;
  currentTheme?: PhoneTheme;
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
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--app-content-bg, #F2F2F7)' }}>
      <div className="pt-12 pb-3 px-4 flex items-center justify-between shrink-0 z-10" style={{ backgroundColor: 'var(--app-content-bg, #F2F2F7)' }}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="p-1 -ml-1" style={{ color: 'var(--accent)' }}>
            <ChevronLeft size={28} />
          </button>
          <span className="font-medium text-lg" style={{ color: 'var(--accent)' }}>Settings</span>
        </div>
      </div>

      <div className="px-4 pb-2 pt-2 shrink-0">
        <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--settings-title, #000)' }}>设置</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--settings-desc)' }}>API（OpenAI 兼容）为小手机各功能统一入口</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
        <div className="rounded-[10px] overflow-hidden mb-4" style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
          <div className="px-3 pt-3 pb-1">
            <p className="text-[13px] font-medium uppercase tracking-wide" style={{ color: 'var(--settings-desc)' }}>API 配置</p>
          </div>
          <div className="px-3 pb-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
            <label className="flex items-center justify-between gap-3 py-1">
              <span className="text-[15px]" style={{ color: 'var(--settings-title)' }}>使用酒馆插头 API 设置</span>
              <input
                type="checkbox"
                className="h-5 w-5"
                style={{ accentColor: 'var(--accent)' }}
                checked={cfg.useTavernApiSettings}
                onChange={e => setField('useTavernApiSettings', e.target.checked)}
              />
            </label>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--settings-desc)' }}>
              <strong className="font-medium" style={{ color: 'var(--settings-title)' }}>开：</strong>
              使用酒馆插头中的 API 地址和模型（由小手机壳脚本提供），无需手动填写。<br />
              <strong className="font-medium" style={{ color: 'var(--settings-title)' }}>关：</strong>
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
              <span className="text-[13px]" style={{ color: 'var(--settings-desc)' }}>API URL</span>
              <input
                type="url"
                autoComplete="off"
                placeholder="https://api.openai.com/v1"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] outline-none focus:ring-2 disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--input-text)',
                }}
                value={cfg.apiBaseUrl}
                onChange={e => setField('apiBaseUrl', e.target.value)}
                disabled={cfg.useTavernApiSettings}
              />
            </label>
            <label className={`block ${cfg.useTavernApiSettings ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-[13px]" style={{ color: 'var(--settings-desc)' }}>API Key</span>
              <input
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] outline-none focus:ring-2 disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--input-text)',
                }}
                value={cfg.apiKey}
                onChange={e => setField('apiKey', e.target.value)}
                disabled={cfg.useTavernApiSettings}
              />
            </label>
            <label className={`block ${cfg.useTavernApiSettings ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-[13px]" style={{ color: 'var(--settings-desc)' }}>模型</span>
              <input
                type="text"
                list="tavern-phone-model-datalist"
                autoComplete="off"
                placeholder="手动输入或先获取列表后选择"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] outline-none focus:ring-2 disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--input-text)',
                }}
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
              <span className="text-[13px]" style={{ color: 'var(--settings-desc)' }}>最大重试次数（0–10）</span>
              <input
                type="number"
                min={0}
                max={10}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--input-text)',
                }}
                value={cfg.maxRetries}
                onChange={e => onMaxRetriesChange(e.target.value)}
              />
            </label>

            {/* 连接测试按钮移到重试下面 */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={testState === 'loading'}
                  onClick={() => void handleTest()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {testState === 'loading' ? <Loader2 className="animate-spin" size={18} /> : null}
                  连接测试
                </button>
                <button
                  type="button"
                  disabled={modelsLoading}
                  onClick={() => void handleFetchModels()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--settings-title)' }}
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

            {/* 绿色长条保存按钮 */}
            <button
              type="button"
              onClick={() => {
                saveTavernPhoneApiConfig(cfg);
                setTestMessage('设置已保存');
                setTestState('success');
                setTimeout(() => setTestState('idle'), 2000);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold text-white active:opacity-90 bg-green-500 hover:bg-green-600 transition-colors"
            >
              保存设置
            </button>

            {/* 开关区域 - 简化版，不显示详细解释 */}
            <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--card-border)' }}>
              <p className="text-[13px] font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--settings-desc)' }}>功能开关</p>

              <label className="flex items-center justify-between gap-3 py-2">
                <span className="text-[15px]" style={{ color: 'var(--settings-title)' }}>注入主剧情与档案摘要</span>
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={cfg.injectMainStory}
                  onChange={e => setField('injectMainStory', e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-3 py-2">
                <span className="text-[15px]" style={{ color: 'var(--settings-title)' }}>回合摘要写入聊天变量</span>
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={cfg.phoneMemoryWrite}
                  onChange={e => setField('phoneMemoryWrite', e.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
          <div className="px-3 pt-3 pb-1">
            <p className="text-[13px] font-medium uppercase tracking-wide" style={{ color: 'var(--settings-desc)' }}>界面风格</p>
          </div>
          <div className="flex items-center justify-between p-3 gap-3" style={{ borderTop: '1px solid var(--card-border)' }}>
            {/* 现代简约卡片 */}
            <button
              type="button"
              onClick={() => switchTheme?.('modern')}
              className={`flex-1 p-3 rounded-xl border-2 transition-all text-left ${
                currentTheme === 'modern'
                  ? 'border-[#007AFF] bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className="h-10 rounded-lg mb-2 flex items-center justify-center gap-1"
                style={{ background: 'linear-gradient(135deg, #778899 0%, #2c3e50 50%, #1a252f 100%)' }}
              >
                <div className="w-5 h-5 rounded-md bg-white/25 flex items-center justify-center">
                  <div className="w-3 h-3 rounded bg-white/50" />
                </div>
              </div>
              <p className={`text-xs font-medium ${currentTheme === 'modern' ? 'text-[#007AFF]' : 'text-gray-600'}`}>
                {THEME_LABELS.modern}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">iOS 风格 · 明亮</p>
            </button>

            {/* 优雅暗紫卡片 */}
            <button
              type="button"
              onClick={() => switchTheme?.('elegant')}
              className={`flex-1 p-3 rounded-xl border-2 transition-all text-left ${
                currentTheme === 'elegant'
                  ? 'border-[#6c5ce7] bg-[#6c5ce7]/10'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className="h-10 rounded-lg mb-2 flex items-center justify-center gap-1"
                style={{ background: 'linear-gradient(135deg, #2d1b69 0%, #1a1040 50%, #0f0a20 100%)' }}
              >
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center border border-white/15">
                  <div className="w-3 h-3 rounded bg-white/20" />
                </div>
              </div>
              <p className={`text-xs font-medium ${currentTheme === 'elegant' ? 'text-[#6c5ce7]' : 'text-gray-600'}`}>
                {THEME_LABELS.elegant}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">暗紫磨砂 · 优雅</p>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[10px] overflow-hidden shadow-sm">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[13px] font-medium uppercase tracking-wide" style={{ color: 'var(--settings-desc)' }}>关于小手机</p>
          </div>
          <div className="flex items-center justify-between p-3" style={{ borderTop: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-800 rounded-lg flex items-center justify-center text-white">
                <Smartphone size={18} />
              </div>
              <div>
                <span className="text-[17px] block" style={{ color: 'var(--settings-title)' }}>{TAVERN_PHONE_UI_LABEL}</span>
                <span className="text-[13px]" style={{ color: 'var(--settings-desc)' }}>界面版本</span>
              </div>
            </div>
            <span className="text-[17px] font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>v{TAVERN_PHONE_UI_VERSION}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
