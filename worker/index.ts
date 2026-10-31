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
import { widgetRoutes } from "./admin/widgets";
import { integrationRoutes, refreshEnabledIntegrations } from "./admin/integrations";
import { analyticsRoutes } from "./admin/analytics";
import { publicRoutes } from "./public/site";
import { publicProjectRoutes } from "./public/projects";
import { publicWidgetRoutes } from "./public/widgets";
import { publicIntegrationRoutes } from "./public/integrations";
import { publicAnalyticsRoutes } from "./public/analytics";
import { guestbookAdminRoutes } from "./admin/guestbook";
import { publicGuestbookRoutes } from "./public/guestbook";
import { announcementRoutes } from "./admin/announcements";
import { publicAnnouncementRoutes } from "./public/announcements";
import { seoRoutes, loadSeoSettings } from "./admin/seo";
import { mediaPublicRoutes } from "./public/media";
import { goRoutes, publicLinkRoutes } from "./public/links";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  if (!c.res.headers.has("referrer-policy")) c.header("Referrer-Policy", c.req.path.startsWith("/api/admin") ? "no-referrer" : "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  if (new URL(c.req.url).protocol === "https:") c.header("Strict-Transport-Security", "max-age=15552000");
  const type = c.res.headers.get("content-type") ?? "";
  if (type.includes("text/html") && !c.res.headers.has("content-security-policy")) {
    c.header("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self' data: https:; connect-src 'self'; upgrade-insecure-requests");
  }
});

// Basic CSRF defence on top of SameSite=Strict: a browser POST from another origin is refused.
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin) {
      let requestOrigin = "";
      try { requestOrigin = new URL(origin).origin; } catch { return apiError(c, 403, "bad_origin", "Cross-origin request refused."); }
      if (requestOrigin !== new URL(c.req.url).origin) return apiError(c, 403, "bad_origin", "Cross-origin request refused.");
    }
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
app.route("/api/admin", widgetRoutes);
app.route("/api/admin", integrationRoutes);
app.route("/api/admin", analyticsRoutes);
app.route("/api/admin", guestbookAdminRoutes);
app.route("/api/admin", announcementRoutes);
app.route("/api/admin", seoRoutes);

