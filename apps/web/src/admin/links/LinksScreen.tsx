import { useEffect, useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ApiError, api } from "../../shared/api";
import { cn } from "../../shared/cn";
import { Button, Card, CardBody, Input, Modal, Select, useToast } from "../../shared/ui";
import LinkEditor from "./LinkEditor";
import { CategoriesModal, ImportModal, QrModal, StatsModal } from "./Panels";
import { EMPTY_DRAFT, NO_FILTERS, STATUS_LABEL, filterLinks, isFiltered, toDraft, toPayload, trackedUrl } from "./types";
import type { Category, Draft, Filters, LinkItem, Status } from "./types";

const TONE: Record<Status, string> = {
  live: "border-ok/40 bg-ok/10 text-ok", scheduled: "border-accent/40 bg-accent/10 text-accent-soft", expired: "border-danger/30 bg-danger/10 text-danger",
  disabled: "border-line bg-raised text-muted", hidden: "border-line bg-raised text-muted",
};

interface RowProps {
  link: LinkItem; category: string | null; selected: boolean; sortable: boolean;
  onSelect: (on: boolean) => void; onEdit: () => void; onToggle: () => void; onAction: (a: "duplicate" | "copy" | "copyDest" | "qr" | "stats" | "delete") => void;
}

function Row({ link, category, selected, sortable, onSelect, onEdit, onToggle, onAction }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id, disabled: !sortable });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-start gap-2 bg-surface px-3 py-3 sm:items-center", isDragging && "relative z-10 rounded-control shadow-2xl ring-1 ring-accent")}>
      <input type="checkbox" aria-label={`Select ${link.title}`} checked={selected} onChange={(e) => onSelect(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-accent)] sm:mt-0" />
      <button type="button" disabled={!sortable} aria-label={`Drag to reorder ${link.title}`} title={sortable ? "Drag, or focus and press Space then arrow keys" : "Clear search and filters to reorder"}
        className="grid size-9 shrink-0 touch-none place-items-center rounded-control text-muted enabled:cursor-grab enabled:hover:bg-raised enabled:hover:text-ink disabled:opacity-30" {...attributes} {...listeners}>⠿</button>
      <span aria-hidden className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-control bg-raised">
        {link.imageUrl ? <img src={link.imageUrl} alt="" className="size-full object-cover" /> : <span>{link.icon || "🔗"}</span>}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium text-ink">{link.title}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-wide", TONE[link.status])}>{STATUS_LABEL[link.status]}</span>
          {link.featured && <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-accent-soft">Featured</span>}
        </div>
        <p className="truncate text-xs text-muted">{link.url}</p>
        <p className="mt-0.5 text-xs text-muted">{category ?? "No category"} · {link.clicksTotal} click{link.clicksTotal === 1 ? "" : "s"}{link.clicks7d ? ` (${link.clicks7d} this week)` : ""}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        <Button variant="ghost" size="sm" aria-pressed={link.enabled} aria-label={`${link.enabled ? "Disable" : "Enable"} ${link.title}`} onClick={onToggle}>{link.enabled ? "On" : "Off"}</Button>
        <Button variant="secondary" size="sm" aria-label={`Edit ${link.title}`} onClick={onEdit}>Edit</Button>
        <details className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.open = false; }}>
          <summary aria-label={`More actions for ${link.title}`} className="grid size-8 cursor-pointer list-none place-items-center rounded-control text-muted hover:bg-raised hover:text-ink [&::-webkit-details-marker]:hidden">⋯</summary>
          <div className="absolute right-0 z-20 mt-1 flex w-52 flex-col rounded-control border border-line bg-surface p-1 shadow-2xl">
            {([["duplicate", "Duplicate"], ["copy", "Copy tracked link"], ["copyDest", "Copy destination URL"], ["qr", "QR code"], ["stats", "Click statistics"], ["delete", "Delete"]] as const).map(([k, label]) => (
              <button key={k} type="button" className={cn("rounded-control px-3 py-2 text-left text-sm hover:bg-raised", k === "delete" ? "text-danger" : "text-ink")}
                onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; onAction(k); }}>{label}</button>
            ))}
          </div>
        </details>
      </div>
    </li>
  );
}

const BULK: Array<[string, string]> = [["enable", "Enable"], ["disable", "Disable"], ["show", "Show"], ["hide", "Hide"], ["feature", "Feature"], ["unfeature", "Unfeature"]];

