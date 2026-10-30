import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { MAX_LINKS, fromDbDate, linkFields, scheduleOrder, toDbDate } from "../lib/links";
import { mediaUrl } from "../lib/media";
import { parseBody } from "../lib/validate";

export const linkRoutes = new Hono<AppEnv>();

interface LinkRow {
  id: string; category_id: string | null; title: string; url: string; description: string | null; icon: string | null;
  image_asset_id: string | null; image_name: string | null; color: string | null; background: string | null; badge: string | null;
  hover_animation: string | null; open_new_tab: number; featured: number; visible: number; enabled: number;
  publish_at: string | null; expires_at: string | null; sort_order: number; created_at: string; updated_at: string;
  clicks_total: number; clicks_7d: number;
}
interface CatRow { id: string; name: string; description: string | null; color: string | null; sort_order: number; visible: number; link_count: number }

const SELECT = `SELECT l.*, m.filename AS image_name,
  (SELECT COUNT(*) FROM analytics_events e WHERE e.type = 'link_click' AND e.link_id = l.id) AS clicks_total,
  (SELECT COUNT(*) FROM analytics_events e WHERE e.type = 'link_click' AND e.link_id = l.id AND e.created_at >= datetime('now', '-7 days')) AS clicks_7d
  FROM links l LEFT JOIN media_assets m ON m.id = l.image_asset_id`;

function statusOf(r: LinkRow, now: string): "live" | "scheduled" | "expired" | "disabled" | "hidden" {
  if (!r.enabled) return "disabled";
  if (r.publish_at && r.publish_at > now) return "scheduled";
  if (r.expires_at && r.expires_at <= now) return "expired";
  if (!r.visible) return "hidden";
  return "live";
}

const outLink = (r: LinkRow, now: string) => ({
  id: r.id, categoryId: r.category_id, title: r.title, url: r.url, description: r.description, icon: r.icon,
  imageAssetId: r.image_asset_id, imageUrl: mediaUrl(r.image_asset_id, r.image_name), color: r.color, background: r.background,
  badge: r.badge, hoverAnimation: r.hover_animation ?? "none", openNewTab: !!r.open_new_tab, featured: !!r.featured,
  visible: !!r.visible, enabled: !!r.enabled, publishAt: fromDbDate(r.publish_at), expiresAt: fromDbDate(r.expires_at),
  sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at, clicksTotal: r.clicks_total, clicks7d: r.clicks_7d,
  status: statusOf(r, now),
});
const outCat = (r: CatRow) => ({ id: r.id, name: r.name, description: r.description, color: r.color, visible: !!r.visible, sortOrder: r.sort_order, linkCount: r.link_count });

async function nowDb(db: D1Database): Promise<string> {
  return (await db.prepare("SELECT datetime('now') AS n").first<{ n: string }>())!.n;
}
async function listAll(db: D1Database) {
  const [now, links, cats] = await Promise.all([
    nowDb(db),
    db.prepare(`${SELECT} ORDER BY l.sort_order, l.rowid`).all<LinkRow>(),
    db.prepare("SELECT c.*, (SELECT COUNT(*) FROM links l WHERE l.category_id = c.id) AS link_count FROM link_categories c ORDER BY c.sort_order, c.rowid").all<CatRow>(),
  ]);
  return { items: links.results.map((r) => outLink(r, now)), categories: cats.results.map(outCat) };
}
async function one(db: D1Database, id: string) {
  const [now, r] = await Promise.all([nowDb(db), db.prepare(`${SELECT} WHERE l.id = ?`).bind(id).first<LinkRow>()]);
  return r ? outLink(r, now) : null;
}

