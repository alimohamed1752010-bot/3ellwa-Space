import http from "node:http";
// LOCAL ONLY test of Part 2.5 routes (profile, social links, navigation, media, public site).
// 1) .dev.vars needs ADMIN_PASSWORD and DISCORD_AUTH_WEBHOOK_URL=http://127.0.0.1:9999/hook
// 2) npm run db:migrate:local && npm run dev   (other terminal; use a fresh local DB for the empty-site check)
// 3) node scripts/part25-test.mjs [baseUrl] "test password"
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const PASSWORD = process.argv[3];
if (!PASSWORD) { console.error('Usage: node scripts/part25-test.mjs http://localhost:8787 "test password"'); process.exit(1); }

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
const J = { "content-type": "application/json", "cf-connecting-ip": "10.9.0.1" };

// --- public, no session
let r = await fetch(base + "/api/public/site");
let site = await r.json();
check("public site returns 200 with defaults", r.status === 200 && site.profile && Array.isArray(site.navigation) && Array.isArray(site.social), r.status);
const emptyDb = site.profile.displayName === "" && site.navigation.length === 0;
console.log(`      (database ${emptyDb ? "is empty" : "already has data"}: ${emptyDb ? "defaults verified" : "default check skipped"})`);
for (const p of ["/api/admin/profile", "/api/admin/social-links", "/api/admin/navigation", "/api/admin/media"]) {
  r = await fetch(base + p); check(`GET ${p} without session -> 401`, r.status === 401, r.status);
}
r = await fetch(base + "/api/admin/media/upload", { method: "POST", body: new FormData() }); check("upload without session -> 401", r.status === 401, r.status);

// --- sign in with mandatory Discord OTP
r = await fetch(base + "/api/auth/password", { method: "POST", headers: J, body: JSON.stringify({ password: PASSWORD }) });
const challenge = await r.json();
const code = await waitForCode();
const verified = await fetch(base + "/api/auth/code", { method: "POST", headers: J, body: JSON.stringify({ challengeId: challenge.challengeId, code }) });
const auth = await verified.json();
const cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0];
check("login with password + Discord OTP gives a session", r.status === 200 && !!challenge.challengeId && verified.status === 200 && auth.authenticated === true && !!cookie, verified.status);
const H = { ...J, cookie };
const call = (m, p, body) => fetch(base + p, { method: m, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });

// --- profile
r = await call("GET", "/api/admin/profile"); let pr = (await r.json()).profile;
check("GET profile", r.status === 200 && typeof pr.displayName === "string");
const full = { ...pr, displayName: "Test Owner", username: "owner", shortBio: "Short bio", extendedBio: "Longer bio text", subtitles: ["Builder", "Gamer"], typingEnabled: true, statusText: "Working", onlineMode: "online", locationText: "Cairo", showLocation: true, timezone: "Africa/Cairo", showLocalTime: true, badges: [{ label: "Verified", color: "#8b5cf6" }] };
delete full.avatarUrl; delete full.bannerUrl; delete full.updatedAt;
r = await call("PUT", "/api/admin/profile", full); pr = (await r.json()).profile;
check("PUT profile saves", r.status === 200 && pr.displayName === "Test Owner" && pr.subtitles.length === 2 && pr.badges[0].label === "Verified", r.status);
r = await call("PUT", "/api/admin/profile", { ...full, timezone: "Mars/Olympus" }); check("bad timezone -> 400", r.status === 400, r.status);
r = await call("PUT", "/api/admin/profile", { ...full, onlineMode: "busy" }); check("bad onlineMode -> 400", r.status === 400, r.status);
r = await call("PUT", "/api/admin/profile", { ...full, shortBio: "x".repeat(281) }); check("too-long bio -> 400", r.status === 400, r.status);
r = await call("PUT", "/api/admin/profile", { ...full, avatarAssetId: "nope" }); check("unknown avatar id -> 400", r.status === 400, r.status);
r = await fetch(base + "/api/admin/profile", { method: "PUT", headers: { ...H, origin: "https://evil.example" }, body: JSON.stringify(full) }); check("cross-origin PUT refused (403)", r.status === 403, r.status);

// --- social links
r = await call("POST", "/api/admin/social-links", { platform: "github", url: "javascript:alert(1)" }); check("javascript: url refused", r.status === 400, r.status);
r = await call("POST", "/api/admin/social-links", { platform: "github", url: "https://github.com/x" }); let items = (await r.json()).items;
check("create social link", r.status === 201 && items.length >= 1);
r = await call("POST", "/api/admin/social-links", { platform: "discord", label: "Discord", url: "https://discord.com/users/1" }); items = (await r.json()).items;
const [s1, s2] = items.slice(-2);
r = await call("PUT", "/api/admin/social-links/order", { ids: [s2.id, s1.id] }); items = (await r.json()).items;
check("reorder social links", items.at(-2).id === s2.id && items.at(-1).id === s1.id);
r = await call("PUT", `/api/admin/social-links/${s1.id}`, { platform: "github", url: "https://github.com/y", visible: false }); items = (await r.json()).items;
check("edit + hide social link", items.find((x) => x.id === s1.id).visible === false);

