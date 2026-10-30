import { useEffect, useState } from "react";
import { api, ApiError } from "../../shared/api";
import { Button, Card, CardBody, CardHeader, Checkbox, Input, Modal, useToast } from "../../shared/ui";
import ReorderButtons, { moveItem } from "../ReorderButtons";
import type { SocialLink } from "./types";

type Draft = { platform: string; label: string; url: string; visible: boolean };
const empty: Draft = { platform: "", label: "", url: "", visible: true };
const PLATFORMS = ["github", "discord", "x", "instagram", "youtube", "twitch", "steam", "spotify", "tiktok", "linkedin", "email", "website"];

// Social links save immediately (live), per DECISIONS item 8.
export default function SocialLinks() {
  const toast = useToast();
  const [items, setItems] = useState<SocialLink[] | null>(null);
  const [edit, setEdit] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [del, setDel] = useState<SocialLink | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ items: SocialLink[] }>("/api/admin/social-links").then((r) => setItems(r.items)).catch((e) => { setItems([]); toast.show(e.message, "error"); });
  }, [toast]);

  const fail = (e: unknown) => toast.show(e instanceof ApiError ? e.message : "Something went wrong.", "error");

  async function save() {
    if (!edit) return;
    setBusy(true); setErr("");
    const body = { platform: edit.draft.platform, label: edit.draft.label || null, url: edit.draft.url, visible: edit.draft.visible };
    try {
      const r = edit.id ? await api.put<{ items: SocialLink[] }>(`/api/admin/social-links/${edit.id}`, body) : await api.post<{ items: SocialLink[] }>("/api/admin/social-links", body);
      setItems(r.items); setEdit(null); toast.show("Social link saved.", "success");
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not save."); } finally { setBusy(false); }
  }

  async function move(from: number, to: number) {
    if (!items) return;
    const next = moveItem(items, from, to);
    setItems(next);
    try { setItems((await api.put<{ items: SocialLink[] }>("/api/admin/social-links/order", { ids: next.map((i) => i.id) })).items); } catch (e) { setItems(items); fail(e); }
  }

  async function toggle(it: SocialLink) {
    try { setItems((await api.put<{ items: SocialLink[] }>(`/api/admin/social-links/${it.id}`, { platform: it.platform, label: it.label, url: it.url, visible: !it.visible })).items); } catch (e) { fail(e); }
  }

  async function remove() {
    if (!del) return;
    try { setItems((await api.del<{ items: SocialLink[] }>(`/api/admin/social-links/${del.id}`)).items); toast.show("Social link deleted.", "success"); } catch (e) { fail(e); }
    setDel(null);
  }

  return (
    <Card>
      <CardHeader title="Social links" description="Saved as soon as you change them." action={<Button size="sm" onClick={() => { setErr(""); setEdit({ id: null, draft: empty }); }}>Add link</Button>} />
      <CardBody className="p-0">
        {items === null ? <p className="p-5 text-sm text-muted">Loading…</p> : items.length === 0 ? <p className="p-5 text-sm text-muted">No social links yet.</p> : (
          <ul className="divide-y divide-line">
            {items.map((it, i) => (
              <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{it.label || it.platform}{!it.visible && <span className="ml-2 text-xs font-normal text-muted">(hidden)</span>}</p>
                  <p className="truncate text-xs text-muted">{it.url}</p>
                </div>
                <ReorderButtons index={i} count={items.length} name={it.label || it.platform} onMove={move} />
                <Button variant="ghost" size="sm" onClick={() => toggle(it)} aria-label={`${it.visible ? "Hide" : "Show"} ${it.label || it.platform}`}>{it.visible ? "Hide" : "Show"}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setErr(""); setEdit({ id: it.id, draft: { platform: it.platform, label: it.label ?? "", url: it.url, visible: it.visible } }); }} aria-label={`Edit ${it.label || it.platform}`}>Edit</Button>
                <Button variant="danger" size="sm" onClick={() => setDel(it)} aria-label={`Delete ${it.label || it.platform}`}>Delete</Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit social link" : "Add social link"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Input label="Platform" list="platforms" value={edit.draft.platform} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, platform: e.target.value } })} placeholder="github" />
            <datalist id="platforms">{PLATFORMS.map((p) => <option key={p} value={p} />)}</datalist>
            <Input label="Label (optional)" value={edit.draft.label} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, label: e.target.value } })} />
            <Input label="URL" value={edit.draft.url} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, url: e.target.value } })} placeholder="https://github.com/you" />
            <Checkbox label="Visible on the public site" checked={edit.draft.visible} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, visible: e.target.checked } })} />
            {err && <p role="alert" className="text-xs text-danger">{err}</p>}
          </form>
        )}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete social link?" footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></>}>
        <p>This removes “{del?.label || del?.platform}” from your site.</p>
      </Modal>
    </Card>
  );
}
