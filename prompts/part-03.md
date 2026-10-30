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
