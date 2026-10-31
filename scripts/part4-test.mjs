import http from "node:http";
// LOCAL ONLY test of Part 4 routes (media library, custom pages, and navigation).
// Needs ADMIN_PASSWORD + DISCORD_AUTH_WEBHOOK_URL=http://127.0.0.1:9999/hook, local D1 migrated, and `npm run dev` running.
// node scripts/part4-test.mjs [baseUrl] "test password"
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const PASSWORD = process.argv[3];
if (!PASSWORD) { console.error('Usage: node scripts/part4-test.mjs http://localhost:8787 "test password"'); process.exit(1); }

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
const J = { "content-type": "application/json", "cf-connecting-ip": "10.9.0.4" };
// Tiny real images (generated once) so the tests need no files on disk.
const FX = {
  PNG_40x20: "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAJ0lEQVR4nGM8oRHFMBCAaUBsHbV41OJRi0ctHrV41OJRi0ctHhAAAPSaAXLsLiwIAAAAAElFTkSuQmCC",
  JPG_60x30: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAeADwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDBooorM+NCiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z",
  WEBP_30x30: "UklGRkoAAABXRUJQVlA4ID4AAABQAwCdASoeAB4APm00lkekIyIhKAgAgA2JZQC1FoAAQOJeAAD+9Vi//1wH/zgP/nAf0wfXeLSZLGjIbB4AAA==",
  GIF_10x10: "R0lGODdhCgAKAIAAAAAAAAAAACwAAAAACgAKAAAIEgABCBxIsKDBgwgTKlzIsGHCgAA7",
  PNG_50x50: "iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAIAAACRXR/mAAAAT0lEQVR4nO3OIQEAIQAAMSDD9w+KogDmFC+2BJt7f+N/1uvAnVahVWgVWoVWoVVoFVqFVqFVaBVahVahVWgVWoVWoVVoFVqFVqFVaBVaxQHIrwJsDZOQdAAAAABJRU5ErkJggg==",
};

const bytes = (k) => Uint8Array.from(Buffer.from(FX[k], "base64"));
const mime = { PNG: "image/png", JPG: "image/jpeg", WEBP: "image/webp", GIF: "image/gif" };
const fileOf = (k, name) => new File([bytes(k)], name, { type: mime[k.split("_")[0]] });

let r = await fetch(base + "/api/health");
check("server is up", r.status === 200, r.status);
for (const [m, p] of [["GET", "/api/admin/media"], ["GET", "/api/admin/media/folders"], ["POST", "/api/admin/media/bulk"], ["GET", "/api/admin/media/x/usage"], ["PUT", "/api/admin/media/x"], ["POST", "/api/admin/media/x/replace"], ["POST", "/api/admin/media/folders"]]) {
  r = await fetch(base + p, { method: m, headers: J, body: m === "GET" ? undefined : "{}" }); check(`${m} ${p} without session -> 401`, r.status === 401, r.status);
}

