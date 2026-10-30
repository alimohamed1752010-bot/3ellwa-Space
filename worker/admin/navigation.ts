import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { navTarget, parseBody } from "../lib/validate";

export const navigationRoutes = new Hono<AppEnv>();

const itemSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: navTarget,
  openNewTab: z.boolean().default(false),
  visible: z.boolean().default(true),
});

interface NavRow { id: string; label: string; target_type: string; url: string | null; open_new_tab: number; sort_order: number; visible: number }
const out = (r: NavRow) => ({ id: r.id, label: r.label, targetType: r.target_type, url: r.url, openNewTab: !!r.open_new_tab, visible: !!r.visible, sortOrder: r.sort_order });

async function list(db: D1Database) {
  const { results } = await db.prepare("SELECT * FROM navigation_items WHERE parent_id IS NULL ORDER BY sort_order, rowid").all<NavRow>();
  return results.map(out);
}

navigationRoutes.get("/navigation", async (c) => c.json({ items: await list(c.env.DB) }));

navigationRoutes.post("/navigation", async (c) => {
  const p = await parseBody(c, itemSchema);
  if ("res" in p) return p.res;
  const d = p.data;
  const cnt = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(sort_order), -1) AS m FROM navigation_items WHERE parent_id IS NULL").first<{ n: number; m: number }>();
  if ((cnt?.n ?? 0) >= 20) return apiError(c, 400, "limit_reached", "You can have up to 20 menu items.");
  await c.env.DB.prepare("INSERT INTO navigation_items (id, label, target_type, url, open_new_tab, sort_order, visible) VALUES (?,?,?,?,?,?,?)")
    .bind(randomId(9), d.label, "url", d.url, d.openNewTab ? 1 : 0, (cnt?.m ?? -1) + 1, d.visible ? 1 : 0)
    .run();
  return c.json({ items: await list(c.env.DB) }, 201);
});

navigationRoutes.put("/navigation/order", async (c) => {
  const p = await parseBody(c, z.object({ ids: z.array(z.string().max(100)).max(100) }));
  if ("res" in p) return p.res;
  await c.env.DB.batch(p.data.ids.map((id, i) => c.env.DB.prepare("UPDATE navigation_items SET sort_order = ? WHERE id = ? AND parent_id IS NULL").bind(i, id)));
  return c.json({ items: await list(c.env.DB) });
});

navigationRoutes.put("/navigation/:id", async (c) => {
  const p = await parseBody(c, itemSchema);
  if ("res" in p) return p.res;
  const d = p.data;
  const r = await c.env.DB.prepare("UPDATE navigation_items SET label=?, target_type='url', page_id=NULL, url=?, open_new_tab=?, visible=? WHERE id = ?")
    .bind(d.label, d.url, d.openNewTab ? 1 : 0, d.visible ? 1 : 0, c.req.param("id"))
    .run();
  if (!r.meta.changes) return apiError(c, 404, "not_found", "Menu item not found.");
  return c.json({ items: await list(c.env.DB) });
});

navigationRoutes.delete("/navigation/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM navigation_items WHERE id = ?").bind(c.req.param("id")).run();
  if (!r.meta.changes) return apiError(c, 404, "not_found", "Menu item not found.");
  return c.json({ items: await list(c.env.DB) });
});