async function checkRefs(c: Parameters<typeof apiError>[0], db: D1Database, categoryId: string | null | undefined, imageId: string | null | undefined, schedule: { publishAt?: string | null; expiresAt?: string | null }) {
  const bad = scheduleOrder(schedule);
  if (bad) return apiError(c, 400, "validation_failed", bad, { field: "expiresAt" });
  if (categoryId && !(await db.prepare("SELECT 1 AS ok FROM link_categories WHERE id = ?").bind(categoryId).first())) return apiError(c, 400, "validation_failed", "categoryId: that category does not exist", { field: "categoryId" });
  if (imageId && !(await db.prepare("SELECT 1 AS ok FROM media_assets WHERE id = ? AND kind = 'image'").bind(imageId).first())) return apiError(c, 400, "validation_failed", "imageAssetId: that image does not exist", { field: "imageAssetId" });
  return null;
}

const bodySchema = z.object({ ...linkFields, categoryId: z.string().trim().max(100).nullish() });
const orderSchema = z.object({ ids: z.array(z.string().max(100)).max(MAX_LINKS) });

// ---------- Categories ----------
const catSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).nullish(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "must be a color like #8b5cf6").nullish(),
  visible: z.boolean().default(true),
});
async function listCats(db: D1Database) {
  const { results } = await db.prepare("SELECT c.*, (SELECT COUNT(*) FROM links l WHERE l.category_id = c.id) AS link_count FROM link_categories c ORDER BY c.sort_order, c.rowid").all<CatRow>();
  return results.map(outCat);
}

linkRoutes.get("/link-categories", async (c) => c.json({ items: await listCats(c.env.DB) }));

linkRoutes.post("/link-categories", async (c) => {
  const p = await parseBody(c, catSchema);
  if ("res" in p) return p.res;
  const d = p.data;
  const m = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(sort_order), -1) AS m FROM link_categories").first<{ n: number; m: number }>();
  if ((m?.n ?? 0) >= 50) return apiError(c, 400, "limit_reached", "You can have up to 50 categories.");
  await c.env.DB.prepare("INSERT INTO link_categories (id, name, description, color, sort_order, visible) VALUES (?,?,?,?,?,?)")
    .bind(randomId(9), d.name, d.description || null, d.color || null, (m?.m ?? -1) + 1, d.visible ? 1 : 0).run();
  return c.json({ items: await listCats(c.env.DB) }, 201);
});

linkRoutes.put("/link-categories/order", async (c) => {
  const p = await parseBody(c, z.object({ ids: z.array(z.string().max(100)).max(100) }));
  if ("res" in p) return p.res;
  await c.env.DB.batch(p.data.ids.map((id, i) => c.env.DB.prepare("UPDATE link_categories SET sort_order = ? WHERE id = ?").bind(i, id)));
  return c.json({ items: await listCats(c.env.DB) });
});

linkRoutes.put("/link-categories/:id", async (c) => {
  const p = await parseBody(c, catSchema);
  if ("res" in p) return p.res;
  const d = p.data;
  const r = await c.env.DB.prepare("UPDATE link_categories SET name=?, description=?, color=?, visible=? WHERE id = ?")
    .bind(d.name, d.description || null, d.color || null, d.visible ? 1 : 0, c.req.param("id")).run();
  if (!r.meta.changes) return apiError(c, 404, "not_found", "Category not found.");
  return c.json({ items: await listCats(c.env.DB) });
});

// Deleting a category keeps its links; they become uncategorized (foreign key ON DELETE SET NULL).
linkRoutes.delete("/link-categories/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM link_categories WHERE id = ?").bind(c.req.param("id")).run();
  if (!r.meta.changes) return apiError(c, 404, "not_found", "Category not found.");
  return c.json({ items: await listCats(c.env.DB) });
});

// ---------- Links: fixed paths first, then /:id ----------
linkRoutes.get("/links", async (c) => c.json(await listAll(c.env.DB)));

linkRoutes.put("/links/order", async (c) => {
  const p = await parseBody(c, orderSchema);
  if ("res" in p) return p.res;
  await c.env.DB.batch(p.data.ids.map((id, i) => c.env.DB.prepare("UPDATE links SET sort_order = ? WHERE id = ?").bind(i, id)));
  return c.json(await listAll(c.env.DB));
});

