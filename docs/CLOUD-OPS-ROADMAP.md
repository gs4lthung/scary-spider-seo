# Cloud and Ops Roadmap

This guide describes a practical path for learning cloud infrastructure and operations by improving Scary Spider SEO.

## Current Architecture

| Area | Current platform |
| --- | --- |
| Marketing website | Next.js on Vercel |
| Blog | Next.js on Cloudflare Workers |
| Blog database | Cloudflare D1 |
| Blog media | Cloudflare R2 |
| Blog cache | Cloudflare KV |
| Blog secrets | Workers Secrets |
| Desktop application | Tauri, React, and Rust |
| Releases | GitHub Releases |

The main operational gaps are manual deployments, no staging environment, no automated backups, and limited alerting.

## Learning Order

### 1. Continuous Integration

Create GitHub Actions workflows for:

- Website lint and production build
- Blog lint, typecheck, and Cloudflare build
- Rust tests and frontend tests
- Dependency and secret scanning

Learn:

- Workflow triggers
- Jobs and reusable steps
- Build artifacts
- Pull request checks
- Environment variables

Definition of done:

- Every pull request receives automated checks
- Merges cannot bypass failing required checks
- Build failures are visible in GitHub

### 2. Staging Environment

Create a separate Cloudflare environment for the blog:

- A staging Worker
- A separate D1 database
- A separate R2 bucket
- A separate KV namespace
- Separate secrets
- A staging Turnstile widget

Keep production data and credentials isolated from staging.

Learn:

- Wrangler environments
- Configuration separation
- Safe deployment promotion
- Environment-specific secrets

Definition of done:

- Staging can be deployed without affecting production
- Staging uses no production database or media bucket
- A pull request can be tested against a preview deployment

### 3. Deployment Automation

Automate deployments after approved changes:

- Deploy the website through its existing Vercel integration
- Build and deploy the blog with Wrangler
- Run migrations deliberately before deploying application code
- Keep production deployment behind a protected GitHub environment

Learn:

- Deployment gates
- Protected environments
- Rollbacks
- Migration ordering
- Cloudflare Worker versions

Definition of done:

- A merge to the production branch deploys predictably
- Production credentials are stored in GitHub or Cloudflare secrets
- Failed deployments do not silently appear successful

### 4. Database Backups and Recovery

Build a scheduled backup process for D1:

1. Run a scheduled Worker or Cron Trigger.
2. Export important D1 tables.
3. Compress the export.
4. Store the backup in R2.
5. Keep a defined retention period.
6. Test restoring a backup into the staging database.

Learn:

- Cron Triggers
- Data retention
- Recovery point objectives
- Recovery time objectives
- Restore testing

Definition of done:

- Backups run automatically
- Backup failures create an alert
- At least one restore has been tested
- Old backups are removed according to a documented policy

### 5. Monitoring and Alerts

Add operational visibility for both sites:

- An application health endpoint
- UptimeRobot or Better Stack for uptime checks
- Cloudflare monitoring Worker for uptime checks and alerts
- Cloudflare Worker logs and traces
- Alerts for failed deployments, backups, and elevated errors

Learn:

- Logs, metrics, and traces
- Error budgets
- Alert severity
- Incident response

Definition of done:

- You know when a site is unavailable
- You know when a deployment starts failing
- Alerts include enough context to investigate
- No alert depends on manually watching a dashboard

### 6. Security Hardening

Improve the public attack surface:

- Protect the blog admin area with Cloudflare Access
- Configure appropriate WAF rules
- Add security headers and a Content Security Policy
- Continue using Turnstile for public comments
- Enable GitHub CodeQL and Dependabot
- Scan for leaked secrets and vulnerable dependencies
- Review login and comment rate limits

Learn:

- Identity-aware access control
- Web application firewalls
- Least privilege
- Supply-chain security
- Security headers

Definition of done:

- Admin access requires authentication at the edge and application level
- Security scans run automatically
- Secrets never appear in source code or build logs

### 7. Background Jobs

Use Cloudflare Queues for work that should not block a request:

- Comment notification emails
- Image processing
- Analytics batching
- Crawl report processing
- Sitemap refreshes

Use Cron Triggers to start scheduled jobs and Workflows for multi-step jobs that need retries or waiting.

Learn:

- Producer and consumer services
- Retries and dead-letter handling
- Idempotency
- Eventual consistency
- Durable job state

Definition of done:

- Failed jobs can be retried safely
- Duplicate messages do not duplicate important actions
- Permanently failed jobs are visible for investigation

### 8. Infrastructure as Code

Manage Cloudflare resources with Terraform or OpenTofu:

- Workers
- D1 databases
- R2 buckets
- KV namespaces
- DNS records
- Routes
- WAF configuration

Do not place secret values in the infrastructure code. Define the secret resource or binding, then provide the value through a secure secret manager.

Learn:

- Declarative infrastructure
- State files
- Plans and applies
- Drift detection
- Resource dependencies

Definition of done:

- A new environment can be recreated from code
- Production changes are reviewed before applying
- Dashboard changes do not become undocumented infrastructure drift

### 9. Desktop Release Operations

Improve Tauri releases with GitHub Actions:

- Build Windows artifacts automatically
- Publish checksums
- Generate release notes
- Sign binaries
- Upload artifacts to GitHub Releases
- Add an update manifest if auto-updates are enabled

Learn:

- Artifact pipelines
- Code signing
- Release provenance
- Versioning
- Supply-chain trust

## Suggested First Three Projects

### Project A: CI Pipeline

Create pull request checks for `website/`, `blog/`, `src/`, and `src-tauri/`.

### Project B: Blog Staging

Create isolated staging Worker, D1, R2, KV, and Turnstile resources.

### Project C: D1 Backup Worker

Run a daily backup to R2 and test restoring it into staging.

These projects teach the most important operational concepts without adding unnecessary product complexity.

## Operating Principles

- Keep production and staging completely separate.
- Store secrets only in secret managers.
- Prefer automation over manual dashboard actions.
- Make deployments reversible.
- Test backups by restoring them.
- Make background jobs idempotent.
- Monitor user-facing behavior, not only infrastructure health.
- Document every production resource and its owner.
