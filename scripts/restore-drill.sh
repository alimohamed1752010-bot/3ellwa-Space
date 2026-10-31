#!/usr/bin/env bash
set -euo pipefail

: "${CF_ACCOUNT_ID:?Missing CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?Missing CF_API_TOKEN}"
: "${R2_ACCESS_KEY_ID:?Missing R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Missing R2_SECRET_ACCESS_KEY}"

for command in aws curl jq gzip sha256sum npx; do
  command -v "$command" >/dev/null || { echo "::error::Required command is missing: $command"; exit 1; }
done

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto

BACKUP_BUCKET="3ellwa-space-backups"
LIVE_MEDIA_BUCKET="3ellwa-space-media"
ENDPOINT="https://$CF_ACCOUNT_ID.r2.cloudflarestorage.com"
API="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID"
TMP="$(mktemp -d)"
DRILL_DB_ID=""
DRILL_DB_NAME="3ellwa-space-restore-drill-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"

cleanup() {
  local original_status=$?
  if [[ -n "$DRILL_DB_ID" ]]; then
    echo "Removing disposable D1 database: $DRILL_DB_NAME"
    local deleted
    deleted="$(curl --fail --silent --show-error -X DELETE "$API/d1/database/$DRILL_DB_ID" -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")" || {
      echo "::error::Could not delete disposable restore-drill database $DRILL_DB_NAME (id $DRILL_DB_ID). Remove it manually in Cloudflare D1."
      original_status=1
    }
    if ! jq -e '.success == true' <<< "$deleted" >/dev/null; then
      echo "::error::Cloudflare did not confirm deletion of disposable database $DRILL_DB_NAME."
      original_status=1
    fi
  fi
  rm -rf "$TMP"
  exit "$original_status"
}
trap cleanup EXIT

echo "Finding the newest D1 backup in the private R2 bucket..."
aws s3api list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix "d1/" --endpoint-url "$ENDPOINT" > "$TMP/objects.json"
BACKUP_KEY="$(jq -r '[.Contents[]? | select(.Key | endswith(".sql.gz"))] | sort_by(.LastModified) | last | .Key // empty' "$TMP/objects.json")"
if [[ -z "$BACKUP_KEY" ]]; then
  echo "::error::No compressed D1 backup exists under s3://$BACKUP_BUCKET/d1/."
  exit 1
fi

aws s3 cp "s3://$BACKUP_BUCKET/$BACKUP_KEY" "$TMP/backup.sql.gz" --endpoint-url "$ENDPOINT" --only-show-errors
aws s3 cp "s3://$BACKUP_BUCKET/$BACKUP_KEY.sha256" "$TMP/backup.sha256" --endpoint-url "$ENDPOINT" --only-show-errors
EXPECTED_SHA="$(awk 'NR==1 {print $1}' "$TMP/backup.sha256")"
ACTUAL_SHA="$(sha256sum "$TMP/backup.sql.gz" | awk '{print $1}')"
if [[ ! "$EXPECTED_SHA" =~ ^[a-fA-F0-9]{64}$ || "$EXPECTED_SHA" != "$ACTUAL_SHA" ]]; then
  echo "::error::D1 backup checksum validation failed."
  exit 1
fi
gzip -t "$TMP/backup.sql.gz"
gzip -dc "$TMP/backup.sql.gz" > "$TMP/restore.sql"
test -s "$TMP/restore.sql"
echo "Verified backup checksum and gzip stream: $BACKUP_KEY"

echo "Creating an isolated disposable D1 database..."
CREATED="$(curl --fail --silent --show-error -X POST "$API/d1/database" -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" --data "$(jq -nc --arg name "$DRILL_DB_NAME" '{name:$name}')")"
jq -e '.success == true and (.result.uuid | type == "string")' <<< "$CREATED" >/dev/null || {
  jq -r '.errors // "Cloudflare could not create the disposable D1 database."' <<< "$CREATED"
  exit 1
}
DRILL_DB_ID="$(jq -r '.result.uuid' <<< "$CREATED")"

