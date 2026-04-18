/**
 * 当前角色卡绑定的主世界书名称（独立文件，供 worldLife 与 apiSettings 共用，避免循环依赖）
 *
 * 优先使用酒馆助手 {@link getCharWorldbookNames}（与角色卡界面「绑定世界书」一致），
 * 再回退到 `getCharacterInfo` / 角色卡变量；不再使用不存在的默认名「规则系统」。
 */

declare const SillyTavern: { getCharacterInfo?: () => { worldbook_name?: string } };
declare function getVariables(opts: { type: 'character' }): { worldbook_name?: string } | null | undefined;

export function getCharBoundWorldbookName(): string {
  try {
    const { primary, additional } = getCharWorldbookNames('current');
    const primaryTrim = primary != null ? String(primary).trim() : '';
    if (primaryTrim) return primaryTrim;
    const firstAdd = Array.isArray(additional)
      ? additional.map(n => String(n ?? '').trim()).find(Boolean)
      : '';
    if (firstAdd) return firstAdd;
  } catch (error) {
    console.warn('⚠️ [charBoundWorldbookName] getCharWorldbookNames 失败:', error);
  }

  try {
    const charInfo = SillyTavern.getCharacterInfo?.();
    if (charInfo?.worldbook_name) {
      return String(charInfo.worldbook_name).trim();
    }
    const vars = getVariables({ type: 'character' });
    if (vars?.worldbook_name) {
      return String(vars.worldbook_name).trim();
    }
  } catch (error) {
    console.warn('⚠️ [charBoundWorldbookName] 备用来源失败:', error);
  }

  return '';
}
