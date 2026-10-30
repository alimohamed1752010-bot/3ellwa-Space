# 3ellwa.space: all remaining prompts in one file

## How to use

1. Do the parts in order. Parts 1, 1.5, and the UI half of Part 2 are already done.
2. For each part: open a NEW chat, copy ONLY that part's section (from its "START" line to its "END" line), paste it, and upload the latest repo zip listed under it.
3. The assistant reads docs/ first, builds in small checkpoints, and ends by updating docs/STATUS.md and docs/DECISIONS.md and giving you a fresh zip. Keep that zip for the next part.
4. Part 2 (rest) starts with the Cloudflare deploy walkthrough. Do not skip it before Part 2.5 unless you want to keep working only locally.

## Contents

- Part 2 (rest): Part 2 (rest): UI shells, components, first deploy
- Part 2.5: Profile, public site endpoint, navigation
- Part 3: Links manager
- Part 4: Pages, projects, media
- Part 5: Theme engine and appearance
- Part 6: Layout editor with draft and publish
- Part 7: Widgets and integrations
- Part 8: Analytics, guestbook, privacy and SEO, extras
- Part 9: Hardening, deploy guide, backup and recovery
- Part 10: Subdomains and domain management (later)


---

=== START PART 2 (REST) ===  (upload: 3ellwa-space-part2.zip (or newer))

# 3ellwa.space, Part 2 (rest): UI shells, components, first deploy

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect. Upload: the repo zip "3ellwa-space-part1.5.zip" is attached to this chat.

## Read first, in this order
1. docs/PROJECT.md (full specification; design direction is section 2)
2. docs/STATUS.md (Part 1.5 is done; read "Not tested yet" and "Known issues")
3. docs/DECISIONS.md (settled, do not reopen; items 13 to 20 are new)
4. docs/ARCHITECTURE.md (see "Request routing"), docs/SCHEMA.md, docs/API.md, prompts/part-02.md

If a file is missing or contradicts another, say so before writing code.

## Already built and tested locally (do not rebuild)
Scaffold, wrangler.jsonc, Hono Worker, all auth endpoints, lockout, DISABLE_OTP, shell routing with real 404s, scripts/smoke-test.mjs, scripts/auth-flow-test.mjs. Re-run `npm install && npm run typecheck && npm run build:web` first to confirm the zip is healthy.

## Scope of this part
1. Frontend (apps/web/src), replacing the placeholder in main.tsx:
   - main.tsx reads <meta name="3w-shell"> (admin or public) and <meta name="3w-base"> (admin path). Admin tree is lazy-loaded and uses React Router with basename = 3w-base. Public tree is the default.
   - Shared UI in src/shared/ui: Button, Input, Card, Modal, Toast (provider + hook). Dark violet style per PROJECT.md section 2: graphite surfaces, thin borders, restrained violet accent, subtle glass, rounded but not extreme, keyboard accessible, focus rings, reduced-motion respected. Design tokens already exist in src/index.css (@theme); extend them, keep them as CSS variables.
   - src/shared/api.ts: small fetch client (JSON, same-origin, typed error { error: { code, message } }).
   - Public shell: styled empty-state homepage (no hardcoded personal data, neutral wording) and a proper 404 page (the Worker already returns status 404 with the same HTML).
   - Admin shell: auth gate using GET /api/auth/me; login screen with password step, then 8-digit code step with "trust this device"; clear messages for wrong password, wrong code, lockout (show countdown from retryAfterSeconds), expired code, and discord_unavailable; DISABLE_OTP response ({ authenticated: true }) skips the code step. After login: sidebar layout with the 14 navigation items from PROJECT.md section 8 (Overview, Profile, Links, Pages, Widgets, Projects, Integrations, Appearance, Navigation, Media Library, Analytics, Domains, SEO & Privacy, Settings), each an honest empty screen (title + "arrives in Part N" where N matches prompts/README.md), plus logout button. Mobile: sidebar collapses to a drawer.
   - Only wire what exists. No fake buttons.
