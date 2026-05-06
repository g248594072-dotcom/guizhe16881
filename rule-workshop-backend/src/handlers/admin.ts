import type { Env } from '../types';
import type { ContentMetadata, ContentStatus, ContentType } from '../models/content';
import { ALL_CONTENT_TYPES, Keys } from '../models/content';
import { requireAdmin } from '../middleware/auth';
import { BUILTIN_SEEDS } from '../seed';
import {
  addToAuthorIndex,
  addToStatusIndex,
  addToTagIndex,
  addToTimeIndex,
  findMetaById,
  readJson,
  readStringList,
  removeContentEverywhere,
  removeFromStatusIndex,
  removeFromTimeIndex,
  sha256Hex,
} from '../utils/kv';
import { badRequest, json, notFound } from '../utils/response';

/** GET /api/admin/pending */
export async function handleAdminPending(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const pending: ContentMetadata[] = [];
  for (const type of ALL_CONTENT_TYPES) {
    const ids = await readStringList(env.KV, Keys.idxStatus(type, 'pending'));
    for (const id of ids) {
      const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
      if (meta && meta.status === 'pending') pending.push(meta);
    }
  }
  pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return json({ pending });
}

/** POST /api/admin/review/:id  body: { action: 'approve'|'reject', type?: ContentType } */
export async function handleAdminReview(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  if (!id) return badRequest('Missing id');

  let body: { action?: string; type?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON');
  }
  const action = body.action;
  if (action !== 'approve' && action !== 'reject') {
    return badRequest('action must be approve or reject');
  }

  let found = await findMetaById(env.KV, id);
  if (!found && body.type && ALL_CONTENT_TYPES.includes(body.type as ContentType)) {
    const meta = await readJson<ContentMetadata>(
      env.KV,
      Keys.meta(body.type as ContentType, id),
    );
    if (meta) found = { meta, type: body.type as ContentType };
  }
  if (!found) return notFound('Content not found');

  const { meta, type } = found;
  const oldStatus = meta.status;
  const newStatus: ContentStatus = action === 'approve' ? 'approved' : 'rejected';

  if (oldStatus === newStatus) {
    return json({ success: true, status: newStatus, message: 'Already in target status' });
  }

  await removeFromStatusIndex(env.KV, type, oldStatus, id);

  if (newStatus === 'approved') {
    await addToStatusIndex(env.KV, type, 'approved', id);
    if (oldStatus === 'rejected') {
      await addToTimeIndex(env.KV, type, id);
    }
  } else {
    await addToStatusIndex(env.KV, type, 'rejected', id);
    await removeFromTimeIndex(env.KV, type, id);
  }

  meta.status = newStatus;
  meta.updatedAt = new Date().toISOString();
  await env.KV.put(Keys.meta(type, id), JSON.stringify(meta));

  return json({ success: true, id, status: newStatus });
}

/** POST /api/admin/ban/:userId */
export async function handleAdminBan(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const userId = parts[parts.length - 1];
  if (!userId) return badRequest('Missing user id');

  await env.KV.put(Keys.banned(userId), '1');
  return json({ success: true, banned: userId });
}

/** POST /api/admin/unban/:userId */
export async function handleAdminUnban(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const userId = parts[parts.length - 1];
  if (!userId) return badRequest('Missing user id');

  await env.KV.delete(Keys.banned(userId));
  return json({ success: true, unbanned: userId });
}

/** GET /api/admin/list-all?page=&type=&status=&pageSize= */
export async function handleAdminListAll(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '15', 10) || 15));
  const filterType = url.searchParams.get('type') as ContentType | null;
  const filterStatus = url.searchParams.get('status') as ContentStatus | null;

  const types = filterType && ALL_CONTENT_TYPES.includes(filterType) ? [filterType] : ALL_CONTENT_TYPES;
  const statuses = filterStatus
    ? [filterStatus]
    : (['pending', 'approved', 'rejected'] as ContentStatus[]);

  const all: ContentMetadata[] = [];
  for (const type of types) {
    for (const status of statuses) {
      const ids = await readStringList(env.KV, Keys.idxStatus(type, status));
      for (const id of ids) {
        const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
        if (meta) all.push(meta);
      }
    }
  }

  all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const total = all.length;
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return json({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/** GET /api/admin/detail/:type/:id */
export async function handleAdminDetail(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  const type = parts[parts.length - 2];
  if (!type || !id || !ALL_CONTENT_TYPES.includes(type as ContentType)) {
    return badRequest('Invalid path');
  }

  const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type as ContentType, id));
  if (!meta) return notFound('Not found');

  const dataRaw = await env.KV.get(Keys.data(type as ContentType, id));
  const data = dataRaw ? JSON.parse(dataRaw) : null;

  return json({ content: { ...meta, data } });
}

