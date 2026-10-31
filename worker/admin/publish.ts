import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { themeTokensSchema } from "../lib/theme";
import { layoutSchema, DEFAULT_HOME_LAYOUT } from "./layout";

export const publishRoutes = new Hono<AppEnv>();

type PageRow = { id:string; slug:string; title:string; status:string; visibility:string; meta_title:string|null; meta_description:string|null; indexable:number; layout_json:string; draft_layout_json:string|null; version:number };
type SectionRow = { id:string; type:string; sort_order:number; draft_json:string|null; published_json:string|null; deleted_in_draft:number };
const pageMetaSchema = z.object({
  title:z.string().trim().min(1).max(120),
  slug:z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  metaTitle:z.string().max(120).default(""),
  metaDescription:z.string().max(300).default(""),
  visibility:z.enum(["public","hidden"]).default("public"),
  indexable:z.boolean().default(false),
});
const json = (value:string|null|undefined) => { try { return value ? JSON.parse(value) : {}; } catch { return {}; } };

publishRoutes.post("/publish", async c => {
  const db = c.env.DB;
  const layoutRow = await db.prepare("SELECT draft_json,published_json,version FROM site_settings WHERE key='homepage_layout'").first<{draft_json:string|null;published_json:string|null;version:number}>();
  const layoutRaw = layoutRow?.draft_json ?? layoutRow?.published_json ?? JSON.stringify(DEFAULT_HOME_LAYOUT);
  const parsedLayout = layoutSchema.safeParse(json(layoutRaw));
  if (!parsedLayout.success) return apiError(c, 400, "layout_invalid", "Fix the homepage layout draft before publishing.");

  const themeRows = (await db.prepare("SELECT id,name,draft_tokens_json,tokens_json FROM themes WHERE draft_tokens_json IS NOT NULL").all<{id:string;name:string;draft_tokens_json:string;tokens_json:string}>()).results;
  const themes = [];
  for (const row of themeRows) {
    let value:unknown;
    try { value = JSON.parse(row.draft_tokens_json); } catch { return apiError(c, 400, "theme_invalid", `Theme "${row.name}" contains invalid JSON.`); }
    const parsed = themeTokensSchema.safeParse(value);
    if (!parsed.success) return apiError(c, 400, "theme_invalid", `Fix the draft for theme "${row.name}" before publishing.`);
    const bg = parsed.data.background;
    if (bg.mode === "image" || bg.mode === "video") {
      const asset = await db.prepare("SELECT id FROM media_assets WHERE id=? AND kind=?").bind(bg.assetId, bg.mode).first();
      if (!asset) return apiError(c, 400, "invalid_background", `The background file for "${row.name}" is missing or has the wrong type.`);
    }
    themes.push({ ...row, tokens: parsed.data });
  }

  const pageRows = (await db.prepare("SELECT * FROM pages WHERE draft_layout_json IS NOT NULL OR status='draft' ORDER BY created_at,rowid").all<PageRow>()).results;
  const projectSlugs = new Set((await db.prepare("SELECT slug FROM projects").all<{slug:string}>()).results.map(x=>x.slug));
  const allSlugs = new Set<string>();
  const pages = [];
  for (const row of pageRows) {
    const d = json(row.draft_layout_json);
    const meta = pageMetaSchema.safeParse({
      title:d.title ?? row.title,
      slug:d.slug ?? row.slug,
      metaTitle:d.metaTitle ?? row.meta_title ?? "",
      metaDescription:d.metaDescription ?? row.meta_description ?? "",
      visibility:d.visibility === "hidden" ? "hidden" : "public",
      indexable:Boolean(d.indexable ?? row.indexable),
    });
    if (!meta.success) return apiError(c, 400, "page_invalid", `Fix the draft for page "${row.title}" before publishing.`);
    if (projectSlugs.has(meta.data.slug) || allSlugs.has(meta.data.slug)) return apiError(c, 409, "slug_taken", `The page URL "/${meta.data.slug}" is already in use.`);
    allSlugs.add(meta.data.slug);
    const sections = (await db.prepare("SELECT * FROM page_sections WHERE page_id=? ORDER BY sort_order,rowid").bind(row.id).all<SectionRow>()).results;
    for (const section of sections) {
      if (section.deleted_in_draft) continue;
      if (section.draft_json) {
        const data = json(section.draft_json);
        if (typeof data.title !== "string" || typeof data.body !== "string" || typeof data.url !== "string" || typeof data.assetId !== "string") {
          return apiError(c, 400, "section_invalid", `A content block on "${row.title}" is invalid.`);
        }
        if (data.assetId) {
          const asset = await db.prepare("SELECT id FROM media_assets WHERE id=? AND kind='image'").bind(data.assetId).first();
          if (!asset) return apiError(c, 400, "invalid_asset", `A content image on "${row.title}" is missing.`);
        }
      }
    }
    const changed = row.status === "draft" || row.draft_layout_json !== row.layout_json ||
      sections.some(s => s.deleted_in_draft || (s.draft_json !== null && s.draft_json !== s.published_json));
    if (changed) pages.push({ row, meta:meta.data, sections });
  }

  const historyVersion = await db.prepare("SELECT COALESCE(MAX(version),0)+1 AS next FROM publish_history").first<{next:number}>();
  const version = historyVersion?.next ?? 1;
  const summary = { layout:!!layoutRow?.draft_json && layoutRow.draft_json!==layoutRow.published_json, themes:themes.length, pages:pages.length };
  const snapshot = {
    layout:parsedLayout.data,
    themes:themes.map(t=>({id:t.id,name:t.name,tokens:t.tokens})),
    pages:pages.map(p=>({id:p.row.id,slug:p.meta.slug,title:p.meta.title,visibility:p.meta.visibility,sections:p.sections.filter(s=>!s.deleted_in_draft).map(s=>({id:s.id,type:s.type,data:json(s.draft_json ?? s.published_json)}))})),
  };
  const statements:D1PreparedStatement[]=[];
  if (layoutRow?.draft_json) statements.push(db.prepare("UPDATE site_settings SET published_json=draft_json,version=version+1,updated_at=datetime('now') WHERE key='homepage_layout'"));
  for (const theme of themes) statements.push(db.prepare("UPDATE themes SET tokens_json=draft_tokens_json,draft_tokens_json=NULL,version=version+1,updated_at=datetime('now') WHERE id=?").bind(theme.id));
  for (const page of pages) {
    statements.push(db.prepare("UPDATE pages SET slug=?,title=?,status='published',visibility=?,meta_title=?,meta_description=?,indexable=?,layout_json=?,draft_layout_json=NULL,version=version+1,published_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(
      page.meta.slug,page.meta.title,page.meta.visibility,page.meta.metaTitle||null,page.meta.metaDescription||null,page.meta.indexable?1:0,
      JSON.stringify(page.meta),page.row.id
    ));
    statements.push(db.prepare("UPDATE page_sections SET published_json=COALESCE(draft_json,published_json),draft_json=COALESCE(draft_json,published_json),deleted_in_draft=0 WHERE page_id=? AND deleted_in_draft=0").bind(page.row.id));
    statements.push(db.prepare("DELETE FROM page_sections WHERE page_id=? AND deleted_in_draft=1").bind(page.row.id));
  }
  statements.push(db.prepare("INSERT INTO publish_history (id,version,summary_json,snapshot_json) VALUES (?,?,?,?)").bind(randomId(12),version,JSON.stringify(summary),JSON.stringify(snapshot)));
  await db.batch(statements);
  return c.json({ version, summary, publishedAt:new Date().toISOString() });
});

publishRoutes.get("/publish/history", async c => {
  const raw = Number(c.req.query("limit") ?? 20);
  const limit = Number.isFinite(raw) ? Math.min(100,Math.max(1,Math.floor(raw))) : 20;
  const rows = (await c.env.DB.prepare("SELECT id,version,summary_json,created_at FROM publish_history ORDER BY version DESC LIMIT ?").bind(limit).all<{id:string;version:number;summary_json:string;created_at:string}>()).results;
  return c.json({items:rows.map(r=>({id:r.id,version:r.version,summary:json(r.summary_json),createdAt:r.created_at}))});
});

publishRoutes.get("/publish/history/:id", async c => {
  const row = await c.env.DB.prepare("SELECT id,version,summary_json,snapshot_json,created_at FROM publish_history WHERE id=?").bind(c.req.param("id")).first<{id:string;version:number;summary_json:string;snapshot_json:string;created_at:string}>();
  if(!row)return apiError(c,404,"not_found","Publish history entry not found.");
  return c.json({item:{id:row.id,version:row.version,summary:json(row.summary_json),snapshot:json(row.snapshot_json),createdAt:row.created_at}});
});
