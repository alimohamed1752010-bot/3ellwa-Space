# Maintenance guide

## Routine checks

### After every deploy
- Confirm GitHub CI passed.
- Confirm Cloudflare Workers Builds reports a successful build.
- Confirm the intended Worker version has 100% traffic.
- Open the public homepage and the private admin page.
- Check Worker logs for uncaught exceptions.
- Confirm the hourly integration Cron Trigger remains registered.

### Weekly
- Review Cloudflare Worker errors and usage.
- Check that the latest scheduled D1 and R2 backup workflow succeeded.
- Review guestbook submissions and announcements in the admin dashboard.
- Check the media library's total size and any unexpectedly large uploads.
- Confirm GitHub and Minecraft integrations still refresh and display a recent timestamp.
- Review recent admin login notifications in the private Discord channel.

### Monthly
- Review GitHub Actions secrets and Cloudflare token scopes.
- Check D1 database size and R2 storage use.
- Verify the backup bucket still has recent SQL exports and media objects.
- Review dependencies and update them in a separate, tested change.
- Revisit the private admin path if it may have been exposed.

## Secret rotation

Rotate secrets from the Cloudflare Worker settings or with `wrangler secret put NAME`. Do not place values in source files.

- `ADMIN_PASSWORD`: change it, then verify password + Discord OTP login and logout.
- `ADMIN_PATH`: change it only when ready to update the private bookmark. The previous path should stop serving the admin shell.
- `DISCORD_AUTH_WEBHOOK_URL`: update it and verify a test login delivers the OTP.
- `ENCRYPTION_KEY`: do not replace it casually. If encrypted credentials exist, changing the key without a planned decrypt-and-re-encrypt migration makes those credentials unreadable. The current GitHub/Minecraft public integrations do not store OAuth credentials.

After rotation, test login, admin API access, logout, and the next scheduled integration refresh.

## Incident response

1. If admin access looks compromised, rotate `ADMIN_PASSWORD`, `ADMIN_PATH`, and the Discord webhook as appropriate.
2. Inspect Worker logs and auth-attempt records. Do not publish login identifiers or private webhook details.
3. If content was changed or deleted, stop further writes and identify the last good D1 bookmark.
4. Export the current D1 database before any restore.
5. Restore only after confirming the target database and recovery point. D1 Time Travel restore overwrites the database in place.
6. Check the public site, admin login, media, pages, projects, and integrations after recovery.

## Development handoff

Read, in order: `README.md`, `docs/PROJECT.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`, `docs/API.md`, then the next numbered prompt in `prompts/`.

Use the existing prompt pack and update the status/decision documents after each checkpoint. Do not invent features that are not in the current source. Keep secrets and real production data out of example fixtures.
