/** Worker bindings */
export interface Env {
  KV: KVNamespace;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_GUILD_ID: string;
  JWT_SECRET: string;
  /** Comma-separated Discord user IDs */
  ADMIN_DISCORD_IDS: string;
}

/** JWT payload stored after Discord login */
export interface JwtPayload {
  sub: string;
  username?: string;
  displayName?: string;
  avatar?: string | null;
  inGuild: boolean;
  isAdmin: boolean;
  /** unix seconds */
  exp: number;
  iat: number;
}

/** Augmented request after auth middleware */
export interface AuthedRequest extends Request {
  jwt?: JwtPayload;
}
