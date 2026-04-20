/**
 * ZOD Schema 定义（MVU / `registerMvuSchema` 对齐）
 *
 * - 角色卡里通过 `registerMvuSchema(Schema)` 注册的 Zod **应与下方 `核心结构` 同构**，尤其是「区域数据 / 建筑数据 / 活动数据」键名与嵌套形状；战术地图 AI 契约见 `utils/tacticalMapAiGeneratePrompts.ts` 中 `MVU_PATCH_VALUE_SHAPE_CONTRACT_ZH`。
 * - **根对象必须在 `z.object({…}).prefault({})` 之后再接 `.passthrough()`**（即本文件的 `核心结构`）。若不使用 passthrough，MVU 合并到的 `meta`、`player`、`openingConfig`、脚本扩展键等可能在解析时被剥掉，表现为「变量写入了但下游/模型读不到」。
 * - `pnpm exec tsx dump_schema.ts` 可生成供 initvar `# yaml-language-server $schema=` 使用的 JSON Schema。
 */

import {
  normalizeTagMap,
  normalize三围,
  normalizeFetishRecord,
  normalizeSensitivePartRecord,
} from './utils/tagMap';

/** 性格：Record<名, 描述>，兼容旧 string[] */
const 标签映射 = z.preprocess(
  (raw: unknown) => normalizeTagMap(raw),
  z.record(z.string(), z.string()),
).prefault({});

const 性癖条目 = z
  .object({
    等级: z.coerce.number().transform(v => _.clamp(Math.round(v), 0, 10)).prefault(1),
    细节描述: z.string().prefault(''),
    自我合理化: z.string().prefault(''),
  })
  .passthrough()
  .prefault({});

/** 性癖：名 → { 等级, 细节描述, 自我合理化 }；兼容旧版名→纯字符串 */
const 性癖映射 = z.preprocess(
  (raw: unknown) => normalizeFetishRecord(raw),
  z.record(z.string(), 性癖条目),
).prefault({});

const 敏感部位条目 = z
  .object({
    敏感等级: z.coerce.number().transform(v => _.clamp(Math.round(v), 0, 10)).prefault(1),
    生理反应: z.string().prefault(''),
    开发细节: z.string().prefault(''),
  })
  .passthrough()
  .prefault({});

/** 与旧键「敏感部位」同形；新存档统一用键名「敏感点开发」 */
const 敏感点开发映射 = z.preprocess(
  (raw: unknown) => normalizeSensitivePartRecord(raw),
  z.record(z.string(), 敏感部位条目),
).prefault({});

const 服装穿戴单项 = z
  .object({
    名称: z.string().prefault(''),
    状态: z.string().prefault('正常'),
    描述: z.string().prefault(''),
  })
  .passthrough()
  .prefault({});

const 服装状态结构 = z
  .object({
    上装: 服装穿戴单项,
    下装: 服装穿戴单项,
    内衣: 服装穿戴单项,
    腿部: 服装穿戴单项,
    足部: 服装穿戴单项,
    饰品: z
      .record(
        z.string(),
        z
          .object({
            部位: z.string().prefault('未知'),
            状态: z.string().prefault('正常'),
            描述: z.string().prefault(''),
          })
          .passthrough()
          .prefault({}),
      )
      .prefault({}),
  })
  .passthrough()
  .prefault({});

const 身体部位物理单项 = z
  .object({
    外观描述: z.string().prefault('未详细观察'),
    当前状态: z.string().prefault('正常'),
  })
  .passthrough()
  .prefault({});

const 身体部位物理映射 = z.record(z.string(), 身体部位物理单项).prefault({});

/** 与「区域数据 / 建筑数据 / 活动数据」的 id 对齐；旧档缺省经 preprocess 补默认 */
const 当前位置结构 = z
  .object({
    区域ID: z.string().describe('当前所在区域的ID').prefault(''),
    建筑ID: z.string().describe('当前所在建筑的ID').prefault(''),
    活动ID: z.string().describe('当前参与的活动ID，若无则留空').prefault(''),
    当前行为描述: z.string().describe('角色正在做什么的具体动作或状态').prefault('待命'),
  })
  .passthrough()
  .transform(pos => {
    const result = { ...pos } as Record<string, unknown>;
    if (result.活动ID === undefined) result.活动ID = '';
    return result;
  })
  .prefault({});

function normalize规则状态(raw: unknown): '生效中' | '已归档' {
  const s = String(raw ?? '').trim();
  if (s === '激活' || s === '启用' || s === '生效中') return '生效中';
  if (s === '已归档') return '已归档';
  return '生效中';
}

