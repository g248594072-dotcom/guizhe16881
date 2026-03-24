/**
 * 游戏初始化工具
 * 负责初始化游戏变量、创建开局楼层、管理世界书条目
 */

import type { OpeningFormData, GameData, MvuData } from '../types';

// 防止重复创建的标志
let isCreatingOpening = false;

/**
 * 1. 初始化游戏变量（写入0层）
 * 注意：使用 updateVariablesWith 确保原子性更新，避免覆盖其他数据
 */
export async function initializeGameVariables(formData: OpeningFormData): Promise<boolean> {
  try {
    // 获取0层变量表（如果不存在则创建）
    let variables: any;
    try {
      variables = getVariables({ type: 'message', message_id: 0 });
    } catch (err) {
      console.warn('⚠️ 0层消息不存在，将在更新时创建', err);
      variables = { stat_data: {} };
    }

    // 使用 updateVariablesWith 更新0层变量
    await updateVariablesWith(
      vars => {
        // 确保基础结构存在
        if (!vars) vars = {};
        if (!vars.stat_data) vars.stat_data = {};

        // 初始化游戏状态
        if (!vars.stat_data.gameStatus) {
          vars.stat_data.gameStatus = {
            phase: 'opening',
            turn: 0,
            lastUpdated: new Date().toISOString(),
          };
        }

        // 初始化玩家信息
        vars.stat_data.player = {
          name: formData.playerName || '玩家',
          settings: {
            difficulty: formData.gameDifficulty,
            enableWorldRules: formData.enableWorldRules,
            enableRegionalRules: formData.enableRegionalRules,
            enablePersonalRules: formData.enablePersonalRules,
          },
        };

        // 规则与角色仅使用中文「世界规则」「角色档案」等结构，不在此写入英文数组，避免与 MVU / 第二 API 混淆

        // 初始化元数据
        vars.stat_data.meta = {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
        };

        // 保存开局配置
        vars.stat_data.openingConfig = formData;

        console.log('✅ [gameInitializer] 0层变量初始化完成');
        return vars;
      },
      { type: 'message', message_id: 0 },
    );

    console.log('✅ [gameInitializer] 成功初始化0层游戏变量');
    return true;
  } catch (error) {
    console.error('❌ [gameInitializer] 初始化0层游戏变量失败:', error);
    return false;
  }
}

/**
 * 根据表单数据构建开局提示词（供 createOpeningStoryMessage 与「跳过创建」分支共用）
 */
