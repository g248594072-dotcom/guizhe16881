/**
 * 小手机壳脚本：在酒馆页面挂载遮罩 + iframe，加载独立部署的 React 手机 UI。
 * 主界面或其它前端通过 window.parent.TavernPhone.open/toggle/close 调用。
 *
 * 脚本变量（type: script）可配置：
 * - phone_ui_url / tavern_phone_ui_url: 手机界面 index.html 的完整 URL（必填才能显示内容）
 * - phone_wechat_field_map（可选）: 微信联动时从「角色变量」「最新楼层变量」读取字段的 lodash 风格路径，例如：
 *   `{ "personality": "性格", "thought": "心理想法", "name": "微信名" }`
 *   name 若留空或路径无值，则使用当前角色卡名称；thought/personality 优先角色变量，再尝试最新消息变量。
 * - phone_wechat_contacts（可选）: 微信会话列表，数组项支持 `{ id, displayName, name, avatarUrl, personality, thought }` 或字符串（作 displayName）。
 * - phone_wechat_contacts_path（可选）: 从变量中取「会话列表」的路径（点路径）。支持：
 *   - 数组：与 phone_wechat_contacts 同类项；
 *   - 对象字典：键为角色 ID（如 CHR-001），值为角色档案对象（含 姓名、性格、当前内心想法 等），与「角色档案」结构一致。
 *   未配置时，会自动尝试常见路径（含「stat_data.角色档案」等，与规则系统 stat_data 对齐）。
 *   依次尝试 聊天变量 → 最新消息楼层 → 角色变量 → 全局变量。
 * - phone_wechat_memory_path（可选）: 微信回合摘要写入聊天变量的点路径，默认 stat_data.手机微信记忆；
 *   结构为 { [chatScopeId]: { [contactId]: { summary, updatedAt } } }。
 * - phone_wechat_worldbook_mirror（可选）: 回合摘要写入变量成功后，追加到指定世界书条目。值为对象：
 *   `{ "worldbookName": "世界书名", "entryName": "条目显示名" }`（条目须已存在；内容末尾追加带时间戳的摘要块）。
 * - phone_openai_api_base / phone_openai_model（可选）: 手机界面 OpenAI 兼容接口默认值（仅当用户未在界面设置中填写 URL/模型时由父窗口下发；不在此存 API Key）。
 * - phone_wechat_st_character_map（可选）: 对象，键为微信联系人 id（与角色档案键一致，如 CHR-001），值为酒馆「角色管理」中的角色卡名称，用于按 id 拉取该书卡头像。
 *
 * 头像同步：变量里未配置 avatarUrl 时，按联系人 id 解析酒馆书卡——优先本映射表；否则扫描各角色卡 json_data 中是否含 `手机微信角色ID` / `wechat_contact_id` 等字段且值等于该 id；
 * 档案对象上也可写 `酒馆角色名` / `stCharacterName` 直接指定书卡名。仍缺省且 id 为 default 时用当前角色卡。
 *
 * 与主界面「正文」的关系（小手机不会自动插入楼层）：
 * 1) 微信内点「填入」：把最近一条内容写入酒馆主界面输入框，由你手动发送后才会进主对话。
 * 2) 回合摘要：手机可配置写入聊天变量 phone_wechat_memory_path（默认 stat_data.手机微信记忆）；主界面预设/正则若引用该变量，模型才能「读到」微信侧摘要。
 * 3) phone_wechat_worldbook_mirror：可把摘要追加到指定世界书条目，由世界书进入主提示。
 * 4) phone_wechat_wb_sync（可选）：主线「下一次生成」前（GENERATE_BEFORE_COMBINE_PROMPTS），把自上次同步以来各联系人的微信增量对话写入世界书，
 *    条目名为「联系人显示名 + 小手机聊天记录摘要」。未写 worldbookName 时使用当前角色卡绑定的主世界书（getCharWorldbookNames('current').primary）。
 *    默认绿灯（selective），主要关键字每轮按当前角色卡名、展示名、书卡 json 内昵称类字段、各联系人显示名等自动刷新；绿灯条目默认禁止递归与禁止下一步递归。
 *    同步指针存于聊天变量 statePath（默认 stat_data.手机微信世界书同步）。需 phone_ui_url；壳会预建隐藏 iframe 读 IndexedDB。
 *
 * phone_ui_url 兼容说明：jsDelivr、raw.githubusercontent.com 等对 index.html 常返回 Content-Type: text/plain，
 * 浏览器与 iframe 不会按 HTML 解析（表现为整页源码或黑屏）。壳脚本会 fetch 后检测该情况，将 ./assets 等改为绝对地址并
 * 以 blob:text/html 注入 iframe（仅对上述来源做探测，本地与其它站点仍直接设 src）。
 */
import {
  PHONE_CHARACTER_AVATAR_MIRROR_REQUEST,
  PHONE_CHARACTER_AVATAR_SYNC_TYPE,
} from '../shared/phoneCharacterAvatarStorage';
import {
  activateMatchingRuleWorldbook,
  shouldEnableWorldbookMatcher,
} from './utils/worldbookMatcher';

const VERSION = '1.0.0';
const PHONE_W = 375;
const PHONE_H = 812;
const Z_OVERLAY = 10050;
const Z_PHONE = 10051;

/** 与 src/手机 内 tavernPhoneBridge.ts 保持一致 */
const MSG = {
  REQUEST_CLOSE: 'tavern-phone:request-close',
  REQUEST_CONTEXT: 'tavern-phone:request-context',
  REQUEST_ROLE_ARCHIVE: 'tavern-phone:request-role-archive',
  CONTEXT: 'tavern-phone:context',
  CHAT_SCOPE: 'tavern-phone:chat-scope',
  ROLE_ARCHIVE: 'tavern-phone:role-archive',
  /** iframe → 父窗口：将回合摘要写入聊天变量 */
  REQUEST_WRITE_PHONE_MEMORY: 'tavern-phone:request-write-phone-memory',
  WRITE_PHONE_MEMORY_RESULT: 'tavern-phone:write-phone-memory-result',
  REQUEST_INJECT_TO_INPUT: 'tavern-phone:request-inject-to-input',
  INJECT_TO_INPUT_RESULT: 'tavern-phone:inject-to-input-result',
  OPENED: 'tavern-phone:opened',
  CLOSED: 'tavern-phone:closed',
  READY: 'tavern-phone:ready',
  REQUEST_EXPORT_THREADS_FOR_WB: 'tavern-phone:request-export-threads-for-wb',
  EXPORT_THREADS_FOR_WB_RESULT: 'tavern-phone:export-threads-for-wb-result',
  /** 其他 iframe → 父窗口：主动触发世界书同步（如 App.vue 发送消息后） */
  REQUEST_TRIGGER_WB_SYNC: 'tavern-phone:request-trigger-wb-sync',
  /** 其他 iframe → 父窗口：主动触发剧情摘要同步到世界书（规则 App → 小手机壳 → 规则 App） */
  REQUEST_TRIGGER_GAME_STORY_SYNC: 'tavern-phone:request-trigger-game-story-sync',
  /** 小手机壳 → 父窗口：通知规则 App 触发剧情摘要同步 */
  GAME_STORY_WB_SYNC_TRIGGERED: 'tavern-phone:game-story-wb-sync-triggered',
  /** 小手机前端 → 壳脚本：请求角色档案（MVU 角色档案） */
  REQUEST_CHARACTER_ARCHIVE: 'tavern-phone:request-character-archive',
  /** 壳脚本 → 小手机前端：返回角色档案数据 */
  CHARACTER_ARCHIVE_RESPONSE: 'tavern-phone:character-archive-response',
  /** 小手机前端 → 壳脚本：写回角色分析结果到 MVU 变量 */
  REQUEST_WRITE_CHARACTER_ANALYSIS: 'tavern-phone:request-write-character-analysis',
  /** 壳脚本 → 小手机前端：写回结果响应 */
  WRITE_CHARACTER_ANALYSIS_RESULT: 'tavern-phone:write-character-analysis-result',
  /** 小手机前端 → 壳脚本：请求将角色分析结果同步到世界书 */
  REQUEST_SYNC_CHARACTER_TO_WORLDBOOK: 'tavern-phone:request-sync-character-to-worldbook',
  /** 壳脚本 → 小手机前端：世界书同步结果响应 */
  SYNC_CHARACTER_TO_WORLDBOOK_RESULT: 'tavern-phone:sync-character-to-worldbook-result',
  /** 小手机前端 → 壳脚本：保存自动分析间隔设置 */
  SAVE_AUTO_ANALYZE_INTERVAL: 'tavern-phone:save-auto-analyze-interval',
  /** 壳脚本 → 小手机前端：通知自动触发分析全部角色 */
  TRIGGER_AUTO_ANALYZE_ALL: 'tavern-phone:trigger-auto-analyze-all',
} as const;

function getByPath(obj: unknown, path: string): unknown {
  if (!path?.trim() || obj == null) {
    return undefined;
  }
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function pickWeChatField(
  map: Record<string, string>,
  key: 'personality' | 'thought' | 'name',
  charVars: Record<string, unknown>,
  msgVars: Record<string, unknown>,
): string {
  const path = map[key];
  if (!path?.trim()) {
    return '';
  }
  const fromChar = getByPath(charVars, path);
  if (fromChar != null && String(fromChar).trim() !== '') {
    return String(fromChar);
  }
  const fromMsg = getByPath(msgVars, path);
  if (fromMsg != null && String(fromMsg).trim() !== '') {
    return String(fromMsg);
  }
  return '';
}

type WeChatContactOut = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  personality?: string;
  thought?: string;
  /** 直接指定酒馆角色卡名，用于头像同步（与 id 二选一补充） */
  stCharacterName?: string;
};

/** 将「性格」等字段格式化为字符串（支持 string 或 string[]） */
function formatTraitField(val: unknown): string | undefined {
  if (typeof val === 'string' && val.trim()) {
    return val.trim();
  }
  if (Array.isArray(val) && val.length > 0) {
    const s = val.map(x => String(x)).filter(t => t.trim());
    return s.length ? s.join('、') : undefined;
  }
  return undefined;
}

function pickInnerThought(o: Record<string, unknown>): string | undefined {
  const t = o.当前内心想法 ?? o.心理想法 ?? o.thought;
  if (typeof t === 'string' && t.trim()) {
    return t.trim();
  }
  return undefined;
}

/**
 * 角色档案条目：键为 CHR-001 等，值为含 姓名、性格、当前内心想法、描写 等字段的对象
 */
function normalizeRoleArchiveEntry(roleId: string, raw: unknown): WeChatContactOut | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const nameRaw = o.姓名 ?? o.displayName ?? o.name ?? o.昵称;
  if (typeof nameRaw !== 'string' || !nameRaw.trim()) {
    return null;
  }
  const id = roleId.trim() || 'unknown';
  let avatarUrl: string | undefined;
  if (typeof o.avatarUrl === 'string' && o.avatarUrl.trim()) {
    avatarUrl = o.avatarUrl.trim();
  } else if (typeof o.头像链接 === 'string' && o.头像链接.trim()) {
    avatarUrl = o.头像链接.trim();
  } else if (typeof o.头像 === 'string' && o.头像.trim()) {
    avatarUrl = o.头像.trim();
  }
  const trait = formatTraitField(o.性格);
  const desc = typeof o.描写 === 'string' && o.描写.trim() ? o.描写.trim() : '';
  let personality: string | undefined;
  if (trait && desc) {
    personality = `${trait}；${desc}`;
  } else {
    personality = trait ?? (desc || undefined);
  }
  const thought = pickInnerThought(o);
  const stRaw = o.酒馆角色名 ?? o.stCharacterName ?? o.sillyTavernCharacterName;
  const stCharacterName =
    typeof stRaw === 'string' && stRaw.trim() ? stRaw.trim() : undefined;
  return {
    id,
    displayName: nameRaw.trim(),
    avatarUrl,
    personality,
    thought,
    stCharacterName,
  };
}

function normalizeWeChatContact(raw: unknown, index: number): WeChatContactOut | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) {
      return null;
    }
    return { id: `idx-${index}`, displayName: s };
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const dn = o.displayName ?? o.name ?? o.名称 ?? o.昵称 ?? o.姓名;
    if (typeof dn !== 'string' || !dn.trim()) {
      return null;
    }
    const idRaw = o.id ?? o.ID;
    const id =
      typeof idRaw === 'string' && idRaw.trim()
        ? idRaw.trim()
        : typeof idRaw === 'number'
          ? String(idRaw)
          : `idx-${index}`;
    let avatarUrl: string | undefined;
    if (typeof o.avatarUrl === 'string' && o.avatarUrl.trim()) {
      avatarUrl = o.avatarUrl.trim();
    } else if (typeof o.avatar === 'string' && o.avatar.trim()) {
      avatarUrl = o.avatar.trim();
    }
    const trait = formatTraitField(o.性格);
    const desc = typeof o.描写 === 'string' && o.描写.trim() ? o.描写.trim() : '';
    let personality: string | undefined;
    if (trait && desc) {
      personality = `${trait}；${desc}`;
    } else {
      personality = trait ?? (desc || undefined);
    }
    if (!personality && typeof o.personality === 'string' && o.personality.trim()) {
      personality = o.personality.trim();
    }
    const thought = pickInnerThought(o);
    const stRaw = o.酒馆角色名 ?? o.stCharacterName ?? o.sillyTavernCharacterName;
    const stCharacterName =
      typeof stRaw === 'string' && stRaw.trim() ? stRaw.trim() : undefined;
    return { id, displayName: dn.trim(), avatarUrl, personality, thought, stCharacterName };
  }
  return null;
}

