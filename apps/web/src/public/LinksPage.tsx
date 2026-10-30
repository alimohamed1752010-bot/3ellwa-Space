import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "../shared/ui";
import LinkCard from "./LinkCard";
import { useLinks } from "./useLinks";
import type { PublicLinks } from "./useLinks";

export function LinksSection({ data }: { data: PublicLinks }) {
  const picks = data.featured.length ? data.featured.slice(0, 6) : data.groups.flatMap((g) => g.links).slice(0, 6);
  if (picks.length === 0) return null;
  return (
    <section aria-labelledby="home-links" className="mx-auto mt-6 w-full max-w-2xl px-4">
      <h2 id="home-links" className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">{data.featured.length ? "Featured links" : "Links"}</h2>
      <ul className="grid gap-2.5">
        {picks.map((l) => <li key={l.id}><LinkCard link={l} /></li>)}
      </ul>
      {data.total > picks.length && <Link to="/links" className="mt-3 inline-block text-sm text-accent-soft underline-offset-4 hover:underline">All {data.total} links →</Link>}
    </section>
  );
}

export default function LinksPage() {
  const s = useLinks();
  useEffect(() => { document.title = "Links"; }, []);
  return (
    <div className="min-h-screen pb-16">
      <main className="mx-auto w-full max-w-2xl px-4 pt-8">
        <Link to="/" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">← Home</Link>
        <h1 className="rise mt-3 text-2xl font-semibold tracking-tight">Links</h1>
        {s.status === "loading" && <div className="grid place-items-center py-20" role="status" aria-label="Loading"><span className="size-5 animate-spin rounded-full border-2 border-accent-soft border-t-transparent" /></div>}
        {s.status === "error" && (
          <Card className="mt-6 px-6 py-10 text-center" role="alert">
            <p className="text-base font-medium">Could not load links</p>
            <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
            <Button className="mt-4" variant="secondary" onClick={s.retry}>Try again</Button>
          </Card>
        )}
        {s.status === "ready" && s.data && (s.data.total === 0 ? (
          <Card className="mt-6 px-6 py-12 text-center"><p className="text-base font-medium">No links yet</p><p className="mt-1 text-sm text-muted">Nothing has been published here. Check back soon.</p></Card>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {s.data.groups.map((g) => (
              <section key={g.id ?? "none"} aria-labelledby={`cat-${g.id ?? "none"}`}>
                {(g.name || s.data!.groups.length > 1) && (
                  <h2 id={`cat-${g.id ?? "none"}`} className="mb-1 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted">
                    {g.color && <span aria-hidden className="size-2 rounded-full" style={{ background: g.color }} />}
                    {g.name ?? "More"}
                  </h2>
                )}
                {g.description && <p className="mb-2 text-sm text-muted">{g.description}</p>}
                <ul className="mt-2 grid gap-2.5">
                  {g.links.map((l) => <li key={l.id}><LinkCard link={l} big={l.featured} /></li>)}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}
