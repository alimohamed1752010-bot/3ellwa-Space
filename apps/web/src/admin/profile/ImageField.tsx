import { useRef, useState } from "react";
import { api, ApiError } from "../../shared/api";
import { Button, useToast } from "../../shared/ui";
import MediaPicker from "../media/MediaPicker";
import { cn } from "../../shared/cn";
import { checkImageFile } from "./types";
import type { MediaAsset } from "./types";

interface Props {
  label: string;
  purpose: "avatar" | "banner" | "link";
  url: string | null;
  onChange: (asset: { id: string; url: string } | null) => void;
  round?: boolean;
}

export default function ImageField({ label, purpose, url, onChange, round }: Props) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pick, setPick] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const problem = checkImageFile(file, purpose);
    if (problem) { setError(problem); return; }
    setError(""); setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("purpose", purpose);
      const r = await api.upload<{ asset: MediaAsset }>("/api/admin/media/upload", form);
      onChange({ id: r.asset.id, url: r.asset.url });
      toast.show(purpose === "link" ? `${label} uploaded. Save the link to keep it.` : `${label} uploaded. Save the profile to publish it.`, "success");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className={cn("flex gap-4", purpose === "banner" ? "flex-col" : "items-center")}>
        <div
          className={cn("shrink-0 overflow-hidden border border-line bg-raised", round ? "size-20 rounded-full" : "aspect-[3/1] w-full max-w-md rounded-control")}
          aria-label={url ? `${label} preview` : `No ${label.toLowerCase()} set`}
        >
          {url && <img src={url} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label={`${label} file`} tabIndex={-1} onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>{url ? "Replace" : "Upload"}</Button>
          <Button variant="ghost" size="sm" onClick={() => setPick(true)}>Pick existing</Button>
          {url && <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Remove</Button>}
        </div>
      </div>
      <p className={cn("text-xs", error ? "text-danger" : "text-muted")} role={error ? "alert" : undefined}>
        {error || `PNG, JPEG, WebP, or GIF, up to ${purpose === "avatar" ? 2 : purpose === "banner" ? 5 : 1} MB.`}
      </p>
      <MediaPicker open={pick} title={`Pick a ${purpose}`} onClose={() => setPick(false)} onPick={(a) => { onChange({ id: a.id, url: a.url }); setPick(false); }} />
    </div>
  );
}