const bulkSchema = z.object({
  ids: z.array(z.string().max(100)).min(1).max(200),
  action: z.enum(["enable", "disable", "show", "hide", "feature", "unfeature", "delete", "category"]),
  categoryId: z.string().trim().max(100).nullish(),
});
linkRoutes.post("/links/bulk", async (c) => {
  const p = await parseBody(c, bulkSchema);
  if ("res" in p) return p.res;
  const { ids, action, categoryId } = p.data;
  if (action === "category" && categoryId && !(await c.env.DB.prepare("SELECT 1 AS ok FROM link_categories WHERE id = ?").bind(categoryId).first()))
    return apiError(c, 400, "validation_failed", "categoryId: that category does not exist", { field: "categoryId" });
  const marks = ids.map(() => "?").join(",");
  const sql: Record<string, string> = {
    enable: "UPDATE links SET enabled = 1, updated_at = datetime('now')",
    disable: "UPDATE links SET enabled = 0, updated_at = datetime('now')",
    show: "UPDATE links SET visible = 1, updated_at = datetime('now')",
    hide: "UPDATE links SET visible = 0, updated_at = datetime('now')",
    feature: "UPDATE links SET featured = 1, updated_at = datetime('now')",
    unfeature: "UPDATE links SET featured = 0, updated_at = datetime('now')",
    delete: "DELETE FROM links",
    category: "UPDATE links SET category_id = ?, updated_at = datetime('now')",
  };
  const binds = action === "category" ? [categoryId || null, ...ids] : ids;
  await c.env.DB.prepare(`${sql[action]} WHERE id IN (${marks})`).bind(...binds).run();
  return c.json(await listAll(c.env.DB));
});

linkRoutes.get("/links/export", async (c) => {
  const { items, categories } = await listAll(c.env.DB);
  const name = new Map(categories.map((x) => [x.id, x.name]));
  c.header("Content-Disposition", 'attachment; filename="links-export.json"');
  c.header("Cache-Control", "no-store");
  return c.json({
    version: 1,
    categories: categories.map((x) => ({ name: x.name, description: x.description, color: x.color, visible: x.visible })),
    links: items.map((l) => ({
      title: l.title, url: l.url, description: l.description, icon: l.icon, category: l.categoryId ? name.get(l.categoryId) ?? null : null,
      color: l.color, background: l.background, badge: l.badge, hoverAnimation: l.hoverAnimation, openNewTab: l.openNewTab,
      featured: l.featured, visible: l.visible, enabled: l.enabled, publishAt: l.publishAt, expiresAt: l.expiresAt,
    })),
  });
});