cat > "$TMP/wrangler.jsonc" <<EOF
{
  "name": "3ellwa-space-restore-drill",
  "main": "$GITHUB_WORKSPACE/worker/index.ts",
  "compatibility_date": "2025-09-01",
  "account_id": "$CF_ACCOUNT_ID",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "$DRILL_DB_NAME",
      "database_id": "$DRILL_DB_ID"
    }
  ]
}
EOF

echo "Importing the export into the disposable database (production is not referenced)..."
npx wrangler d1 execute "$DRILL_DB_NAME" --remote --file="$TMP/restore.sql" --config="$TMP/wrangler.jsonc" --yes

query_d1() {
  local sql="$1"
  curl --fail --silent --show-error -X POST "$API/d1/database/$DRILL_DB_ID/query" \
    -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
    --data "$(jq -nc --arg sql "$sql" '{sql:$sql}')"
}

echo "Checking restored schema and migration history..."
TABLES="$(query_d1 "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('d1_migrations','dns_change_audit','pages','projects','links') ORDER BY name")"
jq -e '.success == true and .result[0].success == true' <<< "$TABLES" >/dev/null
jq -e '[.result[0].results[].name] as $n | ["d1_migrations","dns_change_audit","pages","projects","links"] | all(. as $required | $n | index($required) != null)' <<< "$TABLES" >/dev/null || {
  echo "::error::Restored database is missing one or more required application tables."
  jq -r '.result[0].results // []' <<< "$TABLES"
  exit 1
}

MIGRATION="$(query_d1 "SELECT name FROM d1_migrations WHERE name='0004_dns_change_audit.sql'")"
jq -e '.success == true and .result[0].success == true and any(.result[0].results[]; .name == "0004_dns_change_audit.sql")' <<< "$MIGRATION" >/dev/null || {
  echo "::error::Restored database does not contain the expected DNS audit migration."
  exit 1
}
AUDIT_COUNT="$(query_d1 "SELECT COUNT(*) AS count FROM dns_change_audit")"
jq -e '.success == true and .result[0].success == true and (.result[0].results[0].count | type == "number")' <<< "$AUDIT_COUNT" >/dev/null

echo "Comparing live and backed-up media object keys and sizes..."
aws s3api list-objects-v2 --bucket "$LIVE_MEDIA_BUCKET" --endpoint-url "$ENDPOINT" > "$TMP/live-media.json"
aws s3api list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix "media/" --endpoint-url "$ENDPOINT" > "$TMP/backup-media.json"
jq -r '.Contents[]? | [.Key, (.Size|tostring)] | @tsv' "$TMP/live-media.json" | sort > "$TMP/live-media.txt"
jq -r '.Contents[]? | [(.Key | ltrimstr("media/")), (.Size|tostring)] | @tsv' "$TMP/backup-media.json" | sort > "$TMP/backup-media.txt"
MISSING_MEDIA="$(comm -23 "$TMP/live-media.txt" "$TMP/backup-media.txt")"
if [[ -n "$MISSING_MEDIA" ]]; then
  echo "::error::The media backup is missing live object(s) or has different object sizes:"
  printf '%s\\n' "$MISSING_MEDIA"
  exit 1
fi
MEDIA_COUNT="$(wc -l < "$TMP/live-media.txt" | tr -d ' ')"
AUDIT_ROWS="$(jq -r '.result[0].results[0].count' <<< "$AUDIT_COUNT")"
echo "RESTORE DRILL PASSED"
echo "D1 backup: $BACKUP_KEY"
echo "Restored migration: 0004_dns_change_audit.sql"
echo "DNS audit rows restored: $AUDIT_ROWS"
echo "Media objects matched by key and size: $MEDIA_COUNT"
echo "Disposable D1 database will be deleted by the cleanup handler."
