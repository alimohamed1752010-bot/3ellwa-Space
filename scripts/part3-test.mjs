import http from "node:http";
// LOCAL ONLY test of Part 3 routes (links, categories, /go tracking, public links, import/export).
// Needs ADMIN_PASSWORD + DISCORD_AUTH_WEBHOOK_URL=http://127.0.0.1:9999/hook, local D1 migrated, and `npm run dev` running.
// node scripts/part3-test.mjs [baseUrl] "test password"
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const PASSWORD = process.argv[3];
if (!PASSWORD) { console.error('Usage: node scripts/part3-test.mjs http://localhost:8787 "test password"'); process.exit(1); }

const discordMessages = [];
const discordServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try { discordMessages.push(JSON.parse(body).content ?? ""); } catch {}
    res.writeHead(204).end();
  });
});
await new Promise((resolve) => discordServer.listen(9999, "127.0.0.1", resolve));
const waitForCode = async () => {
  for (let i = 0; i < 30; i++) {
    const code = discordMessages.at(-1)?.match(/\*\*(\d{8})\*\*/)?.[1];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("No OTP received. Check DISCORD_AUTH_WEBHOOK_URL in .dev.vars.");
};
let failed = 0;
const check = (n, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${info !== "" ? "  (" + info + ")" : ""}`); if (!ok) failed++; };
const J = { "content-type": "application/json", "cf-connecting-ip": "10.9.0.3" };
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const DAY = 86400000;

let r = await fetch(base + "/api/public/links");
let pub = await r.json();
check("public links: 200 and grouped shape", r.status === 200 && Array.isArray(pub.groups) && Array.isArray(pub.featured), r.status);
for (const p of ["/api/admin/links", "/api/admin/link-categories", "/api/admin/links/export"]) {
  r = await fetch(base + p); check(`GET ${p} without session -> 401`, r.status === 401, r.status);
}
r = await fetch(base + "/api/admin/links", { method: "POST", headers: J, body: "{}" }); check("POST /links without session -> 401", r.status === 401, r.status);
r = await fetch(base + "/links"); check("/links serves the public shell with status 200", r.status === 200 && /3w-shell" content="public/.test(await r.text()), r.status);

r = await fetch(base + "/api/auth/password", { method: "POST", headers: J, body: JSON.stringify({ password: PASSWORD }) });
const challenge = await r.json();
const code = await waitForCode();
const verified = await fetch(base + "/api/auth/code", { method: "POST", headers: J, body: JSON.stringify({ challengeId: challenge.challengeId, code }) });
const auth = await verified.json();
const cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0];
check("login with password + Discord OTP gives a session", r.status === 200 && !!challenge.challengeId && verified.status === 200 && auth.authenticated === true && !!cookie, verified.status);
const H = { ...J, cookie };
const call = (m, p, body) => fetch(base + p, { method: m, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
const mk = async (body) => { const x = await call("POST", "/api/admin/links", body); return { status: x.status, ...(await x.json()) }; };
const tag = `t3-${Date.now()}`;

// --- unsafe and malformed URLs refused on save
for (const [name, url] of [["javascript:", "javascript:alert(1)"], ["data:", "data:text/html,<script>1</script>"], ["vbscript:", "vbscript:x"], ["file:", "file:///etc/passwd"], ["relative junk", "/just/a/path"], ["protocol-relative", "//evil.example"], ["no scheme", "example.com"], ["spaces", "https://exa mple.com"], ["credentials", "https://user:pw@example.com"], ["backslash", "https:\\\\evil.example"], ["very long", "https://example.com/" + "a".repeat(2100)]]) {
  const x = await mk({ title: "bad", url }); check(`save refuses ${name}`, x.status === 400, x.status);
}

// --- categories
r = await call("POST", "/api/admin/link-categories", { name: `Games ${tag}`, color: "#8b5cf6" }); let cats = (await r.json()).items;
check("create category", r.status === 201 && cats.some((c) => c.name === `Games ${tag}`), r.status);
r = await call("POST", "/api/admin/link-categories", { name: `Work ${tag}` }); cats = (await r.json()).items;
const games = cats.find((c) => c.name === `Games ${tag}`), work = cats.find((c) => c.name === `Work ${tag}`);
r = await call("POST", "/api/admin/link-categories", { name: "x", color: "red" }); check("category bad color -> 400", r.status === 400, r.status);
r = await call("PUT", "/api/admin/link-categories/order", { ids: [work.id, games.id] }); cats = (await r.json()).items;
check("reorder categories", cats.findIndex((c) => c.id === work.id) < cats.findIndex((c) => c.id === games.id));
r = await call("PUT", `/api/admin/link-categories/${games.id}`, { name: `Games ${tag}`, description: "d", visible: true }); check("edit category", r.status === 200);
r = await call("PUT", "/api/admin/link-categories/missing", { name: "x" }); check("edit missing category -> 404", r.status === 404, r.status);

// --- links CRUD
let a = await mk({ title: `Alpha ${tag}`, url: "https://example.com/a", description: "first", icon: "🎮", color: "#112233", badge: "New", hoverAnimation: "glow", categoryId: games.id, featured: true });
check("create link", a.status === 201 && a.item.title === `Alpha ${tag}` && a.item.status === "live" && a.item.hoverAnimation === "glow", a.status);
let b = await mk({ title: `Beta ${tag}`, url: "mailto:me@example.com", categoryId: work.id });
check("create mailto link", b.status === 201);
let c2 = await mk({ title: `Gamma ${tag}`, url: "https://example.com/c" });
const A = a.item, B = b.item, C = c2.item;
{ const bad = await mk({ title: "t", url: "https://example.com", color: "purple" }); check("bad color -> 400", bad.status === 400, bad.status); }
{ const bad = await mk({ title: "t", url: "https://example.com", hoverAnimation: "explode" }); check("bad hover animation -> 400", bad.status === 400, bad.status); }
{ const bad = await mk({ title: "t", url: "https://example.com", categoryId: "nope" }); check("unknown category -> 400", bad.status === 400, bad.status); }
{ const bad = await mk({ title: "t", url: "https://example.com", imageAssetId: "nope" }); check("unknown image -> 400", bad.status === 400, bad.status); }
{ const bad = await mk({ title: "t", url: "https://example.com", publishAt: iso(DAY), expiresAt: iso(-DAY) }); check("expiry before publish -> 400", bad.status === 400, bad.status);}
r = await call("PUT", `/api/admin/links/${C.id}`, { title: `Gamma2 ${tag}`, url: "https://example.com/c2", openNewTab: false }); let up = await r.json();
check("edit link persists", r.status === 200 && up.item.title === `Gamma2 ${tag}` && up.item.openNewTab === false);
r = await call("PUT", "/api/admin/links/missing", { title: "x", url: "https://example.com" }); check("edit missing link -> 404", r.status === 404, r.status);
r = await call("GET", "/api/admin/links"); let list = await r.json();
check("list returns items and categories with counts", r.status === 200 && list.items.some((l) => l.id === A.id) && list.categories.find((c) => c.id === games.id).linkCount >= 1);

// --- reorder, duplicate
const mine = [A.id, B.id, C.id];
const others = list.items.map((l) => l.id).filter((id) => !mine.includes(id));
r = await call("PUT", "/api/admin/links/order", { ids: [...others, C.id, A.id, B.id] }); list = await r.json();
const pos = (id) => list.items.findIndex((l) => l.id === id);
check("reorder links", pos(C.id) < pos(A.id) && pos(A.id) < pos(B.id));
r = await call("POST", `/api/admin/links/${A.id}/duplicate`); const dup = await r.json();
check("duplicate link lands right after the original", r.status === 201 && dup.item.title === `Alpha ${tag} (copy)` && dup.items.findIndex((l) => l.id === dup.item.id) === dup.items.findIndex((l) => l.id === A.id) + 1, r.status);
check("duplicate starts with zero clicks", dup.item.clicksTotal === 0);

// --- public visibility, scheduling, expiry
r = await fetch(base + "/api/public/links"); pub = await r.json();
const flat = () => pub.groups.flatMap((g) => g.links);
check("public shows live links grouped by category", flat().some((l) => l.id === A.id) && pub.groups.find((g) => g.id === games.id)?.links.some((l) => l.id === A.id));
check("public link href goes through /go and hides raw url", flat().find((l) => l.id === A.id).href === `/go/${A.id}` && !JSON.stringify(pub).includes("example.com/a"));
check("featured list has featured link only", pub.featured.some((l) => l.id === A.id) && !pub.featured.some((l) => l.id === C.id));
const sched = await mk({ title: `Future ${tag}`, url: "https://example.com/f", publishAt: iso(DAY) });
const expired = await mk({ title: `Expired ${tag}`, url: "https://example.com/e", publishAt: iso(-2 * DAY), expiresAt: iso(-DAY) });
const off = await mk({ title: `Off ${tag}`, url: "https://example.com/o", enabled: false });
const hid = await mk({ title: `Hidden ${tag}`, url: "https://example.com/h", visible: false });
check("statuses computed: scheduled, expired, disabled, hidden", sched.item.status === "scheduled" && expired.item.status === "expired" && off.item.status === "disabled" && hid.item.status === "hidden", [sched.item.status, expired.item.status, off.item.status, hid.item.status].join(","));
r = await fetch(base + "/api/public/links"); pub = await r.json();
check("scheduled, expired, disabled, hidden never appear publicly", ![sched, expired, off, hid].some((x) => flat().some((l) => l.id === x.item.id)));
for (const [n, x] of [["scheduled", sched], ["expired", expired], ["disabled", off], ["hidden", hid]]) {
  r = await fetch(base + `/go/${x.item.id}`, { redirect: "manual" }); check(`/go refuses ${n} link (404)`, r.status === 404, r.status);
}
r = await call("PUT", `/api/admin/links/${sched.item.id}`, { title: `Future ${tag}`, url: "https://example.com/f", publishAt: iso(-1000) });
r = await fetch(base + `/go/${sched.item.id}`, { redirect: "manual" }); check("schedule start in the past makes it live", r.status === 302, r.status);

// --- /go tracking
r = await fetch(base + `/go/${A.id}`, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Safari/604.1", referer: "https://news.example/post", "cf-connecting-ip": "10.9.0.7" } });
check("/go redirects 302 to the destination with no cookie", r.status === 302 && r.headers.get("location") === "https://example.com/a" && !r.headers.get("set-cookie") && /no-store/.test(r.headers.get("cache-control") ?? ""), `${r.status} ${r.headers.get("location")}`);
r = await fetch(base + `/go/${B.id}`, { redirect: "manual" }); check("/go mailto redirect", r.status === 302 && r.headers.get("location") === "mailto:me@example.com", r.headers.get("location"));
r = await fetch(base + `/go/${A.id}`, { method: "HEAD", redirect: "manual" }); check("HEAD /go does not count", r.status === 302);
await fetch(base + `/go/${A.id}`, { redirect: "manual", headers: { "cf-connecting-ip": "10.9.0.8" } });
await new Promise((res) => setTimeout(res, 400));
r = await call("GET", `/api/admin/links/${A.id}/stats`); const st = await r.json();
check("stats: 2 clicks (HEAD not counted), 2 unique visitors, 30-day trend", r.status === 200 && st.total === 2 && st.uniqueVisitors === 2 && st.last7 === 2 && st.daily.length === 30 && st.daily.at(-1).count === 2, JSON.stringify({ t: st.total, u: st.uniqueVisitors }));
r = await call("GET", "/api/admin/links"); list = await r.json();
check("list shows click totals", list.items.find((l) => l.id === A.id).clicksTotal === 2 && list.items.find((l) => l.id === A.id).clicks7d === 2);
r = await fetch(base + "/go/does-not-exist", { redirect: "manual" }); check("/go unknown id -> 404", r.status === 404, r.status);
r = await fetch(base + "/go/" + "x".repeat(200), { redirect: "manual" }); check("/go overlong id -> 404", r.status === 404, r.status);
r = await fetch(base + "/go/a/b", { redirect: "manual" }); check("/go/a/b -> 404", r.status === 404, r.status);
r = await fetch(base + `/go/${A.id}`, { method: "POST", redirect: "manual" }); check("POST /go refused", r.status === 404, r.status);

// --- redirect-time safety: a poisoned row (written behind the API's back) is refused, not followed
// (needs direct DB access; verified in the sandbox with `wrangler d1 execute`, see docs/STATUS.md)

// --- bulk
r = await call("POST", "/api/admin/links/bulk", { ids: [A.id, B.id], action: "disable" }); list = await r.json();
check("bulk disable", list.items.filter((l) => [A.id, B.id].includes(l.id)).every((l) => !l.enabled));
r = await call("POST", "/api/admin/links/bulk", { ids: [A.id, B.id], action: "enable" });
r = await call("POST", "/api/admin/links/bulk", { ids: [A.id, B.id], action: "hide" }); list = await r.json();
check("bulk hide", list.items.filter((l) => [A.id, B.id].includes(l.id)).every((l) => !l.visible));
r = await call("POST", "/api/admin/links/bulk", { ids: [A.id, B.id], action: "show" });
r = await call("POST", "/api/admin/links/bulk", { ids: [B.id, C.id], action: "category", categoryId: games.id }); list = await r.json();
check("bulk assign category", list.items.filter((l) => [B.id, C.id].includes(l.id)).every((l) => l.categoryId === games.id));
r = await call("POST", "/api/admin/links/bulk", { ids: [C.id], action: "category", categoryId: null }); list = await r.json();
check("bulk clear category", list.items.find((l) => l.id === C.id).categoryId === null);
r = await call("POST", "/api/admin/links/bulk", { ids: [C.id], action: "category", categoryId: "nope" }); check("bulk bad category -> 400", r.status === 400, r.status);
r = await call("POST", "/api/admin/links/bulk", { ids: [], action: "delete" }); check("bulk with no ids -> 400", r.status === 400, r.status);
r = await call("POST", "/api/admin/links/bulk", { ids: [C.id], action: "explode" }); check("bulk bad action -> 400", r.status === 400, r.status);
r = await call("POST", "/api/admin/links/bulk", { ids: [dup.item.id, sched.item.id, expired.item.id, off.item.id, hid.item.id], action: "delete" }); list = await r.json();
check("bulk delete", ![dup.item.id, sched.item.id, hid.item.id].some((id) => list.items.some((l) => l.id === id)));

// --- export / import
r = await call("GET", "/api/admin/links/export"); const ex = await r.json();
check("export has version, categories, links; no ids", r.status === 200 && ex.version === 1 && ex.links.some((l) => l.title === `Alpha ${tag}` && l.category === `Games ${tag}`) && !JSON.stringify(ex).includes(A.id) && /attachment/.test(r.headers.get("content-disposition") ?? ""));
const before = (await (await call("GET", "/api/admin/links")).json());
const bad1 = await call("POST", "/api/admin/links/import", { version: 1, links: [{ title: "ok", url: "https://example.com/ok" }, { title: "bad", url: "javascript:alert(1)" }] });
const bad1j = await bad1.json(); const after1 = await (await call("GET", "/api/admin/links")).json();
check("import with one bad link is refused with a clear message", bad1.status === 400 && /Link #2/.test(bad1j.error.message) && /nothing was changed/.test(bad1j.error.message), bad1j.error?.message);
check("refused import applied nothing (no half-apply)", after1.items.length === before.items.length && after1.categories.length === before.categories.length);
r = await call("POST", "/api/admin/links/import", { version: 2, links: [] }); check("import wrong version -> 400", r.status === 400, r.status);
r = await fetch(base + "/api/admin/links/import", { method: "POST", headers: H, body: "not json" }); check("import non-JSON -> 400", r.status === 400, r.status);
r = await call("POST", "/api/admin/links/import", { version: 1, links: Array.from({ length: 501 }, (_, i) => ({ title: "n" + i, url: "https://example.com/" + i })) }); check("import over 500 links -> 400", r.status === 400, r.status);
r = await call("POST", "/api/admin/links/import", { version: 1, links: [{ title: "x", url: "https://example.com", publishAt: iso(DAY), expiresAt: iso(-DAY) }] }); check("import bad schedule -> 400", r.status === 400, r.status);
const good = await call("POST", "/api/admin/links/import", { version: 1, categories: [{ name: `Imported ${tag}`, color: "#00ff00" }], links: [{ title: `Imp1 ${tag}`, url: "https://example.com/i1", category: `Imported ${tag}` }, { title: `Imp2 ${tag}`, url: "https://example.com/i2", category: `games ${tag}`, featured: true }] });
const goodj = await good.json();
check("valid import adds links, creates new category, matches existing by name (case-insensitive)", good.status === 201 && goodj.imported.links === 2 && goodj.imported.categoriesCreated === 1 && goodj.items.find((l) => l.title === `Imp2 ${tag}`).categoryId === games.id);
const re = await call("POST", "/api/admin/links/import", ex);
check("exported file re-imports cleanly", re.status === 201, re.status);

// --- delete
r = await call("DELETE", `/api/admin/links/${B.id}`); check("delete link", r.status === 200);
r = await call("DELETE", `/api/admin/links/${B.id}`); check("delete again -> 404", r.status === 404, r.status);
r = await fetch(base + `/go/${B.id}`, { redirect: "manual" }); check("/go for deleted link -> 404", r.status === 404, r.status);
r = await call("DELETE", `/api/admin/link-categories/${games.id}`); cats = (await r.json()).items;
list = await (await call("GET", "/api/admin/links")).json();
check("delete category keeps its links (uncategorized)", r.status === 200 && !cats.some((c) => c.id === games.id) && list.items.find((l) => l.id === A.id)?.categoryId === null);
r = await call("PUT", `/api/admin/links/${A.id}`, { title: "x", url: "https://example.com" }); r = await fetch(base + "/api/public/links", { headers: { "cf-connecting-ip": "10.9.0.3" } });
check("cross-origin POST refused (403)", (await fetch(base + "/api/admin/links", { method: "POST", headers: { ...H, origin: "https://evil.example" }, body: JSON.stringify({ title: "x", url: "https://example.com" }) })).status === 403);

console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