// 规则条目（世界规则、区域规则、个人规则共用；与变量更新规则一致）
const 规则条目基础 = z.object({
  名称: z.string().prefault(''),
  效果描述: z.string().prefault(''),
  状态: z.preprocess(normalize规则状态, z.enum(['生效中', '已归档']).prefault('生效中')),
  细分规则: z.record(
    z.string().describe('细分规则名'),
    z.object({
      描述: z.string().prefault(''),
      状态: z.preprocess(normalize规则状态, z.enum(['生效中', '已归档']).prefault('生效中')),
    }).prefault({}),
  ).prefault({}),
  适用对象: z.string().prefault(''),
  标记: z.string().prefault(''),
});
const 规则条目 = 规则条目基础.passthrough().prefault({});

// 核心数据结构（键顺序与 测试文件/变量细节/结构.txt 一致）
const 核心结构 = z.object({
  世界规则: z.record(z.string().describe('世界规则名'), 规则条目).prefault({}),

  区域规则: z.record(z.string().describe('区域规则名'), 规则条目).prefault({}),

  个人规则: z.record(z.string().describe('个人规则名'), 规则条目).prefault({}),

  /**
   * 地图 / 剧情用：区域语义（不含格子坐标，坐标在浏览器本地地图存档）。
   * **包含建筑**：建筑 ID → 是否归属本区，与 **建筑数据.所属区域ID** 应对齐；地图回写时会按当前格子归属刷新。
   */
  区域数据: z
    .record(
      z.string().describe('区域唯一ID，格式如 REG-001'),
      z
        .object({
          名称: z.string().prefault('未知区域'),
          描述: z.string().prefault(''),
          包含建筑: z
            .record(z.string().describe('建筑ID引用'), z.boolean().describe('是否属于该区域').prefault(true))
            .prefault({}),
        })
        .passthrough()
        .prefault({}),
    )
    .prefault({}),

  /**
   * **当前活动**：活动 ID → 是否在该建筑进行。
   * **当前角色**：标识符 → 在场标记（boolean / 短文字 / 数字，与更新规则一致）。
   */
  建筑数据: z
    .record(
      z.string().describe('建筑唯一ID，格式如 BLD-001'),
      z
        .object({
          名称: z.string().prefault('未知建筑'),
          描述: z.string().prefault(''),
          所属区域ID: z.string().describe('关联的区域ID，必须存在于区域数据中').prefault(''),
          内部房间布局: z
            .record(
              z.string().describe('房间名，如：客厅、卧室、地下室'),
              z
                .object({
                  描述: z.string().describe('关于这个房间的详细描述').prefault(''),
                })
                .prefault({}),
            )
            .prefault({}),
          当前活动: z
            .record(z.string().describe('活动ID引用'), z.boolean().describe('是否在该建筑进行').prefault(true))
            .prefault({}),
          当前角色: z
            .record(
              z.string().describe('角色标识符，可以是CHR-ID或文字描述'),
              z
                .union([z.boolean(), z.string(), z.number()])
                .describe('是否在该建筑内：可为 true/false、短文字或数字')
                .prefault(true),
            )
            .prefault({}),
        })
        .passthrough()
        .transform(data => {
          const result = { ...data };
          if (result.所属区域ID && result.所属区域ID.trim() !== '') {
            /* 区域可能稍后由 Patch 创建，不在此校验存在性 */
          }
          return result;
        })
        .prefault({}),
    )
    .prefault({}),

  活动数据: z
    .record(
      z.string().describe('活动唯一ID，格式如 ACT-001'),
      z
        .object({
          所在建筑ID: z.string().describe('关联的建筑ID，必须存在于建筑数据中').prefault(''),
          活动名称: z.string().prefault('未知活动'),
          活动内容: z.string().prefault(''),
          开始时间: z.string().describe('记录活动开始的具体游戏时间').prefault(''),
          参与者: z.preprocess(
            (raw: unknown) => {
              if (Array.isArray(raw)) {
                const o: Record<string, boolean> = {};
                for (const item of raw) {
                  const k = String(item ?? '').trim();
                  if (k) o[k] = true;
                }
                return o;
              }
              if (typeof raw === 'string') {
                const s = raw.trim();
                if (!s) return {};
                const o: Record<string, boolean> = {};
                for (const k of s.split(/[,，、]/)) {
                  const t = k.trim();
                  if (t) o[t] = true;
                }
                return o;
              }
              return raw;
            },
            z
              .record(
                z.string().describe('角色唯一ID'),
                z.boolean().describe('是否正在参与').prefault(true),
              )
              .prefault({}),
          ),
          状态: z.preprocess((raw: unknown) => {
            const s = String(raw ?? '').trim();
            if (s === '进行中' || s === '已结束' || s === '已取消') return s;
            return '进行中';
          }, z.enum(['进行中', '已结束', '已取消']).describe('与地图活动阶段对应').prefault('进行中')),
        })
        .passthrough()
        .transform(data => {
          const result = { ...data };
          if (result.所在建筑ID && result.所在建筑ID.trim() !== '') {
            /* 建筑可能稍后由 Patch 创建 */
          }
          return result;
        })
        .prefault({}),
    )
    .prefault({}),

  // 游戏内时间系统：完全独立的年/月/日/时/分，与现实时间无关
  // 存储于 MVU 变量中，随剧情推进而更新，不会自动流逝
  // 每月固定31天，主角可通过"世界规则"定义月份天数来覆盖
  游戏时间: z.object({
    /** 公历 | 年号历 | 西幻纪 | 修真历 */
    纪历体系: z.string().prefault('公历'),
    /** 公历下由 transform 固定为「公元」；其它纪历为年号或幻想纪元名 */
    纪年名称: z.string().prefault('公元'),
    /** 公历下与「年」一致（由 transform 写入）；其它纪历为该纪元序数。不设 prefault，避免与锚点「年」混淆时误判 */
    纪年年数: z.coerce.number().optional(),
    /** 实际采用的计时基底（「自定义」界面时为随机六种之一） */
    时间演算基底: z.string().prefault('现代'),
    年: z.coerce.number().prefault(2026),
    月: z.coerce.number().transform(v => _.clamp(Math.round(v), 1, 12)).prefault(4),
    日: z.coerce.number().transform(v => _.clamp(Math.round(v), 1, 31)).prefault(4),
    时: z.coerce.number().transform(v => _.clamp(Math.round(v), 0, 23)).prefault(12),
    分: z.coerce.number().transform(v => _.clamp(Math.round(v), 0, 59)).prefault(0),
  }).transform(data => {
    // 处理日期溢出的简单逻辑（每月按31天计算，简化处理）
    // 若需要更精确的日历，可由主角通过"世界规则"来定义月份天数
    let { 年, 月, 日, 时, 分, 纪历体系, 纪年名称, 纪年年数, 时间演算基底 } = data;
    const 每月天数 = 31;

    // 分钟溢出
    if (分 >= 60) {
      时 += Math.floor(分 / 60);
      分 = 分 % 60;
    }

    // 小时溢出
    if (时 >= 24) {
      日 += Math.floor(时 / 24);
      时 = 时 % 24;
    }

    // 日期溢出（简化：每月31天）
    if (日 > 每月天数) {
      月 += Math.floor((日 - 1) / 每月天数);
      日 = ((日 - 1) % 每月天数) + 1;
    }

    // 月份溢出
    if (月 > 12) {
      年 += Math.floor((月 - 1) / 12);
      月 = ((月 - 1) % 12) + 1;
    }

    纪历体系 = (纪历体系 ?? '').trim() || '公历';
    时间演算基底 = (时间演算基底 ?? '').trim() || '现代';

    const eraNameRaw = typeof 纪年名称 === 'string' ? 纪年名称.trim() : '';
    const eraYearProvided =
      typeof 纪年年数 === 'number' && !Number.isNaN(纪年年数);

    /**
     * 楼层变量若缺「纪历体系」会 prefault 为公历，但玄幻/修真等数据中「年」常为公元锚点、与「纪年年数」不同。
     * 仅当明确是典型的「公元 + 与年同值的序数」时才做公历归一，避免把 822 覆盖成 1907。
     */
    const isPlainGregorian =
      纪历体系 === '公历' &&
      eraNameRaw === '公元' &&
      (!eraYearProvided || 纪年年数 === 年);

    if (isPlainGregorian) {
      纪年名称 = '公元';
      纪年年数 = 年;
    } else if (纪历体系 === '公历') {
      纪年名称 = eraNameRaw;
      纪年年数 = eraYearProvided ? 纪年年数! : 0;
    } else {
      纪年名称 = eraNameRaw;
      纪年年数 = eraYearProvided ? 纪年年数! : 0;
    }

    // 重新钳制，确保数值在有效范围内
    return {
      ...data,
      年,
      月: _.clamp(Math.round(月), 1, 12),
      日: _.clamp(Math.round(日), 1, 31),
      时: _.clamp(Math.round(时), 0, 23),
      分: _.clamp(Math.round(分), 0, 59),
      纪历体系,
      纪年名称,
      纪年年数,
      时间演算基底,
    };
  }).prefault({}),

  角色档案: z.record(
    z.string().describe('角色档案键名：须为 CHR- 加三位序号，如 CHR-001'),
    z
      .object({
        姓名: z.string().prefault('未知'),
        状态: z.enum(['出场中', '暂时退场']).prefault('出场中'),
        描写: z.string().prefault(''),

        当前内心想法: z.string().prefault(''),
        当前位置: z.preprocess(
          (raw: unknown) => (raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}),
          当前位置结构,
        ),
        性格: 标签映射,
        性癖: 性癖映射,
        隐藏性癖: z.string().prefault(''),

        身体信息: z.object({
          年龄: z.coerce.number().transform(v => Math.max(v, 0)).prefault(17),
          身高: z.coerce.number().transform(v => Math.max(v, 0)).prefault(160),
          体重: z.coerce.number().transform(v => Math.max(v, 0)).prefault(48),
          三围: z.preprocess((raw: unknown) => normalize三围(raw), z.string()).prefault('未知'),
          体质特征: z.string().prefault('普通'),
        }).prefault({}),

        服装状态: 服装状态结构,
        身体部位物理状态: 身体部位物理映射,
        敏感点开发: 敏感点开发映射,

        数值: z.object({
          好感度: z.coerce.number().transform(v => _.clamp(v, -100, 100)).prefault(0),
          性癖开发值: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0),
          发情值: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0),
        }).prefault({}),

        身份标签: z.record(z.string(), z.string()).prefault({}),
        当前综合生理描述: z.string().prefault(''),

        参与活动记录: z
          .record(
            z.string().describe('活动ID'),
            z
              .object({
                开始时间: z.string().prefault(''),
                结束时间: z.string().prefault(''),
                参与程度: z.preprocess((raw: unknown) => {
                  const s = String(raw ?? '').trim();
                  if (s === '主要参与者' || s === '次要参与者' || s === '旁观者') return s;
                  return '次要参与者';
                }, z.enum(['主要参与者', '次要参与者', '旁观者']).prefault('次要参与者')),
              })
              .passthrough()
              .prefault({}),
          )
          .prefault({}),
      })
      .passthrough()
      .prefault({}),
  ).prefault({}),

  元信息: z.object({
    玩家名称: z.string().prefault('玩家'),
    玩家设置: z.record(z.string(), z.unknown()).prefault({}),
    当前阶段: z.string().prefault('开局'),
    世界类型: z.coerce
      .string()
      .describe('可填入现代、西幻等预设，或玩家自定义世界名称，最长 64 字')
      .transform(v => {
        const s = String(v ?? '').trim();
        if (s === '未定') return '自定义';
        return s ? s.slice(0, 64) : '现代';
      })
      .prefault('现代'),
    世界简介: z.coerce
      .string()
      .describe('自定义或补充的世界观简介，建议开局由玩家填写')
      .transform(v => String(v ?? '').slice(0, 2000))
      .prefault(''),
    进度: z.coerce.number().transform(v => Math.max(v, 1)).prefault(1),
    最近更新时间: z.coerce.number().prefault(() => Date.now()),
  }).prefault({}),

  游戏状态: z
    .record(z.string().describe('状态名'), z.unknown())
    .prefault({}),
})
  .passthrough()
  .prefault({});

