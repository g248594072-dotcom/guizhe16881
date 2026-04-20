/**
 * 地图「快速参加活动」：写入规则界面输入框的固定句式。
 */
export function formatQuickJoinActivityLine(regionName: string, buildingName: string, activityName: string): string {
  const rn = (regionName ?? '').trim() || '某区域';
  const bn = (buildingName ?? '').trim() || '建筑';
  const an = (activityName ?? '').trim() || '活动';
  return `前往${rn}的${bn}参加${an}`;
}
