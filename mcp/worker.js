const SITE = "https://3ellwa.space";
const REPO = "https://raw.githubusercontent.com/alimohamed1752010-bot/3ellwa-Space/main";
const PROTOCOL_VERSION = "2025-06-18";
const DOCS = new Set([
  "README.md", "docs/PROJECT.md", "docs/STATUS.md", "docs/ARCHITECTURE.md",
  "docs/SCHEMA.md", "docs/API.md", "docs/DEPLOYMENT.md", "docs/MAINTENANCE.md",
  "docs/BACKUP.md", "docs/DECISIONS.md"
]);

const tools = [
  { name: "site_health", description: "Check the public 3ellwa.space health endpoint and database connectivity status.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_overview", description: "Read the public profile, navigation, theme and public site settings. Never returns admin credentials.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_links", description: "List public links and categories currently visible on 3ellwa.space.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_projects", description: "List projects currently published on 3ellwa.space.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_announcements", description: "List currently active public announcements.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "site_public_page", description: "Read one published public page by its slug. Private admin APIs are not accessible.", inputSchema: { type: "object", properties: { slug: { type: "string", description: "Published page slug, e.g. home, about, links." } }, required: ["slug"], additionalProperties: false } },
  { name: "read_project_document", description: "Read an allowlisted project documentation file from the public GitHub repository. Does not read secrets or arbitrary paths.", inputSchema: { type: "object", properties: { path: { type: "string", enum: [...DOCS] } }, required: ["path"], additionalProperties: false } },
  { name: "site_check", description: "Run a read-only health and public endpoint check for 3ellwa.space.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "mcp_pair", description: "Exchange a one-time code generated inside the authenticated 3ellwa.space admin panel. The code is single-use and expires after two minutes. Never request the website password or Discord OTP.", inputSchema: { type: "object", properties: { code: { type: "string", minLength: 40, maxLength: 80 } }, required: ["code"], additionalProperties: false } },
  { name: "mcp_admin_status", description: "Read a compact authenticated admin overview using an existing pairing handle. Does not modify the website.", inputSchema: { type: "object", properties: { handle: { type: "string", minLength: 40, maxLength: 80 } }, required: ["handle"], additionalProperties: false } },
  { name: "mcp_logout", description: "Revoke the paired admin session and delete its stored handle.", inputSchema: { type: "object", properties: { handle: { type: "string", minLength: 40, maxLength: 80 } }, required: ["handle"], additionalProperties: false } }
];

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
}
function rpc(id, result) { return json({ jsonrpc: "2.0", id, result }); }
function err(id, code, message) { return json({ jsonrpc: "2.0", id, error: { code, message } }, 200); }
function toolError(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function randomHandle() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function getJson(path, headers = {}) {
  const response = await fetch(new URL(path, SITE), { headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(8000) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { body: text.slice(0, 1500) }; }
  return { ok: response.ok, status: response.status, data };
}
function sessionCookie(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") || ""];
  for (const value of values) {
    const match = value.match(/(?:^|,\s*)(__Host-3w_session|3w_session)=([^;,\s]+)/);
    if (match) return match[1] + "=" + match[2];
  }
  return null;
}
async function pairedCookie(env, handle) {
  if (!env?.SESSIONS) throw new Error("MCP session storage is not configured.");
  if (typeof handle !== "string" || !/^[A-Za-z0-9_-]{40,80}$/.test(handle)) throw new Error("Invalid pairing handle.");
  const key = "session:" + await sha256Hex("mcp-handle:" + handle);
  const cookie = await env.SESSIONS.get(key);
  if (!cookie) throw new Error("Pairing handle expired or revoked. Generate a new code in the admin panel.");
  return { key, cookie };
}
function summarize(result) {
  const data = result?.data ?? {};
  return { ok: result.ok, status: result.status, data };
}
async function adminStatus(env, handle) {
  const session = await pairedCookie(env, handle);
  const paths = ["/api/admin/ping", "/api/admin/profile", "/api/admin/navigation", "/api/admin/links", "/api/admin/projects", "/api/admin/pages", "/api/admin/themes", "/api/admin/layout", "/api/admin/widgets"];
  const results = await Promise.all(paths.map(async path => {
    try { return { path, ...(await getJson(path, { cookie: session.cookie })) }; }
    catch { return { path, ok: false, status: 0, data: null }; }
  }));
  if (results[0].status === 401) {
    await env.SESSIONS.delete(session.key);
    throw new Error("The website admin session expired. Pair the plugin again.");
  }
  const getItems = path => {
    const item = results.find(r => r.path === path);
    const value = item?.data?.items;
    return Array.isArray(value) ? value.length : null;
  };
  const profile = results.find(r => r.path === "/api/admin/profile");
  const p = profile?.data?.profile ?? {};
  return {
    authenticated: results[0].ok,
    profile: {
      displayName: p.displayName ?? null,
      username: p.username ?? null,
      shortBio: p.shortBio ?? null,
      statusText: p.statusText ?? null,
      updatedAt: p.updatedAt ?? null
    },
    counts: {
      navigationItems: getItems("/api/admin/navigation"),
      links: getItems("/api/admin/links"),
      projects: getItems("/api/admin/projects"),
      pages: getItems("/api/admin/pages"),
      themes: getItems("/api/admin/themes"),
      widgets: getItems("/api/admin/widgets")
    },
    endpoints: results.map(r => ({ path: r.path, ok: r.ok, status: r.status })),
    note: "Read-only overview. No website data was changed."
  };
}
async function callTool(name, args, env) {
  switch (name) {
    case "site_health": return await getJson("/api/health");
    case "site_public_overview": return await getJson("/api/public/site");
    case "site_public_links": return await getJson("/api/public/links");
    case "site_public_projects": return await getJson("/api/public/projects");
    case "site_public_announcements": return await getJson("/api/public/announcements");
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
    case "mcp_pair": {
      if (!env?.SESSIONS) throw new Error("MCP session storage is not configured yet.");
      const code = String(args?.code ?? "");
      if (!/^[A-Za-z0-9_-]{40,80}$/.test(code)) throw new Error("Invalid pairing code.");
      const response = await fetch(new URL("/api/auth/mcp-pair", SITE), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ code }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Pairing code expired or already used. Generate a new one in the admin panel." : "The website refused the pairing request.");
      const cookie = sessionCookie(response);
      if (!cookie) throw new Error("The website did not issue a session cookie. Pairing was not saved.");
      const body = await response.json();
      const ttl = Math.min(43200, Math.max(60, Number(body.expiresInSeconds) || 0));
      const handle = randomHandle();
      const key = "session:" + await sha256Hex("mcp-handle:" + handle);
      await env.SESSIONS.put(key, cookie, { expirationTtl: ttl });
      return { paired: true, handle, expiresInSeconds: ttl, message: "Pairing complete. Store this handle safely; the website password and Discord OTP were never shared with the plugin." };
    }
    case "mcp_admin_status":
      return await adminStatus(env, args?.handle);
    case "mcp_logout": {
      const session = await pairedCookie(env, args?.handle);
      try {
        await fetch(new URL("/api/auth/logout", SITE), {
          method: "POST",
          headers: { cookie: session.cookie, accept: "application/json" },
          signal: AbortSignal.timeout(8000)
        });
      } finally {
        await env.SESSIONS.delete(session.key);
      }
      return { loggedOut: true };
    }
    default: throw new Error("Unknown tool.");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, service: "3ellwa-space-mcp", mode: "read-only-plus-paired-admin-diagnostics", site: SITE });
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
        serverInfo: { name: "3ellwa-space-mcp", version: "0.2.0" },
        instructions: "Read-only public site tools plus owner-paired, read-only admin diagnostics. Pair only with a one-time code generated inside the authenticated site admin panel. Never request or accept the website password or Discord OTP. No content editing or publishing tools are enabled."
      });
    }
    if (body.method === "ping") return rpc(body.id, {});
    if (body.method === "tools/list") return rpc(body.id, { tools });
    if (body.method === "tools/call") {
      const name = body.params?.name;
      const args = body.params?.arguments ?? {};
      try {
        const result = await callTool(name, args, env);
        return rpc(body.id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false });
      } catch (error) {
        return rpc(body.id, toolError(error instanceof Error ? error.message : "Tool failed."));
      }
    }
    return err(body.id ?? null, -32601, "Method not found");
  }
};