2. Owner walkthrough (one step at a time, wait for confirmation between steps): install Node/Git check, git init and first commit, GitHub repo and push, Cloudflare account, `npx wrangler login`, `wrangler d1 create 3ellwa-space-db` and put the real id in wrangler.jsonc, `wrangler r2 bucket create 3ellwa-space-media`, run `node scripts/hash-password.mjs "long passphrase"`, create the Discord webhook in a private channel, set secrets with `wrangler secret put` (ADMIN_PATH, ADMIN_PASSWORD_HASH, DISCORD_AUTH_WEBHOOK_URL, SESSION_SECRET, optionally ENCRYPTION_KEY), `npm run db:migrate:remote`, `npm run deploy`, then run the smoke test against the workers.dev URL. Custom domain 3ellwa.space can be attached at the end if the owner wants (Workers > Settings > Domains and Routes); walk through it only if asked.
3. Update docs.

## Out of scope
Everything not listed. Note needs in docs/STATUS.md instead of building them. Do not start Part 3 (profile, links, navigation).

## Acceptance checklist
- Owner can deploy to Cloudflare and open the public site.
- Wrong admin path returns the normal 404 (same page as any unknown path).
- Correct password sends a code to Discord; the code logs in; wrong codes and passwords lock out after the limit.
- Session survives refresh and logout works (test in a real browser, owner confirms).
- No secret appears in the repo or the browser bundle (grep dist/ for the admin path and webhook URL; .dev.vars stays untracked).
- On a phone-width viewport the public page and the admin login and shell are usable.

## Working rules
- Small checkpoints. After each one, give a zip of the repo (exclude node_modules, dist, .wrangler, .dev.vars) so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing 0001. Keep docs/SCHEMA.md and docs/API.md accurate.
- You can test the UI in the sandbox with `npm run dev` plus scripts/auth-flow-test.mjs style fake Discord (see that file); real Cloudflare and browser checks are the owner's.

## Before you finish
Update docs/STATUS.md (done, in progress, next = Part 3, known issues, environment facts such as repo URL, D1 id, deployed URL) and docs/DECISIONS.md (new decisions), then deliver the final zip.

=== END PART 2 (REST) ===

---

=== START PART 2.5 ===  (upload: 3ellwa-space-part2.zip (or newer))

# 3ellwa.space, Part 2.5: Profile, public site endpoint, navigation

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect. The repo zip (latest "3ellwa-space-part2.zip" or newer) is attached to this chat.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands, including what is not tested yet)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

Check docs/STATUS.md for whether the first Cloudflare deploy was completed. If not, build and test locally and keep going; note it in STATUS. Run `npm install && npm run typecheck && npm run test:web && npm run build:web` first to confirm the zip is healthy.

## Scope of this part
- Worker: GET /api/public/site (profile, navigation, site defaults; empty database returns sensible defaults, never errors), admin profile endpoints (GET, PUT) and social links CRUD with zod validation, admin navigation CRUD with reorder, and a minimal image upload for avatar and banner (type and size validation, stored in R2, metadata in media_assets, served by GET /media/:assetId/:name with cache headers). The full media library is Part 4; keep this to upload, pick, replace, and serve.
- Admin Profile screen: every field in PROJECT.md section 3 that the schema supports (avatar, banner, display name, username, short and extended bio, animated subtitle, status, online indicator, location, local time toggle, badges), social links manager with reorder, save feedback via toasts, unsaved-changes guard. Profile saves live (DECISIONS item 8).
- Public homepage: replace the empty state with the real profile section (loading, error, and empty states; mobile layout; animated subtitle and typing effect respecting reduced motion). If nothing is configured, show the neutral empty state.
- Admin Navigation screen: create, edit, delete, reorder, show/hide items; targets are internal paths or external URLs. Public navigation renders from /api/public/site.
- Replace the EmptyScreens for Profile and Navigation only.

## Out of scope
The links manager, categories, /go redirects, and the /links page (Part 3). Pages and blocks, full media library, themes, widgets. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Profile edits appear on the public homepage after refresh.
- Avatar and banner upload, show up publicly, and bad file types or oversized files are rejected with a clear message.
- Empty database still renders a sensible public site.
- Navigation edits and order show on the public site; hidden items do not.
- Public API returns only public data (no draft or admin fields); admin routes need a session.
- Mobile layout checked by the owner.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo (exclude node_modules, dist, .wrangler, .dev.vars) so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one (0001 is applied). Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2. Reuse the shared UI in apps/web/src/shared/ui and the api client; keep admin screens inside the admin chunk.
- Tests: add vitest tests for new UI logic and extend scripts for new Worker routes; run typecheck, `npm run test:web`, and the Worker checks before each zip.

