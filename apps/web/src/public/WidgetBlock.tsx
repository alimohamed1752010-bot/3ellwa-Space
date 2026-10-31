import {useEffect,useMemo,useState} from "react";
import {api} from "../shared/api";
import {Card} from "../shared/ui";

type Data={widget:{id:string;type:"text"|"clock"|"countdown"|"quote"|"github"|"minecraft";name:string;displayMode:"card"|"inline";visibleDesktop:boolean;visibleMobile:boolean;config:Record<string,unknown>;integrationData:Record<string,unknown>|null}};
function remaining(target:string,now:number){const ms=Math.max(0,Date.parse(target)-now);const days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000),minutes=Math.floor(ms%3600000/60000),seconds=Math.floor(ms%60000/1000);return {done:ms<=0,days,hours,minutes,seconds};}
export default function WidgetBlock({id,title}:{id:string;title:string}){
 const [data,setData]=useState<Data|null>(null);const [now,setNow]=useState(Date.now());
 useEffect(()=>{let live=true;api.get<Data>(`/api/public/widgets/${encodeURIComponent(id)}/data`).then(r=>{if(live)setData(r);}).catch(()=>{if(live)setData(null);});return()=>{live=false;};},[id]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
 const w=data?.widget;const config=w?.config??{};
 const time=useMemo(()=>{if(w?.type!=="clock")return "";const timezone=typeof config.timezone==="string"?config.timezone:"UTC";try{return new Intl.DateTimeFormat(undefined,{timeZone:timezone,dateStyle:"medium",timeStyle:"medium"}).format(now);}catch{return new Date(now).toLocaleString();}},[w?.type,config.timezone,now]);
 const countdown=useMemo(()=>w?.type==="countdown"&&typeof config.targetAt==="string"?remaining(config.targetAt,now):null,[w?.type,config.targetAt,now]);
 if(!w)return null;
 const body=<>
  {w.type==="text"&&<p className="whitespace-pre-wrap text-sm leading-7 text-muted">{typeof config.text==="string"?config.text:""}</p>}
  {w.type==="clock"&&<div><p className="text-2xl font-semibold tabular-nums tracking-tight">{time}</p>{typeof config.label==="string"&&config.label&&<p className="mt-1 text-xs text-muted">{config.label}</p>}</div>}
  {w.type==="countdown"&&countdown&&<div><p className="text-2xl font-semibold tabular-nums tracking-tight">{countdown.done?"Time's up":`${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`}</p><p className="mt-1 text-xs text-muted">{typeof config.label==="string"?config.label:"Countdown"}</p></div>}
  {w.type==="github"&&w.integrationData&&<div className="flex items-start gap-3"><img src={String(w.integrationData.avatarUrl??"")} alt="" className="size-12 rounded-full border border-line object-cover"/><div className="min-w-0"><p className="font-medium">{String(w.integrationData.name||w.integrationData.login||"GitHub profile")}</p>{typeof w.integrationData.bio==="string"&&<p className="mt-1 text-sm text-muted">{w.integrationData.bio}</p>}<p className="mt-2 text-xs text-muted">{Number(w.integrationData.publicRepos)||0} public repos · {Number(w.integrationData.followers)||0} followers</p>{typeof w.integrationData.profileUrl==="string"&&<a href={w.integrationData.profileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-accent-soft underline-offset-4 hover:underline">View GitHub profile</a>}</div></div>}
  {w.type==="minecraft"&&w.integrationData&&<div><div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${w.integrationData.online?"bg-ok":"bg-muted"}`}/><span className="font-medium">{w.integrationData.online?"Online":"Offline"}</span></div><p className="mt-2 text-xl font-semibold tabular-nums">{Number((w.integrationData.players as Record<string,unknown>|undefined)?.online)||0}<span className="text-sm font-normal text-muted"> / {Number((w.integrationData.players as Record<string,unknown>|undefined)?.max)||0} players</span></p>{typeof w.integrationData.version==="string"&&<p className="mt-1 text-xs text-muted">{w.integrationData.version}</p>}{Array.isArray(w.integrationData.motd)&&<p className="mt-2 text-sm text-muted">{(w.integrationData.motd as string[]).join(" ")}</p>}</div>}
  {w.type==="quote"&&<blockquote><p className="text-base leading-relaxed">“{typeof config.text==="string"?config.text:""}”</p>{typeof config.author==="string"&&config.author&&<footer className="mt-2 text-xs text-muted">— {config.author}</footer>}</blockquote>}
 </>;
 if(w.displayMode==="inline")return <section aria-label={title||w.name} className="py-2">{title&&<h2 className="mb-2 text-sm font-medium">{title}</h2>}{body}</section>;
 return <Card className="p-5"><h2 className="mb-3 text-sm font-medium">{title||w.name}</h2>{body}</Card>;
}
