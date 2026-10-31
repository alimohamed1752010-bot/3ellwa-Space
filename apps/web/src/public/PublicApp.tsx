import { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Button, Card } from "../shared/ui";
import LinksPage, { LinksSection } from "./LinksPage";
import PublicPage from "../PublicPage";
import ProjectsPage from "./ProjectsPage";
import LocalTime from "./LocalTime";
import TypingSubtitle from "./TypingSubtitle";
import WidgetBlock from "./WidgetBlock";
import { useLinks } from "./useLinks";
import { isEmptySite, PublicSiteProvider, usePublicSite } from "./useSite";
import { api } from "../shared/api";
import type { PublicSite } from "./useSite";

function Orb() {
  return (
    <div
      aria-hidden
      className="mx-auto size-14 rounded-full shadow-[0_0_40px_-6px_rgb(139_92_246/0.65)]"
      style={{ background: "radial-gradient(circle at 35% 30%, #c4b5fd, #6d28d9 70%)" }}
    />
  );
}

function EmptyState() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="rise w-full max-w-sm px-8 py-10 text-center">
        <Orb />
        <h1 className="mt-6 text-lg font-medium">This space is being set up</h1>
        <p className="mt-2 text-sm text-muted">Nothing has been published yet. Check back soon.</p>
      </Card>
    </main>
  );
}

function Spinner() {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading">
      <span className="size-5 animate-spin rounded-full border-2 border-accent-soft border-t-transparent" />
    </div>
  );
}

function SiteError({ retry }: { retry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="rise w-full max-w-sm px-8 py-10 text-center" role="alert">
        <h1 className="text-lg font-medium">Could not load this page</h1>
        <p className="mt-2 text-sm text-muted">Check your connection and try again.</p>
        <Button className="mt-5" variant="secondary" onClick={retry}>Try again</Button>
      </Card>
    </main>
  );
}

export function Menu({ items }: { items: PublicSite["navigation"] }) {
  if (items.length === 0) return null;
  const cls = "rounded-control px-3 py-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink";
  return (
    <nav aria-label="Main" className="mx-auto flex w-full max-w-2xl flex-wrap justify-center gap-1 px-4 pt-5">
      {items.map((n) =>
        n.href.startsWith("/") ? (
          <Link key={n.id} to={n.href} target={n.newTab ? "_blank" : undefined} className={cls}>{n.label}</Link>
        ) : (
          <a key={n.id} href={n.href} target={n.newTab ? "_blank" : undefined} rel="noopener noreferrer" className={cls}>{n.label}</a>
        )
      )}
    </nav>
  );
}

const DOT = { online: "bg-ok", offline: "bg-muted" } as const;

