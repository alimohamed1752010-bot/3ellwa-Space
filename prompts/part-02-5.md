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
