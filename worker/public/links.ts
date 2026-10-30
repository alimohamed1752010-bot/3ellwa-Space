import { Hono } from "hono";
import type { AppEnv } from "../env";
import { hmacHex } from "../lib/crypto";
import { LIVE_SQL, browserOf, deviceOf, isSafeDestination } from "../lib/links";
import { mediaUrl } from "../lib/media";

export const publicLinkRoutes = new Hono<AppEnv>();
export const goRoutes = new Hono<AppEnv>();

interface Row {
  id: string; title: string; description: string | null; icon: string | null; image_asset_id: string | null; image_name: string | null;
  color: string | null; background: string | null; badge: string | null; hover_animation: string | null; open_new_tab: number; featured: number;
  category_id: string | null; cat_name: string | null; cat_description: string | null; cat_color: string | null;
}

// Visible, enabled, in-schedule links grouped by category. Never exposes ids of hidden things, schedule dates, or click counts.
publicLinkRoutes.get("/links", async (c) => {
  c.header("Cache-Control", "public, max-age=0, must-revalidate");
  let rows: Row[] = [];
  try {
    rows = (await c.env.DB.prepare(
      `SELECT l.id, l.title, l.description, l.icon, l.image_asset_id, m.filename AS image_name, l.color, l.background, l.badge, l.hover_animation, l.open_new_tab, l.featured,
              l.category_id, cat.name AS cat_name, cat.description AS cat_description, cat.color AS cat_color
       FROM links l LEFT JOIN media_assets m ON m.id = l.image_asset_id LEFT JOIN link_categories cat ON cat.id = l.category_id
       WHERE ${LIVE_SQL} ORDER BY l.sort_order, l.rowid`
    ).all<Row>()).results;
    const order = (await c.env.DB.prepare("SELECT id FROM link_categories ORDER BY sort_order, rowid").all<{ id: string }>()).results.map((r) => r.id);
    const rank = new Map(order.map((id, i) => [id, i]));
    const link = (r: Row) => ({
      id: r.id, title: r.title, description: r.description, icon: r.icon, imageUrl: mediaUrl(r.image_asset_id, r.image_name), color: r.color,
      background: r.background, badge: r.badge, hoverAnimation: r.hover_animation ?? "none", newTab: !!r.open_new_tab, featured: !!r.featured, href: `/go/${encodeURIComponent(r.id)}`,
    });
    const groups = new Map<string | null, { id: string | null; name: string | null; description: string | null; color: string | null; links: ReturnType<typeof link>[] }>();
    for (const r of rows) {
      const g = groups.get(r.category_id) ?? { id: r.category_id, name: r.cat_name, description: r.cat_description, color: r.cat_color, links: [] };
      g.links.push(link(r));
      groups.set(r.category_id, g);
    }
    const sorted = [...groups.values()].sort((a, b) => (a.id === null ? 1 : 0) - (b.id === null ? 1 : 0) || (rank.get(a.id ?? "") ?? 0) - (rank.get(b.id ?? "") ?? 0));
    return c.json({ groups: sorted, featured: rows.filter((r) => r.featured).map(link), total: rows.length });
  } catch {
    return c.json({ groups: [], featured: [], total: 0 });
  }
});

const gone = () =>
  new Response("<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"><meta name=robots content=noindex><title>Link unavailable</title><body style=\"font-family:system-ui;background:#0b0a10;color:#ece9f5;display:grid;place-items:center;min-height:100vh;margin:0\"><p>This link is not available.</p>", {
    status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

// GET /go/:linkId: count the click (no cookies), then redirect. Refuses anything not live or not a safe destination.
goRoutes.on(["GET", "HEAD"], "/:linkId", async (c) => {
  const id = c.req.param("linkId");
  if (id.length > 100) return gone();
  let url: string | null = null;
  try {
    const row = await c.env.DB.prepare(`SELECT l.url FROM links l WHERE l.id = ? AND ${LIVE_SQL}`).bind(id).first<{ url: string }>();
    url = row?.url ?? null;
  } catch {
    return gone();
  }
  // Re-checked at redirect time: a bad row (edited by hand, imported by an old version) is refused, not followed.
  if (!url || !isSafeDestination(url)) return gone();
  const target = new URL(url).href;

  if (c.req.method === "GET") {
    const ua = c.req.header("user-agent") ?? "";
    let ref: string | null = null;
    try {
      const h = new URL(c.req.header("referer") ?? "").host;
      ref = h && h !== new URL(c.req.url).host ? h.slice(0, 100) : null;
    } catch { /* no referrer */ }
    const record = (async () => {
      const day = new Date().toISOString().slice(0, 10);
      const visitor = (await hmacHex(c.env.SESSION_SECRET, `${c.req.header("cf-connecting-ip") ?? ""}|${ua}|${day}`)).slice(0, 32);
      await c.env.DB.prepare("INSERT INTO analytics_events (type, path, link_id, referrer_host, device, browser, visitor_hash) VALUES ('link_click', ?, ?, ?, ?, ?, ?)")
        .bind(`/go/${id}`, id, ref, deviceOf(ua), browserOf(ua), visitor).run();
    })().catch(() => { /* a failed count must never block the redirect */ });
    try { c.executionCtx.waitUntil(record); } catch { await record; }
  }
  return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store", "referrer-policy": "strict-origin-when-cross-origin", "x-robots-tag": "noindex" } });
});
