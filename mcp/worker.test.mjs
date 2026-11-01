import test from "node:test";
import assert from "node:assert/strict";
import server from "./worker.js";

async function rpc(method, params = {}, id = 1, env = {}) {
  const response = await server.fetch(new Request("https://mcp.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  }), env);
  return { response, body: response.status === 202 ? null : await response.json() };
}

function memoryKv() {
  const values = new Map();
  return {
    values,
    async get(key) { return values.get(key) ?? null; },
    async put(key, value, options) { values.set(key, value); assert.ok(options.expirationTtl > 0); },
    async delete(key) { values.delete(key); }
  };
}

test("health endpoint identifies the isolated service", async () => {
  const response = await server.fetch(new Request("https://mcp.test/health"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.service, "3ellwa-space-mcp");
});

test("initialize advertises tools and no write capabilities", async () => {
  const { response, body } = await rpc("initialize", {
    protocolVersion: "2025-06-18", capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  });
  assert.equal(response.status, 200);
  assert.equal(body.result.serverInfo.name, "3ellwa-space-mcp");
  assert.deepEqual(body.result.capabilities, { tools: {} });
});

test("tools/list exposes public tools and only paired diagnostic admin tools", async () => {
  const { body } = await rpc("tools/list");
  const names = body.result.tools.map(tool => tool.name);
  assert.deepEqual(names, [
    "site_health", "site_public_overview", "site_public_links",
    "site_public_projects", "site_public_announcements", "site_public_page",
    "read_project_document", "site_check", "mcp_pair",
    "mcp_admin_status", "mcp_logout"
  ]);
  for (const tool of body.result.tools) assert.equal(tool.inputSchema.additionalProperties, false);
  assert.equal(names.some(name => /create|update|delete|publish|write/i.test(name)), false);
});

test("public API tool calls use fixed same-site paths", async t => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async input => {
    requested.push(new URL(input).href);
    return Response.json({ ok: true, sample: true });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const { body } = await rpc("tools/call", { name: "site_public_overview", arguments: {} });
  assert.equal(body.result.isError, false);
  assert.deepEqual(requested, ["https://3ellwa.space/api/public/site"]);
});

test("site_check checks only four fixed public endpoints", async t => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async input => {
    requested.push(new URL(input).pathname);
    return Response.json({ ok: true });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const { body } = await rpc("tools/call", { name: "site_check", arguments: {} });
  assert.equal(body.result.structuredContent.healthy, true);
  assert.deepEqual(requested.sort(), ["/api/health", "/api/public/links", "/api/public/projects", "/api/public/site"]);
});

test("page slugs reject path traversal", async t => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return Response.json({}); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const { body } = await rpc("tools/call", { name: "site_public_page", arguments: { slug: "../admin" } });
  assert.equal(body.result.isError, true);
  assert.equal(called, false);
});

test("documentation reader rejects arbitrary repository paths", async t => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("secret"); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const { body } = await rpc("tools/call", { name: "read_project_document", arguments: { path: ".dev.vars" } });
  assert.equal(body.result.isError, true);
  assert.equal(called, false);
});

test("MCP pairing exchanges a one-time code without returning the site cookie", async t => {
  const originalFetch = globalThis.fetch;
  const kv = memoryKv();
  let calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    calls.push(url.pathname);
    if (url.pathname === "/api/auth/mcp-pair") {
      assert.equal(JSON.parse(init.body).code, "A".repeat(43));
      return new Response(JSON.stringify({ authenticated: true, expiresInSeconds: 43200 }), {
        headers: { "content-type": "application/json", "set-cookie": "__Host-3w_session=private-cookie-value; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200" }
      });
    }
    if (url.pathname === "/api/admin/ping") return Response.json({ ok: true });
    if (url.pathname === "/api/auth/logout") return Response.json({ ok: true });
    if (url.pathname.startsWith("/api/admin/")) return Response.json({ items: [], profile: { displayName: "Owner", username: "owner" } });
    throw new Error("Unexpected URL: " + url.href);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const env = { SESSIONS: kv };
  const { body } = await rpc("tools/call", { name: "mcp_pair", arguments: { code: "A".repeat(43) } }, 1, env);
  const paired = body.result.structuredContent;
  assert.equal(paired.paired, true);
  assert.match(paired.handle, /^[A-Za-z0-9_-]{40,80}$/);
  assert.equal(JSON.stringify(body).includes("private-cookie-value"), false);
  assert.equal([...kv.values.values()][0], "__Host-3w_session=private-cookie-value");

  const status = await rpc("tools/call", { name: "mcp_admin_status", arguments: { handle: paired.handle } }, 2, env);
  assert.equal(status.body.result.structuredContent.authenticated, true);
  assert.equal(status.body.result.structuredContent.profile.displayName, "Owner");

  const logout = await rpc("tools/call", { name: "mcp_logout", arguments: { handle: paired.handle } }, 3, env);
  assert.equal(logout.body.result.structuredContent.loggedOut, true);
  assert.equal(kv.values.size, 0);
  assert.ok(calls.includes("/api/auth/logout"));
});

test("paired admin tools fail closed without KV or with an invalid handle", async () => {
  const missing = await rpc("tools/call", { name: "mcp_pair", arguments: { code: "A".repeat(43) } });
  assert.equal(missing.body.result.isError, true);
  const invalid = await rpc("tools/call", { name: "mcp_admin_status", arguments: { handle: "../etc/passwd" } }, 2, { SESSIONS: memoryKv() });
  assert.equal(invalid.body.result.isError, true);
});

test("unsupported JSON-RPC methods return method-not-found", async () => {
  const { body } = await rpc("admin/write", {});
  assert.equal(body.error.code, -32601);
});

test("MCP endpoint rejects non-JSON requests and non-POST methods", async () => {
  const get = await server.fetch(new Request("https://mcp.test/mcp"));
  assert.equal(get.status, 405);
  const text = await server.fetch(new Request("https://mcp.test/mcp", {
    method: "POST", headers: { "content-type": "text/plain" }, body: "not json"
  }));
  assert.equal(text.status, 415);
});
