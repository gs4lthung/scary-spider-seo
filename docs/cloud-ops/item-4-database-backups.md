# Item 4: Database Backups and Recovery

## Objective

Build a scheduled backup process for D1 with automated retention, failure alerts, and tested restore capability.

## Status: Done

## What's Implemented

### Backup Worker (`ops/d1-backup/`)

| Component | Details |
|-----------|---------|
| Worker name | `scary-spider-seo-d1-backup` |
| Cron schedule | `0 2 * * *` (daily at 02:00 UTC) |
| Source database | `blog-db` (production D1) |
| Backup storage | `blog-db-backups` R2 bucket |
| Format | gzip-compressed JSON (`daily/blog-db-YYYY-MM-DDTHH-MM-SS-000Z.json.gz`) |
| Retention | 30 days (configurable via `BACKUP_RETENTION_DAYS` env) |
| Alert email | Via Cloudflare Email Sending (`ALERT_TO_EMAIL` secret) |

### Backup Contents

All D1 tables are exported:
- `posts`, `categories`, `settings`, `users`, `comments`, `comment_votes`, `login_attempts`

Each table includes column metadata and row data as JSON arrays.

### Restore Scripts

| Script | Purpose |
|--------|---------|
| `ops/d1-backup/scripts/restore.mjs` | Converts backup JSON to SQL INSERT statements |
| `ops/d1-backup/scripts/verify-restore.mjs` | Compares row counts between backup and restored database |

### Restore Testing Workflow (`.github/workflows/test-d1-restore.yml`)

Manual dispatch workflow that:
1. Downloads a backup from R2
2. Generates restore SQL
3. Applies it to `blog-db-staging`
4. Verifies row counts match

## How It Works

```
Cron (daily 02:00 UTC)
  -> D1 backup Worker executes
  -> Queries all tables from blog-db
  -> gzip compresses JSON export
  -> Uploads to R2: blog-db-backups/daily/blog-db-YYYY-MM-DD.json.gz
  -> Deletes backups older than 30 days
  -> On failure: sends alert email
```

## How to Verify

```bash
# List backups in R2
npx wrangler r2 object list blog-db-backups --prefix daily/

# Test restore to staging
gh workflow run test-d1-restore.yml -f backup_key=daily/blog-db-2026-09-20T02-00-00-000Z.json.gz

# Deploy backup Worker
npx wrangler deploy ops/d1-backup/src/index.ts --config ops/d1-backup/wrangler.jsonc
```

## Gaps / TODO

- `ALERT_TO_EMAIL` secret must be set separately on the Worker
- Backup Worker does not have a staging environment (backups only run against production)
