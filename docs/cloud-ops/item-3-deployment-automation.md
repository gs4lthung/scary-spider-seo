# Item 3: Deployment Automation

## Objective

Automate deployments so merges to production deploy predictably, with protected environments and migration ordering.

## Status: Done

## What's Implemented

### Deploy Workflows

| Workflow | File | Trigger | Target |
|----------|------|---------|--------|
| Deploy Cloudflare Apps | `deploy-cloudflare.yml` | Push to `main` (website/blog paths) | Production website + blog |
| Deploy Staging | `deploy-staging.yml` | Push to `staging` branch | Staging blog |
| Deploy D1 Backup | `deploy-d1-backup.yml` | Push to `main` (ops/d1-backup paths) | Production backup Worker |
| Deploy Site Monitor | `deploy-site-monitor.yml` | Push to `main` (ops/site-monitor paths) | Production monitor Worker |
| Deploy Comment Notifications | `deploy-comment-notifications.yml` | Push to `main`/`staging` (ops/comment-notifications paths) | Production + staging consumer |

All workflows support `workflow_dispatch` for manual triggers.

### Protected Environments

| Environment | Used By |
|-------------|---------|
| `Production` | deploy-cloudflare, deploy-d1-backup, deploy-site-monitor, deploy-comment-notifications (prod job), monitor-failures |
| `Staging` | deploy-staging, deploy-comment-notifications (staging job), test-d1-restore |

GitHub environment protection rules can require reviewers, wait timers, or branch restrictions.

### Migration Ordering

The blog deploy workflow runs D1 migrations **before** deploying the Worker:

```yaml
- name: Apply D1 migrations
  run: npm run db:migrate:remote
- name: Deploy blog Worker
  run: npx opennextjs-cloudflare deploy
```

### Concurrency Controls

| Workflow | Group | Cancel in Progress |
|----------|-------|-------------------|
| deploy-cloudflare | `cloudflare-production` | No |
| deploy-staging | `cloudflare-staging` | Yes |
| deploy-d1-backup | `d1-backup-production` | No |
| deploy-site-monitor | `site-monitor-production` | No |
| deploy-comment-notifications | `comment-notifications-${{ github.ref_name }}` | No |

## How It Works

1. Push to `main` triggers production deploys (path-gated)
2. Push to `staging` triggers staging deploy
3. Each deploy runs in a protected environment
4. Concurrency groups prevent overlapping deploys
5. Failed deployments do not silently succeed (workflow fails)

## How to Verify

```bash
# Check deploy status
gh run list --workflow=deploy-cloudflare.yml

# Manual deploy
gh workflow run deploy-cloudflare.yml
```

## Gaps / TODO

None. All planned deployment automation is in place.
