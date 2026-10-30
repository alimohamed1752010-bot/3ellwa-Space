import { useEffect, useState } from "react";
import { api, ApiError } from "../../shared/api";
import { Button, Card, CardBody, CardHeader, Checkbox, Input, Modal, useToast } from "../../shared/ui";
import ReorderButtons, { moveItem } from "../ReorderButtons";

interface Item { id: string; label: string; targetType: string; url: string | null; openNewTab: boolean; visible: boolean }
type Draft = { label: string; url: string; openNewTab: boolean; visible: boolean };
const empty: Draft = { label: "", url: "", openNewTab: false, visible: true };

// Menu items save immediately (live), per DECISIONS item 8.
export default function NavigationScreen() {
  const toast = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [edit, setEdit] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [del, setDel] = useState<Item | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => { setLoadError(""); api.get<{ items: Item[] }>("/api/admin/navigation").then((r) => setItems(r.items)).catch((e) => setLoadError(e.message)); };
  useEffect(load, []);
  const fail = (e: unknown) => toast.show(e instanceof ApiError ? e.message : "Something went wrong.", "error");
  const bodyOf = (i: Item, over: Partial<Draft> = {}) => ({ label: i.label, url: i.url ?? "", openNewTab: i.openNewTab, visible: i.visible, ...over });

  async function save() {
    if (!edit) return;
    setBusy(true); setErr("");
    try {
      const r = edit.id ? await api.put<{ items: Item[] }>(`/api/admin/navigation/${edit.id}`, edit.draft) : await api.post<{ items: Item[] }>("/api/admin/navigation", edit.draft);
      setItems(r.items); setEdit(null); toast.show("Menu item saved.", "success");
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not save."); } finally { setBusy(false); }
  }
  async function move(from: number, to: number) {
    if (!items) return;
    const next = moveItem(items, from, to);
    setItems(next);
    try { setItems((await api.put<{ items: Item[] }>("/api/admin/navigation/order", { ids: next.map((i) => i.id) })).items); } catch (e) { setItems(items); fail(e); }
  }
  async function toggle(i: Item) {
    try { setItems((await api.put<{ items: Item[] }>(`/api/admin/navigation/${i.id}`, bodyOf(i, { visible: !i.visible }))).items); } catch (e) { fail(e); }
  }
  async function remove() {
    if (!del) return;
    try { setItems((await api.del<{ items: Item[] }>(`/api/admin/navigation/${del.id}`)).items); toast.show("Menu item deleted.", "success"); } catch (e) { fail(e); }
    setDel(null);
  }

  return (
    <div className="rise">
      <h1 className="text-xl font-medium">Navigation</h1>
      <p className="mt-1 text-sm text-muted">The menu on your public site. Changes are live as soon as you make them. Hidden items stay here but visitors do not see them.</p>
      <Card className="mt-6">
        <CardHeader title="Menu items" action={<Button size="sm" onClick={() => { setErr(""); setEdit({ id: null, draft: empty }); }}>Add item</Button>} />
        <CardBody className="p-0">
          {loadError ? (
            <div className="p-5"><p role="alert" className="text-sm text-danger">{loadError}</p><Button className="mt-3" variant="secondary" onClick={load}>Try again</Button></div>
          ) : items === null ? <p className="p-5 text-sm text-muted">Loading…</p> : items.length === 0 ? (
            <p className="p-5 text-sm text-muted">No menu items yet. Add one to show a menu on your homepage.</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((it, i) => (
                <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{it.label}{!it.visible && <span className="ml-2 text-xs font-normal text-muted">(hidden)</span>}</p>
                    <p className="truncate text-xs text-muted">{it.url}{it.openNewTab ? " · new tab" : ""}</p>
                  </div>
                  <ReorderButtons index={i} count={items.length} name={it.label} onMove={move} />
                  <Button variant="ghost" size="sm" onClick={() => toggle(it)} aria-label={`${it.visible ? "Hide" : "Show"} ${it.label}`}>{it.visible ? "Hide" : "Show"}</Button>
                  <Button variant="secondary" size="sm" aria-label={`Edit ${it.label}`} onClick={() => { setErr(""); setEdit({ id: it.id, draft: bodyOf(it) }); }}>Edit</Button>
                  <Button variant="danger" size="sm" aria-label={`Delete ${it.label}`} onClick={() => setDel(it)}>Delete</Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit menu item" : "Add menu item"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Input label="Label" maxLength={40} value={edit.draft.label} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, label: e.target.value } })} />
            <Input label="Target" value={edit.draft.url} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, url: e.target.value } })} placeholder="/links or https://example.com" hint="An internal path starting with / or a full link." />
            <Checkbox label="Open in a new tab" checked={edit.draft.openNewTab} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, openNewTab: e.target.checked } })} />
            <Checkbox label="Visible on the public site" checked={edit.draft.visible} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, visible: e.target.checked } })} />
            {err && <p role="alert" className="text-xs text-danger">{err}</p>}
          </form>
        )}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete menu item?" footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></>}>
        <p>This removes “{del?.label}” from your menu.</p>
      </Modal>
    </div>
  );
}
