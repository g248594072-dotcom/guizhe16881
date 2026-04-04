/**
 * 规则模拟器世界书自动匹配工具
 * 根据 chatScopeId 自动激活匹配的全局世界书
 * 只影响以 "ms" 结尾的世界书（时间戳格式），前缀不限
 */

import { getWorldbook, rebindGlobalWorldbooks, createWorldbookEntries, deleteWorldbook } from '@types/function/worldbook';
import type { WorldbookEntry } from '@types/function/worldbook';

const MODULE_NAME = '[worldbookMatcher]';

// 脚本变量中存储已创建的世界书列表的键名
const CREATED_WORLDBOOKS_KEY = '_rule_simulator_created_worldbooks';

/**
 * 获取脚本存储的已创建世界书列表
 */
function getCreatedWorldbookList(): string[] {
  try {
    const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    const list = scriptVars[CREATED_WORLDBOOKS_KEY];
    if (Array.isArray(list)) {
      return list.filter((item): item is string => typeof item === 'string');
    }
  } catch (e) {
    console.warn(MODULE_NAME, '读取已创建世界书列表失败:', e);
  }
  return [];
}

/**
 * 添加世界书到已创建列表
 */
function addToCreatedWorldbookList(worldbookName: string): void {
  try {
    const currentList = getCreatedWorldbookList();
    if (!currentList.includes(worldbookName)) {
      const newList = [...currentList, worldbookName];
      replaceVariables({ [CREATED_WORLDBOOKS_KEY]: newList }, { type: 'script', script_id: getScriptId() });
      console.log(MODULE_NAME, '已记录创建的世界书:', worldbookName);
    }
  } catch (e) {
    console.warn(MODULE_NAME, '记录世界书创建失败:', e);
  }
}

/**
 * 从已创建列表中移除世界书
 */
function removeFromCreatedWorldbookList(worldbookName: string): void {
  try {
    const currentList = getCreatedWorldbookList();
    const newList = currentList.filter(name => name !== worldbookName);
    if (newList.length !== currentList.length) {
      replaceVariables({ [CREATED_WORLDBOOKS_KEY]: newList }, { type: 'script', script_id: getScriptId() });
    }
  } catch (e) {
    console.warn(MODULE_NAME, '从记录中移除世界书失败:', e);
  }
}

/**
 * 检查世界书名称是否符合规则模拟器世界书格式
 * 格式: 规则模拟器V{版本} - {时间戳}ms
 * 如: 规则模拟器V0.63 - 2026-03-31@10h46m17s752ms
 */
export function isRuleSimulatorWorldbook(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();

  // 严格匹配：以 ms 结尾
  if (!trimmed.endsWith('ms')) return false;

  // 必须包含 "规则模拟器"
  if (!trimmed.includes('规则模拟器')) return false;

  // 宽松匹配：包含时间戳模式 YYYY-MM-DD@HHhMMm...
  // 支持变体：有秒或无秒，有毫秒或无毫秒
  const timestampPattern = /\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m/;
  if (timestampPattern.test(trimmed)) return true;

  // 最后兜底：只要是 规则模拟器 + ms 结尾就算
  return true;
}

/**
 * 根据 chatScopeId 构建可能的世界书名称
 * 格式: [前缀][版本] - [chatScopeId]ms
 * 如: 规则模拟器V0.7 - 2026-04-03@16h39m53s943ms
 * 前缀和版本可通过脚本变量配置
 */
function buildWorldbookName(chatScopeId: string): string {
  try {
    const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    const prefix = String(scriptVars.rule_worldbook_prefix ?? '规则模拟器');
    const version = String(scriptVars.rule_simulator_version ?? 'V0.7');
    return `${prefix}${version} - ${chatScopeId}`;
  } catch {
    return `规则模拟器V0.7 - ${chatScopeId}`;
  }
}

