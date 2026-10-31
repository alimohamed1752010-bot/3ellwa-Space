// LOCAL ONLY full auth test with a fake Discord. Not for production.
// 1) .dev.vars must contain: ADMIN_PASSWORD="test password" and DISCORD_AUTH_WEBHOOK_URL=http://127.0.0.1:9999/hook
// 2) npm run dev   (in another terminal)
// 3) node scripts/auth-flow-test.mjs [baseUrl] "test password"
import http from "node:http";
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const PASSWORD = process.argv[3];
if (!PASSWORD) { console.error('Usage: node scripts/auth-flow-test.mjs http://localhost:8787 "test password"'); process.exit(1); }
const messages = [];
const discordServer = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { try { messages.push(JSON.parse(b).content); } catch {} res.writeHead(204).end(); }); });
await new Promise((resolve) => discordServer.listen(9999, "127.0.0.1", resolve));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (n, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${info !== "" ? "  (" + info + ")" : ""}`); if (!ok) failed++; };
let n = 0; const newIp = () => `10.0.0.${++n}`;
const post = (p, body, ip, cookie) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
const lastCode = () => (messages.at(-1)?.match(/\*\*(\d{8})\*\*/) ?? [])[1];
const cookieOf = (r) => (r.headers.get("set-cookie") ?? "").split(";")[0];

// Wrong password
let ip = newIp(), r = await post("/api/auth/password", { password: "nope" }, ip);
check("wrong password -> 401", r.status === 401, r.status);
await sleep(200); check("failed password pinged Discord", messages.some((m) => m?.includes("Wrong admin password")));

// Happy path
ip = newIp(); messages.length = 0;
r = await post("/api/auth/password", { password: PASSWORD }, ip); let j = await r.json();
check("correct password -> challengeId", r.status === 200 && !!j.challengeId, r.status);
await sleep(200); const code = lastCode(); check("8-digit code arrived in Discord", /^\d{8}$/.test(code ?? ""));
const cid = j.challengeId;
r = await post("/api/auth/code", { challengeId: cid, code: code === "00000000" ? "11111111" : "00000000" }, ip);
check("wrong code -> 401", r.status === 401, r.status);
r = await post("/api/auth/code", { challengeId: cid, code, trustDevice: false }, ip);
const cookie = cookieOf(r); const sc = r.headers.get("set-cookie") ?? "";
check("right code -> 200 + cookie", r.status === 200 && cookie.includes("="), r.status);
check("cookie is HttpOnly + SameSite=Strict", /httponly/i.test(sc) && /samesite=strict/i.test(sc));
r = await fetch(base + "/api/auth/me", { headers: { cookie } }); check("/me authenticated (refresh survives)", (await r.json()).authenticated === true);
r = await fetch(base + "/api/admin/ping", { headers: { cookie } }); check("admin API with session -> 200", r.status === 200, r.status);
r = await post("/api/auth/code", { challengeId: cid, code }, ip); check("code cannot be reused", r.status === 401, r.status);
r = await post("/api/auth/logout", {}, ip, cookie); check("logout -> 200", r.status === 200);
r = await fetch(base + "/api/auth/me", { headers: { cookie } }); check("/me after logout is false", (await r.json()).authenticated === false);
r = await fetch(base + "/api/admin/ping", { headers: { cookie } }); check("admin API after logout -> 401", r.status === 401, r.status);

// Code brute force: 5 wrong tries kill the code even for the right code
ip = newIp(); messages.length = 0;
r = await post("/api/auth/password", { password: PASSWORD }, ip); j = await r.json(); await sleep(200);
const good = lastCode();
for (let i = 0; i < 5; i++) await post("/api/auth/code", { challengeId: j.challengeId, code: good === "12345678" ? "87654321" : "12345678" }, ip);
r = await post("/api/auth/code", { challengeId: j.challengeId, code: good }, ip);
check("code is void after 5 wrong tries", r.status === 401 || r.status === 429, r.status);

// Password lockout
ip = newIp();
for (let i = 0; i < 5; i++) await post("/api/auth/password", { password: "bad" + i }, ip);
r = await post("/api/auth/password", { password: PASSWORD }, ip);
check("locked after 5 wrong passwords (even correct one -> 429)", r.status === 429, r.status);
check("429 has Retry-After", Number(r.headers.get("retry-after")) > 0);

// Cross-origin POST refused
r = await fetch(base + "/api/auth/password", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ password: PASSWORD }) });
check("cross-origin POST refused", r.status === 403, r.status);

discordServer.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed"); process.exit(failed ? 1 : 0);
