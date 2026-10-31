import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../shared/api";
import { Button, Card, CardBody, CardHeader } from "../shared/ui";

type DomainData = {
  zone: { name: string; status: string; nameServers: string[] };
  records: Array<{ id: string; name: string; type: string; content: string; ttl: number; proxied: boolean; comment: string | null }>;
  workerDomains: Array<{ hostname: string; service: string; environment: string; enabled: boolean }>;
  checkedAt: string;
};

export default function DomainsScreen() {
  const [data, setData] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);

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
      <div>
        <h1 className="text-xl font-medium">Domains</h1>
        <p className="mt-1 text-sm text-muted">Subdomains, DNS records, and Cloudflare Worker destinations for 3ellwa.space.</p>
      </div>

      {loading && <p className="text-sm text-muted" role="status">Checking Cloudflare…</p>}
      {!loading && error && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p role="alert" className="text-sm text-danger">{error}</p>
            {setup && <div className="rounded-control border border-line bg-raised p-3 text-sm">
              <p className="font-medium text-ink">One-time setup</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                <li>Create a Cloudflare API token with Zone Read, DNS Read, and Workers Scripts Read permissions, scoped to the 3ellwa.space zone.</li>
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
          <CardHeader title="DNS records" description={`${data.records.length} records returned for this zone.`} />
          <CardBody className="flex flex-col gap-3">
            {data.records.length ? data.records.map(record => <div key={record.id} className="grid gap-1 border-b border-line pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0"><p className="break-all text-sm font-medium">{record.name}</p><p className="break-all font-mono text-xs text-muted">{record.content}</p></div>
              <div className="flex items-center gap-2 text-xs text-muted"><span className="rounded-control bg-raised px-2 py-1">{record.type}</span><span>{record.proxied ? "Proxied" : "DNS only"}</span><span>TTL {record.ttl === 1 ? "Auto" : record.ttl}</span></div>
            </div>) : <p className="text-sm text-muted">No DNS records were returned.</p>}
          </CardBody>
        </Card>
        <p className="text-xs text-muted">Read-only checkpoint. DNS changes are deliberately not enabled yet. Last checked {new Date(data.checkedAt).toLocaleString()}.</p>
      </>}
    </div>
  );
}
