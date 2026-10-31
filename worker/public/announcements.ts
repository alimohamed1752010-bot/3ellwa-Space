import { Hono } from "hono";
import type { AppEnv } from "../env";
export const publicAnnouncementRoutes=new Hono<AppEnv>();
publicAnnouncementRoutes.get("/announcements",async c=>{
 const rows=await c.env.DB.prepare(
  "SELECT id,title,body,style FROM announcements WHERE visible=1 AND (starts_at IS NULL OR datetime(starts_at)<=datetime('now')) AND (ends_at IS NULL OR datetime(ends_at)>datetime('now')) ORDER BY created_at DESC LIMIT 3"
 ).all<{id:string;title:string;body:string|null;style:string}>();
 c.header("Cache-Control","public, max-age=30, stale-while-revalidate=120");
 return c.json({items:rows.results});
});