function buildOpeningPromptContent(formData: OpeningFormData): string {
  const sceneDesc = formData.sceneDescription || '神秘的未知场所';
  const openingDetail = String(formData.openingSceneDetail ?? '').trim();

  const rules = formData.selectedRules ?? [];
  const presetRules = rules.filter((r: { isCustom?: boolean }) => !r.isCustom);
  const customRules = rules.filter((r: { isCustom?: boolean }) => r.isCustom);
  const characters = formData.characters ?? [];

  const ruleLinesForNarrative: string[] = [];
  if (presetRules.length > 0) {
    ruleLinesForNarrative.push(
      ...presetRules.map((r: { name: string; desc: string }) => `【预设世界规则】${r.name}：${r.desc}`),
    );
  }
  if (customRules.length > 0) {
    ruleLinesForNarrative.push(
      ...customRules.map((r: { name: string; desc: string }) => `【自定义世界规则】${r.name}：${r.desc}`),
    );
  }

  const charLinesForNarrative = characters.map((c: { name: string; gender: string; desc: string }) => {
    const gender = c.gender === 'female' ? '女' : c.gender === 'male' ? '男' : '其他';
    return `【角色】${c.name}（${gender}）：${c.desc}`;
  });

  // 编号清单：明确要求 <maintext> 逐条体现（便于变量与第二 API 对齐）
  const checklist: string[] = [];
  let n = 1;
  checklist.push(`${n}. 开局地点与整体氛围必须与下列场景设定一致：${sceneDesc}`);
  n += 1;
  if (openingDetail) {
    checklist.push(`${n}. 开场时刻、空间与情节须体现以下补充（不可省略）：${openingDetail}`);
    n += 1;
  }
  for (const r of [...presetRules, ...customRules]) {
    checklist.push(
      `${n}. 世界规则「${r.name}」：正文中须点名或明确暗示其效果，并与下列描述一致——${String(r.desc).replace(/\s+/g, ' ').trim()}`,
    );
    n += 1;
  }
  for (const c of characters) {
    const gender = c.gender === 'female' ? '女' : c.gender === 'male' ? '男' : '其他';
    checklist.push(
      `${n}. 角色「${c.name}」（${gender}）：正文中须有具体出场或互动描写，并与下列设定一致——${String(c.desc).replace(/\s+/g, ' ').trim()}`,
    );
    n += 1;
  }

  const enableBits: string[] = [];
  if (formData.enableWorldRules) enableBits.push('世界级规则已启用');
  if (formData.enableRegionalRules) enableBits.push('区域规则已启用');
  if (formData.enablePersonalRules) enableBits.push('个人规则已启用');
  const enableLine = enableBits.length > 0 ? enableBits.join('；') : '规则开关按表单默认';

  const narrativeBlock = [
    `【规则开关】${enableLine}`,
    '',
    '—— 以下为须在开场剧情中落实的设定（请在下文清单中逐条写进 <maintext>）——',
    ...ruleLinesForNarrative,
    ...charLinesForNarrative,
  ].join('\n');

  const checklistBlock = checklist.join('\n');

  const jsonPatchLines: string[] = [];
  for (const r of rules) {
    jsonPatchLines.push(
      `  { "op": "replace", "path": "/世界规则/${r.name}", "value": { "效果描述": "${r.desc}", "状态": "生效中", "标记": "世界级" } }`,
    );
  }
  characters.forEach((c: { name: string; desc: string }, i: number) => {
    jsonPatchLines.push(
      `  { "op": "replace", "path": "/角色档案/CHR-${String(i + 1).padStart(3, '0')}", "value": { "姓名": "${c.name}", "状态": "出场中", "描写": "${c.desc}", "当前内心想法": "", "性格": [], "性癖": [], "敏感部位": [], "隐藏性癖": "", "身体信息": { "年龄": 18, "身高": 165, "体重": 50, "三围": "B86 W58 H88", "体质特征": "普通" }, "数值": { "好感度": 30, "发情值": 20, "性癖开发值": 10 }, "当前综合生理描述": "" } }`,
    );
  });
  const jsonPatchInner = jsonPatchLines.join(',\n');

  return `请根据以下开局配置生成**第一回合 AI 回复**（开场白 + 选项 + 总结 + 变量补丁），使正文与变量初始化一致。

## 一、配置摘要
${narrativeBlock}

## 二、<maintext> 必须逐条覆盖的清单（共 ${checklist.length} 条，缺一不可）
${checklistBlock}

## 三、输出格式（顺序固定；所有标签必须成对闭合，禁止只写开标签）
1. 先输出 <maintext>…</maintext>：写成完整叙事段落，自然融入上述清单中的场景、规则名/效果、角色形象与互动，以便后续变量更新能对应正文。
2. 再输出 <option>…</option>：内含多行，以「A.」「B.」「C.」开头；**必须**以 </option> 闭合。
3. 再输出 <sum>…</sum>：一句话概括开局；**必须**以 </sum> 闭合。
4. 最后输出 <UpdateVariable>…</UpdateVariable>：须符合下方「## 四、变量补丁约束」；可参考示例 JSON Patch 结构，按实际剧情微调路径与字段值，但须完整初始化本局已选规则与角色档案（中文字段）。

## 四、变量补丁（JSON Patch）约束（必须遵守，否则前端人物面板无法显示）
- **人物与数值（唯一主路径）**：所有需在界面展示的角色信息，**只能**通过 **/角色档案/CHR-xxx**（xxx 与开局角色顺序一致，如 CHR-001）下的对象更新，包括「姓名」「状态」「描写」「身体信息」「数值」（内含 **好感度、发情值、性癖开发值**）、「当前内心想法」「当前综合生理描述」等。**禁止**另写 **/characters**、**characters.某某** 等英文平行结构作为主数据源。
- **角色档案 value 必须与下方示例同构（本条为硬约束）**：对 **/角色档案/CHR-xxx** 使用 **replace** 时，**value 的键名与嵌套层级须与示例 JSON 完全一致**，仅允许修改各字段的**字符串内容或数字**。顶层**只能**包含：姓名、状态、描写、当前内心想法、性格、性癖、敏感部位、隐藏性癖、身体信息、数值、当前综合生理描述。**禁止**新增「属性」等平行块；**禁止**把「当前处境 / 当前综合生理描述 / 当前内心想法」塞进名为「状态」的子对象；**禁止**用「性癖开发度」代替「**性癖开发值**」。角色的「状态」字段只能是 **「出场中」或「暂时退场」** 这类简短值，**禁止**把长段剧情写入「状态」。「身体信息」下**只能**含：年龄、身高、体重、三围、体质特征。
- **世界规则（唯一主路径）**：世界规则 **只能** 使用 **/世界规则/<规则名>**；value 内保持 **效果描述、状态、标记** 等字段，与上文示例一致。**禁止**用 **/world_rules** 等英文根路径替代或重复存储同一规则。对已有规则路径请使用 **replace**；「标记」须为**单个字符串**（如「世界级」），**禁止**写成 JSON 数组。「状态」请用 **「生效中」** 与示例一致。**禁止**对已有 path 使用 **add** 导致 Patch 失败。
- **正文与变量一致**：若剧情中人物生理/心理状态、发情程度、好感等已具体描写，**必须**在同一角色的「数值」与「当前综合生理描述」（必要时含「当前内心想法」）中反映，**禁止**仅在正文描写而变量仍为空白或仍为初始示例未改。
- **格式**：<JSONPatch> 内必须是**合法 JSON 数组**；每条 op 的 path 须使用上述中文路径前缀；勿在数组外夹杂说明性假 JSON。

<maintext>
[开场剧情，须覆盖清单全部条目]
</maintext>

<option>
A. [选项A]
B. [选项B]
C. [选项C]
</option>

<sum>[一句话总结]</sum>

<UpdateVariable>
<Analysis>
- 初始化世界规则和角色档案
</Analysis>
<JSONPatch>
[
${jsonPatchInner}
]
</JSONPatch>
</UpdateVariable>`;
}

