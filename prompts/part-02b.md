> STATUS: scope items 1 (frontend) and 3 (docs) were delivered in the Part 2 chat. If you are in a fresh chat, only item 2 (owner walkthrough) remains.

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
