import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { randomId } from "../lib/crypto";
import { apiError } from "../lib/http";
import { parseBody } from "../lib/validate";

export const announcementRoutes = new Hono<AppEnv>();
const schema = z.object({
  title:z.string().trim().min(1).max(100),
  body:z.string().trim().max(500),
  style:z.enum(["info","success","warning"]),
  visible:z.boolean(),
  startsAt:z.string().trim().max(40).nullable(),
  endsAt:z.string().trim().max(40).nullable(),
}).strict().refine(d=>!d.startsAt||!d.endsAt||Date.parse(d.endsAt)>Date.parse(d.startsAt),{message:"End time must be after start time."});

type Row={id:string;title:string;body:string|null;style:string;visible:number;starts_at:string|null;ends_at:string|null;created_at:string};
const out=(r:Row)=>({id:r.id,title:r.title,body:r.body??"",style:r.style,visible:!!r.visible,startsAt:r.starts_at,endsAt:r.ends_at,createdAt:r.created_at});

announcementRoutes.get("/announcements",async c=>{
 const rows=await c.env.DB.prepare("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100").all<Row>();
 return c.json({items:rows.results.map(out)});
});
announcementRoutes.post("/announcements",async c=>{
 const p=await parseBody(c,schema);if("res"in p)return p.res;
 const d=p.data,id=randomId(12);
 await c.env.DB.prepare("INSERT INTO announcements (id,title,body,style,visible,starts_at,ends_at) VALUES (?,?,?,?,?,?,?)")
  .bind(id,d.title,d.body||null,d.style,d.visible?1:0,d.startsAt||null,d.endsAt||null).run();
 const row=await c.env.DB.prepare("SELECT * FROM announcements WHERE id=?").bind(id).first<Row>();
 return c.json({item:out(row!)},201);
});
announcementRoutes.put("/announcements/:id",async c=>{
 const p=await parseBody(c,schema);if("res"in p)return p.res;
 const d=p.data,id=c.req.param("id");
 const result=await c.env.DB.prepare("UPDATE announcements SET title=?,body=?,style=?,visible=?,starts_at=?,ends_at=? WHERE id=?")
  .bind(d.title,d.body||null,d.style,d.visible?1:0,d.startsAt||null,d.endsAt||null,id).run();
 if(!result.meta.changes)return apiError(c,404,"not_found","Announcement not found.");
 const row=await c.env.DB.prepare("SELECT * FROM announcements WHERE id=?").bind(id).first<Row>();
 return c.json({item:out(row!)});
});
announcementRoutes.delete("/announcements/:id",async c=>{
 const result=await c.env.DB.prepare("DELETE FROM announcements WHERE id=?").bind(c.req.param("id")).run();
 return result.meta.changes?c.json({ok:true}):apiError(c,404,"not_found","Announcement not found.");
});
