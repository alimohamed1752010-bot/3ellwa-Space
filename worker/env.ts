// Bindings and secrets available to the Worker. Secrets are set with `wrangler secret put`.
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PATH: string;
  ADMIN_PASSWORD?: string; // plain-text Cloudflare secret; preferred
  ADMIN_PASSWORD_HASH?: string; // legacy PBKDF2 hash; optional fallback
  DISCORD_AUTH_WEBHOOK_URL: string;
  SESSION_SECRET: string;
  ENCRYPTION_KEY?: string; // used from Part 7
  DISABLE_OTP?: string; // "true" skips the code step (password still required)
}
export type AppEnv = { Bindings: Env };
