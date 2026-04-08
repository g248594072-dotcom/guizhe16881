import { waitUntil } from 'async-wait-until';
import { normalizeFetishRecord, normalizeSensitivePartRecord } from './utils/tagMap';
import App from './App.vue';
import './index.scss';
import './styles/cyber-neon-theme.scss';
import './styles/cyber-panels-dark.scss';

function registerMvuNestedObjectFix() {
  eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (variables: Mvu.MvuData) => {
    const 角色档案 = variables?.stat_data?.角色档案;
    if (!角色档案 || typeof 角色档案 !== 'object') return;

    let fixed = false;
    for (const char of Object.values(角色档案 as Record<string, any>)) {
      if (!char || typeof char !== 'object') continue;

      if (char.性癖 != null) {
        const normalized = normalizeFetishRecord(char.性癖);
        if (!_.isEqual(char.性癖, normalized)) {
          char.性癖 = normalized;
          fixed = true;
        }
      }

      if (char.敏感部位 != null) {
        const normalized = normalizeSensitivePartRecord(char.敏感部位);
        if (!_.isEqual(char.敏感部位, normalized)) {
          char.敏感部位 = normalized;
          fixed = true;
        }
      }
    }

    if (fixed) {
      console.warn('[规则] VARIABLE_UPDATE_ENDED: 修复了性癖/敏感部位嵌套对象污染');
    }
  });
}

$(async () => {
  // 等待酒馆助手全局初始化完成
  await waitUntil(() => typeof getVariables === 'function', { timeout: 30000 });

  // ⭐ 关键：等待 MVU 变量框架初始化完成
  await waitGlobalInitialized('Mvu');

  // 注册 MVU 嵌套对象修复：在每次变量更新后立即规范化性癖/敏感部位字段
  registerMvuNestedObjectFix();

  // ⭐ 关键：等待变量被正确设置（确保 schema 已解析）
  await waitUntil(() => {
    try {
      // 与 store 一致：消息变量在「最新楼层」(-1)，与 iframe 所在楼层 (getCurrentMessageId) 可能不同
      const vars = getVariables({ type: 'message', message_id: -1 });
      return _.has(vars, 'stat_data');
    } catch {
      return false;
    }
  }, { timeout: 10000 });

  console.log('🎮 [规则] 同层前端界面初始化完成，MVU 已就绪');

  // 创建 Vue 应用
  const app = createApp(App).use(createPinia());

  // 挂载到 #app
  app.mount('#app');

  console.log('✅ [规则] 同层前端界面已挂载');

  // 页面卸载时清理
  $(window).on('pagehide', () => {
    app.unmount();
  });
});
