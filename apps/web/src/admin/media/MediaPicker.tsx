import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../shared/api";
import { cn } from "../../shared/cn";
import { ACCEPT, listFolders, listMedia } from "../../shared/media";
import type { MediaFolder, MediaItem } from "../../shared/media";
import { Button, Input, Modal, Select, useToast } from "../../shared/ui";
import { useUploader } from "./useUploader";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onPick: (asset: MediaItem) => void;
}

/** Reusable "choose from the library" dialog: search, folder filter, and upload in place. Used by profile, links, pages, and projects. */
export default function MediaPicker({ open, title = "Choose an image", onClose, onPick }: Props) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    listMedia({ q, folder, limit: 120 }).then((r) => setItems(r.items)).catch((e) => { setItems([]); setError(e instanceof ApiError ? e.message : "Could not load the library."); });
  }, [q, folder]);

  useEffect(() => { if (open) listFolders().then((r) => setFolders(r.items)).catch(() => setFolders([])); }, [open]);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(load, q ? 250 : 0); // small delay while typing
    return () => window.clearTimeout(t);
  }, [open, load, q]);

  const { busy, uploadMany } = useUploader((added) => {
    if (added.length === 1) { onPick(added[0]); return; } // one new image: use it right away
    load();
  });

  return (
    <Modal open={open} onClose={onClose} size="lg" title={title} footer={<Button variant="secondary" onClick={onClose}>Cancel</Button>}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
          <Input aria-label="Search images" placeholder="Search by name or description" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select aria-label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="all">All images</option>
            <option value="none">Unfiled</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.assetCount})</option>)}
          </Select>
          <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" aria-label="Upload images" tabIndex={-1}
            onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void uploadMany(files, folder !== "all" && folder !== "none" ? folder : null).catch(() => toast.show("Upload failed.", "error")); }} />
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>Upload</Button>
        </div>
        {error && <p role="alert" className="text-danger">{error}</p>}
        {items === null ? <p>Loading…</p> : items.length === 0 ? (
          <p>{q || folder !== "all" ? "No images match." : "No images yet. Upload one to get started."}</p>
        ) : (
          <ul className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {items.map((a) => (
              <li key={a.id}>
                <button type="button" aria-label={`Use ${a.name}`} onClick={() => onPick(a)}
                  className={cn("group relative block aspect-square w-full overflow-hidden rounded-control border border-line bg-raised hover:border-accent")}>
                  <img src={a.url} alt="" loading="lazy" className="size-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-left text-[11px] text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
