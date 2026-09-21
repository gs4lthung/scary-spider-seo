# Item 5: Monitoring and Alerts

## Objective

Add operational visibility so you know when a site is unavailable, a deployment fails, or errors are elevated, without manually watching a dashboard.

## Status: Done

## What's Implemented

### Health Endpoints

| Endpoint | File | What It Checks |
|----------|------|----------------|
| `blog.scaryspiderseo.com/healthz` | `blog/app/healthz/route.ts` | D1 connectivity (`SELECT 1`), returns 503 on failure |
| `www.scaryspiderseo.com/healthz` | `website/app/healthz/route.ts` | Returns `{status: "ok"}` (static site) |

### Site Monitor Worker (`ops/site-monitor/`)

| Component | Details |
|-----------|---------|
| Worker name | `scary-spider-seo-site-monitor` |
| Cron schedule | `*/5 * * * *` (every 5 minutes) |
| Monitored URLs | `https://www.scaryspiderseo.com/healthz`, `https://blog.scaryspiderseo.com/healthz` |
| State storage | KV namespace `MONITOR_STATE` |
| Alert email | Via Cloudflare Email Sending |

Behavior:
- Tracks last known status (up/down) per URL in KV
- On status change (up->down or down->up), sends an email alert
- Avoids duplicate alerts for consecutive failures

### CI Failure Monitoring (`ops/monitoring/`)

| Component | Details |
|-----------|---------|
| Workflow | `.github/workflows/monitor-failures.yml` |
| Script | `ops/monitoring/send-alert-email.mjs` |
| Watches | CI, Deploy Cloudflare Apps, Deploy Cloudflare Staging, Deploy D1 Backup, Test D1 Restore |

On any watched workflow failure, sends an email with:
- Workflow name
- Branch and commit SHA
- Link to the failed run

## How It Works

```
Every 5 minutes:
  Site Monitor Worker fires
  -> Fetches https://www.scaryspiderseo.com/healthz
  -> Fetches https://blog.scaryspiderseo.com/healthz
  -> Reads last status from KV
  -> If status changed: send email alert
  -> Update KV with current status

On workflow failure:
  GitHub triggers monitor-failures.yml
  -> Runs send-alert-email.mjs
  -> Sends email via Cloudflare Email Sending API
```

## How to Verify

```bash
# Check health endpoints
curl https://blog.scaryspiderseo.com/healthz
curl https://www.scaryspiderseo.com/healthz

# Deploy monitor Worker
npx wrangler deploy ops/site-monitor/src/index.ts --config ops/site-monitor/wrangler.jsonc
```

## Gaps / TODO

- `ALERT_TO_EMAIL` secret must be set on the monitor Worker
- Site monitor only checks production URLs (not staging)
- No error rate monitoring (only uptime)
- No log-based alerting (Cloudflare Workers Logs are available but not alerted on)
