import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { ApiError, api } from "../../shared/api";
import { Button, Checkbox, Input, Modal, Textarea, useToast } from "../../shared/ui";
import ReorderButtons, { moveItem } from "../ReorderButtons";
import type { Category, LinkItem, Stats } from "./types";
import { trackedUrl } from "./types";

// ---------- QR ----------
export function qrSvg(text: string): string {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
}

export function QrModal({ link, onClose }: { link: LinkItem; onClose: () => void }) {
  const [tracked, setTracked] = useState(true);
  const text = tracked ? trackedUrl(link.id) : link.url;
  const svg = useMemo(() => qrSvg(text), [text]);
  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `qr-${link.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "link"}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <Modal open onClose={onClose} title={`QR code: ${link.title}`} footer={<><Button variant="secondary" onClick={download}>Download SVG</Button><Button onClick={onClose}>Close</Button></>}>
      <div className="flex flex-col items-center gap-4">
        <div role="img" aria-label={`QR code for ${text}`} className="w-56 overflow-hidden rounded-control bg-white" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="break-all text-center font-mono text-xs">{text}</p>
        <Checkbox label="Count scans as clicks" hint="Encodes your /go link so scans show up in the statistics. Turn off to encode the destination directly." checked={tracked} onChange={(e) => setTracked(e.target.checked)} />
      </div>
    </Modal>
  );
}

// ---------- Stats ----------
export function StatsModal({ link, onClose }: { link: LinkItem; onClose: () => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get<Stats>(`/api/admin/links/${link.id}/stats`).then(setS).catch((e) => setErr(e.message)); }, [link.id]);
  const max = Math.max(1, ...(s?.daily.map((d) => d.count) ?? [1]));
  return (
    <Modal open onClose={onClose} title={`Clicks: ${link.title}`} footer={<Button onClick={onClose}>Close</Button>}>
      {err ? <p role="alert" className="text-danger">{err}</p> : !s ? <p>Loading…</p> : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([["Total", s.total], ["Last 7 days", s.last7], ["Last 30 days", s.last30], ["Unique visitors", s.uniqueVisitors]] as const).map(([k, v]) => (
              <div key={k} className="rounded-control border border-line bg-raised px-3 py-2"><dt className="text-xs">{k}</dt><dd className="text-lg font-medium text-ink">{v}</dd></div>
            ))}
          </dl>
          <div>
            <p className="mb-1 text-xs">Clicks per day, last 30 days</p>
            <div className="flex h-24 items-end gap-[2px]" role="img" aria-label={`Bar chart of daily clicks. ${s.last30} clicks in the last 30 days.`}>
              {s.daily.map((d) => (
                <div key={d.date} title={`${d.date}: ${d.count}`} className="flex-1 rounded-t-sm bg-accent/70" style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 }} />
              ))}
            </div>
          </div>
          <p className="text-xs">{s.total === 0 ? "No clicks yet." : `Last click: ${s.lastClickAt ? new Date(s.lastClickAt).toLocaleString() : "unknown"}. Visitors are counted with a daily-rotating anonymous hash; no cookies are used.`}</p>
        </div>
      )}
    </Modal>
  );
}

// ---------- Import ----------
export function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (summary: string) => void }) {
  const [text, setText] = useState("");
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 1024 * 1024) { setErrs(["That file is larger than 1 MB."]); return; }
    setText(await f.text()); setErrs([]);
  }
  async function run() {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { setErrs(["That is not valid JSON."]); return; }
    setBusy(true); setErrs([]);
    try {
      const r = await api.post<{ imported: { links: number; categoriesCreated: number } }>("/api/admin/links/import", parsed);
      onDone(`Imported ${r.imported.links} link${r.imported.links === 1 ? "" : "s"}${r.imported.categoriesCreated ? ` and ${r.imported.categoriesCreated} new categor${r.imported.categoriesCreated === 1 ? "y" : "ies"}` : ""}.`);
    } catch (e) {
      if (e instanceof ApiError) setErrs(Array.isArray(e.extra.errors) ? (e.extra.errors as string[]) : [e.message]);
      else setErrs(["Import failed."]);
    } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} size="lg" title="Import links" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!text.trim()} onClick={run}>Import</Button></>}>
      <div className="flex flex-col gap-3">
        <p>Use a file from <span className="text-ink">Export</span>. Links are added to your existing ones; categories are matched by name. The whole file is checked first, and if anything is wrong nothing is imported.</p>
        <input ref={file} type="file" accept="application/json,.json" aria-label="Import file" className="sr-only" tabIndex={-1} onChange={(e) => onFile(e.target.files?.[0])} />
        <div><Button variant="secondary" size="sm" onClick={() => file.current?.click()}>Choose a .json file</Button></div>
        <Textarea label="Or paste JSON" value={text} onChange={(e) => { setText(e.target.value); setErrs([]); }} className="min-h-40 font-mono text-xs" />
        {errs.length > 0 && (
          <div role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            <p className="font-medium">Nothing was imported.</p>
            <ul className="mt-1 list-disc pl-5">{errs.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------- Categories ----------
interface CatDraft { name: string; description: string; color: string; visible: boolean }
const blank: CatDraft = { name: "", description: "", color: "", visible: true };

export function CategoriesModal({ categories, onChange, onClose }: { categories: Category[]; onChange: (c: Category[], reloadLinks: boolean) => void; onClose: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState<{ id: string | null; d: CatDraft } | null>(null);
  const [err, setErr] = useState("");
  const [del, setDel] = useState<Category | null>(null);
  const fail = (e: unknown) => toast.show(e instanceof ApiError ? e.message : "Something went wrong.", "error");

  async function save() {
    if (!edit) return;
    if (!edit.d.name.trim()) { setErr("Enter a name."); return; }
    const body = { name: edit.d.name.trim(), description: edit.d.description.trim() || null, color: edit.d.color || null, visible: edit.d.visible };
    try {
      const r = edit.id ? await api.put<{ items: Category[] }>(`/api/admin/link-categories/${edit.id}`, body) : await api.post<{ items: Category[] }>("/api/admin/link-categories", body);
      onChange(r.items, false); setEdit(null); setErr("");
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not save."); }
  }
  async function move(from: number, to: number) {
    const next = moveItem(categories, from, to);
    onChange(next, false);
    try { onChange((await api.put<{ items: Category[] }>("/api/admin/link-categories/order", { ids: next.map((c) => c.id) })).items, false); } catch (e) { onChange(categories, false); fail(e); }
  }
  async function remove() {
    if (!del) return;
    try { onChange((await api.del<{ items: Category[] }>(`/api/admin/link-categories/${del.id}`)).items, true); toast.show("Category deleted. Its links are now uncategorized.", "success"); } catch (e) { fail(e); }
    setDel(null);
  }

  return (
    <>
      <Modal open={!del} onClose={onClose} title="Categories" footer={<Button onClick={onClose}>Done</Button>}>
        <div className="flex flex-col gap-3">
          {categories.length === 0 && !edit && <p>No categories yet. Categories group links on your public Links page.</p>}
          <ul className="divide-y divide-line rounded-control border border-line">
            {categories.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                <span aria-hidden className="size-3 shrink-0 rounded-full border border-line" style={{ background: c.color ?? "transparent" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{c.name}{!c.visible && <span className="ml-2 text-xs text-muted">(hidden)</span>}</span>
                  <span className="text-xs">{c.linkCount} link{c.linkCount === 1 ? "" : "s"}</span>
                </span>
                <ReorderButtons index={i} count={categories.length} name={c.name} onMove={move} />
                <Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} onClick={() => { setErr(""); setEdit({ id: c.id, d: { name: c.name, description: c.description ?? "", color: c.color ?? "", visible: c.visible } }); }}>Edit</Button>
                <Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}>Delete</Button>
              </li>
            ))}
          </ul>
          {edit ? (
            <div className="flex flex-col gap-3 rounded-control border border-line p-3">
              {err && <p role="alert" className="text-danger">{err}</p>}
              <Input label="Name" value={edit.d.name} maxLength={40} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, name: e.target.value } })} />
              <Input label="Description" value={edit.d.description} maxLength={200} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, description: e.target.value } })} />
              <div className="flex items-center gap-2">
                <input type="color" aria-label="Category color" value={edit.d.color || "#8b5cf6"} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, color: e.target.value } })} className="h-9 w-12 cursor-pointer rounded-control border border-line bg-transparent p-1" />
                <span className="font-mono text-xs">{edit.d.color || "no color"}</span>
                {edit.d.color && <Button variant="ghost" size="sm" onClick={() => setEdit({ ...edit, d: { ...edit.d, color: "" } })}>Reset</Button>}
              </div>
              <Checkbox label="Visible on the public site" checked={edit.d.visible} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, visible: e.target.checked } })} />
              <div className="flex gap-2"><Button size="sm" onClick={save}>{edit.id ? "Save category" : "Add category"}</Button><Button size="sm" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button></div>
            </div>
          ) : <div><Button variant="secondary" size="sm" onClick={() => { setErr(""); setEdit({ id: null, d: blank }); }}>Add category</Button></div>}
        </div>
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete category?" footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></>}>
        <p>“{del?.name}” will be deleted. Its {del?.linkCount ?? 0} link(s) are kept and become uncategorized.</p>
      </Modal>
    </>
  );
}
