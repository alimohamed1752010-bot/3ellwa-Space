import { useEffect, useState } from "react";
import { api, ApiError } from "../shared/api";
import { Button, Card, CardBody, Checkbox, Input, Textarea, useToast } from "../shared/ui";
type Settings={indexingEnabled:boolean;siteTitle:string;siteDescription:string};
const defaults:Settings={indexingEnabled:true,siteTitle:"3ellwa.space",siteDescription:"Personal website, projects, links, and updates."};
export default function SeoPrivacyScreen(){
 const toast=useToast();const [settings,setSettings]=useState<Settings>(defaults);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{api.get<{settings:Settings}>("/api/admin/seo-privacy").then(r=>setSettings(r.settings)).catch(e=>setError(e instanceof ApiError?e.message:"Could not load SEO settings.")).finally(()=>setLoading(false));},[]);
 async function save(){setBusy(true);try{const r=await api.put<{settings:Settings}>("/api/admin/seo-privacy",settings);setSettings(r.settings);toast.show("Privacy and SEO settings saved.","success");}catch(e){toast.show(e instanceof ApiError?e.message:"Could not save settings.","error");}finally{setBusy(false);}}
 if(loading)return <p className="text-sm text-muted">Loading privacy settings…</p>;
 return <div className="rise flex flex-col gap-5"><div><h1 className="text-xl font-medium">SEO & Privacy</h1><p className="mt-1 text-sm text-muted">Control whether search engines can index your public site and manage its default metadata.</p></div>
 {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
 <Card><CardBody><h2 className="font-medium">Search visibility</h2><p className="mt-1 text-sm text-muted">Search indexing is enabled by default. Turning it off prevents search engines to discover eligible public pages. Individual pages still need their own indexing option enabled.</p><div className="mt-4"><Checkbox label="Allow search engines to index eligible public pages" checked={settings.indexingEnabled} onChange={e=>setSettings(s=>({...s,indexingEnabled:e.target.checked}))}/></div><div className="mt-4 rounded-control border border-line bg-raised p-3 text-xs text-muted">{settings.indexingEnabled?"Public pages can be indexed when their page-level setting allows it. robots.txt and sitemap.xml will reflect this choice.":"The public site sends noindex directives and robots.txt blocks crawling. Your public pages remain accessible by direct link."}</div></CardBody></Card>
 <Card><CardBody><h2 className="font-medium">Default metadata</h2><p className="mt-1 text-sm text-muted">Used for the homepage and public routes without page-specific metadata.</p><div className="mt-4 flex flex-col gap-3"><Input label="Site title" maxLength={120} value={settings.siteTitle} onChange={e=>setSettings(s=>({...s,siteTitle:e.target.value}))}/><Textarea label="Site description" maxLength={300} rows={3} value={settings.siteDescription} onChange={e=>setSettings(s=>({...s,siteDescription:e.target.value}))} hint="A short description for search previews and link embeds."/></div></CardBody></Card>
 <Card><CardBody><h2 className="font-medium">Page-level controls</h2><p className="mt-1 text-sm text-muted">Each custom page has its own SEO title, description, and “Allow search engines to index this page” switch in Pages. A page cannot be indexed while site-wide indexing is disabled.</p></CardBody></Card>
 <div><Button onClick={()=>void save()} loading={busy} disabled={!settings.siteTitle.trim()}>Save settings</Button></div>
 </div>;
}
