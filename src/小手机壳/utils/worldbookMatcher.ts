/**
 * 规则模拟器世界书自动匹配工具
 * 根据 chatScopeId 自动激活匹配的全局世界书
 * 只影响以 "规则模拟器" 开头、以 "ms" 结尾的世界书
 */

import { getWorldbook, rebindGlobalWorldbooks, createWorldbookEntries } from '@types/function/worldbook';
import type { WorldbookEntry } from '@types/function/worldbook';

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

    // 自动创建角色档案条目
    await createCharacterArchiveEntry(targetName);

  } catch (error) {
    console.error(MODULE_NAME, '激活世界书失败:', error);
  }
}

/**
 * 创建角色一览条目（仅在第一个角色出现时创建）
 * 插入位置：角色定义前，顺序4
 */
async function createCharacterOverviewEntry(worldbookName: string): Promise<void> {
  const ENTRY_NAME = '【角色一览】';

  try {
    // 检查是否已存在
    const existing = await getWorldbook(worldbookName);
    const hasEntry = existing.some(e => e.name === ENTRY_NAME);
    if (hasEntry) {
      console.log(MODULE_NAME, '角色一览条目已存在:', worldbookName);
      return;
    }

    // 角色一览关键词（用于触发显示）
    const overviewKeywords = ['角色一览', '人物一览', '登场角色', '出场人物', '有哪些人', '都有谁'];

    const newEntry: Partial<WorldbookEntry> = {
      name: ENTRY_NAME,
      enabled: true,
      content: '', // 初始为空，后续添加角色简介
      comment: '规则模拟器角色一览（自动创建），包含所有角色的一句话简介',
      strategy: {
        type: 'selective', // 绿灯
        keys: overviewKeywords,
        keys_secondary: { logic: 'and_any', keys: [] },
        scan_depth: 4, // 浅层扫描即可
      },
      position: {
        type: 'before_character_definition', // 角色定义之前
        role: 'system',
        depth: 0,
        order: 4, // 顺序4
      },
      probability: 100,
      recursion: {
        prevent_incoming: true,
        prevent_outgoing: true,
        delay_until: null,
      },
      effect: {
        sticky: null,
        cooldown: null,
        delay: null,
      },
    };

    await createWorldbookEntries(worldbookName, [newEntry as WorldbookEntry], { render: 'immediate' });
    console.log(MODULE_NAME, '已创建角色一览条目:', worldbookName);
    toastr.success(`已创建角色一览条目: ${ENTRY_NAME}`);

  } catch (error) {
    console.error(MODULE_NAME, '创建角色一览条目失败:', error);
  }
}

/**
 * 更新角色一览条目（添加新角色简介）
 */
async function updateCharacterOverviewEntry(
  worldbookName: string,
  characterName: string,
  briefIntro: string,
): Promise<void> {
  const ENTRY_NAME = '【角色一览】';

  try {
    const existing = await getWorldbook(worldbookName);
    const overviewEntry = existing.find(e => e.name === ENTRY_NAME);

    if (!overviewEntry) {
      console.log(MODULE_NAME, '角色一览条目不存在，跳过更新:', worldbookName);
      return;
    }

    // 构建新角色简介行
    const newLine = `- ${characterName}: ${briefIntro}`;

    // 追加到现有内容
    const updatedContent = overviewEntry.content
      ? `${overviewEntry.content}\n${newLine}`
      : newLine;

    // 更新条目内容（使用 replaceWorldbook 或直接修改）
    // 这里我们创建一个新条目替换旧的
    const updatedEntry: Partial<WorldbookEntry> = {
      ...overviewEntry,
      content: updatedContent,
      comment: `${overviewEntry.comment} | 已添加: ${characterName}`,
    };

    await createWorldbookEntries(worldbookName, [updatedEntry as WorldbookEntry], { render: 'immediate' });
    console.log(MODULE_NAME, `已更新角色一览，添加: ${characterName}`);

  } catch (error) {
    console.error(MODULE_NAME, '更新角色一览条目失败:', error);
  }
}

/**
 * 创建角色档案条目
 * 特性：绿灯、角色定义后、禁止双递归、深度90起递增、概率100%
 * 同时管理角色一览条目的创建和更新
 */
export async function createCharacterArchiveEntry(
  worldbookName: string,
  characterInfo?: { name: string; briefIntro: string },
): Promise<void> {
  if (!worldbookName || !worldbookName.trim()) {
    console.log(MODULE_NAME, '世界书名称为空，跳过创建角色档案');
    return;
  }

  const ENTRY_NAME_PREFIX = '【角色档案】';

  try {
    // 获取世界书现有条目，计算已有角色档案数量
    const existing = await getWorldbook(worldbookName);
    const archiveEntries = existing.filter(e => e.name?.startsWith(ENTRY_NAME_PREFIX));
    const archiveCount = archiveEntries.length;

    // 如果是第一个角色，先创建角色一览
    if (archiveCount === 0) {
      await createCharacterOverviewEntry(worldbookName);
    }

    // 深度从90开始，每个往后移1
    const depth = 90 + archiveCount;

    // 生成新条目名称（带序号）
    const entryNumber = archiveCount + 1;
    const ENTRY_NAME = entryNumber === 1 ? ENTRY_NAME_PREFIX : `${ENTRY_NAME_PREFIX}${entryNumber}`;

    // 构建角色称呼关键词（精简版，去掉容易重复的通用词）
    const roleKeywords = [
      // 特定称呼（不易重复）
      '本名', '真名', '爱称', '小名', '乳名',
      '诨名', '花名', '代号',
      '头衔', '职称', '官职',
      '化名称', '曾用名', '旧名',
      '尊称', '敬称', '称谓', '叫法',
      // 特定场景
      '立场', '阵营', '登场', '出场',
    ].join(',');

    // 创建角色档案条目
    const newEntry: Partial<WorldbookEntry> = {
      name: ENTRY_NAME,
      enabled: true,
      content: '', // 空内容，等待后续填充
      comment: `规则模拟器角色档案条目（自动创建）| 关键词: ${roleKeywords}`,
      strategy: {
        type: 'selective', // 绿灯
        keys: roleKeywords.split(',').map(k => k.trim()).filter(k => k),
        keys_secondary: { logic: 'and_any', keys: [] },
        scan_depth: depth, // 深度从90开始递增
      },
      position: {
        type: 'after_character_definition', // 角色定义之后
        role: 'system',
        depth: 0,
        order: 0,
      },
      probability: 100, // 激活概率100%
      recursion: {
        prevent_incoming: true, // 禁止递归激活本条目
        prevent_outgoing: true, // 禁止本条目递归激活其他条目
        delay_until: null,
      },
      effect: {
        sticky: null,
        cooldown: null,
        delay: null,
      },
    };

    await createWorldbookEntries(worldbookName, [newEntry as WorldbookEntry], { render: 'immediate' });
    console.log(MODULE_NAME, '已创建角色档案条目:', worldbookName);
    toastr.success(`已创建角色档案条目: ${ENTRY_NAME}`);

    // 如果有角色信息，更新角色一览
    if (characterInfo?.name && characterInfo?.briefIntro) {
      await updateCharacterOverviewEntry(worldbookName, characterInfo.name, characterInfo.briefIntro);
    }

  } catch (error) {
    console.error(MODULE_NAME, '创建角色档案条目失败:', error);
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
