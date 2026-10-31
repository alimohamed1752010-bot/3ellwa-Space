import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { parseBody } from "../lib/validate";

export const pageRoutes = new Hono<AppEnv>();
const reserved = new Set(["links", "go", "projects", "api", "media", "admin", "robots.txt", "sitemap.xml"]);
const slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine((s) => !reserved.has(s) && !s.startsWith("go-"), "This URL is reserved or invalid.");
const block = z.object({ id: z.string().max(100).optional(), type: z.enum(["text","links","projects","gallery","timeline","embed"]), title: z.string().max(120).default(""), body: z.string().max(20000).default(""), url: z.string().max(2000).default(""), assetId: z.string().max(100).default("") });
const draftSchema = z.object({ title: z.string().trim().min(1).max(120), slug, metaTitle: z.string().max(120).default(""), metaDescription: z.string().max(300).default(""), visibility: z.enum(["public","hidden"]).default("public"), indexable: z.boolean().default(true), sections: z.array(block).max(50) });
type Draft = z.infer<typeof draftSchema>;
interface Page { id:string; slug:string; title:string; status:"draft"|"published"; visibility:"public"|"hidden"|"password"; meta_title:string|null; meta_description:string|null; indexable:number; layout_json:string; draft_layout_json:string|null; version:number; created_at:string; updated_at:string; published_at:string|null }
interface Section { id:string; page_id:string; type:string; sort_order:number; draft_json:string|null; published_json:string|null; deleted_in_draft:number }
const json = <T,>(s:string|null|undefined, fallback:T):T => { try { return s ? JSON.parse(s) as T : fallback; } catch { return fallback; } };
function meta(p:Page):Omit<Draft,"sections"> {
 const d=json<Partial<Draft>>(p.draft_layout_json,json<Partial<Draft>>(p.layout_json,{}));
 return { title:d.title ?? p.title, slug:d.slug ?? p.slug, metaTitle:d.metaTitle ?? p.meta_title ?? "", metaDescription:d.metaDescription ?? p.meta_description ?? "", visibility:d.visibility === "hidden" ? "hidden":"public", indexable:Boolean(d.indexable ?? p.indexable) };
}
async function load(db:D1Database,id:string) {
 const page=await db.prepare("SELECT * FROM pages WHERE id=?").bind(id).first<Page>();
 if(!page) return null;
 const sections=(await db.prepare("SELECT * FROM page_sections WHERE page_id=? ORDER BY sort_order,rowid").bind(id).all<Section>()).results;
 return { page, sections, item:{ id:page.id,status:page.status,...meta(page),sections:sections.filter(s=>!s.deleted_in_draft).map(s=>({id:s.id,type:s.type,...json<Record<string,unknown>>(s.draft_json, json<Record<string,unknown>>(s.published_json,{}))})),version:page.version,updatedAt:page.updated_at,publishedAt:page.published_at } };
}
async function taken(db:D1Database,value:string,id="") { const [page,project]=await Promise.all([db.prepare("SELECT 1 FROM pages WHERE slug=? AND id!=?").bind(value,id).first(),db.prepare("SELECT 1 FROM projects WHERE slug=?").bind(value).first()]);return !!page||!!project; }
function makeSlug(title:string) { const s=title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"new-page"; return reserved.has(s)||s.startsWith("go-")?s+"-page":s; }