## Before you finish
Update docs/STATUS.md (done, in progress, next = Part 3, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip named 3ellwa-space-part2.5.zip.

=== END PART 2.5 ===

---

=== START PART 3 ===  (upload: 3ellwa-space-part2.5.zip (or newer))

# 3ellwa.space, Part 3: Links manager

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect. The repo zip ("3ellwa-space-part2.5.zip" or newer) is attached to this chat.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands, including what is not tested yet)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

Part 2.5 delivered the profile, social links, /api/public/site, navigation, and avatar/banner upload. Reuse its upload route and admin patterns. Run `npm install && npm run typecheck && npm run test:web && npm run build:web` first to confirm the zip is healthy.

## Scope of this part
- Admin Links screen with full CRUD, duplicate, drag-and-drop reorder (dnd-kit), categories (CRUD, reorder, assign), enable/disable, visibility, featured, scheduling (publish and expiry dates), bulk edit, search and filter, import and export (JSON, validated), copy URL, QR codes, and every per-link field in PROJECT.md section 4 that the schema supports (icon, custom image through the existing upload, color, badge, hover animation, open in new tab).
- Click tracking through GET /go/:linkId: record the click without cookies, then redirect safely. Reject unsafe schemes (javascript:, data:, and similar) and malformed URLs on save and again at redirect time. Per-link click stats in the admin (totals and recent trend).
- GET /api/public/links: visible, in-schedule links grouped by category; expired or unscheduled links never appear.
- Public /links page and a links section for the homepage; mobile layout; empty and error states.
- Replace the EmptyScreen for Links only. Public page rendering by slug and the page editor are Part 4; make /links work through the existing public router and Worker routing (note that the Worker must serve the shell for /links with status 200).

## Out of scope
Pages and blocks, full media library, themes, layout editor, widgets, the analytics dashboard (Part 8). If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Every link operation in PROJECT.md section 4 that is in scope works and persists after refresh.
- Clicks are counted; expired or unscheduled links are hidden publicly and /go refuses them.
- Redirects reject unsafe URLs (test javascript:, data:, relative junk, very long URLs).
- Import rejects bad data with clear messages and never half-applies.
- Drag reorder works with mouse, touch, and keyboard.
- Mobile layout checked by the owner.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo (exclude node_modules, dist, .wrangler, .dev.vars) so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one (0001 is applied). Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2. Reuse the shared UI in apps/web/src/shared/ui and the api client; keep admin screens inside the admin chunk.
- Tests: add vitest tests for new UI logic and extend scripts for new Worker routes; run typecheck, `npm run test:web`, and the Worker checks before each zip.