/**
 * 激活与 chatScopeId 匹配的规则模拟器世界书
 * 只影响以 "ms" 结尾的世界书，不影响其他全局世界书
 * 会自动关闭其他 ms 结尾的旧世界书，只保留当前匹配的世界书
 */
export async function activateMatchingRuleWorldbook(chatScopeId: string): Promise<void> {
  if (!chatScopeId || !chatScopeId.trim()) {
    console.log(MODULE_NAME, 'chatScopeId 为空，跳过');
    return;
  }

  const targetName = buildWorldbookName(chatScopeId);

  // 安全检查：确保符合命名规则（ms结尾）
  if (!isRuleSimulatorWorldbook(targetName)) {
    console.warn(MODULE_NAME, '构建的世界书名称不符合规则（需要ms结尾）:', targetName);
    return;
  }

  try {
    // 检查目标世界书是否存在
    const entries = await getWorldbook(targetName);
    if (entries.length === 0) {
      console.log(MODULE_NAME, '未找到匹配的世界书:', targetName);
      return;
    }

    // 记录到已创建列表（如果尚未记录）
    addToCreatedWorldbookList(targetName);

    // 获取当前所有世界书名称（异步收集）
    const currentGlobals = await collectAllMsWorldbooksAsync();

    // 收集当前已激活的 ms 结尾的世界书（用于关闭）
    const activeMsBooks = currentGlobals.filter(name => isRuleSimulatorWorldbook(name));

    // 如果目标世界书已经在全局列表中，且是唯一的 ms 世界书，不需要切换
    if (activeMsBooks.length === 1 && activeMsBooks[0] === targetName) {
      console.log(MODULE_NAME, '目标世界书已经是当前激活的 ms 世界书，无需切换:', targetName);
      return;
    }

    // 过滤掉所有旧的 ms 结尾世界书（关闭旧的）
    const preservedGlobals = currentGlobals.filter(name =>
      !isRuleSimulatorWorldbook(name)
    );

    // 构建新的全局世界书列表：保留的其他世界书 + 新匹配的 ms 世界书
    const newGlobals = [...preservedGlobals, targetName];

    // 去重
    const uniqueGlobals = [...new Set(newGlobals)];

    // 激活为全局世界书（同时关闭了旧的 ms 世界书）
    await rebindGlobalWorldbooks(uniqueGlobals);

    console.log(MODULE_NAME, '已切换世界书:');
    console.log(MODULE_NAME, '  关闭:', activeMsBooks.length > 0 ? activeMsBooks.join(', ') : '无');
    console.log(MODULE_NAME, '  开启:', targetName);
    console.log(MODULE_NAME, '当前全局世界书:', uniqueGlobals);
    toastr.success(`已切换世界书: ${targetName}`);

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

/**
 * 关闭所有以 "ms" 结尾的全局世界书
 * 在聊天切换、读档或新聊天开始时调用，清理旧的世界书
 * 只影响 ms 结尾的世界书，其他类型不受影响
 */
export async function deactivateAllRuleSimulatorWorldbooks(): Promise<void> {
  try {
    // 获取当前所有已知的世界书（异步收集）
    const currentGlobals = await collectAllMsWorldbooksAsync();

    // 收集当前已激活的 ms 结尾的世界书
    const activeMsBooks = currentGlobals.filter(name => isRuleSimulatorWorldbook(name));

    if (activeMsBooks.length === 0) {
      console.log(MODULE_NAME, '没有 ms 结尾的全局世界书需要关闭');
      return;
    }

    // 过滤掉所有 ms 结尾的世界书，保留其他类型
    const preservedGlobals = currentGlobals.filter(name =>
      !isRuleSimulatorWorldbook(name)
    );

    // 重新绑定全局世界书（只保留非 ms 结尾的）
    await rebindGlobalWorldbooks(preservedGlobals);

    console.log(MODULE_NAME, '已关闭所有 ms 结尾的全局世界书:', activeMsBooks.join(', '));
    console.log(MODULE_NAME, '当前保留的全局世界书:', preservedGlobals);

  } catch (error) {
    console.error(MODULE_NAME, '关闭 ms 世界书失败:', error);
  }
}

/**
 * 动态探测所有可能的世界书
 * 通过尝试从运行时获取 SillyTavern 的世界书列表
 */
async function discoverAllMsWorldbooks(): Promise<string[]> {
  const foundBooks: string[] = [];

  // 方法1：尝试从运行时 window.SillyTavern 获取 world_names
  try {
    const anyWin = window as any;
    if (anyWin.SillyTavern?.world_names && Array.isArray(anyWin.SillyTavern.world_names)) {
      const msBooks = anyWin.SillyTavern.world_names.filter((name: string) => isRuleSimulatorWorldbook(name));
      console.log(MODULE_NAME, '从 window.SillyTavern.world_names 找到:', anyWin.SillyTavern.world_names, '过滤后:', msBooks);
      if (msBooks.length > 0) return msBooks;
    }
  } catch (e) {
    console.log(MODULE_NAME, '从 window.SillyTavern 获取失败:', e);
  }

  // 方法2：尝试遍历 window 的所有属性，寻找包含 world_names 的对象
  try {
    const anyWin = window as any;
    for (const key of Object.keys(anyWin)) {
      const val = anyWin[key];
      if (val && typeof val === 'object' && val.world_names && Array.isArray(val.world_names)) {
        const msBooks = val.world_names.filter((name: string) => isRuleSimulatorWorldbook(name));
        console.log(MODULE_NAME, `从 window.${key}.world_names 找到:`, val.world_names, '过滤后:', msBooks);
        if (msBooks.length > 0) return msBooks;
      }
    }
  } catch (e) {
    console.log(MODULE_NAME, '从 window 搜索 world_names 失败:', e);
  }

  // 方法3：精确探测已知的几个世界书（用户截图中的）
  const exactNames = [
    '规则模拟器V0.63 - 2026-03-31@10h46m17s752ms',
    '规则模拟器V0.7 - 2026-04-03@16h39m53s943ms',
  ];

  for (const name of exactNames) {
    try {
      const entries = await getWorldbook(name);
      if (entries && Array.isArray(entries) && entries.length > 0) {
        console.log(MODULE_NAME, '精确探测到世界书:', name);
        foundBooks.push(name);
      }
    } catch {
      // 不存在
    }
  }

  return foundBooks;
}

/**
 * 收集所有规则模拟器世界书名称
 * 结合：1. 脚本变量中记录的列表  2. 动态探测
 */
async function collectAllMsWorldbooksAsync(): Promise<string[]> {
  const knownBooks = new Set<string>();

  // 1. 首先获取脚本变量中记录的列表
  const recordedList = getCreatedWorldbookList();
  recordedList.forEach(name => {
    if (isRuleSimulatorWorldbook(name)) {
      knownBooks.add(name);
    }
  });
  console.log(MODULE_NAME, '脚本记录的世界书:', recordedList);

  // 2. 尝试动态发现更多世界书
  const discovered = await discoverAllMsWorldbooks();
  discovered.forEach(name => knownBooks.add(name));

  return Array.from(knownBooks);
}

// 保持旧函数名用于同步调用（返回已记录的）
function collectAllMsWorldbooks(): string[] {
  const knownBooks = new Set<string>();

  // 1. 首先获取脚本变量中记录的列表
  const recordedList = getCreatedWorldbookList();
  recordedList.forEach(name => {
    if (isRuleSimulatorWorldbook(name)) {
      knownBooks.add(name);
    }
  });
  console.log(MODULE_NAME, '脚本记录的世界书:', recordedList);

  // 2. 尝试从全局 window 对象找 world_names（如果有的话）
  try {
    const anyWin = window as any;
    if (anyWin.SillyTavern?.world_names && Array.isArray(anyWin.SillyTavern.world_names)) {
      anyWin.SillyTavern.world_names.forEach((name: string) => {
        if (isRuleSimulatorWorldbook(name)) knownBooks.add(name);
      });
    }
  } catch { /* ignore */ }

  return Array.from(knownBooks);
}

/**
 * 删除所有以 "ms" 结尾的额外世界书
 * 用于清理游戏过程中产生的临时世界书
 * @returns 删除的世界书名称列表
 */
export async function deleteAllMsWorldbooks(): Promise<string[]> {
  const deletedBooks: string[] = [];

  try {
    // 1. 异步收集所有已知的 ms 世界书
    let booksToDelete = await collectAllMsWorldbooksAsync();
    console.log(MODULE_NAME, '异步收集的世界书:', booksToDelete);

    // 2. 如果收集不到，尝试精确探测已知的几个
    if (booksToDelete.length === 0) {
      console.log(MODULE_NAME, '异步收集为空，尝试精确探测...');

      const exactNames = [
        '规则模拟器V0.63 - 2026-03-31@10h46m17s752ms',
        '规则模拟器V0.7 - 2026-04-03@16h39m53s943ms',
        '规则模拟器V0.7 - 2026-04-04@10h00m00s000ms',
      ];

      for (const name of exactNames) {
        try {
          const entries = await getWorldbook(name);
          if (entries && Array.isArray(entries) && entries.length > 0) {
            console.log(MODULE_NAME, '精确探测到世界书:', name);
            booksToDelete.push(name);
            addToCreatedWorldbookList(name);
          }
        } catch {
          // 不存在
        }
      }
    }

    // 3. 再次检查：确保所有要删除的都符合规则模拟器格式
    booksToDelete = booksToDelete.filter(name => isRuleSimulatorWorldbook(name));

    console.log(MODULE_NAME, '准备删除的世界书:', booksToDelete);

    if (booksToDelete.length === 0) {
      console.log(MODULE_NAME, '没有找到需要删除的世界书');
      toastr.warning('未找到需要清理的规则模拟器世界书（必须以 "ms" 结尾）');
      return deletedBooks;
    }

    toastr.info(`找到 ${booksToDelete.length} 个需要删除的世界书，开始清理...`);

    // 4. 获取当前全局世界书列表
    const currentGlobals = collectAllMsWorldbooks();

    // 5. 从全局绑定中移除这些世界书
    const preservedGlobals = currentGlobals.filter(name =>
      !booksToDelete.includes(name)
    );
    if (currentGlobals.length !== preservedGlobals.length) {
      await rebindGlobalWorldbooks(preservedGlobals);
      console.log(MODULE_NAME, '已从全局绑定中移除世界书');
    }

    // 6. 删除每个世界书
    for (const bookName of booksToDelete) {
      try {
        console.log(MODULE_NAME, '尝试删除世界书:', bookName);
        const success = await deleteWorldbook(bookName);
        if (success) {
          deletedBooks.push(bookName);
          console.log(MODULE_NAME, '已删除世界书:', bookName);
          removeFromCreatedWorldbookList(bookName);
        } else {
          console.warn(MODULE_NAME, '删除世界书返回失败:', bookName);
        }
      } catch (e) {
        console.warn(MODULE_NAME, '删除世界书异常:', bookName, e);
      }
    }

    // 7. 显示结果
    if (deletedBooks.length > 0) {
      toastr.success(`已清理 ${deletedBooks.length} 个世界书`);
    } else {
      toastr.warning('未能删除任何世界书，可能世界书不存在或权限不足');
    }

    console.log(MODULE_NAME, `已删除 ${deletedBooks.length} 个世界书，共尝试 ${booksToDelete.length} 个`);
    return deletedBooks;

  } catch (error) {
    console.error(MODULE_NAME, '删除 ms 世界书失败:', error);
    toastr.error('清理世界书失败: ' + (error instanceof Error ? error.message : String(error)));
    return deletedBooks;
  }
}
