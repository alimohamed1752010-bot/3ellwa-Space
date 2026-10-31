import {Hono} from "hono";
import {z} from "zod";
import type {AppEnv} from "../env";
import {randomId} from "../lib/crypto";
import {apiError} from "../lib/http";
import {parseBody} from "../lib/validate";

export const integrationRoutes=new Hono<AppEnv>();
const providerSchema=z.enum(["github","minecraft"]);
const githubSchema=z.object({username:z.string().trim().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/)});
const minecraftSchema=z.object({address:z.string().trim().min(1).max(255).regex(/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/)});
type Row={id:string;provider:string;enabled:number;config_json:string;status:"unconfigured"|"ok"|"error";last_checked_at:string|null;last_error:string|null;updated_at:string};
type Stored={settings:Record<string,string>;cache:Record<string,unknown>|null;cacheUpdatedAt:string|null};
function parseStored(raw:string):Stored{try{const v=JSON.parse(raw);if(v&&typeof v==="object"&&!Array.isArray(v))return {settings:v.settings&&typeof v.settings==="object"?v.settings:{},cache:v.cache&&typeof v.cache==="object"?v.cache:null,cacheUpdatedAt:typeof v.cacheUpdatedAt==="string"?v.cacheUpdatedAt:null};}catch{}return {settings:{},cache:null,cacheUpdatedAt:null};}
function output(r:Row){const v=parseStored(r.config_json);return {id:r.id,provider:r.provider,enabled:!!r.enabled,config:v.settings,status:r.status,lastCheckedAt:r.last_checked_at,lastError:r.last_error,cacheUpdatedAt:v.cacheUpdatedAt};}
async function load(db:D1Database,provider:string){return db.prepare("SELECT * FROM integrations WHERE provider=?").bind(provider).first<Row>();}
function cleanGithub(v:any){return {login:String(v.login??""),name:typeof v.name==="string"?v.name:null,avatarUrl:typeof v.avatar_url==="string"&&v.avatar_url.startsWith("https://avatars.githubusercontent.com/")?v.avatar_url:null,profileUrl:typeof v.html_url==="string"&&v.html_url.startsWith("https://github.com/")?v.html_url:null,bio:typeof v.bio==="string"?v.bio:null,publicRepos:Number(v.public_repos)||0,followers:Number(v.followers)||0,following:Number(v.following)||0};}
async function fetchProvider(provider:"github"|"minecraft",settings:Record<string,string>){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
 try{
  if(provider==="github"){
   const username=settings.username;
   if(!username||!githubSchema.safeParse({username}).success)throw new Error("Enter a valid GitHub username.");
   const r=await fetch("https://api.github.com/users/"+encodeURIComponent(username),{headers:{"accept":"application/vnd.github+json","user-agent":"3ellwa-space"},signal:controller.signal});
   if(!r.ok)throw new Error(r.status===404?"GitHub user not found.":`GitHub returned HTTP ${r.status}.`);
   return {provider,data:cleanGithub(await r.json())};
  }
  const address=settings.address;
  if(!address||!minecraftSchema.safeParse({address}).success)throw new Error("Enter a valid Minecraft server address.");
  const r=await fetch("https://api.mcsrvstat.us/3/"+encodeURIComponent(address),{headers:{"accept":"application/json"},signal:controller.signal});
  if(!r.ok)throw new Error(`Minecraft status provider returned HTTP ${r.status}.`);
  const v:any=await r.json();
  const online=!!v.online;
  return {provider,data:{online,host:typeof v.hostname==="string"?v.hostname:address,port:Number(v.port)||null,players:{online:Number(v.players?.online)||0,max:Number(v.players?.max)||0},version:typeof v.version==="string"?v.version:null,motd:Array.isArray(v.motd?.clean)?v.motd.clean.filter((x:any)=>typeof x==="string").slice(0,4):[]}};
 }catch(e){if(e instanceof Error&&e.name==="AbortError")throw new Error("The provider timed out.");throw e;}
 finally{clearTimeout(timer);}
}
integrationRoutes.get("/integrations",async c=>{
 const rows=await c.env.DB.prepare("SELECT * FROM integrations ORDER BY provider").all<Row>();
 return c.json({items:rows.results.map(output)});
});
integrationRoutes.put("/integrations/:provider",async c=>{
 const provider=providerSchema.safeParse(c.req.param("provider"));
 if(!provider.success)return apiError(c,404,"not_found","Integration provider not found.");
 const schema=provider.data==="github"?githubSchema:minecraftSchema;
 const p=await parseBody(c,z.object({enabled:z.boolean().default(false),config:schema}).strict());
 if("res"in p)return p.res;
 const current=await load(c.env.DB,provider.data);
 const old=current?parseStored(current.config_json):null;
 const stored:Stored={settings:p.data.config as Record<string,string>,cache:old?.cache??null,cacheUpdatedAt:old?.cacheUpdatedAt??null};
 const id=current?.id??randomId(12);
 await c.env.DB.prepare(`INSERT INTO integrations (id,provider,enabled,config_json,status,last_checked_at,last_error,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now'))
 ON CONFLICT(provider) DO UPDATE SET enabled=excluded.enabled,config_json=excluded.config_json,status=CASE WHEN integrations.config_json=excluded.config_json THEN integrations.status ELSE 'unconfigured' END,last_error=NULL,updated_at=datetime('now')`)
 .bind(id,provider.data,p.data.enabled?1:0,JSON.stringify(stored),current?.status??"unconfigured",current?.last_checked_at??null,null).run();
 const row=await load(c.env.DB,provider.data);
 return c.json({item:row?output(row):null});
});
integrationRoutes.post("/integrations/:provider/test",async c=>{
 const provider=providerSchema.safeParse(c.req.param("provider"));
 if(!provider.success)return apiError(c,404,"not_found","Integration provider not found.");
 const row=await load(c.env.DB,provider.data);
 if(!row)return apiError(c,404,"not_found","Save this integration before testing it.");
 const stored=parseStored(row.config_json);
 try{
  const result=await fetchProvider(provider.data,stored.settings);
  const checkedAt=new Date().toISOString();
  const next={...stored,cache:result.data,cacheUpdatedAt:checkedAt};
  await c.env.DB.prepare("UPDATE integrations SET config_json=?,status='ok',last_checked_at=?,last_error=NULL,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(next),checkedAt,row.id).run();
  const fresh=await load(c.env.DB,provider.data);
  return c.json({ok:true,item:fresh?output(fresh):null,preview:result.data});
 }catch(e){
  const message=e instanceof Error?e.message:"Provider check failed.";
  await c.env.DB.prepare("UPDATE integrations SET status='error',last_checked_at=datetime('now'),last_error=?,updated_at=datetime('now') WHERE id=?").bind(message,row.id).run();
  return apiError(c,502,"provider_unavailable",message);
 }
});
