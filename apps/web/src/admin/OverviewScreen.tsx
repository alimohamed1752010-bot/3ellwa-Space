import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {api} from "../shared/api";
import {Card,CardBody} from "../shared/ui";
type Summary={summary:{views:number;visitors:number;clicks:number}};
const tiles=[["Profile","Update your identity and status.","/profile"],["Links","Manage destinations and track clicks.","/links"],["Layout","Arrange and publish homepage sections.","/layout"],["Appearance","Adjust the site's visual system.","/appearance"],["Media Library","Organize images and uploads.","/media"],["Widgets","Configure homepage widgets.","/widgets"]];
export default function OverviewScreen(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{api.get<Summary>("/api/admin/analytics/summary?days=7").then(setData).catch(()=>setData(null));},[]);
 return <div className="rise"><div><h1 className="text-xl font-medium">Overview</h1><p className="mt-1 text-sm text-muted">Your space at a glance.</p></div>
 <div className="mt-6 grid gap-3 sm:grid-cols-3">{[["7-day page views",data?.summary.views],["7-day visitors",data?.summary.visitors],["7-day link clicks",data?.summary.clicks]].map(([label,value])=><Card key={String(label)}><CardBody><p className="text-xs text-muted">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value===undefined?"—":new Intl.NumberFormat().format(Number(value))}</p></CardBody></Card>)}</div>
 <div className="mt-7 flex items-center justify-between"><h2 className="font-medium">Quick actions</h2><Link className="text-sm text-accent-soft hover:underline" to="/analytics">View analytics →</Link></div>
 <div className="mt-3 grid gap-3 sm:grid-cols-2">{tiles.map(([title,description,href])=><Link key={href} to={href} className="rounded-card border border-line bg-surface p-4 transition-colors hover:border-accent/60"><h3 className="text-sm font-medium">{title}</h3><p className="mt-1 text-xs text-muted">{description}</p></Link>)}</div>
 </div>;
}
