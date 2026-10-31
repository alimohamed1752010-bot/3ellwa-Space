import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { mediaUrl } from "../lib/media";
import { parseBody, safeUrl } from "../lib/validate";

export const projectRoutes = new Hono<AppEnv>();
const reserved = new Set(["links","go","projects","api","media","admin","robots.txt","sitemap.xml"]);
const slugSchema=z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(s=>!reserved.has(s)&&!s.startsWith("go-"),"This URL is reserved or invalid.");
const linkSchema=z.object({id:z.string().max(100).optional(),label:z.string().trim().min(1).max(50),url:safeUrl});
const gallerySchema=z.object({id:z.string().max(100).optional(),assetId:z.string().trim().min(1).max(100),caption:z.string().trim().max(200).default("")});
const bodySchema=z.object({
 name:z.string().trim().min(1).max(100),
 slug:slugSchema,
 description:z.string().max(5000).default(""),
 logoAssetId:z.string().max(100).nullable().default(null),
 coverAssetId:z.string().max(100).nullable().default(null),
 websiteUrl:safeUrl.nullable().default(null),
 githubUrl:safeUrl.nullable().default(null),
 technologies:z.array(z.string().trim().min(1).max(40)).max(20).default([]),
 category:z.string().trim().max(60).default(""),
 status:z.enum(["idea","active","paused","finished","archived"]).default("active"),
 startedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
 featured:z.boolean().default(false),
 visible:z.boolean().default(true),
 links:z.array(linkSchema).max(20).default([]),
 gallery:z.array(gallerySchema).max(30).default([]),
});
type ProjectRow={id:string;slug:string;name:string;description:string|null;logo_asset_id:string|null;logo_name:string|null;cover_asset_id:string|null;cover_name:string|null;website_url:string|null;github_url:string|null;technologies_json:string;category:string|null;status:string;started_on:string|null;featured:number;visible:number;sort_order:number;created_at:string;updated_at:string};
type LinkRow={id:string;label:string;url:string;sort_order:number};
type GalleryRow={id:string;asset_id:string;filename:string;caption:string|null;sort_order:number};
const parseJson=(s:string|null):string[]=>{try{const v=JSON.parse(s??"[]");return Array.isArray(v)?v.filter(x=>typeof x==="string"):[];}catch{return [];}};
const out=(r:ProjectRow,links:LinkRow[],gallery:GalleryRow[])=>({
 id:r.id,slug:r.slug,name:r.name,description:r.description??"",logoAssetId:r.logo_asset_id,logoUrl:mediaUrl(r.logo_asset_id,r.logo_name),
 coverAssetId:r.cover_asset_id,coverUrl:mediaUrl(r.cover_asset_id,r.cover_name),websiteUrl:r.website_url,githubUrl:r.github_url,
 technologies:parseJson(r.technologies_json),category:r.category??"",status:r.status,startedOn:r.started_on,
 featured:!!r.featured,visible:!!r.visible,sortOrder:r.sort_order,createdAt:r.created_at,updatedAt:r.updated_at,
 links:links.map(x=>({id:x.id,label:x.label,url:x.url})),
 gallery:gallery.map(x=>({id:x.id,assetId:x.asset_id,url:mediaUrl(x.asset_id,x.filename),caption:x.caption??""})),
});
async function load(db:D1Database,id:string){
 const r=await db.prepare("SELECT p.*,lm.filename AS logo_name,cm.filename AS cover_name FROM projects p LEFT JOIN media_assets lm ON lm.id=p.logo_asset_id LEFT JOIN media_assets cm ON cm.id=p.cover_asset_id WHERE p.id=?").bind(id).first<ProjectRow>();
 if(!r)return null;
 const [links,gallery]=await Promise.all([
  db.prepare("SELECT id,label,url,sort_order FROM project_links WHERE project_id=? ORDER BY sort_order,rowid").bind(id).all<LinkRow>(),
  db.prepare("SELECT g.id,g.asset_id,m.filename,g.caption,g.sort_order FROM project_gallery g JOIN media_assets m ON m.id=g.asset_id WHERE g.project_id=? ORDER BY g.sort_order,g.rowid").bind(id).all<GalleryRow>(),
 ]);
 return out(r,links.results,gallery.results);
}
async function list(db:D1Database){
 const ids=(await db.prepare("SELECT id FROM projects ORDER BY sort_order,rowid").all<{id:string}>()).results;
 return Promise.all(ids.map(x=>load(db,x.id)));
}
async function slugTaken(db:D1Database,s:string,id=""){
 const [p,page]=await Promise.all([
  db.prepare("SELECT 1 FROM projects WHERE slug=? AND id!=?").bind(s,id).first(),
  db.prepare("SELECT 1 FROM pages WHERE slug=?").bind(s).first(),
 ]);
 return !!p||!!page;
}
function makeSlug(name:string){const s=name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"new-project";return reserved.has(s)||s.startsWith("go-")?s+"-project":s;}
async function validateRefs(db:D1Database,d:z.infer<typeof bodySchema>){
 const ids=[d.logoAssetId,d.coverAssetId,...d.gallery.map(g=>g.assetId)].filter((x):x is string=>!!x);
 if(!ids.length)return null;
 const unique=[...new Set(ids)],marks=unique.map(()=>"?").join(",");
 const rows=(await db.prepare(`SELECT id FROM media_assets WHERE kind='image' AND id IN (${marks})`).bind(...unique).all<{id:string}>()).results;
 return rows.length===unique.length?null:"One or more selected images no longer exist.";
}
async function saveChildren(db:D1Database,id:string,d:z.infer<typeof bodySchema>){
 const statements:D1PreparedStatement[]=[
  db.prepare("DELETE FROM project_links WHERE project_id=?").bind(id),
  db.prepare("DELETE FROM project_gallery WHERE project_id=?").bind(id),
  ...d.links.map((l,i)=>db.prepare("INSERT INTO project_links (id,project_id,label,url,sort_order) VALUES (?,?,?,?,?)").bind(randomId(12),id,l.label,l.url,i)),
  ...d.gallery.map((g,i)=>db.prepare("INSERT INTO project_gallery (id,project_id,asset_id,caption,sort_order) VALUES (?,?,?,?,?)").bind(randomId(12),id,g.assetId,g.caption||null,i)),
 ];
 if(statements.length)await db.batch(statements);
}
projectRoutes.get("/projects",async c=>c.json({items:await list(c.env.DB)}));
projectRoutes.post("/projects",async c=>{
 const p=await parseBody(c,bodySchema);if("res"in p)return p.res;const d=p.data;
 const bad=await validateRefs(c.env.DB,d);if(bad)return apiError(c,400,"validation_failed",bad);
 if(await slugTaken(c.env.DB,d.slug))return apiError(c,409,"slug_taken","That URL is already used by another page or project.");
 const id=randomId(12),max=await c.env.DB.prepare("SELECT COALESCE(MAX(sort_order),-1) AS n FROM projects").first<{n:number}>();
 await c.env.DB.prepare("INSERT INTO projects (id,slug,name,description,logo_asset_id,cover_asset_id,website_url,github_url,technologies_json,category,status,started_on,featured,visible,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
 .bind(id,d.slug,d.name,d.description||null,d.logoAssetId,d.coverAssetId,d.websiteUrl,d.githubUrl,JSON.stringify(d.technologies),d.category||null,d.status,d.startedOn,d.featured?1:0,d.visible?1:0,(max?.n??-1)+1).run();
 await saveChildren(c.env.DB,id,d);return c.json({item:await load(c.env.DB,id)},201);
});
projectRoutes.put("/projects/order",async c=>{
 const p=await parseBody(c,z.object({ids:z.array(z.string().max(100)).max(500)}));if("res"in p)return p.res;
 await c.env.DB.batch(p.data.ids.map((id,i)=>c.env.DB.prepare("UPDATE projects SET sort_order=?,updated_at=datetime('now') WHERE id=?").bind(i,id)));
 return c.json({items:await list(c.env.DB)});
});
projectRoutes.put("/projects/:id",async c=>{
 const p=await parseBody(c,bodySchema);if("res"in p)return p.res;const d=p.data,id=c.req.param("id");
 const exists=await c.env.DB.prepare("SELECT 1 FROM projects WHERE id=?").bind(id).first();if(!exists)return apiError(c,404,"not_found","Project not found.");
 const bad=await validateRefs(c.env.DB,d);if(bad)return apiError(c,400,"validation_failed",bad);
 if(await slugTaken(c.env.DB,d.slug,id))return apiError(c,409,"slug_taken","That URL is already used by another page or project.");
 await c.env.DB.prepare("UPDATE projects SET slug=?,name=?,description=?,logo_asset_id=?,cover_asset_id=?,website_url=?,github_url=?,technologies_json=?,category=?,status=?,started_on=?,featured=?,visible=?,updated_at=datetime('now') WHERE id=?")
 .bind(d.slug,d.name,d.description||null,d.logoAssetId,d.coverAssetId,d.websiteUrl,d.githubUrl,JSON.stringify(d.technologies),d.category||null,d.status,d.startedOn,d.featured?1:0,d.visible?1:0,id).run();
 await saveChildren(c.env.DB,id,d);return c.json({item:await load(c.env.DB,id)});
});
projectRoutes.post("/projects/:id/duplicate",async c=>{
 const p=await load(c.env.DB,c.req.param("id"));if(!p)return apiError(c,404,"not_found","Project not found.");
 let slug=makeSlug(p.name+"-copy"),n=2;while(await slugTaken(c.env.DB,slug))slug=makeSlug(p.name+"-copy")+"-"+n++;
 const id=randomId(12);
 await c.env.DB.prepare("INSERT INTO projects (id,slug,name,description,logo_asset_id,cover_asset_id,website_url,github_url,technologies_json,category,status,started_on,featured,visible,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
 .bind(id,slug,p.name+" copy",p.description,p.logoAssetId,p.coverAssetId,p.websiteUrl,p.githubUrl,JSON.stringify(p.technologies),p.category,p.status,p.startedOn,0,0,p.sortOrder+1).run();
 await saveChildren(c.env.DB,id,{...p,slug,name:p.name+" copy",featured:false,visible:false} as z.infer<typeof bodySchema>);
 return c.json({item:await load(c.env.DB,id)},201);
});
projectRoutes.delete("/projects/:id",async c=>{
 const row=await c.env.DB.prepare("DELETE FROM projects WHERE id=?").bind(c.req.param("id")).run();
 return row.meta.changes?c.json({ok:true}):apiError(c,404,"not_found","Project not found.");
});
