import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { parseBody } from "../lib/validate";

export type SeoSettings={indexingEnabled:boolean;siteTitle:string;siteDescription:string};
export const DEFAULT_SEO:SeoSettings={indexingEnabled:false,siteTitle:"3ellwa.space",siteDescription:"Personal website, projects, links, and updates."};
export async function loadSeoSettings(db:D1Database):Promise<SeoSettings>{
 const row=await db.prepare("SELECT published_json FROM site_settings WHERE key='seo_privacy'").first<{published_json:string|null}>();
 try{const value=row?.published_json?JSON.parse(row.published_json):{};return {indexingEnabled:typeof value.indexingEnabled==="boolean"?value.indexingEnabled:DEFAULT_SEO.indexingEnabled,siteTitle:typeof value.siteTitle==="string"?value.siteTitle:DEFAULT_SEO.siteTitle,siteDescription:typeof value.siteDescription==="string"?value.siteDescription:DEFAULT_SEO.siteDescription};}catch{return DEFAULT_SEO;}
}
export const seoRoutes=new Hono<AppEnv>();
const schema=z.object({indexingEnabled:z.boolean(),siteTitle:z.string().trim().min(1).max(120),siteDescription:z.string().trim().max(300)}).strict();
seoRoutes.get("/seo-privacy",async c=>c.json({settings:await loadSeoSettings(c.env.DB)}));
seoRoutes.put("/seo-privacy",async c=>{
 const p=await parseBody(c,schema);if("res"in p)return p.res;
 const json=JSON.stringify(p.data);
 await c.env.DB.prepare("INSERT INTO site_settings (key,draft_json,published_json,version,updated_at) VALUES ('seo_privacy',?,?,1,datetime('now')) ON CONFLICT(key) DO UPDATE SET draft_json=excluded.draft_json,published_json=excluded.published_json,version=site_settings.version+1,updated_at=datetime('now')")
 .bind(json,json).run();
 return c.json({settings:p.data});
});
