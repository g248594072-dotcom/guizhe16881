/**
 * 游戏初始化工具
 * 负责初始化游戏变量、创建开局楼层、管理世界书条目
 */

import type { OpeningFormData, SceneEra } from '../types';

/**
 * 根据场景时代计算初始游戏时间
 * - modern: 现代，使用当前年份（2026年左右）
 * - medieval: 中世纪，约1000-1400年
 * - fantasy: 异世界，使用奇幻风格的日期（如幻想历、精灵历等）
 * - future: 未来，约2077年及以后
 * - ancient: 古代，约公元前或公元初期
 */
function getInitialGameTimeByEra(era?: SceneEra) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  switch (era) {
    case 'modern':
      // 现代：使用当前年份，月份日期可以随机一些变化
      return {
        年: currentYear,
        月: currentMonth,
        日: currentDay,
        时: 12,
        分: 0,
      };

    case 'medieval':
      // 中世纪：约1000-1400年，随机选择
      return {
        年: 1000 + Math.floor(Math.random() * 400),
        月: Math.floor(Math.random() * 12) + 1,
        日: Math.floor(Math.random() * 28) + 1,
        时: 12,
        分: 0,
      };

    case 'fantasy':
      // 异世界：使用奇幻历法，如"幻想历"或自定义年份
      // 可以是类似"星历"、"魔法历"的年份格式
      return {
        年: 784 + Math.floor(Math.random() * 200), // 幻想历784年，一个典型的奇幻年份
        月: Math.floor(Math.random() * 12) + 1,
        日: Math.floor(Math.random() * 28) + 1,
        时: 12,
        分: 0,
      };

    case 'future':
      // 未来：2077年及以后
      return {
        年: 2077 + Math.floor(Math.random() * 50),
        月: Math.floor(Math.random() * 12) + 1,
        日: Math.floor(Math.random() * 28) + 1,
        时: 12,
        分: 0,
      };

    case 'ancient':
      // 古代：约公元前或公元初期（使用负数或较小数字表示）
      // 如大唐时期约为公元600-900年
      return {
        年: 600 + Math.floor(Math.random() * 300),
        月: Math.floor(Math.random() * 12) + 1,
        日: Math.floor(Math.random() * 28) + 1,
        时: 12,
        分: 0,
      };

    default:
      // 默认使用现代时间
      return {
        年: currentYear,
        月: currentMonth,
        日: currentDay,
        时: 12,
        分: 0,
      };
  }
}

/**
 * 获取时代的中文描述，用于在提示词中说明时间背景
 */
function getEraDescription(era?: SceneEra): string {
  switch (era) {
    case 'modern':
      return '现代（公元21世纪）';
    case 'medieval':
      return '中世纪（约公元10-14世纪）';
    case 'fantasy':
      return '异世界（幻想历）';
    case 'future':
      return '未来（2077年后）';
    case 'ancient':
      return '古代（约公元6-9世纪）';
    default:
      return '现代';
  }
}

/** 开局 <maintext> 正文写作要求（与清单、变量约束配合使用） */
const OPENING_MAINTEXT_REQUEST = `<request>
你的任务是继续写"正在发生的剧情"，而不是介绍设定。

正文必须遵守以下原则：

1. 只写当前场景中正在发生的事
- 只描写人物、动作、对白、环境、气氛、可观察到的变化
- 优先写具体细节，不写抽象总结

2. 禁止规则说明腔
- 禁止在正文中解释世界规则、区域规则、个人规则的定义、机制、条件、作用范围与结论
- 禁止出现"该规则规定……""她知道规则……""只要……就会……""她无法违抗，因为……"这类说明句
- 禁止把后台资料、规则名、规则描述直接翻译成旁白

3. 规则只通过自然表现呈现
- 规则效果只能通过人物下意识动作、习惯反应、场景秩序、他人默认接受来体现
- 不要写"规则生效了"，要写"在这个场景里，人就是这么做的"

4. 人物先于规则
- 先写"这个人此刻怎么反应"，再让读者从反应里感受到规则存在
- 角色不能成为规则的复读器或说明书

5. 禁止分析与讲解
- 不写研究式、解释式、总结式语言
- 不写作者说明，不写设定介绍，不写机制剖析
- 不使用"世界观中""按照规则""由于某设定"这类跳出场景的话

6. 语言要求
- 语言自然、顺滑、贴近现场
- 少用大词、空话、判断句
- 尽量使用白描：让读者看见，而不是听旁白解释

7. 当本回合存在新增 / 修改 / 删除规则时
- <maintext> 必须先呈现该规则在当前场景中的即时显化，再继续后续叙事
- 即时显化只写当前人物、环境、物件、流程中立刻可见的变化
- 禁止跳过显化阶段，直接把新规则后的世界写成「仿佛一直如此」
- 禁止解释规则机制，禁止出现「因为规则……所以……」这类说明句
</request>`;