/** 从变量节点解析联系人：数组 或 角色 ID → 档案 的对象字典 */
function contactsFromVariableValue(val: unknown): WeChatContactOut[] {
  if (val == null) {
    return [];
  }
  if (Array.isArray(val)) {
    return val.map(normalizeWeChatContact).filter((x): x is WeChatContactOut => x != null);
  }
  if (typeof val === 'object') {
    const out: WeChatContactOut[] = [];
    for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        const fromArchive = normalizeRoleArchiveEntry(key, v);
        if (fromArchive) {
          out.push(fromArchive);
        } else {
          const fb = normalizeWeChatContact({ ...(v as Record<string, unknown>), id: key }, out.length);
          if (fb) {
            out.push(fb);
          }
        }
      }
    }
    return out;
  }
  return [];
}

function collectVariablesSources(): Record<string, unknown>[] {
  const trySources: Record<string, unknown>[] = [];
  try {
    trySources.push(getVariables({ type: 'chat' }) as Record<string, unknown>);
  } catch {
    /* */
  }
  try {
    trySources.push(getVariables({ type: 'message', message_id: 'latest' }) as Record<string, unknown>);
  } catch {
    /* */
  }
  try {
    trySources.push(getVariables({ type: 'character' }) as Record<string, unknown>);
  } catch {
    /* */
  }
  try {
    trySources.push(getVariables({ type: 'global' }) as Record<string, unknown>);
  } catch {
    /* */
  }
  return trySources;
}

/**
 * 常见「角色档案」在变量中的点路径（优先 stat_data，与规则系统 JSON 结构一致）
 */
const COMMON_ROLE_ARCHIVE_PATHS = [
  'stat_data.角色档案',
  '角色档案',
  '规则.角色档案',
  '世界.角色档案',
  '数据.角色档案',
  '游戏.角色档案',
];

function buildWeChatContacts(baseDisplayName: string): WeChatContactOut[] {
  const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
  const explicit = scriptVars.phone_wechat_contacts;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map(normalizeWeChatContact).filter((x): x is WeChatContactOut => x != null);
  }
  const pathCustom = typeof scriptVars.phone_wechat_contacts_path === 'string' ? scriptVars.phone_wechat_contacts_path.trim() : '';
  const pathsToTry = pathCustom ? [pathCustom] : [...COMMON_ROLE_ARCHIVE_PATHS];
  const trySources = collectVariablesSources();
  for (const path of pathsToTry) {
    for (const src of trySources) {
      const node = getByPath(src, path);
      const list = contactsFromVariableValue(node);
      if (list.length > 0) {
        return list;
      }
    }
  }
  return [{ id: 'default', displayName: baseDisplayName }];
}

/** 从角色卡 json_data 递归查找与微信联系人 id 绑定的字段 */
function findWeChatRoleIdInJson(json: unknown, depth = 0): string | null {
  if (depth > 14) {
    return null;
  }
  if (json == null) {
    return null;
  }
  if (typeof json === 'object' && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    const keys = ['手机微信角色ID', 'wechat_contact_id', '手机微信角色id', 'mvuCharacterId'];
    for (const k of keys) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
    for (const v of Object.values(o)) {
      const found = findWeChatRoleIdInJson(v, depth + 1);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * 联系人 id → 酒馆角色卡名（getCharacter 用名）。来源：脚本变量 phone_wechat_st_character_map、
 * 各书卡 json_data 内手机微信角色ID 等字段。
 */
function buildContactIdToStCharacterNameMap(): Map<string, string> {
  const m = new Map<string, string>();
  try {
    const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    const explicit = scriptVars.phone_wechat_st_character_map;
    if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
      for (const [k, v] of Object.entries(explicit as Record<string, unknown>)) {
        if (k?.trim() && typeof v === 'string' && v.trim()) {
          m.set(k.trim(), v.trim());
        }
      }
    }
  } catch {
    /* */
  }
  let names: string[] = [];
  try {
    names = getCharacterNames();
  } catch {
    return m;
  }
  for (const name of names) {
    try {
      const data = getCharData(name);
      if (!data?.json_data) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.json_data);
      } catch {
        continue;
      }
      const rid = findWeChatRoleIdInJson(parsed);
      if (rid && !m.has(rid)) {
        m.set(rid, name);
      }
    } catch {
      /* */
    }
  }
  return m;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('FileReader'));
    r.readAsDataURL(blob);
  });
}

/**
 * 从酒馆「角色管理」解析头像为 data URL，供跨域 iframe 使用（与角色卡上传图一致）。
 */
async function resolveCharacterAvatarDataUrl(characterName: LiteralUnion<'current', string>): Promise<string | null> {
  try {
    const ch = await getCharacter(characterName);
    const av = ch.avatar;
    if (av instanceof Blob) {
      return await blobToDataUrl(av);
    }
    if (typeof av === 'string' && av.trim()) {
      const path = getCharAvatarPath(characterName);
      if (!path?.trim()) {
        return null;
      }
      const p = path.trim();
      let url: string;
      if (/^https?:\/\//i.test(p)) {
        url = p;
      } else if (p.startsWith('/')) {
        url = `${window.location.origin}${p}`;
      } else {
        url = new URL(p, window.location.origin).href;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        return null;
      }
      const blob = await res.blob();
      return await blobToDataUrl(blob);
    }
  } catch {
    /* */
  }
  return null;
}

/**
 * 变量未给 avatarUrl 时，按联系人 id 映射酒馆角色卡（phone_wechat_st_character_map / 书卡 json 字段 / 档案 酒馆角色名），
 * default 会话用当前卡。
 */
async function enrichContactsWithStAvatars(contacts: WeChatContactOut[]): Promise<WeChatContactOut[]> {
  const idToStName = buildContactIdToStCharacterNameMap();
  const out = await Promise.all(
    contacts.map(async c => {
      if (c.avatarUrl?.trim()) {
        return c;
      }
      let url: string | null = null;
      const stFromField = c.stCharacterName?.trim();
      const stFromMap = idToStName.get(c.id.trim());
      const stName = stFromField || stFromMap;
      if (stName) {
        try {
          url = await resolveCharacterAvatarDataUrl(stName);
        } catch {
          /* */
        }
      }
      if (!url && c.id === 'default') {
        try {
          url = await resolveCharacterAvatarDataUrl('current');
        } catch {
          /* */
        }
      }
      return url ? { ...c, avatarUrl: url } : c;
    }),
  );
  return out;
}

/**
 * 档案 App 与微信共用 MVU「角色档案」：变量未写头像时，按 id / 酒馆角色名 与「角色管理」中书卡头像对齐（与 enrichContactsWithStAvatars 同源）。
 */
async function enrichRoleArchiveDictWithStAvatars(角色档案: Record<string, unknown>): Promise<Record<string, unknown>> {
  let clone: Record<string, unknown>;
  try {
    clone = JSON.parse(JSON.stringify(角色档案)) as Record<string, unknown>;
  } catch {
    return 角色档案;
  }
  const idToStName = buildContactIdToStCharacterNameMap();
  await Promise.all(
    Object.entries(clone).map(async ([roleId, raw]) => {
      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
        return;
      }
      const o = raw as Record<string, unknown>;
      const existing =
        (typeof o.头像链接 === 'string' && o.头像链接.trim()) ||
        (typeof o.avatarUrl === 'string' && o.avatarUrl.trim()) ||
        (typeof o.头像 === 'string' && o.头像.trim());
      if (existing) {
        return;
      }
      const stRaw = o.酒馆角色名 ?? o.stCharacterName ?? o.sillyTavernCharacterName;
      const stFromField = typeof stRaw === 'string' && stRaw.trim() ? stRaw.trim() : undefined;
      const stFromMap = idToStName.get(String(roleId).trim());
      const stName = stFromField || stFromMap;
      let url: string | null = null;
      if (stName) {
        try {
          url = await resolveCharacterAvatarDataUrl(stName);
        } catch {
          /* */
        }
      }
      if (url) {
        o.头像链接 = url;
      }
    }),
  );
  return clone;
}

/** 合并多路径、多变量源，供「+ 手动添加」拉取全部可选角色（不返回单条 fallback） */
function buildRoleArchiveCandidates(): WeChatContactOut[] {
  const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
  const explicit = scriptVars.phone_wechat_contacts;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map(normalizeWeChatContact).filter((x): x is WeChatContactOut => x != null);
  }
  const pathCustom = typeof scriptVars.phone_wechat_contacts_path === 'string' ? scriptVars.phone_wechat_contacts_path.trim() : '';
  const pathsOrdered: string[] = [];
  if (pathCustom) {
    pathsOrdered.push(pathCustom);
  }
  for (const p of COMMON_ROLE_ARCHIVE_PATHS) {
    if (p && !pathsOrdered.includes(p)) {
      pathsOrdered.push(p);
    }
  }
  const merged = new Map<string, WeChatContactOut>();
  const trySources = collectVariablesSources();
  for (const path of pathsOrdered) {
    if (!path) {
      continue;
    }
    for (const src of trySources) {
      const node = getByPath(src, path);
      const list = contactsFromVariableValue(node);
      for (const c of list) {
        merged.set(c.id, c);
      }
    }
  }
  return Array.from(merged.values());
}

/**
 * 与 getShellDocument 一致：脚本在嵌套 iframe 时 SillyTavern 在 top，parent 可能只是扩展/中间层。
 *
 * SillyTavern release 中 `globalThis.SillyTavern` 仅为 `{ libs, getContext }`，chatId / getCurrentChatId
 * 在 `getContext()` 返回值上；旧版或类型声明中的「扁平」对象也需兼容。
 */
type SillyTavernChatScope = {
  getCurrentChatId?: () => string;
  chatId?: string;
};

function resolveSillyTavernChatScope(st: unknown): SillyTavernChatScope | undefined {
  if (!st || typeof st !== 'object') {
    return undefined;
  }
  const root = st as Record<string, unknown>;
  if (typeof root.getContext === 'function') {
    try {
      const ctx = (root.getContext as () => unknown)();
      if (ctx && typeof ctx === 'object') {
        return ctx as SillyTavernChatScope;
      }
    } catch {
      /* */
    }
  }
  if (typeof root.getCurrentChatId === 'function' || root.chatId != null) {
    return st as SillyTavernChatScope;
  }
  return undefined;
}

function pickSillyTavernFromWindow(w: Window): SillyTavernChatScope | undefined {
  try {
    const st = (w as Window & { SillyTavern?: unknown }).SillyTavern;
    return st !== undefined ? resolveSillyTavernChatScope(st) : undefined;
  } catch {
    return undefined;
  }
}

function getSillyTavernForChatScope(): SillyTavernChatScope | undefined {
  try {
    const topWin = window.top;
    if (topWin && topWin !== window) {
      const st = pickSillyTavernFromWindow(topWin);
      if (st) {
        return st;
      }
    }
  } catch {
    /* 跨域 top */
  }
  try {
    if (window.parent !== window) {
      const st = pickSillyTavernFromWindow(window.parent);
      if (st) {
        return st;
      }
    }
  } catch {
    /* 跨域 parent */
  }
  return pickSillyTavernFromWindow(window);
}

function getChatScopeId(): string | null {
  try {
    const st = getSillyTavernForChatScope();
    if (!st) {
      return null;
    }
    // 优先用 getCurrentChatId（需要聊天已保存才有值）
    const id = st.getCurrentChatId?.();
    if (id != null && String(id).trim() !== '') {
      return String(id);
    }
    // 备选：用 chatId（酒馆加载角色卡时就有值）
    const chatId = st.chatId;
    if (chatId != null && String(chatId).trim() !== '') {
      return String(chatId);
    }
  } catch {
    /* */
  }
  return null;
}

const STORY_SNIPPET_MAX_FLOORS = 20;
const STORY_SNIPPET_MAX_CHARS = 6000;
const ROLE_SUMMARY_MAX_CHARS = 8000;

