import type { Env, JwtPayload } from '../types';
import { forbidden, unauthorized } from '../utils/response';
import { parseBearer, verifyJwt } from '../utils/jwt';

export async function getJwtFromRequest(request: Request, env: Env): Promise<JwtPayload | null> {
  const token = parseBearer(request.headers.get('Authorization'));
  if (!token) return null;
  return verifyJwt(env.JWT_SECRET, token);
}

/** Requires valid Bearer JWT */
export async function requireAuth(request: Request, env: Env): Promise<JwtPayload | Response> {
  const jwt = await getJwtFromRequest(request, env);
  if (!jwt) return unauthorized('Missing or invalid token');
  return jwt;
}

/** Requires admin flag on JWT */
export async function requireAdmin(request: Request, env: Env): Promise<JwtPayload | Response> {
  const r = await requireAuth(request, env);
  if (r instanceof Response) return r;
  if (!r.isAdmin) return forbidden('Admin only');
  return r;
}