/** 根对象允许 meta、player、openingConfig 等扩展字段（勿与 z.record 做 intersection，避免 MVU 合并失败） */
export const Schema = 核心结构;

export type Schema = z.output<typeof Schema>;

const _mvuRootUnprefaulted = Schema.unwrap();

/**
 * 仅「区域数据 / 建筑数据 / 活动数据」，与 `registerMvuSchema(Schema)` 中同名字段共用同一套解析（preprocess、prefault、passthrough）。
 * 地图确认生成 JSON Patch、写回 MVU 前应通过 {@link parseTacticalMvuMapTripleSnapshot}，保证待发 `<UpdateVariable><JSONPatch>` 内 value 可被变量框架识别。
 */
export const tacticalMvuMapTripleSchema = z.object({
  区域数据: _mvuRootUnprefaulted.shape.区域数据,
  建筑数据: _mvuRootUnprefaulted.shape.建筑数据,
  活动数据: _mvuRootUnprefaulted.shape.活动数据,
});

export type TacticalMvuMapTriple = z.output<typeof tacticalMvuMapTripleSchema>;

/** 将地图三块快照规范为与 MVU Schema 一致的输出（手动新建区域/建筑/活动后经此再进入 Patch / 消息体） */
export function parseTacticalMvuMapTripleSnapshot(
  triple: Partial<Pick<Schema, '区域数据' | '建筑数据' | '活动数据'>>,
): TacticalMvuMapTriple {
  return tacticalMvuMapTripleSchema.parse({
    区域数据: triple.区域数据 ?? {},
    建筑数据: triple.建筑数据 ?? {},
    活动数据: triple.活动数据 ?? {},
  });
}
