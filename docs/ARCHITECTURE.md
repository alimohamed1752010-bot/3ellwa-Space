# ARCHITECTURE

## Repo layout
- apps/web: React app. One SPA with two route trees, public and admin (admin lazy-loaded, served only at the secret path).
- worker: Hono API and static asset serving. Folders: routes/public, routes/admin, auth, db, integrations, media, lib.
- migrations: numbered D1 SQL files applied with wrangler d1 migrations apply.
- scripts: helper scripts run on the owner's machine.
- docs and prompts: the handoff system.

## Runtime
Browser to Cloudflare Worker to D1 (data), R2 (files), and external APIs (integrations). Public endpoints return only published data and are cached briefly with the Cache API. Admin endpoints require a valid session.

## Request routing (worker/index.ts)
assets.run_worker_first is true, so the Worker sees every request: /api/* goes to Hono; otherwise it tries a built static file first, then picks a shell. The shell is apps/web/dist/index.html with the placeholder <!--SHELL_BOOT--> replaced by meta tags (3w-shell = admin or public, 3w-base = admin path). The React app reads those tags to choose the public or admin tree. Unknown paths and wrong admin paths take the identical branch: shell body with status 404.
Public paths that serve the shell with 200: "/" and any published page slug found in the pages table (visibility public or password).

## Admin path
The Worker reads ADMIN_PATH and serves the admin app only there. Any other unknown path returns the public 404. The admin shell is sent with no-store, noindex, and frame-deny headers. The admin path never appears in the public HTML or the JS bundle. Admin API calls live under /api/admin and also require the session cookie.

## Frontend structure
- src/public: pages, section renderers, widget components
- src/admin: dashboard screens and editors
- src/shared: api client, shared types and zod schemas, theme engine, UI components
Theme tokens become CSS variables on the document root, so a theme change updates the whole site without a rebuild.

## Config model
Core entities have tables. Flexible config uses JSON columns validated by zod schemas. Every config read has a default so an empty database still renders a sensible site.

## Integrations
Each integration is a module with one interface: fetch(config, credentials) returns normalized data or an error state. Results are cached in the widgets table (cache_json, cache_updated_at) and refreshed on the widget's refresh interval. Failures show error states, never fake data.

## Media
Uploads go through the Worker to R2 with type and size validation. Metadata lives in media_assets. Files are served by a Worker route with cache headers. Cropping and compression happen in the browser before upload.

## Analytics
Events are recorded server-side without cookies. A daily-rotating hash of IP and user agent counts unique visitors. Retention is configurable and old rows are purged on a schedule.

## Backup and recovery
D1 Time Travel for point-in-time restore, plus a scheduled export of the database and an R2 backup prefix. Details belong in the Part 9 guide.
