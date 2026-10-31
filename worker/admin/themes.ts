import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { DEFAULT_THEME_TOKENS, parseThemeTokens, themeTokensSchema, type ThemeTokens } from "../lib/theme";
import { mediaUrl } from "../lib/media";
import { parseBody } from "../lib/validate";

export const themeRoutes=new Hono<AppEnv>();
type ThemeRow={id:string;name:string;is_preset:number;is_active:number;tokens_json:string;draft_tokens_json:string|null;version:number;created_at:string;updated_at:string};
const nameSchema=z.string().trim().min(1).max(48);
async function presentTokens(db:D1Database,raw:string){
 const tokens=parseThemeTokens(raw),assetId=tokens.background.assetId;
 let assetUrl:string|null=null;
 if(assetId&&(tokens.background.mode==="image"||tokens.background.mode==="video")){
  const asset=await db.prepare("SELECT id,filename FROM media_assets WHERE id=? AND kind=?").bind(assetId,tokens.background.mode).first<{id:string;filename:string}>();
  if(asset)assetUrl=mediaUrl(asset.id,asset.filename);
 }
 return {...tokens,background:{...tokens.background,assetUrl}};
}
async function rowOut(db:D1Database,r:ThemeRow){
 return {
  id:r.id,name:r.name,isPreset:!!r.is_preset,isActive:!!r.is_active,
  tokens:await presentTokens(db,r.tokens_json),draftTokens:r.draft_tokens_json?await presentTokens(db,r.draft_tokens_json):null,
  version:r.version,createdAt:r.created_at,updatedAt:r.updated_at,
 };
}
async function getTheme(db:D1Database,id:string){return db.prepare("SELECT * FROM themes WHERE id=?").bind(id).first<ThemeRow>();}
async function listThemes(db:D1Database){const rows=(await db.prepare("SELECT * FROM themes ORDER BY is_preset DESC,created_at,rowid").all<ThemeRow>()).results;return Promise.all(rows.map(r=>rowOut(db,r)));}
async function validateBackgroundAsset(db:D1Database,t:ThemeTokens){
 const {mode,assetId}=t.background;
 if(mode!=="image"&&mode!=="video")return null;
 if(!assetId)return "Choose a background file first.";
 const row=await db.prepare("SELECT id FROM media_assets WHERE id=? AND kind=?").bind(assetId,mode).first();
 return row?null:"The selected background file no longer exists or has the wrong type.";
}

