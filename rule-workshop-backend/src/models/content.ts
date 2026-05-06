/** Supported workshop content kinds */
export type ContentType =
  | 'world-rule'
  | 'regional-rule'
  | 'personal-rule'
  | 'region'
  | 'building'
  | 'character'
  | 'sticker';

export type ContentStatus = 'pending' | 'approved' | 'rejected';

/** Indexed metadata (stored separately from large payloads) */
export interface ContentMetadata {
  id: string;
  type: ContentType;
  name: string;
  description: string;
  author: string;
  authorId: string;
  authorAvatar?: string | null;
  tags: string[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  likes: number;
  previewImageKey?: string;
  /** sha256 hex of JSON-stringified data for integrity checks */
  dataHash: string;
}

export interface ContentFull extends ContentMetadata {
  data: unknown;
}

export const ALL_CONTENT_TYPES: ContentType[] = [
  'world-rule',
  'regional-rule',
  'personal-rule',
  'region',
  'building',
  'character',
  'sticker',
];

/** KV key helpers */
export const Keys = {
  meta: (type: ContentType, id: string) => `meta:${type}:${id}`,
  data: (type: ContentType, id: string) => `data:${type}:${id}`,
  lookupId: (id: string) => `lookup:${id}`,
  idxStatus: (type: ContentType, status: ContentStatus) => `idx:${type}:${status}`,
  author: (discordId: string) => `author:${discordId}`,
  tag: (tag: string) => `tag:${tag}`,
  session: (key: string) => `session:${key}`,
  user: (discordId: string) => `user:${discordId}`,
  timeIdx: (type: ContentType) => `time:${type}`,
  banned: (discordId: string) => `banned:${discordId}`,
  stats: () => `stats:global`,
} as const;
