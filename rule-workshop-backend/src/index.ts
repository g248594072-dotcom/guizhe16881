import type { Env } from './types';
import router from './router';
import { error, withCors } from './utils/response';

function validateEnv(env: Env): string | null {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) return 'JWT_SECRET missing or too short (use wrangler secret)';
  if (!env.DISCORD_CLIENT_SECRET) return 'DISCORD_CLIENT_SECRET missing';
  if (!env.DISCORD_CLIENT_ID) return 'DISCORD_CLIENT_ID missing in wrangler.toml [vars]';
  return null;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') {
        return withCors(new Response(null, { status: 204 }));
      }

      const path = url.pathname.replace(/\/$/, '') || '/';
      if (path === '/health') {
        return withCors(
          new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      const missing = validateEnv(env);
      if (missing && url.pathname !== '/api/auth/discord' && url.pathname !== '/api/auth/callback') {
        return error(503, missing);
      }

      return await router.fetch(request, env);
    } catch (e) {
      console.error(e);
      return error(500, e instanceof Error ? e.message : 'Internal error');
    }
  },
};
