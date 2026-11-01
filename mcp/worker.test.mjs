import test from "node:test";
import assert from "node:assert/strict";
import server from "./worker.js";

async function rpc(method, params = {}, id = 1) {
  const response = await server.fetch(new Request("https://mcp.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  }));
  return { response, body: response.status === 202 ? null : await response.json() };
}

test("health endpoint identifies the isolated read-only service", async () => {
  const response = await server.fetch(new Request("https://mcp.test/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "3ellwa-space-mcp",
    mode: "read-only",
    site: "https://3ellwa.space"
  });
});

test("initialize advertises tools without resources or write capabilities", async () => {
  const { response, body } = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  });
  assert.equal(response.status, 200);
  assert.equal(body.result.serverInfo.name, "3ellwa-space-mcp");
  assert.deepEqual(body.result.capabilities, { tools: {} });
});

test("tools/list exposes only the eight documented read-only tools", async () => {
  const { body } = await rpc("tools/list");
  const names = body.result.tools.map(tool => tool.name);
  assert.deepEqual(names, [
    "site_health",
    "site_public_overview",
    "site_public_links",
    "site_public_projects",
    "site_public_announcements",
    "site_public_page",
    "read_project_document",
    "site_check"
  ]);
  for (const tool of body.result.tools) {
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
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
  assert.deepEqual(body.result.structuredContent.data, { ok: true, sample: true });
  assert.deepEqual(requested, ["https://3ellwa.space/api/public/site"]);
});

test("site_check checks only the four fixed public endpoints", async t => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async input => {
    requested.push(new URL(input).pathname);
    return Response.json({ ok: true });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { body } = await rpc("tools/call", { name: "site_check", arguments: {} });
  assert.equal(body.result.structuredContent.healthy, true);
  assert.deepEqual(requested.sort(), [
    "/api/health",
    "/api/public/links",
    "/api/public/projects",
    "/api/public/site"
  ]);
});

test("page slugs reject path traversal and malformed values", async t => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return Response.json({}); };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { body } = await rpc("tools/call", {
    name: "site_public_page",
    arguments: { slug: "../admin" }
  });
  assert.equal(body.result.isError, true);
  assert.equal(called, false);
});

test("documentation reader rejects arbitrary repository paths", async t => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("secret"); };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { body } = await rpc("tools/call", {
    name: "read_project_document",
    arguments: { path: ".dev.vars" }
  });
  assert.equal(body.result.isError, true);
  assert.equal(called, false);
});

test("unsupported JSON-RPC methods return method-not-found", async () => {
  const { body } = await rpc("admin/write", {});
  assert.equal(body.error.code, -32601);
});

test("MCP endpoint rejects non-JSON requests and non-POST methods", async () => {
  const get = await server.fetch(new Request("https://mcp.test/mcp"));
  assert.equal(get.status, 405);
  const text = await server.fetch(new Request("https://mcp.test/mcp", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not json"
  }));
  assert.equal(text.status, 415);
});
