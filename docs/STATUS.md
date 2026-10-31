# STATUS

## Current authentication implementation (2026-10-31)
The current Worker auth code uses a plain `ADMIN_PASSWORD` followed by mandatory Discord webhook OTP (`DISCORD_AUTH_WEBHOOK_URL`). It does not require `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, or `DISABLE_OTP`. Session and challenge digests use SHA-256; the existing D1 sessions/challenges/attempts tables remain in use. The local route test scripts now start a fake Discord webhook on 127.0.0.1:9999 and exercise the password + OTP flow. These source changes have been committed to GitHub; typecheck, local Worker tests, and live Cloudflare deployment have not yet been run for this auth revision.

Update this file at the end of every part. It is the first thing a new chat reads after PROJECT.md.

## Done
- Part 1: architecture, schema (migrations/0001_init.sql, 25 tables), API contract, docs system, prompt pack, password hash script.
- Part 1.5 (first half of Part 2): project scaffold and the whole auth backend.
  - package.json, wrangler.jsonc (D1 binding DB, R2 binding MEDIA, static assets, run_worker_first), TypeScript for worker and web, Vite + React + Tailwind v4 placeholder app (builds clean).
  - migrations/0001_init.sql applied to LOCAL D1 (50 statements, ok).
  - Worker (Hono): /api/health, full auth (password, Discord code, session cookie, lockout, logout, /me, DISABLE_OTP), /api/admin guard, shell routing with identical 404 for unknown and wrong admin paths, security headers on shells.
  - Tested locally with a real `wrangler dev` and a fake Discord: scripts/smoke-test.mjs (10 checks) and scripts/auth-flow-test.mjs (17 checks) all pass, plus DISABLE_OTP and Discord-down (502) checked by hand with curl. `npm run typecheck` and `npm run build:web` pass.

- Part 2 (UI): done and tested in the sandbox.
  - Shared UI (apps/web/src/shared/ui): Button, Input, Card, Modal (native dialog), Toast; api client with typed errors; design tokens in index.css (@theme).
  - Public shell: styled empty-state homepage, 404 page.
  - Admin shell (lazy chunk, never downloaded by public visitors): auth gate via /api/auth/me, login (password, code, trust device, lockout countdown, expired code, Discord error, DISABLE_OTP skip), sidebar with the 14 items (drawer on mobile), empty screens that say which part builds them, logout.
  - 11 UI tests (vitest + jsdom, fetch mocked) pass: `npm run test:web`. Re-ran Worker smoke (10/10) and auth flow (17/17) with the new build. Bundle scan: no admin path, secret, or hash in apps/web/dist.

- Part 2.5 (profile, public site, navigation): built and tested in the sandbox.
  - Worker: GET /api/public/site (defaults on empty DB), admin profile GET/PUT, social links CRUD + order, navigation CRUD + order, media upload/list/delete (PNG/JPEG/WebP/GIF by magic bytes, avatar 2 MB, banner 5 MB, SVG refused), GET /media/:id/:name (immutable cache, ETag, nosniff).
  - Admin: Profile screen (all schema fields, images with upload/pick/replace/remove, badges, social links, unsaved-changes guard, toasts) and Navigation screen. Global 401 handler returns to login.
  - Public homepage: profile card, menu, typing/rotating subtitle (static with reduced motion), local time, empty/loading/error states.
  - Bug fixed from Part 2: Worker treated a 304 on cached CSS/JS as "not found" and served the HTML shell, so a browser refresh gave a blank page. Regression check added to scripts/smoke-test.mjs.
  - Checks run: typecheck, 31 UI tests (`npm run test:web`), smoke-test (12/12), scripts/part25-test.mjs (43/43, real `wrangler dev` with local D1/R2), and a Chromium run of the whole flow (login, edit, upload, public page at 1280 and 375 px, no console errors).

- Part 3 (links manager, /go tracking, public /links): built and tested in the sandbox.
  - Worker: admin links CRUD, duplicate, global reorder, bulk (enable/disable/show/hide/feature/unfeature/category/delete), categories CRUD + reorder, export, atomic validated import, per-link stats (total, 7/30 days, unique visitors, 30-day daily trend); GET /go/:linkId (counts, then 302; refuses disabled, hidden, unscheduled, expired, unknown, and unsafe destinations; no cookies; HEAD not counted); GET /api/public/links (grouped by category, featured list, hides raw URLs behind /go); /links served as a public shell with status 200; media upload accepts purpose=link (1 MB).
  - Admin Links screen (replaces the EmptyScreen): search, status and category filters, select all, bulk bar, dnd-kit drag reorder (mouse, touch via pointer events, keyboard), add/edit editor with live preview (icon, custom image, colors, badge, hover animation, new tab, featured, visible, enabled, publish/expiry), duplicate, copy tracked link or destination, QR code (SVG download, tracked or direct), click statistics, categories manager, import and export dialogs.
  - Public: /links page (grouped, empty and error states) and a homepage links section (featured links, or the first few). Hover animations (lift, scale, glow, shine) respect reduced motion.
  - Checks run: typecheck, 51 UI tests (`npm run test:web`), smoke (all pass), part25 (all pass), `node scripts/part3-test.mjs` (87 checks, real `wrangler dev` with local D1, run twice incl. on a non-empty DB), poisoned-row redirect check (rows with javascript:, data:, relative URLs inserted straight into D1 return 404 from /go), and a Chromium run (login, add via UI, javascript: refused in the editor, image upload, mouse drag and keyboard drag both persist after refresh, scheduling, QR, stats, search, export download, import error display, public pages at 1280 and 375 px, no horizontal scroll, click counted).

- Part 4, checkpoint 1 (media library): WRITTEN, NOT RUN. See "Part 4 checkpoint 1: what was and was not verified" below.
  - Worker: GET /media (search, folder, sort, limit; usage counts), folders CRUD (one level), PUT /media/:id (rename, alt text, move), POST /media/:id/replace (keeps the id), GET /media/:id/usage, POST /media/bulk (move, delete), upload purpose=library (8 MB, folder, alt, real width/height read from the bytes). Avatar, banner, and link uploads behave as before.
  - Admin: Media Library screen (grid, search, sort, folders, drag-and-drop and multi-file upload, select and bulk move/delete, detail dialog with rename, alt text, folder, usage list, replace, copy address, crop/compress, delete with an "in use" warning). Image editor (crop by dragging with a zoom slider, aspect presets, max size, format, quality; GIFs are never re-encoded). Reusable MediaPicker, already used by the profile and link image fields ("Pick existing").
  - Checkpoint 1 (Media Library): implemented, not run. Includes folders, upload/replace/delete, crop/compress, usage warnings, and reusable MediaPicker.
  - Checkpoint 2 (custom pages): implemented, not run. Includes Pages manager and block editor, public page rendering, metadata/noindex handling, gallery image picker, page targets in navigation, and draft privacy.
  - Checkpoint 3 (projects): implemented, not run. Includes project CRUD, duplicate, reorder, status/category/technologies, logo and cover images, gallery, website/GitHub/custom links, featured and visibility controls, public /projects directory and /projects/:slug details.
  - Project and custom-page slugs are checked against each other; /projects is reserved. Media usage includes project logos, covers, and gallery images.
  - All Part 4 checkpoints are committed but not typechecked, locally tested, browser-tested, or deployed from this environment.

## In progress
- Owner walkthrough (still not run): GitHub repo, Cloudflare account, D1 and R2 creation, secrets, remote migration, first deploy. Nothing of this has been run yet.

## Next
- Verify Part 4 locally: npm install, npm run typecheck, npm run test:web, then run the local Worker with migrated D1/R2 and execute npm run test:part4. The test needs the fake Discord webhook on 127.0.0.1:9999 and a local ADMIN_PASSWORD; Discord OTP remains mandatory.
- Browser-check the Pages, Media Library, Projects screens and public /projects pages on desktop and mobile.
- Then continue the owner walkthrough and acceptance on the deployed Cloudflare site.

## Part 4 verification status: what was and was not verified
This chat's sandbox had no network, so npm install was impossible: no Hono, zod, React, Vitest, Vite, or Wrangler. The Part 4 checkpoint 1, 2, and 3 changes therefore remain unverified by typecheck, jsdom tests, or a local Worker run.
- Verified here: image-size reading (PNG, JPEG incl. progressive, GIF, WebP lossy, lossless, extended) against real files made with Pillow; filename tag helpers; the crop and resize geometry (all pass in plain Node); every new or changed .ts/.tsx file parses (syntax check only).
- Written but never run: Part 4 media, pages, projects, and public showcase Worker routes; all Part 4 React components; scripts/part4-test.mjs (now includes media, pages, navigation, and projects regression checks).
- Owner steps, in this order, from the repo folder:
  1. Run `npm install`, then `npm run typecheck`. Fix any reported errors before moving on; this work has not been typechecked yet.
  2. Run `npm run test:web` and resolve any failures.
  3. Set local `.dev.vars` with `ADMIN_PASSWORD` and `DISCORD_AUTH_WEBHOOK_URL=http://127.0.0.1:9999/hook`, run `npm run dev`, then `node scripts/part4-test.mjs http://localhost:8787 "your test password"`. Re-run `node scripts/part25-test.mjs` and `node scripts/part3-test.mjs` to check regressions. OTP stays mandatory.
  4. In a real browser, open Media Library and test upload/crop/replace/usage warnings; create and publish a page with a gallery block; create a project with logo, cover, gallery, links, and technologies; verify it appears on /projects and its detail route; test hidden projects and mobile layouts.
