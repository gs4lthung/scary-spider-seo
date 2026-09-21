# Worker shells managed by Terraform.
# Source code and bindings (D1, R2, KV, etc.) are deployed by Wrangler.
# Terraform only owns the Worker resource so it can be recreated from code.
# All computed attributes (observability, traces, subdomain, references, tags)
# are ignored to avoid drift with Wrangler-managed settings.

resource "cloudflare_worker" "website" {
  account_id = var.cloudflare_account_id
  name       = "scary-spider-seo-website"
  lifecycle { ignore_changes = all }
}

resource "cloudflare_worker" "blog" {
  account_id = var.cloudflare_account_id
  name       = "scary-spider-seo-blog"
  lifecycle { ignore_changes = all }
}

resource "cloudflare_worker" "blog_staging" {
  account_id = var.cloudflare_account_id
  name       = "scary-spider-seo-blog-staging"
  lifecycle { ignore_changes = all }
}

resource "cloudflare_worker" "d1_backup" {
  account_id = var.cloudflare_account_id
  name       = "scary-spider-seo-d1-backup"
  lifecycle { ignore_changes = all }
}

resource "cloudflare_worker" "site_monitor" {
  account_id = var.cloudflare_account_id
  name       = "scary-spider-seo-site-monitor"
  lifecycle { ignore_changes = all }
}

resource "cloudflare_worker" "comment_notifications" {
  account_id = var.cloudflare_account_id
  name       = "scary-spider-seo-comment-notifications"
  lifecycle { ignore_changes = all }
}

resource "cloudflare_worker" "comment_notifications_staging" {
  account_id = var.cloudflare_account_id
  name       = "scary-spider-seo-comment-notifications-staging"
  lifecycle { ignore_changes = all }
}