r = await fetch(base + "/api/auth/password", { method: "POST", headers: J, body: JSON.stringify({ password: PASSWORD }) });
const challenge = await r.json();
const code = await waitForCode();
const verified = await fetch(base + "/api/auth/code", { method: "POST", headers: J, body: JSON.stringify({ challengeId: challenge.challengeId, code }) });
const auth = await verified.json();
const cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0];
check("login with password + Discord OTP gives a session", r.status === 200 && !!challenge.challengeId && verified.status === 200 && auth.authenticated === true && !!cookie, verified.status);
const H = { ...J, cookie };
const call = (m, p, body) => fetch(base + p, { method: m, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
const upload = async (file, fields = {}, path = "/api/admin/media/upload") => {
  const f = new FormData(); f.set("file", file); for (const [k, v] of Object.entries(fields)) f.set(k, v);
  const x = await fetch(base + path, { method: "POST", headers: { cookie, "cf-connecting-ip": J["cf-connecting-ip"] }, body: f });
  return { status: x.status, ...(await x.json().catch(() => ({}))) };
};
const tag = `t4${Date.now().toString(36)}`;

// --- folders
r = await call("POST", "/api/admin/media/folders", { name: `Trips ${tag}` }); let fl = (await r.json()).items;
const trips = fl.find((f) => f.name === `Trips ${tag}`);
check("create folder", r.status === 201 && !!trips && trips.assetCount === 0, r.status);
r = await call("POST", "/api/admin/media/folders", { name: `trips ${tag}`.toUpperCase() }); check("duplicate folder name (any case) -> 409", r.status === 409, r.status);
r = await call("POST", "/api/admin/media/folders", { name: "   " }); check("blank folder name -> 400", r.status === 400, r.status);
r = await call("PUT", `/api/admin/media/folders/${trips.id}`, { name: `Journeys ${tag}` }); fl = (await r.json()).items;
check("rename folder", r.status === 200 && fl.some((f) => f.name === `Journeys ${tag}`));
r = await call("PUT", "/api/admin/media/folders/missing", { name: "x" }); check("rename missing folder -> 404", r.status === 404, r.status);

// --- upload
let a = await upload(fileOf("PNG_40x20", `My Photo (1) ${tag}.PNG`), { purpose: "library", folderId: trips.id, alt: "A red photo" });
check("library upload 201 with real width/height", a.status === 201 && a.asset.width === 40 && a.asset.height === 20 && a.asset.mimeType === "image/png", JSON.stringify(a.asset ?? a));
check("upload keeps folder, alt, safe name", a.asset?.folderId === trips.id && a.asset?.altText === "A red photo" && a.asset?.filename === `my-photo-1-${tag}.png`, a.asset?.filename);
const A = a.asset;
const j = await upload(fileOf("JPG_60x30", `jpg ${tag}.jpg`), { purpose: "library" });
check("jpeg upload reads dimensions", j.status === 201 && j.asset.width === 60 && j.asset.height === 30 && j.asset.mimeType === "image/jpeg");
const w = await upload(fileOf("WEBP_30x30", `webp ${tag}.webp`), { purpose: "library" });
check("webp upload reads dimensions", w.status === 201 && w.asset.width === 30 && w.asset.height === 30 && w.asset.mimeType === "image/webp");
const g = await upload(fileOf("GIF_10x10", `gif ${tag}.gif`), { purpose: "library" });
check("gif upload reads dimensions", g.status === 201 && g.asset.width === 10 && g.asset.mimeType === "image/gif");
const av = await upload(fileOf("PNG_40x20", `avatar ${tag}.png`));
check("old behaviour: no purpose = avatar upload still works", av.status === 201);
let bad = await upload(new File(["<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>"], "x.svg", { type: "image/svg+xml" }), { purpose: "library" }); check("SVG refused (415)", bad.status === 415, bad.status);
bad = await upload(new File(["<html><script>alert(1)</script></html>"], "evil.png", { type: "image/png" }), { purpose: "library" }); check("HTML renamed .png refused (415)", bad.status === 415, bad.status);
bad = await upload(new File([], "empty.png", { type: "image/png" }), { purpose: "library" }); check("empty file -> 400", bad.status === 400, bad.status);
bad = await upload(fileOf("PNG_40x20", "x.png"), { purpose: "library", folderId: "nope" }); check("unknown folder -> 400", bad.status === 400, bad.status);
{
  const big = new Uint8Array(9 * 1048576); big.set(bytes("PNG_40x20"));
  bad = await upload(new File([big], "big.png", { type: "image/png" }), { purpose: "library" }); check("library file over 8 MB -> 413", bad.status === 413, bad.status);
  const mid = new Uint8Array(3 * 1048576); mid.set(bytes("PNG_40x20"));
  bad = await upload(new File([mid], "mid.png", { type: "image/png" }), { purpose: "avatar" }); check("avatar over 2 MB still -> 413", bad.status === 413, bad.status);
  const ok = await upload(new File([mid], "mid.png", { type: "image/png" }), { purpose: "library" }); check("3 MB is fine for the library", ok.status === 201, ok.status);
  if (ok.asset) await call("DELETE", `/api/admin/media/${ok.asset.id}`);
}

// --- serving
r = await fetch(base + A.url);
check("serves the file with correct headers", r.status === 200 && r.headers.get("content-type") === "image/png" && r.headers.get("x-content-type-options") === "nosniff" && /immutable/.test(r.headers.get("cache-control") ?? ""), r.status);
check("served bytes are the uploaded bytes", Buffer.from(await r.arrayBuffer()).equals(Buffer.from(bytes("PNG_40x20"))));

// --- list, search, filters, sort
let list = await (await call("GET", "/api/admin/media?limit=500")).json();
check("list includes uploads with folder and usage fields", list.items.some((x) => x.id === A.id && x.folderId === trips.id && x.usedCount === 0 && x.name === `my-photo-1-${tag}.png`) && list.totalAssets >= 5);
list = await (await call("GET", `/api/admin/media?q=${encodeURIComponent("photo-1-" + tag)}`)).json();
check("search by name", list.items.length === 1 && list.items[0].id === A.id, list.items.length);
list = await (await call("GET", `/api/admin/media?q=${encodeURIComponent("red photo")}`)).json();
check("search by alt text", list.items.some((x) => x.id === A.id));
list = await (await call("GET", "/api/admin/media?q=%25")).json();
check("a literal % in search does not match everything", list.items.length === 0, list.items.length);
list = await (await call("GET", `/api/admin/media?folder=${trips.id}`)).json();
check("folder filter", list.items.length === 1 && list.items[0].id === A.id);
list = await (await call("GET", "/api/admin/media?folder=none&limit=500")).json();
check("unfiled filter excludes foldered images", list.items.length >= 3 && !list.items.some((x) => x.id === A.id));
list = await (await call("GET", `/api/admin/media?sort=name&q=${tag}`)).json();
const names = list.items.map((x) => x.filename);
check("sort by name", JSON.stringify(names) === JSON.stringify([...names].sort()), names.join(","));
fl = (await (await call("GET", "/api/admin/media/folders")).json()).items;
check("folder asset count", fl.find((f) => f.id === trips.id)?.assetCount === 1);

// --- usage: a link uses the image
r = await call("POST", "/api/admin/links", { title: `Uses image ${tag}`, url: "https://example.com", imageAssetId: A.id }); const L = (await r.json()).item;
check("link accepts library image", r.status === 201 && L?.imageUrl === A.url, r.status);
let usage = await (await call("GET", `/api/admin/media/${A.id}/usage`)).json();
check("usage lists the link", usage.usage.length === 1 && usage.usage[0].type === "link" && usage.usage[0].label.includes(tag), JSON.stringify(usage));
list = await (await call("GET", `/api/admin/media?q=${tag}`)).json();
check("usedCount is 1", list.items.find((x) => x.id === A.id)?.usedCount === 1);
r = await call("GET", "/api/admin/media/missing/usage"); check("usage of missing -> 404", r.status === 404, r.status);

// --- rename, alt, move
r = await call("PUT", `/api/admin/media/${A.id}`, { name: "Sunset Beach!!.jpg", altText: "A sunset", folderId: null }); let up = await r.json();
check("rename keeps real extension, sanitizes, moves out of folder", r.status === 200 && up.asset.filename === "sunset-beach.png" && up.asset.folderId === null && up.asset.altText === "A sunset", JSON.stringify(up.asset ?? up));
r = await fetch(base + up.asset.url); check("renamed URL serves the file", r.status === 200 && r.headers.get("content-type") === "image/png");
r = await call("PUT", `/api/admin/media/${A.id}`, { folderId: "nope" }); check("move to unknown folder -> 400", r.status === 400, r.status);
r = await call("PUT", "/api/admin/media/missing", { name: "x" }); check("rename missing -> 404", r.status === 404, r.status);
r = await call("PUT", `/api/admin/media/${A.id}`, { name: "" }); check("empty name -> 400", r.status === 400, r.status);
r = await call("PUT", `/api/admin/media/${A.id}`, { altText: null }); up = await r.json(); check("clearing alt text", up.asset.altText === null && up.asset.filename === "sunset-beach.png");

// --- replace keeps id and references, changes URL
const oldUrl = up.asset.url;
let rep = await upload(fileOf("PNG_50x50", "ignored-name.png"), {}, `/api/admin/media/${A.id}/replace`);
check("replace keeps the id, new dimensions, cache-tagged name", rep.status === 200 && rep.asset.id === A.id && rep.asset.width === 50 && /^sunset-beach~[0-9a-f]{6}\.png$/.test(rep.asset.filename), JSON.stringify(rep.asset ?? rep));
check("replace changes the URL (so browsers refetch)", rep.asset.url !== oldUrl);
r = await fetch(base + rep.asset.url); check("new URL serves the new bytes", r.status === 200 && Buffer.from(await r.arrayBuffer()).equals(Buffer.from(bytes("PNG_50x50"))));
list = await (await call("GET", "/api/admin/links")).json();
check("link now points at the new URL (reference kept)", list.items.find((x) => x.id === L.id)?.imageUrl === rep.asset.url && list.items.find((x) => x.id === L.id)?.imageAssetId === A.id);
rep = await upload(fileOf("JPG_60x30", "swap.jpg"), {}, `/api/admin/media/${A.id}/replace`);
check("replace with another type updates mime and extension", rep.status === 200 && rep.asset.mimeType === "image/jpeg" && /\.jpg$/.test(rep.asset.filename) && rep.asset.name === "sunset-beach.jpg", JSON.stringify(rep.asset ?? rep));
r = await call("PUT", `/api/admin/media/${A.id}`, { name: "renamed after replace" }); up = await r.json();
check("renaming after a replace keeps the cache tag", /^renamed-after-replace~[0-9a-f]{6}\.jpg$/.test(up.asset.filename), up.asset?.filename);
rep = await upload(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }), {}, `/api/admin/media/${A.id}/replace`); check("replace with SVG -> 415, asset unchanged", rep.status === 415, rep.status);
rep = await upload(fileOf("PNG_50x50", "x.png"), {}, "/api/admin/media/missing/replace"); check("replace missing -> 404", rep.status === 404, rep.status);

