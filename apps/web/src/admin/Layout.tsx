import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "../shared/ui";
import { cn } from "../shared/cn";
import { NAV } from "./nav";
import { hasUnsavedChanges, UNSAVED_MESSAGE } from "./unsaved";

export default function Layout({ onLogout }: { onLogout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-0.5 px-3 py-2">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === ""}
          onClick={(e) => { if (hasUnsavedChanges() && !window.confirm(UNSAVED_MESSAGE)) e.preventDefault(); }}
          className={({ isActive }) =>
            cn(
              "rounded-control px-3 py-2 text-sm transition-colors",
              isActive ? "bg-accent/15 text-ink shadow-[inset_2px_0_0_var(--color-accent)]" : "text-muted hover:bg-raised hover:text-ink"
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface/70 backdrop-blur-sm md:flex">
        <div className="px-6 py-5 text-sm font-medium tracking-wide">3ellwa.space</div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-line p-3">
          <Button variant="ghost" size="sm" className="w-full" loading={leaving} onClick={async () => { setLeaving(true); await onLogout(); }}>
            Log out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
        <span className="text-sm font-medium tracking-wide">3ellwa.space</span>
        <Button variant="secondary" size="sm" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Menu"}
        </Button>
      </header>
      {open && (
        <div className="fixed inset-0 top-[3.25rem] z-20 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div id="mobile-nav" className="rise relative h-full w-64 max-w-[80vw] overflow-y-auto border-r border-line bg-surface">
            {nav}
            <div className="border-t border-line p-3">
              <Button variant="ghost" size="sm" className="w-full" loading={leaving} onClick={async () => { setLeaving(true); await onLogout(); }}>
                Log out
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 p-5 md:p-10">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
