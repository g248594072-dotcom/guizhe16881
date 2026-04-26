/**
 * 招募「复制到对话框」时：在 `<UpdateVariable>` 块前后拼接固定提示与按选中 CHR 编号生成的尾句。
 * 后缀模板中 `{IDS}` 会被替换为空格分隔的 `CHR-001 CHR-002`…（与选人顺序一致）。
 */

export function applyRecruitVariableCopyWrap(
  middleBlock: string,
  newChrIds: readonly string[],
  opts: { prefix: string; suffixTemplate: string },
): string {
  const ids = [...newChrIds].filter(Boolean).join(' ');
  const p = String(opts.prefix ?? '').replace(/\r\n/g, '\n');
  const sufTmpl = String(opts.suffixTemplate ?? '').replace(/\r\n/g, '\n');
  const suffix = sufTmpl.replace(/\{IDS\}/g, ids);
  const mid = String(middleBlock ?? '').trim();
  const pieces: string[] = [];
  if (p.trim()) pieces.push(p.trim());
  if (mid) pieces.push(mid);
  if (suffix.trim()) pieces.push(suffix.trim());
  return pieces.join('\n\n');
}
