# API CONTRACT
All JSON. Admin routes need a valid session cookie. Errors look like { "error": { "code": string, "message": string } }. Writes are validated with zod.

## Public (no auth, published data only)
- GET /api/health: { ok, db }, used to verify a deploy (implemented in 1.5)
- GET /api/public/site: profile, active theme tokens, navigation, site settings
- GET /api/public/pages/:slug: page with published sections (use "home" for the homepage)
- GET /api/public/links: visible, in-schedule links grouped by category
- GET /api/public/projects and /api/public/projects/:slug
- GET /api/public/widgets/:id/data: cached widget data
- GET /api/public/announcements
- GET and POST /api/public/guestbook (POST rate limited and moderated)
- GET /go/:linkId: records the click, then redirects safely
- POST /api/public/hit: page view event
- GET /media/:assetId/:name: file from R2
- GET /robots.txt and /sitemap.xml: generated from settings

## Auth (implemented and tested in 1.5)
- POST /api/auth/password: { password } returns { challengeId, expiresInSeconds } after sending the code to Discord. With DISABLE_OTP=true it sets the session and returns { authenticated: true } instead. Errors: 401 invalid_credentials, 429 locked (Retry-After header, retryAfterSeconds), 502 discord_unavailable, 500 not_configured.
- POST /api/auth/code: { challengeId, code (8 digits), trustDevice? } sets the session cookie, returns { authenticated: true }. Errors: 401 invalid_code (triesLeft) or code_expired, 429 locked.
- POST /api/auth/logout: deletes the session row and clears the cookie
- GET /api/auth/me: { authenticated: boolean }
- Cross-origin non-GET requests under /api are refused with 403 bad_origin.
- GET /api/admin/ping: returns { ok: true } with a session, 401 without (placeholder to prove the guard; all /api/admin/* needs a session).

## Part 2.5 (implemented)
- GET /api/public/site: { profile, social, navigation, site }. Empty DB returns empty defaults.
- GET /media/:assetId/:name
- Admin: GET and PUT /api/admin/profile; GET, POST /api/admin/social-links; PUT /social-links/order { ids }; PUT, DELETE /social-links/:id; same shape for /api/admin/navigation; GET /api/admin/media; POST /api/admin/media/upload (multipart: file, purpose=avatar|banner; 400 no_file, 413 too_large, 415 bad_type); DELETE /api/admin/media/:id. List endpoints return { items }.

## Admin (/api/admin/...)
Standard CRUD plus search, filter, sort, and reorder where noted:
- profile: GET, PUT; social links CRUD
- links and link-categories: CRUD, duplicate, reorder, bulk edit, import, export, stats, qr
- pages and page sections: CRUD, duplicate, reorder, save draft, publish, discard draft
- projects (with links and gallery): CRUD, duplicate, reorder
- widgets and widget settings: CRUD, enable and disable, reorder, test refresh
- integrations: list, save credentials (write-only), test connection, status
- themes and theme settings: CRUD, duplicate, activate, import, export, draft, publish
- navigation: CRUD, reorder
- media and folders: upload, list, rename, move, replace, delete
- analytics: summary, timeseries, top pages, top links, referrers, devices, export, purge
- announcements and guestbook moderation: CRUD, approve, delete
- site-settings: GET, PUT (SEO, privacy, robots, maintenance, retention)
- publish: POST /api/admin/publish, GET /api/admin/publish/history
- domains: Part 10

## Links (Part 3)
Public:
- GET /api/public/links -> { groups: [{ id, name, description, color, links: [{ id, title, description, icon, imageUrl, color, background, badge, hoverAnimation, newTab, featured, href }] }], featured: [...], total }. Only enabled, visible, in-schedule links in visible categories. href is always /go/:id.
- GET /go/:linkId -> 302 to the destination (cache-control no-store, no cookies) and records a click; 404 page for unknown, disabled, hidden, not-yet-published, expired, or unsafe links. HEAD redirects but is not counted. Other methods and /go/a/b -> 404.
- GET /links -> public shell with status 200.

Admin (session required; JSON; errors { error: { code, message, field? } }):
- GET /api/admin/links -> { items: [link], categories: [category] }. link = { id, categoryId, title, url, description, icon, imageAssetId, imageUrl, color, background, badge, hoverAnimation (none|lift|scale|glow|shine), openNewTab, featured, visible, enabled, publishAt, expiresAt (ISO or null), sortOrder, createdAt, updatedAt, clicksTotal, clicks7d, status (live|scheduled|expired|disabled|hidden) }.
- POST /api/admin/links -> 201 { item }; PUT /api/admin/links/:id -> { item } (full body, same shape as POST: title, url required); DELETE /api/admin/links/:id -> { ok }.
- POST /api/admin/links/:id/duplicate -> 201 { item, items, categories } (copy lands after the original, starts with zero clicks).
- PUT /api/admin/links/order { ids } -> { items, categories }.
- POST /api/admin/links/bulk { ids (1-200), action: enable|disable|show|hide|feature|unfeature|delete|category, categoryId? } -> { items, categories }.
- GET /api/admin/links/export -> { version: 1, categories, links } (download). POST /api/admin/links/import (same shape; max 500 links) -> 201 { items, categories, imported: { links, categoriesCreated } } or 400 import_invalid { errors: [...] } with nothing changed.
- GET /api/admin/links/:id/stats -> { total, uniqueVisitors, lastClickAt, last7, last30, daily: [{ date, count }] x30 }.
- GET, POST /api/admin/link-categories; PUT /link-categories/order { ids }; PUT, DELETE /link-categories/:id. All return { items }. A category is { id, name, description, color, visible, sortOrder, linkCount }; deleting one keeps its links (uncategorized).
- POST /api/admin/media/upload now also accepts purpose=link (1 MB).

## Media library (Part 4, checkpoint 1)
All admin routes. An asset is { id, filename, name, mimeType, sizeBytes, width, height, altText, folderId, url, createdAt, updatedAt, usedCount }. filename is what is in the URL (may carry a cache tag like ~a1b2c3); name is the same without the tag.
- GET /api/admin/media?q=&folder=all|none|<id>&sort=newest|oldest|name|size|used&limit=(1-500, default 200) -> { items, totalAssets, totalBytes }. q matches name and alt text; % and _ are literal.
- POST /api/admin/media/upload (multipart: file, purpose=avatar|banner|link|library, optional folderId, alt) -> 201 { asset }. Limits: avatar 2 MB, banner 5, link 1, library 8. Errors: 400 no_file / invalid_form / bad_folder, 413 too_large, 415 bad_type. Width and height come from the file bytes.
- PUT /api/admin/media/:id { name?, altText? (null clears), folderId? (null = unfiled) } -> { asset }. Rename keeps the real extension and cache tag.
- POST /api/admin/media/:id/replace (multipart: file) -> { asset }. Same id, new bytes, new URL (new cache tag). 404, 413, 415 as above.
- GET /api/admin/media/:id/usage -> { usage: [{ type: profile|link|page|project|gallery|section, label, id? }] }.
- DELETE /api/admin/media/:id -> { ok }. References are cleared (gallery rows are removed).
- POST /api/admin/media/bulk { action: "move", ids (1-100), folderId|null } or { action: "delete", ids } -> { ok, count }.
- GET /api/admin/media/folders -> { items: [{ id, name, createdAt, assetCount }] }. POST (201) / PUT /:id { name } / DELETE /:id all return { items }. 409 folder_exists on a duplicate name, 400 too_many_folders at 50.


## Projects showcase (Part 4, checkpoint 3)
Public:
- GET /api/public/projects -> { items } ordered featured first, then saved order. Only visible, non-archived projects are returned.
- GET /api/public/projects/:slug -> { item } with details, custom links, and gallery. Hidden, archived, or unknown projects return 404.
- GET /projects and /projects/:slug -> public frontend shell routes.

Admin (session required):
- GET /api/admin/projects -> { items } including hidden projects.
- POST /api/admin/projects -> 201 { item }; PUT /api/admin/projects/:id -> { item }. Both accept a full project: name, slug, description, logoAssetId, coverAssetId, websiteUrl, githubUrl, technologies, category, status (idea|active|paused|finished|archived), startedOn, featured, visible, links [{ label, url }], gallery [{ assetId, caption }].
- POST /api/admin/projects/:id/duplicate -> 201 { item }. Copy is hidden and unfeatured.
- PUT /api/admin/projects/order { ids } -> { items }.
- DELETE /api/admin/projects/:id -> { ok }. Child links and gallery rows cascade.
- Project slugs are unique across projects and custom pages; "projects" is reserved for the built-in directory. Images are referenced by media asset id, not URL.


## Widgets (Part 7 checkpoint 1)

Admin routes require the owner session:
- GET /api/admin/widgets -> { items } in saved order. Each item includes id, type, name, enabled, displayMode, visibleDesktop, visibleMobile, refreshSeconds, config, cacheUpdatedAt, lastError and sortOrder.
- POST /api/admin/widgets -> 201 { item }. Body: { name, type (text|clock|countdown|quote|github|minecraft), integrationId (required for github/minecraft), enabled, displayMode (card|inline), visibleDesktop, visibleMobile, refreshSeconds (60-86400), config }. Config is type-specific: text { text }, clock { timezone, label }, countdown { targetAt (ISO datetime), label }, quote { text, author }; github {}; minecraft {}. GitHub and Minecraft widgets require integrationId to reference an enabled integration with status ok.
- PUT /api/admin/widgets/:id -> { item }, same body as create.
- PUT /api/admin/widgets/order { ids } -> { items }.
- POST /api/admin/widgets/:id/duplicate -> 201 { item }; duplicate is disabled by default.
- POST /api/admin/widgets/:id/test-refresh -> { ok, item }. Records a test-refresh timestamp for the widget itself; connected provider data is refreshed through the Integrations screen test action and hourly background refresh.
- DELETE /api/admin/widgets/:id -> { ok }.
- Invalid timezone or type-specific config returns 400 invalid_widget_config.

Public:
- GET /api/public/widgets/:id/data -> { widget } for enabled widgets only; disabled and unknown widgets both return 404. The response contains only display-safe configuration, not integration credentials. For GitHub/Minecraft widget types, it also includes integrationData from the matching enabled, successfully tested integration cache.
- Public homepage layout sections of type widget use widgetId to render the selected widget.
- Built-in widget rendering: text, clock, countdown, quote, GitHub profile, and Minecraft server status. Widget visibility on desktop/mobile is controlled by its homepage layout section and the widget's own visibility settings.
- Third-party provider data is described below. No OAuth/private credentials are collected in this phase.


## Integrations (Part 7 checkpoint 2)

Admin (session required):
- GET /api/admin/integrations -> { items } for configured integrations. Each item contains id, provider, enabled, config, status, lastCheckedAt, lastError and cacheUpdatedAt. No credentials are returned.
- PUT /api/admin/integrations/github { enabled, config: { username } } -> { item }. Username is validated and must be a public GitHub account name.
- PUT /api/admin/integrations/minecraft { enabled, config: { address } } -> { item }. Address accepts a hostname with optional port, not a URL.
- POST /api/admin/integrations/:provider/test -> { ok, item, preview }. Server-side fetches use fixed provider endpoints and a timeout; successful responses are normalized and cached in config_json. A failed refresh records lastError while preserving the previous successful snapshot when one exists.
- Supported providers currently: github, minecraft. No OAuth/private credentials are collected or stored for these public-data providers.

Public:
- GET /api/public/integrations/:provider/data -> { provider, data, updatedAt } only when the integration is enabled and has a successful cached result. Disabled, unconfigured, uncached, or unknown integrations return 404. A transient refresh failure does not hide an existing successful cache.
- Public snapshots contain only normalized profile or server-status fields. Provider settings and credentials are never included.


## Scheduled integration refresh (Part 7 checkpoint 4)

- Cloudflare Cron Trigger: `0 * * * *` (hourly, UTC).
- The Worker's scheduled handler refreshes only enabled GitHub and Minecraft integrations, sequentially, using fixed provider endpoints and a seven-second request timeout.
- Successful refreshes replace the normalized public snapshot and update `cacheUpdatedAt`.
- A failed refresh records `lastError` and the last attempt time. If a previous successful cache exists, its status remains usable and the stale snapshot stays public; the freshness timestamp continues to reflect the last successful refresh.
- Public integration data and GitHub/Minecraft widgets include the last successful snapshot timestamp. Widgets display its age.
- Disabled integrations are not fetched by the scheduled handler.


## Guestbook (Part 8 checkpoint 2)

Public:
- GET /api/public/guestbook -> { items } containing the latest 50 approved entries only.
- POST /api/public/guestbook { name, message, website? } -> 202 { ok, message }. Entries are pending until approved. Name is limited to 50 characters; message to 500. A hidden honeypot is used for basic bot filtering, and each IP hash is limited to three submissions per hour. Raw IP addresses are not stored.
- GET /guestbook -> public guestbook page and submission form. New entries are not shown until moderation.

Admin (session required):
- GET /api/admin/guestbook?status=pending|approved|rejected|all -> { items } (up to 200).
- PUT /api/admin/guestbook/:id/status { status: pending|approved|rejected } -> { ok }.
- DELETE /api/admin/guestbook/:id -> { ok }.
- Admin navigation: Guestbook. Approving publishes an entry; rejecting or leaving pending keeps it private.

## Announcements (Part 8 checkpoint 2)

Admin (session required):
- GET /api/admin/announcements -> { items }.
- POST /api/admin/announcements and PUT /api/admin/announcements/:id accept { title, body, style: info|success|warning, visible, startsAt, endsAt } and return { item }. Dates are ISO strings or null. End time must be later than start time.
- DELETE /api/admin/announcements/:id -> { ok }.

Public:
- GET /api/public/announcements -> { items } containing up to three currently active, visible announcements. Start/end windows are enforced server-side.
- Active announcements render across public routes. Hidden, scheduled, and expired announcements are not exposed.
