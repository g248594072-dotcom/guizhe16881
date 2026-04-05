/**
 * 角色关系验证系统
 * 基于角色档案的 identityTags 字段判断角色之间的关系
 */

import type { Moment, MomentVisibility } from './types/moments';
import type { PhoneCharacterArchive } from './characterArchive/bridge';

/** 解析关系字符串
 * 例如 "前后桌/同学" -> { type: '同学', details: '前后桌' }
 */
export function parseRelationship(relationshipStr: string): {
  type: string;
  details: string;
} {
  const str = String(relationshipStr || '');
  if (!str) {
    return { type: '', details: '' };
  }
  const parts = str.split('/');
  if (parts.length >= 2) {
    return {
      type: String(parts[parts.length - 1] || '').trim(), // 最后一个是关系类型
      details: parts.slice(0, -1).join('/').trim(), // 前面的是细节
    };
  }
  return {
    type: str.trim(),
    details: '',
  };
}

/** 从角色档案中提取所有关系类型 */
export function extractRelationshipsFromArchive(
  archive: PhoneCharacterArchive
): Array<{ type: string; details: string; rawValue: string }> {
  const relationships: Array<{ type: string; details: string; rawValue: string }> = [];

  for (const [key, value] of Object.entries(archive?.identityTags || {})) {
    if (key === '关系' || key.includes('关系') || key.includes('身份')) {
      // 确保 value 是字符串
      const strValue = typeof value === 'string' ? value : String(value || '');
      if (!strValue.trim()) continue;
      const parsed = parseRelationship(strValue);
      relationships.push({
        ...parsed,
        rawValue: strValue,
      });
    }
  }

  return relationships;
}

/** 检查两个角色是否认识
 * 基于 identityTags 中的关系字段双向验证
 */
export function areCharactersConnected(
  char1Id: string,
  char2Id: string,
  char1Archive: PhoneCharacterArchive,
  char2Archive: PhoneCharacterArchive
): boolean {
  if (!char1Archive || !char2Archive) return false;

  const char1Name = String(char1Archive.name || '');
  const char2Name = String(char2Archive.name || '');

  // 获取角色1的所有关系
  const char1Relationships = extractRelationshipsFromArchive(char1Archive);

  // 获取角色2的所有关系
  const char2Relationships = extractRelationshipsFromArchive(char2Archive);

  // 检查角色1的关系中是否提到角色2（通过名字匹配，简单实现）
  const char1KnowsChar2 = char1Relationships.some(r =>
    (char2Name && (r.rawValue.includes(char2Name) || r.details.includes(char2Name)))
  );

  // 检查角色2的关系中是否提到角色1
  const char2KnowsChar1 = char2Relationships.some(r =>
    (char1Name && (r.rawValue.includes(char1Name) || r.details.includes(char1Name)))
  );

  // 双向认识才算真正认识
  return char1KnowsChar2 || char2KnowsChar1;
}

/** 获取两个角色之间的关系类型
 * 返回关系类型：同学/同事/家人/恋人/朋友等
 */
export function getRelationshipBetween(
  char1Archive: PhoneCharacterArchive,
  char2Archive: PhoneCharacterArchive
): string | null {
  if (!char1Archive || !char2Archive) return null;

  const char2Name = String(char2Archive.name || '');
  if (!char2Name) return null;

  // 获取角色1的所有关系
  const char1Relationships = extractRelationshipsFromArchive(char1Archive);

  // 查找包含角色2名字的关系
  const found = char1Relationships.find(r =>
    r.rawValue.includes(char2Name) || r.details.includes(char2Name)
  );

  return found?.type || null;
}

/** 检查某角色是否有权查看某动态
 * @param viewerId - 查看者角色ID（当 isMainCharacter 为 true 时，此参数可为空或特殊值）
 * @param moment - 动态对象
 * @param allArchives - 所有角色档案
 * @param isMainCharacter - 是否主角（玩家视角），主角有特权看到 main_character 类型的动态
 * @param currentViewerArchive - 当前查看者的档案（用于关系验证）
 */
export function canViewMoment(
  viewerId: string | null,
  moment: Moment,
  allArchives: PhoneCharacterArchive[],
  isMainCharacter: boolean = true,
  currentViewerArchive?: PhoneCharacterArchive
): boolean {
  const { visibility, characterId: authorId } = moment;

  // 1. 公开内容 -> 所有人可见
  if (visibility === 'public') {
    return true;
  }

  // 2. 仅本人可见 (main_character) ->
  //    - 主角（玩家）总是可以看到（特权视角）
  //    - 作者本人可以看到（这是角色自己发的"仅本人可见"朋友圈）
  //    - 其他角色看不到
  if (visibility === 'main_character') {
    if (isMainCharacter) {
      return true; // 主角特权
    }
    if (viewerId === authorId) {
      return true; // 作者本人
    }
    return false;
  }

  // 3. 好友可见 (friends_only) -> 检查查看者和作者的关系
  if (visibility === 'friends_only') {
    if (isMainCharacter) {
      return true; // 主角可以看到所有好友可见内容
    }

    if (!viewerId || !currentViewerArchive) {
      return false;
    }

    // 自己可以看到自己的动态
    if (viewerId === authorId) {
      return true;
    }

    // 查找作者档案
    const authorArchive = allArchives.find(a => a.id === authorId);
    if (!authorArchive) {
      return false;
    }

    // 检查两者是否认识
    return areCharactersConnected(viewerId, authorId, currentViewerArchive, authorArchive);
  }

  return false;
}

/** 检查某角色是否有权评论某动态
 * 评论权限规则：
 * 1. 仅本人可见的动态：只有作者自己可以评论（其他角色根本不知道这条动态存在）
 * 2. 好友可见的动态：只有与作者认识的角色可以评论
 * 3. 主角（玩家）可以评论任何动态（特权）
 */
export function canCommentOnMoment(
  commenterId: string,
  moment: Moment,
  allArchives: PhoneCharacterArchive[],
  isMainCharacter: boolean = false,
  commenterArchive?: PhoneCharacterArchive
): boolean {
  const { visibility, characterId: authorId } = moment;

  // 主角（玩家）特权：可以评论任何动态
  if (isMainCharacter) {
    return true;
  }

  // 仅本人可见的动态：只有作者自己可以评论
  if (visibility === 'main_character') {
    return commenterId === authorId;
  }

  // 公开或好友可见：评论者必须和作者认识
  if (visibility === 'public' || visibility === 'friends_only') {
    // 自己可以评论自己的动态
    if (commenterId === authorId) {
      return true;
    }

    if (!commenterArchive) {
      return false;
    }

    // 查找作者档案
    const authorArchive = allArchives.find(a => a.id === authorId);
    if (!authorArchive) {
      return false;
    }

    // 检查两者是否认识
    return areCharactersConnected(commenterId, authorId, commenterArchive, authorArchive);
  }

  return false;
}

/** 获取可见性标签的显示文本 */
export function getVisibilityLabel(visibility: MomentVisibility): string {
  switch (visibility) {
    case 'public':
      return '公开';
    case 'friends_only':
      return '好友可见';
    case 'main_character':
      return '仅本人可见';
    default:
      return '';
  }
}

/** 获取内容类型的显示文本 */
export function getContentTypeLabel(contentType: import('./types/moments').MomentContentType): string {
  switch (contentType) {
    case 'daily_life':
      return '日常';
    case 'dark_thought':
      return '内心独白';
    case 'venting':
      return '吐槽';
    case 'location_checkin':
      return '定位';
    default:
      return '';
  }
}