// --- bulk
const ids = [j.asset.id, w.asset.id, g.asset.id];
r = await call("POST", "/api/admin/media/bulk", { action: "move", ids, folderId: trips.id }); check("bulk move", r.status === 200 && (await r.json()).count === 3);
list = await (await call("GET", `/api/admin/media?folder=${trips.id}`)).json(); check("moved images are in the folder", ids.every((id) => list.items.some((x) => x.id === id)));
r = await call("POST", "/api/admin/media/bulk", { action: "move", ids, folderId: "nope" }); check("bulk move to unknown folder -> 400", r.status === 400, r.status);
r = await call("POST", "/api/admin/media/bulk", { action: "move", ids: [] }); check("bulk with no ids -> 400", r.status === 400, r.status);
r = await call("POST", "/api/admin/media/bulk", { action: "explode", ids }); check("bulk unknown action -> 400", r.status === 400, r.status);

// --- delete folder keeps files; delete files clears references and R2
r = await call("DELETE", `/api/admin/media/folders/${trips.id}`); fl = (await r.json()).items;
list = await (await call("GET", `/api/admin/media?q=${tag}`)).json();
check("deleting a folder keeps its images (unfiled)", r.status === 200 && !fl.some((f) => f.id === trips.id) && ids.every((id) => list.items.find((x) => x.id === id)?.folderId === null));
r = await call("DELETE", `/api/admin/media/folders/${trips.id}`); check("delete folder again -> 404", r.status === 404, r.status);
const jUrl = j.asset.url;
r = await call("POST", "/api/admin/media/bulk", { action: "delete", ids }); check("bulk delete", r.status === 200 && (await r.json()).count === 3);
r = await fetch(base + jUrl); check("bulk-deleted file is gone (404)", r.status === 404, r.status);
r = await call("DELETE", `/api/admin/media/${A.id}`); check("delete an image that is in use", r.status === 200, r.status);
list = await (await call("GET", "/api/admin/links")).json();
check("link image reference cleared, link kept", list.items.find((x) => x.id === L.id)?.imageAssetId === null);
r = await call("DELETE", `/api/admin/media/${A.id}`); check("delete again -> 404", r.status === 404, r.status);
await call("DELETE", `/api/admin/media/${av.asset.id}`);
await call("DELETE", `/api/admin/links/${L.id}`);

