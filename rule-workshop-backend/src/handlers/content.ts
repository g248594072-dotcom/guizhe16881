import type { Env, JwtPayload } from '../types';
import type { ContentMetadata, ContentFull, ContentStatus, ContentType } from '../models/content';
import { ALL_CONTENT_TYPES, Keys } from '../models/content';
import { getJwtFromRequest, requireAuth } from '../middleware/auth';
import {
  addToAuthorIndex,
  addToStatusIndex,
  addToTagIndex,
  addToTimeIndex,
  findMetaById,
  generateContentId,
  readJson,
  readStringList,
  removeContentEverywhere,
  sha256Hex,
  updateTagIndexes,
} from '../utils/kv';
import { badRequest, forbidden, json, notFound } from '../utils/response';

function isValidType(t: string): t is ContentType {
  return ALL_CONTENT_TYPES.includes(t as ContentType);
}

export async function handleListContent(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const typeParam = url.searchParams.get('type');
  if (!typeParam || !isValidType(typeParam)) {
    return badRequest('Invalid or missing type');
  }
  const type = typeParam as ContentType;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
  const sort = url.searchParams.get('sort') ?? 'newest';
  const status = (url.searchParams.get('status') ?? 'approved') as ContentStatus;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return badRequest('Invalid status');
  }

  let ids = await readStringList(env.KV, Keys.idxStatus(type, status));

  const metas: ContentMetadata[] = [];
  for (const id of ids) {
    const m = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
    if (m) metas.push(m);
  }

  if (sort === 'newest') {
    metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === 'downloads') {
    metas.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
  } else if (sort === 'popular') {
    metas.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  }

  const total = metas.length;
  const start = (page - 1) * pageSize;
  const slice = metas.slice(start, start + pageSize);

  return json({
    items: slice,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/** GET /api/content/get/:type/:id */
export async function handleGetContent(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // ['api','content','get',type,id]
  const type = parts[3];
  const id = parts[4];
  if (!type || !id || !isValidType(type)) return badRequest('Invalid path');

  const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type as ContentType, id));
  if (!meta) return notFound('Content not found');

  const jwt = await getJwtFromRequest(request, env);

  if (meta.status !== 'approved') {
    const ok =
      jwt &&
      (jwt.sub === meta.authorId || jwt.isAdmin);
    if (!ok) return forbidden('Not authorized to view this content');
  }

  const dataRaw = await env.KV.get(Keys.data(type as ContentType, id));
  const data = dataRaw ? JSON.parse(dataRaw) : null;

  const full: ContentFull = { ...meta, data };
  return json({ content: full });
}

/** POST /api/content/create */
export async function handleCreateContent(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const user = auth as JwtPayload;

  if (!user.inGuild) {
    return forbidden('You must be in the configured Discord server to upload');
  }

  const banned = await env.KV.get(Keys.banned(user.sub));
  if (banned) return forbidden('Account is banned');

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const type = body.type as string;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const data = body.data;
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string').map(t => t.trim())
    : [];

  if (!isValidType(type)) return badRequest('Invalid type');
  const contentType = type as ContentType;
  if (!name) return badRequest('Missing name');
  if (data === undefined) return badRequest('Missing data');

  const id = generateContentId(contentType);
  const dataStr = JSON.stringify(data);
  const hash = await sha256Hex(dataStr);
  const now = new Date().toISOString();

  const displayAuthor = user.displayName ?? user.username ?? 'user';

  // 检查是否开启自动审核（与 PUT 值容错：trim + 大小写）
  const raw = ((await env.KV.get('settings:autoApprove')) ?? '').trim().toLowerCase();
  const initialStatus = raw === 'true' ? 'approved' : 'pending';

  const meta: ContentMetadata = {
    id,
    type: contentType,
    name,
    description,
    author: displayAuthor,
    authorId: user.sub,
    authorAvatar: user.avatar ?? null,
    tags,
    status: initialStatus,
    createdAt: now,
    updatedAt: now,
    downloads: 0,
    likes: 0,
    dataHash: hash,
  };

  await env.KV.put(Keys.meta(contentType, id), JSON.stringify(meta));
  await env.KV.put(Keys.data(contentType, id), dataStr);
  await env.KV.put(Keys.lookupId(id), contentType);

  await addToStatusIndex(env.KV, contentType, initialStatus, id);
  await addToAuthorIndex(env.KV, user.sub, id);
  if (initialStatus === 'approved') {
    await addToTimeIndex(env.KV, contentType, id);
  }
  for (const tag of tags) {
    if (tag) await addToTagIndex(env.KV, tag, id);
  }

  return json({
    success: true,
    id,
    status: meta.status,
    message: initialStatus === 'approved' ? 'Published (auto-approved)' : 'Submitted for review',
  });
}

