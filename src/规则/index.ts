import { TimeoutError, waitUntil } from 'async-wait-until';
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

  // ⭐ 与 store 一致：live 宿主等 latest (-1)；历史层只等本层，短超时避免卡死
  const mid = getCurrentMessageId();
  const last = getLastMessageId();
  const live = mid === last;
  const waitMessageId = live ? -1 : mid;
  try {
    await waitUntil(
      () => {
        try {
          const vars = getVariables({ type: 'message', message_id: waitMessageId });
          return _.has(vars, 'stat_data');
        } catch {
          return false;
        }
      },
      { timeout: live ? 10000 : 2000 },
    );
  } catch (e) {
    if (live || !(e instanceof TimeoutError)) {
      throw e;
    }
    console.info('[规则] 历史楼层未在限时内出现 stat_data，继续挂载（只读快照可能为空）');
  }

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