// --- custom pages
let pageResponse = await call("POST", "/api/admin/pages", { title: `Test page ${tag}` });
let pageItem = (await pageResponse.json()).item;
check("create page as draft", pageResponse.status === 201 && pageItem?.status === "draft" && !!pageItem.slug, pageResponse.status);
const pageDraft = { title: pageItem.title, slug: pageItem.slug, metaTitle: "Test page metadata", metaDescription: "A custom page test", visibility: "public", indexable: false, sections: [{ type: "text", title: "Hello", body: "Published page content", url: "", assetId: "" }] };
pageResponse = await call("PUT", `/api/admin/pages/${pageItem.id}/draft`, pageDraft);
check("save page draft with a content block", pageResponse.status === 200 && (await pageResponse.json()).item.sections.length === 1, pageResponse.status);
pageResponse = await call("POST", `/api/admin/pages/${pageItem.id}/publish`);
pageItem = (await pageResponse.json()).item;
check("publish page", pageResponse.status === 200 && pageItem.status === "published", pageResponse.status);
let publicPage = await fetch(base + `/api/public/pages/${pageItem.slug}`);
let publicData = (await publicPage.json()).page;
check("public page endpoint exposes published content only", publicPage.status === 200 && publicData?.sections?.[0]?.body === "Published page content" && publicData.indexable === false, publicPage.status);
pageResponse = await call("PUT", `/api/admin/pages/${pageItem.id}/draft`, { ...pageDraft, title: "Unpublished draft title", sections: [{ type: "text", title: "Draft", body: "Draft must stay private", url: "", assetId: "" }] });
publicPage = await fetch(base + `/api/public/pages/${pageItem.slug}`);
publicData = (await publicPage.json()).page;
check("public page does not leak unpublished draft edits", publicPage.status === 200 && publicData?.title === pageDraft.title && publicData?.sections?.[0]?.body === "Published page content");
pageResponse = await call("POST", `/api/admin/pages/${pageItem.id}/publish`);
pageItem = (await pageResponse.json()).item;