app.route("/api/public", publicRoutes);
app.route("/api/public", publicProjectRoutes);
app.route("/api/public", publicWidgetRoutes);
app.route("/api/public", publicIntegrationRoutes);
app.route("/api/public", publicAnalyticsRoutes);
app.route("/api/public", publicGuestbookRoutes);
app.route("/api/public", publicAnnouncementRoutes);
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

  if (path === "/robots.txt") {
    const seoSettings = await loadSeoSettings(env.DB);
    const body = seoSettings.indexingEnabled
      ? "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: " + url.origin + "/sitemap.xml\n"
      : "User-agent: *\nDisallow: /\n";
    return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
  }
  if (path === "/sitemap.xml") {
    const seoSettings = await loadSeoSettings(env.DB);
    if (!seoSettings.indexingEnabled) return new Response("Not found", { status: 404, headers: { "x-robots-tag": "noindex", "cache-control": "no-store" } });
    const [pages, projects] = await Promise.all([
      env.DB.prepare("SELECT slug FROM pages WHERE status='published' AND visibility='public' AND indexable=1 ORDER BY slug").all<{slug:string}>(),
      env.DB.prepare("SELECT slug FROM projects WHERE visible=1 AND status!='archived' ORDER BY slug").all<{slug:string}>(),
    ]);
    const locations = [url.origin + "/", url.origin + "/links", url.origin + "/projects", url.origin + "/guestbook", ...pages.results.map(x => url.origin + "/" + x.slug), ...projects.results.map(x => url.origin + "/projects/" + x.slug)];
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + locations.map(loc => "  <url><loc>" + escapeXml(loc) + "</loc></url>").join("\n") + "\n</urlset>";
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
  }

  // 1. Built static files (JS, CSS, images).
  const asset = await env.ASSETS.fetch(req.raw);
  // 304 (browser revalidating a cached file) is not "ok" but is still a hit; without this a refresh gets the HTML shell instead of the CSS/JS.
  if (asset.ok || asset.status === 304) return asset;

  // 2. Decide which shell, if any.
  const adminPath = normalizeAdminPath(env.ADMIN_PATH);
  const isAdmin = adminPath !== null && (path === adminPath || path.startsWith(adminPath + "/"));
  const isPublic = !isAdmin && (path === "/" || path === "/links" || path === "/projects" || path === "/guestbook" || (path.startsWith("/projects/") ? await publicProjectExists(env, path.slice("/projects/".length)) : await publicPageExists(env, path)));
  const status = isAdmin || isPublic ? 200 : 404;

  // 3. Serve the HTML shell. Wrong admin paths and unknown paths take the exact same branch (status 404).
  const seoSettings = await loadSeoSettings(env.DB);
  const shell = await env.ASSETS.fetch(new Request(new URL("/index.html", url)));
  if (!shell.ok) return new Response("Frontend not built. Run: npm run build:web", { status: 500 });
  let pageTitle = seoSettings.siteTitle;
  let pageDescription = seoSettings.siteDescription;
  let indexable = isPublic && seoSettings.indexingEnabled;
  if (isPublic && path.startsWith("/projects/")) {
    const project = await env.DB.prepare("SELECT name,description FROM projects WHERE slug=? AND visible=1 AND status!='archived'").bind(path.slice("/projects/".length)).first<{name:string;description:string|null}>();
    if (project) { pageTitle = project.name; pageDescription = project.description ?? pageDescription; }
  } else if (isPublic && !["/","/links","/projects","/guestbook"].includes(path)) {
    const page = await env.DB.prepare("SELECT title,meta_title,meta_description,indexable FROM pages WHERE slug=? AND status='published' AND visibility='public'").bind(path.slice(1)).first<{title:string;meta_title:string|null;meta_description:string|null;indexable:number}>();
    if (page) { pageTitle = page.meta_title || page.title; pageDescription = page.meta_description || pageDescription; indexable = indexable && !!page.indexable; }
    else indexable = false;
  }
  const robots = indexable ? "index,follow" : "noindex,nofollow";
  const meta = isAdmin
    ? '<meta name="3w-shell" content="admin"><meta name="3w-base" content="' + escapeAttr(adminPath!) + '">'
    : '<meta name="3w-shell" content="public"><meta name="description" content="' + escapeAttr(pageDescription) + '"><meta property="og:title" content="' + escapeAttr(pageTitle) + '"><meta property="og:description" content="' + escapeAttr(pageDescription) + '">';
  const html = (await shell.text()).replace('<meta name="robots" content="noindex" />', '<meta name="robots" content="' + robots + '" />').replace("<title>3ellwa.space</title>", "<title>" + escapeHtml(pageTitle) + "</title>").replace("<!--SHELL_BOOT-->", meta);
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "x-content-type-options": "nosniff",
    "referrer-policy": isAdmin ? "no-referrer" : "strict-origin-when-cross-origin",
    "cache-control": isAdmin ? "no-store" : "public, max-age=0, must-revalidate",
  });
  if (isAdmin) {
    headers.set("x-robots-tag", "noindex, nofollow");
    headers.set("x-frame-options", "DENY");
  } else {
    headers.set("x-robots-tag", indexable ? "index, follow" : "noindex, nofollow");
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
function escapeHtml(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeXml(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\x27/g, "&apos;"); }

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env) {
    const result = await refreshEnabledIntegrations(env.DB, controller.scheduledTime);
    console.log(JSON.stringify({ event: "integration_refresh_complete", cron: controller.cron, ...result }));
  },
} satisfies ExportedHandler<Env>;
