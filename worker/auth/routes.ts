import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { generateCode, hmacHex, randomId, safeEqual, verifyPassword } from "../lib/crypto";
import { sendDiscord } from "../lib/discord";
import { apiError } from "../lib/http";
import { createSession, currentSessionId, destroySession, secretReady } from "./session";

const MAX_FAILURES = 5; // per kind, per IP, inside the window
const WINDOW_MINUTES = 15;
const CODE_MINUTES = 5;
const CODE_TRIES = 5;

export const authRoutes = new Hono<AppEnv>();

type Kind = "password" | "code";

async function ipHash(c: Context<AppEnv>): Promise<string> {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  return hmacHex(c.env.SESSION_SECRET, "ip:" + ip);
}

/** Returns seconds to wait if this IP is locked for this kind, otherwise 0. */
async function lockedFor(c: Context<AppEnv>, ip: string, kind: Kind): Promise<number> {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n, CAST(strftime('%s','now') AS INTEGER) - CAST(strftime('%s', MIN(created_at)) AS INTEGER) AS age
     FROM auth_attempts WHERE ip_hash = ? AND kind = ? AND success = 0 AND created_at > datetime('now', ?)`
  )
    .bind(ip, kind, `-${WINDOW_MINUTES} minutes`)
    .first<{ n: number; age: number | null }>();
  if (!row || row.n < MAX_FAILURES) return 0;
  return Math.max(1, WINDOW_MINUTES * 60 - (row.age ?? 0));
}

async function record(c: Context<AppEnv>, ip: string, kind: Kind, success: boolean) {
  await c.env.DB.prepare("INSERT INTO auth_attempts (id, ip_hash, kind, success) VALUES (?, ?, ?, ?)")
    .bind(randomId(12), ip, kind, success ? 1 : 0)
    .run();
}

async function cleanup(c: Context<AppEnv>) {
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
    c.env.DB.prepare("DELETE FROM auth_challenges WHERE expires_at < datetime('now', '-1 day')"),
    c.env.DB.prepare("DELETE FROM auth_attempts WHERE created_at < datetime('now', '-7 days')"),
  ]);
}

function notify(c: Context<AppEnv>, text: string) {
  const p = sendDiscord(c.env, text);
  try { c.executionCtx.waitUntil(p); } catch { /* no execution context (tests) */ }
}

function lockedResponse(c: Context<AppEnv>, seconds: number) {
  c.header("Retry-After", String(seconds));
  return apiError(c, 429, "locked", "Too many failed attempts. Try again later.", { retryAfterSeconds: seconds });
}

function notConfigured(c: Context<AppEnv>) {
  return apiError(c, 500, "not_configured", "Server auth secrets are not configured.");
}

function country(c: Context<AppEnv>) {
  return c.req.header("cf-ipcountry") ?? "??";
}

// POST /api/auth/password
authRoutes.post("/password", async (c) => {
  if (!secretReady(c) || (!c.env.ADMIN_PASSWORD && !c.env.ADMIN_PASSWORD_HASH)) return notConfigured(c);
  const body = z.object({ password: z.string().min(1).max(1024) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return apiError(c, 400, "bad_request", "Password required.");

  const ip = await ipHash(c);
  const wait = await lockedFor(c, ip, "password");
  if (wait) return lockedResponse(c, wait);
  await cleanup(c);

  // Prefer the plain-text ADMIN_PASSWORD secret when configured. safeEqual
  // performs a constant-time comparison; retain hash support for existing installs.
  const ok = c.env.ADMIN_PASSWORD
    ? safeEqual(body.data.password, c.env.ADMIN_PASSWORD)
    : await verifyPassword(body.data.password, c.env.ADMIN_PASSWORD_HASH ?? "");
  await record(c, ip, "password", ok);
  if (!ok) {
    const nowLocked = await lockedFor(c, ip, "password");
    notify(c, nowLocked
      ? `🔒 Login locked: too many wrong passwords (country ${country(c)}, id ${ip.slice(0, 8)}).`
      : `⚠️ Wrong admin password attempt (country ${country(c)}, id ${ip.slice(0, 8)}).`);
    return apiError(c, 401, "invalid_credentials", "Invalid password.");
  }

  if (c.env.DISABLE_OTP === "true") {
    await createSession(c, false);
    notify(c, `ℹ️ Admin login with password only (DISABLE_OTP is on), country ${country(c)}.`);
    return c.json({ authenticated: true });
  }

  const code = generateCode();
  const challengeId = randomId(16);
  const codeHash = await hmacHex(c.env.SESSION_SECRET, `code:${challengeId}:${code}`);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM auth_challenges WHERE used = 0"),
    c.env.DB.prepare("INSERT INTO auth_challenges (id, code_hash, expires_at) VALUES (?, ?, datetime('now', ?))").bind(challengeId, codeHash, `+${CODE_MINUTES} minutes`),
  ]);
  const sent = await sendDiscord(c.env, `🔐 3ellwa.space login code: **${code}**\nValid ${CODE_MINUTES} minutes, one use. Country ${country(c)}.`);
  if (!sent) {
    await c.env.DB.prepare("DELETE FROM auth_challenges WHERE id = ?").bind(challengeId).run();
    return apiError(c, 502, "discord_unavailable", "Could not send the code to Discord. Check the webhook, or set DISABLE_OTP=true as a temporary fallback.");
  }
  return c.json({ challengeId, expiresInSeconds: CODE_MINUTES * 60 });
});

// POST /api/auth/code
authRoutes.post("/code", async (c) => {
  if (!secretReady(c)) return notConfigured(c);
  const body = z
    .object({ challengeId: z.string().min(1).max(64), code: z.string().regex(/^\d{8}$/), trustDevice: z.boolean().optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return apiError(c, 400, "bad_request", "Enter the 8-digit code.");

  const ip = await ipHash(c);
  const wait = await lockedFor(c, ip, "code");
  if (wait) return lockedResponse(c, wait);

  const { challengeId, code, trustDevice } = body.data;
  const ch = await c.env.DB.prepare(
    "SELECT id, code_hash, attempts, used FROM auth_challenges WHERE id = ? AND expires_at > datetime('now')"
  ).bind(challengeId).first<{ id: string; code_hash: string; attempts: number; used: number }>();

  if (!ch || ch.used || ch.attempts >= CODE_TRIES) {
    await record(c, ip, "code", false);
    return apiError(c, 401, "code_expired", "This code is no longer valid. Start again with your password.");
  }

  // Count the try before comparing, so a crash or race cannot grant free guesses.
  await c.env.DB.prepare("UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ?").bind(ch.id).run();
  const given = await hmacHex(c.env.SESSION_SECRET, `code:${ch.id}:${code}`);
  if (!safeEqual(given, ch.code_hash)) {
    await record(c, ip, "code", false);
    const left = CODE_TRIES - (ch.attempts + 1);
    notify(c, `⚠️ Wrong login code entered (country ${country(c)}, ${Math.max(left, 0)} tries left on this code).`);
    return apiError(c, 401, "invalid_code", left > 0 ? "Wrong code." : "Wrong code. This code is now void; start again.", { triesLeft: Math.max(left, 0) });
  }

  // One use: only the request that flips used 0 -> 1 wins.
  const res = await c.env.DB.prepare("UPDATE auth_challenges SET used = 1 WHERE id = ? AND used = 0").bind(ch.id).run();
  if (!res.meta.changes) return apiError(c, 401, "code_expired", "This code was already used.");
  await record(c, ip, "code", true);
  await createSession(c, trustDevice === true);
  return c.json({ authenticated: true });
});

// POST /api/auth/logout
authRoutes.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

// GET /api/auth/me
authRoutes.get("/me", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ authenticated: (await currentSessionId(c)) !== null });
});
