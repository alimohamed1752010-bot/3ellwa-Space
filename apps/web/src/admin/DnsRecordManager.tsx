import { useCallback, useState } from "react";
import { api, ApiError } from "../shared/api";
import { Button } from "../shared/ui";

type DnsRecord = { id: string; name: string; type: string; content: string; ttl: number; proxied: boolean; comment: string | null };
type WorkerDomain = { hostname: string; service: string; environment: string; enabled: boolean };
type Draft = { name: string; type: "A" | "AAAA" | "CNAME"; content: string; ttl: string; proxied: boolean; comment: string };
type Preview = { action: "create" | "edit" | "delete"; hostname: string; before: DnsRecord | null; after: { name: string; type: string; content: string; ttl: number; proxied: boolean; comment: string | null } | null; recordId: string | null; expiresAt: string; confirmationToken: string };
type Props = { zoneName: string; records: DnsRecord[]; workerDomains: WorkerDomain[]; onChanged: () => Promise<void> };

const emptyDraft: Draft = { name: "", type: "A", content: "", ttl: "1", proxied: true, comment: "" };
const protectedLabels = new Set(["www", "mail", "smtp", "imap", "pop", "ftp", "webmail", "autodiscover", "autoconfig", "ns1", "ns2"]);

function editable(record: DnsRecord, zoneName: string, workerDomains: WorkerDomain[]) {
  const suffix = "." + zoneName.toLowerCase();
  const relative = record.name.toLowerCase().endsWith(suffix) ? record.name.slice(0, -suffix.length) : "";
  return ["A", "AAAA", "CNAME"].includes(record.type)
    && !!relative && !(!relative.includes(".") && protectedLabels.has(relative.toLowerCase()))
    && !workerDomains.some(domain => domain.hostname.toLowerCase() === record.name.toLowerCase());
}

