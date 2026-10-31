# STATUS

Last reconciled: 2026-10-31

## Current verified state

- Repository: `alimohamed1752010-bot/3ellwa-Space`, default branch `main`.
- Latest source changes include domain inventory improvements, SEO privacy hardening, and a manual GitHub Actions deployment fallback (`.github/workflows/deploy.yml`). The crawler-visible noindex follow-up (`6d1dc3b`) is newer than the latest confirmed production deployment.
- Latest GitHub CI run [41214821552](https://github.com/alimohamed1752010-bot/3ellwa-Space/actions/runs/41214821552) completed successfully on commit `7336adcccbde4b9db263a537fbd2677ab3601135`; both typecheck/web/build and local Worker integration jobs passed.
- Cloudflare Worker: `3ellwa-space`; deployment `d8df80b6-d7f3-4c3a-a2b1-1062044993d8`, version `f3adfe8b-854c-4ad8-b097-52c590b27e74` (version 171), assigned 100% traffic at 16:27 UTC on 2026-10-31.
- Cron Trigger: `0 * * * *` (hourly UTC).
- Production bindings: D1 `DB`, R2 `MEDIA`, static assets `ASSETS`, secrets `ADMIN_PASSWORD`, `ADMIN_PATH`, and `DISCORD_AUTH_WEBHOOK_URL`. The Worker runtime `CF_API_TOKEN` is still absent, so the domain inventory cannot query Cloudflare DNS yet. GitHub Actions secrets are separate; the manual deploy fallback also needs repository secret `CF_API_TOKEN`.
- Public domain: https://3ellwa.space.
- Separate private R2 backup bucket: `3ellwa-space-backups`. It currently contains no objects under `d1/` or `media/`.
- Production backup workflow is committed but no successful backup has been verified. It validates non-empty SQL exports, checks gzip integrity, uploads a SHA-256 checksum, verifies the stored object's size via R2 metadata, and reports the media object count. Its D1 polling logic was corrected against Cloudflare's documented export API response (`result.signed_url` and `result.filename`, with `current_bookmark` polling). The four GitHub Actions secrets in `docs/BACKUP.md` remain required.
- Full authenticated browser/visual acceptance has not been completed.
- A manual-only GitHub Actions deployment fallback is available at `.github/workflows/deploy.yml`; it runs typecheck, web tests, build, local D1 migrations, and the Worker auth/integration scripts before deploying. It has not been run and requires repository secret `CF_API_TOKEN`. Normal Cloudflare Workers Builds remains the documented push-to-main deployment path.

## Latest checkpoint

- Privacy default hardening: SEO settings now default to search indexing disabled. Production D1 was updated to `indexingEnabled: false` (settings version 2, verified directly). Active Worker version 171 predates the follow-up crawler fix.
- Crawler behavior correction: while indexing is disabled, `robots.txt` now allows public crawling (but disallows `/api/` and `/admin/`) so crawlers can read the `X-Robots-Tag: noindex, nofollow` header and HTML robots meta tag. The sitemap remains unavailable. This source change and its integration assertions are committed but not yet deployed.

## Implemented

- Parts 1 through 8: core site, admin, links, pages, projects, themes, layout, widgets, GitHub/Minecraft integrations, analytics, guestbook, announcements, SEO and indexing.
- Authentication uses plain `ADMIN_PASSWORD` plus mandatory Discord OTP. OTP is single-use, time-limited and rate-limited. Do not add password-only or OTP bypasses.
- Part 9 checkpoint 1: security headers, CSP, HSTS on HTTPS, Permissions Policy, and exact-origin validation.
- Part 9 backup preparation: daily D1 export and R2 media mirror workflow, private backup bucket, and recovery documentation. Activation and disposable restore drill remain outstanding.
- Part 10 checkpoint 1: read-only domain inventory API and admin screen are implemented. The API paginates zones, DNS records, and Worker custom domains (up to 2,000 entries). The screen now supports filtering DNS records and copying hostnames/targets. DNS mutation remains disabled.

## Verification

- CI run [41214821552](https://github.com/alimohamed1752010-bot/3ellwa-Space/actions/runs/41214821552) passed both jobs before the recent Part 10 and SEO privacy changes. No CI result is available for the latest commits.
- Cloudflare API inspection confirmed the Worker, hourly schedule, D1/R2 bindings, and the separate backup bucket.
- Cloudflare API inspection confirmed no backup objects currently exist under `d1/` or `media/`.
- Cloudflare API inspection confirms version 171 (`f3adfe8b-854c-4ad8-b097-52c590b27e74`) is assigned 100% traffic. It was created after the default-indexing code commit, but before the crawler-visible noindex correction. Production D1 confirms indexing is currently disabled. The public site could not be reached from the connected runtime for an HTTP header check.

## Remaining acceptance work

- Add `CF_API_TOKEN` as a Worker secret with Zone Read and DNS Read scoped to the `3ellwa.space` zone, plus Workers Scripts Read scoped to the account. The connected Cloudflare authorization cannot create API tokens, so this requires a user-created token.
- Add the GitHub Actions `CF_API_TOKEN` secret for the manual deploy fallback with Workers Scripts Edit and the D1/R2 read permissions Wrangler needs to resolve the configured bindings. Keep this separate from the Worker runtime token where narrower scopes are appropriate.
- Add the four GitHub Actions backup secrets listed in `docs/BACKUP.md`, run the backup workflow manually, and verify both D1 and media objects in the private bucket.
- Perform a restore drill against a disposable D1 database only.
- Complete authenticated desktop/mobile visual acceptance, safe media upload/selection, layout loading, public page/project routes, and a real configured integration refresh.
- Part 10 later checkpoints: add safe DNS record create/edit/delete operations, domain connectivity checks, and setup guidance.

## Environment

- Hosting: Cloudflare Workers + static assets.
- Database: Cloudflare D1 (`3ellwa-space-db`, binding `DB`).
- Object storage: Cloudflare R2 (`3ellwa-space-media`, binding `MEDIA`).
- Backup storage: Cloudflare R2 (`3ellwa-space-backups`, private).
- Static asset binding: `ASSETS`.
- Wrangler config: `wrangler.jsonc`.
