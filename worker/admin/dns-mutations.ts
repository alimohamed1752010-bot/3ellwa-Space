import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { apiError } from "../lib/http";
import { parseBody } from "../lib/validate";

export const dnsMutationRoutes = new Hono<AppEnv>();

type CfEnvelope<T> = { success: boolean; result: T; errors?: Array<{ message?: string }>; result_info?: { total_pages?: number } };
type Zone = { id: string; name: string };
type DnsRecord = { id: string; name: string; type: string; content: string; ttl: number; proxied: boolean; comment?: string | null };
type WorkerDomain = { hostname: string; zone_name: string };
type RecordInput = { name: string; type: "A" | "AAAA" | "CNAME"; content: string; ttl: number; proxied: boolean; comment: string | null };
type Plan = { action: "create" | "edit" | "delete"; zoneId: string; hostname: string; before: DnsRecord | null; after: RecordInput | null; recordId: string | null; observed: DnsRecord[] };

const supported = ["A", "AAAA", "CNAME"] as const;
const idSchema = z.string().regex(/^[a-f0-9]{32}$/i);
const ttlSchema = z.number().int().refine(n => n === 1 || (n >= 60 && n <= 86400));
const common = { content: z.string().trim().min(1).max(253), ttl: ttlSchema, proxied: z.boolean(), comment: z.string().trim().max(100).nullish() };
const createSchema = z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(253), type: z.enum(supported), ...common }).strict();
const editSchema = z.object({ action: z.literal("edit"), recordId: idSchema, ...common }).strict();
const deleteSchema = z.object({ action: z.literal("delete"), recordId: idSchema }).strict();
const previewSchema = z.discriminatedUnion("action", [createSchema, editSchema, deleteSchema]);
const confirmation = { confirmationToken: z.string().length(64), confirmName: z.string().trim().min(1).max(253), expiresAt: z.string().min(20).max(40) };
const createWrite = createSchema.omit({ action: true }).extend(confirmation);
const editWrite = editSchema.omit({ action: true }).extend(confirmation);
const deleteWrite = deleteSchema.omit({ action: true }).extend(confirmation);
const protectedLabels = new Set(["www", "mail", "smtp", "imap", "pop", "ftp", "webmail", "autodiscover", "autoconfig", "ns1", "ns2"]);

function validHost(host: string, zone: string): boolean {
  const value = host.toLowerCase().replace(/\.$/, "");
  return value.length <= 253 && value.length > zone.length && value.endsWith("." + zone)
    && value.split(".").every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}
function protectedHost(host: string, zone: string): boolean {
  const relative = host.slice(0, -(zone.length + 1));
  return !relative || (!relative.includes(".") && protectedLabels.has(relative));
}
function validTarget(type: RecordInput["type"], value: string, zone: string, host: string): boolean {
  if (type === "A") {
    const parts = value.split(".");
    return parts.length === 4 && parts.every(p => /^(0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255);
  }
  if (type === "AAAA") {
    if (!value.includes(":") || value.includes("%")) return false;
    try { return new URL("http://[" + value + "]/").hostname.startsWith("["); } catch { return false; }
  }
  const target = value.toLowerCase().replace(/\.$/, "");
  return target !== host && (target === zone || (target.length <= 253 && target.includes(".")
    && target.split(".").every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))));
}

async function cf<T>(token: string, path: string, method: "GET" | "POST" | "PUT" | "DELETE" = "GET", data?: unknown): Promise<T> {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method,
    headers: { authorization: "Bearer " + token, accept: "application/json", ...(data ? { "content-type": "application/json" } : {}) },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  let body: CfEnvelope<T> | null = null;
  try { body = await response.json() as CfEnvelope<T>; } catch { /* report below */ }
  if (!response.ok || !body?.success) {
    const message = body?.errors?.map(x => x.message).filter(Boolean).join(" ") || "Cloudflare rejected the DNS request.";
    throw new Error(response.status === 403 ? "Cloudflare refused the request. Check Zone Read, DNS Read, DNS Edit, and Workers Scripts Read permissions." : message);
  }
  return body.result;
}

