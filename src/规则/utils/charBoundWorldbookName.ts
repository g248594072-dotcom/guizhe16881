/**
 * 当前角色卡绑定的主世界书名称（独立文件，供 worldLife 与 apiSettings 共用，避免循环依赖）
 */

declare const SillyTavern: { getCharacterInfo?: () => { worldbook_name?: string } };
declare function getVariables(opts: { type: 'character' }): { worldbook_name?: string } | null | undefined;

export function getCharBoundWorldbookName(): string {
  try {
    const charInfo = SillyTavern.getCharacterInfo?.();
    if (charInfo?.worldbook_name) {
      return String(charInfo.worldbook_name).trim();
    }
    const vars = getVariables({ type: 'character' });
    if (vars?.worldbook_name) {
      return String(vars.worldbook_name).trim();
    }
    return '规则系统';
  } catch (error) {
    console.warn('⚠️ [charBoundWorldbookName] 获取世界书名称失败，使用默认值:', error);
    return '规则系统';
  }
}
