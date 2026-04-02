/**
 * 规则模拟器世界书自动匹配工具
 * 根据 chatScopeId 自动激活匹配的全局世界书
 * 只影响以 "规则模拟器" 开头、以 "ms" 结尾的世界书
 */

import { getWorldbook, rebindGlobalWorldbooks } from '@types/function/worldbook';

const MODULE_NAME = '[worldbookMatcher]';

/**
 * 检查世界书名称是否符合 "规则模拟器*ms" 格式
 */
export function isRuleSimulatorWorldbook(name: string): boolean {
  return name.startsWith('规则模拟器') && name.endsWith('ms');
}

/**
 * 根据 chatScopeId 构建可能的世界书名称
 * 格式: 规则模拟器V0.63 - 2026-03-31@10h46m17s752ms
 */
function buildWorldbookName(chatScopeId: string): string {
  // 从脚本变量读取版本号，默认 V0.63
  try {
    const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    const version = String(scriptVars.rule_simulator_version ?? 'V0.63');
    return `规则模拟器${version} - ${chatScopeId}`;
  } catch {
    return `规则模拟器V0.63 - ${chatScopeId}`;
  }
}

/**
 * 激活与 chatScopeId 匹配的规则模拟器世界书
 * 只影响以 "规则模拟器" 开头、以 "ms" 结尾的世界书，不影响其他全局世界书
 */
export async function activateMatchingRuleWorldbook(chatScopeId: string): Promise<void> {
  if (!chatScopeId || !chatScopeId.trim()) {
    console.log(MODULE_NAME, 'chatScopeId 为空，跳过');
    return;
  }

  const targetName = buildWorldbookName(chatScopeId);

  // 安全检查：确保符合命名规则
  if (!isRuleSimulatorWorldbook(targetName)) {
    console.warn(MODULE_NAME, '构建的世界书名称不符合规则:', targetName);
    return;
  }

  try {
    // 检查目标世界书是否存在
    const entries = await getWorldbook(targetName);
    if (entries.length === 0) {
      console.log(MODULE_NAME, '未找到匹配的世界书:', targetName);
      return;
    }

    // 获取当前所有全局世界书名称
    // 注意：酒馆没有直接获取当前全局世界书列表的接口
    // 我们通过 getCharWorldbookNames 获取角色卡绑定的世界书作为参考
    const charBooks = getCharWorldbookNames('current');
    const currentGlobals: string[] = [];

    // 收集当前已知的全局世界书（基于角色卡绑定的）
    if (charBooks?.primary) currentGlobals.push(charBooks.primary);
    if (charBooks?.additional?.length) {
      currentGlobals.push(...charBooks.additional);
    }

    // 过滤掉旧的"规则模拟器"世界书（保留其他类型）
    const preservedGlobals = currentGlobals.filter(name =>
      !isRuleSimulatorWorldbook(name)
    );

    // 构建新的全局世界书列表：保留的其他世界书 + 新匹配的规则模拟器世界书
    const newGlobals = [...preservedGlobals, targetName];

    // 去重
    const uniqueGlobals = [...new Set(newGlobals)];

    // 激活为全局世界书
    await rebindGlobalWorldbooks(uniqueGlobals);

    console.log(MODULE_NAME, '已激活匹配的世界书:', targetName);
    console.log(MODULE_NAME, '当前全局世界书:', uniqueGlobals);
    toastr.success(`已激活世界书: ${targetName}`);

  } catch (error) {
    console.error(MODULE_NAME, '激活世界书失败:', error);
  }
}

/**
 * 检查是否需要执行世界书匹配
 * 基于脚本变量 enable_rule_worldbook_match 控制
 */
export function shouldEnableWorldbookMatcher(): boolean {
  try {
    const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    // 默认启用，除非显式设置为 false
    return scriptVars.enable_rule_worldbook_match !== false;
  } catch {
    return true;
  }
}