pageRoutes.get("/pages",async c=>{
 const rows=(await c.env.DB.prepare("SELECT * FROM pages ORDER BY updated_at DESC").all<Page>()).results;
 const items=await Promise.all(rows.map(async p=>(await load(c.env.DB,p.id))!.item));
 return c.json({items});
});
pageRoutes.get("/pages/:id",async c=>{ const p=await load(c.env.DB,c.req.param("id")); return p?c.json({item:p.item}):apiError(c,404,"not_found","Page not found."); });
pageRoutes.post("/pages",async c=>{
 const p=await parseBody(c,z.object({title:z.string().trim().min(1).max(120)})); if("res" in p)return p.res;
 let s=makeSlug(p.data.title),n=2; while(await taken(c.env.DB,s))s=makeSlug(p.data.title)+"-"+n++;
 const id=randomId(12),d={title:p.data.title,slug:s,metaTitle:"",metaDescription:"",visibility:"public",indexable:true};
 await c.env.DB.prepare("INSERT INTO pages (id,slug,title,status,visibility,indexable,layout_json,draft_layout_json) VALUES (?,?,?,'draft','public',1,'{}',?)").bind(id,s,p.data.title,JSON.stringify(d)).run();
 return c.json({item:(await load(c.env.DB,id))!.item},201);
});
pageRoutes.put("/pages/:id/draft",async c=>{
 const p=await parseBody(c,draftSchema); if("res" in p)return p.res;
 const old=await load(c.env.DB,c.req.param("id")); if(!old)return apiError(c,404,"not_found","Page not found.");
 if(await taken(c.env.DB,p.data.slug,old.page.id))return apiError(c,409,"slug_taken","That URL is already used.");
 const statements:D1PreparedStatement[]=[c.env.DB.prepare("UPDATE pages SET draft_layout_json=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify({title:p.data.title,slug:p.data.slug,metaTitle:p.data.metaTitle,metaDescription:p.data.metaDescription,visibility:p.data.visibility,indexable:p.data.indexable}),old.page.id)];
 const seen=new Set<string>();
 for(let i=0;i<p.data.sections.length;i++){const b=p.data.sections[i],id=b.id&&old.sections.some(s=>s.id===b.id)?b.id:randomId(12);seen.add(id);const data=JSON.stringify({title:b.title,body:b.body,url:b.url,assetId:b.assetId});
 if(old.sections.some(s=>s.id===id))statements.push(c.env.DB.prepare("UPDATE page_sections SET type=?,sort_order=?,draft_json=?,deleted_in_draft=0,updated_at=datetime('now') WHERE id=? AND page_id=?").bind(b.type,i,data,id,old.page.id));
 else statements.push(c.env.DB.prepare("INSERT INTO page_sections (id,page_id,type,sort_order,draft_json,published_json,deleted_in_draft) VALUES (?,?,?,?,?,NULL,0)").bind(id,old.page.id,b.type,i,data));}
 for(const s of old.sections)if(!seen.has(s.id))statements.push(c.env.DB.prepare("UPDATE page_sections SET deleted_in_draft=1 WHERE id=?").bind(s.id));
 await c.env.DB.batch(statements);return c.json({item:(await load(c.env.DB,old.page.id))!.item});
});
pageRoutes.post("/pages/:id/publish",async c=>{
 const p=await load(c.env.DB,c.req.param("id"));if(!p)return apiError(c,404,"not_found","Page not found.");
 const d=meta(p.page);const parsed=draftSchema.safeParse({...d,sections:p.item.sections});if(!parsed.success)return apiError(c,400,"draft_invalid","Fix the page draft before publishing.");
 if(await taken(c.env.DB,d.slug,p.page.id))return apiError(c,409,"slug_taken","That URL is already used.");
 await c.env.DB.batch([
 c.env.DB.prepare("UPDATE pages SET slug=?,title=?,status='published',visibility=?,meta_title=?,meta_description=?,indexable=?,layout_json=draft_layout_json,version=version+1,published_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(d.slug,d.title,d.visibility,d.metaTitle||null,d.metaDescription||null,d.indexable?1:0,p.page.id),
 c.env.DB.prepare("UPDATE page_sections SET published_json=draft_json,deleted_in_draft=0 WHERE page_id=? AND deleted_in_draft=0").bind(p.page.id),
 c.env.DB.prepare("DELETE FROM page_sections WHERE page_id=? AND deleted_in_draft=1").bind(p.page.id)
 ]);
 return c.json({item:(await load(c.env.DB,p.page.id))!.item});
});
pageRoutes.post("/pages/:id/discard",async c=>{
 const p=await load(c.env.DB,c.req.param("id"));if(!p)return apiError(c,404,"not_found","Page not found.");
 if(p.page.status==="draft")await c.env.DB.batch([c.env.DB.prepare("DELETE FROM page_sections WHERE page_id=?").bind(p.page.id),c.env.DB.prepare("UPDATE pages SET draft_layout_json='{}' WHERE id=?").bind(p.page.id)]);
 else await c.env.DB.batch([c.env.DB.prepare("DELETE FROM page_sections WHERE page_id=? AND published_json IS NULL").bind(p.page.id),c.env.DB.prepare("UPDATE page_sections SET draft_json=published_json,deleted_in_draft=0 WHERE page_id=?").bind(p.page.id),c.env.DB.prepare("UPDATE pages SET draft_layout_json=layout_json WHERE id=?").bind(p.page.id)]);
 return c.json({item:(await load(c.env.DB,p.page.id))!.item});
});
pageRoutes.post("/pages/:id/duplicate",async c=>{
 const p=await load(c.env.DB,c.req.param("id"));if(!p)return apiError(c,404,"not_found","Page not found.");
 let s=makeSlug(p.item.title+"-copy"),n=2;while(await taken(c.env.DB,s))s=makeSlug(p.item.title+"-copy")+"-"+n++;
 const id=randomId(12),d={...meta(p.page),title:p.item.title+" copy",slug:s};
 const q:D1PreparedStatement[]=[c.env.DB.prepare("INSERT INTO pages (id,slug,title,status,visibility,indexable,layout_json,draft_layout_json) VALUES (?,?,?,'draft','public',0,'{}',?)").bind(id,s,d.title,JSON.stringify(d))];
 p.item.sections.forEach((b:any,i:number)=>q.push(c.env.DB.prepare("INSERT INTO page_sections (id,page_id,type,sort_order,draft_json,published_json,deleted_in_draft) VALUES (?,?,?,?,?,NULL,0)").bind(randomId(12),id,b.type,i,JSON.stringify({title:b.title,body:b.body,url:b.url,assetId:b.assetId}))));
 await c.env.DB.batch(q);return c.json({item:(await load(c.env.DB,id))!.item},201);
});
pageRoutes.delete("/pages/:id",async c=>{const r=await c.env.DB.prepare("DELETE FROM pages WHERE id=?").bind(c.req.param("id")).run();return r.meta.changes?c.json({ok:true}):apiError(c,404,"not_found","Page not found.");});
