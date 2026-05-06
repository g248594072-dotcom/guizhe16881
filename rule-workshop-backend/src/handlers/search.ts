import type { Env } from '../types';
import type { ContentMetadata, ContentType } from '../models/content';
import { ALL_CONTENT_TYPES, Keys } from '../models/content';
import { readJson, readStringList } from '../utils/kv';
import { badRequest, json } from '../utils/response';

/** GET /api/content/search?q=&type= */
export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  if (!query) return badRequest('Missing q');

  const typeFilter = url.searchParams.get('type');
  const types: ContentType[] =
    typeFilter && ALL_CONTENT_TYPES.includes(typeFilter as ContentType)
      ? [typeFilter as ContentType]
      : ALL_CONTENT_TYPES;

  const results: ContentMetadata[] = [];
  const seen = new Set<string>();

  outer: for (const type of types) {
    const ids = await readStringList(env.KV, Keys.idxStatus(type, 'approved'));
    for (const id of ids) {
      const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
      if (!meta) continue;

      const haystack = [
        meta.name,
        meta.description,
        meta.author,
        ...(meta.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();

      if (haystack.includes(query) || meta.tags.some(t => t.toLowerCase().includes(query))) {
        const key = `${meta.type}:${meta.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(meta);
        }
      }
      if (results.length >= 50) break outer;
    }
  }

  return json({ results });
}
