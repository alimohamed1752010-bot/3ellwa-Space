const SITE = "https://3ellwa.space";
const REPO = "https://raw.githubusercontent.com/alimohamed1752010-bot/3ellwa-Space/main";
const PROTOCOL_VERSION = "2025-06-18";
const DOCS = new Set([
  "README.md",
  "docs/PROJECT.md",
  "docs/STATUS.md",
  "docs/ARCHITECTURE.md",
  "docs/SCHEMA.md",
  "docs/API.md",
  "docs/DEPLOYMENT.md",
  "docs/MAINTENANCE.md",
  "docs/BACKUP.md",
  "docs/DECISIONS.md"
]);

const tools = [
  { name: "site_health", description: "Check the public 3ellwa.space health endpoint and database connectivity status.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_overview", description: "Read the public profile, navigation, theme and public site settings. Never returns admin credentials.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_links", description: "List public links and categories currently visible on 3ellwa.space.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_projects", description: "List projects currently published on 3ellwa.space.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_announcements", description: "List currently active public announcements.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_page", description: "Read one published public page by its slug. Private admin APIs are not accessible.", inputSchema: { type: "object", properties: { slug: { type: "string", description: "Published page slug, e.g. home, about, links." } }, required: ["slug"], additionalProperties: false } },
  { name: "read_project_document", description: "Read an allowlisted project documentation file from the public GitHub repository. Does not read secrets or arbitrary paths.", inputSchema: { type: "object", properties: { path: { type: "string", enum: [...DOCS] } }, required: ["path"], additionalProperties: false } },
  { name: "site_check", description: "Run a read-only health and public endpoint check for 3ellwa.space.", inputSchema: { type: "object", properties: {}, additionalProperties: false } }
];

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
}
function rpc(id, result) { return json({ jsonrpc: "2.0", id, result }); }
function err(id, code, message) { return json({ jsonrpc: "2.0", id, error: { code, message } }, 200); }

async function getJson(path) {
  const response = await fetch(new URL(path, SITE), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { body: text.slice(0, 1500) }; }
  return { ok: response.ok, status: response.status, data };
}

async function callTool(name, args) {
  switch (name) {
    case "site_health":
      return await getJson("/api/health");
    case "site_public_overview":
      return await getJson("/api/public/site");
    case "site_public_links":
      return await getJson("/api/public/links");
    case "site_public_projects":
      return await getJson("/api/public/projects");
    case "site_public_announcements":
      return await getJson("/api/public/announcements");
    case "site_public_page": {
      const slug = String(args?.slug ?? "");
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) throw new Error("Invalid page slug.");
      return await getJson("/api/public/pages/" + encodeURIComponent(slug));
    }
    case "read_project_document": {
      const path = String(args?.path ?? "");
      if (!DOCS.has(path)) throw new Error("That documentation path is not allowlisted.");
      const response = await fetch(REPO + "/" + path, { headers: { accept: "text/plain" }, signal: AbortSignal.timeout(8000) });
      const content = await response.text();
      if (!response.ok) return { ok: false, status: response.status, error: "GitHub document request failed." };
      return { ok: true, path, content: content.slice(0, 30000), truncated: content.length > 30000 };
    }
    case "site_check": {
      const names = ["/api/health", "/api/public/site", "/api/public/links", "/api/public/projects"];
      const results = await Promise.all(names.map(async path => ({ path, ...(await getJson(path)) })));
      return { site: SITE, checkedAt: new Date().toISOString(), results, healthy: results.every(x => x.ok) };
    }
    default:
      throw new Error("Unknown tool.");
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, service: "3ellwa-space-mcp", mode: "read-only", site: SITE });
    if (url.pathname !== "/mcp") return json({ error: "Not found" }, 404);
    if (request.method !== "POST") return json({ error: "Use POST for MCP JSON-RPC requests." }, 405, { allow: "POST" });
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return json({ error: "Content-Type must be application/json." }, 415);
    let body;
    try { body = await request.json(); } catch { return err(null, -32700, "Parse error"); }
    if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") return err(body?.id ?? null, -32600, "Invalid Request");
    if (body.method === "notifications/initialized" || body.method.startsWith("notifications/")) return new Response(null, { status: 202 });
    if (body.method === "initialize") {
      return rpc(body.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "3ellwa-space-mcp", version: "0.1.0" },
        instructions: "Read-only MCP server for public 3ellwa.space status, published content, and allowlisted project documentation. It cannot access admin APIs, private database records, secrets, or modify production."
      });
    }
    if (body.method === "ping") return rpc(body.id, {});
    if (body.method === "tools/list") return rpc(body.id, { tools });
    if (body.method === "tools/call") {
      const name = body.params?.name;
      const args = body.params?.arguments ?? {};
      try {
        const result = await callTool(name, args);
        return rpc(body.id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false });
      } catch (error) {
        return rpc(body.id, { content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed." }], isError: true });
      }
    }
    return err(body.id ?? null, -32601, "Method not found");
  }
};
