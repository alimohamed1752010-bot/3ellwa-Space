import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../shared/api";
import { cn } from "../../shared/cn";
import { autoOptimize, formatBytes } from "../../shared/imageTools";
import { ACCEPT, checkLibraryFile, checkLibraryType, listFolders, listMedia, replaceAsset, uploadToLibrary } from "../../shared/media";
import type { MediaFolder, MediaItem, MediaUsage } from "../../shared/media";
import { Button, Card, CardBody, CardHeader, Input, Modal, Select, useToast } from "../../shared/ui";
import ImageEditor from "./ImageEditor";
import { useUploader } from "./useUploader";

type FolderDialog = { mode: "new" | "rename"; id?: string; name: string } | null;

export default function MediaScreen() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [totals, setTotals] = useState({ n: 0, bytes: 0 });
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("all"); // all | none | <folder id>
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialog>(null);
  const [folderError, setFolderError] = useState("");
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [deleteNote, setDeleteNote] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null); // single upload waiting in the editor
  const [moveTo, setMoveTo] = useState("none");

  const fail = useCallback((e: unknown) => toast.show(e instanceof ApiError ? e.message : "Something went wrong.", "error"), [toast]);
  const currentFolderId = folder !== "all" && folder !== "none" ? folder : null;

  const load = useCallback(() => {
    setLoadError("");
    Promise.all([listMedia({ q, folder, sort }), listFolders()])
      .then(([m, f]) => { setItems(m.items); setTotals({ n: m.totalAssets, bytes: m.totalBytes }); setFolders(f.items); setSelected((cur) => new Set([...cur].filter((id) => m.items.some((i) => i.id === id)))); })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Could not load the library."));
  }, [q, folder, sort]);
  useEffect(() => {
    const t = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const { busy, uploadMany } = useUploader(() => load());

  function pickFiles(files: File[]) {
    if (files.length === 0) return;
    // One file: open the editor so it can be cropped. Several files: optimize quietly and upload them all.
    if (files.length === 1) {
      const bad = checkLibraryType(files[0]);
      if (bad) { toast.show(bad, "error"); return; }
      setNewFile(files[0]);
    } else void uploadMany(files, currentFolderId);
  }
  async function uploadEdited(file: File) {
    const bad = checkLibraryFile(file);
    if (bad) { toast.show(bad, "error"); return; }
    try {
      await uploadToLibrary(file, currentFolderId);
      setNewFile(null); toast.show("Image uploaded.", "success"); load();
    } catch (e) { fail(e); }
  }

  /* ----- folders ----- */
  async function saveFolder() {
    if (!folderDialog) return;
    setFolderError("");
    try {
      const r = folderDialog.mode === "new"
        ? await api.post<{ items: MediaFolder[] }>("/api/admin/media/folders", { name: folderDialog.name })
        : await api.put<{ items: MediaFolder[] }>(`/api/admin/media/folders/${folderDialog.id}`, { name: folderDialog.name });
      setFolders(r.items);
      if (folderDialog.mode === "new") { const made = r.items.find((f) => f.name.toLowerCase() === folderDialog.name.trim().toLowerCase()); if (made) setFolder(made.id); }
      setFolderDialog(null);
    } catch (e) { setFolderError(e instanceof ApiError ? e.message : "Could not save the folder."); }
  }
  async function deleteFolder(f: MediaFolder) {
    if (!window.confirm(`Delete the folder "${f.name}"? Its ${f.assetCount} image${f.assetCount === 1 ? "" : "s"} will move to Unfiled, not be deleted.`)) return;
    try { await api.del(`/api/admin/media/folders/${f.id}`); setFolder("all"); load(); toast.show("Folder deleted.", "success"); } catch (e) { fail(e); }
  }

  /* ----- selection and bulk ----- */
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function bulkMove() {
    try {
      await api.post("/api/admin/media/bulk", { action: "move", ids: [...selected], folderId: moveTo === "none" ? null : moveTo });
      toast.show("Moved.", "success"); setSelected(new Set()); load();
    } catch (e) { fail(e); }
  }

  /* ----- delete with usage warning ----- */
  async function askDelete(ids: string[]) {
    setDeleteNote([]);
    setDeleteIds(ids);
    try {
      const lists = await Promise.all(ids.slice(0, 20).map((id) => api.get<{ usage: MediaUsage[] }>(`/api/admin/media/${id}/usage`)));
      setDeleteNote(lists.flatMap((l) => l.usage.map((u) => u.label)));
    } catch { /* the warning is a courtesy; deleting still works */ }
  }
  async function confirmDelete() {
    if (!deleteIds) return;
    try {
      if (deleteIds.length === 1) await api.del(`/api/admin/media/${deleteIds[0]}`);
      else await api.post("/api/admin/media/bulk", { action: "delete", ids: deleteIds });
      toast.show(deleteIds.length === 1 ? "Image deleted." : `${deleteIds.length} images deleted.`, "success");
      setDeleteIds(null); setDetail(null); setSelected(new Set()); load();
    } catch (e) { fail(e); setDeleteIds(null); }
  }

  const empty = items !== null && items.length === 0;
  const filtering = q !== "" || folder !== "all";

  return (
    <div className="rise" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); pickFiles(Array.from(e.dataTransfer.files)); }}>
      <h1 className="text-xl font-medium">Media Library</h1>
      <p className="mt-1 text-sm text-muted">Images used across your site. Upload, organize, rename, crop, and replace them here. {totals.n > 0 && `${totals.n} image${totals.n === 1 ? "" : "s"}, ${formatBytes(totals.bytes)}.`}</p>

      <Card className={cn("mt-6", dragging && "border-accent")}>
        <CardHeader title="Images"
          action={<>
            <input ref={fileInput} type="file" accept={ACCEPT} multiple className="sr-only" aria-label="Upload images" tabIndex={-1}
              onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; pickFiles(files); }} />
            <Button size="sm" loading={busy} onClick={() => fileInput.current?.click()}>Upload</Button>
          </>} />
        <CardBody className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
            <Input aria-label="Search images" placeholder="Search by name or description" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name</option>
              <option value="size">Largest first</option>
              <option value="used">Most used</option>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Folders">
            {[{ id: "all", name: "All", assetCount: totals.n }, { id: "none", name: "Unfiled", assetCount: -1 }, ...folders].map((f) => (
              <button key={f.id} type="button" aria-pressed={folder === f.id} onClick={() => setFolder(f.id)}
                className={cn("rounded-full border px-3 py-1 text-sm transition-colors", folder === f.id ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink")}>
                {f.name}{f.assetCount >= 0 && <span className="ml-1.5 text-xs text-muted">{f.assetCount}</span>}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => { setFolderError(""); setFolderDialog({ mode: "new", name: "" }); }}>New folder</Button>
            {currentFolderId && (() => {
              const f = folders.find((x) => x.id === currentFolderId);
              return f ? <>
                <Button variant="ghost" size="sm" onClick={() => { setFolderError(""); setFolderDialog({ mode: "rename", id: f.id, name: f.name }); }}>Rename folder</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteFolder(f)}>Delete folder</Button>
              </> : null;
            })()}
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-raised px-3 py-2" role="region" aria-label="Selected images">
              <span className="text-sm text-ink">{selected.size} selected</span>
              <Select aria-label="Move to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="none">Unfiled</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
              <Button size="sm" variant="secondary" onClick={bulkMove}>Move</Button>
              <Button size="sm" variant="danger" onClick={() => askDelete([...selected])}>Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          {loadError ? (
            <div><p role="alert" className="text-sm text-danger">{loadError}</p><Button className="mt-3" variant="secondary" onClick={load}>Try again</Button></div>
          ) : items === null ? <p className="text-sm text-muted">Loading…</p> : empty ? (
            <div className="rounded-control border border-dashed border-line px-6 py-12 text-center">
              <p className="text-sm text-ink">{filtering ? "No images match." : "No images yet."}</p>
              <p className="mt-1 text-sm text-muted">{filtering ? "Try another search or folder." : "Click Upload, or drop image files anywhere on this page."}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((a) => (
                <li key={a.id} className="group relative overflow-hidden rounded-control border border-line bg-raised">
                  <button type="button" aria-label={`Open ${a.name}`} onClick={() => setDetail(a)} className="block aspect-square w-full">
                    <img src={a.url} alt={a.altText ?? ""} loading="lazy" className="size-full object-cover" />
                  </button>
                  <div className="absolute left-2 top-2 rounded bg-black/55 p-1 backdrop-blur-sm">
                    <input type="checkbox" aria-label={`Select ${a.name}`} checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="block size-4 accent-[var(--color-accent)]" />
                  </div>
                  {a.usedCount > 0 && <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-ink">In use</span>}
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs text-ink">{a.name}</p>
                    <p className="text-[11px] text-muted">{a.width && a.height ? `${a.width}×${a.height} · ` : ""}{formatBytes(a.sizeBytes)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {newFile && <ImageEditor file={newFile} title="Upload image" confirmLabel="Crop and upload" onCancel={() => setNewFile(null)} onDone={uploadEdited} />}

      {detail && <Detail key={detail.id} asset={detail} folders={folders} onClose={() => setDetail(null)} onChanged={(a) => { setDetail(a); load(); }} onDelete={() => askDelete([detail.id])} fail={fail} />}

      <Modal open={!!folderDialog} onClose={() => setFolderDialog(null)} title={folderDialog?.mode === "rename" ? "Rename folder" : "New folder"}
        footer={<><Button variant="secondary" onClick={() => setFolderDialog(null)}>Cancel</Button><Button onClick={saveFolder}>Save</Button></>}>
        {folderDialog && <Input label="Folder name" value={folderDialog.name} error={folderError || undefined} autoFocus maxLength={60}
          onChange={(e) => setFolderDialog({ ...folderDialog, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") void saveFolder(); }} />}
      </Modal>

      <Modal open={!!deleteIds} onClose={() => setDeleteIds(null)} title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} images?` : "Delete this image?"}
        footer={<><Button variant="secondary" onClick={() => setDeleteIds(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete}>Delete</Button></>}>
        <p>This cannot be undone.</p>
        {deleteNote.length > 0 && (
          <div className="mt-3" role="alert">
            <p className="text-ink">Still in use. These will lose their image:</p>
            <ul className="mt-1 list-disc pl-5">{deleteNote.slice(0, 8).map((n, i) => <li key={i}>{n}</li>)}{deleteNote.length > 8 && <li>and {deleteNote.length - 8} more</li>}</ul>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({ asset, folders, onClose, onChanged, onDelete, fail }: {
  asset: MediaItem; folders: MediaFolder[]; onClose: () => void; onChanged: (a: MediaItem) => void; onDelete: () => void; fail: (e: unknown) => void;
}) {
  const toast = useToast();
  const replaceInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(asset.name.replace(/\.[^.]*$/, ""));
  const [alt, setAlt] = useState(asset.altText ?? "");
  const [folderId, setFolderId] = useState(asset.folderId ?? "");
  const [usage, setUsage] = useState<MediaUsage[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => { api.get<{ usage: MediaUsage[] }>(`/api/admin/media/${asset.id}/usage`).then((r) => setUsage(r.usage)).catch(() => setUsage([])); }, [asset.id, asset.updatedAt]);

  const dirty = name !== asset.name.replace(/\.[^.]*$/, "") || alt !== (asset.altText ?? "") || folderId !== (asset.folderId ?? "");

  async function save() {
    setSaving(true);
    try {
      const r = await api.put<{ asset: MediaItem }>(`/api/admin/media/${asset.id}`, { name, altText: alt || null, folderId: folderId || null });
      toast.show("Saved.", "success"); onChanged(r.asset);
    } catch (e) { fail(e); } finally { setSaving(false); }
  }
  async function replaceWith(file: File) {
    const bad = checkLibraryFile(file);
    if (bad) { toast.show(bad, "error"); return; }
    setReplacing(true);
    try {
      const r = await replaceAsset(asset.id, file);
      toast.show("File replaced. Everywhere this image is used now shows the new file.", "success"); onChanged(r); setEditFile(null);
    } catch (e) { fail(e); } finally { setReplacing(false); }
  }
  async function startEdit() {
    try {
      const blob = await (await fetch(asset.url)).blob();
      setEditFile(new File([blob], asset.name, { type: asset.mimeType }));
    } catch { toast.show("Could not load the image to edit.", "error"); }
  }

  return (
    <>
      <Modal open onClose={onClose} size="lg" title={asset.name}
        footer={<>
          <Button variant="danger" className="mr-auto" onClick={onDelete}>Delete</Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button loading={saving} disabled={!dirty} onClick={save}>Save changes</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <div className="grid max-h-72 place-items-center overflow-hidden rounded-control border border-line bg-bg p-2">
            <img src={asset.url} alt={asset.altText ?? ""} className="max-h-64 max-w-full object-contain" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} hint="Used in the file's web address." maxLength={80} />
            <Select label="Folder" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">Unfiled</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <Input label="Description (alt text)" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} hint="Read aloud by screen readers. Describe what the image shows." />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt>Type</dt><dd className="text-ink">{asset.mimeType.replace("image/", "").toUpperCase()}</dd>
            <dt>Size</dt><dd className="text-ink">{asset.width && asset.height ? `${asset.width} × ${asset.height} px, ` : ""}{formatBytes(asset.sizeBytes)}</dd>
            <dt>Uploaded</dt><dd className="text-ink">{asset.createdAt.slice(0, 10)}</dd>
            <dt>Address</dt><dd className="truncate text-ink">{asset.url}</dd>
          </dl>
          <div>
            <p className="text-sm font-medium text-ink">Used in</p>
            {usage === null ? <p className="text-xs">Checking…</p> : usage.length === 0 ? <p className="text-xs">Not used anywhere yet.</p> : (
              <ul className="mt-1 list-disc pl-5 text-xs">{usage.map((u, i) => <li key={i}>{u.label}</li>)}</ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => { void navigator.clipboard?.writeText(location.origin + asset.url).then(() => toast.show("Address copied.", "success"), () => toast.show("Could not copy.", "error")); }}>Copy address</Button>
            <Button variant="secondary" size="sm" onClick={startEdit}>Crop or compress</Button>
            <input ref={replaceInput} type="file" accept={ACCEPT} className="sr-only" aria-label="Replace file" tabIndex={-1}
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await replaceWith(await autoOptimize(f)); }} />
            <Button variant="secondary" size="sm" loading={replacing} onClick={() => replaceInput.current?.click()}>Replace file</Button>
          </div>
        </div>
      </Modal>
      {editFile && <ImageEditor file={editFile} title={`Edit ${asset.name}`} confirmLabel="Save edited image" onCancel={() => setEditFile(null)} onDone={replaceWith} />}
    </>
  );
}