/**
 * 1. 初始化游戏变量（写入0层）
 * 注意：使用 updateVariablesWith 确保原子性更新，避免覆盖其他数据
 */
export async function initializeGameVariables(formData: OpeningFormData): Promise<boolean> {
  try {
    // 检查0层变量是否存在（updateVariablesWith 会自动创建）
    try {
      getVariables({ type: 'message', message_id: 0 });
    } catch {
      // 0层消息不存在，updateVariablesWith 会在更新时创建
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

        // 根据场景时代初始化游戏时间
        const initialGameTime = getInitialGameTimeByEra(formData.sceneEra);
        vars.stat_data.游戏时间 = initialGameTime;
        console.log(`✅ [gameInitializer] 游戏时间已初始化为 ${initialGameTime.年}年${initialGameTime.月}月${initialGameTime.日}日（时代：${formData.sceneEra || '默认'})`);

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

  // 获取场景时代的时间背景描述
  const eraDesc = getEraDescription(formData.sceneEra);
  const initialGameTime = getInitialGameTimeByEra(formData.sceneEra);
  const timeDescription = `${initialGameTime.年}年${initialGameTime.月}月${initialGameTime.日}日`;

  const rules = (formData.selectedRules ?? []) as Array<{ name: string; desc: string; isCustom?: boolean }>;
  const presetRules = rules.filter(r => !r.isCustom);
  const customRules = rules.filter(r => r.isCustom);
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

  // 添加时代/时间背景要求
  if (formData.sceneEra) {
    checklist.push(`${n}. 故事必须发生在${eraDesc}，时间设定为${timeDescription}，场景中的元素、人物着装、技术/魔法水平、语言风格必须与该时代背景一致`);
    n += 1;
  }

  if (openingDetail) {
    checklist.push(`${n}. 开场时刻、空间与情节须体现以下补充（不可省略）：${openingDetail}`);
    n += 1;
  }
  for (const r of [...presetRules, ...customRules]) {
    checklist.push(
      `${n}. 世界规则「${r.name}」（名称仅供变量对齐）：正文须呈现与下列效果相容的现场，只通过人物言行与场景自然体现，禁止规则说明腔、禁止在正文复述规则名或条文；——${String(r.desc).replace(/\s+/g, ' ').trim()}`,
    );
    n += 1;
  }
  for (const c of characters) {
    const gender = c.gender === 'female' ? '女' : c.gender === 'male' ? '男' : '其他';
    checklist.push(
      `${n}. 角色「${c.name}」（${gender}）：正文须有具体出场或互动，用现场细节体现下列特质，禁止复述设定句、禁止说明书式介绍；——${String(c.desc).replace(/\s+/g, ' ').trim()}`,
    );
    n += 1;
  }

  const enableBits: string[] = [];
  if (formData.enableWorldRules) enableBits.push('世界级规则已启用');
  if (formData.enableRegionalRules) enableBits.push('区域规则已启用');
  if (formData.enablePersonalRules) enableBits.push('个人规则已启用');
  const enableLine = enableBits.length > 0 ? enableBits.join('；') : '规则开关按表单默认';

  // 构建包含时代信息的时间描述
  const timeInfoLines = formData.sceneEra
    ? [`【时代背景】${eraDesc}`, `【故事时间】${timeDescription}`]
    : [];

  const narrativeBlock = [
    `【规则开关】${enableLine}`,
    '',
    ...timeInfoLines,
    ...(timeInfoLines.length > 0 ? [''] : []),
    '—— 以下为配置摘要（清单见下节；<maintext> 须用现场叙事落实，写法遵守「二（续）」）——',
    ...ruleLinesForNarrative,
    ...charLinesForNarrative,
  ].join('\n');

  const checklistBlock = checklist.join('\n');

  const jsonPatchLines: string[] = [];
  for (const r of rules) {
    const ruleValue = {
      名称: r.name,
      效果描述: String(r.desc).replace(/\s+/g, ' ').trim(),
      状态: '生效中',
      细分规则: {} as Record<string, unknown>,
      适用对象: '全局',
      标记: '世界级',
    };
    jsonPatchLines.push(
      `  { "op": "replace", "path": "/世界规则/${r.name}", "value": ${JSON.stringify(ruleValue)} }`,
    );
  }
  characters.forEach((c: { name: string; desc: string }, i: number) => {
    const chrValue = {
      姓名: c.name,
      状态: '出场中',
      描写: String(c.desc).replace(/\s+/g, ' ').trim(),
      当前内心想法: '',
      性格: {} as Record<string, string>,
      性癖: {} as Record<string, string>,
      敏感部位: {} as Record<string, string>,
      隐藏性癖: '',
      身体信息: {
        年龄: 18,
        身高: 165,
        体重: 50,
        三围: 'B86 W58 H88',
        体质特征: '普通',
      },
      数值: { 好感度: 30, 发情值: 20, 性癖开发值: 10 },
      当前综合生理描述: '',
    };
    jsonPatchLines.push(
      `  { "op": "replace", "path": "/角色档案/CHR-${String(i + 1).padStart(3, '0')}", "value": ${JSON.stringify(chrValue)} }`,
    );
  });
  const jsonPatchInner = jsonPatchLines.join(',\n');

  return `请根据以下开局配置生成**第一回合 AI 回复**（开场白 + 选项 + 总结 + 变量补丁），使正文与变量初始化一致。

## 一、配置摘要
${narrativeBlock}

## 二、<maintext> 必须逐条覆盖的清单（共 ${checklist.length} 条，缺一不可）
${checklistBlock}

## 二（续）、正文写作要求（<maintext> 须严格遵守）
${OPENING_MAINTEXT_REQUEST}

## 三、输出格式（顺序固定；所有标签必须成对闭合，禁止只写开标签）
1. 先输出 <maintext>…</maintext>：写成完整叙事段落，**同时**满足上文「二」的清单与「二（续）」；以便后续变量更新能对应正文。
2. 再输出 <option>…</option>：内含多行，以「A.」「B.」「C.」开头；**必须**以 </option> 闭合。
3. 再输出 <sum>…</sum>：一句话概括开局；**必须**以 </sum> 闭合。
4. 最后输出 <UpdateVariable>…</UpdateVariable>：须符合下方「## 四、变量补丁约束」。**本局开局提示里已给出示例 Patch，若 user 楼层已写入同名路径，你方必须用 replace 覆盖，勿用 insert 顶同名路径。** 按实际剧情微调数值与描写。

## 四、变量补丁（须与 MVU 解析一致）
- **总原则**：\`<JSONPatch>\` 内为合法 JSON 数组。**本界面与 MVU 解析要求：对「世界规则 / 角色档案」的整条更新以 replace 为主**；**delta**/**insert**/**remove**/**move** 仅在不与下文字段硬约束冲突时使用（以 MVU 实际支持为准）。若与世界书/上下文注入冲突，以已注入说明为准。
- **路径（中文根）**：世界规则 **/世界规则/<规则名>**；角色 **/角色档案/CHR-xxx**（顺序与开局一致）。**禁止**用 **/characters**、**world_rules** 等英文平行根。
- **开局特判（重要）**：同一聊天里 **user 消息可能已含同名路径的初始化**。对 **/世界规则/…**、**/角色档案/CHR-001** 等 **已存在** 的路径：**一律使用 \`"op": "replace"\` 写入完整 value**，**禁止**对已有对象路径使用 **insert**（易导致 Patch 失败且不更新角色）。
- **世界规则 value**：须含 **名称、效果描述、状态、细分规则、适用对象、标记**（**细分规则** 可为 \`{}\`）；**状态** 常用「生效中」；**标记** 为单个字符串。
- **角色档案 value（类型硬约束，违反则变量无法写入）**：顶层键须齐全：**姓名、状态、描写、当前内心想法、性格、性癖、敏感部位、隐藏性癖、身体信息、数值、当前综合生理描述**。
  - **性格**：**必须为 JSON 对象** \`{ "名称": "描述" }\`（如 \`{"傲娇": "口是心非"}\`），无条目则 \`{}\`；**兼容**旧版字符串数组。
  - **性癖**：\`{ "名称": { "等级": 数字, "细节描述": "…", "自我合理化": "…" } }\`；**兼容**旧版 \`{ "名称": "描述字符串" }\`。
  - **敏感部位**：\`{ "名称": { "敏感等级": 数字, "生理反应": "…", "开发细节": "…" } }\`；**兼容**旧版 \`{ "名称": "描述字符串" }\`。
  - **隐藏性癖**：**必须是字符串**（无则写 \`""\`）。**禁止**写成 \`{}\` 或对象。
  - **身体信息**：年龄/身高/体重为数字；**三围**为**字符串**（如 \`"B86 W58 H88"\`）或对象 \`{"B":86,"W":58,"H":88}\`；**体质特征**为字符串。
  - **数值**：**好感度、发情值、性癖开发值** 为数字；**禁止**用「性癖开发度」键名。
  - **状态**：仅 **「出场中」** 或 **「暂时退场」**；勿把长剧情写入「状态」。
- **正文与变量一致**：正文若已写生理/情绪/好感等，须在「数值」「当前综合生理描述」（必要时「当前内心想法」）中反映。
- **格式**：勿在 \`<JSONPatch>\` 数组外夹带假 JSON；\`<Analysis>\` 语言与篇幅若角色卡另有规定，从其规定。

## 五、玩家行动后的强制变量更新要求（**重要**）
玩家已发送第一条行动消息。AI 在回复本次玩家输入时，**必须在回复末尾输出完整的变量更新块**。

**角色档案完整性检查清单**（每个角色必须满足，禁止留空）：
- **姓名**：已确定的角色名
- **状态**：「出场中」或「暂时退场」
- **描写**：角色的外貌、衣着、当前姿态等描写
- **当前内心想法**：角色当前的心理活动
- **性格**：至少一条性格特征，如 \`{"害羞": "容易脸红，不敢直视他人"}\`
- **性癖**：至少一条；推荐嵌套如 \`{"被注视": {"等级":1,"细节描述":"…","自我合理化":"…"}}\`，或旧版 \`{"被注视": "被人注视时会感到紧张"}\`
- **敏感部位**：至少一处；推荐嵌套如 \`{"耳朵": {"敏感等级":2,"生理反应":"…","开发细节":"…"}}\`，或旧版 \`{"耳朵": "被轻触时会颤抖"}\`
- **隐藏性癖**：字符串，可为空字符串但必须是字符串类型
- **身体信息**：年龄、身高、体重、三围、体质特征
- **数值**：好感度、发情值、性癖开发值（均须为数字）
- **当前综合生理描述**：角色当前的身体状态描述

**强制要求**：
1. 每个角色上述字段**必须全部存在**，不能为空对象或缺失
2. 性格、性癖、敏感部位**每个至少包含一条**（不得为空对象 \`{}\`）
3. 回复末尾必须包含完整的 \`<UpdateVariable>\` 块，内含 \`<Analysis>\` 和 \`<JSONPatch>\`
4. 如有任何字段不满足，本次回复视为不完整，需补充修正

<maintext>
[正在发生的现场剧情，须覆盖清单全部条目；写法遵守「二（续）」]
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
 * 2. 准备开局提示词（不写入聊天楼层）
 * 实际 user 楼层由 App.vue 在调用 generate 前统一创建并做 MVU 解析，避免与 gameInitializer 重复写入导致多条玩家楼层。
 * 若检测到已有第 1 层消息，仍返回 promptContent，并异步尝试更新编年史。
 */
export async function createOpeningStoryMessage(formData: OpeningFormData): Promise<{success: boolean; promptContent?: string}> {
  try {
    const promptContent = buildOpeningPromptContent(formData);

    try {
      const existingMessages = getChatMessages(1);
      if (existingMessages && existingMessages.length > 0) {
        console.log('⚠️ [gameInitializer] 1层消息已存在，仅返回 promptContent 供 generate 使用');
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
    } catch {
      /* 第 1 层不存在等，忽略 */
    }

    console.log('✅ [gameInitializer] 开局提示词已准备');
    console.log('📝 [gameInitializer] 提示词内容预览:', promptContent.substring(0, 200) + '...');
    return { success: true, promptContent };
  } catch (error) {
    console.error('❌ [gameInitializer] 准备开局提示词失败:', error);
    return { success: false };
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
