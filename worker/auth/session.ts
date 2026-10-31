import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { randomId, sha256Hex } from "../lib/crypto";
import { apiError } from "../lib/http";

export const SESSION_HOURS = 12;
export const TRUSTED_DAYS = 30;

export function cookieName(c: Context<AppEnv>): string {
  return new URL(c.req.url).protocol === "https:" ? "__Host-3w_session" : "3w_session";
}

export async function createSession(c: Context<AppEnv>, trusted: boolean): Promise<void> {
  const token = randomId(32);
  const tokenHash = await sha256Hex("session:" + token);
  const modifier = trusted ? `+${TRUSTED_DAYS} days` : `+${SESSION_HOURS} hours`;
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, token_hash, trusted_device, user_agent, expires_at, last_seen_at) VALUES (?, ?, ?, ?, datetime('now', ?), datetime('now'))"
  )
    .bind(randomId(12), tokenHash, trusted ? 1 : 0, (c.req.header("user-agent") ?? "").slice(0, 200), modifier)
    .run();
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, cookieName(c), token, {
    httpOnly: true,
    secure,
    sameSite: "Strict",
    path: "/",
    maxAge: trusted ? TRUSTED_DAYS * 86400 : SESSION_HOURS * 3600,
  });
}

export async function currentSessionId(c: Context<AppEnv>): Promise<string | null> {
  const token = getCookie(c, cookieName(c));
  if (!token || token.length > 128) return null;
  const tokenHash = await sha256Hex("session:" + token);
  const row = await c.env.DB.prepare("SELECT id FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')")
    .bind(tokenHash)
    .first<{ id: string }>();
  if (!row) return null;
  await c.env.DB.prepare("UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?").bind(row.id).run();
  return row.id;
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, cookieName(c));
  if (token) {
    const tokenHash = await sha256Hex("session:" + token);
    await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  deleteCookie(c, cookieName(c), { path: "/", secure: new URL(c.req.url).protocol === "https:" });
}

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = await currentSessionId(c);
  if (!id) return apiError(c, 401, "unauthorized", "Sign in required.");
  await next();
};
