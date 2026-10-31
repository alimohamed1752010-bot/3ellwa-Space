// Bindings and secrets available to the Worker.
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PATH: string;
  ADMIN_PASSWORD?: string; // required at runtime for admin login
  DISCORD_AUTH_WEBHOOK_URL?: string; // required at runtime for password + OTP login
  ENCRYPTION_KEY?: string; // used by encrypted features
}
export type AppEnv = { Bindings: Env };
