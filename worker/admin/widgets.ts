import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { parseBody } from "../lib/validate";

export const widgetRoutes = new Hono<AppEnv>();
const configSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(4000).default("") }),
  z.object({ type: z.literal("clock"), timezone: z.string().max(80).default("UTC"), label: z.string().max(80).default("") }),
  z.object({ type: z.literal("countdown"), targetAt: z.string().datetime({ offset: true }), label: z.string().max(100).default("Countdown") }),
  z.object({ type: z.literal("quote"), text: z.string().trim().min(1).max(1000), author: z.string().max(120).default("") }),
]);
const bodySchema = z.object({
  name: z.string().trim().min(1).max(80), type: z.enum(["text", "clock", "countdown", "quote"]),
  enabled: z.boolean().default(true), displayMode: z.enum(["card", "inline"]).default("card"),
  visibleDesktop: z.boolean().default(true), visibleMobile: z.boolean().default(true),
  refreshSeconds: z.number().int().min(60).max(86400).default(300), config: z.record(z.string(), z.unknown()).default({}),
}).strict();
type WidgetRow = {id:string;type:string;name:string;enabled:number;display_mode:string;visible_desktop:number;visible_mobile:number;refresh_seconds:number;cache_json:string|null;cache_updated_at:string|null;last_error:string|null;sort_order:number;created_at:string;updated_at:string;config_json:string|null};
const SELECT = `SELECT w.*, (SELECT value_json FROM widget_settings s WHERE s.widget_id=w.id AND s.key='config') AS config_json FROM widgets w`;
function parseJson(raw:string|null) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function output(r:WidgetRow) { return {id:r.id,type:r.type,name:r.name,enabled:!!r.enabled,displayMode:r.display_mode,visibleDesktop:!!r.visible_desktop,visibleMobile:!!r.visible_mobile,refreshSeconds:r.refresh_seconds,config:parseJson(r.config_json),cacheUpdatedAt:r.cache_updated_at,lastError:r.last_error,sortOrder:r.sort_order,createdAt:r.created_at,updatedAt:r.updated_at}; }
async function load(db:D1Database,id:string) { const row=await db.prepare(`${SELECT} WHERE w.id=?`).bind(id).first<WidgetRow>(); return row?output(row):null; }
async function list(db:D1Database) { const rows=await db.prepare(`${SELECT} ORDER BY w.sort_order,w.created_at,w.id`).all<WidgetRow>(); return rows.results.map(output); }
function parseConfig(type:string,config:unknown) {
  const parsed=configSchema.safeParse({...(config as Record<string,unknown>),type});
  if(!parsed.success)return null;
  if(parsed.data.type==="clock") { try { new Intl.DateTimeFormat("en",{timeZone:parsed.data.timezone}); } catch { return null; } }
  return parsed.data;
}
async function saveConfig(db:D1Database,id:string,config:unknown) {
  await db.prepare("INSERT INTO widget_settings (widget_id,key,value_json) VALUES (?,'config',?) ON CONFLICT(widget_id,key) DO UPDATE SET value_json=excluded.value_json").bind(id,JSON.stringify(config)).run();
}
widgetRoutes.get("/widgets",async c=>c.json({items:await list(c.env.DB)}));
widgetRoutes.post("/widgets",async c=>{
  const p=await parseBody(c,bodySchema);if("res"in p)return p.res;const d=p.data,config=parseConfig(d.type,d.config);
  if(!config)return apiError(c,400,"invalid_widget_config","The configuration is invalid for this widget type.");
  const id=randomId(12),max=await c.env.DB.prepare("SELECT COALESCE(MAX(sort_order),-1) AS n FROM widgets").first<{n:number}>();
  await c.env.DB.prepare("INSERT INTO widgets (id,type,name,enabled,display_mode,visible_desktop,visible_mobile,refresh_seconds,sort_order) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,d.type,d.name,d.enabled?1:0,d.displayMode,d.visibleDesktop?1:0,d.visibleMobile?1:0,d.refreshSeconds,(max?.n??-1)+1).run();
  await saveConfig(c.env.DB,id,config);return c.json({item:await load(c.env.DB,id)},201);
});
widgetRoutes.put("/widgets/order",async c=>{
  const p=await parseBody(c,z.object({ids:z.array(z.string().max(100)).max(100)}));if("res"in p)return p.res;
  await c.env.DB.batch(p.data.ids.map((id,i)=>c.env.DB.prepare("UPDATE widgets SET sort_order=?,updated_at=datetime('now') WHERE id=?").bind(i,id)));
  return c.json({items:await list(c.env.DB)});
});
widgetRoutes.put("/widgets/:id",async c=>{
  const p=await parseBody(c,bodySchema);if("res"in p)return p.res;const id=c.req.param("id"),d=p.data;
  if(!await c.env.DB.prepare("SELECT 1 FROM widgets WHERE id=?").bind(id).first())return apiError(c,404,"not_found","Widget not found.");
  const config=parseConfig(d.type,d.config);if(!config)return apiError(c,400,"invalid_widget_config","The configuration is invalid for this widget type.");
  await c.env.DB.prepare("UPDATE widgets SET type=?,name=?,enabled=?,display_mode=?,visible_desktop=?,visible_mobile=?,refresh_seconds=?,last_error=NULL,updated_at=datetime('now') WHERE id=?").bind(d.type,d.name,d.enabled?1:0,d.displayMode,d.visibleDesktop?1:0,d.visibleMobile?1:0,d.refreshSeconds,id).run();
  await saveConfig(c.env.DB,id,config);return c.json({item:await load(c.env.DB,id)});
});
widgetRoutes.post("/widgets/:id/duplicate",async c=>{
  const source=await load(c.env.DB,c.req.param("id"));if(!source)return apiError(c,404,"not_found","Widget not found.");
  const id=randomId(12),max=await c.env.DB.prepare("SELECT COALESCE(MAX(sort_order),-1) AS n FROM widgets").first<{n:number}>();
  await c.env.DB.prepare("INSERT INTO widgets (id,type,name,enabled,display_mode,visible_desktop,visible_mobile,refresh_seconds,sort_order) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,source.type,source.name+" copy",0,source.displayMode,source.visibleDesktop?1:0,source.visibleMobile?1:0,source.refreshSeconds,(max?.n??-1)+1).run();
  await saveConfig(c.env.DB,id,source.config);return c.json({item:await load(c.env.DB,id)},201);
});
widgetRoutes.post("/widgets/:id/test-refresh",async c=>{
  const item=await load(c.env.DB,c.req.param("id"));if(!item)return apiError(c,404,"not_found","Widget not found.");
  const checkedAt=new Date().toISOString(),payload={type:item.type,config:item.config,checkedAt};
  await c.env.DB.prepare("UPDATE widgets SET cache_json=?,cache_updated_at=?,last_error=NULL,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(payload),checkedAt,item.id).run();
  return c.json({ok:true,item:await load(c.env.DB,item.id)});
});
widgetRoutes.delete("/widgets/:id",async c=>{
  const result=await c.env.DB.prepare("DELETE FROM widgets WHERE id=?").bind(c.req.param("id")).run();
  return result.meta.changes?c.json({ok:true}):apiError(c,404,"not_found","Widget not found.");
});
