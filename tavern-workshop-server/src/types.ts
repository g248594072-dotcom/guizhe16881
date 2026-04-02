export type WorkshopItemType = 'rule' | 'character' | 'scene' | 'openingScene' | 'preset';
export type WorkshopItemStatus = 'pending' | 'approved' | 'rejected';

export interface WorkshopItem {
  id: string;
  type: WorkshopItemType;
  content: any;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  status: WorkshopItemStatus;
  reject_reason?: string;
  created_at: number;
  downloads: number;
}

export interface DiscordUser {
  id: string;
  username: string;
  avatar?: string;
  discriminator?: string;
}

export interface AuthRequest extends Request {
  user?: DiscordUser;
}