function stripHtmlForSnippet(s: string): string {
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 去掉图像生成提示整段（如 image###Scene Composition:... Character N Prompt/UC ...###），
 * 避免主剧情节选里混入 SD/NAI 画风标签。
 */
function stripImageGenPromptBlocksForWeChatSnippet(raw: string): string {
  let t = String(raw);
  t = t.replace(/image###[\s\S]*?###/gi, '\n');
  t = t.replace(/image###[\s\S]*$/gi, full => {
    if (/Scene Composition/i.test(full) && /Character\s+\d+\s+Prompt:/i.test(full)) {
      return '\n';
    }
    return full;
  });
  return t;
}

function isImageGenPromptNoiseLine(line: string): boolean {
  const L = line.trim();
  if (!L) {
    return false;
  }
  if (/^image###/i.test(L)) {
    return true;
  }
  if (/###Scene Composition:/i.test(L) && /Character\s+\d+\s+Prompt:/i.test(L)) {
    return true;
  }
  if (/^Scene Composition:/i.test(L) && /Character\s+\d+\s+Prompt:/i.test(L)) {
    return true;
  }
  if (/^Character\s+\d+\s+Prompt:/i.test(L)) {
    return true;
  }
  if (/^Character\s+\d+\s+UC:/i.test(L)) {
    return true;
  }
  return false;
}

/**
 * 去掉主界面楼层里不适合喂给「微信」模型的片段：MVU patch、选项行、代码块等。
 * 避免模型模仿主线的选项 / JSON / 第三人称小说体。
 */
function stripMainChatMetaForWeChatSnippet(raw: string): string {
  let t = String(raw);
  t = stripImageGenPromptBlocksForWeChatSnippet(t);
  t = t.replace(/<patch\b[^>]*>[\s\S]*?<\/patch>/gi, '\n');
  t = t.replace(/<JSONPatch\b[^>]*>[\s\S]*?<\/JSONPatch>/gi, '\n');
  t = t.replace(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable>/gi, '\n');
  t = t.replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '\n');
  t = t.replace(/```[\s\S]*?```/g, '\n');
  return t;
}

/** 去掉单行里的噪音（在 stripHtml 之前按行处理） */
function filterWeChatSnippetLines(raw: string): string {
  const parts = String(raw).split(/\r?\n/);
  const out: string[] = [];
  for (const line of parts) {
    const L = line.trim();
    if (!L) {
      continue;
    }
    if (/^[A-Ha-hＡ-Ｈ][\.．、:：]\s*\S/.test(L)) {
      continue;
    }
    if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(L)) {
      continue;
    }
    if (/^\[\s*\{[\s\S]*"op"\s*:/.test(L)) {
      continue;
    }
    if (isImageGenPromptNoiseLine(L)) {
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * 与规则前端 messageParser 一致：最后一对闭合的 <maintext> 内部（先去掉 thinking）。
 */
function extractMaintextByLastClosePairForPhone(text: string): string {
  if (!text) {
    return '';
  }
  const lc = text.toLowerCase();
  const closeIdx = lc.lastIndexOf('</maintext>');
  if (closeIdx === -1) {
    return '';
  }
  const openIdx = lc.lastIndexOf('<maintext>', closeIdx);
  if (openIdx === -1) {
    return '';
  }
  const openSlice = text.slice(openIdx);
  const openMatch = openSlice.match(/^<maintext>/i);
  if (!openMatch) {
    return '';
  }
  const innerStart = openIdx + openMatch[0].length;
  if (innerStart > closeIdx) {
    return '';
  }
  if (!/^<\/maintext>/i.test(text.slice(closeIdx))) {
    return '';
  }
  return text.slice(innerStart, closeIdx).trim();
}

function parseMaintextForPhoneStory(raw: string): string {
  let cleaned = String(raw).replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '');
  const thinkingStart = cleaned.search(/<thinking>/i);
  if (thinkingStart !== -1) {
    cleaned = cleaned.substring(0, thinkingStart);
  }
  const redactedStart = cleaned.search(/<redacted_reasoning>/i);
  if (redactedStart !== -1) {
    cleaned = cleaned.substring(0, redactedStart);
  }
  return extractMaintextByLastClosePairForPhone(cleaned);
}

/** 最后一对闭合的 <sum> 内部 */
function extractLastSumForPhoneStory(raw: string): string {
  let cleaned = String(raw).replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, '');
  const matches = [...cleaned.matchAll(/<sum>([\s\S]*?)<\/sum>/gi)];
  if (matches.length === 0) {
    return '';
  }
  const last = matches[matches.length - 1];
  return (last[1] ?? '').trim();
}

/**
 * AI 楼层：只采用完整闭合的 <maintext> + <sum>；无则跳过该层（避免选项/patch 混入）。
 */
function formatAssistantStorySnippet(raw: string): string {
  const cleaned = stripImageGenPromptBlocksForWeChatSnippet(String(raw));
  const maintext = parseMaintextForPhoneStory(cleaned);
  const sum = extractLastSumForPhoneStory(cleaned);
  const parts: string[] = [];
  if (maintext) {
    parts.push(`【正文】${stripHtmlForSnippet(maintext)}`);
  }
  if (sum) {
    parts.push(`【摘要】${stripHtmlForSnippet(sum)}`);
  }
  return parts.join('\n');
}

/**
 * 当前聊天中第一条未隐藏的用户楼层 message_id（通常为开局/首句输入，不注入微信主剧情节选）
 */
function findFirstVisibleUserMessageId(last: number): number | null {
  try {
    const users = getChatMessages(`0-${last}`, { role: 'user', hide_state: 'unhidden' });
    if (users.length === 0) {
      return null;
    }
    return users[0].message_id;
  } catch {
    try {
      const all = getChatMessages(`0-${last}`);
      for (const m of all) {
        if (m.is_hidden) {
          continue;
        }
        if (m.role === 'user') {
          return m.message_id;
        }
      }
    } catch {
      /* */
    }
    return null;
  }
}

/** 主界面最近若干楼层：用户=净化后的完整发言；助手=仅闭合的 maintext + sum（与规则卡输出格式对齐） */
function buildRecentStorySnippet(): string {
  try {
    const last = getLastMessageId();
    if (last < 0) {
      return '';
    }
    const skipFirstUserId = findFirstVisibleUserMessageId(last);
    const span = Math.min(STORY_SNIPPET_MAX_FLOORS, last + 1);
    const start = Math.max(0, last - span + 1);
    const range = `${start}-${last}`;
    const msgs = getChatMessages(range);
    const lines: string[] = [];
    for (const m of msgs) {
      if (m.is_hidden) {
        continue;
      }
      if (m.role !== 'user' && m.role !== 'assistant') {
        continue;
      }
      const label = m.role === 'user' ? '用户' : (m.name || 'AI');
      if (m.role === 'user') {
        if (skipFirstUserId != null && m.message_id === skipFirstUserId) {
          continue;
        }
        const stripped = stripMainChatMetaForWeChatSnippet(m.message);
        const filtered = filterWeChatSnippetLines(stripped);
        const text = stripHtmlForSnippet(filtered);
        if (!text) {
          continue;
        }
        lines.push(`${label}：${text}`);
        continue;
      }
      const assistantText = formatAssistantStorySnippet(m.message);
      if (!assistantText) {
        continue;
      }
      lines.push(`${label}：${assistantText}`);
    }
    const joined = lines.join('\n');
    return joined.length > STORY_SNIPPET_MAX_CHARS ? joined.slice(0, STORY_SNIPPET_MAX_CHARS) + '…' : joined;
  } catch {
    return '';
  }
}

/** 从角色档案对象上读取「剧情摘要」类字段，键为联系人 id */
function buildRoleStorySummaries(): Record<string, string> {
  const out: Record<string, string> = {};
  const trySources = collectVariablesSources();
  const pathOrder: string[] = [];
  try {
    const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    const custom =
      typeof scriptVars.phone_wechat_contacts_path === 'string' ? scriptVars.phone_wechat_contacts_path.trim() : '';
    if (custom) {
      pathOrder.push(custom);
    }
  } catch {
    /* */
  }
  for (const p of COMMON_ROLE_ARCHIVE_PATHS) {
    if (p && !pathOrder.includes(p)) {
      pathOrder.push(p);
    }
  }
  for (const src of trySources) {
    for (const path of pathOrder) {
      if (!path) {
        continue;
      }
      const node = getByPath(src, path);
      if (node && typeof node === 'object' && !Array.isArray(node)) {
        for (const [rid, raw] of Object.entries(node as Record<string, unknown>)) {
          if (!rid || out[rid]) {
            continue;
          }
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            const o = raw as Record<string, unknown>;
            const s = o.剧情摘要 ?? o.故事摘要 ?? o.storySummary;
            if (typeof s === 'string' && s.trim()) {
              const t = s.trim();
              out[rid] = t.length > ROLE_SUMMARY_MAX_CHARS ? t.slice(0, ROLE_SUMMARY_MAX_CHARS) + '…' : t;
            }
          }
        }
      }
    }
  }
  return out;
}

function mergePhoneMemoryIntoChatVars(
  vars: Record<string, unknown>,
  dotPath: string,
  chatScopeId: string,
  contactId: string,
  summary: string,
): Record<string, unknown> {
  const next = JSON.parse(JSON.stringify(vars)) as Record<string, unknown>;
  const parts = dotPath.split('.').filter(Boolean);
  if (parts.length === 0) {
    return next;
  }
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      const existing = cur[key];
      const bucket =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? (existing as Record<string, unknown>)
          : {};
      const sk = chatScopeId || 'local-offline';
      const prevScope = bucket[sk];
      const scopeNode =
        prevScope && typeof prevScope === 'object' && !Array.isArray(prevScope)
          ? ({ ...(prevScope as Record<string, unknown>) } as Record<string, unknown>)
          : {};
      scopeNode[contactId] = { summary, updatedAt: Date.now() };
      bucket[sk] = scopeNode;
      cur[key] = bucket;
    } else {
      if (cur[key] == null || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
        cur[key] = {};
      }
      cur = cur[key] as Record<string, unknown>;
    }
  }
  return next;
}

/**
 * 若脚本变量配置了 phone_wechat_worldbook_mirror，则将摘要追加到对应世界书条目的 content 末尾
 */
async function mirrorPhoneSummaryToWorldbookIfConfigured(summary: string): Promise<void> {
  const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
  const raw = scriptVars.phone_wechat_worldbook_mirror;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return;
  }
  const o = raw as Record<string, unknown>;
  const worldbookName = typeof o.worldbookName === 'string' ? o.worldbookName.trim() : '';
  const entryName = typeof o.entryName === 'string' ? o.entryName.trim() : '';
  if (!worldbookName || !entryName) {
    return;
  }
  const block = `\n\n--- [手机微信 ${new Date().toLocaleString('zh-CN')}] ---\n${summary}`;
  await updateWorldbookWith(
    worldbookName,
    entries =>
      entries.map(e => {
        if (e.name !== entryName) {
          return e;
        }
        const cur = typeof e.content === 'string' ? e.content : '';
        return { ...e, content: cur + block };
      }),
    { render: 'debounced' },
  );
}

type WbExportedMsg = { id: string; role: 'user' | 'assistant'; content: string; time: number };
type WbExportedThread = { roleId: string; conversationId: string; messages: WbExportedMsg[] };

type WbSyncScriptCfg = {
  enabled: boolean;
  /** 非空则优先使用；否则用当前角色卡绑定的主世界书 */
  worldbookName: string;
  /** 默认 selective（绿灯）；constant 为蓝灯 */
  strategy: 'constant' | 'selective';
  /** 额外追加的主要关键字（字符串或正则），与自动采集的名称类关键词合并 */
  selectiveKeys: (string | RegExp)[];
  statePath: string;
};

function getWbSyncScriptCfg(): WbSyncScriptCfg | null {
  try {
    const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    const raw = scriptVars.phone_wechat_wb_sync;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      // 未配置 phone_wechat_wb_sync → 只要 phone_ui_url 存在就自动启用
      if (!getPhoneUiUrl()) {
        return null;
      }
      return {
        enabled: true,
        worldbookName: '',
        strategy: 'constant',
        selectiveKeys: [],
        statePath: 'stat_data.手机微信世界书同步',
      };
    }
    const o = raw as Record<string, unknown>;
    if (o.enabled === false) {
      return null;
    }
    const worldbookName = typeof o.worldbookName === 'string' ? o.worldbookName.trim() : '';
    const strategy = o.strategy === 'constant' ? 'constant' : 'selective';
    const sk = o.selectiveKeys;
    const selectiveKeys: (string | RegExp)[] = Array.isArray(sk)
      ? sk.filter((x): x is string | RegExp => typeof x === 'string' || x instanceof RegExp)
      : [];
    const statePath =
      typeof o.statePath === 'string' && o.statePath.trim() ? o.statePath.trim() : 'stat_data.手机微信世界书同步';
    return { enabled: true, worldbookName, strategy, selectiveKeys, statePath };
  } catch {
    return null;
  }
}

/**
 * 解析世界书名称：
 * 1. 脚本变量显式配置
 * 2. chatScopeId（聊天文件名，每个聊天对应独立世界书）
 * 3. 当前角色卡绑定的主世界书
 */
