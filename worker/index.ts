import { Hono } from "hono";
import type { AppEnv, Env } from "./env";
import { authRoutes } from "./auth/routes";
import { requireSession } from "./auth/session";
import { apiError, normalizeAdminPath } from "./lib/http";
import { profileRoutes } from "./admin/profile";
import { navigationRoutes } from "./admin/navigation";
import { mediaAdminRoutes } from "./admin/media";
import { linkRoutes } from "./admin/links";
import { pageRoutes } from "./admin/pages";
import { projectRoutes } from "./admin/projects";
import { themeRoutes } from "./admin/themes";
import { layoutRoutes } from "./admin/layout";
import { publishRoutes } from "./admin/publish";
import { publicRoutes } from "./public/site";
import { publicProjectRoutes } from "./public/projects";
import { mediaPublicRoutes } from "./public/media";
import { goRoutes, publicLinkRoutes } from "./public/links";

const app = new Hono<AppEnv>();

// Basic CSRF defence on top of SameSite=Strict: a browser POST from another origin is refused.
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return apiError(c, 403, "bad_origin", "Cross-origin request refused.");
  }
  await next();
});

app.get("/api/health", async (c) => {
  c.header("Cache-Control", "no-store");
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ ok: true, db: true });
  } catch {
    return c.json({ ok: false, db: false }, 500);
  }
});

app.route("/api/auth", authRoutes);

app.use("/api/admin/*", requireSession);
app.get("/api/admin/ping", (c) => c.json({ ok: true }));
app.route("/api/admin", profileRoutes);
app.route("/api/admin", navigationRoutes);
app.route("/api/admin", mediaAdminRoutes);
app.route("/api/admin", linkRoutes);
app.route("/api/admin", pageRoutes);
app.route("/api/admin", projectRoutes);
app.route("/api/admin", themeRoutes);
app.route("/api/admin", layoutRoutes);
app.route("/api/admin", publishRoutes);

app.route("/api/public", publicRoutes);
app.route("/api/public", publicProjectRoutes);
app.route("/api/public", publicLinkRoutes);
app.route("/go", goRoutes);
app.route("/media", mediaPublicRoutes);

app.all("/api/*", (c) => apiError(c, 404, "not_found", "Not found."));

// Everything else: static files, the public shell, the admin shell, or the normal 404.
app.all("/go/*", () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } }));

app.all("*", async (c) => {
  const { req, env } = c;
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";

  // 1. Built static files (JS, CSS, images).
  const asset = await env.ASSETS.fetch(req.raw);
  // 304 (browser revalidating a cached file) is not "ok" but is still a hit; without this a refresh gets the HTML shell instead of the CSS/JS.
  if (asset.ok || asset.status === 304) return asset;

  // 2. Decide which shell, if any.
  const adminPath = normalizeAdminPath(env.ADMIN_PATH);
  const isAdmin = adminPath !== null && (path === adminPath || path.startsWith(adminPath + "/"));
  const isPublic = !isAdmin && (path === "/" || path === "/links" || path === "/projects" || (path.startsWith("/projects/") ? await publicProjectExists(env, path.slice("/projects/".length)) : await publicPageExists(env, path)));
  const status = isAdmin || isPublic ? 200 : 404;

  // 3. Serve the HTML shell. Wrong admin paths and unknown paths take the exact same branch (status 404).
  const shell = await env.ASSETS.fetch(new Request(new URL("/index.html", url)));
  if (!shell.ok) return new Response("Frontend not built. Run: npm run build:web", { status: 500 });
  const meta = isAdmin
    ? `<meta name="3w-shell" content="admin"><meta name="3w-base" content="${escapeAttr(adminPath!)}">`
    : `<meta name="3w-shell" content="public">`;
  const html = (await shell.text()).replace("<!--SHELL_BOOT-->", meta);
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "x-content-type-options": "nosniff",
    "referrer-policy": isAdmin ? "no-referrer" : "strict-origin-when-cross-origin",
    "cache-control": isAdmin ? "no-store" : "public, max-age=0, must-revalidate",
  });
  if (isAdmin) {
    headers.set("x-robots-tag", "noindex, nofollow");
    headers.set("x-frame-options", "DENY");
  }
  return new Response(req.method === "HEAD" ? null : html, { status, headers });
});

async function publicProjectExists(env: Env, slug: string): Promise<boolean> {
  try {
    if (!slug || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
    return !!await env.DB.prepare("SELECT 1 FROM projects WHERE slug=? AND visible=1 AND status!='archived'").bind(slug).first();
  } catch { return false; }
}

async function publicPageExists(env: Env, path: string): Promise<boolean> {
  try {
    const slug = path.replace(/^\/+/, "");
    if (!slug || slug.length > 120 || slug.includes("//")) return false;
    const row = await env.DB.prepare(
      "SELECT 1 AS ok FROM pages WHERE slug = ? AND status = 'published' AND visibility = 'public'"
    ).bind(slug).first();
    return row !== null;
  } catch {
    return false;
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default app;
