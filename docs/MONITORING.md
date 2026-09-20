# Monitoring and Alerts

This runbook covers availability checks, application errors, Worker observability, and deployment alerts.

## Health Endpoints

Production endpoints:

```text
https://www.scaryspiderseo.com/healthz
https://blog.scaryspiderseo.com/healthz
```

The website endpoint checks that the application responds. The blog endpoint also runs `SELECT 1` against D1, so a successful response confirms that the Worker can reach its database.

Both endpoints return `Cache-Control: no-store`. The blog returns HTTP `503` when D1 is unavailable.

## Cloudflare Site Monitor

The `scary-spider-seo-site-monitor` Worker runs every five minutes. It checks both health endpoints, stores the previous state in the `MONITOR_STATE` KV namespace, and sends one branded email when a site goes down or recovers.

The monitor avoids repeated alerts while a site remains unavailable. It uses the same Cloudflare Email Sending configuration as the D1 backup Worker.

The monitor Worker requires this secret:

```bash
npx wrangler secret put ALERT_TO_EMAIL --config ops/site-monitor/wrangler.jsonc
```

The marketing site health route must be deployed to the actual public website host before monitoring can report it as healthy. The Cloudflare Worker preview URL and the Vercel production URL are separate deployments.

## Deployment Failure Email

`.github/workflows/monitor-failures.yml` listens for failed runs from CI, production deployment, staging deployment, backup deployment, and restore testing. It sends a branded email through Cloudflare Email Sending.

The GitHub `Production` environment needs these secrets:

- `CLOUDFLARE_API_TOKEN`: must include Email Sending write permission in addition to deployment permissions
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID
- `ALERT_TO_EMAIL`: the operations recipient

The sender is:

```text
alerts@blog.scaryspiderseo.com
```

The workflow only sends mail for failed runs. It includes the workflow name, branch, commit, run URL, and a link to the failed run.

## Application Errors

This project does not require Sentry or Better Stack. Cloudflare Worker Logs and Traces are the server-side source of truth, and the application error boundaries continue to log client and route errors.

If browser exception aggregation becomes necessary later, add a provider-specific client integration behind an environment variable. Keep session replay, request bodies, cookies, and user information disabled by default.

## Cloudflare Observability

The website, blog, and backup Worker configs enable persisted Workers Logs and Traces. Use those logs for:

- D1 failures
- R2 failures
- Email Sending failures
- Cron execution failures
- Request-level errors

The backup Worker emits structured events including `backup_succeeded`, `backup_failed`, `backup_alert_failed`, and `backup_alert_not_configured`.

## Incident Response

1. Check Better Stack or UptimeRobot to identify which public endpoint failed.
2. Open Sentry to identify application exceptions, if configured.
3. Open Cloudflare Worker Logs for the affected Worker.
4. Check the latest GitHub workflow run for deployment or migration failures.
5. If the blog database is affected, restore the latest verified backup into staging first.
6. Confirm the staging application before taking any production recovery action.

## Alert Testing

- Open both `/healthz` endpoints and confirm HTTP `200`.
- Trigger a controlled Sentry test event in each configured project.
- Use a test branch or manual workflow failure to verify the deployment alert email.
- Run the D1 restore workflow and confirm its success email is not sent.
- Confirm backup failure email delivery using the existing D1 backup runbook.
