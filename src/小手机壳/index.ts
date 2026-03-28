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
 */
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

function getChatScopeId(): string | null {
  try {
    const win = window.parent as Window & { SillyTavern?: { getCurrentChatId?: () => string } };
    const id = win.SillyTavern?.getCurrentChatId?.();
    if (id != null && String(id).trim() !== '') {
      return String(id);
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
      return null;
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

/** 未配置 worldbookName 时使用当前角色卡绑定的主世界书（否则 additional[0]） */
function resolveWorldbookNameForWbSync(cfg: WbSyncScriptCfg): string | null {
  if (cfg.worldbookName) {
    return cfg.worldbookName;
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
  console.warn('[tavern-phone] phone_wechat_wb_sync 未指定 worldbookName，且当前角色卡未绑定世界书');
  return null;
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

function formatWeChatWorldbookBlock(displayName: string, msgs: WbExportedMsg[]): string {
  const lines = msgs.map(m => {
    const who = m.role === 'user' ? '用户' : '对方';
    const time = new Date(m.time).toLocaleString('zh-CN');
    return `[${time}] ${who}：${m.content}`;
  });
  const head = `\n\n--- [小手机微信 · ${displayName} · ${new Date().toLocaleString('zh-CN')}] ---\n`;
  return head + lines.join('\n');
}

function sanitizeWorldbookEntryName(s: string): string {
  const t = s.replace(/[\r\n]+/g, ' ').trim();
  return t.length > 180 ? `${t.slice(0, 177)}…` : t;
}

async function buildWeChatContext(): Promise<{
  chatScopeId: string | null;
  characterName: string | null;
  displayName: string;
  personality: string;
  thought: string;
  contacts: WeChatContactOut[];
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
  const contacts = await enrichContactsWithStAvatars(contactsRaw);
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

  let $overlay: JQuery | null = null;
  let $phoneRoot: JQuery | null = null;
  let $iframe: JQuery<HTMLIFrameElement> | null = null;
  let isOpen = false;
  let messageHandler: ((e: MessageEvent) => void) | null = null;
  let resizeHandler: (() => void) | null = null;
  /** 与 buildDom 里绑定 resize 的窗口一致，便于 removeDom 卸载 */
  let resizeTargetWindow: Window | null = null;
  let visualViewportRef: VisualViewport | null = null;
  let chatScopeListener: EventOnReturn | null = null;
  let wbSyncListener: EventOnReturn | null = null;
  /** 拖动手机相对屏幕中心的偏移（px） */
  let phoneDragOffsetX = 0;
  let phoneDragOffsetY = 0;
  let phoneDragListenersBound = false;
  const PHONE_DRAG_NS = 'tavernPhoneDrag';

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

  function setIframeSrc() {
    phoneUiUrl = getPhoneUiUrl();
    const el = getIframeEl();
    if (!el || !phoneUiUrl) {
      return;
    }
    if (el.src !== phoneUiUrl) {
      el.src = phoneUiUrl;
    }
  }

  messageHandler = (e: MessageEvent) => {
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
    if (t === MSG.REQUEST_CLOSE) {
      close();
    }
  };
  window.parent.addEventListener('message', messageHandler);

  function open() {
    phoneUiUrl = getPhoneUiUrl();
    if (!phoneUiUrl) {
      toastr.warning('请在本脚本变量中配置 phone_ui_url（手机界面 index.html 的完整 URL，含协议）');
      return;
    }

    buildDom();
    setIframeSrc();

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
    }
    setIframeSrc();
  }

  function requestExportThreadsFromIframe(iframeWin: Window, chatScopeId: string): Promise<WbExportedThread[]> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', onMsg);
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
        window.removeEventListener('message', onMsg);
        if (e.data.error) {
          reject(new Error(String(e.data.error)));
          return;
        }
        resolve(Array.isArray(e.data.threads) ? (e.data.threads as WbExportedThread[]) : []);
      }
      window.addEventListener('message', onMsg);
      iframeWin.postMessage({ type: MSG.REQUEST_EXPORT_THREADS_FOR_WB, requestId, chatScopeId }, '*');
    });
  }

  async function runWeChatWorldbookSyncOnGenerate(): Promise<void> {
    const cfg = getWbSyncScriptCfg();
    if (!cfg) {
      return;
    }
    if (!getPhoneUiUrl()) {
      return;
    }
    const worldbookName = resolveWorldbookNameForWbSync(cfg);
    if (!worldbookName) {
      return;
    }
    ensurePhoneIframeBuiltForSync();
    const iframeWin = getIframeEl()?.contentWindow;
    if (!iframeWin) {
      return;
    }
    const chatScopeId = getChatScopeId() ?? 'local-offline';
    const scopeKey = chatScopeId.trim() || 'local-offline';
    let threads: WbExportedThread[];
    try {
      threads = await requestExportThreadsFromIframe(iframeWin, chatScopeId);
    } catch (e) {
      console.warn('[tavern-phone] 导出微信线程失败', e);
      return;
    }
    if (threads.length === 0) {
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
      return;
    }
    let wb: WorldbookEntry[];
    try {
      wb = await getWorldbook(worldbookName);
    } catch (e) {
      console.warn('[tavern-phone] 读取世界书失败（请确认名称存在）', worldbookName, e);
      return;
    }
    if (wb.length === 0) {
      console.warn('[tavern-phone] 世界书无条目或不存在，请先创建该世界书', worldbookName);
      return;
    }
    const template = wb[0];
    const rec = wbSyncRecursionClosed();
    await updateWorldbookWith(
      worldbookName,
      entries => {
        let next = [...entries];
        for (const u of pending) {
          const entryName = sanitizeWorldbookEntryName(`${u.displayName}小手机聊天记录摘要`);
          const idx = next.findIndex(e => e.name === entryName);
          const strat =
            cfg.strategy === 'constant'
              ? wbStrategyConstantFromTemplate(template.strategy)
              : wbStrategySelectiveFromDynamicKeys(dynamicKeys, template.strategy);
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

  wbSyncListener = eventOn(tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS, () => {
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
    if (messageHandler) {
      window.parent.removeEventListener('message', messageHandler);
    }
    messageHandler = null;
    close();
    removeDom();
    unmountTavernPhoneApi();
  });
});
