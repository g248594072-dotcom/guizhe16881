import type { ContentMetadata, ContentStatus, ContentType } from '../models/content';
import { ALL_CONTENT_TYPES, Keys } from '../models/content';

export async function readJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readStringList(kv: KVNamespace, key: string): Promise<string[]> {
  const raw = await kv.get(key);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as string[]).filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function writeStringList(kv: KVNamespace, key: string, ids: string[]): Promise<void> {
  await kv.put(key, JSON.stringify(ids));
}

/** Append id to list if missing */
export async function listAdd(kv: KVNamespace, key: string, id: string): Promise<void> {
  const cur = await readStringList(kv, key);
  if (cur.includes(id)) return;
  cur.unshift(id);
  await writeStringList(kv, key, cur);
}

export async function listRemove(kv: KVNamespace, key: string, id: string): Promise<void> {
  const cur = await readStringList(kv, key);
  await writeStringList(
    kv,
    key,
    cur.filter(x => x !== id),
  );
}

export async function addToStatusIndex(
  kv: KVNamespace,
  type: ContentType,
  status: ContentStatus,
  id: string,
): Promise<void> {
  await listAdd(kv, Keys.idxStatus(type, status), id);
}

export async function removeFromStatusIndex(
  kv: KVNamespace,
  type: ContentType,
  status: ContentStatus,
  id: string,
): Promise<void> {
  await listRemove(kv, Keys.idxStatus(type, status), id);
}

export async function addToAuthorIndex(kv: KVNamespace, authorId: string, id: string): Promise<void> {
  await listAdd(kv, Keys.author(authorId), id);
}

export async function removeFromAuthorIndex(kv: KVNamespace, authorId: string, id: string): Promise<void> {
  await listRemove(kv, Keys.author(authorId), id);
}

export async function addToTagIndex(kv: KVNamespace, tag: string, id: string): Promise<void> {
  const key = Keys.tag(tag.trim().toLowerCase());
  await listAdd(kv, key, id);
}

export async function removeFromTagIndex(kv: KVNamespace, tag: string, id: string): Promise<void> {
  const key = Keys.tag(tag.trim().toLowerCase());
  await listRemove(kv, key, id);
}

/** Time index: newest first (prepend) */
export async function addToTimeIndex(kv: KVNamespace, type: ContentType, id: string): Promise<void> {
  await listAdd(kv, Keys.timeIdx(type), id);
}

export async function removeFromTimeIndex(kv: KVNamespace, type: ContentType, id: string): Promise<void> {
  await listRemove(kv, Keys.timeIdx(type), id);
}

export async function updateTagIndexes(
  kv: KVNamespace,
  oldTags: string[] | undefined,
  newTags: string[] | undefined,
  id: string,
): Promise<void> {
  const oldSet = new Set((oldTags ?? []).map(t => t.trim().toLowerCase()).filter(Boolean));
  const newSet = new Set((newTags ?? []).map(t => t.trim().toLowerCase()).filter(Boolean));
  for (const t of oldSet) {
    if (!newSet.has(t)) await removeFromTagIndex(kv, t, id);
  }
  for (const t of newSet) {
    if (!oldSet.has(t)) await addToTagIndex(kv, t, id);
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Generate unique id */
export function generateContentId(type: ContentType): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const prefix = type.replace(/-/g, '');
  return `${prefix}_${Date.now()}_${rand}`;
}

/** Find content type by id using lookup key */
export async function lookupContentType(kv: KVNamespace, id: string): Promise<ContentType | null> {
  const t = await kv.get(Keys.lookupId(id));
  if (!t) return null;
  return t as ContentType;
}

export async function findMetaById(
  kv: KVNamespace,
  id: string,
): Promise<{ meta: ContentMetadata; type: ContentType } | null> {
  const fromLookup = await lookupContentType(kv, id);
  if (fromLookup) {
    const meta = await readJson<ContentMetadata>(kv, Keys.meta(fromLookup, id));
    if (meta) return { meta, type: fromLookup };
  }
  for (const type of ALL_CONTENT_TYPES) {
    const meta = await readJson<ContentMetadata>(kv, Keys.meta(type, id));
    if (meta) return { meta, type };
  }
  return null;
}

export async function removeContentEverywhere(
  kv: KVNamespace,
  meta: ContentMetadata,
): Promise<void> {
  const { id, type, authorId, status, tags } = meta;
  await kv.delete(Keys.meta(type, id));
  await kv.delete(Keys.data(type, id));
  await kv.delete(Keys.lookupId(id));
  await removeFromStatusIndex(kv, type, status, id);
  await removeFromAuthorIndex(kv, authorId, id);
  await removeFromTimeIndex(kv, type, id);
  for (const tag of tags ?? []) {
    await removeFromTagIndex(kv, tag, id);
  }
}