## Before you finish
Update docs/STATUS.md (done, in progress, next = Part 4, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip named 3ellwa-space-part3.zip.

=== END PART 3 ===

---

=== START PART 4 ===  (upload: 3ellwa-space-part3.zip (or newer))

# 3ellwa.space, Part 4: Pages, projects, media

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

Note: Part 2.5 already built a minimal avatar/banner upload, the media_assets rows it writes, and the GET /media/:assetId/:name route. Extend those into the full library; do not rebuild them.

## Scope of this part
- Media library: upload to R2 with type and size validation, folders, rename, replace, delete, preview, search, client-side crop and compression.
- Pages manager and block editor: create, edit, delete, duplicate, change URL, metadata, visibility, add and reorder sections using built-in section types (text, links, projects, gallery, timeline, custom HTML embed, and so on).
- Projects manager with links and gallery, public /projects pages.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Uploads work and files are served with correct headers.
- A new page can be created, filled with sections, and appears in navigation.
- Projects CRUD and public showcase work.
- Custom HTML embeds are clearly marked and only editable by the admin.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.

=== END PART 4 ===

---

=== START PART 5 ===  (upload: 3ellwa-space-part4.zip (or newer))

# 3ellwa.space, Part 5: Theme engine and appearance

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Theme tokens as CSS variables: colors, gradients, backgrounds (image and video), cards, borders, radius, shadows, blur, typography, spacing, container width, density.
- Animation controls with reduced-motion support.
- Theme management: presets, create, duplicate, rename, delete, import and export, activate, reset.
- Customization studio with live preview and draft/publish for themes.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Changing a token updates the live preview immediately and the public site after publish.
- Reduced-motion preference disables animations.
- Themes survive refresh and redeploy.
- Import and export round-trips.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.

=== END PART 5 ===

---

=== START PART 6 ===  (upload: 3ellwa-space-part5.zip (or newer))

# 3ellwa.space, Part 6: Layout editor and publishing

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Visual layout editor for homepage and pages: drag-and-drop section order, widget positioning, per-section visibility for desktop and mobile, desktop and mobile preview, undo, redo, draft saving, publish, discard draft, publish history.
- Unify draft and publish across layout, theme, and pages through /api/admin/publish.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Edits stay invisible to the public until published.
- Undo and redo work across at least ten steps.
- Mobile and desktop visibility settings change the public site correctly.
- Discarding a draft restores the published state.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.

=== END PART 6 ===

---

=== START PART 7 ===  (upload: 3ellwa-space-part6.zip (or newer))

# 3ellwa.space, Part 7: Widgets and integrations

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Widget framework: enable/disable, config, position, display mode, visibility, styling, refresh interval, loading and error states, server-side caching.
- Integrations page: write-only credential storage encrypted with ENCRYPTION_KEY, test connection, status.
- Implement real integrations: GitHub, Steam, Spotify, Discord presence (see DECISIONS.md item 11), Minecraft server status. Then simple widgets: local clock, countdown, weather, quotes, custom embed.
- Walk the owner through creating each developer app or API key as needed.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Every integration shows real data or an honest error state, never fake data.
- Credentials never appear in any API response.
- Disabling a widget removes it from the public layout.
- Rate limits and caching verified.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.

=== END PART 7 ===

---

=== START PART 8 ===  (upload: 3ellwa-space-part7.zip (or newer))

# 3ellwa.space, Part 8: Analytics, guestbook, privacy, extras

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Cookie-free analytics: visitors, page views, link clicks, referrers, devices, browsers, trends, date filters, charts, export, retention and purge, on/off switch.
- Guestbook with moderation, spam limits, and on/off switch.
- Privacy and SEO: global noindex default, per-page indexing, robots.txt, sitemap, Open Graph, favicon, canonical URLs, password-protected pages and sections, maintenance page, custom error pages.
- Optional extras, each with its own settings: interactive terminal, custom cursor, visitor counter, keyboard shortcuts, Konami easter egg, music player.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Analytics numbers match test traffic.
- Noindex is on by default and respected in headers, meta tags, and robots.txt.
- Password-protected content is truly inaccessible without the password.
- Each extra can be switched on and off from the admin panel.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.

=== END PART 8 ===

---

=== START PART 9 ===  (upload: 3ellwa-space-part8.zip (or newer))

# 3ellwa.space, Part 9: Hardening, deployment guide, backup

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Security review against PROJECT.md section 17: input validation, output escaping, CSRF, rate limits, upload checks, headers (CSP, HSTS, and so on), admin route exposure.
- Accessibility and performance pass: keyboard navigation, labels, image optimization, lazy loading, layout shift.
- Write docs/DEPLOYMENT.md, docs/MAINTENANCE.md, and docs/BACKUP.md: deployment, secret rotation, D1 Time Travel restore, scheduled export, R2 backup, how to continue development with the prompt pack.
- Final test pass of every item in PROJECT.md section 21.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Every acceptance criterion in PROJECT.md section 21 is verified or an exception is listed honestly in STATUS.md.
- A backup and a restore were actually performed once.
- The deployment guide works from a clean machine.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.

=== END PART 9 ===

---

=== START PART 10 ===  (upload: 3ellwa-space-part9.zip (or newer))

# 3ellwa.space, Part 10: Subdomains and domain management

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Domain manager: list known subdomains and destinations, show DNS status, create and edit supported DNS records through the Cloudflare API, check connectivity, setup instructions.
- The Cloudflare API token is a Worker secret and never reaches the browser. Use the narrowest token permissions possible.
- Subdomains are independent services; only point records at them.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Records can be listed, created, edited, and deleted from the admin panel.
- Token never exposed.
- Failed API calls show clear errors.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.

=== END PART 10 ===