const importLink = z.object({ ...linkFields, category: z.string().trim().max(40).nullish() }).omit({ imageAssetId: true });
const importSchema = z.object({
  version: z.literal(1),
  categories: z.array(catSchema).max(50).default([]),
  links: z.array(importLink).max(500),
});
// Validates everything first; writes in one atomic batch, so a bad file never half-applies.
linkRoutes.post("/links/import", async (c) => {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return apiError(c, 400, "invalid_json", "That file is not valid JSON."); }
  const r = importSchema.safeParse(raw);
  if (!r.success) {
    const errors = r.error.issues.slice(0, 10).map((i) => {
      const path = i.path.map(String);
      const where = path[0] === "links" && path[1] !== undefined ? `Link #${Number(path[1]) + 1}${path[2] ? ` (${path[2]})` : ""}` : path[0] === "categories" && path[1] !== undefined ? `Category #${Number(path[1]) + 1}${path[2] ? ` (${path[2]})` : ""}` : path.join(".") || "File";
      return `${where}: ${i.message}`;
    });
    return apiError(c, 400, "import_invalid", `Import refused, nothing was changed. ${errors[0]}`, { errors });
  }
  const d = r.data;
  for (let i = 0; i < d.links.length; i++) {
    const bad = scheduleOrder(d.links[i]);
    if (bad) return apiError(c, 400, "import_invalid", `Import refused, nothing was changed. Link #${i + 1}: ${bad}`, { errors: [`Link #${i + 1}: ${bad}`] });
  }
  const db = c.env.DB;
  const counts = await db.prepare("SELECT (SELECT COUNT(*) FROM links) AS ln, (SELECT COUNT(*) FROM link_categories) AS cn, (SELECT COALESCE(MAX(sort_order), -1) FROM links) AS lm, (SELECT COALESCE(MAX(sort_order), -1) FROM link_categories) AS cm").first<{ ln: number; cn: number; lm: number; cm: number }>();
  const existing = (await db.prepare("SELECT id, name FROM link_categories").all<{ id: string; name: string }>()).results;
  const byName = new Map(existing.map((x) => [x.name.toLowerCase(), x.id]));
  const stmts: D1PreparedStatement[] = [];
  let newCats = 0, cm = counts?.cm ?? -1;
  const ensure = (name: string, extra?: { description?: string | null; color?: string | null; visible?: boolean }) => {
    const key = name.toLowerCase();
    let id = byName.get(key);
    if (!id) {
      id = randomId(9); byName.set(key, id); newCats++;
      stmts.push(db.prepare("INSERT INTO link_categories (id, name, description, color, sort_order, visible) VALUES (?,?,?,?,?,?)").bind(id, name, extra?.description || null, extra?.color || null, ++cm, extra?.visible === false ? 0 : 1));
    }
    return id;
  };
  for (const cat of d.categories) ensure(cat.name, cat);
  for (const l of d.links) if (l.category) ensure(l.category);
  if ((counts?.cn ?? 0) + newCats > 50) return apiError(c, 400, "import_invalid", "Import refused, nothing was changed. That would be more than 50 categories.", { errors: ["More than 50 categories."] });
  if ((counts?.ln ?? 0) + d.links.length > MAX_LINKS) return apiError(c, 400, "import_invalid", `Import refused, nothing was changed. That would be more than ${MAX_LINKS} links.`, { errors: [`More than ${MAX_LINKS} links.`] });
  let lm = counts?.lm ?? -1;
  for (const l of d.links) {
    stmts.push(db.prepare(
      "INSERT INTO links (id, category_id, title, url, description, icon, color, background, badge, hover_animation, open_new_tab, featured, visible, enabled, publish_at, expires_at, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(randomId(9), l.category ? byName.get(l.category.toLowerCase())! : null, l.title, l.url, l.description || null, l.icon || null, l.color || null, l.background || null, l.badge || null,
      l.hoverAnimation, l.openNewTab ? 1 : 0, l.featured ? 1 : 0, l.visible ? 1 : 0, l.enabled ? 1 : 0, toDbDate(l.publishAt), toDbDate(l.expiresAt), ++lm));
  }
  if (stmts.length) await db.batch(stmts);
  return c.json({ ...(await listAll(db)), imported: { links: d.links.length, categoriesCreated: newCats } }, 201);
});

linkRoutes.post("/links", async (c) => {
  const p = await parseBody(c, bodySchema);
  if ("res" in p) return p.res;
  const d = p.data;
  const bad = await checkRefs(c, c.env.DB, d.categoryId, d.imageAssetId, d);
  if (bad) return bad;
  const m = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(sort_order), -1) AS m FROM links").first<{ n: number; m: number }>();
  if ((m?.n ?? 0) >= MAX_LINKS) return apiError(c, 400, "limit_reached", `You can have up to ${MAX_LINKS} links.`);
  const id = randomId(9);
  await c.env.DB.prepare(
    "INSERT INTO links (id, category_id, title, url, description, icon, image_asset_id, color, background, badge, hover_animation, open_new_tab, featured, visible, enabled, publish_at, expires_at, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(id, d.categoryId || null, d.title, d.url, d.description || null, d.icon || null, d.imageAssetId || null, d.color || null, d.background || null, d.badge || null,
    d.hoverAnimation, d.openNewTab ? 1 : 0, d.featured ? 1 : 0, d.visible ? 1 : 0, d.enabled ? 1 : 0, toDbDate(d.publishAt), toDbDate(d.expiresAt), (m?.m ?? -1) + 1).run();
  return c.json({ item: await one(c.env.DB, id) }, 201);
});

