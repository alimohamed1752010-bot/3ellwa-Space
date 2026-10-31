import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../shared/api";
import { Button, Card, CardBody, CardHeader } from "../shared/ui";

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
  records: Array<{ type: "A" | "AAAA" | "CNAME"; status: number; answers: string[] }>;
  checkedAt: string;
};

export default function DomainsScreen() {
  const [data, setData] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");
  const [dnsChecks, setDnsChecks] = useState<Record<string, DnsCheck>>({});
  const [checkingDns, setCheckingDns] = useState("");

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

  useEffect(() => { void load(); }, [load]);

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
                <li>Create a Cloudflare API token with Zone Read and DNS Read permissions scoped to the 3ellwa.space zone, plus Workers Scripts Read scoped to the Cloudflare account.</li>
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
            <label className="flex flex-col gap-1 text-xs text-muted">
              Search records
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Hostname, type, or target" className="w-full rounded-control border border-line bg-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
            </label>
            {filteredRecords.length ? filteredRecords.map(record => <div key={record.id} className="grid gap-2 border-b border-line pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="break-all text-sm font-medium">{record.name}</p><button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-muted hover:text-ink" onClick={() => void copyValue(record.name, "name:" + record.id)}>{copied === "name:" + record.id ? "Copied" : "Copy name"}</button></div>
                <div className="mt-1 flex flex-wrap items-center gap-2"><p className="break-all font-mono text-xs text-muted">{record.content}</p><button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-muted hover:text-ink" onClick={() => void copyValue(record.content, "content:" + record.id)}>{copied === "content:" + record.id ? "Copied" : "Copy target"}</button></div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><span className="rounded-control bg-raised px-2 py-1">{record.type}</span><span>{record.proxied ? "Proxied" : "DNS only"}</span><span>TTL {record.ttl === 1 ? "Auto" : record.ttl}</span><Button size="sm" variant="secondary" onClick={() => void checkDns(record.name)} disabled={checkingDns === record.name}>{checkingDns === record.name ? "Checking…" : "Check public DNS"}</Button></div>
              {dnsChecks[record.name] && <p className="text-xs text-muted sm:col-span-2" role="status">{dnsChecks[record.name].hasAddress ? "Public DNS resolves to " + dnsChecks[record.name].records.flatMap(item => item.answers).join(", ") : "No public A/AAAA address found."} · Checked {new Date(dnsChecks[record.name].checkedAt).toLocaleTimeString()}</p>}
            </div>) : <p className="text-sm text-muted">{data.records.length ? "No records match this search." : "No DNS records were returned."}</p>}
            {copied && <p className="text-xs text-success" role="status">Copied to clipboard.</p>}
          </CardBody>
        </Card>
        <p className="text-xs text-muted">Read-only checkpoint. DNS changes are deliberately not enabled yet. Public DNS checks query Cloudflare's 1.1.1.1 resolver; they do not guarantee that every network has received the same result. Last inventory check {new Date(data.checkedAt).toLocaleString()}.</p>
      </>}
    </div>
  );
}
