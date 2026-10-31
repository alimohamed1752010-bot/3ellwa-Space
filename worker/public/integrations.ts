import {Hono} from "hono";
import type {AppEnv} from "../env";
import {apiError} from "../lib/http";
export const publicIntegrationRoutes=new Hono<AppEnv>();
publicIntegrationRoutes.get("/integrations/:provider/data",async c=>{
 const provider=c.req.param("provider");
 if(provider!=="github"&&provider!=="minecraft")return apiError(c,404,"not_found","Integration not found.");
 const row=await c.env.DB.prepare("SELECT enabled,status,config_json,last_checked_at FROM integrations WHERE provider=?").bind(provider).first<{enabled:number;status:string;config_json:string;last_checked_at:string|null}>();
 if(!row||!row.enabled||row.status!=="ok")return apiError(c,404,"not_found","Integration data is not public.");
 let stored:any={};try{stored=JSON.parse(row.config_json??"{}");}catch{}
 if(!stored.cache||typeof stored.cache!=="object")return apiError(c,404,"not_found","Integration data has not been refreshed.");
 c.header("Cache-Control","public, max-age=60, stale-while-revalidate=300");
 return c.json({provider,data:stored.cache,updatedAt:stored.cacheUpdatedAt??row.last_checked_at});
});