- Known risks to look at first: the native <dialog> stacking (detail dialog under the editor or delete confirmation), createImageBitmap/canvas WebP encoding in Safari (the editor shows a clear error if WebP is unsupported; pick JPEG then), and pointer-drag cropping on touch.

## Not tested yet (needs the owner)
- Anything on real Cloudflare: remote D1/R2, `wrangler secret put`, a real Discord webhook, HTTPS cookie name (__Host-3w_session), the deployed 404 behavior. The smoke test and the manual checks in prompts/part-02b.md cover these.
- The UI in a real browser: no browser was available in the sandbox, so layout, the mobile drawer, the native <dialog> Modal, and visual polish are untested visually. Logic is covered by jsdom tests only. Owner should open the site on desktop and phone and report anything off.
- Modal has no test (jsdom lacks dialog.showModal) and nothing uses it yet.

## Part 3 notes for the owner
- Touch drag is wired through pointer events on the drag handle (touch-action: none). It was not tried on a real phone: please try reordering once on your phone.
- The sandbox has no internet, so the final hop to the real destination (example.com) could not load; the 302 and the click count were verified.
- Redirect-time URL re-check is covered by hand-inserted rows (see above). There is no automated script for that part because it needs direct DB access.

## Known issues and notes
- Part 3: a homepage with no profile content but with links still shows the "being set up" empty state (the links section only renders under a profile). Revisit with the layout editor (Part 6).
- Part 3: link images now come from the media library picker. Deleting a link leaves its image in the library (visible there, "Not used anywhere yet").
- Part 3: password-protected destinations, custom redirect routes (links.slug), and link preview cards exist in the schema or spec as optional extras and are not built. links.password_hash and links.slug are unused.
- Part 3: links are public via /go/:id only (ids are random, unguessable but not secret). Click counts per link include only GET requests; bots and link previewers that GET the URL are counted. Bot filtering belongs to Part 8 analytics.
- Part 3: pages with the slug "links" or "go" would clash with built-in routes. The Part 4 pages API now reserves both slugs (along with other system paths).
- Part 3: reordering links is global (one order across all links); the public page shows that order within each category. Dragging is disabled while a search or filter is active.
- Part 3: import appends (never replaces) and cannot import images (image ids are not portable). Max 500 links per file, 1000 links and 50 categories in total.
- Last browser run after the avatar/banner race fix was not repeated (server restart trouble in the sandbox); the fix is covered by a UI test. Verify once: upload avatar and banner back to back, Save, refresh the public page.
- Part 2.5 limits: navigation is flat (no sub-menus, parent_id unused); it now supports internal-path/URL and published-page targets. The menu shows on the homepage only; social links render as text pills (no icons); badges are label-only; online mode "auto" is disabled until Part 7; uploaded image width/height are not recorded; reordering uses up/down buttons, not drag and drop (dnd-kit not added yet).
- The unsaved-changes guard covers sidebar links and closing/reloading the tab (BrowserRouter has no blocker); browser Back is not guarded.
- Deleting an image clears every reference to it; the library asks first and lists where it is used. Theme backgrounds (Part 5) must be added to worker/lib/mediaUsage.ts when they store asset ids.
- wrangler.jsonc has database_id REPLACE_WITH_D1_DATABASE_ID. Replace with the real id after `wrangler d1 create` (Part 2 walkthrough). The id is not a secret.
- /robots.txt is not served yet; apps/web/index.html has a static noindex meta. Real settings arrive in Part 8.
- Pages with visibility "hidden" are not served by the Worker (404). Revisit in Part 4 if unlisted-by-link pages are wanted.
- No CSP header yet; Part 9 (hardening) adds it.
- GET /api/public/site and the other public API routes are not built; Part 2.5 starts them (/api/public/site) and Part 3 adds /api/public/links.
- Public page rendering by slug does not exist: the Worker serves the shell for published page slugs but the public router shows the 404 view for anything except "/" until Part 4.
- Admin API 401s after a session expires are not handled globally in the UI yet (screens are empty now); add a shared handler when real admin calls arrive in Part 2.5.
- Local wrangler prints a harmless "ENOTFOUND workers.cloudflare.com" in offline sandboxes.
- TypeScript is v7 (native) as installed by npm; typecheck passes.

## Environment facts
- GitHub repo: not created yet
- Cloudflare account, D1 name, R2 bucket: not created yet. Names already in wrangler.jsonc: D1 "3ellwa-space-db", R2 "3ellwa-space-media", Worker "3ellwa-space".
- Owner machine: Node and npm versions not confirmed yet (sandbox used Node 22).
- Test credentials used locally (.dev.vars, not in repo): throwaway only.
