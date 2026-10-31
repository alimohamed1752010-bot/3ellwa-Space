import { Hono } from "hono";
import type { AppEnv } from "../env";
import { mediaUrl } from "../lib/media";
export const publicProjectRoutes=new Hono<AppEnv>();
type Row={id:string;slug:string;name:string;description:string|null;logo_asset_id:string|null;logo_name:string|null;cover_asset_id:string|null;cover_name:string|null;website_url:string|null;github_url:string|null;technologies_json:string;category:string|null;status:string;started_on:string|null;featured:number;sort_order:number};
type Link={id:string;label:string;url:string;sort_order:number};
type Gallery={id:string;asset_id:string;filename:string;caption:string|null;sort_order:number};
const tech=(s:string)=>{try{const a=JSON.parse(s);return Array.isArray(a)?a.filter((x:any)=>typeof x==="string"):[];}catch{return [];}};
async function item(db:D1Database,r:Row){
 const [links,gallery]=await Promise.all([
  db.prepare("SELECT id,label,url,sort_order FROM project_links WHERE project_id=? ORDER BY sort_order,rowid").bind(r.id).all<Link>(),
  db.prepare("SELECT g.id,g.asset_id,m.filename,g.caption,g.sort_order FROM project_gallery g JOIN media_assets m ON m.id=g.asset_id WHERE g.project_id=? ORDER BY g.sort_order,g.rowid").bind(r.id).all<Gallery>(),
 ]);
 return {id:r.id,slug:r.slug,name:r.name,description:r.description??"",logoUrl:mediaUrl(r.logo_asset_id,r.logo_name),coverUrl:mediaUrl(r.cover_asset_id,r.cover_name),websiteUrl:r.website_url,githubUrl:r.github_url,technologies:tech(r.technologies_json),category:r.category??"",status:r.status,startedOn:r.started_on,featured:!!r.featured,links:links.results.map(x=>({id:x.id,label:x.label,url:x.url})),gallery:gallery.results.map(x=>({id:x.id,url:mediaUrl(x.asset_id,x.filename),caption:x.caption??""}))};
}
const SELECT="SELECT p.*,lm.filename AS logo_name,cm.filename AS cover_name FROM projects p LEFT JOIN media_assets lm ON lm.id=p.logo_asset_id LEFT JOIN media_assets cm ON cm.id=p.cover_asset_id";
publicProjectRoutes.get("/projects",async c=>{
 const rows=(await c.env.DB.prepare(SELECT+" WHERE p.visible=1 AND p.status!='archived' ORDER BY p.featured DESC,p.sort_order,p.rowid").all<Row>()).results;
 const items=await Promise.all(rows.map(r=>item(c.env.DB,r)));
 c.header("Cache-Control","public, max-age=0, must-revalidate");
 return c.json({items});
});
publicProjectRoutes.get("/projects/:slug",async c=>{
 const slug=c.req.param("slug");
 if(slug.length>80||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return c.json({error:{code:"not_found",message:"Project not found."}},404);
 const r=await c.env.DB.prepare(SELECT+" WHERE p.slug=? AND p.visible=1 AND p.status!='archived'").bind(slug).first<Row>();
 if(!r)return c.json({error:{code:"not_found",message:"Project not found."}},404);
 c.header("Cache-Control","public, max-age=0, must-revalidate");
 return c.json({item:await item(c.env.DB,r)});
});