linkRoutes.post("/links/:id/duplicate", async (c) => {
  const src = await c.env.DB.prepare("SELECT * FROM links WHERE id = ?").bind(c.req.param("id")).first<LinkRow>();
  if (!src) return apiError(c, 404, "not_found", "Link not found.");
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM links").first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_LINKS) return apiError(c, 400, "limit_reached", `You can have up to ${MAX_LINKS} links.`);
  const id = randomId(9);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE links SET sort_order = sort_order + 1 WHERE sort_order > ?").bind(src.sort_order),
    c.env.DB.prepare(
      "INSERT INTO links (id, category_id, title, url, description, icon, image_asset_id, color, background, badge, hover_animation, open_new_tab, featured, visible, enabled, publish_at, expires_at, sort_order) SELECT ?, category_id, substr(title, 1, 91) || ' (copy)', url, description, icon, image_asset_id, color, background, badge, hover_animation, open_new_tab, featured, visible, enabled, publish_at, expires_at, sort_order + 1 FROM links WHERE id = ?"
    ).bind(id, src.id),
  ]);
  return c.json({ item: await one(c.env.DB, id), ...(await listAll(c.env.DB)) }, 201);
});

linkRoutes.get("/links/:id/stats", async (c) => {
  const id = c.req.param("id");
  if (!(await c.env.DB.prepare("SELECT 1 AS ok FROM links WHERE id = ?").bind(id).first())) return apiError(c, 404, "not_found", "Link not found.");
  const [tot, days] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS total, COUNT(DISTINCT visitor_hash) AS visitors, MAX(created_at) AS last_at FROM analytics_events WHERE type = 'link_click' AND link_id = ?").bind(id).first<{ total: number; visitors: number; last_at: string | null }>(),
    c.env.DB.prepare("SELECT date(created_at) AS d, COUNT(*) AS n FROM analytics_events WHERE type = 'link_click' AND link_id = ? AND created_at >= datetime('now', 'start of day', '-29 days') GROUP BY d").bind(id).all<{ d: string; n: number }>(),
  ]);
  const map = new Map(days.results.map((r) => [r.d, r.n]));
  const daily: Array<{ date: string; count: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    daily.push({ date, count: map.get(date) ?? 0 });
  }
  return c.json({
    total: tot?.total ?? 0, uniqueVisitors: tot?.visitors ?? 0, lastClickAt: fromDbDate(tot?.last_at ?? null),
    last7: daily.slice(-7).reduce((s, x) => s + x.count, 0), last30: daily.reduce((s, x) => s + x.count, 0), daily,
  });
});

linkRoutes.put("/links/:id", async (c) => {
  const p = await parseBody(c, bodySchema);
  if ("res" in p) return p.res;
  const d = p.data;
  const bad = await checkRefs(c, c.env.DB, d.categoryId, d.imageAssetId, d);
  if (bad) return bad;
  const r = await c.env.DB.prepare(
    "UPDATE links SET category_id=?, title=?, url=?, description=?, icon=?, image_asset_id=?, color=?, background=?, badge=?, hover_animation=?, open_new_tab=?, featured=?, visible=?, enabled=?, publish_at=?, expires_at=?, updated_at=datetime('now') WHERE id = ?"
  ).bind(d.categoryId || null, d.title, d.url, d.description || null, d.icon || null, d.imageAssetId || null, d.color || null, d.background || null, d.badge || null,
    d.hoverAnimation, d.openNewTab ? 1 : 0, d.featured ? 1 : 0, d.visible ? 1 : 0, d.enabled ? 1 : 0, toDbDate(d.publishAt), toDbDate(d.expiresAt), c.req.param("id")).run();
  if (!r.meta.changes) return apiError(c, 404, "not_found", "Link not found.");
  return c.json({ item: await one(c.env.DB, c.req.param("id")) });
});

linkRoutes.delete("/links/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM links WHERE id = ?").bind(c.req.param("id")).run();
  if (!r.meta.changes) return apiError(c, 404, "not_found", "Link not found.");
  return c.json({ ok: true });
});