function resolveWorldbookNameForWbSync(cfg: WbSyncScriptCfg, chatScopeId: string): string | null {
  if (cfg.worldbookName) {
    return cfg.worldbookName;
  }
  if (chatScopeId && chatScopeId.trim()) {
    return chatScopeId.trim();
  }
  try {
    const w = getCharWorldbookNames('current');
    const p = w?.primary?.trim();
    if (p) {
      return p;
    }
    const add0 = Array.isArray(w?.additional) ? w.additional[0]?.trim() : '';
    if (add0) {
      return add0;
    }
  } catch {
    /* */
  }
  console.warn('[tavern-phone] 无法确定世界书名：chatScopeId 为空且当前角色卡未绑定世界书');
  return null;
}

/**
 * 确保世界书存在：不存在则创建（含一个绿灯模板条目），并激活为全局世界书。
 * 若已存在，也重新确保其为全局世界书（防止切换角色卡或刷新后全局状态丢失）。
 * 返回创建后的模板条目，供调用方复制设置。
 */
async function ensureWorldbookForSync(
  worldbookName: string,
): Promise<{ template: WorldbookEntry; isNew: boolean } | null> {
  let template: WorldbookEntry | null = null;
  let isNew = false;

  try {
    const existing = await getWorldbook(worldbookName);
    if (existing.length > 0) {
      template = existing[0];
      isNew = false;
    }
  } catch {
    /* 世界书不存在，尝试创建 */
  }

  // 不存在 → 创建
  if (!template) {
    const templateEntry: PartialDeep<WorldbookEntry> = {
      name: '【系统】小手机微信摘要',
      enabled: true,
      position: 'normal',
      probability: 100,
      strategy: {
        type: 'constant',
        keys: [],
        keys_secondary: { logic: 'and_any', keys: [] },
        scan_depth: 4,
      },
      recursion: { prevent_incoming: true, prevent_outgoing: true, delay_until: null },
      effect: { ...({} as WorldbookEntry['effect']) },
    };

    const created = await createWorldbook(worldbookName, [templateEntry as WorldbookEntry]);
    if (!created) {
      console.error('[tavern-phone] 创建世界书失败', worldbookName);
      return null;
    }

    // 重新读取以获取 uid 等填充后的完整条目
    const after = await getWorldbook(worldbookName);
    template = after.length > 0 ? after[0] : (templateEntry as WorldbookEntry);
    isNew = true;
    console.info('[tavern-phone] 已创建世界书', worldbookName);
  }

  // 无论是否新创建，都确保激活为全局
  // 这可以防止切换角色卡或刷新后全局状态丢失
  try {
    await rebindGlobalWorldbooks([worldbookName]);
    console.info('[tavern-phone] 已确保全局世界书', worldbookName);
  } catch {
    console.warn('[tavern-phone] 激活全局失败（需手动在酒馆中开启）', worldbookName);
  }

  return { template, isNew };
}

/** 从当前角色卡 json 等采集可用于绿灯扫描的名称、昵称类词 */
function collectNameTokensFromCurrentCharacterCard(): string[] {
  const out: string[] = [];
  try {
    const cur = getCharData('current');
    if (!cur) {
      return out;
    }
    const push = (s: unknown) => {
      if (typeof s === 'string' && s.trim()) {
        out.push(s.trim());
      }
    };
    push(cur.name);
    if (typeof cur.json_data === 'string' && cur.json_data.trim()) {
      try {
        const j = JSON.parse(cur.json_data) as Record<string, unknown>;
        push(j.name);
        push(j.nickname);
        push(j.昵称);
        push(j.char_name);
        const data = j.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const d = data as Record<string, unknown>;
          push(d.name);
          push(d.nickname);
          push(d.昵称);
        }
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }
  return out;
}

function buildDynamicSelectiveKeysForWbSync(
  ctx: Awaited<ReturnType<typeof buildWeChatContext>>,
  cfg: WbSyncScriptCfg,
): (string | RegExp)[] {
  const strSet = new Set<string>();
  const addStr = (s: string) => {
    const t = s.trim();
    if (t.length > 0 && t.length <= 120) {
      strSet.add(t);
    }
  };
  if (ctx.characterName) {
    addStr(ctx.characterName);
  }
  if (ctx.displayName) {
    addStr(ctx.displayName);
  }
  for (const c of ctx.contacts) {
    addStr(c.displayName);
  }
  for (const s of collectNameTokensFromCurrentCharacterCard()) {
    addStr(s);
  }
  const out: (string | RegExp)[] = [...strSet];
  for (const x of cfg.selectiveKeys) {
    if (typeof x === 'string' && x.trim()) {
      out.push(x.trim());
    } else if (x instanceof RegExp) {
      out.push(x);
    }
  }
  return out.length > 0 ? out : ['微信'];
}

function wbSyncRecursionClosed(): WorldbookEntry['recursion'] {
  return { prevent_incoming: true, prevent_outgoing: true, delay_until: null };
}

function wbStrategyConstantFromTemplate(template?: WorldbookEntry['strategy']): WorldbookEntry['strategy'] {
  return {
    type: 'constant',
    keys: [],
    keys_secondary: template?.keys_secondary ?? { logic: 'and_any', keys: [] },
    scan_depth: template?.scan_depth ?? 'same_as_global',
  };
}

function wbStrategySelectiveFromDynamicKeys(
  keys: (string | RegExp)[],
  template?: WorldbookEntry['strategy'],
): WorldbookEntry['strategy'] {
  return {
    type: 'selective',
    keys: keys.length > 0 ? keys : ['微信'],
    keys_secondary: template?.keys_secondary ?? { logic: 'and_any', keys: [] },
    scan_depth: template?.scan_depth ?? 'same_as_global',
  };
}

function mergeWbSyncPointerIntoChatVars(
  vars: Record<string, unknown>,
  dotPath: string,
  scopeKey: string,
  contactId: string,
  lastMsgId: string | null,
): Record<string, unknown> {
  const next = JSON.parse(JSON.stringify(vars)) as Record<string, unknown>;
  const parts = dotPath.split('.').filter(Boolean);
  if (parts.length === 0) {
    return next;
  }
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const ex = cur[key];
    if (ex == null || typeof ex !== 'object' || Array.isArray(ex)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1];
  const root =
    cur[leaf] != null && typeof cur[leaf] === 'object' && !Array.isArray(cur[leaf])
      ? (cur[leaf] as Record<string, unknown>)
      : {};
  cur[leaf] = root;
  const byScope =
    root[scopeKey] != null && typeof root[scopeKey] === 'object' && !Array.isArray(root[scopeKey])
      ? (root[scopeKey] as Record<string, unknown>)
      : {};
  root[scopeKey] = byScope;
  const prev =
    byScope[contactId] != null && typeof byScope[contactId] === 'object' && !Array.isArray(byScope[contactId])
      ? (byScope[contactId] as Record<string, unknown>)
      : {};
  byScope[contactId] = { ...prev, lastMsgId };
  return next;
}

function getWbSyncLastMsgIdFromChatVars(
  vars: Record<string, unknown>,
  dotPath: string,
  scopeKey: string,
  contactId: string,
): string | null {
  try {
    const node = getByPath(vars, dotPath) as Record<string, unknown> | undefined;
    if (!node || typeof node !== 'object') {
      return null;
    }
    const sc = node[scopeKey] as Record<string, unknown> | undefined;
    if (!sc || typeof sc !== 'object') {
      return null;
    }
    const c = sc[contactId] as Record<string, unknown> | undefined;
    if (!c || typeof c !== 'object') {
      return null;
    }
    const raw = c.lastMsgId;
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      return raw.trim() === '' ? null : raw;
    }
    return null;
  } catch {
    return null;
  }
}

function sliceNewWeChatMessages(messages: WbExportedMsg[], lastMsgId: string | null): WbExportedMsg[] {
  if (!lastMsgId) {
    return messages;
  }
  const idx = messages.findIndex(m => m.id === lastMsgId);
  if (idx < 0) {
    return messages;
  }
  return messages.slice(idx + 1);
}

function groupMessagesByDate(msgs: WbExportedMsg[]): Map<string, WbExportedMsg[]> {
  const groups = new Map<string, WbExportedMsg[]>();
  for (const m of msgs) {
    const dateStr = new Date(m.time).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    if (!groups.has(dateStr)) {
      groups.set(dateStr, []);
    }
    groups.get(dateStr)!.push(m);
  }
  return groups;
}

/**
 * 按用户指定格式生成世界书条目内容块：
 * 更新时间: MM月DD日 HH:mm
 * 私聊对象: 联系人名
 * ---
 * 【MM月DD日】
 * [HH:mm] 玩家: 内容
 * [HH:mm] 联系人名: 内容
 * ...
 */
function formatWeChatWorldbookBlock(displayName: string, msgs: WbExportedMsg[]): string {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts: string[] = [];
  parts.push(`更新时间: ${timeStr}`);
  parts.push(`私聊对象: ${displayName}`);
  parts.push('---');

  const groups = groupMessagesByDate(msgs);
  for (const [dateStr, dayMsgs] of groups) {
    const dateLine = dateStr.replace(/^(\d{4})\/(\d{2})\/(\d{2})$/, (_m, y, mo, d) => `${mo}月${d}日`);
    parts.push(`【${dateLine}】`);
    for (const m of dayMsgs) {
      const t = new Date(m.time);
      const timeLabel = t.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      // 玩家消息使用"玩家"，AI 消息使用联系人显示名
      const who = m.role === 'user' ? '玩家' : displayName;
      parts.push(`[${timeLabel}] ${who}: ${m.content}`);
    }
  }

  return '\n' + parts.join('\n');
}

function sanitizeWorldbookEntryName(s: string): string {
  const t = s.replace(/[\r\n]+/g, ' ').trim();
  return t.length > 180 ? `${t.slice(0, 177)}…` : t;
}

/** 将角色分析 updates 格式化为世界书正文（与手动条目风格一致） */
function formatCharacterAnalysisWorldbookContent(updates: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push('基本信息：');
  if (updates['姓名'] != null) lines.push(`姓名：${String(updates['姓名'])}`);
  if (updates['性别'] != null) lines.push(`性别：${String(updates['性别'])}`);
  if (updates['年龄'] != null) lines.push(`年龄：${String(updates['年龄'])}`);
  if (updates['职业'] != null) lines.push(`职业：${String(updates['职业'])}`);
  if (updates['外貌'] != null) lines.push(`外貌：${String(updates['外貌'])}`);
  if (updates['外貌细节'] != null) lines.push(`外貌细节：${String(updates['外貌细节'])}`);

  const 性格 = updates['性格'];
  if (性格 && typeof 性格 === 'object' && !Array.isArray(性格)) {
    const p = 性格 as Record<string, string>;
    lines.push('');
    lines.push('性格特点：');
    if (p['表面性格']) lines.push(`表面：${p['表面性格']}`);
    if (p['内在性格']) lines.push(`内在：${p['内在性格']}`);
    if (p['特殊性格标签']) lines.push(`标签：${p['特殊性格标签']}`);
  }

  const 性癖 = updates['性癖'];
  if (性癖 && typeof 性癖 === 'object' && !Array.isArray(性癖)) {
    lines.push('');
    lines.push('性癖：');
    for (const [name, raw] of Object.entries(性癖 as Record<string, Record<string, unknown>>)) {
      lines.push(`「${name}」`);
      if (raw && typeof raw === 'object') {
        if (raw['等级'] != null) lines.push(`  等级：${String(raw['等级'])}`);
        if (raw['细节描述'] != null) lines.push(`  细节：${String(raw['细节描述'])}`);
        if (raw['自我合理化'] != null) lines.push(`  自我合理化：${String(raw['自我合理化'])}`);
      }
    }
  }

  const 敏感部位 = updates['敏感部位'];
  if (敏感部位 && typeof 敏感部位 === 'object' && !Array.isArray(敏感部位)) {
    lines.push('');
    lines.push('敏感部位：');
    for (const [name, raw] of Object.entries(敏感部位 as Record<string, Record<string, unknown>>)) {
      lines.push(`「${name}」`);
      if (raw && typeof raw === 'object') {
        if (raw['敏感等级'] != null) lines.push(`  敏感等级：${String(raw['敏感等级'])}`);
        if (raw['生理反应'] != null) lines.push(`  生理反应：${String(raw['生理反应'])}`);
        if (raw['开发细节'] != null) lines.push(`  开发细节：${String(raw['开发细节'])}`);
      }
    }
  }

  if (updates['背景故事'] != null) {
    lines.push('');
    lines.push(`背景故事：${String(updates['背景故事'])}`);
  }

  const 兴趣爱好 = updates['兴趣爱好'];
  if (Array.isArray(兴趣爱好) && 兴趣爱好.length > 0) {
    lines.push('');
    lines.push(`兴趣爱好：${兴趣爱好.map(x => String(x)).join('、')}`);
  }
  const 生活习惯 = updates['生活习惯'];
  if (Array.isArray(生活习惯) && 生活习惯.length > 0) {
    lines.push(`生活习惯：${生活习惯.map(x => String(x)).join('、')}`);
  }

  if (updates['说话风格'] != null) {
    lines.push('');
    lines.push(`说话风格：${String(updates['说话风格'])}`);
  }

  const 日常 = updates['日常对话示例'];
  if (Array.isArray(日常) && 日常.length > 0) {
    lines.push('');
    lines.push('日常对话示例：');
    日常.forEach((ex, i) => lines.push(`${i + 1}. ${String(ex)}`));
  }

  // 不写世界书：当前内心想法 / 当前综合生理描述 / 数值（与 MVU 实时状态重复，易干扰长档案）

  const 身份标签 = updates['身份标签'];
  if (身份标签 && typeof 身份标签 === 'object' && !Array.isArray(身份标签)) {
    lines.push('');
    lines.push('身份标签：');
    for (const [k, v] of Object.entries(身份标签 as Record<string, string>)) {
      lines.push(`  ${k}：${String(v)}`);
    }
  }

  return lines.join('\n');
}

