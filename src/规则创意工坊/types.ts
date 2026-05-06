/** 与 rule-workshop-backend `ContentType` 对齐 */
export type WorkshopContentType =
  | 'world-rule'
  | 'regional-rule'
  | 'personal-rule'
  | 'region'
  | 'building'
  | 'character';

export interface ContentMetadata {
  id: string;
  type: WorkshopContentType;
  name: string;
  description: string;
  author: string;
  authorId: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  likes: number;
}

export const WORKSHOP_TYPE_LABELS: Record<WorkshopContentType, string> = {
  'world-rule': '世界规则',
  'regional-rule': '区域规则',
  'personal-rule': '个人规则',
  region: '区域',
  building: '建筑',
  character: '角色',
};

export const ALL_WORKSHOP_TYPES = Object.keys(WORKSHOP_TYPE_LABELS) as WorkshopContentType[];
