import {Hono} from "hono";
import type {AppEnv} from "../env";
import {apiError} from "../lib/http";
export const analyticsRoutes=new Hono<AppEnv>();
const daysSchema=(raw:string|null)=>raw==="7"||raw==="30"||raw==="90"?Number(raw):30;
analyticsRoutes.get("/analytics/summary",async c=>{
 const days=daysSchema(c.req.query("days")??null);
 const window=`-${days} days`;
 const [totals,previous,daily,pages,referrers,devices,clicks]=await Promise.all([
  c.env.DB.prepare("SELECT COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM analytics_events WHERE type='pageview' AND created_at>=datetime('now',?)").bind(window).first<{views:number;visitors:number}>(),
  c.env.DB.prepare("SELECT COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM analytics_events WHERE type='pageview' AND created_at>=datetime('now',?) AND created_at<datetime('now',?)").bind(`-${days*2} days`,window).first<{views:number;visitors:number}>(),
  c.env.DB.prepare("SELECT date(created_at) AS date,COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM analytics_events WHERE type='pageview' AND created_at>=datetime('now',?) GROUP BY date(created_at) ORDER BY date").bind(window).all<{date:string;views:number;visitors:number}>(),
  c.env.DB.prepare("SELECT path,COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM analytics_events WHERE type='pageview' AND created_at>=datetime('now',?) GROUP BY path ORDER BY views DESC LIMIT 10").bind(window).all<{path:string;views:number;visitors:number}>(),
  c.env.DB.prepare("SELECT referrer_host AS host,COUNT(*) AS views FROM analytics_events WHERE type='pageview' AND created_at>=datetime('now',?) AND referrer_host IS NOT NULL GROUP BY referrer_host ORDER BY views DESC LIMIT 10").bind(window).all<{host:string;views:number}>(),
  c.env.DB.prepare("SELECT device,COUNT(*) AS views FROM analytics_events WHERE type='pageview' AND created_at>=datetime('now',?) GROUP BY device ORDER BY views DESC").bind(window).all<{device:string;views:number}>(),
  c.env.DB.prepare("SELECT COUNT(*) AS clicks FROM analytics_events WHERE type='link_click' AND created_at>=datetime('now',?)").bind(window).first<{clicks:number}>()
 ]);
 const pct=(now:number,old:number)=>old===0?null:Math.round((now-old)/old*100);
 return c.json({days,summary:{views:totals?.views??0,visitors:totals?.visitors??0,clicks:clicks?.clicks??0,viewsChange:pct(totals?.views??0,previous?.views??0),visitorsChange:pct(totals?.visitors??0,previous?.visitors??0)},daily:daily.results,pages:pages.results,referrers:referrers.results,devices:devices.results});
});
analyticsRoutes.delete("/analytics/events",async c=>{
 const before=await c.env.DB.prepare("DELETE FROM analytics_events WHERE created_at<datetime('now','-90 days')").run();
 return c.json({ok:true,deleted:before.meta.changes});
});
