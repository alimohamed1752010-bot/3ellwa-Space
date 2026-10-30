import { cn } from "../shared/cn";

export interface PublicLink {
  id: string; title: string; description: string | null; icon: string | null; imageUrl: string | null; color: string | null;
  background: string | null; badge: string | null; hoverAnimation: string; newTab: boolean; featured: boolean; href: string;
}

const HOVER: Record<string, string> = { lift: "hv-lift", glow: "hv-glow", scale: "hv-scale", shine: "hv-shine" };

/** One link. Always a plain <a> to /go/:id (a full page load, so the Worker can count and redirect). */
export default function LinkCard({ link, big = false, preview = false }: { link: PublicLink; big?: boolean; preview?: boolean }) {
  const style: React.CSSProperties = {};
  if (link.background) style.background = link.background;
  if (link.color) { style.color = link.color; (style as Record<string, string>)["--glow"] = link.color + "99"; }
  const inner = (
    <>
      <span aria-hidden className={cn("grid shrink-0 place-items-center overflow-hidden rounded-control bg-raised text-xl", big ? "size-14" : "size-11")}>
        {link.imageUrl ? <img src={link.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : link.icon ? <span className="leading-none">{link.icon}</span> : <span className="size-2.5 rounded-full bg-accent-soft/70" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn("break-words font-medium", big ? "text-base" : "text-sm")}>{link.title}</span>
          {link.badge && <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-accent-soft">{link.badge}</span>}
        </span>
        {link.description && <span className={cn("mt-0.5 block break-words text-xs", link.color ? "opacity-75" : "text-muted")}>{link.description}</span>}
      </span>
      <span aria-hidden className="shrink-0 text-muted">{link.newTab ? "↗" : "→"}</span>
    </>
  );
  const cls = cn(
    "link-card flex items-center gap-3 rounded-card border border-line bg-surface/80 px-3.5 text-ink shadow-[0_10px_30px_-20px_rgb(0_0_0/0.8)] hover:border-line-strong",
    big ? "py-4" : "py-3", HOVER[link.hoverAnimation] ?? ""
  );
  // In the admin preview the card must not navigate.
  if (preview) return <div className={cls} style={style}>{inner}</div>;
  return (
    <a href={link.href} target={link.newTab ? "_blank" : undefined} rel={link.newTab ? "noopener noreferrer" : undefined} className={cls} style={style}>
      {inner}
      {link.newTab && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}
