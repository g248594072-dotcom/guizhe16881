import type { Env } from '../types';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function withCors(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export function json(data: unknown, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
  );
}

export function error(status: number, message: string, extra?: Record<string, unknown>): Response {
  return json({ error: message, ...extra }, status);
}

export function preflight(): Response {
  return withCors(new Response(null, { status: 204 }));
}

export function badRequest(msg: string) {
  return error(400, msg);
}
export function unauthorized(msg = 'Unauthorized') {
  return error(401, msg);
}
export function forbidden(msg = 'Forbidden') {
  return error(403, msg);
}
export function notFound(msg = 'Not found') {
  return error(404, msg);
}

export function methodNotAllowed() {
  return error(405, 'Method not allowed');
}
