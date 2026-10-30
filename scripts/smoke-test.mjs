// Quick check of a running site. Usage:
//   node scripts/smoke-test.mjs https://your-site.workers.dev /your-admin-path
// Checks public/404/admin-path behavior and that admin API is closed. Sends ONE wrong password
// (counts toward the lockout limit). It cannot test the Discord code step; do that by hand.
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const adminPath = process.argv[3];
let failed = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  (" + info + ")" : ""}`); if (!ok) failed++; };
const get = (p, init) => fetch(base + p, { redirect: "manual", ...init });

let r = await get("/");
check("public home returns 200", r.status === 200, r.status);
r = await get("/api/health"); const h = await r.json().catch(() => ({}));
check("health: worker and D1 reachable", r.status === 200 && h.ok === true, r.status);
// Regression: a browser refresh revalidates cached CSS/JS. That must answer 304, never the HTML shell with a 404.
{
  const html = await (await get("/")).text();
  const css = (html.match(/href="(\/assets\/[^"]+\.css)"/) ?? [])[1];
  if (css) {
    const first = await get(css);
    const etag = first.headers.get("etag");
    check("static CSS is served as CSS", first.status === 200 && (first.headers.get("content-type") ?? "").includes("css"), first.status);
    if (etag) { const again = await get(css, { headers: { "if-none-match": etag } }); check("revalidating cached CSS returns 304 (not the HTML shell)", again.status === 304, again.status); }
  }
}
r = await get("/definitely-not-a-page");
check("unknown path returns 404", r.status === 404, r.status);
r = await get("/admin");
check("/admin returns the normal 404", r.status === 404, r.status);
if (adminPath) {
  r = await get(adminPath);
  const html = await r.text();
  check("admin path returns 200 shell", r.status === 200 && html.includes('name="3w-shell" content="admin"'), r.status);
  check("admin path is noindex", (r.headers.get("x-robots-tag") ?? "").includes("noindex"));
  const pub = await (await get("/")).text();
  check("public HTML does not contain the admin path", !pub.includes(adminPath));
}
r = await get("/api/admin/ping");
check("admin API without session returns 401", r.status === 401, r.status);
r = await get("/api/auth/me"); const me = await r.json().catch(() => ({}));
check("/api/auth/me says not signed in", me.authenticated === false);
r = await get("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "definitely wrong password" }) });
check("wrong password returns 401 (or 429 if already locked)", r.status === 401 || r.status === 429, r.status);
r = await get("/links"); check("/links serves the public shell (200)", r.status === 200 && /3w-shell" content="public/.test(await r.text()), r.status);
r = await get("/go/does-not-exist", { redirect: "manual" }); check("/go with an unknown id returns 404", r.status === 404, r.status);
r = await get("/api/public/links"); const pl = await r.json().catch(() => ({})); check("/api/public/links returns groups", r.status === 200 && Array.isArray(pl.groups), r.status);
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