/** PUT /api/admin/edit/:type/:id */
export async function handleAdminEdit(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  const type = parts[parts.length - 2];
  if (!type || !id || !ALL_CONTENT_TYPES.includes(type as ContentType)) {
    return badRequest('Invalid path');
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON');
  }

  const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type as ContentType, id));
  if (!meta) return notFound('Not found');

  if (typeof body.name === 'string') meta.name = body.name.trim();
  if (typeof body.description === 'string') meta.description = body.description.trim();
  if (Array.isArray(body.tags)) {
    meta.tags = (body.tags as unknown[])
      .filter((t): t is string => typeof t === 'string')
      .map(t => t.trim());
  }
  if (typeof body.status === 'string' && ['pending', 'approved', 'rejected'].includes(body.status)) {
    const newStatus = body.status as ContentStatus;
    if (newStatus !== meta.status) {
      const oldStatus = meta.status;
      await removeFromStatusIndex(env.KV, type as ContentType, oldStatus, id);
      meta.status = newStatus;
      await addToStatusIndex(env.KV, type as ContentType, newStatus, id);
      if (newStatus === 'rejected') {
        await removeFromTimeIndex(env.KV, type as ContentType, id);
      } else if (newStatus === 'approved' && oldStatus === 'rejected') {
        await addToTimeIndex(env.KV, type as ContentType, id);
      }
    }
  }
  meta.updatedAt = new Date().toISOString();

  if (body.data !== undefined) {
    const dataStr = JSON.stringify(body.data);
    meta.dataHash = await sha256Hex(dataStr);
    await env.KV.put(Keys.data(type as ContentType, id), dataStr);
  }

  await env.KV.put(Keys.meta(type as ContentType, id), JSON.stringify(meta));
  return json({ success: true });
}

/** DELETE /api/admin/delete/:type/:id */
export async function handleAdminDelete(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  const type = parts[parts.length - 2];
  if (!type || !id || !ALL_CONTENT_TYPES.includes(type as ContentType)) {
    return badRequest('Invalid path');
  }

  const meta = await readJson<ContentMetadata>(env.KV, Keys.meta(type as ContentType, id));
  if (!meta) return notFound('Not found');

  await removeContentEverywhere(env.KV, meta);
  return json({ success: true });
}

/** GET /api/admin/settings/auto-approve */
export async function handleGetAutoApprove(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const raw = (await env.KV.get('settings:autoApprove')) ?? '';
  return json({ enabled: raw.trim().toLowerCase() === 'true' });
}

/** POST /api/admin/settings/auto-approve body: { enabled: boolean } */
export async function handleSetAutoApprove(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  let body: { enabled?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON');
  }

  const enabled = body.enabled === true;
  await env.KV.put('settings:autoApprove', enabled ? 'true' : 'false');
  return json({ success: true, enabled });
}

/** POST /api/admin/seed - Upsert built-in seed content into KV (same storage as user uploads) */
export async function handleSeedBuiltins(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const results: { id: string; type: string; name: string; status: string }[] = [];

  for (const seed of BUILTIN_SEEDS) {
    const id = `builtin-${seed.type}`;
    const type = seed.type as ContentType;

    const existing = await readJson<ContentMetadata>(env.KV, Keys.meta(type, id));
    const now = new Date().toISOString();
    const dataStr = JSON.stringify(seed.data);
    const hash = await sha256Hex(dataStr);

    const meta: ContentMetadata = {
      id,
      type,
      name: seed.name,
      description: seed.description,
      author: seed.author,
      authorId: 'builtin',
      authorAvatar: null,
      tags: ['官方示例'],
      status: 'approved',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      downloads: 0,
      likes: 0,
      dataHash: hash,
    };

    await env.KV.put(Keys.data(type, id), dataStr);
    await env.KV.put(Keys.meta(type, id), JSON.stringify(meta));
    await env.KV.put(Keys.lookupId(id), type);

    if (!existing) {
      await addToStatusIndex(env.KV, type, 'approved', id);
      await addToTimeIndex(env.KV, type, id);
      await addToAuthorIndex(env.KV, 'builtin', id);
      await addToTagIndex(env.KV, '官方示例', id);
      results.push({ id, type: seed.type, name: seed.name, status: 'created' });
    } else {
      if (existing.status !== 'approved') {
        await removeFromStatusIndex(env.KV, type, existing.status, id);
      }
      await addToStatusIndex(env.KV, type, 'approved', id);
      await addToTimeIndex(env.KV, type, id);
      await addToAuthorIndex(env.KV, 'builtin', id);
      await addToTagIndex(env.KV, '官方示例', id);
      results.push({ id, type: seed.type, name: seed.name, status: 'updated' });
    }
  }

  return json({ success: true, results });
}
