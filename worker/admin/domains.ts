import { Hono } from "hono";
import type { AppEnv } from "../env";
import { apiError } from "../lib/http";

export const domainRoutes = new Hono<AppEnv>();

type CfEnvelope<T> = { success: boolean; result: T; errors?: Array<{ code?: number; message?: string }>; result_info?: { total_pages?: number } };
type Zone = { id: string; name: string; status: string; name_servers?: string[] };
type DnsRecord = { id: string; name: string; type: string; content: string; ttl: number; proxied: boolean; comment?: string | null };
type WorkerDomain = { hostname: string; service: string; environment: string; enabled: boolean; zone_name: string };

async function cloudflareList<T>(token: string, path: string): Promise<T[]> {
  const items: T[] = [];
  const separator = path.includes("?") ? "&" : "?";
  const maxPages = 20;
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetch("https://api.cloudflare.com/client/v4" + path + separator + "per_page=100&page=" + page, {
      headers: { authorization: "Bearer " + token, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    let body: CfEnvelope<T[]> | null = null;
    try { body = await response.json() as CfEnvelope<T[]>; } catch { /* handled below */ }
    if (!response.ok || !body?.success || !Array.isArray(body.result)) {
      const message = body?.errors?.map(x => x.message).filter(Boolean).join(" ") || "Cloudflare API request failed.";
      throw new Error(response.status === 403
        ? "The Cloudflare token needs Zone Read, DNS Read, and DNS Edit on the 3ellwa.space zone, plus Workers Scripts Read on the account."
        : message);
    }
    items.push(...body.result);
    const totalPages = Math.max(1, body.result_info?.total_pages ?? 1);
    if (page >= totalPages) return items;
  }
  throw new Error("Cloudflare returned more than 2,000 inventory entries; the result was stopped at the safety limit.");
}


domainRoutes.get("/domains/dns-check", async c => {
  const zoneName = (c.env.CF_ZONE_NAME || "3ellwa.space").toLowerCase();
  const hostname = (c.req.query("hostname") || "").trim().toLowerCase();
  const validHostname = hostname.length <= 253
    && hostname.length > zoneName.length
    && hostname.endsWith("." + zoneName)
    && hostname.split(".").every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
  if (!validHostname) {
    return apiError(c, 400, "invalid_hostname", "Enter a subdomain inside " + zoneName + ". The zone apex and external hostnames are not accepted.");
  }

  try {
    const types = ["A", "AAAA", "CNAME"] as const;
    const results = await Promise.all(types.map(async type => {
      const url = "https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(hostname) + "&type=" + type;
      const response = await fetch(url, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("The public DNS resolver returned HTTP " + response.status + ".");
      const body = await response.json() as { Status?: number; Answer?: Array<{ type?: number; data?: string; TTL?: number }> };
      const typeCode = type === "A" ? 1 : type === "CNAME" ? 5 : 28;
      return {
        type,
        status: typeof body.Status === "number" ? body.Status : -1,
        answers: (body.Answer ?? []).filter(answer => answer.type === typeCode && typeof answer.data === "string").map(answer => answer.data!),
      };
    }));
    return c.json({
      hostname,
      resolver: "Cloudflare public DNS (1.1.1.1)",
      records: results,
      hasAddress: results.some(result => (result.type === "A" || result.type === "AAAA") && result.answers.length > 0),
      hasAnswer: results.some(result => result.answers.length > 0),
      checkedAt: new Date().toISOString(),
    }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    return apiError(c, 502, "dns_check_failed", error instanceof Error ? error.message : "Could not query public DNS.");
  }
});

domainRoutes.get("/domains", async c => {
  const token = c.env.CF_API_TOKEN;
  const accountId = c.env.CF_ACCOUNT_ID;
  const zoneName = c.env.CF_ZONE_NAME || "3ellwa.space";
  if (!token || !accountId) {
    return apiError(c, 502, "setup_required", "Domain manager needs the CF_API_TOKEN Worker secret. The token requires Zone Read, DNS Read, and DNS Edit on the 3ellwa.space zone, plus Workers Scripts Read on the Cloudflare account.");
  }
  try {
    const zoneQuery = "/zones?name=" + encodeURIComponent(zoneName) + "&account.id=" + encodeURIComponent(accountId);
    const zones = await cloudflareList<Zone>(token, zoneQuery);
    const zone = zones.find(x => x.name.toLowerCase() === zoneName.toLowerCase());
    if (!zone) return apiError(c, 404, "zone_not_found", "The 3ellwa.space zone was not found in this Cloudflare account.");

    const [records, workerDomains] = await Promise.all([
      cloudflareList<DnsRecord>(token, "/zones/" + encodeURIComponent(zone.id) + "/dns_records"),
      cloudflareList<WorkerDomain>(token, "/accounts/" + encodeURIComponent(accountId) + "/workers/domains"),
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