/**
 * 将角色分析结果写入与微信同步相同规则的世界书（phone_wechat_wb_sync / chatScopeId）
 */
async function syncCharacterAnalysisToWorldbook(
  characterId: string,
  updates: Record<string, unknown>,
  options?: {
    position?: string;
    priority?: number;
    keywords?: string;
    preventRecursion?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const chatScopeId = getChatScopeId() ?? 'local-offline';
    const scopeTrim = chatScopeId.trim() || 'local-offline';
    const cfg = getWbSyncScriptCfg();
    let worldbookName: string | null = null;
    if (cfg) {
      worldbookName = resolveWorldbookNameForWbSync(cfg, scopeTrim);
    } else {
      if (scopeTrim && scopeTrim !== 'local-offline') {
        worldbookName = scopeTrim;
      } else {
        try {
          const w = getCharWorldbookNames('current');
          worldbookName = w?.primary?.trim() || w?.additional?.[0]?.trim() || null;
        } catch {
          worldbookName = null;
        }
      }
    }
    if (!worldbookName) {
      return {
        ok: false,
        error: '无法确定世界书名：请启用 phone_wechat_wb_sync 或保证 chatScopeId / 角色卡主世界书可用',
      };
    }

    const wbResult = await ensureWorldbookForSync(worldbookName);
    if (!wbResult) {
      return { ok: false, error: '创建或读取世界书失败' };
    }
    const { template } = wbResult;
    const characterName =
      typeof updates['姓名'] === 'string' && updates['姓名'].trim() ? updates['姓名'].trim() : characterId;

    const identityType = (updates['身份标签'] as Record<string, string> | undefined)?.['类型'];
    const isDynamicsReport = identityType === '动态报告';
    const isCharacterList = identityType === '角色列表';

    let entryName: string;
    let content: string;

    if (isCharacterList) {
      entryName = '【角色列表】';
      content = typeof updates['当前内心想法'] === 'string' ? updates['当前内心想法'] : '';
    } else if (isDynamicsReport) {
      entryName = sanitizeWorldbookEntryName(`【${characterName}】动态报告`);
      content = typeof updates['当前内心想法'] === 'string' ? updates['当前内心想法'] : '';
    } else {
      entryName = sanitizeWorldbookEntryName(`【${characterName}】角色档案`);
      content = formatCharacterAnalysisWorldbookContent(updates);
    }

    // 角色列表使用蓝灯（constant，无关键词），其他使用 selective
    let strat: WorldbookEntry['strategy'];
    if (isCharacterList) {
      // 蓝灯：constant 类型，无关键词，恒定插入
      strat = {
        type: 'constant',
        keys: [],
        keys_secondary: template.strategy.keys_secondary ?? { logic: 'and_any', keys: [] },
        scan_depth: 'same_as_global',
      };
    } else {
      // 绿灯：selective 类型，有关键词
      const selectiveKeys: (string | RegExp)[] = [];
      if (options?.keywords) {
        const kwList = options.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
        kwList.forEach(k => selectiveKeys.push(k));
      }
      if (selectiveKeys.length === 0) {
        if (characterName) selectiveKeys.push(characterName);
        if (characterId && characterId !== characterName) selectiveKeys.push(characterId);
      }
      strat = {
        type: 'selective',
        keys: selectiveKeys.length > 0 ? selectiveKeys : ['角色档案'],
        keys_secondary: template.strategy.keys_secondary ?? { logic: 'and_any', keys: [] },
        scan_depth: 'same_as_global',
      };
    }

    // 位置：角色列表和角色档案都是角色定义前（蓝灯位置）
    // 只有动态报告是角色定义后（绿灯）
    const posType: WorldbookEntry['position']['type'] = isDynamicsReport
      ? 'after_character_definition'
      : 'before_character_definition';
    const position: WorldbookEntry['position'] = {
      type: posType,
      role: 'system',
      depth: 4,
      order: options?.priority ?? 100,
    };

    const rec = options?.preventRecursion !== false
      ? wbSyncRecursionClosed()
      : (template.recursion ?? wbSyncRecursionClosed());

    // 先读取当前世界书，检查是否已有该角色条目
    let existingEntries: WorldbookEntry[] = [];
    try {
      existingEntries = await getWorldbook(worldbookName);
    } catch {
      existingEntries = [];
    }

    // 角色列表使用固定 entryName 查找，其他使用 characterId extra 字段查找
    const existingIdx = isCharacterList
      ? existingEntries.findIndex(e => e.name === entryName)
      : existingEntries.findIndex(
          e =>
            e.name === entryName ||
            ((e.extra as Record<string, unknown> | undefined)?.tavernPhoneCharacterId === characterId),
        );

    const baseExtra = isCharacterList
      ? { tavernPhoneCharacterList: true }
      : { tavernPhoneCharacterId: characterId };

    if (existingIdx >= 0) {
      const existingEntry = existingEntries[existingIdx];
      await updateWorldbookWith(
        worldbookName,
        entries => {
          const next = [...entries];
          const idx = next.findIndex(e => e.uid === existingEntry.uid);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              name: entryName,
              content,
              enabled: true,
              strategy: strat,
              position,
              probability: next[idx].probability ?? 100,
              recursion: rec,
              effect: next[idx].effect ?? template.effect,
              extra: { ...((next[idx].extra as Record<string, unknown>) || {}), ...baseExtra },
            };
          }
          return next;
        },
        { render: 'immediate' },
      );
    } else {
      const newEntry: PartialDeep<WorldbookEntry> = {
        name: entryName,
        content,
        enabled: true,
        strategy: strat,
        position,
        probability: 100,
        recursion: rec,
        effect: template.effect,
        extra: baseExtra,
      };
      await createWorldbookEntries(worldbookName, [newEntry], { render: 'immediate' });
    }

    console.info('[tavern-phone] ✅ 角色分析已写入世界书', worldbookName, entryName);
    return { ok: true };
  } catch (err) {
    console.warn('[tavern-phone] syncCharacterAnalysisToWorldbook 失败:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function buildWeChatContext(): Promise<{
  chatScopeId: string | null;
  characterName: string | null;
  displayName: string;
  personality: string;
  thought: string;
  contacts: WeChatContactOut[];
  /** 酒馆当前角色卡头像（data URL），与角色管理一致；供微信「我」等在本地未自定义时回退 */
  currentCharacterAvatarUrl?: string;
  recentStorySnippet: string;
  roleStorySummaries: Record<string, string>;
  openAiDefaults: { apiBaseUrl: string | null; model: string | null };
}> {
  const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
  const defaultMap: Record<string, string> = {
    personality: '性格',
    thought: '心理想法',
    name: '',
  };
  const custom =
    typeof scriptVars.phone_wechat_field_map === 'object' && scriptVars.phone_wechat_field_map !== null
      ? (scriptVars.phone_wechat_field_map as Record<string, string>)
      : {};
  const map: Record<string, string> = { ...defaultMap, ...custom };
  let charVars: Record<string, unknown> = {};
  let msgVars: Record<string, unknown> = {};
  try {
    charVars = getVariables({ type: 'character' }) as Record<string, unknown>;
  } catch {
    /* 无角色卡 */
  }
  try {
    msgVars = getVariables({ type: 'message', message_id: 'latest' }) as Record<string, unknown>;
  } catch {
    /* 无楼层 */
  }
  const nameField = pickWeChatField(map, 'name', charVars, msgVars);
  const cardName = getCurrentCharacterName();
  const displayName = (nameField && nameField.trim()) || cardName || '未命名角色';
  const contactsRaw = buildWeChatContacts(displayName);
  const [contacts, currentAv] = await Promise.all([
    enrichContactsWithStAvatars(contactsRaw),
    resolveCharacterAvatarDataUrl('current'),
  ]);
  const rawBase = scriptVars.phone_openai_api_base;
  const rawModel = scriptVars.phone_openai_model;
  const apiBaseFromScript = typeof rawBase === 'string' && rawBase.trim() ? rawBase.trim() : null;
  const modelFromScript = typeof rawModel === 'string' && rawModel.trim() ? rawModel.trim() : null;
  return {
    chatScopeId: getChatScopeId(),
    characterName: cardName,
    displayName,
    personality: pickWeChatField(map, 'personality', charVars, msgVars),
    thought: pickWeChatField(map, 'thought', charVars, msgVars),
    contacts,
    ...(currentAv ? { currentCharacterAvatarUrl: currentAv } : {}),
    recentStorySnippet: buildRecentStorySnippet(),
    roleStorySummaries: buildRoleStorySummaries(),
    openAiDefaults: { apiBaseUrl: apiBaseFromScript, model: modelFromScript },
  };
}

function getPhoneUiUrl(): string {
  try {
    const raw = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
    const u = raw.phone_ui_url ?? raw.tavern_phone_ui_url;
    if (typeof u === 'string' && u.trim()) {
      return u.trim();
    }
  } catch {
    /* 忽略 */
  }
  return '';
}

function mountTavernPhoneApi(api: TavernPhoneApi) {
  window.parent.TavernPhone = api;
}

function unmountTavernPhoneApi() {
  try {
    delete window.parent.TavernPhone;
  } catch {
    /* 忽略 */
  }
}

$(() => {
  let phoneUiUrl = getPhoneUiUrl();
  console.info('[tavern-phone] 📱 脚本启动', {
    phone_ui_url: phoneUiUrl ?? '(未配置)',
    worldbook_sync_enabled: getWbSyncScriptCfg() !== null,
  });

  let $overlay: JQuery | null = null;
  let $phoneRoot: JQuery | null = null;
  let $iframe: JQuery<HTMLIFrameElement> | null = null;
  let isOpen = false;
  let messageHandler: ((e: MessageEvent) => Promise<void>) | null = null;
  let resizeHandler: (() => void) | null = null;
  /** 与 buildDom 里绑定 resize 的窗口一致，便于 removeDom 卸载 */
  let resizeTargetWindow: Window | null = null;
  let visualViewportRef: VisualViewport | null = null;
  let chatScopeListener: EventOnReturn | null = null;
  let wbSyncListener: EventOnReturn | null = null;
  let worldbookMatchListener: EventOnReturn | null = null;
  /** 拖动手机相对屏幕中心的偏移（px） */
  let phoneDragOffsetX = 0;
  let phoneDragOffsetY = 0;
  let phoneDragListenersBound = false;
  const PHONE_DRAG_NS = 'tavernPhoneDrag';
  /** 由 resolvePhoneUiSrc 创建的 blob: URL，须在更换 URL 或卸载 DOM 时 revoke */
  let phoneUiBlobUrl: string | null = null;
  /** 壳内镜像：跨端口 iframe 无法共享 localStorage，由 postMessage 同步 */
  const characterAvatarMirror: Record<string, string> = {};
  let characterAvatarRelayHandler: ((e: MessageEvent) => void) | null = null;

  function revokePhoneUiBlob(): void {
    if (phoneUiBlobUrl) {
      URL.revokeObjectURL(phoneUiBlobUrl);
      phoneUiBlobUrl = null;
    }
  }

  /** 这些来源上的 index.html 常被标成 text/plain，需 fetch + blob 修正 */
  function shouldProbePhoneUiMime(url: string): boolean {
    try {
      const { hostname, pathname } = new URL(url);
      if (hostname === 'raw.githubusercontent.com') {
        return true;
      }
      if (hostname.endsWith('jsdelivr.net') && pathname.includes('/gh/')) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** 不用正则：打包器曾把含 `/` 的正则压坏，导致永远不进入 blob 分支 */
  function looksLikeHtmlDocument(text: string): boolean {
    const t = text.trimStart();
    const head = t.slice(0, 32).toLowerCase();
    return head.startsWith('<!doctype') || head.startsWith('<html');
  }

  /** 将 Vite 产物的 ./assets/... 改为基于页面 URL 的绝对地址，便于 blob: 文档加载子资源 */
  function rewritePhoneHtmlAssetRefs(html: string, pageUrl: string): string {
    const baseHref = new URL('./', pageUrl).href;
    return html.replace(/\b(src|href)=(["'])(\.\/[^"']+)\2/gi, (_m, attr, q, rel) => {
      const abs = new URL(rel as string, baseHref).href;
      return `${attr}=${q}${abs}${q}`;
    });
  }

  /**
   * 返回 iframe 可用的 src：对 jsDelivr/gh、raw GitHub 等在 text/plain 下返回 blob:；否则返回原始 URL。
   */
  async function resolvePhoneUiSrc(url: string): Promise<string> {
    if (!shouldProbePhoneUiMime(url)) {
      return url;
    }
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      const ct = (res.headers.get('content-type') ?? '').toLowerCase();
      const text = await res.text();
      if (!looksLikeHtmlDocument(text)) {
        return url;
      }
      const plainButHtml = ct.includes('text/plain') || !ct.includes('text/html');
      if (!plainButHtml) {
        return url;
      }
      const rewritten = rewritePhoneHtmlAssetRefs(text, url);
      revokePhoneUiBlob();
      phoneUiBlobUrl = URL.createObjectURL(new Blob([rewritten], { type: 'text/html;charset=utf-8' }));
      console.info('[tavern-phone] 已对 phone_ui_url 使用 blob:text/html（修正 CDN 将 index.html 标为 text/plain）');
      return phoneUiBlobUrl;
    } catch (e) {
      console.warn('[tavern-phone] phone_ui_url fetch 失败，回退直连（可能仍为黑屏）', e);
      return url;
    }
  }

  function ensureChatScopeListener() {
    if (chatScopeListener) {
      return;
    }
    chatScopeListener = eventOn(tavern_events.CHAT_CHANGED, () => {
      if (!isOpen) {
        return;
      }
      postToPhone({ type: MSG.CHAT_SCOPE, chatScopeId: getChatScopeId() });
    });
  }

  /**
   * 遮罩与手机挂在「能看见整页」的窗口 document 上。
   * 脚本常在嵌套 iframe 里：仅用 parent 可能仍是小 iframe；优先 top（同源），再 parent，再自身。
   */
  function getShellDocument(): Document {
    try {
      const topWin = window.top;
      if (topWin && topWin !== window && topWin.document?.body) {
        return topWin.document;
      }
    } catch {
      /* 跨域 top */
    }
    try {
      if (window.parent !== window && window.parent.document?.body) {
        return window.parent.document;
      }
    } catch {
      /* 跨域 parent */
    }
    return document;
  }

  function getShellWindow(): Window {
    return getShellDocument().defaultView ?? window;
  }

  function broadcastCharacterAvatarSyncExceptSource(
    payload: { type: string; roleId: string; avatarUrl: string },
    except: MessageEventSource | null,
  ): void {
    let doc: Document;
    try {
      doc = getShellDocument();
    } catch {
      return;
    }
    const iframes = doc.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      const w = iframes[i].contentWindow;
      if (!w || w === except) {
        continue;
      }
      try {
        w.postMessage(payload, '*');
      } catch {
        /* */
      }
    }
  }

  function injectTextIntoTavernSendBox(text: string): void {
    const t = text.trim();
    if (!t) {
      return;
    }
    const doc = getShellDocument();
    const $ta = $(doc).find('#send_textarea, textarea#send_textarea, #message_input').first();
    if (!$ta.length) {
      throw new Error('未找到主界面输入框（#send_textarea）');
    }
    const el = $ta[0] as HTMLTextAreaElement;
    const cur = el.value.trim();
    el.value = cur ? `${cur}\n\n${t}` : t;
    $ta.trigger('input');
  }

  function createShellDiv(doc: Document): JQuery<HTMLDivElement> {
    const el = doc.createElement('div');
    el.setAttribute('script_id', getScriptId());
    return $(el) as JQuery<HTMLDivElement>;
  }

  function getIframeEl(): HTMLIFrameElement | null {
    return $iframe?.[0] ?? null;
  }

  function applyLayout() {
    if (!$phoneRoot?.length) {
      return;
    }
    const win = getShellWindow();
    const vv = win.visualViewport;
    const vw = vv?.width ?? win.innerWidth;
    const vh = vv?.height ?? win.innerHeight;
    const marginX = 32;
    const marginY = 48;
    const scale = Math.min((vw - marginX) / PHONE_W, (vh - marginY) / PHONE_H, 1);
    const inner = $phoneRoot.find(`[data-tavern-phone="inner"]`);
    inner.css({
      width: `${PHONE_W}px`,
      height: `${PHONE_H}px`,
      transform: `translate(${phoneDragOffsetX}px, ${phoneDragOffsetY}px) scale(${scale})`,
      transformOrigin: 'center center',
    });
    $iframe?.css({
      width: `${PHONE_W}px`,
      height: `${PHONE_H}px`,
    });
    const iw = getIframeEl()?.contentWindow;
    if (iw) {
      try {
        iw.dispatchEvent(new Event('resize'));
      } catch {
        /* ignore */
      }
    }
  }

  function postToPhone(data: { type: string; chatScopeId?: string | null }) {
    const win = getIframeEl()?.contentWindow;
    if (win) {
      win.postMessage(data, '*');
    }
  }

  function teardownPhoneDrag(layoutWin: Window) {
    $phoneRoot?.find('[data-tavern-phone-drag]').off(`.${PHONE_DRAG_NS}`);
    $(layoutWin).off(`.${PHONE_DRAG_NS}`);
    $(layoutWin.document).off(`.${PHONE_DRAG_NS}`);
    phoneDragListenersBound = false;
  }

  /**
   * 在手机左/右/上缘增加透明拖动条（位于 iframe 之上），避免只能点遮罩关闭却无法拖动的问题
   */
  function bindPhoneDragEdges($inner: JQuery, layoutWin: Window) {
    if (phoneDragListenersBound) {
      return;
    }
    phoneDragListenersBound = true;
    const $doc = $(layoutWin.document);
    const $edges = $inner.find('[data-tavern-phone-drag]');

    function onPointerDown(e: JQuery.Event) {
      const pe = e.originalEvent as PointerEvent | undefined;
      if (!pe || pe.button !== 0) {
        return;
      }
      const pid = pe.pointerId;
      const startX = pe.clientX;
      const startY = pe.clientY;
      const origX = phoneDragOffsetX;
      const origY = phoneDragOffsetY;
      const el = e.currentTarget as HTMLElement;
      try {
        el.setPointerCapture(pid);
      } catch {
        /* */
      }

      function move(ev: PointerEvent) {
        if (ev.pointerId !== pid) {
          return;
        }
        phoneDragOffsetX = origX + (ev.clientX - startX);
        phoneDragOffsetY = origY + (ev.clientY - startY);
        applyLayout();
      }

      function up(ev: PointerEvent) {
        if (ev.pointerId !== pid) {
          return;
        }
        try {
          el.releasePointerCapture(pid);
        } catch {
          /* */
        }
        layoutWin.removeEventListener('pointermove', move);
        layoutWin.removeEventListener('pointerup', up);
        layoutWin.removeEventListener('pointercancel', up);
      }

      layoutWin.addEventListener('pointermove', move, { passive: false });
      layoutWin.addEventListener('pointerup', up);
      layoutWin.addEventListener('pointercancel', up);
      e.preventDefault();
      e.stopPropagation();
    }

    $edges.on(`pointerdown.${PHONE_DRAG_NS}`, onPointerDown);

    /** 无 PointerEvent 时回退到 mouse 事件 */
    $edges.on(`mousedown.${PHONE_DRAG_NS}`, function (e: JQuery.Event) {
      if (typeof window.PointerEvent !== 'undefined') {
        return;
      }
      const me = e.originalEvent as MouseEvent;
      if (me.button !== 0) {
        return;
      }
      const startX = me.clientX;
      const startY = me.clientY;
      const origX = phoneDragOffsetX;
      const origY = phoneDragOffsetY;

      function move(ev: MouseEvent) {
        phoneDragOffsetX = origX + (ev.clientX - startX);
        phoneDragOffsetY = origY + (ev.clientY - startY);
        applyLayout();
      }

      function up() {
        $doc.off(`mousemove.${PHONE_DRAG_NS}`, move);
        $doc.off(`mouseup.${PHONE_DRAG_NS}`, up);
      }

      $doc.on(`mousemove.${PHONE_DRAG_NS}`, move);
      $doc.on(`mouseup.${PHONE_DRAG_NS}`, up);
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function removeDom() {
    revokePhoneUiBlob();
    if (resizeTargetWindow) {
      teardownPhoneDrag(resizeTargetWindow);
    }
    $overlay?.remove();
    $overlay = null;
    $phoneRoot = null;
    $iframe = null;
    if (resizeHandler) {
      if (visualViewportRef) {
        visualViewportRef.removeEventListener('resize', resizeHandler);
        visualViewportRef.removeEventListener('scroll', resizeHandler);
        visualViewportRef = null;
      }
      if (resizeTargetWindow) {
        $(resizeTargetWindow).off('resize', resizeHandler);
      }
      resizeHandler = null;
      resizeTargetWindow = null;
    }
  }

  function buildDom() {
    if ($phoneRoot?.length) {
      return;
    }

    const parentDoc = getShellDocument();
    const $mount = $(parentDoc.body);

    $overlay = createShellDiv(parentDoc)
      .attr('data-tavern-phone', 'overlay')
      .css({
        position: 'fixed',
        inset: '0',
        zIndex: Z_OVERLAY,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'none',
        pointerEvents: 'auto',
      })
      .appendTo($mount);

    $phoneRoot = createShellDiv(parentDoc)
      .attr('data-tavern-phone', 'root')
      .css({
        position: 'fixed',
        inset: '0',
        boxSizing: 'border-box',
        display: 'none',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_PHONE,
        pointerEvents: 'none',
        margin: 0,
        padding: 0,
      })
      .appendTo($mount);

    const $inner = createShellDiv(parentDoc)
      .attr('data-tavern-phone', 'inner')
      .css({
        position: 'relative',
        flexShrink: 0,
        borderRadius: '40px',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.32)',
        background: 'transparent',
        pointerEvents: 'auto',
      });

    const edgeCommon = {
      position: 'absolute' as const,
      zIndex: 10,
      touchAction: 'none' as const,
      cursor: 'grab' as const,
      background: 'transparent',
      userSelect: 'none' as const,
    };

    const $dragLeft = createShellDiv(parentDoc)
      .attr('data-tavern-phone-drag', 'edge')
      .css({
        ...edgeCommon,
        left: 0,
        top: 0,
        bottom: 0,
        width: 22,
      });

    const $dragRight = createShellDiv(parentDoc)
      .attr('data-tavern-phone-drag', 'edge')
      .css({
        ...edgeCommon,
        right: 0,
        top: 0,
        bottom: 0,
        width: 22,
      });

    const $dragTop = createShellDiv(parentDoc)
      .attr('data-tavern-phone-drag', 'edge')
      .css({
        ...edgeCommon,
        left: 0,
        right: 0,
        top: 0,
        height: 28,
      });

    const iframeEl = parentDoc.createElement('iframe');
    iframeEl.title = 'Tavern Phone';
    iframeEl.setAttribute('frameborder', '0');
    iframeEl.setAttribute('allow', 'clipboard-read; clipboard-write');
    $iframe = $(iframeEl).css({
      display: 'block',
      position: 'relative',
      zIndex: 1,
      width: PHONE_W + 'px',
      height: PHONE_H + 'px',
      border: 'none',
      background: '#000',
    }) as JQuery<HTMLIFrameElement>;

    $inner.append($iframe);
    $inner.append($dragLeft);
    $inner.append($dragRight);
    $inner.append($dragTop);

    $phoneRoot.append($inner);

    $overlay.on('click', () => {
      close();
    });

    $phoneRoot.on('click', e => {
      e.stopPropagation();
    });

    $iframe.on('load', () => {
      postToPhone({ type: MSG.OPENED });
      postToPhone({ type: MSG.CHAT_SCOPE, chatScopeId: getChatScopeId() });
      const w = getIframeEl()?.contentWindow;
      if (w) {
        for (const [roleId, avatarUrl] of Object.entries(characterAvatarMirror)) {
          try {
            w.postMessage({ type: PHONE_CHARACTER_AVATAR_SYNC_TYPE, roleId, avatarUrl }, '*');
          } catch {
            /* */
          }
        }
      }
    });

    const layoutWin = getShellWindow();
    resizeTargetWindow = layoutWin;
    resizeHandler = () => {
      if (isOpen) {
        applyLayout();
      }
    };
    $(layoutWin).on('resize', resizeHandler);
    const vv = layoutWin.visualViewport;
    if (vv) {
      visualViewportRef = vv;
      vv.addEventListener('resize', resizeHandler);
      vv.addEventListener('scroll', resizeHandler);
    }

    bindPhoneDragEdges($inner, layoutWin);

    applyLayout();
  }

  async function setIframeSrc(): Promise<void> {
    phoneUiUrl = getPhoneUiUrl();
    const el = getIframeEl();
    if (!el || !phoneUiUrl) {
      return;
    }
    const resolved = await resolvePhoneUiSrc(phoneUiUrl);
    if (el.src !== resolved) {
      el.src = resolved;
    }
  }

  messageHandler = async (e: MessageEvent) => {
    if (e.source !== getIframeEl()?.contentWindow) {
      return;
    }
    const t = e.data?.type;
    if (t === MSG.REQUEST_CONTEXT) {
      const requestId = e.data?.requestId;
      if (typeof requestId !== 'string') {
        return;
      }
      void (async () => {
        try {
          const payload = await buildWeChatContext();
          getIframeEl()?.contentWindow?.postMessage({ type: MSG.CONTEXT, requestId, payload }, '*');
        } catch (err) {
          getIframeEl()?.contentWindow?.postMessage(
            { type: MSG.CONTEXT, requestId, error: err instanceof Error ? err.message : String(err) },
            '*',
          );
        }
      })();
      return;
    }
    if (t === MSG.REQUEST_ROLE_ARCHIVE) {
      const requestId = e.data?.requestId;
      if (typeof requestId !== 'string') {
        return;
      }
      void (async () => {
        try {
          const raw = buildRoleArchiveCandidates();
          const contacts = await enrichContactsWithStAvatars(raw);
          getIframeEl()?.contentWindow?.postMessage({ type: MSG.ROLE_ARCHIVE, requestId, contacts }, '*');
        } catch (err) {
          getIframeEl()?.contentWindow?.postMessage(
            {
              type: MSG.ROLE_ARCHIVE,
              requestId,
              contacts: [] as WeChatContactOut[],
              error: err instanceof Error ? err.message : String(err),
            },
            '*',
          );
        }
      })();
      return;
    }
    if (t === MSG.REQUEST_INJECT_TO_INPUT) {
      const requestId = e.data?.requestId;
      const text = e.data?.text;
      if (typeof requestId !== 'string' || typeof text !== 'string') {
        return;
      }
      try {
        injectTextIntoTavernSendBox(text);
        getIframeEl()?.contentWindow?.postMessage({ type: MSG.INJECT_TO_INPUT_RESULT, requestId, ok: true }, '*');
      } catch (err) {
        getIframeEl()?.contentWindow?.postMessage(
          {
            type: MSG.INJECT_TO_INPUT_RESULT,
            requestId,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          '*',
        );
      }
      return;
    }
    if (t === MSG.REQUEST_WRITE_PHONE_MEMORY) {
      const requestId = e.data?.requestId;
      const contactId = e.data?.contactId;
      const chatScopeIdRaw = e.data?.chatScopeId;
      const summary = e.data?.summary;
      if (typeof requestId !== 'string' || typeof contactId !== 'string' || typeof summary !== 'string') {
        return;
      }
      try {
        const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
        const basePath =
          typeof scriptVars.phone_wechat_memory_path === 'string' && scriptVars.phone_wechat_memory_path.trim()
            ? scriptVars.phone_wechat_memory_path.trim()
            : 'stat_data.手机微信记忆';
        const scopeKey = typeof chatScopeIdRaw === 'string' && chatScopeIdRaw.trim() ? chatScopeIdRaw.trim() : 'local-offline';
        updateVariablesWith(
          vars =>
            mergePhoneMemoryIntoChatVars(vars as Record<string, unknown>, basePath, scopeKey, contactId, summary),
          { type: 'chat' },
        );
        getIframeEl()?.contentWindow?.postMessage({ type: MSG.WRITE_PHONE_MEMORY_RESULT, requestId, ok: true }, '*');
        void mirrorPhoneSummaryToWorldbookIfConfigured(summary).catch(() => {
          /* 世界书镜像为可选，失败不打扰用户 */
        });
      } catch (err) {
        getIframeEl()?.contentWindow?.postMessage(
          {
            type: MSG.WRITE_PHONE_MEMORY_RESULT,
            requestId,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          '*',
        );
      }
      return;
    }
    if (t === MSG.REQUEST_TRIGGER_WB_SYNC) {
      console.info('[tavern-phone][wb-sync] 📡 收到主动触发同步请求（REQUEST_TRIGGER_WB_SYNC）');
      void runWeChatWorldbookSyncOnGenerate().catch(e => {
        console.warn('[tavern-phone] 主动触发世界书同步失败', e);
      });
      return;
    }
    if (t === MSG.REQUEST_TRIGGER_GAME_STORY_SYNC) {
      console.info('[tavern-phone][game-story] 📡 收到规则 App 剧情摘要同步请求（REQUEST_TRIGGER_GAME_STORY_SYNC）');
      // 通知父窗口（规则 App iframe）触发剧情摘要同步
      window.parent.postMessage(
        {
          type: MSG.GAME_STORY_WB_SYNC_TRIGGERED,
          payload: {},
        },
        '*',
      );
      return;
    }
    if (t === MSG.REQUEST_CHARACTER_ARCHIVE) {
      console.info('[tavern-phone] 📡 收到角色档案请求（REQUEST_CHARACTER_ARCHIVE）');
      const reqData = e.data as { requestId?: string };
      const requestId = reqData.requestId;
      if (!requestId) return;
      const source = e.source as Window | null;
      if (!source) return;
      try {
        await waitGlobalInitialized('Mvu');
        const mvuData = (Mvu as Record<string, (...args: unknown[]) => unknown>).getMvuData({ type: 'message', message_id: 'latest' });
        const rawArchive = (mvuData as Record<string, unknown>)?.stat_data?.角色档案;
        const 角色档案Plain =
          rawArchive != null && typeof rawArchive === 'object' && !Array.isArray(rawArchive)
            ? (rawArchive as Record<string, unknown>)
            : {};
        const 角色档案 = await enrichRoleArchiveDictWithStAvatars(角色档案Plain);
        source.postMessage(
          { type: MSG.CHARACTER_ARCHIVE_RESPONSE, requestId, payload: { 角色档案 } },
          '*',
        );
      } catch (err) {
        console.warn('[tavern-phone] 读取角色档案失败:', err);
        source.postMessage(
          { type: MSG.CHARACTER_ARCHIVE_RESPONSE, requestId, payload: { 角色档案: {} } },
          '*',
        );
      }
      return;
    }
    if (t === MSG.REQUEST_WRITE_CHARACTER_ANALYSIS) {
      console.info('[tavern-phone] 📡 收到角色分析结果写回请求（REQUEST_WRITE_CHARACTER_ANALYSIS）');
      const reqData = e.data as { requestId?: string; characterId?: string; updates?: Record<string, unknown> };
      const { requestId, characterId, updates } = reqData;
      const source = e.source as Window | null;
      if (!requestId || !characterId || !updates) {
        source?.postMessage(
          { type: MSG.WRITE_CHARACTER_ANALYSIS_RESULT, requestId, ok: false, error: '缺少必要参数' },
          '*',
        );
        return;
      }
      try {
        await waitGlobalInitialized('Mvu');
        const mvuData = (Mvu as Record<string, (...args: unknown[]) => unknown>).getMvuData({ type: 'message', message_id: 'latest' });
        const statData = ((mvuData as Record<string, unknown>)?.stat_data as Record<string, unknown>) || {};
        const 角色档案 = (statData['角色档案'] as Record<string, Record<string, unknown>>) || {};

        if (!角色档案[characterId]) {
          source?.postMessage(
            { type: MSG.WRITE_CHARACTER_ANALYSIS_RESULT, requestId, ok: false, error: '未找到该角色档案' },
            '*',
          );
          return;
        }

        const charData = 角色档案[characterId];

        // 基础信息
        if (updates['姓名'] !== undefined) {
          charData['姓名'] = updates['姓名'];
        }
        if (updates['性别'] !== undefined) {
          charData['性别'] = updates['性别'];
        }
        if (updates['年龄'] !== undefined) {
          charData['年龄'] = updates['年龄'];
        }
        if (updates['职业'] !== undefined) {
          charData['职业'] = updates['职业'];
        }
        if (updates['外貌'] !== undefined) {
          charData['外貌'] = updates['外貌'];
        }
        if (updates['外貌细节'] !== undefined) {
          charData['外貌细节'] = updates['外貌细节'];
        }

        // 性格
        if (updates['性格'] !== undefined) {
          charData['性格'] = updates['性格'];
        }

        // 性癖和敏感部位
        if (updates['性癖'] !== undefined) {
          charData['性癖'] = updates['性癖'];
        }
        if (updates['敏感部位'] !== undefined) {
          charData['敏感部位'] = updates['敏感部位'];
        }

        // 背景故事
        if (updates['背景故事'] !== undefined) {
          charData['背景故事'] = updates['背景故事'];
        }

        // 兴趣爱好
        if (updates['兴趣爱好'] !== undefined) {
          charData['兴趣爱好'] = updates['兴趣爱好'];
        }

        // 生活习惯
        if (updates['生活习惯'] !== undefined) {
          charData['生活习惯'] = updates['生活习惯'];
        }

        // 说话风格
        if (updates['说话风格'] !== undefined) {
          charData['说话风格'] = updates['说话风格'];
        }
        if (updates['日常对话示例'] !== undefined) {
          charData['日常对话示例'] = updates['日常对话示例'];
        }

        // 当前状态
        if (updates['当前内心想法'] !== undefined) {
          charData['当前内心想法'] = updates['当前内心想法'];
        }
        if (updates['当前综合生理描述'] !== undefined) {
          charData['当前综合生理描述'] = updates['当前综合生理描述'];
        }

        // 数值
        if (updates['数值'] !== undefined) {
          charData['数值'] = { ...(charData['数值'] as Record<string, unknown>), ...(updates['数值'] as Record<string, unknown>) };
        }

        // 身份标签
        if (updates['身份标签'] !== undefined) {
          charData['身份标签'] = updates['身份标签'];
        }

        // 使用 replaceMvuData 替换整个数据（异步操作）
        await Mvu.replaceMvuData(mvuData as Mvu.MvuData, { type: 'message', message_id: 'latest' });

        console.info('[tavern-phone] ✅ 角色分析结果已写回 MVU:', characterId);
        source?.postMessage(
          { type: MSG.WRITE_CHARACTER_ANALYSIS_RESULT, requestId, ok: true },
          '*',
        );
      } catch (err) {
        console.warn('[tavern-phone] 写回角色分析结果失败:', err);
        source?.postMessage(
          { type: MSG.WRITE_CHARACTER_ANALYSIS_RESULT, requestId, ok: false, error: String(err) },
          '*',
        );
      }
      return;
    }
    if (t === MSG.REQUEST_SYNC_CHARACTER_TO_WORLDBOOK) {
      console.info('[tavern-phone] 📡 收到角色分析结果同步到世界书请求（REQUEST_SYNC_CHARACTER_TO_WORLDBOOK）');
      const reqData = e.data as {
        requestId?: string;
        characterId?: string;
        updates?: Record<string, unknown>;
        options?: { position?: string; priority?: number; keywords?: string; preventRecursion?: boolean };
      };
      const { requestId, characterId, updates, options } = reqData;
      const source = e.source as Window | null;
      if (!requestId || !characterId || !updates) {
        source?.postMessage(
          { type: MSG.SYNC_CHARACTER_TO_WORLDBOOK_RESULT, requestId, ok: false, error: '缺少必要参数' },
          '*',
        );
        return;
      }
      void (async () => {
        try {
          const result = await syncCharacterAnalysisToWorldbook(characterId, updates, options);
          source?.postMessage(
            { type: MSG.SYNC_CHARACTER_TO_WORLDBOOK_RESULT, requestId, ...result },
            '*',
          );
        } catch (err) {
          source?.postMessage(
            {
              type: MSG.SYNC_CHARACTER_TO_WORLDBOOK_RESULT,
              requestId,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            '*',
          );
        }
      })();
      return;
    }
    // 保存自动分析间隔设置
    if (t === MSG.SAVE_AUTO_ANALYZE_INTERVAL) {
      const interval = e.data?.interval;
      if (typeof interval === 'number' && interval > 0) {
        try {
          const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
          const current = scriptVars.auto_analyze_interval;
          if (current !== interval) {
            replaceVariables({ auto_analyze_interval: interval }, { type: 'script', script_id: getScriptId() });
            console.info(`[tavern-phone] ✅ 已保存自动分析间隔: ${interval} 楼`);
          }
        } catch (err) {
          console.warn('[tavern-phone] 保存自动分析间隔失败:', err);
        }
      }
      return;
    }
    if (t === MSG.REQUEST_CLOSE) {
      close();
    }
  };

  characterAvatarRelayHandler = (e: MessageEvent) => {
    const d = e.data as { type?: string; roleId?: string; avatarUrl?: string } | null;
    if (!d || typeof d !== 'object') {
      return;
    }
    if (d.type === PHONE_CHARACTER_AVATAR_SYNC_TYPE) {
      const roleId = typeof d.roleId === 'string' ? d.roleId.trim() : '';
      if (!roleId) {
        return;
      }
      const avatarUrl = typeof d.avatarUrl === 'string' ? d.avatarUrl.trim() : '';
      if (avatarUrl) {
        characterAvatarMirror[roleId] = avatarUrl;
      } else {
        delete characterAvatarMirror[roleId];
      }
      broadcastCharacterAvatarSyncExceptSource(
        { type: PHONE_CHARACTER_AVATAR_SYNC_TYPE, roleId, avatarUrl },
        e.source,
      );
      return;
    }
    if (d.type === PHONE_CHARACTER_AVATAR_MIRROR_REQUEST) {
      const src = e.source as Window | null;
      if (!src?.postMessage) {
        return;
      }
      for (const [roleId, avatarUrl] of Object.entries(characterAvatarMirror)) {
        try {
          src.postMessage({ type: PHONE_CHARACTER_AVATAR_SYNC_TYPE, roleId, avatarUrl }, '*');
        } catch {
          /* */
        }
      }
    }
  };

  window.parent.addEventListener('message', characterAvatarRelayHandler);
  window.parent.addEventListener('message', messageHandler);

  function open() {
    phoneUiUrl = getPhoneUiUrl();
    if (!phoneUiUrl) {
      toastr.warning('请在本脚本变量中配置 phone_ui_url（手机界面 index.html 的完整 URL，含协议）');
      return;
    }

    buildDom();
    void setIframeSrc().catch(err => {
      console.error('[tavern-phone] 加载手机界面失败', err);
      toastr.error('加载手机界面失败，请检查 phone_ui_url 与网络');
    });

    $overlay?.css('display', 'block');
    $phoneRoot?.css('display', 'flex');
    isOpen = true;
    ensureChatScopeListener();
    applyLayout();
  }

  function close() {
    if (!isOpen) {
      return;
    }
    postToPhone({ type: MSG.CLOSED });
    $overlay?.css('display', 'none');
    $phoneRoot?.css('display', 'none');
    isOpen = false;
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function ensurePhoneIframeBuiltForSync(): void {
    const url = getPhoneUiUrl();
    if (!url) {
      return;
    }
    if (!$phoneRoot?.length) {
      buildDom();
      // 仅当 iframe 不存在时才设置 src
      void setIframeSrc().catch(() => {
        /* 世界书预同步：静默失败 */
      });
    }
    // 如果 iframe 已存在，不要重新加载，直接通过 postMessage 通信
  }

  function requestExportThreadsFromIframe(iframeWin: Window, chatScopeId: string): Promise<WbExportedThread[]> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      // 消息监听器必须挂在 window.parent（SillyTavern 主页面）上，
      // 因为手机 iframe 通过 window.parent.postMessage 向主页面发送消息
      const shellWindow = window.parent;
      const timer = window.setTimeout(() => {
        shellWindow.removeEventListener('message', onMsg);
        console.warn('[tavern-phone] 导出微信线程超时，跳过世界书同步');
        resolve([]);
      }, 8000);
      function onMsg(e: MessageEvent) {
        if (e.source !== iframeWin) {
          return;
        }
        if (e.data?.type !== MSG.EXPORT_THREADS_FOR_WB_RESULT) {
          return;
        }
        if (e.data?.requestId !== requestId) {
          return;
        }
        window.clearTimeout(timer);
        shellWindow.removeEventListener('message', onMsg);
        if (e.data.error) {
          reject(new Error(String(e.data.error)));
          return;
        }
        resolve(Array.isArray(e.data.threads) ? (e.data.threads as WbExportedThread[]) : []);
      }
      shellWindow.addEventListener('message', onMsg);
      iframeWin.postMessage({ type: MSG.REQUEST_EXPORT_THREADS_FOR_WB, requestId, chatScopeId }, '*');
    });
  }

  async function runWeChatWorldbookSyncOnGenerate(): Promise<void> {
    const cfg = getWbSyncScriptCfg();
    if (!cfg) {
      console.info('[tavern-phone][wb-sync] ❌ 跳过：getWbSyncScriptCfg() 返回 null（phone_wechat_wb_sync 未配置或未启用）');
      return;
    }
    if (!getPhoneUiUrl()) {
      console.info('[tavern-phone][wb-sync] ❌ 跳过：getPhoneUiUrl() 为空（phone_ui_url 未配置）');
      return;
    }
    const chatScopeId = getChatScopeId() ?? 'local-offline';
    const scopeKey = chatScopeId.trim() || 'local-offline';
    const worldbookName = resolveWorldbookNameForWbSync(cfg, chatScopeId);
    if (!worldbookName) {
      console.info('[tavern-phone][wb-sync] ❌ 跳过：resolveWorldbookNameForWbSync() 返回 null（chatScopeId 为空且角色卡未绑定世界书）');
      return;
    }
    console.info('[tavern-phone][wb-sync] ✅ 开始同步 → 世界书：', worldbookName, '  chatScopeId：', chatScopeId);
    ensurePhoneIframeBuiltForSync();
    const iframeWin = getIframeEl()?.contentWindow;
    if (!iframeWin) {
      return;
    }
    let threads: WbExportedThread[];
    try {
      threads = await requestExportThreadsFromIframe(iframeWin, chatScopeId);
    } catch (e) {
      console.warn('[tavern-phone] 导出微信线程失败', e);
      return;
    }
    if (threads.length === 0) {
      console.info('[tavern-phone][wb-sync] ❌ 跳过：IndexedDB 中无任何微信线程（threads 为空）');
      return;
    }
    const ctx = await buildWeChatContext();
    const dynamicKeys = buildDynamicSelectiveKeysForWbSync(ctx, cfg);
    const idToName = new Map(ctx.contacts.map(c => [c.id, c.displayName] as const));
    let chatVars = getVariables({ type: 'chat' }) as Record<string, unknown>;
    const pending: Array<{
      contactId: string;
      displayName: string;
      block: string;
      tailId: string | null;
    }> = [];
    for (const th of threads) {
      const displayName = idToName.get(th.roleId) ?? th.roleId;
      const lastId = getWbSyncLastMsgIdFromChatVars(chatVars, cfg.statePath, scopeKey, th.roleId);
      const newMsgs = sliceNewWeChatMessages(th.messages, lastId);
      if (newMsgs.length === 0) {
        continue;
      }
      const block = formatWeChatWorldbookBlock(displayName, newMsgs);
      const tailId = th.messages.length > 0 ? th.messages[th.messages.length - 1].id : null;
      pending.push({ contactId: th.roleId, displayName, block, tailId });
    }
    if (pending.length === 0) {
      console.info('[tavern-phone][wb-sync] ❌ 跳过：各联系人均无新消息（所有线程已同步过）');
      return;
    }
    // 确保世界书存在：不存在则自动创建并激活为全局
    console.info('[tavern-phone][wb-sync] → 调用 ensureWorldbookForSync', worldbookName);
    let wbResult: { template: import('@types/function/worldbook').WorldbookEntry; isNew: boolean } | null = null;
    try {
      wbResult = await ensureWorldbookForSync(worldbookName);
    } catch (e) {
      console.error('[tavern-phone][wb-sync] ❌ ensureWorldbookForSync 抛出异常', e);
      return;
    }
    if (!wbResult) {
      console.error('[tavern-phone][wb-sync] ❌ ensureWorldbookForSync 返回 null（同上，已打印过错误）');
      return;
    }
    if (!wbResult) {
      console.error('[tavern-phone] 无法创建/读取世界书，同步中止', worldbookName);
      return;
    }
    console.info('[tavern-phone][wb-sync] ✅ 世界书存在/已创建，模板条目：', wbResult.template.name);
    const { template } = wbResult;
    const rec = wbSyncRecursionClosed();
    await updateWorldbookWith(
      worldbookName,
      entries => {
        let next = [...entries];
        for (const u of pending) {
          const entryName = sanitizeWorldbookEntryName(`${u.displayName}小手机聊天记录摘要`);
          const idx = next.findIndex(e => e.name === entryName);
            // 聊天记录条目固定蓝灯 + 深度4（不受脚本配置影响）
            const strat = wbStrategyConstantFromTemplate(template.strategy);
            strat.scan_depth = 4;
            if (idx < 0) {
              const neu: PartialDeep<WorldbookEntry> = {
                name: entryName,
                content: u.block,
                enabled: true,
                strategy: strat,
                position: template.position,
                probability: template.probability ?? 100,
                recursion: rec,
                effect: template.effect,
              };
              next.push(neu as WorldbookEntry);
            } else {
              const e = next[idx];
              const cur = typeof e.content === 'string' ? e.content : '';
              next[idx] = {
                ...e,
                content: cur + u.block,
                strategy: strat,
                recursion: rec,
              };
            }
        }
        return next;
      },
      { render: 'immediate' },
    );
    let merged = chatVars;
    for (const u of pending) {
      merged = mergeWbSyncPointerIntoChatVars(merged, cfg.statePath, scopeKey, u.contactId, u.tailId);
    }
    updateVariablesWith(() => merged, { type: 'chat' });
    console.info('[tavern-phone] 已同步微信增量到世界书', worldbookName, pending.map(p => p.displayName).join(', '));
  }

  const api: TavernPhoneApi = {
    version: VERSION,
    get isOpen() {
      return isOpen;
    },
    open,
    close,
    toggle,
    getIframeWindow: () => getIframeEl()?.contentWindow ?? null,
  };

  mountTavernPhoneApi(api);

  // 自动分析全部角色：监听 MESSAGE_RECEIVED 事件
  let lastAnalyzedMessageId = -1;
  let autoAnalyzeListener: ReturnType<typeof eventOn> | null = null;

  const setupAutoAnalyzeListener = () => {
    if (autoAnalyzeListener) {
      autoAnalyzeListener.stop();
      autoAnalyzeListener = null;
    }
    // 读取设置的间隔
    try {
      const scriptVars = getVariables({ type: 'script', script_id: getScriptId() }) as Record<string, unknown>;
      const interval = scriptVars.auto_analyze_interval;
      if (typeof interval === 'number' && interval > 0) {
        autoAnalyzeListener = eventOn(tavern_events.MESSAGE_RECEIVED, (messageId: number) => {
          const lastMsgId = getLastMessageId();
          // 检查是否达到间隔
          if (lastMsgId - lastAnalyzedMessageId >= interval) {
            lastAnalyzedMessageId = lastMsgId;
            console.info(`[tavern-phone] 📡 每 ${interval} 楼自动触发分析全部角色，当前楼层: ${lastMsgId}`);
            // 通知手机 UI 触发分析全部角色
            if (isOpen) {
              const iframeWin = getIframeEl()?.contentWindow;
              if (iframeWin) {
                iframeWin.postMessage({ type: MSG.TRIGGER_AUTO_ANALYZE_ALL }, '*');
              }
            }
          }
        });
        console.info(`[tavern-phone] ✅ 已启用自动分析，间隔: ${interval} 楼`);
      }
    } catch (e) {
      console.warn('[tavern-phone] 读取自动分析间隔失败:', e);
    }
  };

  // 初始化自动分析监听
  setupAutoAnalyzeListener();

  // 监听聊天切换时重置
  if (chatScopeListener) {
    chatScopeListener.stop();
  }
  chatScopeListener = eventOn(tavern_events.CHAT_CHANGED, () => {
    lastAnalyzedMessageId = -1;
    setupAutoAnalyzeListener();
  });

  // 初始化世界书自动匹配（如果启用）
  if (shouldEnableWorldbookMatcher()) {
    if (worldbookMatchListener) {
      worldbookMatchListener.stop();
    }
    worldbookMatchListener = eventOn(tavern_events.CHAT_CHANGED, (chat_file_name: string) => {
      void activateMatchingRuleWorldbook(chat_file_name);
    });

    // 初始执行一次（使用当前聊天文件名）
    const currentChatId = getChatScopeId();
    if (currentChatId) {
      void activateMatchingRuleWorldbook(currentChatId);
    }
  }

  wbSyncListener = eventOn(tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS, () => {
    console.info('[tavern-phone][wb-sync] 📡 收到 GENERATE_BEFORE_COMBINE_PROMPTS，开始同步…');
    void runWeChatWorldbookSyncOnGenerate().catch(e => {
      console.warn('[tavern-phone] 世界书同步失败', e);
    });
  });

  replaceScriptButtons([{ name: '小手机', visible: true }]);
  eventOn(getButtonEvent('小手机'), () => {
    toggle();
  });

  $(window).on('pagehide', () => {
    if (wbSyncListener) {
      wbSyncListener.stop();
      wbSyncListener = null;
    }
    if (chatScopeListener) {
      chatScopeListener.stop();
      chatScopeListener = null;
    }
    if (worldbookMatchListener) {
      worldbookMatchListener.stop();
      worldbookMatchListener = null;
    }
    if (autoAnalyzeListener) {
      autoAnalyzeListener.stop();
      autoAnalyzeListener = null;
    }
    if (characterAvatarRelayHandler) {
      window.parent.removeEventListener('message', characterAvatarRelayHandler);
    }
    characterAvatarRelayHandler = null;
    if (messageHandler) {
      window.parent.removeEventListener('message', messageHandler);
    }
    messageHandler = null;
    close();
    removeDom();
    unmountTavernPhoneApi();
  });
});