export default function DnsRecordManager({ zoneName, records, workerDomains, onChanged }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [mode, setMode] = useState<"create" | "edit" | "delete">("create");
  const [recordId, setRecordId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updateDraft = useCallback((patch: Partial<Draft>) => {
    setDraft(current => ({ ...current, ...patch }));
    setPreview(null);
    setConfirmed(false);
  }, []);

  const reset = useCallback(() => {
    setDraft(emptyDraft);
    setMode("create");
    setRecordId("");
    setPreview(null);
    setConfirmed(false);
    setTypedName("");
    setError("");
  }, []);

  const edit = useCallback((record: DnsRecord) => {
    if (!editable(record, zoneName, workerDomains)) return;
    setMode("edit");
    setRecordId(record.id);
    setDraft({ name: record.name, type: record.type as Draft["type"], content: record.content, ttl: String(record.ttl), proxied: record.proxied, comment: record.comment ?? "" });
    setPreview(null);
    setConfirmed(false);
    setTypedName("");
    setError("");
  }, [workerDomains, zoneName]);

  const remove = useCallback((record: DnsRecord) => {
    if (!editable(record, zoneName, workerDomains)) return;
    setMode("delete");
    setRecordId(record.id);
    setDraft({ name: record.name, type: record.type as Draft["type"], content: record.content, ttl: String(record.ttl), proxied: record.proxied, comment: record.comment ?? "" });
    setPreview(null);
    setConfirmed(false);
    setTypedName("");
    setError("");
  }, [workerDomains, zoneName]);

  const prepare = useCallback(async () => {
    setError("");
    setPreview(null);
    setConfirmed(false);
    setTypedName("");
    const body = mode === "delete"
      ? { action: "delete", recordId }
      : mode === "edit"
        ? { action: "edit", recordId, content: draft.content, ttl: Number(draft.ttl), proxied: draft.proxied, comment: draft.comment || null }
        : { action: "create", name: draft.name, type: draft.type, content: draft.content, ttl: Number(draft.ttl), proxied: draft.proxied, comment: draft.comment || null };
    try {
      setPreview(await api.post<Preview>("/api/admin/domains/records/preview", body));
      setTypedName("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not prepare the DNS preview.");
    }
  }, [draft, mode, recordId]);

  const apply = useCallback(async () => {
    if (!preview || !confirmed || typedName.trim().toLowerCase() !== preview.hostname) return;
    setBusy(true);
    setError("");
    const proof = { confirmationToken: preview.confirmationToken, confirmName: typedName.trim(), expiresAt: preview.expiresAt };
    try {
      if (preview.action === "create") {
        await api.post("/api/admin/domains/records", { name: draft.name, type: draft.type, content: draft.content, ttl: Number(draft.ttl), proxied: draft.proxied, comment: draft.comment || null, ...proof });
      } else if (preview.action === "edit") {
        await api.put("/api/admin/domains/records/" + recordId, { recordId, content: draft.content, ttl: Number(draft.ttl), proxied: draft.proxied, comment: draft.comment || null, ...proof });
      } else {
        await api.del("/api/admin/domains/records/" + recordId, { recordId, ...proof });
      }
      reset();
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Cloudflare could not apply the DNS change.");
      setPreview(null);
      setConfirmed(false);
      setTypedName("");
    } finally {
      setBusy(false);
    }
  }, [confirmed, draft, onChanged, preview, recordId, reset, typedName]);

  const manageable = records.filter(record => editable(record, zoneName, workerDomains));

  return (
    <div className="flex flex-col gap-3 rounded-control border border-line bg-raised p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{mode === "create" ? "Add DNS record" : mode === "edit" ? "Edit DNS record" : "Delete DNS record"}</p>
          <p className="mt-1 text-xs text-muted">Only A, AAAA, and CNAME records on safe subdomains can be managed.</p>
        </div>
        {mode !== "create" && <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>}
      </div>

      {mode !== "delete" ? <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">Hostname
          <input value={draft.name} disabled={mode === "edit"} onChange={e => updateDraft({ name: e.target.value })} placeholder={"app." + zoneName} className="w-full rounded-control border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Type
          <select value={draft.type} disabled={mode === "edit"} onChange={e => updateDraft({ type: e.target.value as Draft["type"] })} className="w-full rounded-control border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60">
            <option value="A">A · IPv4</option><option value="AAAA">AAAA · IPv6</option><option value="CNAME">CNAME · hostname</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Target
          <input value={draft.content} onChange={e => updateDraft({ content: e.target.value })} placeholder={draft.type === "A" ? "203.0.113.10" : draft.type === "AAAA" ? "2001:db8::1" : "target.example.com"} className="w-full rounded-control border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">TTL
          <select value={draft.ttl} onChange={e => updateDraft({ ttl: e.target.value })} className="w-full rounded-control border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent">
            <option value="1">Auto</option><option value="60">1 minute</option><option value="300">5 minutes</option><option value="900">15 minutes</option><option value="1800">30 minutes</option><option value="3600">1 hour</option><option value="14400">4 hours</option><option value="86400">1 day</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">Comment (optional)
          <input value={draft.comment} maxLength={100} onChange={e => updateDraft({ comment: e.target.value })} placeholder="What this subdomain is used for" className="w-full rounded-control border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2"><input type="checkbox" checked={draft.proxied} onChange={e => updateDraft({ proxied: e.target.checked })} /> Proxy through Cloudflare</label>
      </div> : <p className="text-sm text-muted">This will remove <strong className="text-ink">{draft.name}</strong> ({draft.type}). DNS deletion cannot be automatically undone.</p>}

      {!preview && <Button size="sm" onClick={() => void prepare()}>{mode === "delete" ? "Preview deletion" : "Preview DNS change"}</Button>}
      {preview && <div className="flex flex-col gap-3 border-t border-line pt-3">
        <p className="text-sm font-medium">Review production change</p>
        <p className="text-xs text-muted">{preview.action === "create" ? "Create" : preview.action === "edit" ? "Update" : "Delete"} <strong className="text-ink">{preview.hostname}</strong>. Preview expires {new Date(preview.expiresAt).toLocaleTimeString()}.</p>
        {preview.before && <p className="break-all rounded-control bg-panel p-2 font-mono text-xs text-muted">Current: {preview.before.type} {preview.before.name} → {preview.before.content}</p>}
        {preview.after && <p className="break-all rounded-control bg-panel p-2 font-mono text-xs text-muted">Proposed: {preview.after.type} {preview.after.name} → {preview.after.content} · TTL {preview.after.ttl === 1 ? "Auto" : preview.after.ttl} · {preview.after.proxied ? "Proxied" : "DNS only"}</p>}
        <label className="flex flex-col gap-1 text-xs text-muted">Type <strong className="break-all text-ink">{preview.hostname}</strong> to confirm this exact hostname
          <input value={typedName} onChange={e => setTypedName(e.target.value)} autoComplete="off" spellCheck={false} placeholder={preview.hostname} className="w-full rounded-control border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" />I reviewed this exact change and confirm applying it to production DNS.</label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={preview.action === "delete" ? "danger" : "primary"} disabled={!confirmed || typedName.trim().toLowerCase() !== preview.hostname || busy} loading={busy} onClick={() => void apply()}>{preview.action === "delete" ? "Confirm delete" : preview.action === "edit" ? "Confirm update" : "Confirm create"}</Button>
          <Button size="sm" variant="secondary" onClick={() => { setPreview(null); setConfirmed(false); setTypedName(""); }}>Back</Button>
        </div>
      </div>}

      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-medium text-muted">Manageable records ({manageable.length})</p>
        {manageable.length ? <div className="flex flex-col gap-2">{manageable.map(record => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><p className="break-all text-xs font-medium text-ink">{record.name}</p><p className="break-all font-mono text-xs text-muted">{record.type} · {record.content}</p></div>
          <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => edit(record)}>Edit</Button><Button size="sm" variant="danger" onClick={() => remove(record)}>Delete</Button></div>
        </div>)}</div> : <p className="text-xs text-muted">No editable A, AAAA, or CNAME subdomain records were found.</p>}
      </div>
    </div>
  );
}
