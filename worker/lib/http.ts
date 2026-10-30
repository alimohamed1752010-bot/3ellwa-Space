import type { Context } from "hono";

export function apiError(c: Context, status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 502, code: string, message: string, extra: Record<string, unknown> = {}) {
  return c.json({ error: { code, message, ...extra } }, status);
}

/** "/secret/" or "secret" -> "/secret". Empty or "/" is treated as unset (admin disabled). */
export function normalizeAdminPath(raw: string | undefined): string | null {
  if (!raw) return null;
  let p = raw.trim();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, "");
  return p.length > 1 ? p : null;
}
