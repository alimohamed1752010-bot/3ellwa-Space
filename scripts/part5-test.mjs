import http from "node:http";
// LOCAL ONLY test of Part 5 routes (themes: presets, drafts, publish, activate, import/export, backgrounds).
// Needs ADMIN_PASSWORD + DISCORD_AUTH_WEBHOOK_URL=http://127.0.0.1:9999/hook, local D1 migrated (0001 and 0002), and a local Worker.
// node scripts/part5-test.mjs [baseUrl] "test password"
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const PASSWORD = process.argv[3];
if (!PASSWORD) { console.error('Usage: node scripts/part5-test.mjs http://localhost:8787 "test password"'); process.exit(1); }

const discordMessages = [];
const discordServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => { try { discordMessages.push(JSON.parse(body).content ?? ""); } catch {} res.writeHead(204).end(); });
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
const J = { "content-type": "application/json", "cf-connecting-ip": "10.9.0.5" };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAJ0lEQVR4nGM8oRHFMBCAaUBsHbV41OJRi0ctHrV41OJRi0ctHhAAAPSaAXLsLiwIAAAAAElFTkSuQmCC";

let r = await fetch(base + "/api/health");
check("server is up", r.status === 200, r.status);
for (const [m, p] of [["GET", "/api/admin/themes"], ["POST", "/api/admin/themes"], ["POST", "/api/admin/themes/import"], ["PUT", "/api/admin/themes/x/draft"], ["POST", "/api/admin/themes/x/publish"], ["POST", "/api/admin/themes/x/activate"], ["DELETE", "/api/admin/themes/x"]]) {
  r = await fetch(base + p, { method: m, headers: J, body: m === "GET" || m === "DELETE" ? undefined : "{}" });
  check(`${m} ${p} without session -> 401`, r.status === 401, r.status);
}