export default function LinksScreen() {
  const toast = useToast();
  const [items, setItems] = useState<LinkItem[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [qr, setQr] = useState<LinkItem | null>(null);
  const [stats, setStats] = useState<LinkItem | null>(null);
  const [del, setDel] = useState<LinkItem[] | null>(null);

  const load = () => {
    setLoadError("");
    api.get<{ items: LinkItem[]; categories: Category[] }>("/api/admin/links").then((r) => { setItems(r.items); setCats(r.categories); }).catch((e) => setLoadError(e.message));
  };
  useEffect(load, []);
  const fail = (e: unknown) => toast.show(e instanceof ApiError ? e.message : "Something went wrong.", "error");
  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);
  const shown = useMemo(() => (items ? filterLinks(items, filters) : []), [items, filters]);
  const sortable = !isFiltered(filters);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function onDragEnd(e: DragEndEvent) {
    if (!items || !e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((l) => l.id === e.active.id), to = items.findIndex((l) => l.id === e.over!.id);
    if (from < 0 || to < 0) return;
    const prev = items, next = arrayMove(items, from, to);
    setItems(next);
    try { const r = await api.put<{ items: LinkItem[]; categories: Category[] }>("/api/admin/links/order", { ids: next.map((l) => l.id) }); setItems(r.items); setCats(r.categories); }
    catch (err) { setItems(prev); fail(err); }
  }

  function savedItem(item: LinkItem) {
    setItems((cur) => {
      if (!cur) return cur;
      return cur.some((l) => l.id === item.id) ? cur.map((l) => (l.id === item.id ? item : l)) : [...cur, item];
    });
    setEditor(null);
    toast.show("Link saved.", "success");
    api.get<{ items: LinkItem[]; categories: Category[] }>("/api/admin/links").then((r) => { setItems(r.items); setCats(r.categories); }).catch(() => {});
  }

  async function toggle(l: LinkItem) {
    try {
      const d = toDraft(l);
      const r = await api.put<{ item: LinkItem }>(`/api/admin/links/${l.id}`, toPayload({ ...d, enabled: !l.enabled }));
      setItems((cur) => cur?.map((x) => (x.id === l.id ? r.item : x)) ?? cur);
    } catch (e) { fail(e); }
  }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); toast.show(`${what} copied.`, "success"); }
    catch { toast.show("Could not copy. Your browser blocked clipboard access.", "error"); }
  }

  async function action(l: LinkItem, a: "duplicate" | "copy" | "copyDest" | "qr" | "stats" | "delete") {
    if (a === "copy") return copy(trackedUrl(l.id), "Tracked link");
    if (a === "copyDest") return copy(l.url, "Destination URL");
    if (a === "qr") return setQr(l);
    if (a === "stats") return setStats(l);
    if (a === "delete") return setDel([l]);
    try {
      const r = await api.post<{ items: LinkItem[]; categories: Category[] }>(`/api/admin/links/${l.id}/duplicate`);
      setItems(r.items); setCats(r.categories); toast.show("Link duplicated.", "success");
    } catch (e) { fail(e); }
  }

  async function bulk(action: string, categoryId?: string | null) {
    const ids = [...sel];
    if (!ids.length) return;
    try {
      const r = await api.post<{ items: LinkItem[]; categories: Category[] }>("/api/admin/links/bulk", { ids, action, categoryId });
      setItems(r.items); setCats(r.categories);
      if (action === "delete") setSel(new Set());
      toast.show(`Updated ${ids.length} link${ids.length === 1 ? "" : "s"}.`, "success");
    } catch (e) { fail(e); }
  }

  async function confirmDelete() {
    if (!del) return;
    const ids = del.map((l) => l.id);
    try {
      const r = await api.post<{ items: LinkItem[]; categories: Category[] }>("/api/admin/links/bulk", { ids, action: "delete" });
      setItems(r.items); setCats(r.categories); setSel((s) => new Set([...s].filter((x) => !ids.includes(x))));
      toast.show(ids.length === 1 ? "Link deleted." : `${ids.length} links deleted.`, "success");
    } catch (e) { fail(e); }
    setDel(null);
  }

  async function exportJson() {
    try {
      const data = await api.get<unknown>("/api/admin/links/export");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = "links-export.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) { fail(e); }
  }

  const allShownSelected = shown.length > 0 && shown.every((l) => sel.has(l.id));

  return (
    <div className="rise">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Links</h1>
          <p className="mt-1 text-sm text-muted">Everything on your public Links page and homepage. Changes are live as soon as you save.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCatsOpen(true)}>Categories</Button>
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>Import</Button>
          <Button variant="secondary" size="sm" onClick={exportJson}>Export</Button>
          <Button size="sm" onClick={() => setEditor({ id: null, draft: EMPTY_DRAFT })}>Add link</Button>
        </div>
      </div>

      <Card className="mt-6">
        <CardBody className="grid gap-3 border-b border-line sm:grid-cols-[1fr_10rem_12rem]">
          <Input aria-label="Search links" placeholder="Search title, URL, description" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <Select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters["status"] })}>
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
          <Select aria-label="Filter by category" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}>
            <option value="all">All categories</option>
            <option value="none">No category</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </CardBody>

        {sel.size > 0 && (
          <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 border-b border-line bg-raised/60 px-4 py-2.5">
            <span className="text-sm text-ink">{sel.size} selected</span>
            {BULK.map(([k, label]) => <Button key={k} variant="secondary" size="sm" onClick={() => bulk(k)}>{label}</Button>)}
            <Select aria-label="Move selected to category" value="" onChange={(e) => { if (e.target.value) bulk("category", e.target.value === "__none" ? null : e.target.value); }} className="h-8 w-44">
              <option value="">Move to category…</option>
              <option value="__none">No category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button variant="danger" size="sm" onClick={() => setDel(items?.filter((l) => sel.has(l.id)) ?? [])}>Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>Clear</Button>
          </div>
        )}

        {loadError ? (
          <div className="p-5"><p role="alert" className="text-sm text-danger">{loadError}</p><Button className="mt-3" variant="secondary" onClick={load}>Try again</Button></div>
        ) : items === null ? <p className="p-5 text-sm text-muted">Loading…</p> : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-ink">No links yet.</p>
            <p className="mt-1 text-sm text-muted">Add your first link, or import a file.</p>
            <Button className="mt-4" onClick={() => setEditor({ id: null, draft: EMPTY_DRAFT })}>Add link</Button>
          </div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-10 text-center"><p className="text-sm text-muted">No links match.</p><Button className="mt-3" variant="secondary" size="sm" onClick={() => setFilters(NO_FILTERS)}>Clear search and filters</Button></div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-xs text-muted">
              <label className="flex items-center gap-2"><input type="checkbox" aria-label="Select all shown" checked={allShownSelected} onChange={(e) => setSel(e.target.checked ? new Set(shown.map((l) => l.id)) : new Set())} className="size-4 accent-[var(--color-accent)]" />Select all shown</label>
              <span>{sortable ? "Drag the handle to reorder." : "Clear search and filters to reorder."}</span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={shown.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-line" aria-label="Links">
                  {shown.map((l) => (
                    <Row key={l.id} link={l} category={l.categoryId ? catName.get(l.categoryId) ?? null : null} selected={sel.has(l.id)} sortable={sortable}
                      onSelect={(on) => setSel((s) => { const n = new Set(s); if (on) n.add(l.id); else n.delete(l.id); return n; })}
                      onEdit={() => setEditor({ id: l.id, draft: toDraft(l) })} onToggle={() => toggle(l)} onAction={(a) => action(l, a)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </Card>

      {editor && <LinkEditor id={editor.id} draft={editor.draft} categories={cats} onChange={(d) => setEditor({ ...editor, draft: d })} onClose={() => setEditor(null)} onSaved={savedItem} />}
      {catsOpen && <CategoriesModal categories={cats} onClose={() => setCatsOpen(false)} onChange={(c, reload) => { setCats(c); if (reload) load(); }} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={(msg) => { setImportOpen(false); toast.show(msg, "success"); load(); }} />}
      {qr && <QrModal link={qr} onClose={() => setQr(null)} />}
      {stats && <StatsModal link={stats} onClose={() => setStats(null)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title={del && del.length > 1 ? `Delete ${del.length} links?` : "Delete link?"} footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete}>Delete</Button></>}>
        <p>{del && del.length === 1 ? `“${del[0].title}” will be removed and its link stops working. Past click counts are kept in analytics.` : "These links will be removed and stop working."} This cannot be undone.</p>
      </Modal>
    </div>
  );
}
