# Item 8: Infrastructure as Code

## Objective

Manage Cloudflare resources with Terraform so environments can be recreated from code, infrastructure changes are reviewed before applying, and dashboard changes do not become undocumented drift.

## Status: Missing

## Current State

All Cloudflare resources are provisioned manually via the dashboard. Resource IDs are hardcoded in `wrangler.jsonc` files. Creating a new environment requires manual D1/R2/KV/Queue creation.

## Planned Implementation

### Tool Choice

**Terraform** with the official Cloudflare provider (`cloudflare/cloudflare`).

`cf-terraforming` will be used to import existing resources into Terraform state.

### Directory Structure

```
terraform/
├── main.tf              # provider config, required_providers
├── variables.tf         # account_id, zone_id, environment
├── outputs.tf           # resource IDs referenced by wrangler.jsonc
├── providers.tf         # cloudflare provider config
├── backend.tf           # remote state (Cloudflare R2 or local for now)
├── dns.tf               # DNS records (apex A, www CNAME, blog CNAME)
├── d1.tf                # D1 databases (prod + staging)
├── r2.tf                # R2 buckets (prod + staging + backups)
├── kv.tf                # KV namespaces (6 total)
├── queues.tf            # Queues + DLQs (prod + staging)
├── workers.tf           # Worker shells (5 workers, no code)
├── send-email.tf        # Send Email bindings
├── redirect-rules.tf    # www → non-www redirect rule
└── terraform.tfvars     # actual IDs (gitignored)
```

### Resource Inventory

**DNS (3 records)**
- `scaryspiderseo.com` — A record (proxy IP)
- `www.scaryspiderseo.com` — CNAME → `scaryspiderseo.com`
- `blog.scaryspiderseo.com` — CNAME → custom domain

**D1 (2 databases)**
- `blog-db` (production)
- `blog-db-staging` (staging)

**R2 (3 buckets)**
- `blog-media` (production)
- `blog-media-staging` (staging)
- `blog-db-backups` (production backups)

**KV (6 namespaces)**
- ISR cache (production)
- Rate limits (production)
- Monitor state
- Comment notification state (production)
- ISR cache (staging)
- Rate limits (staging) + comment notification state (staging)

**Queues (4 queues)**
- `comment-notifications` + `comment-notifications-dlq` (production)
- `comment-notifications-staging` + `comment-notifications-dlq-staging` (staging)

**Workers (5 shells)**
- `scary-spider-seo-website`
- `scary-spider-seo-blog`
- `scary-spider-seo-d1-backup`
- `scary-spider-seo-site-monitor`
- `scary-spider-seo-comment-notifications`

**Redirect Rules (1 rule)**
- www → non-www wildcard redirect

### What Terraform Manages vs What Stays in Wrangler

| Managed by Terraform | Managed by Wrangler |
|---------------------|---------------------|
| D1 databases | Worker source code |
| R2 buckets | Worker bindings (in wrangler.jsonc) |
| KV namespaces | Cron triggers |
| Queues + DLQs | Custom domains / routes |
| DNS records | Secrets |
| Workers (shell only) | |

### Secrets (NOT in Terraform)

- `SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, `ALERT_TO_EMAIL` — stay via `wrangler secret put`

## Implementation Steps

1. Install Terraform: `winget install HashiCorp.Terraform`
2. Create `terraform/` directory with all `.tf` files
3. Use `cf-terraforming` to generate initial configs from existing resources
4. Write `.tfvars` with actual resource IDs from the dashboard
5. `terraform import` existing resources into state
6. Update `wrangler.jsonc` to reference Terraform outputs (resource IDs stay the same)
7. Add `.gitignore` for `terraform.tfstate` and `terraform.tfvars`
8. Optionally set up remote state in R2 for team collaboration
9. Update `CLOUD-OPS-ROADMAP.md` to mark Item 8 as done

## How to Verify

```bash
cd terraform
terraform init
terraform plan    # should show no changes if everything matches
terraform apply   # should not create or destroy anything
```

## Gaps / TODO

- Not yet implemented
- Need to decide on remote state backend (R2 vs local)
- Need to handle existing resource import without disruption
