import {Hono} from "hono";
import {z} from "zod";
import type {AppEnv} from "../env";
import {sha256Hex} from "../lib/crypto";
import {browserOf,deviceOf} from "../lib/links";
import {apiError} from "../lib/http";
import {parseBody} from "../lib/validate";
export const publicAnalyticsRoutes=new Hono<AppEnv>();
const schema=z.object({path:z.string().trim().min(1).max(180)}).strict();
publicAnalyticsRoutes.post("/hit",async c=>{
 const p=await parseBody(c,schema);if("res"in p)return p.res;
 const path=p.data.path.split("?")[0].split("#")[0];
 if(!path.startsWith("/")||path.startsWith("/api/")||path.startsWith("/admin"))return apiError(c,400,"invalid_path","This path cannot be tracked.");
 const ua=(c.req.header("user-agent")??"").slice(0,300);
 const ip=(c.req.header("cf-connecting-ip")??"unknown").slice(0,80);
 const day=new Date().toISOString().slice(0,10);
 const visitor=(await sha256Hex(ip+"|"+ua+"|"+day)).slice(0,32);
 let referrer:string|null=null;
 try{const host=new URL(c.req.header("referer")??"").hostname;if(host&&host!==new URL(c.req.url).hostname)referrer=host.slice(0,100);}catch{}
 await c.env.DB.prepare("INSERT INTO analytics_events (type,path,referrer_host,device,browser,visitor_hash) VALUES ('pageview',?,?,?,?,?)")
 .bind(path.slice(0,180),referrer,deviceOf(ua),browserOf(ua),visitor).run();
 c.header("Cache-Control","no-store");
 return c.json({ok:true},202);
});
