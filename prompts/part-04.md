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

## Added after Part 3
- Reserve the page slugs "links" and "go" (built-in routes /links and /go/:id). Refuse them in the page editor with a clear message.
- Part 3 link images use the existing upload (purpose=link); the media library should list and manage them too.