function ProfileView({ site }: { site: PublicSite }) {
  const p = site.profile;
  useEffect(() => { document.title = site.site.title; }, [site.site.title]);
  const name = p.displayName || p.username || "";
  return (
      <div className="w-full">
        <Card className="rise overflow-hidden">
          <div className="aspect-[3/1] w-full bg-gradient-to-br from-accent-strong/30 via-raised to-surface">
            {p.bannerUrl && <img src={p.bannerUrl} alt="" className="size-full object-cover" />}
          </div>
          <div className="px-5 pb-7 sm:px-8">
            <div className="-mt-12 flex items-end sm:-mt-14">
              <div className="size-24 shrink-0 overflow-hidden rounded-full border-4 border-surface bg-raised sm:size-28">
                {p.avatarUrl ? <img src={p.avatarUrl} alt={name ? `${name}'s avatar` : "Avatar"} className="size-full object-cover" /> : <div aria-hidden className="size-full" style={{ background: "radial-gradient(circle at 35% 30%, #c4b5fd, #6d28d9 70%)" }} />}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              {name && <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>}
              {p.badges.map((b, i) => (
                <span key={i} className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent-soft" style={b.color ? { borderColor: b.color + "66", color: b.color } : undefined}>{b.label}</span>
              ))}
            </div>
            {p.username && p.displayName && <p className="text-sm text-muted">@{p.username}</p>}

            <div className="mt-3"><TypingSubtitle phrases={p.subtitles} typing={p.typingEnabled} /></div>

            {(p.onlineMode !== "hidden" || p.statusText) && (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink">
                {p.onlineMode !== "hidden" && (
                  <>
                    <span aria-hidden className={`size-2.5 rounded-full ${DOT[p.onlineMode]}`} />
                    <span className="sr-only">{p.onlineMode === "online" ? "Online." : "Offline."}</span>
                  </>
                )}
                {p.statusText}
              </p>
            )}

            {(p.location || p.timezone) && (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {p.location && <span>{p.location}</span>}
                {p.timezone && <LocalTime timezone={p.timezone} />}
              </p>
            )}

            {p.shortBio && <p className="mt-5 text-base leading-relaxed text-ink">{p.shortBio}</p>}
            {p.extendedBio && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{p.extendedBio}</p>}

            {site.social.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Social links">
                {site.social.map((s) => (
                  <li key={s.id}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer me" className="inline-flex h-9 items-center rounded-control border border-line bg-raised px-3 text-sm capitalize text-ink transition-colors hover:border-accent hover:text-accent-soft">
                      {s.label || s.platform}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
  );
}

function ProjectsHomeSection({title}:{title:string}) {
  const [items,setItems]=useState<Array<{id:string;slug:string;name:string;description:string;coverUrl:string|null;logoUrl:string|null;category:string;featured:boolean}>>([]);
  useEffect(()=>{let live=true;api.get<{items:typeof items}>("/api/public/projects").then(r=>{if(live)setItems(r.items.slice(0,4));}).catch(()=>{if(live)setItems([]);});return()=>{live=false;};},[]);
  if(!items.length)return null;
  return <section><h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">{title||"Projects"}</h2><div className="grid gap-3 sm:grid-cols-2">{items.map(p=><Link key={p.id} to={"/projects/"+p.slug} className="overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-accent/60"><div className="aspect-[16/7] bg-raised">{p.coverUrl?<img src={p.coverUrl} alt="" loading="lazy" className="size-full object-cover"/>:p.logoUrl?<div className="grid size-full place-items-center"><img src={p.logoUrl} alt="" className="size-14 rounded-xl object-cover"/></div>:null}</div><div className="p-4"><p className="text-[11px] uppercase tracking-wider text-accent-soft">{p.category}</p><h3 className="mt-1 text-sm font-medium">{p.name}</h3><p className="mt-1 line-clamp-2 text-xs text-muted">{p.description}</p></div></Link>)}</div><Link to="/projects" className="mt-3 inline-block text-sm text-accent-soft underline-offset-4 hover:underline">All projects →</Link></section>;
}

function Home() {
  const s = usePublicSite();
  const links = useLinks();
  if (s.status === "loading") return <Spinner />;
  if (s.status === "error" || !s.data) return <SiteError retry={s.retry} />;
  if (isEmptySite(s.data) && !(links.status==="ready" && (links.data?.total??0)>0)) return <EmptyState />;
  const sections=s.data.layout?.sections??[{id:"profile",type:"profile",title:"",body:"",assetId:null,widgetId:null,enabled:true,visibleDesktop:true,visibleMobile:true,imageUrl:null},{id:"links",type:"links",title:"",body:"",assetId:null,widgetId:null,enabled:true,visibleDesktop:true,visibleMobile:true,imageUrl:null}];
  return <div className="min-h-screen pb-16"><Menu items={s.data.navigation}/><main className="mx-auto flex w-full flex-col gap-[var(--3w-spacing)] px-4 pt-6" style={{maxWidth:"var(--3w-container-width)"}}>
    {sections.filter(x=>x.enabled).map(section=>{
      const visibility=`${section.visibleMobile?"":"hidden md:block"} ${section.visibleDesktop?"":"md:hidden"}`;
      if(section.type==="profile")return <div key={section.id} className={visibility}><ProfileView site={s.data!}/></div>;
      if(section.type==="links")return <div key={section.id} className={visibility}>{links.status==="ready"&&links.data&&<LinksSection data={links.data}/>}</div>;
      if(section.type==="projects")return <div key={section.id} className={visibility}><ProjectsHomeSection title={section.title}/></div>;
      if(section.type==="text")return <section key={section.id} className={visibility}><Card className="p-5"><h2 className="mb-2 text-sm font-medium">{section.title||"About"}</h2><p className="whitespace-pre-wrap text-sm leading-7 text-muted">{section.body}</p></Card></section>;
      if(section.type==="gallery")return section.imageUrl?<figure key={section.id} className={visibility}><Card className="overflow-hidden"><img src={section.imageUrl} alt={section.title} loading="lazy" className="max-h-[36rem] w-full object-cover"/>{section.title&&<figcaption className="p-3 text-xs text-muted">{section.title}</figcaption>}{section.body&&<p className="px-3 pb-3 text-sm text-muted">{section.body}</p>}</Card></figure>:null;
      if(section.type==="spacer")return <div key={section.id} aria-hidden className={visibility} style={{height:Math.min(400,Math.max(0,Number(section.body)||32))}}/>;
      if(section.type==="widget")return section.widgetId?<div key={section.id} className={visibility}><WidgetBlock id={section.widgetId} title={section.title}/></div>:<section key={section.id} className={visibility}><Card className="p-5"><h2 className="text-sm font-medium">{section.title||"Widget"}</h2><p className="mt-2 text-xs text-muted">{section.body||"Choose a widget in Layout to display it here."}</p></Card></section>;
      return null;
    })}
  </main></div>;
}

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="rise text-center">
        <p className="font-mono text-sm tracking-widest text-accent-soft">404</p>
        <h1 className="mt-2 text-lg font-medium">Nothing here</h1>
        <p className="mt-2 text-sm text-muted">This page does not exist.</p>
        <Link to="/" className="mt-5 inline-block text-sm text-accent-soft underline-offset-4 hover:underline">
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}

export default function PublicApp() {
  return (
    <BrowserRouter>
      <PublicSiteProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:slug" element={<ProjectsPage />} />
        <Route path="/:slug" element={<PublicPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </PublicSiteProvider>
    </BrowserRouter>
  );
}
