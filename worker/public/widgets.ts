import { Hono } from "hono";
import type { AppEnv } from "../env";
import { apiError } from "../lib/http";
export const publicWidgetRoutes = new Hono<AppEnv>();
type Row={id:string;type:string;name:string;display_mode:string;visible_desktop:number;visible_mobile:number;cache_json:string|null;config_json:string|null};
publicWidgetRoutes.get("/widgets/:id/data",async c=>{
  const id=c.req.param("id");if(!id||id.length>100)return apiError(c,404,"not_found","Widget not found.");
  const row=await c.env.DB.prepare(`SELECT w.id,w.type,w.name,w.display_mode,w.visible_desktop,w.visible_mobile,
    (SELECT value_json FROM widget_settings s WHERE s.widget_id=w.id AND s.key='config') AS config_json,
    w.cache_json FROM widgets w WHERE w.id=? AND w.enabled=1`).bind(id).first<Row>();
  if(!row)return apiError(c,404,"not_found","Widget not found.");
  let config:Record<string,unknown>={};try{const v=JSON.parse(row.config_json??"{}");if(v&&typeof v==="object"&&!Array.isArray(v))config=v;}catch{}
  let cache:unknown=null;try{cache=row.cache_json?JSON.parse(row.cache_json):null;}catch{}
  c.header("Cache-Control","public, max-age=30, stale-while-revalidate=60");
  return c.json({widget:{id:row.id,type:row.type,name:row.name,displayMode:row.display_mode,visibleDesktop:!!row.visible_desktop,visibleMobile:!!row.visible_mobile,config,cache}});
});
