# Backup and recovery

## What is protected

| Data | Primary location | Backup method |
|---|---|---|
| Profile, links, pages, projects, themes, settings, analytics, guestbook, auth records | D1 `3ellwa-space-db` | Daily D1 SQL export to R2 |
| Uploaded images and videos | R2 `3ellwa-space-media` | Daily object sync to a separate private R2 bucket |
| Application source | GitHub `main` | Git history |
| Worker configuration and secrets | Cloudflare | Keep configuration in Git; rotate/recreate secrets separately |

The backup destination bucket is `3ellwa-space-backups` in the same Cloudflare account. It is separate from the live media bucket and has no public custom domain configured. Backup objects contain private site data; never make this bucket public.

## D1 point-in-time recovery

Cloudflare D1 Time Travel is always enabled for production-storage databases. Current Cloudflare limits document 7 days of point-in-time recovery on the Workers Free plan and 30 days on Workers Paid. Confirm the current plan limit before relying on a particular recovery date. Time Travel is not a substitute for a longer-lived export.

Get the current bookmark:

```sh
npx wrangler d1 time-travel info 3ellwa-space-db
```

Before restoring, stop writes if possible and make a fresh SQL export. Restore is destructive and overwrites the live database in place:

```sh
npx wrangler d1 time-travel restore 3ellwa-space-db --bookmark="BOOKMARK_FROM_INFO"
```

Replace the placeholder with the exact bookmark. Review the confirmation prompt and proceed only after verifying the database name and recovery point. Save the returned previous bookmark; it is the recovery path if the restore itself must be undone.

Never test restore against the production database. Use a separate disposable D1 database for a restore drill.

## Scheduled SQL and media backups

The workflow `.github/workflows/backup-d1.yml` is configured to run daily at 02:30 UTC and can also be started manually. It:

1. Requests a D1 SQL export and polls until Cloudflare reports completion.
2. Downloads the time-limited signed export URL without printing it to logs and rejects an empty export.
3. Compresses the SQL file, validates it with `gzip -t`, creates a SHA-256 checksum, and stores both under `d1/` in `3ellwa-space-backups`.
4. Reads the uploaded object's metadata and fails if its stored size differs from the local compressed export.
5. Synchronizes media objects from `3ellwa-space-media` into the backup bucket's `media/` prefix and reports the resulting object count.
6. Removes D1 SQL exports and checksum files older than 30 days. Media objects removed from the live bucket are intentionally not automatically deleted from the backup copy.

### Required GitHub Actions secrets

Add these under **GitHub repository → Settings → Secrets and variables → Actions → New repository secret**:

- `CF_ACCOUNT_ID`: Cloudflare account ID.
- `CF_API_TOKEN`: Cloudflare API token with **Account → D1 → Edit** permission, scoped to this Cloudflare account. D1 export is an account-level write-authorized API operation; D1 Read alone is not sufficient. Do not use a Global API Key.
- `R2_ACCESS_KEY_ID`: R2 S3 access key scoped to read objects from `3ellwa-space-media` and read/write objects in `3ellwa-space-backups`.
- `R2_SECRET_ACCESS_KEY`: secret half of that R2 S3 key.

Do not paste these values into chat or commit them. The workflow will fail closed if any are missing. The D1 database ID and bucket names are non-secret resource identifiers in the workflow.

After adding the secrets, use **Actions → Daily Cloudflare backups → Run workflow**. The workflow validates that all four values are present before making any requests; it never prints their values. Confirm the run succeeds and that the backup bucket contains both a dated `d1/*.sql.gz` export and objects under `media/`. Until this first run succeeds, scheduled off-site backups are not yet active.

## Restore from an exported SQL file

Use this path when Time Travel no longer covers the required date or when recovering into a new database. Download the selected `d1/*.sql.gz` object from the private backup bucket and decompress it. Create a new, empty D1 database first; do not import over the live database as a test.

Example:

```sh
npx wrangler d1 create 3ellwa-space-recovery
gzip -dk selected-backup.sql.gz
npx wrangler d1 execute 3ellwa-space-recovery --remote --file=selected-backup.sql
```

Check the import output and inspect expected tables and records before changing the Worker's `DB` binding. The recovery database is not live until the binding is deliberately switched and verified.

## Restore media

Download or sync the backup bucket's `media/` prefix to the live media bucket using an R2 S3 credential with write access:

```sh
aws s3 sync s3://3ellwa-space-backups/media/ s3://3ellwa-space-media/ --endpoint-url "https://ACCOUNT_ID.r2.cloudflarestorage.com"
```

This restores missing objects and updates matching keys. It does not delete extra objects from the destination. Keep the D1 and media recovery points as close together as practical; the two services are backed up sequentially, not as one atomic snapshot.

## Current verification state

- A production D1 SQL export was requested and Cloudflare reported it **complete** on 2026-10-31. Its download URL is temporary; this alone does not mean a durable R2 backup object exists.
- The separate R2 backup bucket was created on 2026-10-31.
- The GitHub backup workflow is prepared but requires the four repository secrets above before it can run.
- A restore drill against a disposable database has **not** been completed. Do not claim disaster recovery is fully tested until a disposable restore drill and a successful scheduled backup have both been verified.


## Disposable restore drill

The manual workflow **Actions → Cloudflare backup restore drill** tests the newest compressed D1 export without modifying the production database:

1. Finds the newest `d1/*.sql.gz` object and downloads its SHA-256 sidecar.
2. Verifies the checksum and gzip stream before attempting an import.
3. Creates a uniquely named disposable D1 database (`3ellwa-space-restore-drill-*`).
4. Imports the SQL export into that database and queries the restored schema, migration history, and DNS audit table.
5. Compares every current live-media object key and size against the private backup mirror. Extra historical objects in the backup are allowed because the regular backup intentionally does not delete old media.
6. Deletes the disposable D1 database in an exit cleanup handler. If Cloudflare refuses cleanup, the workflow fails and prints the exact disposable database name for manual cleanup.

The workflow uses the same four repository secrets as the scheduled backup. The Cloudflare token must have **Account → D1 → Edit** so it can create, query, and delete the disposable database. R2 credentials need read access to both buckets. Run it only after a successful backup has created a D1 export and media mirror. A successful drill validates the latest D1 export and media mirror; it is not a production restore and does not test switching Worker bindings.

Until this workflow completes successfully, recovery remains unverified. Never point the drill at the production database.