themeRoutes.get("/themes",async c=>c.json({items:await listThemes(c.env.DB)}));
themeRoutes.post("/themes",async c=>{
 const p=await parseBody(c,z.object({name:nameSchema,tokens:themeTokensSchema.optional()}));if("res"in p)return p.res;
 const tokens=p.data.tokens??DEFAULT_THEME_TOKENS;
 const bad=await validateBackgroundAsset(c.env.DB,tokens);if(bad)return apiError(c,400,"invalid_background",bad);
 const id=randomId(12),json=JSON.stringify(tokens);
 await c.env.DB.prepare("INSERT INTO themes (id,name,is_preset,is_active,tokens_json,draft_tokens_json) VALUES (?,?,0,0,?,?)").bind(id,p.data.name,json,json).run();
 const row=await getTheme(c.env.DB,id);return c.json({item:await rowOut(c.env.DB,row!)},201);
});
themeRoutes.post("/themes/import",async c=>{
 const p=await parseBody(c,z.object({name:nameSchema,tokens:themeTokensSchema}));if("res"in p)return p.res;
 const bad=await validateBackgroundAsset(c.env.DB,p.data.tokens);if(bad)return apiError(c,400,"invalid_background",bad);
 const id=randomId(12),json=JSON.stringify(p.data.tokens);
 await c.env.DB.prepare("INSERT INTO themes (id,name,is_preset,is_active,tokens_json,draft_tokens_json) VALUES (?,?,0,0,?,?)").bind(id,p.data.name,json,json).run();
 return c.json({item:await rowOut(c.env.DB,(await getTheme(c.env.DB,id))!)},201);
});
themeRoutes.put("/themes/:id/name",async c=>{
 const p=await parseBody(c,z.object({name:nameSchema}));if("res"in p)return p.res;
 const id=c.req.param("id"),row=await getTheme(c.env.DB,id);
 if(!row)return apiError(c,404,"not_found","Theme not found.");
 if(row.is_preset)return apiError(c,403,"preset_locked","Built-in presets cannot be renamed. Duplicate one to customize it.");
 await c.env.DB.prepare("UPDATE themes SET name=?,updated_at=datetime('now') WHERE id=?").bind(p.data.name,id).run();
 return c.json({item:await rowOut(c.env.DB,(await getTheme(c.env.DB,id))!)});
});
themeRoutes.put("/themes/:id/draft",async c=>{
 const p=await parseBody(c,z.object({tokens:themeTokensSchema}));if("res"in p)return p.res;
 const id=c.req.param("id"),row=await getTheme(c.env.DB,id);
 if(!row)return apiError(c,404,"not_found","Theme not found.");
 if(row.is_preset)return apiError(c,403,"preset_locked","Built-in presets cannot be edited. Duplicate one to customize it.");
 const bad=await validateBackgroundAsset(c.env.DB,p.data.tokens);if(bad)return apiError(c,400,"invalid_background",bad);
 await c.env.DB.prepare("UPDATE themes SET draft_tokens_json=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(p.data.tokens),id).run();
 return c.json({item:await rowOut(c.env.DB,(await getTheme(c.env.DB,id))!)});
});
themeRoutes.post("/themes/:id/reset",async c=>{
 const id=c.req.param("id"),row=await getTheme(c.env.DB,id);
 if(!row)return apiError(c,404,"not_found","Theme not found.");
 if(row.is_preset)return apiError(c,403,"preset_locked","Built-in presets cannot be edited.");
 await c.env.DB.prepare("UPDATE themes SET draft_tokens_json=tokens_json,updated_at=datetime('now') WHERE id=?").bind(id).run();
 return c.json({item:await rowOut(c.env.DB,(await getTheme(c.env.DB,id))!)});
});
themeRoutes.post("/themes/:id/publish",async c=>{
 const id=c.req.param("id"),row=await getTheme(c.env.DB,id);
 if(!row)return apiError(c,404,"not_found","Theme not found.");
 if(row.is_preset)return apiError(c,403,"preset_locked","Built-in presets cannot be edited.");
 if(!row.draft_tokens_json)return apiError(c,409,"no_draft","There are no unpublished theme changes.");
 const tokens=parseThemeTokens(row.draft_tokens_json),bad=await validateBackgroundAsset(c.env.DB,tokens);
 if(bad)return apiError(c,400,"invalid_background",bad);
 await c.env.DB.prepare("UPDATE themes SET tokens_json=draft_tokens_json,draft_tokens_json=NULL,version=version+1,updated_at=datetime('now') WHERE id=?").bind(id).run();
 return c.json({item:await rowOut(c.env.DB,(await getTheme(c.env.DB,id))!)});
});
themeRoutes.post("/themes/:id/activate",async c=>{
 const id=c.req.param("id"),row=await getTheme(c.env.DB,id);
 if(!row)return apiError(c,404,"not_found","Theme not found.");
 const tokens=parseThemeTokens(row.tokens_json),bad=await validateBackgroundAsset(c.env.DB,tokens);
 if(bad)return apiError(c,400,"invalid_background",bad);
 await c.env.DB.batch([
  c.env.DB.prepare("UPDATE themes SET is_active=0 WHERE is_active=1"),
  c.env.DB.prepare("UPDATE themes SET is_active=1,updated_at=datetime('now') WHERE id=?").bind(id),
 ]);
 return c.json({item:await rowOut(c.env.DB,(await getTheme(c.env.DB,id))!)});
});
themeRoutes.post("/themes/:id/duplicate",async c=>{
 const id=c.req.param("id"),row=await getTheme(c.env.DB,id);
 if(!row)return apiError(c,404,"not_found","Theme not found.");
 const newId=randomId(12),name=row.name+" copy",json=row.tokens_json;
 await c.env.DB.prepare("INSERT INTO themes (id,name,is_preset,is_active,tokens_json,draft_tokens_json) VALUES (?,?,0,0,?,?)").bind(newId,name.slice(0,48),json,json).run();
 return c.json({item:await rowOut(c.env.DB,(await getTheme(c.env.DB,newId))!)},201);
});
themeRoutes.get("/themes/:id/export",async c=>{
 const row=await getTheme(c.env.DB,c.req.param("id"));
 if(!row)return apiError(c,404,"not_found","Theme not found.");
 return c.json({format:"3ellwa-theme",version:1,name:row.name,tokens:parseThemeTokens(row.tokens_json)});
});
themeRoutes.delete("/themes/:id",async c=>{
 const id=c.req.param("id"),row=await getTheme(c.env.DB,id);
 if(!row)return apiError(c,404,"not_found","Theme not found.");
 if(row.is_preset)return apiError(c,403,"preset_locked","Built-in presets cannot be deleted.");
 if(row.is_active)return apiError(c,409,"theme_active","Activate another theme before deleting this one.");
 await c.env.DB.prepare("DELETE FROM themes WHERE id=?").bind(id).run();
 return c.json({ok:true});
});
