import type { Env } from '../types';
import { json } from '../utils/response';
import { signJwt } from '../utils/jwt';

function parseAdminIds(env: Env): Set<string> {
  const raw = env.ADMIN_DISCORD_IDS ?? '';
  return new Set(
    raw
      .split(/[,，\s]+/)
      .map(s => s.trim())
      .filter(Boolean),
  );
}

export function isDiscordAdmin(env: Env, discordUserId: string): boolean {
  return parseAdminIds(env).has(discordUserId);
}

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

/** GET /api/auth/discord?redirect=<sessionKey> — redirect param matches existing Tavern Helper client */
export async function handleDiscordStart(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirectKey = url.searchParams.get('redirect') ?? url.searchParams.get('state');
  if (!redirectKey || redirectKey.length > 128) {
    return json({ error: 'Missing or invalid redirect/state parameter' }, 400);
  }

  await env.KV.put(
    `session:${redirectKey}`,
    JSON.stringify({ status: 'pending', createdAt: Date.now() }),
    { expirationTtl: 600 },
  );

  const callbackUrl = env.DISCORD_REDIRECT_URI?.trim() || `${url.origin}/api/auth/callback`;
  const authUrl = new URL('https://discord.com/api/oauth2/authorize');
  authUrl.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'identify guilds.members.read');
  authUrl.searchParams.set('state', redirectKey);

  return Response.redirect(authUrl.toString(), 302);
}

/** GET /api/auth/callback?code=&state= */
export async function handleDiscordCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  const sessionRaw = await env.KV.get(`session:${state}`);
  if (!sessionRaw) {
    return new Response('Session expired or invalid', { status: 400 });
  }

  const callbackUrl = env.DISCORD_REDIRECT_URI?.trim() || `${url.origin}/api/auth/callback`;
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
  });

  const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('discord token error', tokenRes.status, errText);
    return new Response(`OAuth token exchange failed: ${tokenRes.status}`, { status: 400 });
  }

  const tokenJson = (await tokenRes.json()) as DiscordTokenResponse;
  const accessToken = tokenJson.access_token;

  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    return new Response('Failed to load Discord user', { status: 400 });
  }
  const user = (await userRes.json()) as DiscordUser;

  const banned = await env.KV.get(`banned:${user.id}`);
  if (banned) {
    return new Response(
      '<!DOCTYPE html><html><body><p>此账号已被封禁，无法使用工坊。</p><script>setTimeout(()=>window.close(),3000)</script></body></html>',
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  let inGuild = true;
  const guildId = env.DISCORD_GUILD_ID?.trim();
  if (guildId) {
    const memberRes = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    inGuild = memberRes.ok;
  }

  const displayName = user.global_name || user.username;
  const isAdmin = isDiscordAdmin(env, user.id);

  const jwt = await signJwt(env.JWT_SECRET, {
    sub: user.id,
    username: user.username,
    displayName,
    avatar: user.avatar,
    inGuild,
    isAdmin,
  });

  const userPayload = {
    id: user.id,
    username: user.username,
    displayName,
    avatar: user.avatar,
    inGuild,
    isAdmin,
  };

  await env.KV.put(
    `user:${user.id}`,
    JSON.stringify({
      ...userPayload,
      lastLogin: new Date().toISOString(),
    }),
    { expirationTtl: 60 * 60 * 24 * 365 },
  );

  await env.KV.put(
    `session:${state}`,
    JSON.stringify({
      status: 'completed',
      token: jwt,
      user: userPayload,
    }),
    { expirationTtl: 600 },
  );

  const payloadJson = JSON.stringify({
    type: 'workshop-auth',
    token: jwt,
    user: userPayload,
  });

  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>
<script>
(function(){
  var payload = ${payloadJson};
  if (window.opener) {
    try { window.opener.postMessage(payload, '*'); } catch(e) {}
  }
  document.body.innerHTML = '<p style="font-family:sans-serif">登录成功，可关闭此窗口。</p>';
  setTimeout(function(){ window.close(); }, 800);
})();
</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/** GET /api/auth/poll?key= */
export async function handleAuthPoll(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'Missing key' }, 400);

  const raw = await env.KV.get(`session:${key}`);
  if (!raw) return json({});

  let data: { status?: string; token?: string; user?: unknown };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return json({});
  }

  if (data.status === 'completed' && data.token) {
    await env.KV.delete(`session:${key}`);
    return json({ token: data.token, user: data.user });
  }

  return json({});
}
