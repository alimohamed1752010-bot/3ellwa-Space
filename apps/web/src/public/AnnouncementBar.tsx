import { useEffect, useState } from "react";
import { api } from "../shared/api";
type Notice={id:string;title:string;body:string|null;style:"info"|"success"|"warning"};
const styles={info:"border-accent/30 bg-accent/10 text-ink",success:"border-ok/30 bg-ok/10 text-ink",warning:"border-warning/30 bg-warning/10 text-ink"};
export default function AnnouncementBar(){
 const [items,setItems]=useState<Notice[]>([]);
 useEffect(()=>{let live=true;api.get<{items:Notice[]}>("/api/public/announcements").then(r=>{if(live)setItems(r.items);}).catch(()=>{});return()=>{live=false;};},[]);
 if(!items.length)return null;
 return <aside aria-label="Site announcements" className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 pt-3">{items.map(item=><div key={item.id} className={"rounded-card border px-4 py-3 "+styles[item.style]}><p className="text-sm font-medium">{item.title}</p>{item.body&&<p className="mt-1 whitespace-pre-wrap text-xs opacity-80">{item.body}</p>}</div>)}</aside>;
}