async function list<T>(token: string, path: string): Promise<T[]> {
  const output: T[] = [];
  for (let page = 1; page <= 20; page++) {
    const join = path.includes("?") ? "&" : "?";
    const response = await fetch("https://api.cloudflare.com/client/v4" + path + join + "per_page=100&page=" + page, {
      headers: { authorization: "Bearer " + token, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    let body: CfEnvelope<T[]> | null = null;
    try { body = await response.json() as CfEnvelope<T[]>; } catch { /* handled below */ }
    if (!response.ok || !body?.success || !Array.isArray(body.result)) {
      const message = body?.errors?.map(x => x.message).filter(Boolean).join(" ") || "Cloudflare could not list DNS records.";
      throw new Error(response.status === 403 ? "Cloudflare refused the request. Check Zone Read, DNS Read, DNS Edit, and Workers Scripts Read permissions." : message);
    }
    output.push(...body.result);
    const total = Math.max(1, body.result_info?.total_pages ?? 1);
    if (page >= total) return output;
  }
  throw new Error("Cloudflare returned more than 2,000 entries; the operation was stopped.");
}

async function zoneInfo(token: string, account: string, zoneName: string): Promise<Zone> {
  const zones = await list<Zone>(token, "/zones?name=" + encodeURIComponent(zoneName) + "&account.id=" + encodeURIComponent(account));
  const zone = zones.find(item => item.name.toLowerCase() === zoneName);
  if (!zone) throw new Error("The configured Cloudflare zone was not found.");
  return zone;
}

async function makePlan(c: Parameters<typeof apiError>[0], input: z.infer<typeof previewSchema>): Promise<{ plan: Plan } | { response: Response }> {
  const token = c.env.CF_API_TOKEN;
  const account = c.env.CF_ACCOUNT_ID;
  const zoneName = (c.env.CF_ZONE_NAME || "3ellwa.space").toLowerCase();
  if (input.action === "create") {
    const host = input.name.toLowerCase().replace(/\.$/, "");
    if (!validHost(host, zoneName)) return { response: apiError(c, 400, "invalid_hostname", "Only subdomains inside " + zoneName + " can be managed. The zone apex is protected.") };
    if (protectedHost(host, zoneName)) return { response: apiError(c, 409, "hostname_protected", "This standard service hostname is protected from DNS changes.") };
    if (!validTarget(input.type, input.content, zoneName, host)) return { response: apiError(c, 400, "invalid_content", "Enter a valid " + input.type + " target. Self-referencing CNAME records are refused.") };
  }
  if (!token || !account) return { response: apiError(c, 502, "setup_required", "Set the CF_API_TOKEN Worker secret with Zone Read, DNS Read, and DNS Edit on the 3ellwa.space zone, plus Workers Scripts Read on the account.") };
  try {
    const zone = await zoneInfo(token, account, zoneName);
    let host = "";
    let before: DnsRecord | null = null;
    let after: RecordInput | null = null;
    let recordId: string | null = null;
    if (input.action === "create") {
      host = input.name.toLowerCase().replace(/\.$/, "");
    } else {
      recordId = input.recordId;
      before = await cf<DnsRecord>(token, "/zones/" + zone.id + "/dns_records/" + recordId);
      host = before.name.toLowerCase();
      if (!supported.includes(before.type as typeof supported[number]) || !validHost(host, zoneName) || protectedHost(host, zoneName)) {
        return { response: apiError(c, 403, "record_protected", "Only A, AAAA, and CNAME records on unprotected subdomains can be changed.") };
      }
    }
    const [observed, workerDomains] = await Promise.all([
      list<DnsRecord>(token, "/zones/" + zone.id + "/dns_records?name=" + encodeURIComponent(host)),
      list<WorkerDomain>(token, "/accounts/" + account + "/workers/domains"),
    ]);
    if (workerDomains.some(item => item.zone_name.toLowerCase() === zoneName && item.hostname.toLowerCase() === host)) {
      return { response: apiError(c, 409, "worker_domain_protected", "This hostname is attached to a Cloudflare Worker and cannot be changed here.") };
    }
    if (input.action === "create") {
      const conflicts = observed;
      if ((input.type === "CNAME" && conflicts.length > 0) || (input.type !== "CNAME" && conflicts.some(item => item.type === "CNAME"))) {
        return { response: apiError(c, 409, "dns_conflict", "A CNAME cannot coexist with other records at the same hostname. Review the existing records first.") };
      }
      after = { name: host, type: input.type, content: input.content.trim().replace(/\.$/, ""), ttl: input.ttl, proxied: input.proxied, comment: input.comment ?? null };
    } else if (input.action === "edit") {
      if (!validTarget(before!.type as RecordInput["type"], input.content, zoneName, host)) {
        return { response: apiError(c, 400, "invalid_content", "Enter a valid " + before!.type + " target. Self-referencing CNAME records are refused.") };
      }
      const conflicts = observed.filter(item => item.id !== recordId);
      if ((before!.type === "CNAME" && conflicts.length > 0) || (before!.type !== "CNAME" && conflicts.some(item => item.type === "CNAME"))) {
        return { response: apiError(c, 409, "dns_conflict", "The hostname has conflicting DNS records. Refresh and review them before editing.") };
      }
      after = { name: host, type: before!.type as RecordInput["type"], content: input.content.trim().replace(/\.$/, ""), ttl: input.ttl, proxied: input.proxied, comment: input.comment ?? null };
    }
    return { plan: { action: input.action, zoneId: zone.id, hostname: host, before, after, recordId, observed } };
  } catch (error) {
    console.error(JSON.stringify({ event: "dns_plan_failed", action: input.action, message: error instanceof Error ? error.message : "unknown" }));
    return { response: apiError(c, 502, "cloudflare_unavailable", error instanceof Error ? error.message : "Could not validate the DNS change with Cloudflare.") };
  }
}

async function sign(plan: Plan, expiresAt: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify({ plan, expiresAt })));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function makePreview(c: Parameters<typeof apiError>[0]) {
  const parsed = await parseBody(c, previewSchema);
  if ("res" in parsed) return parsed.res;
  const result = await makePlan(c, parsed.data);
  if ("response" in result) return result.response;
  const expiresAt = new Date(Date.now() + 120_000).toISOString();
  return c.json({ ...result.plan, expiresAt, confirmationToken: await sign(result.plan, expiresAt, c.env.CF_API_TOKEN!) }, 200, { "Cache-Control": "no-store" });
}
async function verify(c: Parameters<typeof apiError>[0], plan: Plan, data: { confirmationToken: string; confirmName: string; expiresAt: string }) {
  const expires = Date.parse(data.expiresAt);
  return Number.isFinite(expires) && expires >= Date.now()
    && data.confirmName.toLowerCase() === plan.hostname
    && data.confirmationToken === await sign(plan, data.expiresAt, c.env.CF_API_TOKEN!);
}

async function writeAudit(
  c: Parameters<typeof apiError>[0],
  action: Plan["action"],
  hostname: string,
  record: DnsRecord,
  before: DnsRecord | null,
  after: DnsRecord | null,
): Promise<boolean> {
  try {
    await c.env.DB.prepare(
      "INSERT INTO dns_change_audit (id, action, hostname, record_type, record_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(), action, hostname, record.type, record.id,
      before ? JSON.stringify({ type: before.type, name: before.name, content: before.content, ttl: before.ttl, proxied: before.proxied, comment: before.comment ?? null }) : null,
      after ? JSON.stringify({ type: after.type, name: after.name, content: after.content, ttl: after.ttl, proxied: after.proxied, comment: after.comment ?? null }) : null,
    ).run();
    return true;
  } catch (error) {
    console.error(JSON.stringify({ event: "dns_audit_write_failed", action, hostname, message: error instanceof Error ? error.message : "unknown" }));
    return false;
  }
}

dnsMutationRoutes.get("/domains/audit", async c => {
  const rawLimit = Number(c.req.query("limit") ?? "50");
  const limit = Number.isInteger(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;
  try {
    const result = await c.env.DB.prepare(
      "SELECT id, action, hostname, record_type AS recordType, record_id AS recordId, before_json AS beforeJson, after_json AS afterJson, created_at AS createdAt FROM dns_change_audit ORDER BY created_at DESC, rowid DESC LIMIT ?"
    ).bind(limit).all<{ id: string; action: string; hostname: string; recordType: string; recordId: string; beforeJson: string | null; afterJson: string | null; createdAt: string }>();
    return c.json({
      items: result.results.map(item => ({
        id: item.id, action: item.action, hostname: item.hostname, recordType: item.recordType,
        recordId: item.recordId, before: item.beforeJson ? JSON.parse(item.beforeJson) : null,
        after: item.afterJson ? JSON.parse(item.afterJson) : null, createdAt: item.createdAt,
      })),
    }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error(JSON.stringify({ event: "dns_audit_read_failed", message: error instanceof Error ? error.message : "unknown" }));
    return apiError(c, 500, "audit_unavailable", "DNS audit history is unavailable. Apply the latest database migrations and retry.");
  }
});

dnsMutationRoutes.post("/domains/records/preview", makePreview);

dnsMutationRoutes.post("/domains/records", async c => {
  const parsed = await parseBody(c, createWrite);
  if ("res" in parsed) return parsed.res;
  const result = await makePlan(c, { action: "create", ...parsed.data });
  if ("response" in result) return result.response;
  if (!await verify(c, result.plan, parsed.data)) return apiError(c, 409, "preview_stale", "The preview expired or changed. Generate a new preview and confirm it again.");
  try {
    const item = await cf<DnsRecord>(c.env.CF_API_TOKEN!, "/zones/" + result.plan.zoneId + "/dns_records", "POST", result.plan.after);
    const auditRecorded = await writeAudit(c, "create", item.name, item, null, item);
    console.info(JSON.stringify({ event: "dns_changed", action: "create", hostname: item.name, type: item.type, recordId: item.id, auditRecorded }));
    return c.json({ item, auditRecorded }, 201);
  } catch (error) {
    return apiError(c, 502, "dns_change_failed", error instanceof Error ? error.message : "Cloudflare could not create the DNS record.");
  }
});

dnsMutationRoutes.put("/domains/records/:id", async c => {
  const parsed = await parseBody(c, editWrite);
  if ("res" in parsed) return parsed.res;
  if (c.req.param("id") !== parsed.data.recordId) return apiError(c, 400, "record_id_mismatch", "The record id in the URL does not match the request body.");
  const result = await makePlan(c, { action: "edit", recordId: parsed.data.recordId, content: parsed.data.content, ttl: parsed.data.ttl, proxied: parsed.data.proxied, comment: parsed.data.comment });
  if ("response" in result) return result.response;
  if (!await verify(c, result.plan, parsed.data)) return apiError(c, 409, "preview_stale", "The preview expired or changed. Generate a new preview and confirm it again.");
  try {
    const item = await cf<DnsRecord>(c.env.CF_API_TOKEN!, "/zones/" + result.plan.zoneId + "/dns_records/" + parsed.data.recordId, "PUT", result.plan.after);
    const auditRecorded = await writeAudit(c, "edit", item.name, item, result.plan.before, item);
    console.info(JSON.stringify({ event: "dns_changed", action: "edit", hostname: item.name, type: item.type, recordId: item.id, auditRecorded }));
    return c.json({ item, auditRecorded });
  } catch (error) {
    return apiError(c, 502, "dns_change_failed", error instanceof Error ? error.message : "Cloudflare could not update the DNS record.");
  }
});

dnsMutationRoutes.delete("/domains/records/:id", async c => {
  const parsed = await parseBody(c, deleteWrite);
  if ("res" in parsed) return parsed.res;
  if (c.req.param("id") !== parsed.data.recordId) return apiError(c, 400, "record_id_mismatch", "The record id in the URL does not match the request body.");
  const result = await makePlan(c, { action: "delete", recordId: parsed.data.recordId });
  if ("response" in result) return result.response;
  if (!await verify(c, result.plan, parsed.data)) return apiError(c, 409, "preview_stale", "The preview expired or changed. Generate a new preview and confirm it again.");
  try {
    await cf<{ id: string }>(c.env.CF_API_TOKEN!, "/zones/" + result.plan.zoneId + "/dns_records/" + parsed.data.recordId, "DELETE");
    const auditRecorded = await writeAudit(c, "delete", result.plan.hostname, result.plan.before!, result.plan.before, null);
    console.info(JSON.stringify({ event: "dns_changed", action: "delete", hostname: result.plan.hostname, type: result.plan.before?.type, recordId: parsed.data.recordId, auditRecorded }));
    return c.json({ ok: true, auditRecorded });
  } catch (error) {
    return apiError(c, 502, "dns_change_failed", error instanceof Error ? error.message : "Cloudflare could not delete the DNS record.");
  }
});
