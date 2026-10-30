> NOTE: this prompt was split. The scaffold and auth backend are done (Part 1.5). Use prompts/part-02b.md for what remains.

# 3ellwa.space, Part 2: Foundation

You are a senior full-stack developer continuing an existing project. The owner is building this step by step with you and runs every command himself, so give exact commands and say what output to expect.

## Read first, in this order
1. docs/PROJECT.md (the full specification)
2. docs/STATUS.md (where the project stands)
3. docs/DECISIONS.md (settled choices, do not reopen)
4. docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md, migrations/

If a file is missing or contradicts another, say so before writing code.

## Scope of this part
- Initialize the project: package.json, Vite + React + TypeScript + Tailwind in apps/web, Hono Worker in worker, wrangler config with D1 and R2 bindings and static assets.
- Apply migrations/0001_init.sql to D1 (local and remote).
- Implement the full auth flow from DECISIONS.md item 6: hidden ADMIN_PATH, password check, Discord webhook one-time code, session cookie, lockout, logout, DISABLE_OTP fallback.
- Public/admin separation: public shell with a styled empty-state homepage, admin shell with sidebar navigation (empty screens) behind auth.
- Shared UI components (button, input, card, modal, toast) in the dark violet style.
- Walk the owner through: GitHub repo, Cloudflare account, D1 and R2 creation, secrets, first deploy.

## Out of scope
Everything not listed above. If you see a need outside scope, note it in docs/STATUS.md instead of building it.

## Acceptance checklist
- Owner can deploy to Cloudflare and open the public site.
- Wrong admin path returns the normal 404.
- Correct password sends a code to Discord; the code logs in; wrong codes and passwords lock out after the limit.
- Session survives refresh and logout works.
- No secret appears in the repo or the browser bundle.

## Working rules
- Work in small checkpoints. After each one, give a zip of the repo so the owner never loses progress to a usage limit.
- Keep replies short. No long recaps. Do not claim something works unless you ran or tested it; say plainly what you could not test and give the owner a verification step instead.
- Never hardcode personal data. Everything comes from the database with sensible defaults.
- Secrets never reach the frontend or the repo.
- Schema changes go in a new numbered migration, never by editing an applied one. Keep docs/SCHEMA.md and docs/API.md accurate.
- Respect the design direction in docs/PROJECT.md section 2.

## Before you finish
Update docs/STATUS.md (done, in progress, next, known issues, environment facts) and docs/DECISIONS.md (new decisions), then deliver the final zip.