r = await fetch(base + "/api/auth/password", { method: "POST", headers: J, body: JSON.stringify({ password: PASSWORD }) });
const challenge = await r.json();
const code = await waitForCode();
const verified = await fetch(base + "/api/auth/code", { method: "POST", headers: J, body: JSON.stringify({ challengeId: challenge.challengeId, code }) });
const cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0];
check("login with password + Discord OTP gives a session", verified.status === 200 && !!cookie, verified.status);
const H = { ...J, cookie };
const call = (m, p, body) => fetch(base + p, { method: m, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
const strip = (t) => { const c = structuredClone(t); delete c.background.assetUrl; return c; };
const tag = `t5${Date.now().toString(36)}`;
const publicTheme = async () => (await (await fetch(base + "/api/public/site")).json()).theme;
const list = async () => (await (await call("GET", "/api/admin/themes")).json()).items;

// --- presets (migration 0002)
let items = await list();
const presets = items.filter((t) => t.isPreset);
const violet = items.find((t) => t.id === "preset-midnight-violet");
check("three built-in presets exist", presets.length === 3 && ["preset-midnight-violet", "preset-graphite", "preset-ember"].every((id) => presets.some((p) => p.id === id)), presets.map((p) => p.id).join(","));
check("exactly one theme is active", items.filter((t) => t.isActive).length === 1);
const startActive = items.find((t) => t.isActive);
check("public site serves the active theme", (await publicTheme()).name === startActive.name, startActive.name);
const graphite = items.find((t) => t.id === "preset-graphite");
for (const [m, p, b] of [["PUT", `/api/admin/themes/${violet.id}/name`, { name: "X" }], ["PUT", `/api/admin/themes/${violet.id}/draft`, { tokens: strip(violet.tokens) }], ["POST", `/api/admin/themes/${violet.id}/reset`, {}], ["POST", `/api/admin/themes/${violet.id}/publish`, {}], ["DELETE", `/api/admin/themes/${violet.id}`, undefined]]) {
  r = await call(m, p, b); const j = await r.json().catch(() => ({}));
  check(`preset is locked: ${m} ${p.split("/").pop()} -> 403`, r.status === 403 && j.error?.code === "preset_locked", r.status);
}

// --- duplicate, rename, validation
r = await call("POST", `/api/admin/themes/${graphite.id}/duplicate`, {}); let dup = (await r.json()).item;
check("duplicate a preset -> custom, inactive, same tokens", r.status === 201 && !dup.isPreset && !dup.isActive && dup.name === "Graphite copy" && JSON.stringify(dup.tokens) === JSON.stringify(graphite.tokens), r.status);
r = await call("PUT", `/api/admin/themes/${dup.id}/name`, { name: `Mine ${tag}` }); dup = (await r.json()).item;
check("rename custom theme", r.status === 200 && dup.name === `Mine ${tag}`, r.status);
r = await call("PUT", `/api/admin/themes/${dup.id}/name`, { name: "   " }); check("blank name -> 400", r.status === 400, r.status);
r = await call("PUT", `/api/admin/themes/${dup.id}/name`, { name: "n".repeat(49) }); check("name over 48 chars -> 400", r.status === 400, r.status);
for (const p of ["name", "draft", "reset", "publish", "activate", "duplicate", "export"]) {
  const m = p === "name" || p === "draft" ? "PUT" : p === "export" ? "GET" : "POST";
  const body = p === "name" ? { name: "x" } : p === "draft" ? { tokens: strip(violet.tokens) } : m === "POST" ? {} : undefined;
  r = await call(m, `/api/admin/themes/nope/${p}`, body); check(`unknown theme: ${p} -> 404`, r.status === 404, r.status);
}
r = await call("DELETE", "/api/admin/themes/nope"); check("unknown theme: delete -> 404", r.status === 404, r.status);

// --- draft / publish
const edited = strip(dup.tokens); edited.colors.accent = "#ff00aa"; edited.cards.radius = 20;
const bad = structuredClone(edited); bad.colors.accent = "red";
r = await call("PUT", `/api/admin/themes/${dup.id}/draft`, { tokens: bad }); check("draft with invalid color -> 400", r.status === 400, r.status);
const extra = structuredClone(edited); extra.colors.surprise = "#000000";
r = await call("PUT", `/api/admin/themes/${dup.id}/draft`, { tokens: extra }); check("draft with unknown token -> 400 (strict schema)", r.status === 400, r.status);
const oob = structuredClone(edited); oob.cards.radius = 99;
r = await call("PUT", `/api/admin/themes/${dup.id}/draft`, { tokens: oob }); check("draft with out-of-range value -> 400", r.status === 400, r.status);
r = await call("PUT", `/api/admin/themes/${dup.id}/draft`, { tokens: edited }); let t = (await r.json()).item;
check("save draft keeps published tokens unchanged", r.status === 200 && t.tokens.colors.accent === graphite.tokens.colors.accent && t.draftTokens.colors.accent === "#ff00aa" && t.version === 0, r.status);
r = await call("POST", `/api/admin/themes/${dup.id}/reset`, {}); t = (await r.json()).item;
check("reset discards the draft", r.status === 200 && t.draftTokens.colors.accent === graphite.tokens.colors.accent);
await call("PUT", `/api/admin/themes/${dup.id}/draft`, { tokens: edited });
r = await call("POST", `/api/admin/themes/${dup.id}/publish`, {}); t = (await r.json()).item;
check("publish promotes the draft and bumps the version", r.status === 200 && t.tokens.colors.accent === "#ff00aa" && t.draftTokens === null && t.version === 1, `v${t.version}`);
r = await call("POST", `/api/admin/themes/${dup.id}/publish`, {}); check("publish with no draft -> 409", r.status === 409 && (await r.json()).error?.code === "no_draft", r.status);

// --- activate / live site
r = await call("POST", `/api/admin/themes/${dup.id}/activate`, {}); t = (await r.json()).item;
items = await list();
check("activate makes it the only active theme", r.status === 200 && t.isActive && items.filter((x) => x.isActive).length === 1 && items.find((x) => x.isActive).id === dup.id);
let pub = await publicTheme();
check("public site now serves the published tokens", pub.name === `Mine ${tag}` && pub.tokens.colors.accent === "#ff00aa" && pub.tokens.cards.radius === 20, pub.name);
check("public theme never exposes a raw asset id", !("assetId" in pub.tokens.background));
await call("PUT", `/api/admin/themes/${dup.id}/draft`, { tokens: { ...edited, colors: { ...edited.colors, accent: "#00ffaa" } } });
pub = await publicTheme(); check("an unpublished draft does not reach the public site", pub.tokens.colors.accent === "#ff00aa");
r = await call("DELETE", `/api/admin/themes/${dup.id}`); check("deleting the active theme -> 409", r.status === 409 && (await r.json()).error?.code === "theme_active", r.status);

// --- export / import round trip
r = await call("GET", `/api/admin/themes/${dup.id}/export`); const exp = await r.json();
check("export has format, version, name and tokens", r.status === 200 && exp.format === "3ellwa-theme" && exp.version === 1 && exp.tokens.colors.accent === "#ff00aa");
r = await call("POST", "/api/admin/themes/import", { name: `Imported ${tag}`, tokens: exp.tokens }); const imp = (await r.json()).item;
check("import creates an inactive custom theme with identical tokens", r.status === 201 && !imp.isActive && !imp.isPreset && JSON.stringify(strip(imp.tokens)) === JSON.stringify(exp.tokens));
r = await call("POST", "/api/admin/themes/import", { name: "Broken", tokens: { colors: {} } }); check("import with invalid tokens -> 400", r.status === 400, r.status);
r = await call("POST", "/api/admin/themes", { name: `Fresh ${tag}` }); const fresh = (await r.json()).item;
check("create with no tokens uses the defaults", r.status === 201 && fresh.tokens.colors.bg === "#0b0a10", r.status);

// --- background image validity
const f = new FormData(); f.set("file", new File([Uint8Array.from(Buffer.from(PNG, "base64"))], `bg-${tag}.png`, { type: "image/png" })); f.set("purpose", "library");
r = await fetch(base + "/api/admin/media/upload", { method: "POST", headers: { cookie, "cf-connecting-ip": J["cf-connecting-ip"] }, body: f });
const asset = (await r.json()).asset; check("upload an image to use as a background", r.status === 201 && !!asset?.id, r.status);
const imgTheme = strip(fresh.tokens); imgTheme.background = { ...imgTheme.background, mode: "image", assetId: asset.id };
r = await call("POST", "/api/admin/themes", { name: `Img ${tag}`, tokens: imgTheme }); const withImg = (await r.json()).item;
check("image background resolves to a media URL", r.status === 201 && /^\/media\//.test(withImg.tokens.background.assetUrl ?? ""), withImg?.tokens?.background?.assetUrl);
const missing = structuredClone(imgTheme); missing.background.assetId = "doesnotexist";
r = await call("POST", "/api/admin/themes", { name: "Ghost", tokens: missing }); check("background pointing at a missing file -> 400", r.status === 400 && (await r.json()).error?.code === "invalid_background", r.status);
const wrongKind = structuredClone(imgTheme); wrongKind.background.mode = "video";
r = await call("POST", "/api/admin/themes", { name: "Wrong", tokens: wrongKind }); check("video mode with an image file -> 400", r.status === 400, r.status);
const noFile = structuredClone(imgTheme); noFile.background.assetId = null;
r = await call("POST", "/api/admin/themes", { name: "Empty", tokens: noFile }); check("image mode without a file -> 400", r.status === 400, r.status);
r = await call("GET", `/api/admin/media/${asset.id}/usage`); const usage = (await r.json()).usage ?? [];
check("media usage lists the theme that uses the file", usage.some((u) => u.type === "theme" && u.id === withImg.id), JSON.stringify(usage));
r = await call("POST", `/api/admin/themes/${withImg.id}/activate`, {}); pub = await publicTheme();
check("active image theme reaches the public site with its URL", r.status === 200 && /^\/media\//.test(pub.tokens.background.assetUrl ?? ""));
await call("POST", `/api/admin/themes/${graphite.id}/activate`, {});
r = await call("DELETE", `/api/admin/media/${asset.id}`); check("deleting a file used by a theme succeeds", r.status === 200, r.status);
const after = (await list()).find((x) => x.id === withImg.id);
check("theme falls back safely after its background file is deleted", !!after && after.tokens.background.mode !== "image" || after?.tokens.background.assetId === null, JSON.stringify(after?.tokens?.background));
const r2 = await fetch(base + "/api/public/site"); check("public site still loads", r2.status === 200, r2.status);

// --- cleanup, and leave the original theme active
await call("POST", `/api/admin/themes/${startActive.id}/activate`, {});
for (const id of [dup.id, imp.id, fresh.id, withImg.id]) { r = await call("DELETE", `/api/admin/themes/${id}`); check(`delete custom theme ${id}`, r.status === 200, r.status); }
items = await list();
check("back to the original state: presets only, original active", items.length === 3 && items.find((x) => x.isActive)?.id === startActive.id);
await call("POST", "/api/auth/logout", {});
discordServer.close();
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
