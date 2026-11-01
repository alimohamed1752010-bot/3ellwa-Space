import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId, sha256Hex } from "../lib/crypto";
import { apiError } from "../lib/http";
import { createSession, requireSession } from "./session";

export const mcpPairingRoutes = new Hono<AppEnv>();
const PAIRING_SECONDS = 120;

function validOrigin(origin: string | undefined, requestUrl: string): boolean {
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(requestUrl).origin; }
  catch { return false; }
}

// Owner-only: create a one-time code after the normal password + Discord OTP login.
mcpPairingRoutes.post("/pairing", requireSession, async c => {
  const code = randomId(32);
  const codeHash = await sha256Hex("mcp-pair:" + code);
  const id = randomId(12);
  await c.env.DB.prepare(
    "INSERT INTO mcp_pairings (id, code_hash, expires_at) VALUES (?, ?, datetime('now', '+2 minutes'))"
  ).bind(id, codeHash).run();
  await c.env.DB.prepare(
    "DELETE FROM mcp_pairings WHERE expires_at < datetime('now') OR used_at IS NOT NULL"
  ).run();
  c.header("Cache-Control", "no-store");
  return c.json({ code, expiresInSeconds: PAIRING_SECONDS });
});

// MCP-only exchange: a high-entropy, short-lived, one-use pairing code becomes
// a normal site session cookie. The cookie is returned only in Set-Cookie.
mcpPairingRoutes.post("/mcp-pair", async c => {
  if (!validOrigin(c.req.header("origin"), c.req.url)) {
    return apiError(c, 403, "bad_origin", "Cross-origin request refused.");
  }
  const body = z.object({ code: z.string().min(40).max(80) }).strict()
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return apiError(c, 400, "bad_request", "A valid pairing code is required.");

  const hash = await sha256Hex("mcp-pair:" + body.data.code);
  const result = await c.env.DB.prepare(
    "UPDATE mcp_pairings SET used_at = datetime('now') WHERE code_hash = ? AND used_at IS NULL AND expires_at > datetime('now')"
  ).bind(hash).run();
  if (!result.meta.changes) {
    return apiError(c, 401, "pairing_invalid", "This pairing code is invalid, expired, or already used.");
  }

  await createSession(c, false);
  c.header("Cache-Control", "no-store");
  return c.json({ authenticated: true, expiresInSeconds: 12 * 60 * 60 });
});
