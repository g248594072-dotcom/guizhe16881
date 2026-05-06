import type { JwtPayload } from '../types';

const encoder = new TextEncoder();

function base64UrlEncode(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeToString(b64: string): string {
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const raw = atob(s);
  return raw;
}

async function hmacSha256(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, encoder.encode(message));
}

const HEADER = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

export async function signJwt(
  secret: string,
  claims: Omit<JwtPayload, 'exp' | 'iat'>,
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    ...claims,
    iat: now,
    exp: now + ttlSeconds,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const toSign = `${HEADER}.${body}`;
  const sig = await hmacSha256(secret, toSign);
  return `${toSign}.${base64UrlEncode(sig)}`;
}

export async function verifyJwt(secret: string, token: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  if (!h || !p || !s) return null;
  const toSign = `${h}.${p}`;
  const expected = base64UrlEncode(await hmacSha256(secret, toSign));
  if (expected !== s) return null;
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(p)) as JwtPayload;
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return null;
  return payload;
}

export function parseBearer(authorization: string | null): string | null {
  if (!authorization) return null;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}