// --- navigation
r = await call("POST", "/api/admin/navigation", { label: "Evil", url: "//evil.example" }); check("protocol-relative nav url refused", r.status === 400, r.status);
r = await call("POST", "/api/admin/navigation", { label: "Evil", url: "javascript:alert(1)" }); check("javascript: nav url refused", r.status === 400, r.status);
r = await call("POST", "/api/admin/navigation", { label: "Links", url: "/links" }); items = (await r.json()).items;
check("create nav item (internal path)", r.status === 201);
r = await call("POST", "/api/admin/navigation", { label: "Blog", url: "https://example.com/blog", openNewTab: true }); items = (await r.json()).items;
r = await call("POST", "/api/admin/navigation", { label: "Secret", url: "/secret", visible: false }); items = (await r.json()).items;
const mine = items.slice(-3); // Links, Blog, Secret
r = await call("PUT", "/api/admin/navigation/order", { ids: [mine[1].id, mine[0].id, mine[2].id] }); items = (await r.json()).items;
check("reorder nav", items.at(-3).label === "Blog" && items.at(-2).label === "Links");
r = await call("PUT", "/api/admin/navigation/missing", { label: "x", url: "/x" }); check("edit missing nav -> 404", r.status === 404, r.status);

// --- media
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const upload = (bytes, name, type, purpose) => { const f = new FormData(); f.set("file", new File([bytes], name, { type })); f.set("purpose", purpose); return fetch(base + "/api/admin/media/upload", { method: "POST", headers: { cookie, "cf-connecting-ip": "10.9.0.1" }, body: f }); };
r = await upload(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), "x.svg", "image/svg+xml", "avatar"); check("SVG upload refused (415)", r.status === 415, r.status);
r = await upload(new TextEncoder().encode("not an image at all"), "fake.png", "image/png", "avatar"); check("fake PNG (wrong bytes) refused (415)", r.status === 415, r.status);
r = await upload(new Uint8Array([...png, ...new Uint8Array(2 * 1024 * 1024 + 10)]), "big.png", "image/png", "avatar"); const big = await r.json(); check("avatar over 2 MB refused (413) with clear message", r.status === 413 && /limit/.test(big.error.message), r.status);
r = await upload(png, "My Avatar (1).PNG", "image/png", "avatar"); const up = await r.json();
check("PNG upload ok", r.status === 201 && up.asset.mimeType === "image/png" && up.asset.url.startsWith("/media/"), r.status);
check("filename is sanitized", up.asset.filename === "my-avatar-1.png", up.asset.filename);
r = await fetch(base + up.asset.url);
const served = new Uint8Array(await r.arrayBuffer());
check("media served with type, cache and nosniff", r.status === 200 && r.headers.get("content-type") === "image/png" && /immutable/.test(r.headers.get("cache-control") ?? "") && r.headers.get("x-content-type-options") === "nosniff");
check("served bytes equal uploaded bytes", served.length === png.length && served.every((b, i) => b === png[i]));
r = await fetch(base + up.asset.url, { headers: { "if-none-match": r.headers.get("etag") } }); check("conditional request -> 304", r.status === 304, r.status);
r = await fetch(base + "/media/nope/x.png"); check("unknown media id -> 404", r.status === 404, r.status);
r = await call("GET", "/api/admin/media"); check("media list includes upload", (await r.json()).items.some((a) => a.id === up.asset.id));
r = await upload(png, "banner.png", "image/png", "banner"); const ban = await r.json();
r = await call("PUT", "/api/admin/profile", { ...full, avatarAssetId: up.asset.id, bannerAssetId: ban.asset.id }); pr = (await r.json()).profile;
check("profile gets avatar and banner urls", pr.avatarUrl === up.asset.url && pr.bannerUrl === ban.asset.url);

// --- public site now reflects edits, without private data
r = await fetch(base + "/api/public/site"); site = await r.json(); const raw = JSON.stringify(site);
check("public profile shows edits", site.profile.displayName === "Test Owner" && site.profile.avatarUrl === up.asset.url && site.profile.location === "Cairo" && site.profile.timezone === "Africa/Cairo");
check("public nav: order kept, hidden item absent", site.navigation.map((n) => n.label).slice(-2).join() === "Blog,Links" && !raw.includes("Secret") && !raw.includes("/secret"));
check("public nav: internal path and external flag", site.navigation.find((n) => n.label === "Links").href === "/links" && site.navigation.find((n) => n.label === "Blog").newTab === true);
check("public social: hidden link absent, order kept", site.social.at(-1).platform === "discord" && !raw.includes("github.com/y"));
check("public data has no admin or timestamp fields", !/updated_at|updatedAt|sort_order|sortOrder|visible|r2_key|assetId/i.test(raw));
await call("PUT", "/api/admin/profile", { ...full, showLocation: false, showLocalTime: false, onlineMode: "auto" });
site = await (await fetch(base + "/api/public/site")).json();
check("hidden location/time not exposed; auto presence shows nothing", site.profile.location === null && site.profile.timezone === null && site.profile.onlineMode === "hidden");

// --- cleanup + delete
r = await call("DELETE", `/api/admin/media/${ban.asset.id}`); check("delete media", r.status === 200);
r = await fetch(base + ban.asset.url); check("deleted media -> 404", r.status === 404, r.status);
r = await call("GET", "/api/admin/profile"); pr = (await r.json()).profile; check("deleting banner clears profile reference", pr.bannerAssetId === null);
for (const it of items) await call("DELETE", `/api/admin/navigation/${it.id}`);
r = await call("POST", "/api/auth/logout", {});
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
