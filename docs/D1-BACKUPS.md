# D1 Backup and Recovery

This runbook covers the production `blog-db` backup Worker and restoring a backup into the isolated `blog-db-staging` database.

## Resources

| Resource | Name |
| --- | --- |
| Backup Worker | `scary-spider-seo-d1-backup` |
| Production database | `blog-db` |
| Backup bucket | `blog-db-backups` |
| Staging database | `blog-db-staging` |
| Schedule | Daily at 02:00 UTC |
| Retention | 30 days |

The backup bucket must remain private. Backups contain admin password hashes and private operational data.

Backup failures are sent through Cloudflare Email Sending from `alerts@blog.scaryspiderseo.com` to the secret recipient configured as `ALERT_TO_EMAIL`.

## First-Time Setup

Create the dedicated R2 bucket once from the repository root:

```bash
npx wrangler r2 bucket create blog-db-backups
```

The deploy workflow requires a `Production` environment with:

- `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, Account D1 Edit, R2 Edit, and Account Settings Read
- `CLOUDFLARE_ACCOUNT_ID` set to the Cloudflare account ID

Set the alert recipient as a Worker secret after Email Sending is enabled:

```bash
npx wrangler secret put ALERT_TO_EMAIL --config ops/d1-backup/wrangler.jsonc
```

The recipient receives an email only when a scheduled backup fails.

Before deploying, onboard `blog.scaryspiderseo.com` under Cloudflare Email Service > Email Sending and complete the SPF/DKIM DNS records. The deployment credential also needs Email Sending permission.

## Backup Format

Backups are gzip-compressed JSON objects stored under:

```text
daily/blog-db-YYYY-MM-DDTHH-mm-ss-sssZ.json.gz
```

The document contains the format version, source database, timestamp, table names, column names, rows, and row counts. The current tables are exported in dependency-aware order:

- `posts`
- `categories`
- `settings`
- `users`
- `comments`
- `comment_votes`
- `login_attempts`

## Deploying Changes

Changes under `ops/d1-backup/` deploy automatically from `main` through `.github/workflows/deploy-d1-backup.yml`. The workflow generates binding types, runs TypeScript checks, and deploys the Worker.

The Worker is separate from the blog Worker, so backup failures do not affect public blog requests.

## Restore Test

Use the **Test D1 Restore** workflow manually from GitHub Actions. Supply a backup key such as:

```text
daily/blog-db-2026-09-20T02-00-00-000Z.json.gz
```

The workflow always writes to `blog-db-staging`. It downloads the backup from R2, generates SQL, replaces staging rows, and compares row counts for every table.

The restore workflow does not accept a production database name and must not be modified to do so without an incident review.

## Recovery Targets

- Recovery point objective: 24 hours, based on the daily schedule
- Recovery time objective: under 1 hour for a normal restore
- Retention: 30 daily backups

The database backup does not include files in the `blog-media` R2 bucket. Full media recovery requires a separate R2 media backup project.

## Verification Checklist

- Confirm the backup Worker completed successfully in Workers Logs.
- Confirm a new object exists under the `daily/` prefix.
- Confirm the backup object timestamp is within the expected schedule window.
- Run the restore workflow against the newest successful backup.
- Confirm all seven table row counts match.
- Open the staging blog and verify a published post, comments, and admin login.