/**
 * 2. 创建开局介绍楼层（1层）
 * 关键要点：
 * - 防止重复创建（检查1层消息是否已存在）
 * - 获取0层的data并携带到1层
 * - 根据配置生成不同风格的开局文本
 * - 创建完成后更新编年史
 * - 即使跳过创建，也返回 promptContent，供 App 调用 generate 时使用
 */
export async function createOpeningStoryMessage(formData: OpeningFormData): Promise<{success: boolean; promptContent?: string}> {
  // 防止重复创建
  if (isCreatingOpening) {
    console.log('⚠️ [gameInitializer] 正在创建开局楼层，跳过重复调用');
    return { success: false };
  }

  try {
    // 无论是否创建消息，都先构建提示词，保证调用 generate 时一定有内容
    const promptContent = buildOpeningPromptContent(formData);

    // 检查是否已经存在1层消息，避免重复创建
    try {
      const existingMessages = getChatMessages(1);
      if (existingMessages && existingMessages.length > 0) {
        console.log('⚠️ [gameInitializer] 1层消息已存在，跳过创建（仍返回 promptContent 供 generate 使用）');
        setTimeout(async () => {
          try {
            const { checkAndUpdateChronicle } = await import('./chronicleUpdater');
            await new Promise(resolve => setTimeout(resolve, 500));
            await checkAndUpdateChronicle();
          } catch (error) {
            console.error('❌ [gameInitializer] 更新编年史失败:', error);
          }
        }, 500);
        return { success: true, promptContent };
      }
    } catch (err) {
      // 1层不存在，继续创建
    }

    // 设置创建标志
    isCreatingOpening = true;

    // 获取0层的data（携带变量）
    let layer0Data: MvuData = { stat_data: {}, display_data: {}, delta_data: {} };
    try {
      const mvuData = Mvu.getMvuData({ type: 'message', message_id: 0 });
      if (mvuData && mvuData.stat_data) {
        layer0Data = mvuData;
      } else {
        console.warn('⚠️ [gameInitializer] 0层MVU数据的 stat_data 不存在，使用空对象');
      }
    } catch (err) {
      console.warn('⚠️ [gameInitializer] 获取0层MVU数据失败，尝试从getVariables读取', err);
      try {
        const vars = getVariables({ type: 'message', message_id: 0 });
        if (vars && vars.stat_data) {
          layer0Data = {
            stat_data: vars.stat_data || {},
            display_data: vars.display_data || {},
            delta_data: vars.delta_data || {},
          };
        } else {
          console.warn('⚠️ [gameInitializer] 0层变量的 stat_data 不存在，使用空对象');
        }
      } catch (err2) {
        console.warn('⚠️ [gameInitializer] 获取0层变量失败，使用空对象', err2);
      }
    }

    // 创建user消息请求AI生成初始内容
    // 发送完整 MVU 格式，统一数据格式
    await createChatMessages(
      [
        {
          role: 'user',
          message: promptContent,
          data: layer0Data,  // 发送完整 MVU 格式 { stat_data, display_data, delta_data }
        },
      ],
      {
        refresh: 'none',
      },
    );

    console.log('✅ [gameInitializer] 已创建开局请求消息，等待AI生成初始数据...');
    console.log('📝 [gameInitializer] 提示词内容预览:', promptContent.substring(0, 200) + '...');

    // 重置创建标志
    isCreatingOpening = false;
    return { success: true, promptContent };
  } catch (error) {
    console.error('❌ [gameInitializer] 创建开局介绍楼层失败:', error);
    isCreatingOpening = false;
    return { success: false };
  }
}

