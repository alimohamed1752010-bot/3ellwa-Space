import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { apiError } from "../lib/http";
import { parseBody } from "../lib/validate";

export const layoutRoutes = new Hono<AppEnv>();

const sectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(["profile", "links", "projects", "text", "gallery", "widget", "spacer"]),
  title: z.string().max(120).default(""),
  body: z.string().max(8000).default(""),
  assetId: z.string().max(100).nullable().default(null),
  widgetId: z.string().max(100).nullable().default(null),
  enabled: z.boolean().default(true),
  visibleDesktop: z.boolean().default(true),
  visibleMobile: z.boolean().default(true),
}).strict();

export const layoutSchema = z.object({ sections: z.array(sectionSchema).max(40) }).strict();
export type HomeLayout = z.infer<typeof layoutSchema>;

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  sections: [
    { id: "profile", type: "profile", title: "", body: "", assetId: null, widgetId: null, enabled: true, visibleDesktop: true, visibleMobile: true },
    { id: "links", type: "links", title: "", body: "", assetId: null, widgetId: null, enabled: true, visibleDesktop: true, visibleMobile: true },
  ],
};

const parseLayout = (raw: string | null | undefined): HomeLayout => {
  if (!raw) return DEFAULT_HOME_LAYOUT;
  try { const parsed = layoutSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : DEFAULT_HOME_LAYOUT; }
  catch { return DEFAULT_HOME_LAYOUT; }
};

async function read(db: D1Database) {
  const row = await db.prepare("SELECT draft_json,published_json,version FROM site_settings WHERE key='homepage_layout'").first<{draft_json:string|null;published_json:string|null;version:number}>();
  return {
    draft: parseLayout(row?.draft_json ?? row?.published_json),
    published: parseLayout(row?.published_json),
    version: row?.version ?? 0,
    hasDraft: !!row?.draft_json && row.draft_json !== row.published_json,
  };
}

layoutRoutes.get("/layout", async c => c.json(await read(c.env.DB)));

layoutRoutes.put("/layout/draft", async c => {
  const p = await parseBody(c, layoutSchema);
  if ("res" in p) return p.res;
  const ids = p.data.sections.map(s => s.id);
  if (new Set(ids).size !== ids.length) return apiError(c, 400, "duplicate_section", "Section IDs must be unique.");
  for (const section of p.data.sections) {
    if (section.assetId) {
      const asset = await c.env.DB.prepare("SELECT id FROM media_assets WHERE id=? AND kind='image'").bind(section.assetId).first();
      if (!asset) return apiError(c, 400, "invalid_asset", "A selected layout image no longer exists.");
    }
    if (section.type === "widget" && section.widgetId) {
      const widget = await c.env.DB.prepare("SELECT id FROM widgets WHERE id=?").bind(section.widgetId).first();
      if (!widget) return apiError(c, 400, "invalid_widget", "A selected widget no longer exists.");
    }
  }
  await c.env.DB.prepare(
    "INSERT INTO site_settings (key,draft_json,published_json,version) VALUES ('homepage_layout',?,?,0) ON CONFLICT(key) DO UPDATE SET draft_json=excluded.draft_json,updated_at=datetime('now')"
  ).bind(JSON.stringify(p.data), JSON.stringify(DEFAULT_HOME_LAYOUT)).run();
  return c.json(await read(c.env.DB));
});

layoutRoutes.post("/layout/discard", async c => {
  await c.env.DB.prepare("UPDATE site_settings SET draft_json=published_json,updated_at=datetime('now') WHERE key='homepage_layout'").run();
  return c.json(await read(c.env.DB));
});
