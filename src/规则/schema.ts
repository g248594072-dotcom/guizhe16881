/**
 * ZOD Schema 定义
 * 与角色卡变量结构保持一致
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

const 敏感部位映射 = z.preprocess(
  (raw: unknown) => normalizeSensitivePartRecord(raw),
  z.record(z.string(), 敏感部位条目),
).prefault({});

// 规则条目定义（世界规则、区域规则、个人规则共用）
const 规则条目基础 = z.object({
  名称: z.string().prefault(''),
  效果描述: z.string().prefault(''),
  状态: z.enum(['生效中', '已归档']).or(z.string()).prefault('生效中'),
  细分规则: z.record(
    z.string(),
    z.object({
      描述: z.string().prefault(''),
      状态: z.enum(['生效中', '已归档']).or(z.string()).prefault('生效中'),
    }).prefault({})
  ).prefault({}),
  适用对象: z.string().prefault(''),
  标记: z.string().prefault(''),
});
// MVU registerMvuSchema 无法合并 intersection + record 下同名字段；用 passthrough 保留英文等扩展键
const 规则条目 = 规则条目基础.passthrough().prefault({});

// 核心数据结构
const 核心结构 = z.object({
  世界规则: z.record(z.string(), 规则条目).prefault({}),

  区域规则: z.record(z.string(), 规则条目).prefault({}),

  个人规则: z.record(z.string(), 规则条目).prefault({}),

  角色档案: z.record(
    z.string(),
    z
      .object({
        姓名: z.string().prefault('未知'),
        状态: z.enum(['出场中', '暂时退场']).or(z.string()).prefault('出场中'),
        描写: z.string().prefault(''),

        当前内心想法: z.string().prefault(''),
        性格: 标签映射,
        性癖: 性癖映射,
        敏感部位: 敏感部位映射,
        隐藏性癖: z.string().prefault(''),

        身体信息: z.object({
          年龄: z.coerce.number().prefault(17),
          身高: z.coerce.number().prefault(160),
          体重: z.coerce.number().prefault(48),
          三围: z.preprocess((raw: unknown) => normalize三围(raw), z.string()).prefault('未知'),
          体质特征: z.string().prefault('普通'),
        }).prefault({}),

        数值: z.object({
          好感度: z.coerce.number().transform(v => _.clamp(v, -100, 100)).prefault(0),
          性癖开发值: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0),
          发情值: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0),
        }).prefault({}),

        当前综合生理描述: z.string().prefault(''),
      })
      .passthrough()
      .prefault({}),
  ).prefault({}),

  元信息: z.object({
    玩家名称: z.string().prefault('玩家'),
    玩家设置: z.record(z.string(), z.unknown()).prefault({}),
    当前阶段: z.string().prefault('开局'),
    进度: z.coerce.number().prefault(1),
    最近更新时间: z.coerce.number().prefault(() => Date.now()),
  }).prefault({}),

  游戏状态: z.record(z.string(), z.unknown()).prefault({}),
})
  .passthrough()
  .prefault({});

/** 根对象允许 meta、player、openingConfig 等扩展字段（勿与 z.record 做 intersection，避免 MVU 合并失败） */
export const Schema = 核心结构;

export type Schema = z.output<typeof Schema>;