/** PUT /api/content/update/:id */
export async function handleUpdateContent(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const user = auth as JwtPayload;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  if (!id) return badRequest('Missing id');

  const found = await findMetaById(env.KV, id);
  if (!found) return notFound('Content not found');

  const { meta, type } = found;
  if (meta.authorId !== user.sub && !user.isAdmin) {
    return forbidden('Not authorized');
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : meta.name;
  const description = typeof body.description === 'string' ? body.description.trim() : meta.description;
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string').map(t => t.trim())
    : meta.tags;
  const data = body.data !== undefined ? body.data : undefined;

  const oldTags = meta.tags;
  meta.name = name;
  meta.description = description;
  meta.tags = tags;
  meta.updatedAt = new Date().toISOString();

  if (data !== undefined) {
    const dataStr = JSON.stringify(data);
    meta.dataHash = await sha256Hex(dataStr);
    await env.KV.put(Keys.data(type, id), dataStr);
  }

  await env.KV.put(Keys.meta(type, id), JSON.stringify(meta));
  await updateTagIndexes(env.KV, oldTags, tags, id);

  return json({ success: true, id });
}

/** DELETE /api/content/delete/:id */
export async function handleDeleteContent(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const user = auth as JwtPayload;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  if (!id) return badRequest('Missing id');

  const found = await findMetaById(env.KV, id);
  if (!found) return notFound('Content not found');

  const { meta, type } = found;
  if (meta.authorId !== user.sub && !user.isAdmin) {
    return forbidden('Not authorized');
  }

  await removeContentEverywhere(env.KV, meta);
  return json({ success: true });
}

/** POST /api/content/download/:id — increment download counter (optional auth) */
export async function handleTrackDownload(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  if (!id) return badRequest('Missing id');

  const found = await findMetaById(env.KV, id);
  if (!found) return notFound('Content not found');

  const { meta, type } = found;
  if (meta.status !== 'approved') {
    return forbidden('Content not available');
  }

  meta.downloads = (meta.downloads ?? 0) + 1;
  meta.updatedAt = new Date().toISOString();
  await env.KV.put(Keys.meta(type, id), JSON.stringify(meta));

  return json({ success: true, downloads: meta.downloads });
}

/** GET /api/stats */
export async function handleStats(_request: Request, env: Env): Promise<Response> {
  const stats: Record<string, number> = {};
  let total = 0;
  for (const type of ALL_CONTENT_TYPES) {
    const approved = await readStringList(env.KV, Keys.idxStatus(type, 'approved'));
    stats[type] = approved.length;
    total += approved.length;
  }
  return json({ stats, total });
}

/** GET /api/user/me */
export async function handleMe(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const u = auth as JwtPayload;
  return json({
    user: {
      id: u.sub,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      inGuild: u.inGuild,
      isAdmin: u.isAdmin,
    },
  });
}

/** POST /api/content/like/:id */
export async function handleLikeContent(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const user = auth as JwtPayload;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  if (!id) return badRequest('Missing id');

  // Find content by id across all types
  let meta: ContentMetadata | null = null;
  let type: ContentType | null = null;
  for (const t of ALL_CONTENT_TYPES) {
    const m = await readJson<ContentMetadata>(env.KV, Keys.meta(t, id));
    if (m) {
      meta = m;
      type = t;
      break;
    }
  }
  if (!meta || !type) return notFound('Content not found');

  const likeKey = `like:${user.sub}:${id}`;
  const alreadyLiked = await env.KV.get(likeKey);
  if (alreadyLiked) {
    return json({ likes: meta.likes, already: true });
  }

  // Record like and increment count
  await env.KV.put(likeKey, '1', { expirationTtl: 60 * 60 * 24 * 365 });
  meta.likes = (meta.likes || 0) + 1;
  await env.KV.put(Keys.meta(type, id), JSON.stringify(meta));

  return json({ likes: meta.likes, liked: true });
}

/** POST /api/content/unlike/:id */
export async function handleUnlikeContent(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const user = auth as JwtPayload;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  if (!id) return badRequest('Missing id');

  // Find content by id across all types
  let meta: ContentMetadata | null = null;
  let type: ContentType | null = null;
  for (const t of ALL_CONTENT_TYPES) {
    const m = await readJson<ContentMetadata>(env.KV, Keys.meta(t, id));
    if (m) {
      meta = m;
      type = t;
      break;
    }
  }
  if (!meta || !type) return notFound('Content not found');

  const likeKey = `like:${user.sub}:${id}`;
  const alreadyLiked = await env.KV.get(likeKey);
  if (!alreadyLiked) {
    return json({ likes: meta.likes, already: false });
  }

  // Remove like and decrement count
  await env.KV.delete(likeKey);
  meta.likes = Math.max(0, (meta.likes || 0) - 1);
  await env.KV.put(Keys.meta(type, id), JSON.stringify(meta));

  return json({ likes: meta.likes, unliked: true });
}

/** GET /api/user/my-content */
export async function handleMyContent(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const user = auth as JwtPayload;

  const items: ContentMetadata[] = [];
  for (const type of ALL_CONTENT_TYPES) {
    // Scan all approved content for this user
    const approvedIds = await readStringList(env.KV, Keys.idxStatus(type, 'approved'));
    for (const id of approvedIds) {
      const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
      if (meta && meta.authorId === user.sub) {
        items.push(meta);
      }
    }
    // Scan pending content
    const pendingIds = await readStringList(env.KV, Keys.idxStatus(type, 'pending'));
    for (const id of pendingIds) {
      const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
      if (meta && meta.authorId === user.sub) {
        items.push(meta);
      }
    }
    // Scan rejected content
    const rejectedIds = await readStringList(env.KV, Keys.idxStatus(type, 'rejected'));
    for (const id of rejectedIds) {
      const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
      if (meta && meta.authorId === user.sub) {
        items.push(meta);
      }
    }
  }

  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return json({ items });
}

/** GET /api/content/recommended */
export async function handleRecommended(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  // Collect all approved content
  const items: ContentMetadata[] = [];
  for (const type of ALL_CONTENT_TYPES) {
    const ids = await readStringList(env.KV, Keys.idxStatus(type, 'approved'));
    for (const id of ids) {
      const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
      if (meta) items.push(meta);
    }
  }

  // Sort by combined engagement (likes + downloads), then updatedAt
  items.sort((a, b) => {
    const score = (m: ContentMetadata) => (m.likes || 0) + (m.downloads || 0);
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const limited = items.slice(0, limit);
  return json({ items: limited, total: items.length });
}
