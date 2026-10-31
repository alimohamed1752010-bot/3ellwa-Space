# Deployment guide

## Production architecture

- Domain: https://3ellwa.space
- Runtime: one Cloudflare Worker, `3ellwa-space`
- Static frontend: Worker Static Assets built from `apps/web/dist`
- Database: D1 `3ellwa-space-db` (binding `DB`)
- Media: R2 `3ellwa-space-media` (binding `MEDIA`)
- Source of truth: GitHub `main`
- CI: GitHub Actions (`.github/workflows/ci.yml`)
- Production deploy: Cloudflare Workers Builds watches `main`; docs-only changes are excluded from deploys.

## Clean-machine setup

Requirements: Git, Node.js 22, npm, and a Cloudflare account with access to this Worker.

1. Clone the repository and install the locked dependencies:

   ```sh
   git clone https://github.com/alimohamed1752010-bot/3ellwa-Space.git
   cd 3ellwa-Space
   npm ci
   ```

2. Authenticate Wrangler:

   ```sh
   npx wrangler login
   ```

3. Check the production resources in the Cloudflare dashboard before changing anything:
   - Worker: `3ellwa-space`
   - D1: `3ellwa-space-db`, binding `DB`
   - R2: `3ellwa-space-media`, binding `MEDIA`
   - Static assets: `ASSETS`

   The checked-in `wrangler.jsonc` contains the current D1 and R2 resource names and IDs. Do not create replacements or edit these identifiers for an ordinary deployment.

4. Confirm that the Worker secrets exist. Set or rotate them in **Workers & Pages → 3ellwa-space → Settings → Variables and Secrets**, or with Wrangler:

   ```sh
   npx wrangler secret put ADMIN_PATH
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put DISCORD_AUTH_WEBHOOK_URL
   ```

   `ADMIN_PATH` is a private, unguessable path. `ADMIN_PASSWORD` is the first login factor. Discord OTP remains mandatory. Never paste secret values into Git, issues, logs, or chat. `ENCRYPTION_KEY` is only needed by features that actually encrypt third-party credentials; preserve the existing key if encrypted records exist.

5. Apply migrations only when a new migration has been added:

   ```sh
   npm run db:migrate:remote
   ```

   Never edit a migration already applied to production.

6. Verify locally before publishing:

   ```sh
   npm run typecheck
   npm run test:web
   npm run build:web
   ```

7. Push changes to `main`. GitHub Actions must pass. Cloudflare Workers Builds then builds and deploys application changes. Do not manually deploy a stale local checkout over a newer GitHub build.

## Manual deployment fallback

If the GitHub-to-Cloudflare build connection is unavailable, first pull the latest `main`, install dependencies with `npm ci`, run the checks above, then deploy:

```sh
npm run deploy
```

Confirm the latest Worker deployment in Cloudflare and verify it receives 100% traffic before considering the deployment complete.

## Local development

Create an untracked `.dev.vars` file with local-only test credentials:

```dotenv
ADMIN_PASSWORD="local-only-password"
DISCORD_AUTH_WEBHOOK_URL="http://127.0.0.1:9999/hook"
```

Then:

```sh
npm run db:migrate:local
npm run dev
```

Never copy production credentials into `.dev.vars`. Never commit this file.

## Rollback

- For a code regression, use Cloudflare Workers → Deployments to roll back to the last known-good Worker version.
- For a database regression, stop writes and assess D1 Time Travel before changing data. A code rollback does not reverse a database migration.
- Before any database restore, create a fresh SQL export and record the current bookmark. See [BACKUP.md](./BACKUP.md).