// --- navigation page destinations
let navResponse = await call("POST", "/api/admin/navigation", { label: "Test page link", targetType: "page", pageId: pageItem.id, url: null, openNewTab: false, visible: true });
let navItems = (await navResponse.json()).items;
const pageNav = navItems.find((x) => x.label === "Test page link");
check("navigation can target a published page", navResponse.status === 201 && pageNav?.targetType === "page" && pageNav?.pageId === pageItem.id, navResponse.status);
let siteData = (await (await fetch(base + "/api/public/site")).json());
check("public navigation resolves page destination", siteData.navigation.some((x) => x.label === "Test page link" && x.href === "/" + pageItem.slug));
navResponse = await call("PUT", `/api/admin/navigation/${pageNav.id}`, { label: "Test page link", targetType: "page", pageId: pageItem.id, url: null, openNewTab: false, visible: false });
siteData = await (await fetch(base + "/api/public/site")).json();
check("hidden page navigation item is omitted publicly", navResponse.status === 200 && !siteData.navigation.some((x) => x.label === "Test page link"));
await call("DELETE", `/api/admin/navigation/${pageNav.id}`);
await call("DELETE", `/api/admin/pages/${pageItem.id}`);

// --- projects
const projectBody = { name: `Project ${tag}`, slug: `project-${tag}`, description: "A test project", technologies: ["TypeScript", "Cloudflare"], category: "Software", status: "active", startedOn: "2026-01-15", featured: true, visible: true, links: [{ label: "Website", url: "https://example.com" }], gallery: [] };
let projectResponse = await call("POST", "/api/admin/projects", projectBody);
let project = (await projectResponse.json()).item;
check("create project with custom link and technologies", projectResponse.status === 201 && project?.slug === projectBody.slug && project.technologies.includes("TypeScript") && project.links[0]?.label === "Website", projectResponse.status);
let publicProjects = await (await fetch(base + "/api/public/projects")).json();
check("public projects list includes visible project", publicProjects.items.some((x) => x.id === project.id));
let publicProject = await fetch(base + "/api/public/projects/" + project.slug);
let publicProjectData = (await publicProject.json()).item;
check("public project detail includes links and description", publicProject.status === 200 && publicProjectData?.description === "A test project" && publicProjectData.links[0]?.url === "https://example.com");
projectResponse = await call("PUT", `/api/admin/projects/${project.id}`, { ...projectBody, name: "Updated " + tag, visible: false });
project = (await projectResponse.json()).item;
publicProjects = await (await fetch(base + "/api/public/projects")).json();
check("hidden project is omitted from public list", projectResponse.status === 200 && !publicProjects.items.some((x) => x.id === project.id));
projectResponse = await call("POST", "/api/admin/projects", { ...projectBody, name: "Collision " + tag });
check("duplicate project slug is refused", projectResponse.status === 409, projectResponse.status);
projectResponse = await call("POST", `/api/admin/projects/${project.id}/duplicate`);
const copiedProject = (await projectResponse.json()).item;
check("duplicate project creates hidden copy", projectResponse.status === 201 && copiedProject?.visible === false && copiedProject?.name.includes("copy"));
projectResponse = await call("DELETE", `/api/admin/projects/${copiedProject.id}`);
check("delete duplicated project", projectResponse.status === 200, projectResponse.status);
projectResponse = await call("DELETE", `/api/admin/projects/${project.id}`);
check("delete project", projectResponse.status === 200, projectResponse.status);
check("deleted project disappears publicly", (await fetch(base + "/api/public/projects/" + projectBody.slug)).status === 404);

check("cross-origin POST refused (403)", (await fetch(base + "/api/admin/media/folders", { method: "POST", headers: { ...H, origin: "https://evil.example" }, body: JSON.stringify({ name: "x" }) })).status === 403);

console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
