# 3ellwa.space

A personal website and private admin dashboard for one owner, running entirely on Cloudflare (Workers, D1, R2). Everything on the public site is controlled from the admin panel and stored in the database.

## Start here
- Full specification: docs/PROJECT.md
- What is done and what is next: docs/STATUS.md
- Technical design: docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/API.md
- Operations: docs/DEPLOYMENT.md, docs/MAINTENANCE.md, docs/BACKUP.md
- Decisions already made: docs/DECISIONS.md

## How the build is split
The project is built in parts. Each part has a self-contained prompt in prompts/. To continue in any chat or account: paste the next prompt, upload the repo as a zip, and the assistant reads docs/ first. Every major milestone ends by updating docs/STATUS.md and docs/DECISIONS.md, with related features, tests, and documentation delivered together.

## One-time setup (Part 2 walks through it step by step)
1. Create a GitHub repo and push this folder.
2. Create a Cloudflare account, then a D1 database and an R2 bucket.
3. Set the Cloudflare Worker secrets `ADMIN_PASSWORD` and `DISCORD_AUTH_WEBHOOK_URL`.
4. Admin login always requires the plain `ADMIN_PASSWORD`, followed by a one-time code sent to the Discord webhook. No password hash, `SESSION_SECRET`, or OTP bypass is used.

## Local development
- `npm install`
- create `.dev.vars` with local `ADMIN_PASSWORD` and `DISCORD_AUTH_WEBHOOK_URL` values (never commit it)
- `npm run db:migrate:local`
- `npm run dev` builds the web app and serves everything at http://localhost:8787
- `npm run typecheck`, `npm run test:web`, `node scripts/smoke-test.mjs <url> <adminPath>`
- Worker route checks (need `npm run dev` running and a Discord webhook configured for the mandatory one-time-code step): `node scripts/part25-test.mjs <url> "password"`, `node scripts/part3-test.mjs <url> "password"`, `node scripts/part4-test.mjs <url> "password"`
