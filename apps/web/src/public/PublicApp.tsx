import { useEffect } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Button, Card } from "../shared/ui";
import LinksPage, { LinksSection } from "./LinksPage";
import PublicPage from "../PublicPage";
import ProjectsPage from "./ProjectsPage";
import LocalTime from "./LocalTime";
import TypingSubtitle from "./TypingSubtitle";
import { useLinks } from "./useLinks";
import { isEmptySite, useSite } from "./useSite";
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
  const links = useLinks(); // a failed or empty links request just shows nothing
  useEffect(() => { document.title = site.site.title; }, [site.site.title]);
  const name = p.displayName || p.username || "";
  return (
    <div className="min-h-screen pb-16">
      <Menu items={site.navigation} />
      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
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
      </main>
      {links.status === "ready" && links.data && <LinksSection data={links.data} />}
    </div>
  );
}

function Home() {
  const s = useSite();
  if (s.status === "loading") return <Spinner />;
  if (s.status === "error" || !s.data) return <SiteError retry={s.retry} />;
  if (isEmptySite(s.data)) return <EmptyState />;
  return <ProfileView site={s.data} />;
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:slug" element={<ProjectsPage />} />
        <Route path="/:slug" element={<PublicPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
