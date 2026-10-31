import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../shared/api";
import { Button, Card, CardBody, CardHeader } from "../shared/ui";
import DnsRecordManager from "./DnsRecordManager";

type DomainData = {
  zone: { name: string; status: string; nameServers: string[] };
  records: Array<{ id: string; name: string; type: string; content: string; ttl: number; proxied: boolean; comment: string | null }>;
  workerDomains: Array<{ hostname: string; service: string; environment: string; enabled: boolean }>;
  checkedAt: string;
};

type DnsCheck = {
  hostname: string;
  resolver: string;
  hasAddress: boolean;
  hasAnswer: boolean;
  records: Array<{ type: "A" | "AAAA" | "CNAME"; status: number; answers: string[] }>;
  checkedAt: string;
};

type NsCheck = { zone: string; resolver: string; status: number; nameServers: string[]; checkedAt: string; limitation: string };
type DnsAudit = { id: string; action: "create" | "edit" | "delete"; hostname: string; recordType: string; recordId: string; before: { content: string; name: string } | null; after: { content: string; name: string } | null; createdAt: string };

export default function DomainsScreen() {
  const [data, setData] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");
  const [dnsChecks, setDnsChecks] = useState<Record<string, DnsCheck>>({});
  const [checkingDns, setCheckingDns] = useState("");
  const [nsCheck, setNsCheck] = useState<NsCheck | null>(null);
  const [checkingNs, setCheckingNs] = useState(false);
  const [auditItems, setAuditItems] = useState<DnsAudit[]>([]);
  const [auditError, setAuditError] = useState("");

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data?.records ?? [];
    return (data?.records ?? []).filter(record =>
      [record.name, record.type, record.content, record.comment ?? ""].some(value => value.toLowerCase().includes(q))
    );
  }, [data, query]);

  const copyValue = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(current => current === label ? "" : current), 1800);
    } catch {
      setError("Clipboard access was blocked by the browser. Select and copy the value manually.");
    }
  }, []);

  const checkDns = useCallback(async (hostname: string) => {
    setCheckingDns(hostname);
    setError("");
    try {
      const result = await api.get<DnsCheck>(`/api/admin/domains/dns-check?hostname=${encodeURIComponent(hostname)}`);
      setDnsChecks(current => ({ ...current, [hostname]: result }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not check public DNS.");
    } finally {
      setCheckingDns("");
    }
  }, []);

  const checkNameservers = useCallback(async () => {
    setCheckingNs(true);
    setError("");
    try {
      setNsCheck(await api.get<NsCheck>("/api/admin/domains/ns-check"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not check public nameserver records.");
    } finally {
      setCheckingNs(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const result = await api.get<{ items: DnsAudit[] }>("/api/admin/domains/audit?limit=50");
      setAuditItems(result.items);
      setAuditError("");
    } catch (e) {
      setAuditError(e instanceof ApiError ? e.message : "Could not load DNS change history.");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSetup(false);
    try {
      setData(await api.get<DomainData>("/api/admin/domains"));
    } catch (e) {
      if (e instanceof ApiError && e.code === "setup_required") setSetup(true);
      setError(e instanceof ApiError ? e.message : "Could not load domain information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); void loadAudit(); }, [load, loadAudit]);

  return (
    <div className="rise flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Domains</h1>
          <p className="mt-1 text-sm text-muted">Subdomains, DNS records, and Cloudflare Worker destinations for 3ellwa.space.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>Refresh inventory</Button>
      </div>

      {loading && <p className="text-sm text-muted" role="status">Checking Cloudflare…</p>}
      {!loading && error && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p role="alert" className="text-sm text-danger">{error}</p>
            {setup && <div className="rounded-control border border-line bg-raised p-3 text-sm">
              <p className="font-medium text-ink">One-time setup</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                <li>Create a Cloudflare API token with Zone Read, DNS Read, and DNS Edit permissions scoped to the 3ellwa.space zone, plus Workers Scripts Read scoped to the Cloudflare account.</li>
                <li>From the project folder, run <code>npx wrangler secret put CF_API_TOKEN</code>.</li>
                <li>Paste the token into the terminal prompt, not into chat or the website.</li>
                <li>Wait for the Worker to redeploy, then refresh this screen.</li>
              </ol>
            </div>}
            <div><Button size="sm" variant="secondary" onClick={() => void load()}>Retry</Button></div>
          </CardBody>
        </Card>
      )}

      {!loading && data && <>
        <Card>
          <CardHeader title={data.zone.name} description="Cloudflare zone status" />
          <CardBody className="flex flex-col gap-2">
            <p className="text-sm">Zone status: <span className="font-medium text-ink">{data.zone.status}</span></p>
            <div className="text-xs text-muted">Nameservers</div>
            {data.zone.nameServers.length ? <ul className="space-y-1 font-mono text-xs text-muted">{data.zone.nameServers.map(ns => <li key={ns}>{ns}</li>)}</ul> : <p className="text-xs text-muted">Cloudflare did not return nameservers.</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">Public NS records (recursive resolver view)</p>
              <Button size="sm" variant="secondary" onClick={() => void checkNameservers()} disabled={checkingNs}>{checkingNs ? "Checking…" : "Check public NS records"}</Button>
            </div>
            {nsCheck && <div className="rounded-control border border-line bg-raised p-3 text-xs text-muted" role="status">
              {(() => {
                const expected = data.zone.nameServers.map(value => value.toLowerCase().replace(/\.$/, "")).sort();
                const actual = [...nsCheck.nameServers].sort();
                const matches = expected.length > 0 && expected.length === actual.length && expected.every((value, index) => value === actual[index]);
                return <p className="font-medium text-ink">{nsCheck.status === 3 ? "Public resolver reports NXDOMAIN" : matches ? "Public NS answer matches Cloudflare's assigned nameservers" : actual.length ? "Public NS answer differs from Cloudflare's assigned nameservers" : "No NS answer returned"}</p>;
              })()}
              {nsCheck.nameServers.length > 0 && <ul className="mt-2 space-y-1 font-mono">{nsCheck.nameServers.map(value => <li key={value}>{value}</li>)}</ul>}
              <p className="mt-2">{nsCheck.limitation} Checked {new Date(nsCheck.checkedAt).toLocaleTimeString()}.</p>
            </div>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Worker domains" description="Custom hostnames currently attached to Cloudflare Workers." />
          <CardBody className="flex flex-col gap-3">
            {data.workerDomains.length ? data.workerDomains.map(d => <div key={d.hostname} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
              <div><p className="text-sm font-medium">{d.hostname}</p><p className="text-xs text-muted">{d.service} · {d.environment}</p></div>
              <span className={d.enabled ? "text-xs text-success" : "text-xs text-muted"}>{d.enabled ? "Enabled" : "Disabled"}</span>
            </div>) : <p className="text-sm text-muted">No Worker custom domains found for this zone.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="DNS records" description={`${filteredRecords.length} of ${data.records.length} records shown.`} />
          <CardBody className="flex flex-col gap-3">
            <DnsRecordManager zoneName={data.zone.name} records={data.records} workerDomains={data.workerDomains} onChanged={async () => { await load(); await loadAudit(); }} />
            <label className="flex flex-col gap-1 text-xs text-muted">
              Search records
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Hostname, type, or target" className="w-full rounded-control border border-line bg-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
            </label>
            {filteredRecords.length ? filteredRecords.map(record => <div key={record.id} className="grid gap-2 border-b border-line pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="break-all text-sm font-medium">{record.name}</p><button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-muted hover:text-ink" onClick={() => void copyValue(record.name, "name:" + record.id)}>{copied === "name:" + record.id ? "Copied" : "Copy name"}</button></div>
                <div className="mt-1 flex flex-wrap items-center gap-2"><p className="break-all font-mono text-xs text-muted">{record.content}</p><button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-muted hover:text-ink" onClick={() => void copyValue(record.content, "content:" + record.id)}>{copied === "content:" + record.id ? "Copied" : "Copy target"}</button></div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><span className="rounded-control bg-raised px-2 py-1">{record.type}</span><span>{record.proxied ? "Proxied" : "DNS only"}</span><span>TTL {record.ttl === 1 ? "Auto" : record.ttl}</span>{record.name !== data.zone.name && <Button size="sm" variant="secondary" onClick={() => void checkDns(record.name)} disabled={checkingDns === record.name}>{checkingDns === record.name ? "Checking…" : "Check public DNS"}</Button>}</div>
              {dnsChecks[record.name] && <p className="text-xs text-muted sm:col-span-2" role="status">{dnsChecks[record.name].hasAnswer ? "Public DNS answers: " + dnsChecks[record.name].records.filter(item => item.answers.length).map(item => item.type + " " + item.answers.join(", ")).join(" · ") : dnsChecks[record.name].records.some(item => item.status === 3) ? "Public DNS reports NXDOMAIN for this hostname." : "No A, AAAA, or CNAME answer was returned."} · Checked {new Date(dnsChecks[record.name].checkedAt).toLocaleTimeString()}</p>}
            </div>) : <p className="text-sm text-muted">{data.records.length ? "No records match this search." : "No DNS records were returned."}</p>}
            {copied && <p className="text-xs text-success" role="status">Copied to clipboard.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="DNS change history" description="Recent changes submitted through this dashboard. External Cloudflare edits are not included." />
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted">Latest {auditItems.length} recorded changes</p>
              <Button size="sm" variant="secondary" onClick={() => void loadAudit()}>Refresh history</Button>
            </div>
            {auditError && <p role="alert" className="text-xs text-danger">{auditError}</p>}
            {auditItems.length ? auditItems.map(item => <div key={item.id} className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{item.action.toUpperCase()} · {item.hostname}</p>
                <span className="text-xs text-muted">{new Date(item.createdAt.replace(" ", "T") + (item.createdAt.endsWith("Z") ? "" : "Z")).toLocaleString()}</span>
              </div>
              <p className="font-mono text-xs text-muted">{item.recordType} · {item.before ? item.before.content + " → " : ""}{item.after?.content ?? "record removed"}</p>
            </div>) : !auditError ? <p className="text-sm text-muted">No DNS changes have been recorded yet.</p> : null}
          </CardBody>
        </Card>
        <p className="text-xs text-muted">DNS writes are restricted to supported subdomain records and require a fresh preview plus explicit confirmation. Public DNS checks query Cloudflare's 1.1.1.1 resolver; they do not guarantee that every network has received the same result. Last inventory check {new Date(data.checkedAt).toLocaleString()}.</p>
      </>}
    </div>
  );
}