/**
 * 管理世界书条目
 * 根据玩家选择的配置启用/禁用对应的世界书条目
 */
async function manageWorldbookEntries(formData: OpeningFormData): Promise<void> {
  try {
    const worldbookName = '规则系统'; // 根据实际情况修改
    let entries: any[];

    try {
      entries = await getWorldbook(worldbookName);
    } catch (err) {
      console.warn('⚠️ [gameInitializer] 世界书不存在或为空:', err);
      return;
    }

    if (!entries || entries.length === 0) {
      console.warn('⚠️ [gameInitializer] 世界书条目为空');
      return;
    }

    // 根据配置更新条目启用状态
    const updatedEntries = entries.map(entry => {
      // 根据启用选项决定是否启用条目
      if (entry.title?.includes('世界规则') && !formData.enableWorldRules) {
        return { ...entry, enable: false };
      }
      if (entry.title?.includes('区域规则') && !formData.enableRegionalRules) {
        return { ...entry, enable: false };
      }
      if (entry.title?.includes('个人规则') && !formData.enablePersonalRules) {
        return { ...entry, enable: false };
      }
      return entry;
    });

    await replaceWorldbook(worldbookName, updatedEntries, { render: 'debounced' });
    console.log('✅ [gameInitializer] 世界书条目更新完成');
  } catch (error) {
    console.error('❌ [gameInitializer] 管理世界书条目失败:', error);
    throw error;
  }
}

/**
 * 重置游戏（用于重新开始）
 * 清除0层变量并重新开始
 */
export async function resetGame(): Promise<boolean> {
  try {
    // 重置0层变量
    await replaceVariables(
      {
        stat_data: {},
        display_data: {},
        delta_data: {},
      },
      { type: 'message', message_id: 0 },
    );

    console.log('✅ [gameInitializer] 游戏已重置');
    return true;
  } catch (error) {
    console.error('❌ [gameInitializer] 重置游戏失败:', error);
    return false;
  }
}

/**
 * 检查是否是新游戏（0层且无1层消息）
 */
export function isNewGame(): boolean {
  try {
    const lastMessageId = getLastMessageId();
    if (lastMessageId > 0) {
      return false;
    }

    // 检查0层是否有数据
    try {
      const vars = getVariables({ type: 'message', message_id: 0 });
      if (vars && vars.stat_data && Object.keys(vars.stat_data).length > 0) {
        return false;
      }
    } catch (err) {
      // 0层变量不存在，认为是新游戏
    }

    return true;
  } catch (error) {
    console.error('❌ [gameInitializer] 检查游戏状态失败:', error);
    return true;
  }
}
