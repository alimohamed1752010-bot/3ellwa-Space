import { Hono } from "hono";
import type { AppEnv } from "../env";
import { apiError } from "../lib/http";

export const domainRoutes = new Hono<AppEnv>();

type CfEnvelope<T> = { success: boolean; result: T; errors?: Array<{ code?: number; message?: string }>; result_info?: { total_pages?: number } };
type Zone = { id: string; name: string; status: string; name_servers?: string[] };
type DnsRecord = { id: string; name: string; type: string; content: string; ttl: number; proxied: boolean; comment?: string | null };
type WorkerDomain = { hostname: string; service: string; environment: string; enabled: boolean; zone_name: string };

async function cloudflare<T>(token: string, path: string): Promise<T> {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    headers: { authorization: "Bearer " + token, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  let body: CfEnvelope<T> | null = null;
  try { body = await response.json() as CfEnvelope<T>; } catch { /* handled below */ }
  if (!response.ok || !body?.success) {
    const message = body?.errors?.map(x => x.message).filter(Boolean).join(" ") || "Cloudflare API request failed.";
    throw new Error(response.status === 403 ? "The Cloudflare token needs Zone Read and DNS Read permissions." : message);
  }
  return body.result;
}

domainRoutes.get("/domains", async c => {
  const token = c.env.CF_API_TOKEN;
  const accountId = c.env.CF_ACCOUNT_ID;
  const zoneName = c.env.CF_ZONE_NAME || "3ellwa.space";
  if (!token || !accountId) {
    return apiError(c, 502, "setup_required", "Domain manager needs the CF_API_TOKEN Worker secret. Add a Cloudflare API token with Zone Read, DNS Read, and Workers Scripts Read permissions, then retry.");
  }
  try {
    const zoneQuery = "/zones?name=" + encodeURIComponent(zoneName) + "&account.id=" + encodeURIComponent(accountId) + "&per_page=50";
    const zones = await cloudflare<Zone[]>(token, zoneQuery);
    const zone = zones.find(x => x.name.toLowerCase() === zoneName.toLowerCase());
    if (!zone) return apiError(c, 404, "zone_not_found", "The 3ellwa.space zone was not found in this Cloudflare account.");

    const [records, workerDomains] = await Promise.all([
      cloudflare<DnsRecord[]>(token, "/zones/" + encodeURIComponent(zone.id) + "/dns_records?per_page=100&page=1"),
      cloudflare<WorkerDomain[]>(token, "/accounts/" + encodeURIComponent(accountId) + "/workers/domains"),
    ]);
    const relevantRecords = records
      .filter(r => r.name === zone.name || r.name.toLowerCase().endsWith("." + zone.name.toLowerCase()))
      .map(r => ({ id: r.id, name: r.name, type: r.type, content: r.content, ttl: r.ttl, proxied: !!r.proxied, comment: r.comment ?? null }));
    const relevantWorkerDomains = workerDomains
      .filter(d => d.zone_name.toLowerCase() === zone.name.toLowerCase() && (d.hostname === zone.name || d.hostname.toLowerCase().endsWith("." + zone.name.toLowerCase())))
      .map(d => ({ hostname: d.hostname, service: d.service, environment: d.environment, enabled: d.enabled }));
    return c.json({
      zone: { name: zone.name, status: zone.status, nameServers: zone.name_servers ?? [] },
      records: relevantRecords,
      workerDomains: relevantWorkerDomains,
      checkedAt: new Date().toISOString(),
    }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error(JSON.stringify({ event: "domain_inventory_failed", message: error instanceof Error ? error.message : "unknown" }));
    return apiError(c, 502, "cloudflare_unavailable", error instanceof Error ? error.message : "Could not read Cloudflare domain information.");
  }
});
