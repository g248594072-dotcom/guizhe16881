/**
 * 生成「酒馆助手脚本-结构.json」供复制到酒馆；与 src/规则/schema.ts 逻辑对齐。
 */
const fs = require('fs');
const path = require('path');

const script = `import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

function normalizeTagMap(raw) {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const o = {};
    raw.forEach((item, i) => {
      const s = String(item ?? '');
      const m = s.match(/^([^：:]+)[：:]\\s*(.*)$/);
      if (m) o[m[1].trim()] = m[2].trim();
      else o['标签' + (i + 1)] = s;
    });
    return o;
  }
  if (typeof raw === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(raw)) {
      o[String(k)] = v == null ? '' : String(v);
    }
    return o;
  }
  return {};
}

function normalize三围(raw) {
  if (raw == null || raw === '') return '未知';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'object' && raw !== null) {
    const o = raw;
    const B = o.B ?? o.b;
    const W = o.W ?? o.w;
    const H = o.H ?? o.h;
    if (B != null && W != null && H != null) return 'B' + B + ' W' + W + ' H' + H;
  }
  return '未知';
}

const 标签映射 = z.preprocess(
  (raw) => normalizeTagMap(raw),
  z.record(z.string(), z.string()),
).prefault({});

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
const 规则条目 = 规则条目基础.passthrough().prefault({});

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
        性癖: 标签映射,
        敏感部位: 标签映射,
        隐藏性癖: z.string().prefault(''),

        身体信息: z.object({
          年龄: z.coerce.number().prefault(17),
          身高: z.coerce.number().prefault(160),
          体重: z.coerce.number().prefault(48),
          三围: z.preprocess((raw) => normalize三围(raw), z.string()).prefault('未知'),
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

const Schema = 核心结构;

$(() => {
  registerMvuSchema(Schema);
});
`;

const out = {
  type: 'script',
  enabled: true,
  name: '结构',
  id: 'b407f6ec-aec0-4fea-bb1f-985469d0c94b',
  content: script,
  info: 'align schema.ts; passthrough for MVU (no Unmergable intersection)',
  button: { enabled: true, buttons: [] },
  data: {},
};

/** 与「初始模板/脚本/导入到酒馆中/脚本-实时修改.json」同形，部分导入入口只认该字段集 */
const minimal = {
  id: out.id,
  name: out.name,
  content: out.content,
  info: out.info,
  buttons: [],
};

const dir = path.join(__dirname, '../测试文件/酒馆脚本和世界书');
const writeJson = (file, data) => {
  const p = path.join(dir, file);
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('Wrote', p);
};

writeJson('酒馆助手脚本-结构.json', out);
writeJson('酒馆助手脚本-结构-脚本树数组.json', [out]);
writeJson('酒馆助手脚本-结构-最小字段.json', minimal);

const readme = `酒馆助手「导入脚本 / 脚本 JSON」若失败，请按顺序试：
1) 酒馆助手脚本-结构-脚本树数组.json  （根节点为数组 [{...}] ，部分版本只认这种）
2) 酒馆助手脚本-结构-最小字段.json      （仅 id/name/content/info/buttons）
3) 酒馆助手脚本-结构.json               （完整 Script 对象，含 type/enabled/button/data）
4) 在酒馆助手扩展里选「脚本」相关导入，勿用「导入角色卡」选本文件
5) 文件须 UTF-8；勿用记事本另存为带 BOM
`;
fs.writeFileSync(path.join(dir, '结构脚本-导入说明.txt'), readme, 'utf8');
console.log('Wrote', path.join(dir, '结构脚本-导入说明.txt'));
