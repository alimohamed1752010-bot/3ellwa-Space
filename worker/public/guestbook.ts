import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId, sha256Hex } from "../lib/crypto";
import { apiError } from "../lib/http";
import { parseBody } from "../lib/validate";

export const publicGuestbookRoutes = new Hono<AppEnv>();
const submission = z.object({
  name: z.string().trim().min(1).max(50),
  message: z.string().trim().min(2).max(500),
  website: z.string().max(0).optional().default(""),
}).strict();

publicGuestbookRoutes.get("/guestbook", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id,name,message,created_at AS createdAt FROM guestbook_entries WHERE status='approved' ORDER BY created_at DESC LIMIT 50"
  ).all<{id:string;name:string;message:string;createdAt:string}>();
  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return c.json({ items: rows.results });
});

publicGuestbookRoutes.post("/guestbook", async (c) => {
  const parsed = await parseBody(c, submission);
  if ("res" in parsed) return parsed.res;
  const { name, message, website } = parsed.data;
  if (website) return c.json({ ok: true }, 202);
  const ip = (c.req.header("cf-connecting-ip") ?? "unknown").slice(0, 80);
  const ipHash = await sha256Hex(ip);
  const recent = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM guestbook_entries WHERE ip_hash=? AND created_at>=datetime('now','-1 hour')"
  ).bind(ipHash).first<{n:number}>();
  if ((recent?.n ?? 0) >= 3) return apiError(c, 429, "rate_limited", "Please wait before signing the guestbook again.");
  const id = randomId(12);
  await c.env.DB.prepare("INSERT INTO guestbook_entries (id,name,message,status,ip_hash) VALUES (?,?,?,'pending',?)")
    .bind(id, name, message, ipHash).run();
  c.header("Cache-Control", "no-store");
  return c.json({ ok: true, message: "Thanks. Your entry will appear after review." }, 202);
});
