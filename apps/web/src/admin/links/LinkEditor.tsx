import { useState } from "react";
import { ApiError, api } from "../../shared/api";
import { Button, Checkbox, Input, Modal, Select, Textarea } from "../../shared/ui";
import LinkCard from "../../public/LinkCard";
import ImageField from "../profile/ImageField";
import { HOVERS, draftError, toPayload } from "./types";
import type { Category, Draft, LinkItem } from "./types";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={value || "#8b5cf6"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-control border border-line bg-transparent p-1" />
        <span className="font-mono text-xs text-muted">{value || "default"}</span>
        {value && <Button variant="ghost" size="sm" onClick={() => onChange("")}>Reset</Button>}
      </div>
    </div>
  );
}

interface Props { id: string | null; draft: Draft; categories: Category[]; onChange: (d: Draft) => void; onClose: () => void; onSaved: (item: LinkItem) => void }

export default function LinkEditor({ id, draft, categories, onChange, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });

  async function save() {
    const problem = draftError(draft);
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr("");
    try {
      const r = id ? await api.put<{ item: LinkItem }>(`/api/admin/links/${id}`, toPayload(draft)) : await api.post<{ item: LinkItem }>("/api/admin/links", toPayload(draft));
      onSaved(r.item);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setBusy(false); }
  }

  const preview = {
    id: "preview", title: draft.title || "Link title", description: draft.description || null, icon: draft.icon || null, imageUrl: draft.imageUrl, color: draft.color || null,
    background: draft.background || null, badge: draft.badge || null, hoverAnimation: draft.hoverAnimation, newTab: draft.openNewTab, featured: draft.featured, href: "#",
  };

  return (
    <Modal open onClose={onClose} size="lg" title={id ? "Edit link" : "Add link"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{id ? "Save link" : "Add link"}</Button></>}>
      <div className="flex flex-col gap-4">
        {err && <p role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <Input label="Title" value={draft.title} maxLength={100} onChange={(e) => set("title", e.target.value)} />
        <Input label="URL" value={draft.url} inputMode="url" placeholder="https://example.com" onChange={(e) => set("url", e.target.value)} hint="http(s) or mailto links only." />
        <Textarea label="Description" value={draft.description} maxLength={300} className="min-h-16" onChange={(e) => set("description", e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Category" value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Icon (emoji or short text)" value={draft.icon} maxLength={40} onChange={(e) => set("icon", e.target.value)} />
          <Input label="Badge" value={draft.badge} maxLength={24} placeholder="New" onChange={(e) => set("badge", e.target.value)} />
          <Select label="Hover animation" value={draft.hoverAnimation} onChange={(e) => set("hoverAnimation", e.target.value)}>
            {HOVERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <ColorField label="Text color" value={draft.color} onChange={(v) => set("color", v)} />
          <ColorField label="Background" value={draft.background} onChange={(v) => set("background", v)} />
        </div>
        <ImageField label="Custom image" purpose="link" url={draft.imageUrl} onChange={(a) => onChange({ ...draft, imageAssetId: a?.id ?? null, imageUrl: a?.url ?? null })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Publish at" type="datetime-local" value={draft.publishAt} onChange={(e) => set("publishAt", e.target.value)} hint="Hidden from visitors until then. Your local time." />
          <Input label="Expires at" type="datetime-local" value={draft.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} hint="Hidden and not followable after this." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox label="Enabled" hint="Off = the link stops working everywhere." checked={draft.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          <Checkbox label="Visible" hint="Off = not listed publicly." checked={draft.visible} onChange={(e) => set("visible", e.target.checked)} />
          <Checkbox label="Featured" hint="Shown on the homepage." checked={draft.featured} onChange={(e) => set("featured", e.target.checked)} />
          <Checkbox label="Open in a new tab" checked={draft.openNewTab} onChange={(e) => set("openNewTab", e.target.checked)} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Preview</p>
          <LinkCard link={preview} preview />
        </div>
      </div>
    </Modal>
  );
}
